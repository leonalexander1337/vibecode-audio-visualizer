import { mod } from '../util/math';
import type { HopFrame } from './dsp/BandSplitter';
import type { BeatTracker } from './dsp/BeatTracker';
import { DisplayBeat } from './dsp/DisplayBeat';
import type { KickEvent } from './dsp/KickDetector';
import type { Spectrum } from './Spectrum';

/** Everything the visuals need to know about the music, sampled once per rendered frame. */
export interface MusicFrame {
  /** Continuous beat counter. */
  beatTime: number;
  /** Phase within the current beat, 0..1. */
  beat: number;
  /** Position within the bar, 0..4. */
  barTime: number;
  bar: number;
  /** Kick pulse 0..1 — beat-predicted when locked, reactive otherwise. */
  kick: number;
  bass: number;
  mid: number;
  high: number;
  level: number;
  /** Drop envelope 0..1, decays over ~4 beats. */
  drop: number;
  bpm: number;
  locked: boolean;
  kicking: boolean;
  confidence: number;
  inputDb: number;
  clipping: boolean;
}

export class MusicAnalyzer {
  /** Seconds the visuals run ahead of the analysis, compensating mic + display latency. */
  latency = 0.04;
  onKick: ((kick: KickEvent) => void) | null = null;
  onDrop: (() => void) | null = null;

  private readonly display = new DisplayBeat();
  private kickEnv = 0;
  private kickStrength = 1;
  private dropEnv = 0;
  private inputDb = -120;
  private clipUntil = -Infinity;
  private lastHopTime = 0;

  constructor(
    readonly tracker: BeatTracker,
    private readonly spectrum: Spectrum,
  ) {
    tracker.onKick = (kick) => {
      this.kickEnv = Math.max(this.kickEnv, kick.strength);
      this.kickStrength += (kick.strength - this.kickStrength) * 0.3;
      this.onKick?.(kick);
    };
    tracker.onDrop = () => {
      this.dropEnv = 1;
      this.onDrop?.();
    };
  }

  pushHop(frame: HopFrame): void {
    this.tracker.pushHop(frame);
    const db = 10 * Math.log10(frame.full + 1e-12);
    this.inputDb = Math.max(db, this.inputDb - 0.3);
    if (frame.peak >= 0.99) this.clipUntil = frame.time + 1;
    this.lastHopTime = frame.time;
  }

  update(now: number, dt: number): MusicFrame {
    const clock = this.tracker.clock;
    const beatTime = this.display.update(clock.beatAt(now + this.latency), clock.bpm, dt);
    const beat = beatTime - Math.floor(beatTime);
    const secondsPerBeat = 60 / clock.bpm;

    this.kickEnv *= Math.exp(-dt / (secondsPerBeat * 0.22));
    this.dropEnv *= Math.exp(-dt / (secondsPerBeat * 4));
    this.spectrum.update(dt);

    const kicking = this.tracker.isKicking(now);
    const locked = clock.locked;
    // Locked: pulse exactly on the predicted beat (no detection lag). Otherwise: react to kicks.
    const kick = locked && kicking ? Math.exp(-beat * 5.5) * this.kickStrength : this.kickEnv;
    const relBeat = Math.floor(beatTime) - clock.barOffset;

    return {
      beatTime,
      beat,
      barTime: mod(relBeat, 4) + beat,
      bar: Math.floor(relBeat / 4),
      kick,
      bass: this.spectrum.bass,
      mid: this.spectrum.mid,
      high: this.spectrum.high,
      level: this.spectrum.level,
      drop: this.dropEnv,
      bpm: clock.bpm,
      locked,
      kicking,
      confidence: this.tracker.confidence,
      inputDb: this.inputDb,
      clipping: this.lastHopTime < this.clipUntil,
    };
  }
}
