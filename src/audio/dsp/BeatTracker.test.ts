import { describe, expect, it } from 'vitest';
import { BandSplitter, HOP_SIZE } from './BandSplitter';
import { BeatTracker } from './BeatTracker';
import { SAMPLE_RATE, synthTechno, type Synth } from './testing/synth';

function run(synth: Synth) {
  const splitter = new BandSplitter(SAMPLE_RATE, HOP_SIZE);
  const tracker = new BeatTracker(SAMPLE_RATE / HOP_SIZE);
  const kicks: number[] = [];
  const drops: number[] = [];
  tracker.onKick = (k) => kicks.push(k.time);
  tracker.onDrop = (t) => drops.push(t);
  // Feed in 128-sample render quanta, like the AudioWorklet does.
  for (let i = 0; i + 128 <= synth.signal.length; i += 128) {
    splitter.process(synth.signal.subarray(i, i + 128), i / SAMPLE_RATE, (f) => tracker.pushHop(f));
  }
  return { tracker, kicks, drops };
}

/** Distance of the grid from the true kicks, in beats, over the last `n` kicks. */
function phaseError(tracker: BeatTracker, trueKicks: number[], n = 8): number {
  let worst = 0;
  for (const t of trueKicks.slice(-n)) {
    const b = tracker.clock.beatAt(t);
    worst = Math.max(worst, Math.abs(b - Math.round(b)));
  }
  return worst;
}

describe('BeatTracker', () => {
  it.each([122, 128, 135, 140, 150, 172])('locks onto %d BPM', (bpm) => {
    const synth = synthTechno([{ bpm, seconds: 25 }]);
    const { tracker } = run(synth);
    expect(Math.abs(tracker.clock.bpm - bpm)).toBeLessThan(0.3);
    expect(phaseError(tracker, synth.kicks)).toBeLessThan(0.05);
    expect(tracker.clock.locked).toBe(true);
  });

  it('detects nearly every kick and no off-beat bass notes', () => {
    const synth = synthTechno([{ bpm: 130, seconds: 20 }]);
    const { kicks } = run(synth);
    const matched = synth.kicks.filter((t) => kicks.some((k) => Math.abs(k - t) < 0.03)).length;
    expect(matched / synth.kicks.length).toBeGreaterThan(0.95);
    expect(kicks.length).toBeLessThanOrEqual(synth.kicks.length + 1);
  });

  it('works at very different input levels', () => {
    for (const gain of [0.02, 0.9]) {
      const synth = synthTechno([{ bpm: 132, seconds: 20 }], { gain, noise: gain * 0.04 });
      const { tracker } = run(synth);
      expect(Math.abs(tracker.clock.bpm - 132)).toBeLessThan(0.3);
    }
  });

  it('follows a tempo change', () => {
    const synth = synthTechno([
      { bpm: 126, seconds: 20 },
      { bpm: 138, seconds: 20 },
    ]);
    const { tracker } = run(synth);
    expect(Math.abs(tracker.clock.bpm - 138)).toBeLessThan(0.3);
    expect(phaseError(tracker, synth.kicks)).toBeLessThan(0.05);
  });

  it('reports a drop after a breakdown and puts the bar start on it', () => {
    const synth = synthTechno([
      { bpm: 128, seconds: 16 },
      { bpm: 128, seconds: 8, breakdown: true },
      { bpm: 128, seconds: 10 },
    ]);
    const { tracker, drops } = run(synth);
    expect(drops).toHaveLength(1);
    const dropKick = synth.kicks.find((t) => t > 24)!;
    expect(Math.abs(drops[0] - dropKick)).toBeLessThan(0.03);
    const beat = Math.round(tracker.clock.beatAt(dropKick));
    expect(((beat - tracker.clock.barOffset) % 4 + 4) % 4).toBe(0);
  });

  it('keeps the beat through the breakdown', () => {
    const synth = synthTechno([
      { bpm: 128, seconds: 16 },
      { bpm: 128, seconds: 8, breakdown: true },
      { bpm: 128, seconds: 2 },
    ]);
    const { tracker } = run(synth);
    expect(Math.abs(tracker.clock.bpm - 128)).toBeLessThan(0.5);
    expect(phaseError(tracker, synth.kicks, 3)).toBeLessThan(0.08);
  });

  it('tap tempo sets bpm and phase', () => {
    const tracker = new BeatTracker(SAMPLE_RATE / HOP_SIZE);
    const bpm = 125;
    let result: number | null = null;
    for (let i = 0; i < 4; i++) result = tracker.tap(10 + (i * 60) / bpm);
    expect(result).toBeCloseTo(bpm, 3);
    const b = tracker.clock.beatAt(10 + (8 * 60) / bpm);
    expect(Math.abs(b - Math.round(b))).toBeLessThan(1e-6);
  });
});
