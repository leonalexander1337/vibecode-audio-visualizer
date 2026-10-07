import { describe, expect, it } from 'vitest';
import { ReactiveDelay } from './ReactiveDelay';

/** Records value i at time i/10 for i = 0..20. */
function filled(maxAge: number): ReactiveDelay<number> {
  const d = new ReactiveDelay<number>(maxAge);
  for (let i = 0; i <= 20; i++) d.push(i / 10, i);
  return d;
}

describe('ReactiveDelay', () => {
  it('returns the value that was current at the requested time', () => {
    const d = filled(1);
    expect(d.at(1.95)).toBe(19);
    expect(d.at(1.5)).toBe(15);
  });

  it('forgets values older than maxAge but still answers', () => {
    expect(filled(0.5).at(0.2)).toBe(15);
  });
});
