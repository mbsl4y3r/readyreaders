/**
 * speechSynthesis wrapper — the fallback voice until family recordings exist.
 *
 * HARD RULE: TTS may speak whole words, phrases, and sentences — NEVER
 * isolated letter sounds. TTS says letter *names* ("em") or garbage for
 * phonemes; a recording is the only acceptable source for /m/.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => v.lang.startsWith('en'));
  cachedVoice =
    en.find((v) => v.localService && v.name.toLowerCase().includes('samantha')) ??
    en.find((v) => v.localService) ??
    en[0] ??
    null;
  return cachedVoice;
}

// Voice list loads async on some browsers (notably iOS Safari)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickVoice();
  };
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Speak a word/phrase/sentence. Resolves when done (or immediately if unavailable). */
export function speak(text: string, opts?: { rate?: number }): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsAvailable()) return resolve();
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) u.voice = voice;
      u.rate = opts?.rate ?? 0.85;
      u.pitch = 1.05;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      // safety: resolve even if onend never fires (an iOS quirk)
      setTimeout(resolve, Math.max(2000, text.length * 200));
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking(): void {
  if (ttsAvailable()) window.speechSynthesis.cancel();
}
