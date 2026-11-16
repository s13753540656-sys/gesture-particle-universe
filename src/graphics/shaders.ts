export const vertexShader = /* glsl */ `
attribute vec3 aTarget;
attribute float aSeed;
uniform float uTime;
uniform float uMorph;
uniform float uSpread;
uniform float uScale;
uniform float uSize;
uniform float uPixelRatio;
uniform float uExplosion;
uniform vec3 uAttractor;
varying float vSeed;
varying float vGlow;
void main() {
  vec3 p = mix(position, aTarget, uMorph);
  float burst = fract(uTime * 0.19 + aSeed * 0.16);
  p *= mix(1.0, 0.28 + pow(burst, 0.65) * 0.95, uExplosion);
  float wave = sin(uTime * 0.65 + aSeed * 25.0 + p.y * 1.4);
  p += normalize(p + vec3(0.001)) * (wave * 0.055 + uSpread * (0.5 + aSeed));
  p *= uScale;
  vec3 delta = uAttractor - p;
  float influence = exp(-dot(delta.xy, delta.xy) * 0.32) * uAttractor.z;
  p.xy += delta.xy * influence * 0.3;
  p.xy += vec2(-delta.y, delta.x) * influence * 0.42;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float spark = fract(aSeed * 17.3) > 0.985 ? 2.2 : 1.0;
  gl_PointSize = clamp(uSize * uPixelRatio * (0.65 + aSeed * 1.5) * spark * (6.0 / -mv.z), 1.0, 22.0);
  vSeed = aSeed;
  vGlow = 0.72 + 0.28 * sin(uTime * 1.3 + aSeed * 65.0);
}`;

export const fragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
varying float vSeed;
varying float vGlow;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;
  float halo = exp(-d * d * 24.0);
  float core = exp(-d * d * 160.0);
  vec3 color = vSeed < 0.5 ? mix(uColorA, uColorB, vSeed * 2.0) : mix(uColorB, uColorC, (vSeed - 0.5) * 2.0);
  gl_FragColor = vec4(color * (0.85 + core * 0.8), halo * vGlow * 0.8);
}`;
