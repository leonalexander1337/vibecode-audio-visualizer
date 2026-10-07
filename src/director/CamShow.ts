/** Camera is switched on this many beats before a planned cut-in (4 bars). */
const PREROLL_BEATS = 16;
/** Give up on a cut-in if the camera is still not ready this long after its planned start. */
const READY_TIMEOUT_BEATS = 32;
const MIN_SECONDS = 5;
const MAX_SECONDS = 10;

type Phase = 'idle' | 'arming' | 'in' | 'on' | 'out';

/**
 * Schedules the occasional webcam cut-in on the musical grid:
 * every 40–80 bars (first one after 24–48), lasting whole bars totalling 5–10 s.
 * The cut-in starts on a downbeat; the first and the last beat are glitch transitions.
 *
 * Pure logic — the App wires the callbacks to the real camera and the effects.
 */
export class CamShow {
  enabled = true;
  /** Switch the camera on (called ahead of time). */
  onArm: (() => void) | null = null;
  /** Switch the camera off. */
  onRelease: (() => void) | null = null;
  /** Start of a transition in or out — time for a glitch burst. */
  onTransition: (() => void) | null = null;

  private phase: Phase = 'idle';
  private nextStart: number | null = null;
  private start = 0;
  private end = 0;
  private lastBeat: number | null = null;
  private manual = false;
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

  /** Cut in now (at the next beat, as soon as the camera is ready) — or cut out if already showing. */
  toggleNow(beatTime: number): void {
    if (this.active) {
      if (this.phase !== 'out') this.end = Math.floor(beatTime) + 2;
      return;
    }
    this.manual = true;
    this.nextStart = Math.floor(beatTime) + 1;
    if (this.phase === 'idle') this.arm();
  }

  /**
   * Call every frame. `barBeat` is the beat index within the bar (0 = downbeat).
   * Returns how far the camera image is revealed, 0..1.
   */
  update(beatTime: number, barBeat: number, bpm: number, cameraReady: boolean): number {
    const beat = Math.floor(beatTime);
    const newBeat = this.lastBeat !== null && beat !== this.lastBeat;
    this.lastBeat = beat;

    if (!this.enabled) {
      if (this.phase !== 'idle') this.finish(beat, false);
      return 0;
    }
    this.nextStart ??= beat + this.bars(24, 48) * 4;

    switch (this.phase) {
      case 'idle':
        if (beatTime >= this.nextStart - PREROLL_BEATS) this.arm();
        break;
      case 'arming': {
        const onGrid = this.manual || barBeat === 0;
        if (newBeat && onGrid && beatTime >= this.nextStart && cameraReady) {
          this.start = beat;
          this.end = beat + this.durationBeats(bpm);
          this.phase = 'in';
          this.onTransition?.();
        } else if (beatTime > this.nextStart + READY_TIMEOUT_BEATS) {
          this.finish(beat, true);
        }
        break;
      }
      case 'in':
        if (beatTime >= this.start + 1) this.phase = 'on';
        break;
      case 'on':
        if (beatTime >= this.end - 1) {
          this.phase = 'out';
          this.onTransition?.();
        }
        break;
      case 'out':
        if (beatTime >= this.end) this.finish(beat, true);
        break;
    }
    return this.reveal(beatTime);
  }

  private reveal(beatTime: number): number {
    switch (this.phase) {
      case 'in':
        return clamp01(beatTime - this.start);
      case 'on':
        return 1;
      case 'out':
        return clamp01(this.end - beatTime);
      default:
        return 0;
    }
  }

  private arm(): void {
    this.phase = 'arming';
    this.onArm?.();
  }

  private finish(beat: number, scheduleNext: boolean): void {
    this.phase = 'idle';
    this.manual = false;
    this.onRelease?.();
    this.nextStart = scheduleNext ? beat + this.bars(40, 80) * 4 : null;
  }

  /** Whole bars, as close as possible to a random length of 5–10 s. */
  private durationBeats(bpm: number): number {
    const seconds = MIN_SECONDS + this.random() * (MAX_SECONDS - MIN_SECONDS);
    const barSeconds = (4 * 60) / bpm;
    const minBars = Math.ceil(MIN_SECONDS / barSeconds);
    const maxBars = Math.max(minBars, Math.floor(MAX_SECONDS / barSeconds));
    return Math.min(maxBars, Math.max(minBars, Math.round(seconds / barSeconds))) * 4;
  }

  private bars(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
