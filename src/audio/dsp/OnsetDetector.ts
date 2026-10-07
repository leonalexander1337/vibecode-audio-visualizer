/**
 * Turns per-hop band energy into an onset-strength value (≥ 0).
 *
 * Energy is normalised by a slowly decaying peak follower and log-compressed, so the
 * output barely depends on input gain — the mic can sit 2 m or 20 m from the speakers.
 */
export class OnsetDetector {
  private peak: number;
  private prev = 0;
  private readonly peakDecay: number;

  constructor(
    hopRate: number,
    /** Energies below this are treated as silence (mean square, ≈ -60 dBFS). */
    private readonly floor = 1e-6,
    peakHalfLife = 8,
  ) {
    this.peak = floor;
    this.peakDecay = Math.pow(0.5, 1 / (peakHalfLife * hopRate));
  }

  push(energy: number): number {
    this.peak = Math.max(energy, this.peak * this.peakDecay, this.floor);
    const compressed = Math.log1p((1000 * energy) / this.peak);
    const onset = Math.max(0, compressed - this.prev);
    this.prev = compressed;
    return onset;
  }
}
