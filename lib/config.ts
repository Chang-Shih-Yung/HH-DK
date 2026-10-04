// Every tunable of the motion and 3D layer lives here, so look-and-feel changes never
// require touching the engine code.

export const BREAKPOINT_MOBILE = 600; // ≤ 600px: the phone layout (two grid columns)
export const BREAKPOINT_NAV = 800; // ≤ 800px: navigation collapses into the hamburger menu

export type Tier = "low" | "mid" | "high";

export const QUALITY: Record<Tier, { dpr: number; sim: number; stickers: number; texture: 640 | 1024 }> = {
  low: { dpr: 1.25, sim: 96, stickers: 3, texture: 640 },
  mid: { dpr: 1.5, sim: 128, stickers: 4, texture: 640 },
  high: { dpr: 2, sim: 192, stickers: 5, texture: 1024 },
};

/** Steps the adaptive monitor walks down when frames run long. */
export const DPR_STEPS = [2, 1.5, 1.25, 1];

export const HERO = {
  /** The first screen dissolves between these fractions of its own height. */
  dissolveStart: 0.025,
  dissolveEnd: 0.94,
  /** Halftone dot pitch in CSS pixels. */
  dotPitch: 6,
};

/**
 * The convex lens along the top and bottom of the screen: whatever passes through those
 * two bands bulges outward. `band` is each band's depth as a share of the screen height.
 * It is a little stronger while the page is moving.
 */
export const LENS = {
  strength: 0.065,
  boost: 0.025,
  band: 0.12,
};

export const RIPPLE = {
  /** Height added per pixel of pointer travel, and its ceiling. */
  drop: 0.0022,
  dropMax: 0.03,
  /** A press or tap leaves one deliberate ring. */
  tap: 0.05,
  damping: 0.968,
  /** How far the water bends the photograph, and how brightly the ripples catch the light. */
  refraction: 0.04,
  gloss: 0.02,
};

export const LOGO = {
  url: "/models/puff-low.bin.gz",
  bytes: 342348,
  vertices: 16006,
  bounds: [
    [-230.36841131786707, -211.3223588658285, -84.0120746857445],
    [333.05639544641826, 215.70072194256954, 83.97729265718598],
  ] as const,
  /** Design width of the artwork in its own units. */
  unit: 680,
  /** How far the glass bends what is behind it, in artwork units. */
  bend: 46,
  /** The brand red, and how much of it the glass skin carries: 0 neutral … 1 clearly tinted. */
  tint: "#ef3710",
  skin: 0.34,
  /** Optional red studio light along the lower-right edges. 0 = off. */
  tintRim: 0.004,
};

/** The light that follows the pointer over the 3D objects. Distances in CSS pixels. */
export const LAMP = {
  height: 210,
  range: 380,
  power: 0.72,
  /** How quickly it catches up with the pointer (share of the gap closed per frame at 60 fps). */
  follow: 0.16,
};

export type StickerKind = { src: string; w: number; h: number; mobileW: number; mobileH: number };

/**
 * The emblem pool: vector marks only. A few fall at a time and each one comes back as the
 * next design in this list, so the whole set shows without crowding the screen.
 * To add one: draw it in scripts/stickers.mjs (or drop a PNG in public/stickers) and add a line.
 */
export const STICKER_KINDS: StickerKind[] = [
  { src: "/stickers/sun.png", w: 96, h: 96, mobileW: 66, mobileH: 66 },
  { src: "/stickers/ticket.png", w: 68, h: 85, mobileW: 52, mobileH: 65 },
  { src: "/stickers/ring.png", w: 98, h: 98, mobileW: 66, mobileH: 66 },
  { src: "/stickers/boxed.png", w: 150, h: 41, mobileW: 106, mobileH: 29 },
  { src: "/stickers/badge-back.png", w: 78, h: 78, mobileW: 56, mobileH: 56 },
  { src: "/stickers/halftone.png", w: 84, h: 105, mobileW: 58, mobileH: 72 },
  { src: "/stickers/badge-front.png", w: 91, h: 91, mobileW: 63, mobileH: 63 },
  { src: "/stickers/pill.png", w: 44, h: 116, mobileW: 31, mobileH: 81 },
];

export const STICKERS = {
  gravity: 30, // px / s²
  drag: 0.42, // 1 / s  → terminal speed ≈ gravity / drag
  spinDrag: 0.5,
  restitution: 0.38,
  /** Collision radius as a share of the sticker's larger side, so stickers may overlap the logo a little. */
  bodyRadius: 0.4,
};

export const DIRECTION = {
  /** Pinned scroll distance of the closing sequence (arrow → heading → wordmark), in viewport heights. */
  travel: 2.4,
  headingOut: [0.50, 0.66] as const,
  brandIn: [0.76, 0.97] as const,
  streetIn: [0.66, 1.0] as const,
};

export const LOADER_LIMIT_MS = 3500;
