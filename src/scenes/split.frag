// SPLIT — asymmetric Swiss-poster grid. The frame is cut recursively into unequal blocks: the
// big cuts change every bar, the small ones on every beat. Every block gets its own pattern,
// some burn red, random blocks invert on the kick.

float blockPattern(vec2 q, vec2 size, float kind, float h) {
  vec2 p = q * size; // aspect-correct coordinates inside the block
  if (kind < 1.0) { // bars scrolling up or down
    return step(0.5, fract(p.y * 18.0 - uBeatTime * (h > 0.5 ? 1.0 : -1.0)));
  }
  if (kind < 2.0) { // dot grid, dots swell with the bass
    vec2 g = fract(p * 14.0) - 0.5;
    return step(length(g), 0.15 + 0.25 * uBass);
  }
  if (kind < 3.0) { // diagonal hatching
    return step(0.6, fract((p.x + p.y) * 12.0 + uBeatTime * 0.5));
  }
  if (kind < 4.0) { // static
    return step(0.5, hash21(floor(p * 60.0) + floor(uTime * 20.0)));
  }
  if (kind < 5.0) { // concentric rectangles running outwards on the beat
    vec2 c = abs(q - 0.5) * size;
    return step(0.5, fract(max(c.x, c.y) * 10.0 - uBeatTime));
  }
  if (kind < 6.0) { // a single ring that kicks
    float r = length((q - 0.5) * size) / min(size.x, size.y);
    return smoothstep(0.02, 0.0, abs(r - 0.3 - 0.1 * uKick) - 0.04);
  }
  // empty block with a hairline frame
  vec2 e = min(q, 1.0 - q) * size;
  return step(min(e.x, e.y), 0.006);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  float bar = floor(uBeatTime / 4.0);
  float beat = floor(uBeatTime);

  // Recursive unequal cuts (a k-d tree). `id` encodes the path, so every block has its own identity.
  vec2 lo = vec2(0.0);
  vec2 hi = vec2(1.0);
  float id = 1.0;
  for (int i = 0; i < 7; i++) {
    float clock = i < 2 ? bar : beat;
    float h = hash11(id * 0.137 + clock * 1.618 + uSeed * 9.1);
    vec2 size = (hi - lo) * vec2(aspect, 1.0);
    if ((i >= 2 && h < 0.3) || min(size.x, size.y) < 0.08) break;
    bool vertical = size.x > size.y ? h > 0.25 : h > 0.75;
    float cut = mix(0.22, 0.78, hash11(id * 3.71 + clock * 0.73));
    if (vertical) {
      float x = mix(lo.x, hi.x, cut);
      if (uv.x < x) { hi.x = x; id = id * 2.0; } else { lo.x = x; id = id * 2.0 + 1.0; }
    } else {
      float y = mix(lo.y, hi.y, cut);
      if (uv.y < y) { hi.y = y; id = id * 2.0; } else { lo.y = y; id = id * 2.0 + 1.0; }
    }
  }

  vec2 size = (hi - lo) * vec2(aspect, 1.0);
  vec2 q = (uv - lo) / (hi - lo);
  float kind = floor(hash11(id * 9.13 + bar * 0.7 + uSeed) * 7.0);
  vec3 col = vec3(blockPattern(q, size, kind, hash11(id * 1.37 + beat * 0.31)));

  if (hash11(id * 5.3 + bar * 2.1) > 0.86) col = RED * (0.35 + 0.65 * col.r);
  if (hash11(id * 2.9 + beat) > 0.8) col = mix(col, vec3(1.0) - col, uKick);

  // Black gutters between the blocks
  vec2 e = min(q, 1.0 - q) * size;
  col *= step(0.004, min(e.x, e.y));
  col *= 0.75 + 0.35 * uKick;

  fragColor = vec4(col, 1.0);
}
