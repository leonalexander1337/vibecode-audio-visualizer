/** Direct-form-I biquad filter with RBJ Audio-EQ-Cookbook coefficients. */
export class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  private constructor(
    private readonly b0: number,
    private readonly b1: number,
    private readonly b2: number,
    private readonly a1: number,
    private readonly a2: number,
  ) {}

  static lowpass(sampleRate: number, cutoff: number, q = Math.SQRT1_2): Biquad {
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return new Biquad((1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0, (-2 * cos) / a0, (1 - alpha) / a0);
  }

  static highpass(sampleRate: number, cutoff: number, q = Math.SQRT1_2): Biquad {
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return new Biquad((1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0, (-2 * cos) / a0, (1 - alpha) / a0);
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}
