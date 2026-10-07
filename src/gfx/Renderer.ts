import type { FxFrame } from '../director/Director';
import { Program, createTarget, deleteTarget, type Target } from './gl';
import commonSource from './shaders/common.glsl?raw';
import vertexSource from './shaders/fullscreen.vert?raw';
import outputSource from './shaders/output.frag?raw';
import postSource from './shaders/post.frag?raw';

export interface SceneDef {
  name: string;
  fragment: string;
  /** Trail strength in the feedback pass, 0..1. */
  feedback: number;
  /** Extra resolution factor for expensive scenes, multiplied with renderScale. */
  resolution: number;
}

export interface SceneUniforms {
  time: number;
  beatTime: number;
  beat: number;
  barTime: number;
  kick: number;
  bass: number;
  mid: number;
  high: number;
  level: number;
  drop: number;
}

const ASPECT = 16 / 9;
const VERSION = '#version 300 es\n';

/**
 * Three passes per frame:
 *   1. scene  → sceneTarget              (at renderScale × viewport size)
 *   2. post   → feedback[next]           (reads scene + feedback[prev]: glitch, datamosh, trails)
 *   3. output → canvas, 16:9 letterboxed (strobe, invert, grain, blackout)
 */
export class Renderer {
  /** Fraction of the native viewport resolution the scene is rendered at. */
  renderScale = 1;
  viewport = { x: 0, y: 0, width: 1, height: 1 };
  internalWidth = 0;
  internalHeight = 0;

  private readonly gl: WebGL2RenderingContext;
  private scenePrograms: Program[] = [];
  private postProgram!: Program;
  private outputProgram!: Program;
  private vao: WebGLVertexArrayObject | null = null;
  private sceneTarget: Target | null = null;
  private feedback: Target[] = [];
  private current = 0;
  private cameraTex: WebGLTexture | null = null;
  private cameraAspect = 16 / 9;
  /**
   * Halved after every lost context. On Windows a too-slow frame triggers a GPU reset (TDR);
   * rendering the same load again would just lose the context again.
   */
  private safetyScale = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scenes: SceneDef[],
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error(
        'WebGL2 nicht verfügbar. Nach einem Grafiktreiber-Absturz sperrt Chrome WebGL bis zum Neustart: ' +
          'Browser komplett schließen und neu öffnen. Sonst Hardwarebeschleunigung in den Browser-Einstellungen prüfen.',
      );
    }
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => {
      this.safetyScale = Math.max(0.35, this.safetyScale * 0.5);
      this.init();
    });
    this.init();
  }

  /** Uploads the current webcam frame. Only call while the camera is on screen. */
  updateCamera(video: HTMLVideoElement): void {
    const gl = this.gl;
    if (gl.isContextLost() || video.videoWidth === 0) return;
    gl.bindTexture(gl.TEXTURE_2D, this.cameraTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    this.cameraAspect = video.videoWidth / video.videoHeight;
  }

  render(sceneIndex: number, u: SceneUniforms, fx: FxFrame, feedbackAmount: number): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    this.resize(this.scenes[sceneIndex].resolution);
    const scene = this.sceneTarget!;
    const prev = this.feedback[this.current];
    const next = this.feedback[1 - this.current];
    gl.bindVertexArray(this.vao);

    // 1. Scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.width, scene.height);
    const sceneProgram = this.scenePrograms[sceneIndex];
    sceneProgram.use();
    this.setShared(sceneProgram, u, fx, scene.width, scene.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 2. Post with feedback
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    const post = this.postProgram;
    post.use();
    this.setShared(post, u, fx, next.width, next.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prev.tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.cameraTex);
    post.set1i('uScene', 0);
    post.set1i('uPrev', 1);
    post.set1i('uCamTex', 2);
    post.set1f('uGlitch', fx.glitch);
    post.set1f('uMosh', fx.mosh);
    post.set1f('uMoshSeed', fx.moshSeed);
    post.set1f('uFeedback', feedbackAmount);
    post.set1f('uCam', fx.camera);
    post.set1f('uCamAspect', this.cameraAspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.current = 1 - this.current;

    // 3. Output, letterboxed
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const vp = this.viewport;
    gl.viewport(vp.x, vp.y, vp.width, vp.height);
    const out = this.outputProgram;
    out.use();
    this.setShared(out, u, fx, vp.width, vp.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, next.tex);
    out.set1i('uImage', 0);
    out.set1f('uStrobe', fx.strobe);
    out.set1f('uInvert', fx.invert);
    out.set1f('uBlackout', fx.blackout);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private init(): void {
    const gl = this.gl;
    const vert = VERSION + vertexSource;
    const frag = (body: string) => `${VERSION}${commonSource}\n${body}`;
    this.scenePrograms = this.scenes.map((s) => new Program(gl, vert, frag(s.fragment), s.name));
    this.postProgram = new Program(gl, vert, frag(postSource), 'post');
    this.outputProgram = new Program(gl, vert, frag(outputSource), 'output');
    this.vao = gl.createVertexArray();
    this.cameraTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.cameraTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Old targets died with the context (if any) — force reallocation.
    this.sceneTarget = null;
    this.feedback = [];
    this.internalWidth = this.internalHeight = 0;
  }

  /** Canvas at native device pixels; 16:9 viewport centered with black bars. */
  layout(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    let vw = w;
    let vh = Math.round(w / ASPECT);
    if (vh > h) {
      vh = h;
      vw = Math.round(h * ASPECT);
    }
    this.viewport = { x: Math.floor((w - vw) / 2), y: Math.floor((h - vh) / 2), width: vw, height: vh };
  }

  /** (Re)allocates the offscreen targets when the internal resolution changes. */
  private resize(sceneResolution: number): void {
    const gl = this.gl;
    this.layout();
    const scale = this.renderScale * sceneResolution * this.safetyScale;
    const iw = Math.max(16, Math.round(this.viewport.width * scale));
    const ih = Math.max(9, Math.round(this.viewport.height * scale));
    if (iw === this.internalWidth && ih === this.internalHeight && this.sceneTarget) return;

    if (this.sceneTarget) deleteTarget(gl, this.sceneTarget);
    for (const t of this.feedback) deleteTarget(gl, t);
    this.sceneTarget = createTarget(gl, iw, ih);
    this.feedback = [createTarget(gl, iw, ih), createTarget(gl, iw, ih)];
    this.internalWidth = iw;
    this.internalHeight = ih;
  }

  private setShared(p: Program, u: SceneUniforms, fx: FxFrame, width: number, height: number): void {
    p.set2f('uRes', width, height);
    p.set1f('uTime', u.time);
    p.set1f('uBeatTime', u.beatTime);
    p.set1f('uBeat', u.beat);
    p.set1f('uBarTime', u.barTime);
    p.set1f('uKick', u.kick);
    p.set1f('uBass', u.bass);
    p.set1f('uMid', u.mid);
    p.set1f('uHigh', u.high);
    p.set1f('uLevel', u.level);
    p.set1f('uDrop', u.drop);
    p.set1f('uSeed', fx.seed);
    p.set1f('uVariant', fx.variant);
  }
}
