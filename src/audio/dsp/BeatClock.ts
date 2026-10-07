import { mod } from '../../util/math';

/** Kicks within ±0.15 beat of the grid count as on-beat. */
const HIT_WINDOW = 0.15;
/** Fraction of the phase error corrected per on-beat kick. */
const PULL = 0.3;
const HISTORY = 8;
const PHASE_BINS = 20;
/** Per-kick decay of the phase histogram (≈ last 8–10 kicks matter). */
const BIN_DECAY = 0.85;

interface KickRecord {
  error: number;
  weight: number;
}

/**
 * A phase-locked beat grid in audio-clock time.
 *
 * Tempo comes from the TempoEstimator, phase from the kicks: every on-beat kick pulls the
 * grid a bit towards itself. All kicks also vote, weighted by salience², into a histogram
 * of where they fall relative to the grid. When another phase clearly collects more kick
 * energy than the current one (we started on a ghost peak, DJ transition), the grid jumps there.
 */
export class BeatClock {
  bpm = 128;
  /** Beat index (mod 4) that counts as the first beat of a bar. */
  barOffset = 0;

  private anchorTime = 0;
  private anchorBeat = 0;
  private readonly history: KickRecord[] = [];
  private readonly bins = new Float32Array(PHASE_BINS);

  beatAt(time: number): number {
    return this.anchorBeat + ((time - this.anchorTime) * this.bpm) / 60;
  }

  setBpm(bpm: number, time: number): void {
    this.anchorBeat = this.beatAt(time);
    this.anchorTime = time;
    this.bpm = bpm;
  }

  /** Puts the nearest whole beat exactly at `time`. */
  alignBeat(time: number): void {
    this.anchorBeat = Math.round(this.beatAt(time));
    this.anchorTime = time;
    this.resetPhaseHistory();
  }

  /** Makes the beat at `time` the first beat of a bar. */
  setDownbeat(time: number): void {
    this.barOffset = mod(Math.round(this.beatAt(time)), 4);
  }

  /** Most of the recent kick energy sits on the grid. */
  get locked(): boolean {
    if (this.history.length < 4) return false;
    let total = 0;
    let onGrid = 0;
    for (const k of this.history) {
      total += k.weight;
      if (Math.abs(k.error) < HIT_WINDOW) onGrid += k.weight;
    }
    return onGrid / total > 0.6;
  }

  onKick(time: number, salience = 1): void {
    const beat = this.beatAt(time);
    const error = beat - Math.round(beat);
    const weight = salience * salience;

    this.history.push({ error, weight });
    if (this.history.length > HISTORY) this.history.shift();
    for (let i = 0; i < PHASE_BINS; i++) this.bins[i] *= BIN_DECAY;
    this.bins[binOf(error)] += weight;

    if (Math.abs(error) < HIT_WINDOW) {
      this.anchorTime = time;
      this.anchorBeat = beat - error * PULL;
    }

    const best = this.strongestPhase();
    if (best !== null && Math.abs(best.phase) >= HIT_WINDOW && best.score > 1.5 * this.scoreAt(0) && this.history.length >= 4) {
      // Shift the grid so the winning phase becomes zero — exactly onto this kick if it belongs to it.
      const shift = Math.abs(error - best.phase) < 1.5 / PHASE_BINS ? error : best.phase;
      this.anchorTime = time;
      this.anchorBeat = beat - shift;
      this.resetPhaseHistory();
    }
  }

  private resetPhaseHistory(): void {
    this.history.length = 0;
    this.bins.fill(0);
  }

  /** Bin score including both neighbours, so a peak straddling two bins still counts fully. */
  private scoreAt(bin: number): number {
    return this.bins[mod(bin - 1, PHASE_BINS)] + this.bins[bin] + this.bins[mod(bin + 1, PHASE_BINS)];
  }

  private strongestPhase(): { phase: number; score: number } | null {
    // Rank by neighbourhood score, break ties by the bin itself (a lone peak scores the same from all three bins).
    let bestBin = -1;
    let bestRank = 0;
    for (let i = 0; i < PHASE_BINS; i++) {
      const rank = this.scoreAt(i) + 0.5 * this.bins[i];
      if (rank > bestRank) {
        bestRank = rank;
        bestBin = i;
      }
    }
    if (bestBin < 0) return null;
    const center = (bestBin + 0.5) / PHASE_BINS;
    return { phase: center >= 0.5 ? center - 1 : center, score: this.scoreAt(bestBin) };
  }
}

/** Phase error in [-0.5, 0.5) → histogram bin. */
function binOf(error: number): number {
  return Math.min(PHASE_BINS - 1, Math.floor(mod(error, 1) * PHASE_BINS));
}
