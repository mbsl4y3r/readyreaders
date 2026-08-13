/**
 * Guard against dead zones in tappable controls.
 *
 * A six-year-old taps the middle of a thing. The character cards in the
 * creator only responded to taps in their TOP-LEFT QUADRANT, which is the
 * kind of bug that makes a child think the game is broken and stop playing.
 *
 * The cause was a hand-rolled hit box: `setInteractive(new Rectangle(-w/2,
 * -h/2, w, h), Rectangle.Contains)`. That looks more correct than the
 * alternative, and Phaser's own Rectangle.Contains agrees a tap at the
 * bottom of the card is inside it — but under this game's 2x camera zoom the
 * live input path lands the declared offsets doubled, so the effective box
 * is the declared one shifted by (-w/2, -h/2). A centred declaration ends up
 * with its bottom-right corner on the control's centre.
 *
 * `setSize()` + a bare `setInteractive()` declares a top-left anchored box,
 * which lands centred — that is what makeButton has always done and why
 * every ordinary button in the game works. So: nobody hand-rolls a centred
 * rectangle. A circle centred on the origin is fine, because shifting an
 * offset of zero changes nothing.
 *
 * Verified live by scripts/hit-area-check.mjs, which measures the tappable
 * edges against the drawn ones.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (entry.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('tappable controls have hit boxes that match what is drawn', () => {
  const files = sourceFiles('src');

  it('NEGATIVE: nobody passes a centred Rectangle to setInteractive', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, ...))
      const re = /setInteractive\(\s*new\s+Phaser\.Geom\.Rectangle\(\s*-/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line}`);
      }
    }
    expect(offenders, `hand-rolled centred hit boxes only respond in their top-left quadrant`).toEqual([]);
  });

  it('any explicit Circle hit area stays centred on the origin', () => {
    // A circle at (0,0) is unaffected: shifting an offset of zero is a no-op.
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const re = /setInteractive\(\s*new\s+Phaser\.Geom\.Circle\(\s*([^,]+),\s*([^,]+),/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const [, cx, cy] = m;
        if (cx!.trim() !== '0' || cy!.trim() !== '0') {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${file}:${line} (circle at ${cx!.trim()},${cy!.trim()})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the shared button helper still uses the pattern that measures correctly', () => {
    const kit = readFileSync('src/ui/kit.ts', 'utf8');
    // setSize(...) followed by a bare setInteractive() — the combination that
    // produces a top-left declaration and therefore a centred live hit box
    expect(kit).toMatch(/container\.setSize\(w, h\);\s*\n\s*container\.setInteractive\(\{/);
  });
});
