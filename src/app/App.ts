import type { AudioEngine } from '../audio/AudioEngine';
import { BeatTracker } from '../audio/dsp/BeatTracker';
import { MusicAnalyzer, type MusicFrame } from '../audio/MusicAnalyzer';
import { Spectrum } from '../audio/Spectrum';
import { Director, type GlitchLevel } from '../director/Director';
import type { Renderer } from '../gfx/Renderer';
import { SCENES } from '../scenes';
import { hideIdleCursor, keepScreenAwake, toggleFullscreen } from '../system/browser';
import { ControlPanel } from '../ui/ControlPanel';
import { Hud, bar } from '../ui/Hud';
import { Toast } from '../ui/Toast';
import { Webcam } from '../video/Webcam';
import { clamp, mod } from '../util/math';
import { HELP, bindKeys } from './controls';
import { ResolutionGovernor } from './ResolutionGovernor';
import { RENDER_SCALES, SYNC_OFFSET_LIMIT, saveSettings, type Settings } from './settings';

const GLITCH_NAMES = ['AUS', 'DOSIERT', 'HEFTIG'];

/** Wires audio analysis, effect direction and rendering together and owns all user actions. */
export class App {
  private readonly tracker: BeatTracker;
  private readonly music: MusicAnalyzer;
  private readonly director = new Director();
  private readonly governor = new ResolutionGovernor();
  private readonly hud = new Hud(document.getElementById('hud')!);
  private readonly toast = new Toast(document.getElementById('toast')!);
  private readonly startedAt = performance.now();
  private readonly webcam = new Webcam();
  private readonly panel: ControlPanel;
  private sceneIndex: number;
  private lastFrame = 0;
  private lastBeatTime = 0;
  private fps = 60;

  constructor(
    private readonly engine: AudioEngine,
    private readonly renderer: Renderer,
    private readonly settings: Settings,
  ) {
    this.tracker = new BeatTracker(engine.hopRate);
    this.tracker.kicks.sensitivity = settings.sensitivity;
    this.music = new MusicAnalyzer(this.tracker, new Spectrum(engine.analyser));
    this.music.syncOffset = settings.syncOffsetMs / 1000;
    this.music.onKick = (kick) => this.director.onKick(kick.strength);
    this.music.onDrop = () => this.director.triggerDrop();
    engine.onHop = (frame) => this.music.pushHop(frame);
    engine.onInputLost = () => this.toast.show('MIKROFON GETRENNT — M DRÜCKEN', 5000);

    this.director.strobeEnabled = settings.strobe;
    this.director.glitchLevel = settings.glitch;
    this.director.autoScene = settings.autoScene;
    this.director.onAutoAdvance = () => this.nextScene(1);
    this.sceneIndex = clamp(settings.scene, 0, SCENES.length - 1);

    const cam = this.director.cam;
    cam.enabled = settings.webcam;
    cam.onArm = () => {
      this.webcam.open().catch(() => this.toast.show('WEBCAM NICHT VERFÜGBAR', 3000));
    };
    cam.onRelease = () => this.webcam.close();

    this.panel = new ControlPanel({
      onSyncOffset: (ms) => this.setSyncOffset(ms),
      onWebcamEnabled: (enabled) => this.setWebcamEnabled(enabled),
      onWebcamNow: () => this.toggleWebcamNow(),
    });
    this.panel.setSyncOffset(settings.syncOffsetMs);
    this.panel.setWebcamEnabled(settings.webcam);
  }

  start(): void {
    bindKeys(this);
    keepScreenAwake();
    hideIdleCursor();
    window.addEventListener('dblclick', () => toggleFullscreen());
    requestAnimationFrame(this.frame);
    this.toast.show('H = HILFE · C = CONTROL · F = VOLLBILD', 3500);
    // Get the camera permission prompt out of the way now, not on the projector mid-party.
    if (this.settings.webcam) void this.setWebcamEnabled(true);
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const rawDt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    const dt = Math.min(rawDt, 0.1);
    this.lastFrame = now;

    const m = this.music.update(this.engine.now(), dt);
    this.lastBeatTime = m.beatTime;
    const fx = this.director.update(m, dt, this.webcam.ready);
    if (fx.camera > 0 && this.webcam.ready) this.renderer.updateCamera(this.webcam.video);
    const scale = this.settings.renderScale;
    this.renderer.layout();
    const vp = this.renderer.viewport;
    this.renderer.renderScale = scale === 'auto' ? this.governor.update(rawDt, vp.width * vp.height) : scale;
    this.renderer.render(
      this.sceneIndex,
      {
        time: (now - this.startedAt) / 1000,
        beatTime: m.beatTime,
        beat: m.beat,
        barTime: m.barTime,
        kick: m.kick,
        bass: m.bass,
        mid: m.mid,
        high: m.high,
        level: m.level,
        drop: m.drop,
      },
      fx,
      SCENES[this.sceneIndex].feedback,
    );

    if (rawDt > 0) this.fps += (1 / rawDt - this.fps) * 0.05;
    this.hud.update(now, () => this.hudText(m));
    if (this.panel.visible) this.panel.update(m.beat, this.webcamStatus(m));
  };

