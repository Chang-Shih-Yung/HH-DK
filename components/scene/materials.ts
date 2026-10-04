import * as THREE from "three";
import { LOGO, RIPPLE } from "@/lib/config";
import { shared } from "./state";

const aspectOf = (texture: THREE.Texture | null) => {
  const image = texture?.image as { width: number; height: number } | undefined;
  return image ? image.width / image.height : 1.5;
};

// ── Shared GLSL ──────────────────────────────────────────────────────────────

// Halftone dissolve. Every hero material multiplies its alpha by this, so the whole first
// screen thins into dots and is gone, without a post-processing pass.
const COVER = /* glsl */ `
uniform float uDissolve;
uniform float uPitch;
float hhdkCover() {
  if (uDissolve <= 0.001) return 1.0;
  vec2 cell = fract(gl_FragCoord.xy / uPitch) - 0.5;
  float r = length(cell) * 1.41421;
  float radius = 1.1 - uDissolve * 1.3;
  float edge = 1.5 / uPitch;
  float dots = 1.0 - smoothstep(radius - edge, radius + edge, r);
  return dots * (1.0 - smoothstep(0.62, 1.0, uDissolve));
}
`;

// The lens along the top and bottom edges, for geometry (vertex stage) and for the
// full-screen backdrop (texture coordinates). Same curve in both.
const LENS_VERTEX = /* glsl */ `
uniform float uLens;
vec4 hhdkLens(vec4 clip) {
  vec2 p = clip.xy / clip.w;
  float d = 1.0 - abs(p.y);
  float band = 1.0 - smoothstep(0.0, 0.24, d);
  float lens = band * band * uLens;
  float x = p.x * 0.5;
  p.x /= 1.0 - lens * (0.55 + x * x * 1.3);
  p.y = sign(p.y) * (1.0 - d / (1.0 - lens * 0.3));
  return vec4(p * clip.w, clip.zw);
}
`;

const LENS_UV = /* glsl */ `
uniform float uLens;
vec2 hhdkLensUv(vec2 uv) {
  float band = 1.0 - smoothstep(0.0, 0.12, min(uv.y, 1.0 - uv.y));
  float lens = band * band * uLens;
  float edge = step(0.5, uv.y);
  float x = uv.x - 0.5;
  return vec2(0.5 + x * (1.0 - lens * (0.55 + x * x * 1.3)), edge + (uv.y - edge) * (1.0 - lens * 0.3));
}
`;

// The street photograph as the water shows it: nearly monochrome, very dark, cover-fitted.
const STREET = /* glsl */ `
uniform sampler2D uStreet;
uniform float uAspect;
uniform float uImageAspect;
uniform float uLight;
vec3 hhdkStreet(vec2 uv) {
  float ratio = uAspect / uImageAspect;
  if (ratio < 1.0) uv.x = (uv.x - 0.5) * ratio + 0.5;
  else uv.y = (uv.y - 0.5) / ratio + 0.5;
  // A steep curve: only the lights of the street survive, the rest sinks into the water.
  // sRGB textures are decoded by WebGL; applying gamma again crushed the street.
  vec3 city = texture2D(uStreet, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
  return mix(vec3(dot(city, vec3(0.2126, 0.7152, 0.0722))), city, 0.12);
}
vec3 hhdkTone(vec3 city, vec2 uv, float broad, float gloss) {
  float vignette = 1.0 - smoothstep(0.05, 0.7, length((uv - 0.5) * vec2(1.0, 0.8)));
  vec3 dark = mix(vec3(0.006, 0.008, 0.010), vec3(0.014, 0.018, 0.022), broad) + gloss;
  dark += city * (0.025 + 0.045 * vignette);
  vec3 light = mix(vec3(0.72, 0.71, 0.66), vec3(0.82, 0.81, 0.76), broad);
  light = mix(light, city * 0.62 + vec3(0.23, 0.22, 0.20), 0.38);
  return mix(dark, light, uLight);
}
`;

// Straight colour in, premultiplied sRGB out (the canvas is transparent over the page).
const OUTPUT = /* glsl */ `
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * alpha, alpha);
`;

const SCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── Water simulation (height field, one small off-screen pass) ───────────────

export function createSimMaterial(size: number) {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPrevious: { value: null as THREE.Texture | null },
      uTexel: { value: 1 / size },
      uPointer: { value: new THREE.Vector2(-2, -2) },
      uLast: { value: new THREE.Vector2(-2, -2) },
      uDrop: { value: 0 },
      uAspect: { value: 1 },
      uDamping: { value: RIPPLE.damping },
      uReset: { value: 0 },
    },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform sampler2D uPrevious;
