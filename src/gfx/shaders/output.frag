// Final pass into the 16:9 viewport: invert, strobe, palette, grain, vignette, blackout.
// Kept out of the feedback loop so flashes and palette changes don't smear into later frames.

uniform sampler2D uImage;
uniform float uStrobe;    // 0..1 white flash
uniform float uInvert;    // 0..1
uniform float uBlackout;  // 0..1
uniform float uCam;       // 0..1 webcam share — it keeps its own colours
uniform vec3 uBg;         // palette: black →
uniform vec3 uFg;         //          white →
uniform vec3 uAccent;     //          red →

// Everything upstream is black/white/red; map it onto the chosen palette.
vec3 recolor(vec3 c) {
  float l = clamp(dot(c, LUMA), 0.0, 1.0);
  float redness = clamp((c.r - max(c.g, c.b)) / max(c.r, 0.001), 0.0, 1.0);
  vec3 mono = mix(uBg, uFg, l);
  vec3 accent = mix(uBg, uAccent, clamp(c.r, 0.0, 1.0));
  return mix(mono, accent, redness);
}

void main() {
  vec3 col = texture(uImage, vUv).rgb;
  col = mix(col, 1.0 - col, uInvert);
  col = mix(col, vec3(1.0), uStrobe);
  col = mix(recolor(col), col, uCam);

  col += (hash21(gl_FragCoord.xy + fract(uTime * 7.0) * 1000.0) - 0.5) * 0.045;
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.7;
  col *= 1.0 - uBlackout;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
