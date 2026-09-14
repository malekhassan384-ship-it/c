/**
 * Synthesized sound effects via WebAudio — zero audio assets, fully offline,
 * no third-party samples (© 2026 Malek Hassan Ashour).
 */

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.7;

export function initAudio(): void {
  if (ctx) return;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null; // WebAudio unavailable — degrade silently
  }
}

export function configureAudio(opts: { enabled: boolean; volume: number }): void {
  enabled = opts.enabled;
  volume = Math.min(1, Math.max(0, opts.volume));
}

function tone(freq: number, dur: number, type: OscillatorType, gainPeak: number, delay = 0, freqEnd?: number): void {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak * volume), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sounds = {
  move(): void { tone(440, 0.09, 'triangle', 0.25); tone(660, 0.05, 'sine', 0.12, 0.02); },
  capture(): void { tone(180, 0.16, 'sawtooth', 0.3, 0, 90); tone(320, 0.08, 'square', 0.1, 0.02); },
  check(): void { tone(880, 0.12, 'square', 0.2); tone(1100, 0.14, 'square', 0.16, 0.09); },
  castle(): void { tone(392, 0.08, 'triangle', 0.22); tone(494, 0.08, 'triangle', 0.22, 0.07); tone(587, 0.1, 'triangle', 0.22, 0.14); },
  win(): void { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.25, i * 0.12)); },
  lose(): void { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 'sine', 0.22, i * 0.14)); },
  draw(): void { tone(440, 0.14, 'sine', 0.2); tone(440, 0.14, 'sine', 0.2, 0.16); },
  unlock(): void { [660, 880, 1320].forEach((f, i) => tone(f, 0.12, 'sine', 0.22, i * 0.09)); },
  wrong(): void { tone(220, 0.14, 'sawtooth', 0.18, 0, 160); },
  correct(): void { tone(700, 0.1, 'triangle', 0.24); tone(1050, 0.12, 'triangle', 0.2, 0.08); }
};
