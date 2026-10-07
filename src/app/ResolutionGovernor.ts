const STEPS = [1, 0.85, 0.7, 0.55, 0.42, 0.33];
/** Starting budget: ~1080p worth of pixels. Raymarching a 4K frame on an iGPU can take long enough to trigger a GPU reset. */
const START_PIXELS = 1920 * 1080 * 1.05;

/**
 * "Auto" render scale: starts at native resolution or ~1080p (whichever is smaller), steps down
 * when frames take too long, cautiously steps up after a stretch of smooth frames. Each failed
 * step-up doubles the wait before the next attempt, so it settles instead of stuttering periodically.
 */
export class ResolutionGovernor {
  private step = -1;
  private avg = 1 / 60;
  private slow = 0;
  private fast = 0;
  private time = 0;
  private holdUntil = 0;
  private hold = 15;
  private lastStepUp = -Infinity;

  get scale(): number {
    return STEPS[Math.max(0, this.step)];
  }

  /** `viewportPixels`: size of the native 16:9 viewport, to pick the starting step. */
  update(dt: number, viewportPixels: number): number {
    if (this.step < 0) {
      this.step = STEPS.findIndex((s) => viewportPixels * s * s <= START_PIXELS);
      if (this.step < 0) this.step = STEPS.length - 1;
    }
    this.time += dt;
    if (dt > 0.25) return this.scale; // tab was hidden, shader compile, …

    this.avg += (dt - this.avg) * 0.1;
    if (this.avg > 1 / 48) {
      this.slow += dt;
      this.fast = 0;
    } else if (this.avg < 1 / 57) {
      this.fast += dt;
      this.slow = 0;
    } else {
      this.slow = this.fast = 0;
    }

    if (this.slow > 0.75 && this.step < STEPS.length - 1) {
      this.step++;
      this.slow = 0;
      this.avg = 1 / 60;
      if (this.time - this.lastStepUp < 5) this.hold = Math.min(this.hold * 2, 300);
      this.holdUntil = this.time + this.hold;
    } else if (this.fast > 6 && this.step > 0 && this.time > this.holdUntil) {
      this.step--;
      this.fast = 0;
      this.lastStepUp = this.time;
    }
    return this.scale;
  }
}
