// Final pass into the 16:9 viewport: invert, strobe, grain, vignette, blackout.
// Kept out of the feedback loop so flashes don't smear into following frames.

uniform sampler2D uImage;
uniform float uStrobe;    // 0..1 white flash
uniform float uInvert;    // 0..1
uniform float uBlackout;  // 0..1

void main() {
  vec3 col = texture(uImage, vUv).rgb;
  col = mix(col, 1.0 - col, uInvert);
  col = mix(col, vec3(1.0), uStrobe);

  col += (hash21(gl_FragCoord.xy + fract(uTime * 7.0) * 1000.0) - 0.5) * 0.045;
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.7;
  col *= 1.0 - uBlackout;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
