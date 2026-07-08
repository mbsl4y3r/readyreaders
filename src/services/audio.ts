/**
 * Audio routing: family recordings first, TTS fallback second, and for
 * letter sounds (graphemes) NO fallback at all — recordings only.
 *
 * Clips live in public/audio/{words,phrases,sentences,graphemes,ui}/<id>.mp3
 * (m4a also accepted). An index of what actually exists is generated at build
 * time; at runtime we simply try the file and remember misses.
 *
 * Music and sound effects are drop-in the same way: looping tracks under
 * public/audio/music/<id>.*, effect files under public/audio/sfx/<kind>.* —
 * absent files mean silence (music) or the synthesized chime (sfx), so the
 * game is complete without them and upgrades itself when they appear.
 * See docs/music-and-sfx.md for the Gemini prompts and Kenney shopping list.
 */
import { speak } from './tts';

type ClipKind = 'words' | 'phrases' | 'sentences' | 'graphemes' | 'ui' | 'music' | 'sfx';

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
  for (const ext of ['mp3', 'm4a', 'wav']) {
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

/** Chime kinds double as sfx file names: public/audio/sfx/<kind>.mp3. */
export function chime(kind: 'good' | 'gentle' | 'fanfare'): void {
  // a real sound file (e.g. from a Kenney pack) beats the oscillator —
  // but never block the game on the fetch; synth is the instant fallback
  void loadClip('sfx', kind).then((buffer) => {
    if (buffer) return playBuffer(buffer);
    synthChime(kind);
  });
}

function synthChime(kind: 'good' | 'gentle' | 'fanfare'): void {
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

// ---- background music ----------------------------------------------------
// One looping track at a time, quiet under the voice clips, crossfaded on
// scene changes. A missing file is simply silence — tracks are drop-in.

const MUSIC_VOLUME = 0.22;
const FADE_S = 0.7;

let musicEnabled = true;
let musicId: string | null = null;
let musicSource: AudioBufferSourceNode | null = null;
let musicGain: GainNode | null = null;
/** Guards against a slow decode finishing after a newer playMusic call. */
let musicToken = 0;

function stopCurrent(fade: boolean): void {
  if (!ctx || !musicSource || !musicGain) {
    musicSource = null;
    musicGain = null;
    return;
  }
  const src = musicSource;
  const gain = musicGain;
  musicSource = null;
  musicGain = null;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  if (fade) {
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0.0001, now + FADE_S);
    src.stop(now + FADE_S + 0.05);
  } else {
    src.stop();
  }
}

/** Start (or keep) the looping track for this part of the game. */
export function playMusic(id: string): void {
  if (!ctx) return;
  if (musicId === id && musicSource) return; // already playing this one
  musicId = id;
  if (!musicEnabled) return;
  const token = ++musicToken;
  void loadClip('music', id).then((buffer) => {
    if (!ctx || !buffer) return;
    if (token !== musicToken || musicId !== id) return; // superseded meanwhile
    stopCurrent(true);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + FADE_S);
    src.connect(gain).connect(ctx.destination);
    src.start();
    musicSource = src;
    musicGain = gain;
  });
}

export function stopMusic(): void {
  musicId = null;
  musicToken++;
  stopCurrent(true);
}

/** Parent-corner toggle; also called at boot from saved settings. */
export function setMusicEnabled(on: boolean): void {
  musicEnabled = on;
  if (!on) {
    musicToken++;
    stopCurrent(true);
  } else if (musicId) {
    const id = musicId;
    musicId = null; // force a restart of the remembered track
    playMusic(id);
  }
}
