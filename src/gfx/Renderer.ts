import type { FxFrame } from '../director/Director';
import { Program, createTarget, deleteTarget, type Target } from './gl';
import cameraSource from './shaders/camera.glsl?raw';
import commonSource from './shaders/common.glsl?raw';
import vertexSource from './shaders/fullscreen.vert?raw';
import lumaSource from './shaders/luma.frag?raw';
import motionSource from './shaders/motion.frag?raw';
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
/** Must match LUMA_RES / MOTION_RES in post.frag (motion blocks are 4×4 luma pixels). */
const LUMA_SIZE = [128, 72] as const;
const MOTION_SIZE = [32, 18] as const;

/**
 * Passes per frame:
 *   1. scene  → sceneTarget              (at renderScale × viewport size)
 *   (during a webcam transition)
 *      luma   → luma[cur]                (128×72 luminance of the transition target)
 *      motion → motionTarget             (32×18 block-matching vectors, luma[cur] vs luma[prev])
 *   2. post   → feedback[next]           (scene/webcam + feedback[prev]: datamosh, glitch, trails)
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
  private lumaProgram!: Program;
  private motionProgram!: Program;
  private vao: WebGLVertexArrayObject | null = null;
  private sceneTarget: Target | null = null;
  private feedback: Target[] = [];
  private current = 0;
  private cameraTex: WebGLTexture | null = null;
  private cameraAspect = 16 / 9;
  private luma: Target[] = [];
  private lumaCurrent = 0;
  private motionTarget: Target | null = null;
  /** Transition target the luma history belongs to; null = history is stale. */
  private lumaTarget: number | null = null;
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
    // The smallest mip is the mean brightness → auto exposure in camera.glsl.
    gl.generateMipmap(gl.TEXTURE_2D);
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

    if (fx.camTransition) this.estimateMotion(u, fx, scene);
    else this.lumaTarget = null;

    // 2. Post with feedback
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    gl.viewport(0, 0, next.width, next.height);
    const post = this.postProgram;
    post.use();
    this.setShared(post, u, fx, next.width, next.height);
    this.bindTexture(0, scene.tex);
    this.bindTexture(1, prev.tex);
    this.bindTexture(2, this.cameraTex);
    this.bindTexture(3, this.motionTarget!.tex);
    this.bindTexture(4, this.luma[this.lumaCurrent].tex);
    post.set1i('uScene', 0);
    post.set1i('uPrev', 1);
    post.set1i('uCamTex', 2);
    post.set1i('uMotion', 3);
    post.set1i('uTargetLuma', 4);
    post.set1f('uGlitch', fx.glitch);
    post.set1f('uMosh', fx.mosh);
    post.set1f('uMoshSeed', fx.moshSeed);
    post.set1f('uFeedback', feedbackAmount);
    post.set1f('uCam', fx.camera);
    post.set1f('uCamAspect', this.cameraAspect);
    post.set1f('uTrans', fx.camTransition ? 1 : 0);
    post.set1f('uTransTarget', fx.camTransition === 'in' ? 1 : 0);
    post.set1f('uProgress', fx.camProgress);
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

  /**
   * Luminance of the transition target (webcam on the way in, visuals on the way out) and its
   * block motion against the previous frame. The first frame after a target switch has no
   * history yet, so both luma buffers get the same frame (= zero motion).
   */
  private estimateMotion(u: SceneUniforms, fx: FxFrame, scene: Target): void {
    const gl = this.gl;
    const target = fx.camTransition === 'in' ? 1 : 0;
    const fresh = this.lumaTarget !== target;
    this.lumaTarget = target;

    const luma = this.lumaProgram;
    luma.use();
    this.setShared(luma, u, fx, LUMA_SIZE[0], LUMA_SIZE[1]);
    this.bindTexture(0, scene.tex);
    this.bindTexture(2, this.cameraTex);
    luma.set1i('uScene', 0);
    luma.set1i('uCamTex', 2);
    luma.set1f('uCamAspect', this.cameraAspect);
    luma.set1f('uTransTarget', target);
    gl.viewport(0, 0, LUMA_SIZE[0], LUMA_SIZE[1]);
    this.lumaCurrent = 1 - this.lumaCurrent;
    for (const t of fresh ? this.luma : [this.luma[this.lumaCurrent]]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const motion = this.motionProgram;
    motion.use();
    this.bindTexture(0, this.luma[this.lumaCurrent].tex);
    this.bindTexture(1, this.luma[1 - this.lumaCurrent].tex);
    motion.set1i('uLumaCur', 0);
    motion.set1i('uLumaPrev', 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.motionTarget!.fbo);
    gl.viewport(0, 0, MOTION_SIZE[0], MOTION_SIZE[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bindTexture(unit: number, tex: WebGLTexture | null): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
  }

  private init(): void {
    const gl = this.gl;
    const vert = VERSION + vertexSource;
    const frag = (...parts: string[]) => `${VERSION}${commonSource}\n${parts.join('\n')}`;
    this.scenePrograms = this.scenes.map((s) => new Program(gl, vert, frag(s.fragment), s.name));
    this.postProgram = new Program(gl, vert, frag(cameraSource, postSource), 'post');
    this.outputProgram = new Program(gl, vert, frag(outputSource), 'output');
    this.lumaProgram = new Program(gl, vert, frag(cameraSource, lumaSource), 'luma');
    this.motionProgram = new Program(gl, vert, frag(motionSource), 'motion');
    this.vao = gl.createVertexArray();

    this.cameraTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.cameraTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);

    this.luma = [createTarget(gl, ...LUMA_SIZE), createTarget(gl, ...LUMA_SIZE)];
    this.motionTarget = createTarget(gl, ...MOTION_SIZE, gl.NEAREST);
    // Neutral motion (0.5, 0.5) until the first estimate.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.motionTarget.fbo);
    gl.clearColor(0.5, 0.5, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lumaTarget = null;

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
