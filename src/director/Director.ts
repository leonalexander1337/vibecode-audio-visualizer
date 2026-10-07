import type { MusicFrame } from '../audio/MusicAnalyzer';
import { mod } from '../util/math';
import { CamShow } from './CamShow';

export interface FxFrame {
  glitch: number;
  mosh: number;
  moshSeed: number;
  strobe: number;
  invert: number;
  blackout: number;
  /** Re-rolled every 8 bars; scenes derive their variation from it. */
  seed: number;
  variant: number;
  /** How much the webcam owns the picture, 0..1. */
  camera: number;
  /** Datamosh transition towards the webcam (`in`) or back to the visuals (`out`). */
  camTransition: 'in' | 'out' | null;
  /** 0..1 within that transition. */
  camProgress: number;
}

export type GlitchLevel = 0 | 1 | 2;
const GLITCH_GAIN: Record<GlitchLevel, number> = { 0: 0, 1: 1, 2: 1.8 };

/**
 * Decides *when* effects happen, aligned to the musical grid. Deliberately sparse ("dosiert"):
 * - every 8 bars: new seed/variant for the scenes (optionally next scene every 32 bars)
 * - end of every 4th bar: glitch fill (60 %)
 * - every 16 bars: 2-beat datamosh (50 %)
 * - drop / Space: strobe on the next 4 beats + glitch burst + datamosh
 * - every 8 bars: a half-beat inversion (35 %)
 * - webcam cut-ins (see CamShow): one-bar datamosh transitions in and out, with a short glitch kick
 * Strobe flashes are beat-synced, so never more than ~3 per second.
 */
export class Director {
  strobeEnabled = true;
  glitchLevel: GlitchLevel = 1;
  autoScene = false;
  blackout = false;
  onAutoAdvance: (() => void) | null = null;
  readonly cam = new CamShow();

  private lastBeat: number | null = null;
  private beatTime = 0;
  private burst = 0;
  private camBurst = 0;
  private glitchUntil = -1;
  private glitchAmount = 0;
  private moshUntil = -1;
  private moshSeed = Math.random();
  private strobeUntil = -1;
  private invertUntil = -1;
  private blackoutLevel = 0;
  private seed = Math.random();
  private variant = 0;

  constructor() {
    // The datamosh itself is the transition; a short glitch just marks its start.
    this.cam.onTransition = () => {
      this.camBurst = 0.4;
    };
  }

  update(m: MusicFrame, dt: number, cameraReady: boolean): FxFrame {
    this.beatTime = m.beatTime;
    const beat = Math.floor(m.beatTime);
    if (this.lastBeat !== null && beat > this.lastBeat) this.onBeat(beat, m);
    this.lastBeat = beat;
    const cam = this.cam.update(m.beatTime, Math.floor(m.barTime), m.bpm, cameraReady);

    this.burst = Math.max(0, this.burst - dt * 2.5);
    this.camBurst = Math.max(0, this.camBurst - dt * 2);
    const scheduled = m.beatTime < this.glitchUntil ? this.glitchAmount : 0;
    // Regular glitches would tear up the datamosh transition — keep them out of it.
    const regular = cam.transition ? 0 : (this.burst + scheduled) * GLITCH_GAIN[this.glitchLevel];
    const glitch = Math.min(1, regular + this.camBurst);
    const moshing = this.glitchLevel > 0 && m.beatTime < this.moshUntil;
    const mosh = moshing ? (this.glitchLevel === 2 ? 0.75 : 0.45) : 0;
    // Faster than 180 BPM only every other beat flashes (photosensitivity: stay ≤ 3 Hz).
    const flashBeat = m.bpm <= 180 || beat % 2 === 0;
    const strobe = this.strobeEnabled && flashBeat && m.beatTime < this.strobeUntil ? Math.exp(-m.beat * 14) * 0.9 : 0;
    const invert = this.strobeEnabled && m.beatTime < this.invertUntil ? 1 : 0;
    this.blackoutLevel += ((this.blackout ? 1 : 0) - this.blackoutLevel) * Math.min(1, dt * 6);

    return {
      glitch,
      mosh,
      moshSeed: this.moshSeed,
      strobe,
      invert,
      blackout: this.blackoutLevel,
      seed: this.seed,
      variant: this.variant,
      camera: cam.weight,
      camTransition: cam.transition,
      camProgress: cam.progress,
    };
  }

  /** Drop detected (or Space pressed): the big moment. */
  triggerDrop(): void {
    const beat = Math.floor(this.beatTime);
    this.strobeUntil = beat + 4;
    this.burst = 0.9;
    this.moshUntil = beat + 1;
    this.moshSeed = Math.random();
    this.seed = Math.random();
    this.variant++;
  }

  sceneChanged(): void {
    this.burst = 1;
  }

  onKick(strength: number): void {
    if (strength > 0.85 && Math.random() < 0.06) this.burst = Math.max(this.burst, 0.35);
  }

  private onBeat(beat: number, m: MusicFrame): void {
    const barBeat = Math.floor(m.barTime);
    const every = (n: number) => mod(m.bar, n);

    if (barBeat === 0 && every(8) === 0) {
      this.seed = Math.random();
      this.variant++;
      if (this.autoScene && every(32) === 0) this.onAutoAdvance?.();
    }
    if (barBeat === 3 && every(4) === 3 && Math.random() < 0.6) {
      this.glitchUntil = beat + 1;
      this.glitchAmount = 0.45;
    }
    if (barBeat === 0 && every(16) === 0 && Math.random() < 0.5) {
      this.moshUntil = beat + 2;
      this.moshSeed = Math.random();
    }
    if (barBeat === 2 && every(8) === 7 && Math.random() < 0.35) {
      this.invertUntil = beat + 0.5;
    }
  }
}
