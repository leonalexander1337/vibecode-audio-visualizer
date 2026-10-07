import type { App } from './App';

type Action = (app: App, e: KeyboardEvent) => void | Promise<void>;

/** Keys as reported by `KeyboardEvent.key` (letters lower-cased). Chosen to work on German and US layouts. */
const KEYMAP: Record<string, Action> = {
  '1': (a) => a.setScene(0),
  '2': (a) => a.setScene(1),
  '3': (a) => a.setScene(2),
  ArrowRight: (a) => a.nextScene(1),
  ArrowLeft: (a) => a.nextScene(-1),
  ' ': (a) => a.burst(),
  f: (a) => a.toggleFullscreen(),
  t: (a) => a.tap(),
  l: (a) => a.toggleBpmLock(),
  '.': (a) => a.nudgeSyncOffset(10),
  ',': (a) => a.nudgeSyncOffset(-10),
  '+': (a) => a.nudgeSensitivity(0.2),
  '=': (a) => a.nudgeSensitivity(0.2),
  '-': (a) => a.nudgeSensitivity(-0.2),
  s: (a) => a.toggleStrobe(),
  g: (a) => a.cycleGlitch(),
  r: (a) => a.cycleRenderScale(),
  a: (a) => a.toggleAutoScene(),
  m: (a) => a.nextMicrophone(),
  d: (a) => a.toggleDemo(),
  b: (a) => a.toggleBlackout(),
  c: (a) => a.toggleControlPanel(),
  w: (a) => a.toggleWebcamFeature(),
  v: (a, e) => a.toggleWebcamNow(e.shiftKey ? 'short' : 'hold'),
  h: (a) => a.toggleHud(),
};

/** Keys that may auto-repeat while held. */
const REPEATABLE = new Set(['ArrowLeft', 'ArrowRight', ',', '.']);
/** Keys a focused slider/button/checkbox needs for itself. */
const FORM_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter']);

export const HELP = `TASTEN
  1 2 3      Szene wählen          ← →    Szene vor/zurück
  LEER       FX-Burst (Drop)       B      Blackout
  T          Tap-Tempo             L      BPM sperren/freigeben
  , .        Sync: Bild früher/später (10 ms)
  + −        Kick empfindlicher/weniger
  S          Strobe an/aus         G      Glitch aus/dosiert/heftig
  R          Auflösung             A      Auto-Szenenwechsel
  W          Webcam-Einblendungen an/aus
  V          Webcam ein (bleibt) / aus      SHIFT+V  Webcam kurz (5–10 s)
  M          nächstes Mikrofon     D      Demo-Beat an/aus
  C          Control-Panel         F      Vollbild
  H          dieses Overlay`;

export function bindKeys(app: App): void {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) {
      if (FORM_KEYS.has(key)) return;
    }
    const action = KEYMAP[key];
    if (!action || (e.repeat && !REPEATABLE.has(key))) return;
    e.preventDefault();
    void action(app, e);
  });
}
