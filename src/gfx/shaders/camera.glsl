// Webcam helpers shared by the luma and post passes (prepended after common.glsl).

uniform sampler2D uCamTex;  // webcam frame, mipmapped
uniform float uCamAspect;   // webcam width / height

// Cover-fit into the frame, mirrored like a selfie, punching in on the kick.
vec2 camUv(vec2 uv) {
  vec2 p = uv - 0.5;
  float frame = uRes.x / uRes.y;
  if (uCamAspect > frame) p.x *= frame / uCamAspect;
  else p.y *= uCamAspect / frame;
  p *= 1.0 - 0.08 * uKick;
  return vec2(0.5 - p.x, 0.5 - p.y);
}

// Auto exposure for dark rooms: the smallest mip level is the mean brightness.
float camGain() {
  float mean = dot(textureLod(uCamTex, vec2(0.5), 12.0).rgb, LUMA);
  return clamp(0.35 / max(mean, 0.02), 1.0, 7.0);
}

// Webcam with gain applied: sensor noise crushed *before* the gain (otherwise a dark room turns
// into a grey/purple haze), shadows lifted, highlights soft-clipped.
vec3 camExposed(vec2 uv) {
  vec3 c = texture(uCamTex, camUv(uv)).rgb;
  c = max(c - 0.035, 0.0) / 0.965;
  return 1.0 - exp(-c * camGain() * 1.4);
}
