import { clamp, smoothing } from '../util/math';

/** Dynamic range (dB) below the running peak that maps to 0..1. */
const RANGE_DB = 30;
/** How fast the running peak falls (dB/s) — slow, so breakdowns look quieter than drops. */
const PEAK_FALL_DB = 1.5;
const SILENCE_DB = -95;

class Band {
  value = 0;
  private peakDb = -120;
  private readonly from: number;
  private readonly to: number;

  constructor(lowHz: number, highHz: number, binHz: number, bins: number) {
    this.from = Math.max(1, Math.floor(lowHz / binHz));
    this.to = Math.min(bins - 1, Math.ceil(highHz / binHz));
  }

  update(spectrumDb: Float32Array, dt: number): void {
    let power = 0;
    for (let i = this.from; i <= this.to; i++) power += Math.pow(10, spectrumDb[i] / 10);
    const db = 10 * Math.log10(power + 1e-12);
    this.peakDb = Math.max(db, this.peakDb - PEAK_FALL_DB * dt);
    const target = this.peakDb < SILENCE_DB ? 0 : clamp((db - (this.peakDb - RANGE_DB)) / RANGE_DB, 0, 1);
    // Fast attack, slower release.
    this.value += (target - this.value) * smoothing(dt, target > this.value ? 0.03 : 0.18);
  }
}

/** Self-normalising band levels (0..1) for the visuals. */
export class Spectrum {
  private readonly data: Float32Array<ArrayBuffer>;
  private readonly bassBand: Band;
  private readonly midBand: Band;
  private readonly highBand: Band;
  private readonly allBand: Band;

  constructor(private readonly analyser: AnalyserNode) {
    this.data = new Float32Array(analyser.frequencyBinCount);
    const binHz = analyser.context.sampleRate / analyser.fftSize;
    const bins = analyser.frequencyBinCount;
    this.bassBand = new Band(30, 150, binHz, bins);
    this.midBand = new Band(150, 2000, binHz, bins);
    this.highBand = new Band(2000, 14000, binHz, bins);
    this.allBand = new Band(30, 14000, binHz, bins);
  }

  get bass(): number {
    return this.bassBand.value;
  }
  get mid(): number {
    return this.midBand.value;
  }
  get high(): number {
    return this.highBand.value;
  }
  get level(): number {
    return this.allBand.value;
  }

  update(dt: number): void {
    this.analyser.getFloatFrequencyData(this.data);
    this.bassBand.update(this.data, dt);
    this.midBand.update(this.data, dt);
    this.highBand.update(this.data, dt);
    this.allBand.update(this.data, dt);
  }
}
