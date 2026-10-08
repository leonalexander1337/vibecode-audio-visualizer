// RIDGES — stacked ridgelines in the style of the "Unknown Pleasures" cover. A noise landscape
// rolls towards you, one ridge per beat; its peaks sit off-centre, wander, and swell with the bass.
// Some ridges glow red.

const int ROWS = 40;

float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u) * 2.0 - 1.0;
}

float ridgeHeight(float x, float row) {
  // Peak position wanders across most of the width — never mirrored, rarely centred.
  float centre = 0.4 * sin(row * 0.41 + uSeed * 6.0) + 0.15 * sin(row * 0.13);
  float envelope = exp(-pow((x - centre) * 2.2, 2.0)) * 0.9 + 0.1;
  float n = 0.0;
  float amp = 0.6;
  float freq = 7.0;
  for (int o = 0; o < 3; o++) {
    n += abs(noise1(x * freq + row * 17.3 + float(o) * 5.1)) * amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return envelope * n;
}

void main() {
  vec2 uv = centeredUv();
  // Fill the whole 16:9 frame: lines run edge to edge, the rows span the full height.
  float halfWidth = 0.5 * uRes.x / uRes.y;
  float spacing = 1.0 / float(ROWS - 2);
  float roll = fract(uBeatTime);
  float base = floor(uBeatTime);
  float px = 1.5 / uRes.y;
  float flatEdges = smoothstep(halfWidth, halfWidth - 0.15, abs(uv.x)); // peaks calm down at the edges
  float amp = 0.1 + 0.22 * uBass + 0.12 * uKick;

  // Back to front: every ridge blacks out what lies below it, then draws its own line.
  vec3 col = vec3(0.0);
  for (int i = 0; i < ROWS; i++) {
    float fi = float(i) + roll;
    float id = float(i) - base; // a ridge keeps its shape while it rolls forward
    float curve = 0.5 - (fi - 0.5) * spacing + ridgeHeight(uv.x, id) * amp * flatEdges;
    float fade = smoothstep(0.0, 2.0, fi) * smoothstep(float(ROWS), float(ROWS) - 3.0, fi);
    if (uv.y < curve) col = vec3(0.0);
    float line = smoothstep(px * 1.5, 0.0, abs(uv.y - curve)) * fade;
    vec3 ink = hash11(id * 3.17 + floor(uSeed * 40.0)) > 0.93 ? RED * 1.3 : vec3(1.0);
    col = max(col, ink * line);
  }
  col *= 0.8 + 0.4 * uKick;

  fragColor = vec4(col, 1.0);
}
