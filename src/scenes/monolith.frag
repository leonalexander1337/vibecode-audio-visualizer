// MONOLITH — flight down a bending corridor of rotating frames. One frame passes per beat;
// pillars on both sides grow with the bass, some frames burn red.

const float CELL = 2.0;

float gMat; // 0 white frame, 1 red frame, 2 pillar

vec2 bend(float z) {
  return vec2(sin(z * 0.11), cos(z * 0.083)) * 1.4;
}

float sdFrame(vec3 p, vec3 b, float e) {
  p = abs(p) - b;
  vec3 q = abs(p + e) - e;
  return min(min(
    length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
    length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
    length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));
}

float map(vec3 p) {
  p.xy -= bend(p.z);

  // Frames
  float id = floor(p.z / CELL);
  vec3 q = p;
  q.z = mod(p.z, CELL) - 0.5 * CELL;
  float twist = 0.06 + 0.4 * hash11(uSeed * 17.0);
  q.xy *= rot(id * twist + beatAngle(64.0));
  float square = step(0.5, hash11(uSeed * 5.0 + 1.0));
  vec2 size = mix(vec2(1.6, 0.9), vec2(1.15, 1.15), square) * (1.0 + 0.12 * uKick);
  float isRed = step(0.78, hash11(id * 3.17 + floor(uSeed * 50.0)));
  float frame = sdFrame(q, vec3(size, 0.05), 0.025 + 0.02 * isRed);

  // Pillars, offset by half a cell
  vec3 r = p;
  float side = sign(r.x);
  r.x = abs(r.x) - 3.0;
  float pid = floor((p.z + 0.5 * CELL) / CELL);
  r.z = mod(p.z + 0.5 * CELL, CELL) - 0.5 * CELL;
  float h = 0.25 + 2.2 * hash11(pid * 1.37 + side * 11.0) * (0.3 + 0.7 * uBass);
  float pillar = sdBox(r, vec3(0.06, h, 0.06));

  gMat = frame < pillar ? isRed : 2.0;
  return min(frame, pillar);
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.002, -0.002);
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

void main() {
  vec2 uv = centeredUv();
  uv *= rot(0.2 * sin(beatAngle(32.0)) + uDrop * 0.4 * sin(uTime * 2.3));

  // Camera passes through a frame exactly on every beat.
  float camZ = (uBeatTime + 0.5) * CELL;
  vec3 ro = vec3(bend(camZ), camZ);
  vec3 ta = vec3(bend(camZ + 3.0), camZ + 3.0);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  float fov = 1.25 - 0.3 * uKick;
  vec3 rd = normalize(uv.x * rt + uv.y * up + fov * fw);

  float t = 0.05;
  float glowW = 0.0;
  float glowR = 0.0;
  float mat = -1.0;
  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    float g = 1.0 / (1.0 + d * d * 500.0);
    bool red = gMat > 0.5 && gMat < 1.5;
    glowW += red ? g * 0.1 : g;
    glowR += red ? g : 0.0;
    if (d < 0.0008 * t + 0.0004) {
      mat = gMat;
      break;
    }
    t += d * 0.7;
    if (t > 45.0) break;
  }

  vec3 col = vec3(0.0);
  if (mat >= 0.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float fres = pow(1.0 - abs(dot(n, rd)), 3.0);
    float diff = 0.35 + 0.65 * abs(dot(n, normalize(vec3(0.4, 0.8, -0.4))));
    vec3 base = mat > 1.5 ? vec3(0.45) : (mat > 0.5 ? RED * 1.6 : vec3(1.0));
    col = base * (diff + fres);
  }
  col *= exp(-t * 0.065);
  col += vec3(1.0) * glowW * 0.009 * (0.5 + uKick) + RED * glowR * 0.018 * (0.6 + uKick);
  col *= 0.8 + 0.5 * uKick;

  fragColor = vec4(col, 1.0);
}
