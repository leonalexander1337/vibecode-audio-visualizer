import type { TempoEstimate } from './TempoEstimator';

/**
 * Smooths raw tempo estimates. Small deviations glide in, big jumps (another track,
 * half/double tempo confusion) must be confirmed by several consecutive estimates first.
 */
export class TempoFollower {
  bpm: number | null = null;
  private candidate: number | null = null;
  private candidateCount = 0;

  constructor(
    private readonly minConfidence = 0.05,
    private readonly confirmations = 4,
  ) {}

  reset(bpm: number): void {
    this.bpm = bpm;
    this.candidate = null;
    this.candidateCount = 0;
  }

  update(estimate: TempoEstimate): number | null {
    if (estimate.confidence < this.minConfidence) return this.bpm;
    if (this.bpm === null) {
      this.bpm = estimate.bpm;
      return this.bpm;
    }

    if (Math.abs(estimate.bpm - this.bpm) / this.bpm < 0.03) {
      this.bpm += (estimate.bpm - this.bpm) * 0.3;
      this.candidate = null;
      this.candidateCount = 0;
      return this.bpm;
    }

    if (this.candidate !== null && Math.abs(estimate.bpm - this.candidate) / this.candidate < 0.02) {
      this.candidateCount++;
      this.candidate = estimate.bpm;
    } else {
      this.candidate = estimate.bpm;
      this.candidateCount = 1;
    }
    if (this.candidateCount >= this.confirmations) this.reset(estimate.bpm);
    return this.bpm;
  }
}
