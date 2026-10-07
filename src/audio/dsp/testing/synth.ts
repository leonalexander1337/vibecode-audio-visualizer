/** Deterministic synthetic techno for the DSP tests. */

export const SAMPLE_RATE = 48000;

export interface Section {
  bpm: number;
  seconds: number;
  /** No kicks (and no bass) in this section. */
  breakdown?: boolean;
}

export interface Synth {
  signal: Float32Array;
  /** True kick onset times (s). */
  kicks: number[];
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000 - 0.5;
  };
}

export function synthTechno(sections: Section[], { offset = 0.37, gain = 0.5, noise = 0.02, room = true, seed = 1 } = {}): Synth {
  const total = sections.reduce((s, x) => s + x.seconds, 0) + offset;
  const out = new Float32Array(Math.ceil(total * SAMPLE_RATE));
  const rnd = lcg(seed);
  const kicks: number[] = [];

  let t = offset;
  let sectionStart = offset;
  for (const section of sections) {
    const spb = 60 / section.bpm;
    const end = sectionStart + section.seconds;
    for (; t < end - 1e-9; t += spb) {
      if (!section.breakdown) {
        addKick(out, t);
        kicks.push(t);
        addBass(out, t + spb / 2, spb * 0.4);
      }
      addHat(out, t + spb / 2, rnd);
      addHat(out, t + spb / 4, rnd, 0.06);
    }
    sectionStart = end;
  }

  for (let i = 0; i < out.length; i++) out[i] = out[i] * gain + rnd() * noise;
  if (room) addRoom(out);
  return { signal: out, kicks };
}

function addKick(out: Float32Array, start: number): void {
  const i0 = Math.round(start * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < 0.35 * SAMPLE_RATE && i0 + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += (2 * Math.PI * (45 + 115 * Math.exp(-t * 30))) / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.002);
    out[i0 + i] += 0.9 * attack * Math.exp(-t * 9) * Math.sin(phase);
  }
}

/** Off-beat saw bass at 55 Hz — has energy in the kick band and its own onsets. */
function addBass(out: Float32Array, start: number, duration: number): void {
  const i0 = Math.round(start * SAMPLE_RATE);
  for (let i = 0; i < duration * SAMPLE_RATE && i0 + i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const saw = 2 * ((t * 55) % 1) - 1;
    const env = Math.min(1, t / 0.005) * Math.exp(-t * 6);
    out[i0 + i] += 0.3 * env * saw;
  }
}

function addHat(out: Float32Array, start: number, rnd: () => number, level = 0.15): void {
  const i0 = Math.round(start * SAMPLE_RATE);
  let prev = 0;
  for (let i = 0; i < 0.06 * SAMPLE_RATE && i0 + i < out.length; i++) {
    const n = rnd();
    out[i0 + i] += level * (n - prev) * Math.exp((-i / SAMPLE_RATE) * 70); // differentiated noise ≈ highpassed
    prev = n;
  }
}

/** Crude room: a few feedback echoes, smearing the kick tails like a real club would. */
function addRoom(out: Float32Array): void {
  const taps = [
    [0.023, 0.35],
    [0.041, 0.25],
    [0.067, 0.18],
  ];
  for (let i = out.length - 1; i >= 0; i--) {
    for (const [delay, gain] of taps) {
      const j = i - Math.round(delay * SAMPLE_RATE);
      if (j >= 0) out[i] += out[j] * gain;
    }
  }
}
