// FRACTAL — kaleidoscopic IFS (folded, rotated box fractal). Fold angles and scale breathe
// with the beat, the camera orbits once every 16 bars and lunges in on kicks.

mat2 gR1;
mat2 gR2;
float gScale;
vec3 gOffset;
float gTrap;

float de(vec3 p) {
  float s = 1.0;
  gTrap = 1e9;
  for (int i = 0; i < 6; i++) {
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p.xy *= gR1;
    p.xz *= gR2;
    p = p * gScale - gOffset * (gScale - 1.0);
    s *= gScale;
    if (i < 4) gTrap = min(gTrap, length(p.yz) / s);
  }
  return sdBox(p, vec3(1.0)) / s;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * de(p + e.xyy) + e.yyx * de(p + e.yyx) +
    e.yxy * de(p + e.yxy) + e.xxx * de(p + e.xxx));
}

void main() {
  vec2 uv = centeredUv();

  // Fold rotations beyond ~0.25 rad make the set fall apart into dust — keep them small.
  gScale = 2.0 + 0.12 * sin(beatAngle(16.0)) + 0.06 * uBass;
  gOffset = vec3(1.0, 0.7 + 0.3 * hash11(uSeed * 9.0), 0.45 + 0.4 * hash11(uSeed * 3.0));
  gR1 = rot(0.18 * sin(beatAngle(64.0) + uSeed * TAU));
  gR2 = rot(0.12 * cos(beatAngle(48.0) + uSeed * 4.0) + 0.04 * uKick);

  float a = beatAngle(64.0);
  // Every other 8-bar variant flies close in, filling the screen with structure.
  float dist = mix(3.6, 2.2, mod(uVariant, 2.0)) - 0.4 * uKick - 0.6 * uDrop;
  vec3 ro = vec3(sin(a) * dist, 1.3 * sin(a * 0.7), cos(a) * dist);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.6 * fw);

  float t = 0.0;
  float minD = 1e9;
  float steps = 0.0;
  bool hit = false;
  // Step budget is tight on purpose: integrated GPUs (Iris Xe) must survive this at 1080p.
  for (int i = 0; i < 72; i++) {
    float d = de(ro + rd * t);
    minD = min(minD, d);
    steps = float(i);
    if (d < 0.001 * t) {
      hit = true;
      break;
    }
    t += d * 0.9;
    if (t > 9.0) break;
  }

  vec3 col = vec3(0.0);
  if (hit) {
    vec3 p = ro + rd * t;
    float trap = gTrap;
    vec3 n = calcNormal(p);
    float ao = 1.0 - steps / 72.0;
    ao *= ao;
    float diff = max(dot(n, normalize(vec3(0.5, 0.8, 0.3))), 0.0);
    float rim = pow(1.0 - abs(dot(n, rd)), 4.0);
    col = vec3((0.12 + 0.88 * diff) * ao + rim * 0.7);
    // Red veins: bands of the orbit trap, crawling outwards a quarter band per beat.
    float band = fract(trap * 25.0 - uBeatTime * 0.25);
    float redMask = smoothstep(0.8, 0.9, band) * smoothstep(1.0, 0.95, band);
    col = mix(col, RED * (0.8 + 1.2 * ao), redMask * (0.6 + 0.4 * uKick));
    col *= exp(-max(t - 2.0, 0.0) * 0.25);
  } else {
    col = vec3(0.7) * exp(-minD * 18.0) * 0.35;
  }
  col *= 0.8 + 0.45 * uKick;

  fragColor = vec4(col, 1.0);
}