uniform float uTexel, uDrop, uAspect, uDamping, uReset;
uniform vec2 uPointer, uLast;
float height(vec2 p) { return texture2D(uPrevious, p).r * 2.0 - 1.0; }
void main() {
  if (uReset > 0.5) { gl_FragColor = vec4(0.5, 0.5, 0.0, 1.0); return; }
  float h = height(vUv);
  float previous = texture2D(uPrevious, vUv).g * 2.0 - 1.0;
  float sum = height(vUv + vec2(uTexel, 0.0)) + height(vUv - vec2(uTexel, 0.0))
            + height(vUv + vec2(0.0, uTexel)) + height(vUv - vec2(0.0, uTexel));
  float next = (sum * 0.5 - previous) * uDamping;
  // The pointer draws a stroke from its last position, so fast moves leave no gaps.
  vec2 p = vUv * vec2(uAspect, 1.0), a = uLast * vec2(uAspect, 1.0), b = uPointer * vec2(uAspect, 1.0), ab = b - a;
  float along = clamp(dot(p - a, ab) / max(0.00001, dot(ab, ab)), 0.0, 1.0);
  float d = length(p - a - ab * along);
  next += exp(-d * d / 0.00038) * uDrop;
  float boundary = smoothstep(0.0, 0.035, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  next = clamp(next * boundary, -0.45, 0.45);
  gl_FragColor = vec4(next * 0.5 + 0.5, h * 0.5 + 0.5, 0.0, 1.0);
}`,
  });
}

// ── Hero background: the water surface over the street ───────────────────────

export function createBackdropMaterial(street: THREE.Texture, size: number) {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      ...shared,
      uDissolve: { value: 0 },
      uOpacity: { value: 1 },
      uWater: { value: null as THREE.Texture | null },
      uStreet: { value: street },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uImageAspect: { value: aspectOf(street) },
      uMotion: { value: 1 },
      uTexel: { value: 1 / size },
      uRefraction: { value: RIPPLE.refraction },
      uGloss: { value: RIPPLE.gloss },
    },
    vertexShader: SCREEN_VERTEX,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform sampler2D uWater;
uniform float uTime, uMotion, uTexel, uRefraction, uGloss, uOpacity;
${COVER}
${STREET}
${LENS_UV}
float water(vec2 uv) { return texture2D(uWater, uv).r * 2.0 - 1.0; }
float surface(vec2 p, float t) {
  return sin(p.x * 4.4 + sin(p.y * 4.1 + t) * 1.9 - t) * 0.06 + sin(p.y * 5.5 + sin(p.x * 2.8 - t) * 1.8 + t) * 0.04;
}
void main() {
  float alpha = hhdkCover() * uOpacity;
  if (alpha < 0.004) discard;
  vec2 uv = hhdkLensUv(vUv);
  vec2 p = uv * vec2(uAspect, 1.0);
  float t = uTime * 0.07 * uMotion;
  float broad = 0.5 + 0.5 * sin(p.x * 2.4 + p.y * 3.3 + sin(p.y * 4.1 + t) * 0.5 + t);
  vec2 grad = vec2(water(uv + vec2(uTexel, 0.0)) - water(uv - vec2(uTexel, 0.0)),
                   water(uv + vec2(0.0, uTexel)) - water(uv - vec2(0.0, uTexel)));
  vec2 flow = vec2(surface(p + vec2(0.003, 0.0), t) - surface(p - vec2(0.003, 0.0), t),
                   surface(p + vec2(0.0, 0.003), t) - surface(p - vec2(0.0, 0.003), t)) / 0.006;
  float gloss = pow(max(0.0, dot(normalize(vec3(flow * 0.22 + grad * 5.0, 1.0)), normalize(vec3(-0.4, 0.5, 0.85)))), 20.0);
  // Ripples read as light on their near slope and shade on the far one.
  float lean = dot(grad, vec2(-0.55, 0.75)) * 20.0;
  float slope = smoothstep(0.12, 1.1, lean) * 1.5 - smoothstep(0.12, 1.1, -lean) * 0.4;
  vec3 city = hhdkStreet(uv + flow * 0.002 + grad * uRefraction);
  vec3 color = hhdkTone(city, uv, broad, (gloss + slope) * uGloss);
  color = max(color, vec3(0.0));
  ${OUTPUT}
}`,
  });
}

