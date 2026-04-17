const REDUCE = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ENABLED_KEY = "kinsa-sounds-v1";

export function loadSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const v = window.localStorage.getItem(ENABLED_KEY);
  if (v === null) return true;
  return v === "1";
}

export function saveSoundEnabled(on: boolean): void {
  window.localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined" || REDUCE()) return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

let shared: AudioContext | null | undefined;

function getCtx(): AudioContext | null {
  if (shared === undefined) shared = ctx();
  return shared;
}

export async function resumeAudioIfNeeded(): Promise<void> {
  const c = getCtx();
  if (c?.state === "suspended") await c.resume().catch(() => undefined);
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.08): void {
  if (!loadSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime;
  o.start(t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.stop(t + dur + 0.02);
}

/** Short “pop” when a new Q&A line lands. */
export function playAnswerChime(): void {
  beep(520, 0.06, "sine", 0.06);
  window.setTimeout(() => beep(660, 0.08, "triangle", 0.05), 40);
}

/** Tiny fanfare on win. */
export function playWinChime(): void {
  beep(392, 0.1, "square", 0.05);
  window.setTimeout(() => beep(523, 0.12, "square", 0.055), 90);
  window.setTimeout(() => beep(659, 0.18, "square", 0.06), 200);
}
