/**
 * A tiny synthesized techno loop (kick, off-beat bass, hats) for testing without a mic.
 * Every 32 bars there is an 8-bar breakdown without kick, so drops can be tested too.
 */
export class DemoBeat {
  private readonly out: GainNode;
  private readonly noise: AudioBuffer;
  private timer = 0;
  private nextTime = 0;
  private index = 0;

  constructor(
    private readonly ctx: AudioContext,
    readonly bpm = 128,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.7;
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  connect(...destinations: AudioNode[]): void {
    for (const d of destinations) this.out.connect(d);
  }

  start(): void {
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.out.disconnect();
  }

  private schedule(): void {
    const spb = 60 / this.bpm;
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const bar = Math.floor(this.index / 4) % 32;
      const breakdown = bar >= 24;
      if (!breakdown) {
        this.kick(this.nextTime);
        this.bass(this.nextTime + spb / 2, spb * 0.4);
      }
      this.hat(this.nextTime + spb / 2, 0.22);
      this.hat(this.nextTime + spb / 4, 0.07);
      this.hat(this.nextTime + (3 * spb) / 4, 0.07);
      this.nextTime += spb;
      this.index++;
    }
  }

  private kick(t: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  private bass(t: number, duration: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(filter).connect(gain).connect(this.out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private hat(t: number, level: number): void {
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(filter).connect(gain).connect(this.out);
    src.start(t, Math.random() * 0.9);
    src.stop(t + 0.06);
  }
}
