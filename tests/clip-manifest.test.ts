import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildManifest } from '../scripts/clip-manifest';

/**
 * The recording script must never silently fall behind the game: every
 * speakUI id used anywhere in src/ has to exist in the clip manifest, or
 * the family would have no line to record for it. Dynamic template ids
 * (level-${...}, story-${...}) are checked by their expanded manifest
 * entries via prefix.
 */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (name.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('clip manifest covers the game', () => {
  const manifest = buildManifest();
  const uiIds = new Set(manifest.filter((c) => c.kind === 'ui').map((c) => c.id));
  const src = sourceFiles(join(__dirname, '..', 'src'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  it('every static speakUI id in src/ has a manifest entry', () => {
    const missing: string[] = [];
    for (const m of src.matchAll(/speakUI\(\s*'([^']+)'/g)) {
      if (!uiIds.has(m[1]!)) missing.push(m[1]!);
    }
    expect(missing, `add these ui lines to scripts/clip-manifest.ts: ${missing.join(', ')}`).toEqual([]);
  });

  it('template speakUI ids expand to manifest entries', () => {
    // every template like speakUI(`foo-${...}`) must have at least one
    // manifest id starting with its static prefix
    const missing: string[] = [];
    for (const m of src.matchAll(/speakUI\(\s*`([^$`]+)\$\{/g)) {
      const prefix = m[1]!;
      if (![...uiIds].some((id) => id.startsWith(prefix))) missing.push(prefix + '*');
    }
    expect(missing, `no manifest entries for template ids: ${missing.join(', ')}`).toEqual([]);
  });

  it('grapheme clips exist for every grapheme any word uses, with no TTS fallback', () => {
    const graphemes = manifest.filter((c) => c.kind === 'graphemes');
    expect(graphemes.length).toBeGreaterThan(30);
    for (const g of graphemes) expect(g.ttsFallback).toBe(false);
  });

  it('story pages are all in the manifest', () => {
    const pages = manifest.filter((c) => c.id.startsWith('story-st'));
    expect(pages.length).toBeGreaterThanOrEqual(18); // 6 stories × 3+ pages
  });

  it('has no duplicate clip ids within a folder', () => {
    const seen = new Set<string>();
    for (const c of manifest) {
      const key = `${c.kind}/${c.id}`;
      expect(seen.has(key), `duplicate clip ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
