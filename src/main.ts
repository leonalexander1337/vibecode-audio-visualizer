import { App } from './app/App';
import { loadSettings } from './app/settings';
import { AudioEngine } from './audio/AudioEngine';
import { Renderer } from './gfx/Renderer';
import { SCENES } from './scenes';
import './style.css';
import { registerServiceWorker } from './system/browser';

registerServiceWorker();

const startScreen = document.getElementById('start')!;
const errorEl = document.getElementById('start-error')!;
const buttons = [...startScreen.querySelectorAll('button')];
const canvas = document.getElementById('stage') as HTMLCanvasElement;
let renderer: Renderer | null = null;

async function boot(mode: 'mic' | 'demo'): Promise<void> {
  buttons.forEach((b) => (b.disabled = true));
  errorEl.textContent = '';
  let engine: AudioEngine | null = null;
  try {
    const settings = loadSettings();
    renderer ??= new Renderer(canvas, SCENES);
    engine = await AudioEngine.create();
    if (mode === 'demo') {
      engine.useDemo();
    } else {
      try {
        await engine.useMicrophone(settings.micId);
      } catch (err) {
        // A remembered mic that is no longer plugged in → fall back to the default one.
        if (!settings.micId) throw err;
        settings.micId = null;
        await engine.useMicrophone(null);
      }
    }
    new App(engine, renderer, settings).start();
    startScreen.hidden = true;
  } catch (err) {
    void engine?.close();
    errorEl.textContent = describe(err);
    console.error(err);
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

function describe(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Mikrofonzugriff verweigert. Über das Schloss-Symbol in der Adressleiste erlauben – oder DEMO starten.';
  if (name === 'NotFoundError') return 'Kein Mikrofon gefunden.';
  if (name === 'NotReadableError') return 'Mikrofon ist von einer anderen App belegt.';
  return err instanceof Error ? err.message : String(err);
}

document.getElementById('btn-mic')!.addEventListener('click', () => void boot('mic'));
document.getElementById('btn-demo')!.addEventListener('click', () => void boot('demo'));
