import * as THREE from "three";

// Per-frame values shared by the scene's components. Written once per frame by the driver
// (Scene.tsx) and read inside useFrame callbacks — never through React.
export const frame = {
  /** Seconds of scene time; only advances while the scene is drawing. */
  time: 0,
  dt: 1 / 60,
  heroOn: true,
  directionOn: false,
  /** 0 → 1 as the first screen dissolves. */
  dissolve: 0,
  /** A component sets this when an easing has not come to rest yet. */
  settling: false,
  /** Smoothed pointer tilt, shared by the logo and the arrow. */
  tiltX: 0,
  tiltY: 0,
  /** Where the logo sits in hero space (px, y down) and its scale; the sticker physics reads it. */
  logoX: 0,
  logoY: 0,
  logoScale: 1,
  /** The lamp's eased position on screen, in CSS pixels. */
  lampX: 0,
  lampY: 0,
  /** The hero's street texture, shared with the arrow while it sits beside the logo. */
  street: null as THREE.Texture | null,
  /** Set by the picture planes: is one of them on screen right now? */
  photosOnScreen: null as (() => boolean) | null,
  releasePhotos: null as (() => void) | null,
};

// Uniform objects shared by every material, so one write updates them all.
export const shared = {
  uDissolve: { value: 0 },
  uPitch: { value: 6 },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uLight: { value: 0 },
  // The lamp that follows the pointer, in drawing-buffer pixels (origin bottom-left).
  uLamp: { value: new THREE.Vector2(0, 0) },
  uLampHeight: { value: 240 },
  uLampRange: { value: 520 },
  uLampPower: { value: 1 },
  // Strength of the lens along the top and bottom of the screen.
  uLens: { value: 0.065 },
};
