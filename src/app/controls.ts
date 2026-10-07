import type { App } from './App';

type Action = (app: App) => void | Promise<void>;

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
  '.': (a) => a.nudgeLatency(10),
  ',': (a) => a.nudgeLatency(-10),
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
  h: (a) => a.toggleHud(),
};

export const HELP = `TASTEN
  1 2 3      Szene wählen          ← →    Szene vor/zurück
  LEER       FX-Burst (Drop)       B      Blackout
  T          Tap-Tempo             L      BPM sperren/freigeben
  , .        Latenz −/+ 10 ms      + −    Kick empfindlicher/weniger
  S          Strobe an/aus         G      Glitch aus/dosiert/heftig
  R          Auflösung             A      Auto-Szenenwechsel
  M          nächstes Mikrofon     D      Demo-Beat an/aus
  F          Vollbild              H      dieses Overlay`;

export function bindKeys(app: App): void {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const action = KEYMAP[key];
    if (!action || (e.repeat && key !== 'ArrowLeft' && key !== 'ArrowRight')) return;
    e.preventDefault();
    void action(app);
  });
}
