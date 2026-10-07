import { describe, expect, it } from 'vitest';
import { CamShow } from './CamShow';

interface Log {
  arm: number[];
  release: number[];
  transitions: number[];
  /** [beatTime, reveal] for every frame with reveal > 0 */
  shown: [number, number][];
}

/** Drives a CamShow at `bpm` for `beats` beats with 60 fps frames. */
function simulate(show: CamShow, bpm: number, beats: number, opts: { cameraReady?: (beat: number) => boolean; from?: number } = {}): Log {
  const log: Log = { arm: [], release: [], transitions: [], shown: [] };
  let beatTime = opts.from ?? 0;
  show.onArm = () => log.arm.push(beatTime);
  show.onRelease = () => log.release.push(beatTime);
  show.onTransition = () => log.transitions.push(beatTime);
  const step = bpm / 60 / 60;
  const end = beatTime + beats;
  for (; beatTime < end; beatTime += step) {
    const ready = opts.cameraReady?.(beatTime) ?? true;
    const { weight } = show.update(beatTime, Math.floor(beatTime) % 4, bpm, ready);
    if (weight > 0) log.shown.push([beatTime, weight]);
  }
  return log;
}

/** Deterministic random numbers in [0, 1). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Contiguous runs of frames with the camera visible → [start, end] in beats. */
function runs(shown: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [t] of shown) {
    const last = out[out.length - 1];
    if (last && t - last[1] < 0.1) last[1] = t;
    else out.push([t, t]);
  }
  return out;
}

describe('CamShow', () => {
  it.each([95, 128, 140, 175])('cut-ins last 5–10 s, start on a downbeat and recur at %d BPM', (bpm) => {
    for (let seed = 1; seed <= 5; seed++) {
      const show = new CamShow(seeded(seed * bpm));
      const log = simulate(show, bpm, 4 * 400);
      // The simulation may stop in the middle of the last cut-in — only judge complete ones.
      const cuts = runs(log.shown).filter(([, end]) => end < log.release[log.release.length - 1]);
      expect(cuts.length).toBeGreaterThanOrEqual(4);
      for (const [start, end] of cuts) {
        const seconds = ((end - start) * 60) / bpm;
        expect(seconds).toBeGreaterThan(4.8);
        expect(seconds).toBeLessThan(10.2);
        expect(Math.floor(start) % 4).toBe(0);
      }
      // Camera armed ahead of every cut-in and released after; one transition in, one out.
      expect(log.arm.length - log.release.length).toBeLessThanOrEqual(1);
      expect(log.transitions.length - cuts.length * 2).toBeLessThanOrEqual(2);
    }
  });

  it('switches the camera on 4 bars before the cut-in', () => {
    const show = new CamShow();
    const log = simulate(show, 128, 4 * 200);
    const firstCut = runs(log.shown)[0][0];
    expect(firstCut - log.arm[0]).toBeGreaterThanOrEqual(15);
    expect(firstCut - log.arm[0]).toBeLessThan(18);
  });

  it('waits for the camera and gives up if it never becomes ready', () => {
    const show = new CamShow();
    const log = simulate(show, 128, 4 * 60, { cameraReady: () => false });
    expect(log.shown).toHaveLength(0);
    expect(log.release.length).toBeGreaterThanOrEqual(1);
  });

  it('manual toggle cuts in on the next beat and out again', () => {
    const show = new CamShow();
    show.update(10.5, 2, 128, true);
    show.toggleNow(10.5, 'hold');
    const log = simulate(show, 128, 3, { from: 10.5 });
    expect(runs(log.shown)[0][0]).toBeCloseTo(11, 1);
    expect(show.active).toBe(true);
    show.toggleNow(13.6, 'hold');
    // Transition in runs until beat 15, transition out takes another bar.
    const after = simulate(show, 128, 6, { from: 13.6 });
    expect(show.active).toBe(false);
    expect(after.release).toHaveLength(1);
  });

  it('hold stays on until toggled again', () => {
    const show = new CamShow();
    show.toggleNow(0.2, 'hold');
    const log = simulate(show, 128, 4 * 100, { from: 0.2 });
    expect(show.held).toBe(true);
    expect(log.release).toHaveLength(0);
    expect(runs(log.shown)).toHaveLength(1);
    show.toggleNow(400.3, 'short');
    simulate(show, 128, 6, { from: 400.3 });
    expect(show.active).toBe(false);
  });

  it('transitions in and out over one bar each with rising progress', () => {
    const show = new CamShow();
    show.toggleNow(0.2, 'short');
    const phases: string[] = [];
    let lastProgress = -1;
    let lastPhase: string | null = null;
    for (let bt = 0.2; bt < 30; bt += 128 / 60 / 60) {
      const f = show.update(bt, Math.floor(bt) % 4, 128, true);
      const phase = f.transition ?? (f.weight > 0 ? 'on' : 'off');
      if (phase !== lastPhase) {
        phases.push(phase);
        lastProgress = -1;
      }
      if (f.transition) {
        expect(f.progress).toBeGreaterThanOrEqual(lastProgress);
        lastProgress = f.progress;
        expect(f.weight).toBeCloseTo(f.transition === 'in' ? f.progress : 1 - f.progress, 6);
      }
      lastPhase = phase;
    }
    expect(phases).toEqual(['off', 'in', 'on', 'out', 'off']);
  });

  it('short manual cut-in ends by itself after 5–10 s', () => {
    const show = new CamShow();
    show.toggleNow(0.2, 'short');
    const log = simulate(show, 128, 4 * 10, { from: 0.2 });
    const [start, end] = runs(log.shown)[0];
    const seconds = ((end - start) * 60) / 128;
    expect(seconds).toBeGreaterThan(4.8);
    expect(seconds).toBeLessThan(10.2);
    expect(show.active).toBe(false);
  });

  it('fades out monotonically after a manual cut-out', () => {
    const show = new CamShow();
    show.toggleNow(0.2, 'hold');
    simulate(show, 128, 6, { from: 0.2 });
    expect(show.active).toBe(true);
    show.toggleNow(6.3, 'hold');
    const reveals: number[] = [];
    for (let bt = 6.3; bt < 12; bt += 128 / 60 / 60) reveals.push(show.update(bt, Math.floor(bt) % 4, 128, true).weight);
    for (let i = 1; i < reveals.length; i++) expect(reveals[i]).toBeLessThanOrEqual(reveals[i - 1]);
    expect(reveals[reveals.length - 1]).toBe(0);
  });

  it('does nothing while disabled', () => {
    const show = new CamShow();
    show.enabled = false;
    const log = simulate(show, 128, 4 * 200);
    expect(log.arm).toHaveLength(0);
    expect(log.shown).toHaveLength(0);
  });
});
