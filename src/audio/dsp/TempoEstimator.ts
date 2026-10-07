import { clamp } from '../../util/math';

export interface TempoEstimate {
  bpm: number;
  /** Normalised autocorrelation at the beat period, 0..1. */
  confidence: number;
}

const BEAT_WEIGHTS = [1, 0.7, 0.5, 0.5];
const REFINE_MULTIPLES = 8;

/**
 * Estimates tempo from the onset signal by autocorrelation.
 *
 * 1. Coarse scan over BPM candidates, scoring each by the autocorrelation at 1–4 beat lags
 *    (harmonic sum, which suppresses half/double tempo errors) and a mild prior around `preferredBpm`.
 * 2. Refinement: locate the autocorrelation peaks at up to 8 beat multiples with parabolic
 *    interpolation and fit the period through all of them. A peak 8 beats away pins the
 *    period down 8× more precisely than the first one alone (±0.05 BPM instead of ±1.5).
 */
export class TempoEstimator {
  preferredBpm = 130;
  /** Techno range. Below 90, half-tempo readings of fast tracks start to win. */
  readonly minBpm = 90;
  readonly maxBpm = 185;

  private readonly buffer: Float32Array;
  private readonly linear: Float32Array;
  private readonly ac: Float32Array;
  private write = 0;
  private filled = 0;

  constructor(
    private readonly hopRate: number,
    seconds = 10,
  ) {
    const n = Math.round(hopRate * seconds);
    this.buffer = new Float32Array(n);
    this.linear = new Float32Array(n);
    this.ac = new Float32Array(n);
  }

  push(onset: number): void {
    this.buffer[this.write] = onset;
    this.write = (this.write + 1) % this.buffer.length;
    this.filled = Math.min(this.filled + 1, this.buffer.length);
  }

  estimate(): TempoEstimate | null {
    const n = this.filled;
    if (n < this.hopRate * 5) return null;

    // Chronological copy with the mean removed.
    const x = this.linear;
    const start = (this.write - n + this.buffer.length) % this.buffer.length;
    let mean = 0;
    for (let i = 0; i < n; i++) {
      x[i] = this.buffer[(start + i) % this.buffer.length];
      mean += x[i];
    }
    mean /= n;
    for (let i = 0; i < n; i++) x[i] -= mean;

    // Unbiased autocorrelation up to 2/3 of the window.
    const maxLag = Math.floor(n * 0.66);
    const ac = this.ac;
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = lag; i < n; i++) sum += x[i] * x[i - lag];
      ac[lag] = sum / (n - lag);
    }
    if (ac[0] <= 1e-9) return null;

    // 1. Coarse scan.
    let bestScore = -Infinity;
    let bestBpm = 0;
    for (let bpm = this.minBpm; bpm <= this.maxBpm; bpm += 0.25) {
      const lag = (60 * this.hopRate) / bpm;
      let score = 0;
      for (let k = 0; k < BEAT_WEIGHTS.length; k++) {
        const l = lag * (k + 1);
        if (l < maxLag) score += BEAT_WEIGHTS[k] * interpolate(ac, l);
      }
      score *= this.prior(bpm);
      if (score > bestScore) {
        bestScore = score;
        bestBpm = bpm;
      }
    }
    if (bestScore <= 0) return null;

    // 2. Refine with peaks at beat multiples.
    let lag = (60 * this.hopRate) / bestBpm;
    let num = 0;
    let den = 0;
    for (let k = 1; k <= REFINE_MULTIPLES && k * lag + 2 < maxLag; k++) {
      const peak = refinePeak(ac, k * lag, maxLag);
      if (peak === null) continue;
      num += k * peak;
      den += k * k;
      lag = num / den;
    }

    return {
      bpm: (60 * this.hopRate) / lag,
      confidence: clamp(interpolate(ac, lag) / ac[0], 0, 1),
    };
  }

  private prior(bpm: number): number {
    const octaves = Math.log2(bpm / this.preferredBpm);
    return Math.exp(-0.5 * (octaves / 0.8) ** 2);
  }
}

function interpolate(data: Float32Array, pos: number): number {
  const i = Math.floor(pos);
  const f = pos - i;
  return data[i] * (1 - f) + data[i + 1] * f;
}

/** Local maximum near `center`, refined to sub-sample precision with a parabola fit. */
function refinePeak(ac: Float32Array, center: number, maxLag: number): number | null {
  const radius = Math.max(2, Math.round(center * 0.04));
  const c = Math.round(center);
  let best = -1;
  let bestValue = -Infinity;
  for (let i = Math.max(1, c - radius); i <= Math.min(maxLag - 1, c + radius); i++) {
    if (ac[i] > bestValue) {
      bestValue = ac[i];
      best = i;
    }
  }
  if (best <= 0 || bestValue <= 0) return null;
  const a = ac[best - 1];
  const b = ac[best];
  const d = ac[best + 1];
  const denom = a - 2 * b + d;
  const offset = denom < 0 ? (0.5 * (a - d)) / denom : 0;
  return best + clamp(offset, -0.5, 0.5);
}
