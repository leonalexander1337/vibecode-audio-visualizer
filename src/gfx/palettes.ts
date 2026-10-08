/**
 * Colour variations. Everything is rendered in black/white/red; the output pass maps
 * black → bg, white → fg, red → accent. Webcam footage keeps its own colours.
 */
export interface Palette {
  name: string;
  bg: string;
  fg: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { name: 'BLUT', bg: '#000000', fg: '#ffffff', accent: '#ff0a14' },
  { name: 'ACID', bg: '#000000', fg: '#f0ffe8', accent: '#a8ff00' },
  { name: 'UV', bg: '#06000f', fg: '#d9ccff', accent: '#ff2bd6' },
  { name: 'GLUT', bg: '#000000', fg: '#ffb347', accent: '#ff3300' },
  { name: 'EIS', bg: '#00040a', fg: '#c8f2ff', accent: '#1f6bff' },
];

export type Rgb = [number, number, number];

/** '#rrggbb' → [r, g, b] in 0..1 */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Palette colours as the shader takes them. */
export interface PaletteColors {
  bg: Rgb;
  fg: Rgb;
  accent: Rgb;
}

export function paletteColors(p: Palette): PaletteColors {
  return { bg: hexToRgb(p.bg), fg: hexToRgb(p.fg), accent: hexToRgb(p.accent) };
}

/** Moves `current` a step towards `target` (smooth palette changes). */
export function blendColors(current: PaletteColors, target: PaletteColors, k: number): void {
  for (const key of ['bg', 'fg', 'accent'] as const) {
    for (let i = 0; i < 3; i++) current[key][i] += (target[key][i] - current[key][i]) * k;
  }
}
