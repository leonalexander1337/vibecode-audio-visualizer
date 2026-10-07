import { Biquad } from './Biquad';

/** Energy summary of one analysis hop. Band values are mean squares (linear power). */
export interface HopFrame {
  /** Audio-clock time (s) just after the last sample of this hop. */
  time: number;
  /** Kick band, < ~120 Hz. */
  low: number;
  /** Hi-hat band, > ~6 kHz. */
  high: number;
  /** Whole signal. */
  full: number;
  /** Largest absolute sample value in the hop (clip detection). */
  peak: number;
}

/** 512 samples ≈ 10.7 ms at 48 kHz — fine enough for kick timing, cheap enough to post every hop. */
export const HOP_SIZE = 512;

/**
 * Splits a mono signal into a kick band and a hi-hat band and emits per-hop energies.
 * Runs inside the AudioWorklet, so it must stay allocation-light and DOM-free.
 */
export class BandSplitter {
  // Two cascaded 2nd-order lowpasses = 24 dB/oct, keeps snares and vocals out of the kick band.
  private readonly low1: Biquad;
  private readonly low2: Biquad;
  private readonly high: Biquad;
  private lowSum = 0;
  private highSum = 0;
  private fullSum = 0;
  private peak = 0;
  private count = 0;

  constructor(
    private readonly sampleRate: number,
    private readonly hopSize = HOP_SIZE,
  ) {
    this.low1 = Biquad.lowpass(sampleRate, 120);
    this.low2 = Biquad.lowpass(sampleRate, 120);
    this.high = Biquad.highpass(sampleRate, 6000);
  }

  /** `startTime` is the audio-clock time of `samples[0]`. */
  process(samples: Float32Array, startTime: number, emit: (frame: HopFrame) => void): void {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const lo = this.low2.process(this.low1.process(x));
      const hi = this.high.process(x);
      this.lowSum += lo * lo;
      this.highSum += hi * hi;
      this.fullSum += x * x;
      const ax = Math.abs(x);
      if (ax > this.peak) this.peak = ax;

      if (++this.count === this.hopSize) {
        const n = this.hopSize;
        emit({
          time: startTime + (i + 1) / this.sampleRate,
          low: this.lowSum / n,
          high: this.highSum / n,
          full: this.fullSum / n,
          peak: this.peak,
        });
        this.lowSum = this.highSum = this.fullSum = this.peak = 0;
        this.count = 0;
      }
    }
  }
}
