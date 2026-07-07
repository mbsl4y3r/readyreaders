/**
 * Reports which voice clips exist vs. are still missing.
 * Run: npm run audio-check
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildManifest } from './clip-manifest';

const clips = buildManifest();
const kinds = ['graphemes', 'ui', 'words', 'phrases', 'sentences'] as const;

const existing = new Set<string>();
for (const kind of kinds) {
  try {
    for (const f of await readdir(join('public/audio', kind))) {
      const id = f.replace(/\.(mp3|m4a)$/i, '');
      if (id !== f) existing.add(`${kind}/${id}`);
    }
  } catch {
    // folder doesn't exist yet — that's fine
  }
}

let recorded = 0;
const missingByKind = new Map<string, string[]>();
for (const c of clips) {
  if (existing.has(`${c.kind}/${c.id}`)) recorded++;
  else missingByKind.set(c.kind, [...(missingByKind.get(c.kind) ?? []), c.id]);
}

console.log(`Recorded: ${recorded}/${clips.length} clips`);
for (const kind of kinds) {
  const missing = missingByKind.get(kind) ?? [];
  if (missing.length === 0) continue;
  const preview = missing.slice(0, 8).join(', ');
  console.log(`  ${kind}: ${missing.length} missing (${preview}${missing.length > 8 ? ', …' : ''})`);
}

// unknown files (typos in names)
const known = new Set(clips.map((c) => `${c.kind}/${c.id}`));
const strays = [...existing].filter((e) => !known.has(e));
if (strays.length > 0) {
  console.log(`\n⚠ Files that match no clip (typo in the name?):`);
  for (const s of strays) console.log(`  - public/audio/${s}`);
}
