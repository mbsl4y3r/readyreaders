/**
 * Local dev server for the family voice recorder (tools/recorder/index.html).
 * Lets the parent record clips in the browser and lands them in the repo with
 * the exact filenames the game loads — no renaming, no drag-and-drop typos.
 *
 * Security model: kind+id from the client are only ever LOOKED UP in the
 * manifest, never used to build a path directly — that is what makes
 * traversal impossible. Bound to 127.0.0.1 so nothing off-machine can write.
 * Run: npm run recorder
 */
import http from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, type Clip } from './clip-manifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'public', 'audio');
const PAGE = join(ROOT, 'tools', 'recorder', 'index.html');
// browser (IIFE) build of the MP3 encoder — served same-origin so the page
// stays CDN-free and works offline
const LAMEJS = join(ROOT, 'node_modules', '@breezystack', 'lamejs', 'dist', 'lamejs.iife.js');

const PORT = 5179;
const EXTS = ['mp3', 'm4a', 'wav'] as const;
const SAVE_FORMATS = ['mp3', 'wav'] as const;

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
};

const manifest = buildManifest();
const byKey = new Map<string, Clip>(manifest.map((c) => [`${c.kind}/${c.id}`, c]));

/** The only way client input becomes a clip: exact manifest match or nothing. */
function clipFor(kind: unknown, id: unknown): Clip | null {
  if (typeof kind !== 'string' || typeof id !== 'string') return null;
  return byKey.get(`${kind}/${id}`) ?? null;
}

function existingExt(clip: Clip): string | null {
  for (const ext of EXTS) {
    if (existsSync(join(AUDIO_DIR, clip.kind, `${clip.id}.${ext}`))) return ext;
  }
  return null;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function sendFile(res: http.ServerResponse, path: string, ext: string): Promise<void> {
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { ok: false, error: 'not found' });
  }
}

function readBody(req: http.IncomingMessage, limit = 32 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleSave(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(await readBody(req)) as Record<string, unknown>;
  } catch {
    return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
  }
  const clip = clipFor(payload.kind, payload.id);
  if (!clip) return sendJson(res, 400, { ok: false, error: 'kind/id matches no clip in the manifest' });
  const format = payload.format;
  if (typeof format !== 'string' || !(SAVE_FORMATS as readonly string[]).includes(format)) {
    return sendJson(res, 400, { ok: false, error: 'format must be mp3 or wav' });
  }
  if (typeof payload.data !== 'string' || payload.data.length === 0) {
    return sendJson(res, 400, { ok: false, error: 'missing base64 data' });
  }
  const bytes = Buffer.from(payload.data, 'base64');
  if (bytes.length === 0) return sendJson(res, 400, { ok: false, error: 'empty audio data' });

  const dir = join(AUDIO_DIR, clip.kind);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${clip.id}.${format}`), bytes);
  // a re-record in a different format must not leave a stale twin behind —
  // the game tries mp3 first and would keep playing the old take
  for (const ext of EXTS) {
    if (ext === format) continue;
    const stale = join(dir, `${clip.id}.${ext}`);
    if (existsSync(stale)) await unlink(stale);
  }
  console.log(`  saved ${clip.kind}/${clip.id}.${format} (${(bytes.length / 1024).toFixed(1)} KB)`);
  sendJson(res, 200, { ok: true });
}

async function handleDelete(url: URL, res: http.ServerResponse): Promise<void> {
  const clip = clipFor(url.searchParams.get('kind'), url.searchParams.get('id'));
  if (!clip) return sendJson(res, 400, { ok: false, error: 'kind/id matches no clip in the manifest' });
  for (const ext of EXTS) {
    const path = join(AUDIO_DIR, clip.kind, `${clip.id}.${ext}`);
    if (existsSync(path)) await unlink(path);
  }
  console.log(`  deleted ${clip.kind}/${clip.id}`);
  sendJson(res, 200, { ok: true });
}

/** /audio/<kind>/<id>.<ext> — parsed then re-validated against the manifest. */
async function handleAudio(pathname: string, res: http.ServerResponse): Promise<void> {
  const m = /^\/audio\/([a-z]+)\/(.+)\.(mp3|m4a|wav)$/.exec(pathname);
  const clip = m ? clipFor(m[1], decodeURIComponent(m[2] ?? '')) : null;
  if (!clip || !m) return sendJson(res, 404, { ok: false, error: 'not found' });
  const ext = m[3] ?? 'mp3';
  await sendFile(res, join(AUDIO_DIR, clip.kind, `${clip.id}.${ext}`), ext);
}

const server = http.createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const { pathname } = url;
    if (req.method === 'GET' && pathname === '/') return sendFile(res, PAGE, 'html');
    if (req.method === 'GET' && pathname === '/lamejs.js') return sendFile(res, LAMEJS, 'js');
    if (req.method === 'GET' && pathname === '/manifest.json') {
      const entries = manifest.map((c) => {
        const ext = existingExt(c);
        return { kind: c.kind, id: c.id, scriptLine: c.scriptLine, note: c.note ?? null, exists: ext !== null, ext };
      });
      return sendJson(res, 200, entries);
    }
    if (req.method === 'GET' && pathname.startsWith('/audio/')) return handleAudio(pathname, res);
    if (req.method === 'POST' && pathname === '/save') return handleSave(req, res);
    if (req.method === 'DELETE' && pathname === '/clip') return handleDelete(url, res);
    sendJson(res, 404, { ok: false, error: 'not found' });
  })().catch((err: unknown) => {
    sendJson(res, 500, { ok: false, error: String(err) });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Recorder: http://localhost:${PORT} (mic needs localhost or https)`);
  console.log(`  ${manifest.length} clips in the manifest; MP3 encoder ${existsSync(LAMEJS) ? 'available' : 'MISSING — will save WAV'}`);
});
