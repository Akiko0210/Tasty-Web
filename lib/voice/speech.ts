// Thin, dependency-free wrappers around the browser Web Speech API
// (SpeechRecognition + speechSynthesis). All entry points are SSR-safe.

// ── Minimal typings (the DOM lib doesn't ship SpeechRecognition) ──────────────
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ── Text to speech ────────────────────────────────────────────────────────────
// Monotonic token so a cancelled utterance's late-firing onend (cancel() fires
// events asynchronously) can't invoke callbacks meant for a newer utterance.
let speakSeq = 0;

export function speak(text: string, opts?: { onstart?: () => void; onend?: () => void; rate?: number }): void {
  if (!ttsSupported() || !text) {
    opts?.onend?.();
    return;
  }
  const synth = window.speechSynthesis;
  const id = ++speakSeq;
  synth.cancel(); // never let responses queue/overlap
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 1.05;
  u.lang = "en-US";
  u.onstart = () => {
    if (id === speakSeq) opts?.onstart?.();
  };
  u.onend = () => {
    if (id === speakSeq) opts?.onend?.();
  };
  u.onerror = () => {
    if (id === speakSeq) opts?.onend?.();
  };
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// ── Speech recognition ────────────────────────────────────────────────────────
export interface RecognizerHandlers {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export function createRecognizer(h: RecognizerHandlers): SpeechRecognitionLike | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0].transcript.trim();
      if (r.isFinal) h.onFinal(text);
      else interim += text;
    }
    if (interim) h.onInterim?.(interim);
  };
  rec.onerror = (e) => h.onError?.(e.error);
  rec.onstart = () => h.onStart?.();
  rec.onend = () => h.onEnd?.();
  return rec;
}
