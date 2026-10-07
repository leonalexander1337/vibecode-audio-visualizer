// Shared header for every fragment shader (prepended at compile time).
precision highp float;

uniform vec2  uRes;       // render target size in px
uniform float uTime;      // seconds since start
uniform float uBeatTime;  // continuous beat counter
uniform float uBeat;      // phase within the current beat, 0..1
uniform float uBarTime;   // position within the bar, 0..4
uniform float uKick;      // kick pulse, 0..1
uniform float uBass;      // band levels, 0..1
uniform float uMid;
uniform float uHigh;
uniform float uLevel;
uniform float uDrop;      // drop envelope, 0..1
uniform float uSeed;      // random 0..1, re-rolled every 8 bars
uniform float uVariant;   // counter, +1 every 8 bars

in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const vec3 RED = vec3(1.0, 0.02, 0.05);
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Centered coordinates: y in [-0.5, 0.5], x scaled by aspect.
vec2 centeredUv() {
  return (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
}

// Angle that makes one full turn every `beats` beats.
float beatAngle(float beats) {
  return uBeatTime * TAU / beats;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
