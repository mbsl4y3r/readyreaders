/**
 * Downloads the game's openly licensed assets. Run: npm run fetch-assets
 *
 * Phase 0 fetches the Andika font (SIL OFL — purpose-built for early
 * readers). The Phase 2 art pass adds Kenney CC0 packs (Fish Pack, Animal
 * Pack, UI Pack, particles) here; until then the game renders its world with
 * native emoji + generated graphics, which need no downloads at all.
 *
 * Every asset added here MUST also be recorded in LICENSES.md.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONT_DIR = 'public/fonts/andika';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

async function fetchAndika(): Promise<void> {
  await mkdir(FONT_DIR, { recursive: true });
  const css = await (
    await fetch('https://fonts.googleapis.com/css2?family=Andika:wght@400;700&display=block', {
      headers: { 'user-agent': UA },
    })
  ).text();

  // grab the latin-subset woff2 for each weight
  const blocks = css.split('@font-face').slice(1);
  const wanted: Record<string, string> = {};
  for (const block of blocks) {
    if (!block.includes('U+0000-00FF')) continue;
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    if (url && weight) wanted[weight] = url;
  }
  const files: [string, string][] = [
    ['400', 'Andika-Regular.woff2'],
    ['700', 'Andika-Bold.woff2'],
  ];
  for (const [weight, name] of files) {
    const url = wanted[weight];
    if (!url) throw new Error(`No latin woff2 found for weight ${weight}`);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    await writeFile(join(FONT_DIR, name), buf);
    console.log(`✓ ${name} (${buf.length} bytes)`);
  }
}

await fetchAndika();
console.log('Done. Remember: every asset here must be listed in LICENSES.md.');
