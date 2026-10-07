import type { HopFrame } from './BandSplitter';
import { BeatClock } from './BeatClock';
import { KickDetector, type KickEvent } from './KickDetector';
import { OnsetDetector } from './OnsetDetector';
import { TapTempo } from './TapTempo';
import { TempoEstimator } from './TempoEstimator';
import { TempoFollower } from './TempoFollower';

/**
 * The detected onset peak trails the real kick start by filter group delay and attack time.
 * Measured with the synthetic kicks in the tests; subtracting it keeps the grid on the transient.
 */
const DETECTION_DELAY = 0.012;

/**
 * Pure (DOM-free) beat tracking pipeline:
 * hop energies → onset strength → kicks + tempo → phase-locked beat clock, plus drop detection.
 */
export class BeatTracker {
  readonly clock = new BeatClock();
  readonly kicks: KickDetector;
  bpmLocked = false;
  confidence = 0;
  onKick: ((kick: KickEvent) => void) | null = null;
  onDrop: ((time: number) => void) | null = null;

  private readonly onset: OnsetDetector;
  private readonly tempo: TempoEstimator;
  private readonly follower = new TempoFollower();
  private readonly tapper = new TapTempo();
  private readonly estimateEvery: number;
  private hopCounter = 0;
  private lastKickTime = -Infinity;
  private started = false;
  private breakdown = false;

  constructor(hopRate: number) {
    this.onset = new OnsetDetector(hopRate);
    this.kicks = new KickDetector(hopRate);
    this.tempo = new TempoEstimator(hopRate);
    this.estimateEvery = Math.round(hopRate / 2);
  }

  pushHop(frame: HopFrame): void {
    const onset = this.onset.push(frame.low);
    this.tempo.push(onset);

    const kick = this.kicks.push(frame.time, onset);
    if (kick) this.handleKick({ ...kick, time: kick.time - DETECTION_DELAY });

    if (++this.hopCounter >= this.estimateEvery) {
      this.hopCounter = 0;
      this.updateTempo(frame.time);
    }

    // A breakdown = no kick for 8 beats (at least 4 s). The next kick is the drop.
    const silence = frame.time - this.lastKickTime;
    if (this.started && silence > Math.max(4, (8 * 60) / this.clock.bpm)) this.breakdown = true;
  }

  /** Tap tempo. Every tap also puts a beat at the tap time. */
  tap(time: number): number | null {
    const bpm = this.tapper.tap(time);
    if (bpm !== null && bpm >= 60 && bpm <= 200) {
      this.clock.setBpm(bpm, time);
      this.follower.reset(bpm);
      this.tempo.preferredBpm = bpm;
    }
    this.clock.alignBeat(time);
    return bpm;
  }

  /** True while kicks are coming in (none missing for 2.5 beats). */
  isKicking(time: number): boolean {
    return time - this.lastKickTime < (2.5 * 60) / this.clock.bpm;
  }

  private handleKick(kick: KickEvent): void {
    if (!this.started) {
      this.started = true;
      this.clock.alignBeat(kick.time);
    } else {
      this.clock.onKick(kick.time, kick.salience);
    }
    if (this.breakdown) {
      this.breakdown = false;
      this.clock.setDownbeat(kick.time);
      this.onDrop?.(kick.time);
    }
    this.lastKickTime = kick.time;
    this.onKick?.(kick);
  }

  private updateTempo(time: number): void {
    const estimate = this.tempo.estimate();
    if (!estimate) return;
    this.confidence = estimate.confidence;
    if (this.bpmLocked) return;
    const bpm = this.follower.update(estimate);
    if (bpm !== null && Math.abs(bpm - this.clock.bpm) > 1e-3) this.clock.setBpm(bpm, time);
  }
}
