/** Classic tap tempo: average interval of the last taps; a pause > 2 s starts over. */
export class TapTempo {
  private taps: number[] = [];

  /** Returns the tapped BPM once at least three taps are in. */
  tap(time: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && time - last > 2) this.taps = [];
    this.taps.push(time);
    if (this.taps.length > 8) this.taps.shift();
    if (this.taps.length < 3) return null;
    const span = this.taps[this.taps.length - 1] - this.taps[0];
    return (60 * (this.taps.length - 1)) / span;
  }
}