// ── Glass: the inflated logo and the arrow ───────────────────────────────────
// No transmission pass. The backdrop is a known function, so the glass samples it
// directly at a refracted screen position. On top of that: a dim studio in the mirror
// direction, a lamp that follows the pointer, and a very light red in the glass itself.

export function createGlassMaterial(street: THREE.Texture | null, backdropMix: number, ownDissolve = false, emblemSlots = 0) {
  // At most five existing textures, sampled directly at refracted UVs. No second scene,
  // transmission buffer, texture copies or render pass; the arrow compiles without this.
  const emblemUniforms: Record<string, THREE.IUniform> = {};
  for (let i = 0; i < emblemSlots; i++) {
    emblemUniforms[`uEmblem${i}`] = { value: street };
    emblemUniforms[`uEmblemRect${i}`] = { value: new THREE.Vector4(-2, -2, 1, 1) };
    emblemUniforms[`uEmblemTurn${i}`] = { value: 0 };
  }
  emblemUniforms.uEmblemCount = { value: 0 };
  const emblems = Array.from({ length: emblemSlots }, (_, i) => `
    uniform sampler2D uEmblem${i};
    uniform vec4 uEmblemRect${i};
    uniform float uEmblemTurn${i};`).join("\n");
  const refractEmblems = Array.from({ length: emblemSlots }, (_, i) => `
    if (uEmblemCount > ${i}.5) {
      vec2 q = (uv - uEmblemRect${i}.xy) * uResolution;
      float c = cos(uEmblemTurn${i}), s = sin(uEmblemTurn${i});
      q = vec2(c*q.x + s*q.y, -s*q.x + c*q.y) / uEmblemRect${i}.zw + 0.5;
      if (all(greaterThan(q, vec2(0.0))) && all(lessThan(q, vec2(1.0)))) {
        vec4 ink = texture2D(uEmblem${i}, q);
        behind = mix(behind, ink.rgb, ink.a);
      }
    }`).join("\n");
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      ...shared,
      // The arrow dissolves on its own schedule, not with the hero.
      ...(ownDissolve ? { uDissolve: { value: 0 } } : null),
      uStreet: { value: street },
      uAspect: { value: 1 },
      uImageAspect: { value: aspectOf(street) },
      ...emblemUniforms,
      uBackdropMix: { value: backdropMix },
      uOpacity: { value: 1 },
      uBend: { value: new THREE.Vector2(0.03, 0.05) },
      uPage: { value: new THREE.Color("#0c0d0f") },
      uTint: { value: new THREE.Color(LOGO.tint) },
      uTintRim: { value: LOGO.tintRim },
      uSkin: { value: LOGO.skin },
      uSpecial: { value: new THREE.Color(LOGO.tint) },
      uPigmentNight: { value: 0 },
      uPigmentDay: { value: 0.9 },
    },
    vertexShader: /* glsl */ `
varying vec3 vNormal;
${LENS_VERTEX}
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = hhdkLens(projectionMatrix * modelViewMatrix * vec4(position, 1.0));
}`,
    fragmentShader: /* glsl */ `
varying vec3 vNormal;
uniform vec2 uResolution, uBend, uLamp;
uniform float uBackdropMix, uTintRim, uSkin, uLampHeight, uLampRange, uLampPower, uOpacity;
uniform vec3 uPage, uTint;
uniform vec3 uSpecial;
uniform float uPigmentNight, uPigmentDay;
uniform float uEmblemCount;
${emblems}
${COVER}
${STREET}
// A rectangular studio light seen in the mirror direction.
float card(vec3 r, vec3 dir, vec2 size, float soft) {
  float d = dot(r, dir);
  vec3 u = normalize(cross(vec3(0.0, 1.0, 0.0), dir));
  vec3 w = cross(dir, u);
  vec2 q = abs(vec2(dot(r, u), dot(r, w)) / max(d, 0.001));
  vec2 e = 1.0 - smoothstep(size - soft, size + soft, q);
  return e.x * e.y * step(0.0, d);
}
void main() {
  float alpha = hhdkCover() * uOpacity;
  if (alpha < 0.004) discard;
  vec3 n = normalize(vNormal);
  float facing = clamp(n.z, 0.0, 1.0);
  float edge = 1.0 - facing;
  float fresnel = 0.05 + 0.95 * pow(edge, 4.0);
  // The skin colour: white pulled a little towards the brand red.
  float rose = uSkin * mix(1.0, 1.8, uLight);
  vec3 skin = mix(vec3(1.0), vec3(1.0, 0.72, 0.68), rose);

  // What lies behind, bent by the surface; the glass is dense, so it darkens a little,
  // and it carries a trace of red that gathers towards the edges.
  vec2 screen = gl_FragCoord.xy / uResolution;
  vec2 uv = screen - n.xy * uBend * (0.35 + 0.65 * edge);
  vec3 behind = mix(uPage, hhdkTone(hhdkStreet(uv), uv, 0.5, 0.0), uBackdropMix);
  ${refractEmblems}
  vec3 body = behind * mix(0.96, 0.7, edge) * skin + uTint * rose * mix(0.014 + 0.035 * edge, 0.075, uLight);
  // Opaque pigment with a small amount of glass beneath, using the VIS special colour.
  float pigment = mix(uPigmentNight, uPigmentDay, uLight);
  body = mix(body, uSpecial * (0.36 + facing * 0.58), pigment);

  // The room in the mirror direction.
  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 room = vec3(0.12) + vec3(0.26) * smoothstep(-0.4, 1.0, r.y);
  room += vec3(0.8) * card(r, normalize(vec3(-0.5, 0.6, 0.62)), vec2(0.9, 0.6), 0.5);
  room += vec3(5.0) * card(r, normalize(vec3(-0.62, 0.74, -0.05)), vec2(0.95, 0.11), 0.085);
  room += vec3(2.6) * card(r, normalize(vec3(0.3, 0.92, 0.12)), vec2(1.2, 0.075), 0.065);
  room *= skin;
  room += uTint * 26.0 * uTintRim * card(r, normalize(vec3(0.7, -0.6, -0.08)), vec2(0.7, 0.05), 0.03);

  // The lamp: a point light hovering over the page at the pointer. It casts a pool of
  // light on the glass nearest to it, with a tight bright reflection inside; both travel
  // with the pointer and fade with distance.
  vec3 toLamp = vec3(uLamp - gl_FragCoord.xy, uLampHeight);
  float lampDistance = length(toLamp);
  vec3 l = toLamp / lampDistance;
  float reach = 1.0 / (1.0 + pow(lampDistance / uLampRange, 2.0));
  float nh = max(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0);
  float lamp = ((pow(nh, 55.0) * 0.38 + pow(nh, 240.0) * 0.55) * reach + max(dot(n, l), 0.0) * reach * reach * 0.17) * uLampPower;

  vec3 color = body * (1.0 - fresnel) + room * fresnel + vec3(1.0, 0.97, 0.94) * lamp;
  ${OUTPUT}
}`,
  });
}

