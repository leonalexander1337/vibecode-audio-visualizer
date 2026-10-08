// MERCURY — liquid chrome. Six blobs drift on the beat grid, melt into each other and split
// again; the kick inflates them, the highs ripple the surface. They mirror a dark studio with
// white light bars and red strips, which is all the chrome look needs.

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
  float t = uBeatTime * 0.35;
  float d = 1e9;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec3 c = vec3(
      sin(t * (0.9 + 0.23 * fi) + fi * 1.7 + uSeed * 6.0),
      sin(t * (0.7 + 0.31 * fi) + fi * 2.9) * 0.75,
      cos(t * (0.8 + 0.17 * fi) + fi * 0.9)) * 1.35;
    float r = 0.42 + 0.12 * sin(fi * 3.1 + t * 2.0) + 0.14 * uKick + 0.08 * uBass;
    d = smin(d, length(p - c) - r, 0.55 + 0.25 * uMid);
  }
  return d + 0.015 * sin(p.x * 14.0 + uTime * 3.0) * sin(p.y * 13.0 - uTime * 2.0) * uHigh;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.002, -0.002);
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

// What the chrome reflects: horizontal light bars sweeping with the beat, two red strips.
vec3 studio(vec3 d) {
  float bars = smoothstep(0.86, 0.97, sin(d.y * 9.0 + beatAngle(16.0)));
  float floorGlow = exp(-abs(d.y + 0.35) * 6.0) * 0.25;
  float red = smoothstep(0.93, 1.0, sin(atan(d.x, d.z) * 2.0 - beatAngle(32.0)));
  return vec3(0.02) + vec3(bars * 0.95 + floorGlow) + RED * red * 1.4;
}

void main() {
  vec2 uv = centeredUv();
  float a = beatAngle(64.0);
  vec3 ro = vec3(sin(a) * 5.2, 0.6 * sin(a * 0.5), cos(a) * 5.2);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.7 * fw);

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 72; i++) {
    float d = map(ro + rd * t);
    if (d < 0.001) {
      hit = true;
      break;
    }
    t += d * 0.8;
    if (t > 12.0) break;
  }

  vec3 col;
  if (hit) {
    vec3 n = calcNormal(ro + rd * t);
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col = studio(reflect(rd, n)) * (0.55 + 0.45 * fres) + vec3(0.9) * fres * 0.25;
    col *= 0.85 + 0.5 * uKick;
  } else {
    col = studio(rd) * 0.06;
  }
  fragColor = vec4(col, 1.0);
}
