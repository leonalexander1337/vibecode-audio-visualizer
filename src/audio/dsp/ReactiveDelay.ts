/**
 * Short history of per-frame values so they can be read back with a delay.
 * Used when the sync offset pushes the picture *later* than the analysis — then the
 * reactive signals (levels, kick envelope) must be delayed too, not just the beat grid.
 */
export class ReactiveDelay<T> {
  private readonly entries: { time: number; value: T }[] = [];

  constructor(private readonly maxAge = 1) {}

  push(time: number, value: T): void {
    this.entries.push({ time, value });
    while (this.entries.length > 2 && this.entries[0].time < time - this.maxAge) this.entries.shift();
  }

  /** Latest value recorded at or before `time` (oldest one if `time` is further back). */
  at(time: number): T | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i].time <= time) return this.entries[i].value;
    }
    return this.entries[0]?.value;
  }
}
