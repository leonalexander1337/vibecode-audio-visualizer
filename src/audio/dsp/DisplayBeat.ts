/**
 * The beat position the visuals see. Follows the BeatClock but never jumps or runs backwards:
 * phase corrections are absorbed by briefly running faster/slower.
 */
export class DisplayBeat {
  private value: number | null = null;

  update(target: number, bpm: number, dt: number): number {
    if (this.value === null || Math.abs(target - this.value) > 4) {
      this.value = target;
      return target;
    }
    const nominal = (dt * bpm) / 60;
    const diff = target - (this.value + nominal);
    const step = nominal + diff * Math.min(1, dt * 6);
    this.value += Math.max(step, nominal * 0.25);
    return this.value;
  }
}
