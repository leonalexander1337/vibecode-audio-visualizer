import { describe, expect, it } from 'vitest';
import { PALETTES, blendColors, hexToRgb, paletteColors } from './palettes';

describe('palettes', () => {
  it('has 3–5 well-formed palettes, the first being the classic black/white/red', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(3);
    expect(PALETTES.length).toBeLessThanOrEqual(5);
    for (const p of PALETTES) for (const c of [p.bg, p.fg, p.accent]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(PALETTES[0]).toMatchObject({ bg: '#000000', fg: '#ffffff' });
  });

  it('parses hex colours', () => {
    expect(hexToRgb('#ff8000')).toEqual([1, 128 / 255, 0]);
  });

  it('blends towards the target palette', () => {
    const a = paletteColors(PALETTES[0]);
    const b = paletteColors(PALETTES[1]);
    for (let i = 0; i < 60; i++) blendColors(a, b, 0.2);
    expect(a.accent[1]).toBeCloseTo(b.accent[1], 3);
  });
});
