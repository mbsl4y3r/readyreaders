/**
 * Audio routing: family recordings first, TTS fallback second, and for
 * letter sounds (graphemes) NO fallback at all — recordings only.
 *
 * Clips live in public/audio/{words,phrases,sentences,graphemes,ui}/<id>.mp3
 * (m4a also accepted). An index of what actually exists is generated at build
 * time; at runtime we simply try the file and remember misses.
 */
import { speak } from './tts';

type ClipKind = 'words' | 'phrases' | 'sentences' | 'graphemes' | 'ui';

const ctx: AudioContext | null =
  typeof window !== 'undefined' && 'AudioContext' in window ? new AudioContext() : null;

const bufferCache = new Map<string, AudioBuffer | null>();

/**
 * iOS blocks audio until a user gesture. Call from the first pointer event
 * (the splash tap): resumes the context and plays a silent buffer.
 */
export function unlockAudio(): void {
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
}

async function loadClip(kind: ClipKind, id: string): Promise<AudioBuffer | null> {
  const key = `${kind}/${id}`;
  if (bufferCache.has(key)) return bufferCache.get(key)!;
  if (!ctx) {
    bufferCache.set(key, null);
    return null;
  }
  for (const ext of ['mp3', 'm4a']) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/${kind}/${id}.${ext}`);
      if (!res.ok) continue;
      const type = res.headers.get('content-type') ?? '';
      // dev servers return index.html for missing files
      if (type.includes('text/html')) continue;
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      bufferCache.set(key, buffer);
      return buffer;
    } catch {
      // try next extension
    }
  }
  bufferCache.set(key, null);
  return null;
}

function playBuffer(buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    if (!ctx) return resolve();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start(0);
  });
}

async function playClipOr(
  kind: ClipKind,
  id: string,
  fallback: (() => Promise<void>) | null,
): Promise<void> {
  const buffer = await loadClip(kind, id);
  if (buffer) return playBuffer(buffer);
  if (fallback) return fallback();
}

/** Speak a word: recording if present, else TTS. */
export function speakWord(id: string, text: string): Promise<void> {
  return playClipOr('words', id, () => speak(text, { rate: 0.8 }));
}

export function speakPhrase(id: string, text: string): Promise<void> {
  return playClipOr('phrases', id, () => speak(text));
}

export function speakSentence(id: string, text: string): Promise<void> {
  return playClipOr('sentences', id, () => speak(text));
}

/**
 * Letter SOUND. Recording only — never TTS (it would say the letter name).
 * Resolves false when no recording exists so the caller can degrade
 * to whole-word modeling.
 */
export async function speakGrapheme(g: string): Promise<boolean> {
  const id = g.toLowerCase().replace(/[^a-z_']/g, '') || 'x';
  const buffer = await loadClip('graphemes', id);
  if (!buffer) return false;
  await playBuffer(buffer);
  return true;
}

/** UI narration line: recording if present, else TTS of the given text. */
export function speakUI(id: string, text: string): Promise<void> {
  return playClipOr('ui', id, () => speak(text));
}

/** Short synthesized chime for correct answers (no asset needed). */
export function chime(kind: 'good' | 'gentle' | 'fanfare'): void {
  if (!ctx) return;
  const notes =
    kind === 'good' ? [523.25, 659.25] : kind === 'gentle' ? [392] : [523.25, 659.25, 783.99, 1046.5];
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.4);
  });
}
