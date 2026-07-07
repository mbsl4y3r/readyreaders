/**
 * Generates recording-script.md + clips.csv — the checklist the family
 * records from. One clip per line; drop finished files into
 * public/audio/<folder>/<id>.mp3 (or .m4a). Run: npm run recording-script
 */
import { writeFile } from 'node:fs/promises';
import { buildManifest } from './clip-manifest';

const clips = buildManifest();

const KIND_TITLES: Record<string, string> = {
  graphemes: '1 · Letter sounds (record these FIRST — the game stays silent on tile-taps without them)',
  ui: '2 · Game narration',
  words: '3 · Words (in book order — early lessons matter most)',
  phrases: '4 · Phrases',
  sentences: '5 · Sentences (the fluent models Evie imitates — worth doing well!)',
};

let md = `# Ready Readers — family recording script

Record on a phone (Voice Memos is fine) in a quiet room. One clip per line.
Name each file exactly as shown and drop it into the matching folder under
\`public/audio/\`. Both .mp3 and .m4a work. Check what's missing anytime with
\`npm run audio-check\`.

**Letter-sound coaching:** say the PURE sound, short and clipped — /sh/ not
"shuh", /t/ not "tuh" — and never the letter name. (Same as the book:
*aaa, mmm, nnn.*)

Total clips: ${clips.length}

`;

const csv: string[] = ['folder,filename,line,note'];

for (const kind of ['graphemes', 'ui', 'words', 'phrases', 'sentences'] as const) {
  const group = clips.filter((c) => c.kind === kind);
  if (group.length === 0) continue;
  md += `\n## ${KIND_TITLES[kind]}\n\n`;
  md += `Folder: \`public/audio/${kind}/\` · ${group.length} clips\n\n`;
  md += `| File | Say | Note |\n| --- | --- | --- |\n`;
  for (const c of group) {
    md += `| \`${c.id}.mp3\` | ${c.scriptLine} | ${c.note ?? ''} |\n`;
    csv.push(
      `${kind},${c.id}.mp3,"${c.scriptLine.replaceAll('"', '""')}","${(c.note ?? '').replaceAll('"', '""')}"`,
    );
  }
}

await writeFile('recording-script.md', md);
await writeFile('clips.csv', csv.join('\n') + '\n');
console.log(`✓ recording-script.md + clips.csv (${clips.length} clips)`);
