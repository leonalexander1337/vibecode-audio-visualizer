// Post pass with feedback: glitch, red ghosting, datamosh, trails, strict B/W/red palette.
// Its output is also next frame's uPrev.

uniform sampler2D uScene;
uniform sampler2D uPrev;
uniform float uGlitch;    // 0..1
uniform float uMosh;      // 0..1, share of blocks that smear
uniform float uMoshSeed;
uniform float uFeedback;  // 0..1, trail strength

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

  vec3 col = texture(uScene, guv).rgb;

  // Red ghost: luminance shifted sideways lands in the red channel only
  float split = 0.0015 + 0.01 * uKick + 0.03 * uGlitch;
  col.r = max(col.r, dot(texture(uScene, guv + vec2(split, 0.0)).rgb, LUMA));

  // Datamosh: blocks keep dragging last frame's pixels along a fixed motion vector
  vec2 mgrid = uRes / 24.0;
  vec2 mb = floor(uv * mgrid);
  float moshing = step(1.0 - uMosh, hash21(mb * 0.73 + uMoshSeed * 101.0));
  vec2 flow = vec2(cos(uMoshSeed * TAU), sin(uMoshSeed * TAU)) * 0.25;
  vec2 mv = (vec2(hash21(mb + uMoshSeed * 13.0), hash21(mb.yx + uMoshSeed * 29.0)) - 0.5) * 0.6 + flow;
  vec3 prev = texture(uPrev, uv - mv / mgrid).rgb;
  col = mix(col, prev, moshing * 0.97);

  // Trails
  col = max(col, texture(uPrev, uv).rgb * uFeedback);

  // Strict palette: everything that is not clearly red becomes grey
  float l = dot(col, LUMA);
  float redness = clamp(col.r - max(col.g, col.b), 0.0, 1.0);
  col = mix(vec3(l), RED * col.r, redness);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
