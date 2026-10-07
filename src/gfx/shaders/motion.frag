// Block matching like a video codec: for every 4×4 block of the current luminance frame, find
// where it was in the previous frame (±3 px). One output texel per block ("macroblock").
// Output RG = offset to the block's previous position, encoded as (offset / 6 + 0.5).

uniform sampler2D uLumaCur;
uniform sampler2D uLumaPrev;

const int BLOCK = 4;
const int RANGE = 3;

float lumaAt(sampler2D tex, ivec2 p) {
  return texelFetch(tex, clamp(p, ivec2(0), textureSize(tex, 0) - 1), 0).r;
}

void main() {
  ivec2 origin = ivec2(gl_FragCoord.xy) * BLOCK;
  float best = 1e9;
  float still = 0.0;
  vec2 bestOffset = vec2(0.0);
  for (int dy = -RANGE; dy <= RANGE; dy++) {
    for (int dx = -RANGE; dx <= RANGE; dx++) {
      float cost = 0.0;
      for (int y = 0; y < BLOCK; y++) {
        for (int x = 0; x < BLOCK; x++) {
          ivec2 p = origin + ivec2(x, y);
          cost += abs(lumaAt(uLumaCur, p) - lumaAt(uLumaPrev, p + ivec2(dx, dy)));
        }
      }
      cost += 0.01 * float(dx * dx + dy * dy); // prefer small motion
      if (dx == 0 && dy == 0) still = cost;
      if (cost < best) {
        best = cost;
        bestOffset = vec2(dx, dy);
      }
    }
  }
  // Noise gate: a dark, noisy webcam must not make everything crawl.
  if (still - best < 0.3) bestOffset = vec2(0.0);
  fragColor = vec4(bestOffset / float(2 * RANGE) + 0.5, 0.0, 1.0);
}