  // ── Actions (bound to keys in controls.ts) ────────────────────────────────

  setScene(index: number): void {
    if (index < 0 || index >= SCENES.length || index === this.sceneIndex) return;
    this.sceneIndex = index;
    this.director.sceneChanged();
    this.settings.scene = index;
    this.persist();
    this.toast.show(`${index + 1} · ${SCENES[index].name}`);
  }

  nextScene(step: number): void {
    this.setScene(mod(this.sceneIndex + step, SCENES.length));
  }

  burst(): void {
    this.director.triggerDrop();
  }

  tap(): void {
    const bpm = this.tracker.tap(this.engine.now());
    this.toast.show(bpm === null ? 'TAP …' : `TAP ${bpm.toFixed(1)} BPM`);
  }

  toggleBpmLock(): void {
    this.tracker.bpmLocked = !this.tracker.bpmLocked;
    this.toast.show(this.tracker.bpmLocked ? `BPM GESPERRT ${this.tracker.clock.bpm.toFixed(1)}` : 'BPM AUTOMATISCH');
  }

  /** Sync fader: positive = picture later, negative = picture earlier. */
  setSyncOffset(ms: number): void {
    this.settings.syncOffsetMs = clamp(Math.round(ms), -SYNC_OFFSET_LIMIT, SYNC_OFFSET_LIMIT);
    this.music.syncOffset = this.settings.syncOffsetMs / 1000;
    this.panel.setSyncOffset(this.settings.syncOffsetMs);
    this.persist();
  }

  nudgeSyncOffset(ms: number): void {
    this.setSyncOffset(this.settings.syncOffsetMs + ms);
    this.toast.show(`SYNC ${formatOffset(this.settings.syncOffsetMs)}`);
  }

  toggleControlPanel(): void {
    this.panel.toggle();
  }

