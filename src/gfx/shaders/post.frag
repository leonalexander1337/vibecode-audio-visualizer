// Post pass with feedback: webcam composite and datamosh transitions, glitch, red ghosting,
// datamosh bursts, trails, B/W/red palette for the visuals. Its output is also next frame's uPrev.

uniform sampler2D uScene;
uniform sampler2D uPrev;
uniform sampler2D uMotion;      // per-macroblock motion of the transition target (motion.frag)
uniform sampler2D uTargetLuma;  // low-res luminance of the transition target (luma.frag)
uniform float uGlitch;          // 0..1
uniform float uMosh;            // 0..1, share of blocks that smear
uniform float uMoshSeed;
uniform float uFeedback;        // 0..1, trail strength
uniform float uCam;             // 0..1, how much the webcam owns the picture (also frees its colours)
uniform float uTrans;           // 1 while a webcam datamosh transition runs
uniform float uTransTarget;     // 1 = towards the webcam, 0 = back to the visuals
uniform float uProgress;        // 0..1 within the transition

const vec2 MOTION_RES = vec2(32.0, 18.0);
const vec2 LUMA_RES = vec2(128.0, 72.0);

vec3 hueRotate(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

// Trippy webcam look: complementary colours, solarised highlights, hue cycling with the beat,
// coarse colour steps. Dark stays dark, so a dark room stays a dark picture.
vec3 cameraLook(vec2 uv) {
  vec3 c = camExposed(uv);
  float l = dot(c, LUMA);
  vec3 chroma = (l - c) * 2.4;
  float folded = l < 0.5 ? 2.0 * l : 2.0 - 2.0 * l;
  vec3 col = clamp(vec3(mix(l, folded, 0.5)) + chroma, 0.0, 1.0);
  col = hueRotate(col, beatAngle(32.0) + uKick * 0.8);
  // Coarse colour steps; rounding down keeps near-black black.
  col = floor(clamp(col, 0.0, 1.0) * 4.99) / 4.0;
  col *= 0.85 + 0.15 * sin(uv.y * uRes.y * 1.4);
  return col;
}

vec3 transitionTarget(vec2 uv) {
  return uTransTarget > 0.5 ? cameraLook(uv) : texture(uScene, uv).rgb;
}

// Datamosh transition: the old picture (uPrev) is never refreshed, it only gets dragged along the
// new content's motion vectors and up its brightness gradient, and survives only inside the new
// content's bright shapes — so the visuals pull into the shape of a face (and back out into the
// cube). Then the new picture's edges bleed in like P-frame residue, finally the whole picture.
vec3 moshTransition(vec2 uv) {
  vec2 cell = (floor(uv * MOTION_RES) + 0.5) / MOTION_RES;
  vec2 offset = (texture(uMotion, cell).rg - 0.5) * 6.0 / LUMA_RES;

  vec2 px = 2.0 / LUMA_RES;
  float tl = texture(uTargetLuma, uv).r;
  vec2 grad = vec2(
    texture(uTargetLuma, uv + vec2(px.x, 0.0)).r - texture(uTargetLuma, uv - vec2(px.x, 0.0)).r,
    texture(uTargetLuma, uv + vec2(0.0, px.y)).r - texture(uTargetLuma, uv - vec2(0.0, px.y)).r);

  float p = uProgress;
  vec3 col = texture(uPrev, uv + offset * 1.6 - grad * 0.012).rgb;

  // Fade the old picture where the target is dark. Only a little per frame — it compounds, and
  // the old picture should linger long enough to visibly take on the target's shape.
  float shape = smoothstep(0.04, 0.4, tl);
  col *= mix(1.0, shape, 0.05 * smoothstep(0.0, 0.3, p));

  vec3 target = transitionTarget(uv);
  float edge = clamp(length(grad) * 5.0, 0.0, 1.0);
  col = max(col, target * edge * smoothstep(0.15, 0.6, p));
  return mix(col, target, smoothstep(0.6, 1.0, p));
}

vec3 palette(vec3 col) {
  float l = dot(col, LUMA);
  float redness = clamp(col.r - max(col.g, col.b), 0.0, 1.0);
  return mix(vec3(l), RED * col.r, redness);
}

void main() {
  vec2 uv = vUv;
  float tq = floor(uTime * 18.0);

  // Horizontal slice displacement
  float slices = floor(12.0 + 36.0 * hash11(tq * 0.37));
  float row = floor(uv.y * slices);
  float shift = step(1.0 - 0.45 * uGlitch, hash21(vec2(row, tq)))
    * (hash21(vec2(row + 3.1, tq)) - 0.5) * 0.3 * uGlitch;
  vec2 guv = uv + vec2(shift, 0.0);

  // Block swap
  vec2 grid = vec2(16.0, 9.0) * (1.0 + floor(hash11(tq + 1.7) * 3.0));
  vec2 blk = floor(uv * grid);
  if (hash21(blk + tq * 1.31) > 1.0 - 0.12 * uGlitch) {
    vec2 other = floor(vec2(hash21(blk + tq + 4.2), hash21(blk + tq + 9.1)) * grid);
    guv = (other + fract(uv * grid)) / grid;
  }
  guv = fract(guv);

  vec3 col;
  if (uTrans > 0.5) {
    col = moshTransition(guv);
  } else {
    col = texture(uScene, guv).rgb;
    // Red ghost: luminance shifted sideways lands in the red channel only
    float split = 0.0015 + 0.01 * uKick + 0.03 * uGlitch;
    col.r = max(col.r, dot(texture(uScene, guv + vec2(split, 0.0)).rgb, LUMA));
    if (uCam > 0.0) col = mix(col, cameraLook(guv), uCam);

    // Datamosh bursts: blocks keep dragging last frame's pixels along a fixed motion vector
    vec2 mgrid = uRes / 24.0;
    vec2 mb = floor(uv * mgrid);
    float moshing = step(1.0 - uMosh, hash21(mb * 0.73 + uMoshSeed * 101.0));
    vec2 flow = vec2(cos(uMoshSeed * TAU), sin(uMoshSeed * TAU)) * 0.25;
    vec2 mv = (vec2(hash21(mb + uMoshSeed * 13.0), hash21(mb.yx + uMoshSeed * 29.0)) - 0.5) * 0.6 + flow;
    col = mix(col, texture(uPrev, uv - mv / mgrid).rgb, moshing * 0.97);

    // Trails
    col = max(col, texture(uPrev, uv).rgb * uFeedback);
  }

  // The visuals stay strictly black/white/red; the webcam may keep its colours.
  col = mix(palette(col), col, uCam);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
