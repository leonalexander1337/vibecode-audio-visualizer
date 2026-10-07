// KALEIDO — a Kaliset fractal folded through a kaleidoscope. Segment count and drift change
// every 8 bars, the whole thing turns once per 8 bars, rings fire on each beat.

vec2 kaleido(vec2 p, float n) {
  float seg = TAU / n;
  float a = atan(p.y, p.x) + seg * 0.5;
  a = abs(mod(a, seg) - seg * 0.5);
  return vec2(cos(a), sin(a)) * length(p);
}

void main() {
  vec2 uv = centeredUv();
  float r0 = length(uv);

  float n = 6.0 + 2.0 * mod(uVariant, 4.0);
  vec2 p = uv * rot(beatAngle(32.0));
  p = kaleido(p, n);
  p *= 0.9 + 0.3 * sin(beatAngle(64.0)) - 0.12 * uKick;
  p += vec2(0.25 + 0.15 * sin(beatAngle(48.0) + uSeed * TAU), 0.18 * cos(beatAngle(40.0)));

  vec2 c = vec2(
    0.62 + 0.12 * sin(beatAngle(96.0) + uSeed * 4.0),
    0.55 + 0.10 * cos(beatAngle(80.0) + uSeed * 2.0));

  float acc = 0.0;
  float redAcc = 0.0;
  vec2 z = p;
  for (int i = 0; i < 11; i++) {
    z = abs(z) / max(dot(z, z), 1e-4) - c;
    float m = length(z);
    acc += exp(-abs(m - 1.0) * (7.0 + 10.0 * uHigh));
    if (i > 5) redAcc += exp(-abs(z.x) * 12.0);
  }

  float v = smoothstep(0.5, 2.0, acc);
  vec3 col = vec3(v);
  float redMask = smoothstep(0.5, 1.4, redAcc);
  col = mix(col, RED * 1.5, redMask * (0.6 + 0.4 * uKick));

  // Beat ring travelling outwards
  float ringR = uBeat * 1.1;
  float ring = smoothstep(0.012, 0.0, abs(r0 - ringR)) * (1.0 - uBeat);
  col += RED * ring * (0.3 + uKick);

  col *= smoothstep(1.3, 0.25, r0);
  col *= 0.85 + 0.6 * uKick + 0.2 * uDrop;

  fragColor = vec4(col, 1.0);
}
