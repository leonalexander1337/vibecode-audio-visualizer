import { clamp } from '../../util/math';

export interface KickEvent {
  /** Audio-clock time (s). */
  time: number;
  /** 0.4..1, how far the onset cleared the threshold. */
  strength: number;
  /** Raw onset peak value; used to weigh kicks against each other. */
  salience: number;
}

/**
 * Adaptive-threshold peak picker on the kick-band onset signal.
 * A kick is reported one hop late, because a peak is only known once the next value falls.
 *
 * Two thresholds must be cleared:
 * - statistical: mean + sensitivity · std of the last 1.5 s,
 * - relative: a fraction of the typical kick peak. Bass notes beating against the kick tail
 *   produce smaller onsets that would otherwise pass and then lock out the real kick.
 */
export class KickDetector {
  /** Lower = more kicks. Scales both thresholds. */
  sensitivity = 1.6;

  private readonly window: Float32Array;
  private readonly levelDecay: number;
  private index = 0;
  private filled = 0;
  private prevValue = 0;
  private prevPrevValue = 0;
  private prevTime = 0;
  private lastKick = -Infinity;
  private lastKickValue = 0;
  /** Running estimate of a typical kick onset peak. */
  private level = 0;

  constructor(
    hopRate: number,
    /** Shortest allowed gap between kicks (s) — 0.28 s ≈ 214 BPM. */
    private readonly minInterval = 0.28,
    /** Absolute minimum onset so room noise never triggers. */
    private readonly floor = 0.3,
  ) {
    this.window = new Float32Array(Math.round(hopRate * 1.5));
    this.levelDecay = Math.pow(0.5, 1 / (4 * hopRate));
  }

  push(time: number, onset: number): KickEvent | null {
    let event: KickEvent | null = null;
    const candidate = this.prevValue;
    this.level *= this.levelDecay;

    if (candidate > this.prevPrevValue && candidate >= onset && this.filled >= this.window.length / 2) {
      const { mean, std } = this.stats();
      const threshold = Math.max(this.floor, mean + this.sensitivity * std, 0.35 * this.sensitivity * this.level);
      const free = this.prevTime - this.lastKick >= this.minInterval;
      // A much stronger peak right after a weak "kick" means the earlier one was wrong.
      const overrides = candidate > 1.5 * this.lastKickValue;
      if (candidate > threshold && (free || overrides)) {
        this.lastKick = this.prevTime;
        this.lastKickValue = candidate;
        this.level = this.level === 0 ? candidate : Math.max(this.level, 0.7 * this.level + 0.3 * candidate);
        event = {
          time: this.prevTime,
          strength: clamp(0.4 + (0.6 * (candidate - threshold)) / threshold, 0.4, 1),
          salience: candidate,
        };
      }
    }

    this.window[this.index] = onset;
    this.index = (this.index + 1) % this.window.length;
    this.filled = Math.min(this.filled + 1, this.window.length);
    this.prevPrevValue = this.prevValue;
    this.prevValue = onset;
    this.prevTime = time;
    return event;
  }

  private stats(): { mean: number; std: number } {
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < this.filled; i++) {
      const v = this.window[i];
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / this.filled;
    return { mean, std: Math.sqrt(Math.max(0, sumSq / this.filled - mean * mean)) };
  }
}
