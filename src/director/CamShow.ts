/** Camera is switched on this many beats before a planned cut-in (4 bars). */
const PREROLL_BEATS = 16;
/** Give up on a cut-in if the camera is still not ready this long after its planned start. */
const READY_TIMEOUT_BEATS = 32;
/** Each datamosh transition (in and out) lasts one bar. */
export const TRANSITION_BEATS = 4;
/** Shortest cut-in: transition in, one bar of camera, transition out. */
const MIN_BARS = 3;
const MIN_SECONDS = 5;
const MAX_SECONDS = 10;

type Phase = 'idle' | 'arming' | 'in' | 'on' | 'out';
/** Manual cut-in: stay until toggled off, or a regular 5–10 s one. */
export type CutMode = 'hold' | 'short';

export interface CamFrame {
  /** How much the webcam owns the picture, 0..1 (rises during the transition in, falls during the one out). */
  weight: number;
  /** Datamosh transition in progress: towards the webcam (`in`) or back to the visuals (`out`). */
  transition: 'in' | 'out' | null;
  /** 0..1 within the transition. */
  progress: number;
}

const IDLE: CamFrame = { weight: 0, transition: null, progress: 0 };

/**
 * Schedules the occasional webcam cut-in on the musical grid:
 * every 40–80 bars (first one after 24–48), lasting whole bars totalling 5–10 s.
 * The cut-in starts on a downbeat; its first and last bar are datamosh transitions.
 *
 * Pure logic — the App wires the callbacks to the real camera and the effects.
 */
export class CamShow {
  enabled = true;
  /** Switch the camera on (called ahead of time). */
  onArm: (() => void) | null = null;
  /** Switch the camera off. */
  onRelease: (() => void) | null = null;
  /** Start of a transition in or out. */
  onTransition: (() => void) | null = null;

  private phase: Phase = 'idle';
  private nextStart: number | null = null;
  private start = 0;
  private end = 0;
  private lastBeat: number | null = null;
  /** Set when the cut-in was requested by hand. */
  private manual: CutMode | null = null;
  private holding = false;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  get active(): boolean {
    return this.phase === 'in' || this.phase === 'on' || this.phase === 'out';
  }

  get arming(): boolean {
    return this.phase === 'arming';
  }

  /** Beat at which the next cut-in is planned (null until scheduled). */
  get nextStartBeat(): number | null {
    return this.nextStart;
  }

  /** Showing a cut-in that stays until it is toggled off. */
  get held(): boolean {
    return this.active && this.holding;
  }

  /**
   * Cut in now (at the next beat, as soon as the camera is ready) — or cut out if already showing.
   * `hold`: stay until toggled again; `short`: a regular 5–10 s cut-in.
   */
  toggleNow(beatTime: number, mode: CutMode): void {
    if (this.active) {
      // Start the transition out on the next beat (or right after the transition in).
      if (this.phase !== 'out') this.end = Math.max(Math.floor(beatTime) + 1, this.start + TRANSITION_BEATS) + TRANSITION_BEATS;
      return;
    }
    this.manual = mode;
    this.nextStart = Math.floor(beatTime) + 1;
    if (this.phase === 'idle') this.arm();
  }

  /** Call every frame. `barBeat` is the beat index within the bar (0 = downbeat). */
  update(beatTime: number, barBeat: number, bpm: number, cameraReady: boolean): CamFrame {
    const beat = Math.floor(beatTime);
    const newBeat = this.lastBeat !== null && beat !== this.lastBeat;
    this.lastBeat = beat;

    if (!this.enabled) {
      if (this.phase !== 'idle') this.finish(beat, false);
      return IDLE;
    }
    this.nextStart ??= beat + this.bars(24, 48) * 4;

    switch (this.phase) {
      case 'idle':
        if (beatTime >= this.nextStart - PREROLL_BEATS) this.arm();
        break;
      case 'arming': {
        const onGrid = this.manual !== null || barBeat === 0;
        if (newBeat && onGrid && beatTime >= this.nextStart && cameraReady) {
          this.holding = this.manual === 'hold';
          this.start = beat;
          this.end = this.holding ? Infinity : beat + this.durationBeats(bpm);
          this.phase = 'in';
          this.onTransition?.();
        } else if (beatTime > this.nextStart + READY_TIMEOUT_BEATS) {
          this.finish(beat, true);
        }
        break;
      }
      case 'in':
        if (beatTime >= this.start + TRANSITION_BEATS) this.phase = 'on';
        break;
      case 'on':
        if (beatTime >= this.end - TRANSITION_BEATS) {
          this.phase = 'out';
          this.onTransition?.();
        }
        break;
      case 'out':
        if (beatTime >= this.end) this.finish(beat, true);
        break;
    }
    return this.frame(beatTime);
  }

  private frame(beatTime: number): CamFrame {
    switch (this.phase) {
      case 'in': {
        const progress = clamp01((beatTime - this.start) / TRANSITION_BEATS);
        return { weight: progress, transition: 'in', progress };
      }
      case 'on':
        return { weight: 1, transition: null, progress: 0 };
      case 'out': {
        const progress = clamp01(1 - (this.end - beatTime) / TRANSITION_BEATS);
        return { weight: 1 - progress, transition: 'out', progress };
      }
      default:
        return IDLE;
    }
  }

  private arm(): void {
    this.phase = 'arming';
    this.onArm?.();
  }

  private finish(beat: number, scheduleNext: boolean): void {
    this.phase = 'idle';
    this.manual = null;
    this.holding = false;
    this.onRelease?.();
    this.nextStart = scheduleNext ? beat + this.bars(40, 80) * 4 : null;
  }

  /** Whole bars, as close as possible to a random length of 5–10 s (at least 3 bars). */
  private durationBeats(bpm: number): number {
    const seconds = MIN_SECONDS + this.random() * (MAX_SECONDS - MIN_SECONDS);
    const barSeconds = (4 * 60) / bpm;
    const minBars = Math.max(MIN_BARS, Math.ceil(MIN_SECONDS / barSeconds));
    const maxBars = Math.max(minBars, Math.floor(MAX_SECONDS / barSeconds));
    return Math.min(maxBars, Math.max(minBars, Math.round(seconds / barSeconds))) * 4;
  }

  private bars(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
