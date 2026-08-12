/**
 * Zero-dependency CDP driver for the player agents.
 *
 * Why not Playwright: playwright-core is not in package-lock.json, and the
 * user has restricted downloads. Node 22 ships a global WebSocket, and the
 * Chromium binary is already on disk, so we speak the DevTools protocol
 * directly. This is also MORE faithful to the brief: Input.dispatchTouchEvent
 * delivers real touch events, not synthesised mouse clicks.
 *
 * Players must drive the game through THIS module only (tap/drag/screenshot).
 * evalJS() is for ASSERTIONS about state, never for driving the game.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/**
 * Capture-faithful viewport. The game's drawing buffer is fixed at
 * 2048x1440 (GAME 1024x720 x RENDER_SCALE 2). Headless Chromium blits that
 * buffer 1:1 into the device surface instead of downscaling it, so a capture
 * is only truthful when device px == buffer px: CSS 1024x720 at dpr 2.
 * Any other combination yields a 2x top-left crop that mimics a layout bug.
 * Aspect-ratio behaviour is verified from the engine's own camera metrics
 * (camera.worldView), which are correct at every size.
 */
export const IPAD = { width: 1024, height: 720, dpr: 2 };

async function getJSON(url) {
  const res = await fetch(url);
  return res.json();
}

class Session {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  on(fn) {
    this.listeners.push(fn);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
}

export async function launch({ headless = true, viewport = IPAD } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
  const port = 9000 + Math.floor(performance.now() % 900);
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-sandbox',
    '--use-gl=swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-frame-rate-limit',
    '--no-first-run',
    '--window-size=' + viewport.width + ',' + viewport.height,
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');
  const proc = spawn(CHROMIUM, args, { stdio: 'ignore' });

  // wait for the debugging endpoint
  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      version = await getJSON(`http://127.0.0.1:${port}/json/version`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!version) throw new Error('chromium did not expose a debugging port');

  const targets = await getJSON(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  const s = new Session(ws);
  await s.send('Page.enable');
  await s.send('Runtime.enable');
  await s.send('Log.enable');
  await s.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dpr,
    mobile: true,
  });
  await s.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const errors = [];
  s.on((m) => {
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(m.params.entry.text);
    }
    if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description ?? ''));
    }
  });

  return new Page(s, proc, profile, errors, viewport);
}

export class Page {
  constructor(session, proc, profile, errors, viewport) {
    this.s = session;
    this.proc = proc;
    this.profile = profile;
    this.errors = errors;
    this.viewport = viewport;
  }

  async goto(url) {
    await this.s.send('Page.navigate', { url });
    await this.wait(600);
  }

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Read state for ASSERTIONS. Never use this to drive the game. */
  async evalJS(expr) {
    const r = await this.s.send('Runtime.evaluate', {
      expression: `(() => { try { return JSON.stringify(${expr}); } catch (e) { return JSON.stringify({__err: String(e)}); } })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    const v = r.result?.value;
    return v === undefined ? undefined : JSON.parse(v);
  }

  async waitFor(expr, { timeout = 15000, label = expr } = {}) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await this.evalJS(`!!(${expr})`)) return true;
      await this.wait(150);
    }
    throw new Error(`waitFor timed out: ${label}`);
  }

  /**
   * Map GAME world coords (1024x720) to CSS px. The canvas is FIT-scaled and
   * centred, so a tap computed in world space lands where the child would touch.
   */
  async worldToCss(wx, wy) {
    const box = await this.evalJS(`(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    })()`);
    if (!box) throw new Error('no canvas on page');
    return { x: box.x + (wx / 1024) * box.w, y: box.y + (wy / 720) * box.h };
  }

  /** A real one-finger tap at GAME world coordinates. */
  async tap(wx, wy, { holdMs = 60 } = {}) {
    const { x, y } = await this.worldToCss(wx, wy);
    const pt = [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await this.s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
    await this.wait(holdMs);
    await this.s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /** Rapid repeated taps — the six-year-old stress test. */
  async spamTap(wx, wy, times = 5, gapMs = 45) {
    for (let i = 0; i < times; i++) {
      await this.tap(wx, wy, { holdMs: 25 });
      await this.wait(gapMs);
    }
  }

  /** A real drag in GAME world coordinates. */
  async drag(x1, y1, x2, y2, { steps = 12 } = {}) {
    const a = await this.worldToCss(x1, y1);
    const b = await this.worldToCss(x2, y2);
    const mk = (x, y) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await this.s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: mk(a.x, a.y) });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.s.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: mk(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
      });
      await this.wait(16);
    }
    await this.s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  /**
   * Plain viewport capture. This is only correct because the emulation runs
   * at deviceScaleFactor 1 (CSS px == device px). With a dpr override,
   * captureScreenshot's clip is applied in device pixels while
   * getBoundingClientRect reports CSS pixels, and every capture comes back a
   * 2x magnified crop that looks exactly like a game-side layout bug.
   */
  async screenshot(path) {
    const r = await this.s.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
    return path;
  }

  /** Seed a save before first load. */
  async seed(save) {
    await this.s.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('readyreaders.v1', ${JSON.stringify(JSON.stringify(save))});`,
    });
  }

  /** Force any in-flight camera fade to finish so screenshots show final state. */
  async settle(ms = 500) {
    await this.wait(ms);
    await this.evalJS(`(() => {
      const g = window.__game; if (!g) return 0;
      g.scene.getScenes(true).forEach(s => { s.cameras.main.resetFX(); s.cameras.main.setAlpha(1); });
      return 1;
    })()`);
    await this.wait(150);
  }

  async close() {
    try { this.proc.kill('SIGKILL'); } catch {}
    try { rmSync(this.profile, { recursive: true, force: true }); } catch {}
  }
}

/*
 * CAPTURE CAVEAT (verified 3 ways, do not re-litigate):
 * Screenshots from this harness are NOT trustworthy for visual judgement.
 * Under headless swiftshader the Text texture source reports 1x1 and frames
 * come back as a ~2x top-left crop at EVERY viewport/dpr combination,
 * including a perfect 1:1 (CSS 2048x1440 == drawing buffer, dpr 1).
 * Evidence it is the harness and not the game:
 *   1. camera.worldView is exactly [0,0,1024,720] at every viewport and dpr;
 *   2. title.x/width are identical (512 / 438) across dpr 1 and 2;
 *   3. RES was already 3 at commit 8a69d77, whose build produced CORRECT
 *      screenshots through Playwright's capture path.
 * USE THIS HARNESS FOR: real touch input, scene/state assertions, timing,
 * console errors, persistence checks. Judge visuals from the Playwright
 * corpus in scratchpad/audit2 and scratchpad/polish instead.
 */
