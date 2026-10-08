import type { GlitchLevel } from '../director/Director';

export const RENDER_SCALES = ['auto', 1, 0.75, 0.5] as const;
export type RenderScaleSetting = (typeof RENDER_SCALES)[number];

/** Range of the sync fader (ms). */
export const SYNC_OFFSET_LIMIT = 500;

/** Everything the user can change; persisted per browser. */
export interface Settings {
  scene: number;
  strobe: boolean;
  glitch: GlitchLevel;
  renderScale: RenderScaleSetting;
  /** Visual delay relative to the music: positive = picture later, negative = picture earlier. */
  syncOffsetMs: number;
  sensitivity: number;
  autoScene: boolean;
  micId: string | null;
  /** Occasional webcam cut-ins. */
  webcam: boolean;
  /** Index into PALETTES. */
  palette: number;
}

const DEFAULTS: Settings = {
  scene: 0,
  strobe: true,
  glitch: 1,
  renderScale: 'auto',
  syncOffsetMs: 0,
  sensitivity: 1.6,
  autoScene: false,
  micId: null,
  webcam: true,
  palette: 0,
};

const KEY = 'vibecode-visualizer:settings';

/** Settings as stored by older versions. */
interface StoredSettings extends Partial<Settings> {
  /** v0.1: lead time in ms, default 40 (= syncOffsetMs 0). */
  latencyMs?: number;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { latencyMs, ...stored } = JSON.parse(raw) as StoredSettings;
      if (stored.syncOffsetMs === undefined && latencyMs !== undefined) stored.syncOffsetMs = 40 - latencyMs;
      return { ...DEFAULTS, ...stored };
    }
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
