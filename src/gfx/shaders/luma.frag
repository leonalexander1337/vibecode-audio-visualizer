// Low-res luminance of the transition target (webcam or visuals), input for motion estimation
// and for the "pull into shape" of the datamosh transition.

uniform sampler2D uScene;
uniform float uTransTarget;  // 1 = webcam, 0 = visuals

void main() {
  vec3 c;
  if (uTransTarget > 0.5) {
    c = camExposed(vUv);
  } else {
    // The scene is much larger than this target: average a few taps against aliasing.
    vec2 o = 0.35 / uRes;
    c = 0.25 * (texture(uScene, vUv + vec2(-o.x, -o.y)).rgb + texture(uScene, vUv + vec2(o.x, -o.y)).rgb +
                texture(uScene, vUv + vec2(-o.x, o.y)).rgb + texture(uScene, vUv + vec2(o.x, o.y)).rgb);
  }
  fragColor = vec4(vec3(dot(c, LUMA)), 1.0);
}
