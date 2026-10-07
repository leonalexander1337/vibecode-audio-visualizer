import type { GlitchLevel } from '../director/Director';

export const RENDER_SCALES = ['auto', 1, 0.75, 0.5] as const;
export type RenderScaleSetting = (typeof RENDER_SCALES)[number];

/** Everything the user can change with keys; persisted per browser. */
export interface Settings {
  scene: number;
  strobe: boolean;
  glitch: GlitchLevel;
  renderScale: RenderScaleSetting;
  latencyMs: number;
  sensitivity: number;
  autoScene: boolean;
  micId: string | null;
}

const DEFAULTS: Settings = {
  scene: 0,
  strobe: true,
  glitch: 1,
  renderScale: 'auto',
  latencyMs: 40,
  sensitivity: 1.6,
  autoScene: false,
  micId: null,
};

const KEY = 'vibecode-visualizer:settings';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Storage blocked or corrupt — defaults are fine.
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not persisting is acceptable.
  }
}
