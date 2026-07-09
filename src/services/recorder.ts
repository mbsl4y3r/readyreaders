/**
 * recorder.ts — standalone audio recording/playback service.
 *
 * Lets a child record herself reading, persists the audio Blob in IndexedDB,
 * and plays it back later. Pure browser APIs, no dependencies. Every public
 * function is resilient: it feature-detects and never throws to the caller,
 * resolving null/false/void on unsupported, denied, or error conditions.
 */

const DB_NAME = 'readyreaders-audio';
const DB_VERSION = 1;
const STORE_NAME = 'clips';
const KEY_PATH = 'id';
const FALLBACK_MIME = 'audio/webm';

/** Row shape stored in the object store. */
interface ClipRecord {
  id: string;
  blob: Blob;
}

// --- Recording state (module-level) ---
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let chunks: Blob[] = [];

// --- Playback state (module-level) ---
let currentAudio: HTMLAudioElement | null = null;

// --- IndexedDB (opened once, promise cached) ---
let dbPromise: Promise<IDBDatabase | null> | null = null;

/** True if the runtime exposes IndexedDB. */
function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Open (once) and cache the database connection. Resolves null if unavailable. */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) {
    return dbPromise;
  }

  if (!hasIndexedDB()) {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (): void => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: KEY_PATH });
        }
      };

      request.onsuccess = (): void => {
        resolve(request.result);
      };

      request.onerror = (): void => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

/** Run a callback inside a transaction, resolving the promise it feeds. */
function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, resolve: (value: T) => void) => void,
  fallback: T
): Promise<T> {
  return openDb().then((db) => {
    if (!db) {
      return fallback;
    }

    return new Promise<T>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        tx.onerror = (): void => resolve(fallback);
        tx.onabort = (): void => resolve(fallback);
        run(store, resolve);
      } catch {
        resolve(fallback);
      }
    });
  });
}

/**
 * True if the browser can record audio: getUserMedia and MediaRecorder both
 * exist.
 */
export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

/**
 * Request the microphone and begin recording. Returns false if unsupported,
 * denied, or already recording.
 */
export async function startRecording(): Promise<boolean> {
  if (!isRecordingSupported()) {
    return false;
  }

  if (mediaRecorder) {
    // Already recording.
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);

    chunks = [];
    recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.start();

    mediaStream = stream;
    mediaRecorder = recorder;
    return true;
  } catch {
    // Denied, no device, or construction failed. Clean up any partial stream.
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    mediaRecorder = null;
    return false;
  }
}

/** Stop the microphone stream and clear recording state. */
function teardownRecording(): void {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  mediaRecorder = null;
}

/**
 * Stop recording and resolve the assembled audio Blob. Returns null if nothing
 * was recording.
 */
export async function stopRecording(): Promise<Blob | null> {
  const recorder = mediaRecorder;
  if (!recorder) {
    return null;
  }

  const mimeType = recorder.mimeType || FALLBACK_MIME;

  return new Promise<Blob | null>((resolve) => {
    const finish = (): void => {
      const blob = new Blob(chunks, { type: mimeType || FALLBACK_MIME });
      chunks = [];
      teardownRecording();
      resolve(blob);
    };

    recorder.onstop = (): void => finish();
    recorder.onerror = (): void => {
      chunks = [];
      teardownRecording();
      resolve(null);
    };

    try {
      recorder.stop();
    } catch {
      chunks = [];
      teardownRecording();
      resolve(null);
    }
  });
}

/** Store (or overwrite) a recording blob in IndexedDB under `id`. */
export async function saveRecording(id: string, blob: Blob): Promise<void> {
  const record: ClipRecord = { id, blob };
  await withStore<void>(
    'readwrite',
    (store, resolve) => {
      const request = store.put(record);
      request.onsuccess = (): void => resolve(undefined);
      request.onerror = (): void => resolve(undefined);
    },
    undefined
  );
}

/** Read a recording blob back from IndexedDB. Null if absent. */
export async function loadRecording(id: string): Promise<Blob | null> {
  return withStore<Blob | null>(
    'readonly',
    (store, resolve) => {
      const request = store.get(id);
      request.onsuccess = (): void => {
        const result = request.result as ClipRecord | undefined;
        resolve(result ? result.blob : null);
      };
      request.onerror = (): void => resolve(null);
    },
    null
  );
}

/**
 * Play the recording for `id`. Stops any current playback first. Returns false
 * if there's no recording or audio can't be created.
 */
export async function playRecording(id: string): Promise<boolean> {
  const blob = await loadRecording(id);
  if (!blob) {
    return false;
  }

  if (typeof Audio === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  stopPlayback();

  try {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const cleanup = (): void => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) {
        currentAudio = null;
      }
    };

    audio.onended = (): void => cleanup();
    audio.onerror = (): void => cleanup();

    currentAudio = audio;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/** Stop any current playback. */
export function stopPlayback(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      // ignore
    }
    currentAudio = null;
  }
}

/** Remove a recording from IndexedDB. */
export async function deleteRecording(id: string): Promise<void> {
  await withStore<void>(
    'readwrite',
    (store, resolve) => {
      const request = store.delete(id);
      request.onsuccess = (): void => resolve(undefined);
      request.onerror = (): void => resolve(undefined);
    },
    undefined
  );
}
