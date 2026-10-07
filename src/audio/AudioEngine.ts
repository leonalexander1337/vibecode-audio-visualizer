import workletUrl from './worklet/band-energy.worklet.ts?worker&url';
import { HOP_SIZE, type HopFrame } from './dsp/BandSplitter';
import { DemoBeat } from './DemoBeat';

/**
 * Owns the AudioContext and the input (microphone or demo loop).
 *
 *   input ─▶ bus ─┬─▶ AnalyserNode (spectrum for visuals)
 *                 └─▶ AudioWorklet  (band energies → beat tracking, posted per hop)
 *
 * Nothing is routed to the speakers except the demo loop.
 */
export class AudioEngine {
  readonly analyser: AnalyserNode;
  readonly hopRate: number;
  onHop: ((frame: HopFrame) => void) | null = null;
  /** Fired when the active microphone disappears (unplugged, permission revoked). */
  onInputLost: (() => void) | null = null;
  inputLabel = '';
  deviceId: string | null = null;

  private readonly bus: GainNode;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private demo: DemoBeat | null = null;
  private clockOffset: number | null = null;

  private constructor(
    readonly ctx: AudioContext,
    worklet: AudioWorkletNode,
  ) {
    this.hopRate = ctx.sampleRate / HOP_SIZE;
    this.bus = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;

    // Some browsers only process nodes that lead to the destination — route through a muted gain.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    this.bus.connect(this.analyser).connect(sink);
    this.bus.connect(worklet).connect(sink);
    sink.connect(ctx.destination);

    worklet.port.onmessage = (e: MessageEvent<HopFrame>) => this.onHop?.(e.data);
  }

  static async create(): Promise<AudioEngine> {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(workletUrl);
    const worklet = new AudioWorkletNode(ctx, 'band-energy', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    await ctx.resume();
    return new AudioEngine(ctx, worklet);
  }

  get isDemo(): boolean {
    return this.demo !== null;
  }

  async useMicrophone(deviceId?: string | null): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        // All "voice call" processing off — it would squash the kicks.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 1 },
      },
    });
    this.releaseInput();
    this.stream = stream;
    this.source = this.ctx.createMediaStreamSource(stream);
    this.source.connect(this.bus);

    const track = stream.getAudioTracks()[0];
    this.inputLabel = track?.label || 'Mikrofon';
    this.deviceId = track?.getSettings().deviceId ?? null;
    if (track) track.onended = () => this.onInputLost?.();
  }

  useDemo(bpm = 128): void {
    this.releaseInput();
    this.demo = new DemoBeat(this.ctx, bpm);
    this.demo.connect(this.bus, this.ctx.destination);
    this.demo.start();
    this.inputLabel = `Demo-Beat ${bpm} BPM`;
  }

  async listMicrophones(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== '');
  }

  /**
   * Smooth audio-clock time for rendering. `currentTime` advances in render-quantum steps,
   * so we extrapolate with performance.now() and slowly correct towards the audio clock.
   */
  now(): number {
    const perf = performance.now() / 1000;
    const audio = this.ctx.currentTime;
    if (this.clockOffset === null || Math.abs(audio - (perf + this.clockOffset)) > 0.25) {
      this.clockOffset = audio - perf;
    } else {
      this.clockOffset += (audio - (perf + this.clockOffset)) * 0.05;
    }
    return perf + this.clockOffset;
  }

  async close(): Promise<void> {
    this.releaseInput();
    await this.ctx.close();
  }

  private releaseInput(): void {
    this.demo?.stop();
    this.demo = null;
    this.source?.disconnect();
    this.source = null;
    if (this.stream) {
      for (const t of this.stream.getTracks()) {
        t.onended = null;
        t.stop();
      }
    }
    this.stream = null;
    this.deviceId = null;
  }
}