// ── Stickers ─────────────────────────────────────────────────────────────────

export function createStickerMaterial(map: THREE.Texture, ownDissolve = false) {
  return new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { ...shared, ...(ownDissolve ? { uDissolve: { value: 0 } } : null), uMap: { value: map }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
${LENS_VERTEX}
void main() {
  vUv = uv;
  gl_Position = hhdkLens(projectionMatrix * modelViewMatrix * vec4(position, 1.0));
}`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uOpacity;
${COVER}
void main() {
  vec4 texel = texture2D(uMap, vUv);
  float alpha = texel.a * hhdkCover() * uOpacity;
  if (alpha < 0.004) discard;
  vec3 color = texel.rgb;
  ${OUTPUT}
}`,
  });
}

// ── Pictures ─────────────────────────────────────────────────────────────────
// On desktop the product and street pictures are drawn here, on finely divided planes, so
// that they really bend as they cross the lens bands. The texture is the very file the
// <img> already loaded, cover-fitted the same way.

export function createPhotoMaterial() {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uLens: shared.uLens,
      uMap: { value: null as THREE.Texture | null },
      uImageAspect: { value: 1 },
      uPlaneAspect: { value: 1 },
      uFocus: { value: 0.5 },
      uHover: { value: 0 },
    },
    vertexShader: /* glsl */ `
varying vec2 vUv;
${LENS_VERTEX}
void main() {
  vUv = uv;
  gl_Position = hhdkLens(projectionMatrix * modelViewMatrix * vec4(position, 1.0));
}`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uImageAspect, uPlaneAspect, uFocus, uHover;
void main() {
  vec2 uv = vUv;
  float ratio = uPlaneAspect / uImageAspect;
  if (ratio < 1.0) uv.x = (uv.x - 0.5) * ratio + clamp(uFocus, ratio * 0.5, 1.0 - ratio * 0.5);
  else uv.y = (uv.y - 0.5) / ratio + 0.5;
  uv = (uv - 0.5) / (1.0 + uHover * 0.018) + 0.5;
  gl_FragColor = texture2D(uMap, uv);
  #include <colorspace_fragment>
}`,
  });
}
