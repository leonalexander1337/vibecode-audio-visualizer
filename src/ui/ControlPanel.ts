import { SYNC_OFFSET_LIMIT } from '../app/settings';

export interface ControlPanelHandlers {
  onSyncOffset(ms: number): void;
  onWebcamEnabled(enabled: boolean): void;
  onWebcamNow(): void;
}

/**
 * Mouse-operated panel (toggle with C): sync fader and webcam controls.
 * The beat lamp flashes on the beat as the *picture* sees it — move the fader until it
 * flashes together with the kick you hear.
 */
export class ControlPanel {
  private readonly el: HTMLElement;
  private readonly sync: HTMLInputElement;
  private readonly syncValue: HTMLOutputElement;
  private readonly lamp: HTMLElement;
  private readonly camEnabled: HTMLInputElement;
  private readonly camStatus: HTMLElement;

  constructor(handlers: ControlPanelHandlers) {
    this.el = byId('control');
    this.sync = byId<HTMLInputElement>('sync');
    this.syncValue = byId<HTMLOutputElement>('sync-value');
    this.lamp = byId('beat-lamp');
    this.camEnabled = byId<HTMLInputElement>('cam-enabled');
    this.camStatus = byId('cam-status');

    this.sync.min = String(-SYNC_OFFSET_LIMIT);
    this.sync.max = String(SYNC_OFFSET_LIMIT);
    this.sync.addEventListener('input', () => handlers.onSyncOffset(Number(this.sync.value)));
    byId('sync-reset').addEventListener('click', () => handlers.onSyncOffset(0));
    this.camEnabled.addEventListener('change', () => handlers.onWebcamEnabled(this.camEnabled.checked));
    byId('cam-now').addEventListener('click', () => handlers.onWebcamNow());
    // Double-clicks here are for the controls, not for fullscreen.
    this.el.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
  }

  setSyncOffset(ms: number): void {
    this.sync.value = String(ms);
    this.syncValue.value = `${ms > 0 ? '+' : ''}${ms} ms`;
  }

  setWebcamEnabled(enabled: boolean): void {
    this.camEnabled.checked = enabled;
  }

  /** Per frame while visible. */
  update(beatPhase: number, camStatus: string): void {
    this.lamp.style.opacity = String(Math.exp(-beatPhase * 8));
    if (this.camStatus.textContent !== camStatus) this.camStatus.textContent = camStatus;
  }
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
