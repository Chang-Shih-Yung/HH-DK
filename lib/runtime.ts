// Transient state: values that change every frame (scroll, pointer, viewport).
// They are plain mutable fields read inside the frame loop and never enter React state,
// so pointer moves and scrolling cause zero re-renders.

export const rt = {
  /** Viewport in CSS pixels. */
  w: 0,
  h: 0,
  /** Scroll position of the page scroller, its speed (px / frame) and its end. */
  scroll: 0,
  velocity: 0,
  limit: 1,
  /** Section geometry, measured on resize only. */
  heroH: 0,
  dirTop: 0,
  dirH: 0,
  /** Pointer in CSS pixels. `pointerOn` is false while it is off the page or the finger is lifted. */
  px: 0,
  py: 0,
  pointerOn: false,
  /** Set by a press or tap, consumed by the water simulation. */
  tap: false,
  /** Bumped whenever something a rendered frame depends on has changed. */
  dirty: true,
};

export function markDirty() {
  rt.dirty = true;
}

export const clamp = (v: number, min = 0, max = 1) => (v < min ? min : v > max ? max : v);
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Progress of the pinned "direction" section: 0 when it pins, 1 when it lets go. */
export const directionProgress = () => clamp((rt.scroll - rt.dirTop) / Math.max(1, rt.dirH - rt.h));