  async setWebcamEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      try {
        await Webcam.requestPermission();
      } catch {
        enabled = false;
        this.toast.show('WEBCAM NICHT VERFÜGBAR / NICHT ERLAUBT', 4000);
      }
    }
    this.settings.webcam = this.director.cam.enabled = enabled;
    this.panel.setWebcamEnabled(enabled);
    this.persist();
  }

  async toggleWebcamFeature(): Promise<void> {
    await this.setWebcamEnabled(!this.settings.webcam);
    this.toast.show(this.settings.webcam ? 'WEBCAM-EINBLENDUNGEN AN' : 'WEBCAM-EINBLENDUNGEN AUS');
  }

  /** Cut the webcam in right now (or out, if it is showing). */
  toggleWebcamNow(): void {
    if (!this.settings.webcam) {
      this.toast.show('WEBCAM IST AUS — W DRÜCKEN');
      return;
    }
    this.director.cam.toggleNow(this.lastBeatTime);
  }

  nudgeSensitivity(delta: number): void {
    this.settings.sensitivity = Math.round(clamp(this.settings.sensitivity - delta, 0.6, 3.2) * 10) / 10;
    this.tracker.kicks.sensitivity = this.settings.sensitivity;
    this.persist();
    this.toast.show(`KICK-SCHWELLE ${this.settings.sensitivity.toFixed(1)}`);
  }

  toggleStrobe(): void {
    this.settings.strobe = this.director.strobeEnabled = !this.settings.strobe;
    this.persist();
    this.toast.show(this.settings.strobe ? 'STROBE AN' : 'STROBE AUS');
  }

  cycleGlitch(): void {
    const level = ((this.settings.glitch + 1) % 3) as GlitchLevel;
    this.settings.glitch = this.director.glitchLevel = level;
    this.persist();
    this.toast.show(`GLITCH ${GLITCH_NAMES[level]}`);
  }

  cycleRenderScale(): void {
    const i = RENDER_SCALES.indexOf(this.settings.renderScale);
    this.settings.renderScale = RENDER_SCALES[(i + 1) % RENDER_SCALES.length];
    this.persist();
    this.toast.show(`AUFLÖSUNG ${this.renderScaleLabel()}`);
  }

  toggleAutoScene(): void {
    this.settings.autoScene = this.director.autoScene = !this.settings.autoScene;
    this.persist();
    this.toast.show(this.settings.autoScene ? 'AUTO-SZENE AN (32 TAKTE)' : 'AUTO-SZENE AUS');
  }

  toggleBlackout(): void {
    this.director.blackout = !this.director.blackout;
    this.toast.show(this.director.blackout ? 'BLACKOUT' : 'BLACKOUT AUS');
  }

  toggleHud(): void {
    this.hud.toggle();
  }

  toggleFullscreen(): void {
    toggleFullscreen();
  }

  async nextMicrophone(): Promise<void> {
    try {
      const mics = await this.engine.listMicrophones();
      if (mics.length === 0) {
        this.toast.show('KEIN MIKROFON GEFUNDEN');
        return;
      }
      const current = mics.findIndex((m) => m.deviceId === this.engine.deviceId);
      const next = mics[(current + 1) % mics.length];
      await this.engine.useMicrophone(next.deviceId);
      this.settings.micId = next.deviceId;
      this.persist();
      this.toast.show(`MIC: ${this.engine.inputLabel}`, 2500);
    } catch (err) {
      this.toast.show(`MIKROFON-FEHLER: ${(err as Error).message}`, 4000);
    }
  }

  async toggleDemo(): Promise<void> {
    try {
      if (this.engine.isDemo) {
        await this.engine.useMicrophone(this.settings.micId);
        this.toast.show(`MIC: ${this.engine.inputLabel}`, 2500);
      } else {
        this.engine.useDemo(demoBpm());
        this.toast.show(this.engine.inputLabel.toUpperCase(), 2500);
      }
    } catch (err) {
      this.toast.show(`MIKROFON-FEHLER: ${(err as Error).message}`, 4000);
    }
  }

  private persist(): void {
    saveSettings(this.settings);
  }

  private webcamStatus(m: MusicFrame): string {
    const cam = this.director.cam;
    if (!this.settings.webcam) return 'AUS';
    if (cam.active) return 'LIVE';
    if (cam.arming) return this.webcam.ready ? 'BEREIT' : 'KAMERA STARTET …';
    const next = cam.nextStartBeat;
    if (next === null) return '';
    return `NÄCHSTE IN ~${Math.max(0, Math.round(((next - m.beatTime) * 60) / m.bpm))} s`;
  }

  private renderScaleLabel(): string {
    const s = this.settings.renderScale;
    return s === 'auto' ? `AUTO (${Math.round(this.renderer.renderScale * 100)} %)` : `${Math.round(s * 100)} %`;
  }

  private hudText(m: MusicFrame): string {
    const r = this.renderer;
    const status = this.tracker.bpmLocked ? 'GESPERRT' : m.locked ? 'SYNC' : m.kicking ? 'SUCHE' : 'KEIN KICK';
    const beatDots = [0, 1, 2, 3].map((i) => (Math.floor(m.barTime) === i ? '■' : '□')).join(' ');
    return [
      `SZENE    ${this.sceneIndex + 1}/${SCENES.length} ${SCENES[this.sceneIndex].name}`,
      `BPM      ${m.bpm.toFixed(1).padStart(5)}  ${status}  ${beatDots}  conf ${m.confidence.toFixed(2)}`,
      `KICK     ${bar(m.kick)}   SCHWELLE ${this.settings.sensitivity.toFixed(1)}`,
      `BASS     ${bar(m.bass)}`,
      `MITTEN   ${bar(m.mid)}`,
      `HÖHEN    ${bar(m.high)}`,
      `EINGANG  ${m.inputDb.toFixed(0).padStart(4)} dBFS ${m.clipping ? ' ▲ CLIPPING — PEGEL RUNTER' : ''}`,
      `QUELLE   ${this.engine.inputLabel}`,
      `SYNC     ${formatOffset(this.settings.syncOffsetMs)} (+ = Bild später)`,
      `WEBCAM   ${this.webcamStatus(m)}`,
      `RENDER   ${this.renderScaleLabel()} · ${r.internalWidth}×${r.internalHeight} · ${this.fps.toFixed(0)} fps`,
      `FX       STROBE ${this.settings.strobe ? 'AN' : 'AUS'} · GLITCH ${GLITCH_NAMES[this.settings.glitch]} · AUTO-SZENE ${this.settings.autoScene ? 'AN' : 'AUS'}`,
      '',
      HELP,
    ].join('\n');
  }
}

function formatOffset(ms: number): string {
  return `${ms > 0 ? '+' : ''}${ms} ms`;
}

/** `?bpm=140` in the URL changes the demo tempo (for testing the tracker). */
function demoBpm(): number {
  const bpm = Number(new URLSearchParams(location.search).get('bpm'));
  return bpm >= 60 && bpm <= 200 ? bpm : 128;
}
