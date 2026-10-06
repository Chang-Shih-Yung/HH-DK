/** Horizontal bending at fixed screen edges. Pictures do not acquire their own lens. */
export function edgeLens(left: number, width: number, y: number, viewportW: number, viewportH: number, strength: number, band: number) {
  const d = Math.max(0, Math.min(y, viewportH - y)) / Math.max(1, viewportH * band);
  const t = Math.min(1, d);
  const falloff = 1 - t * t * (3 - 2 * t);
  const lens = strength * falloff * falloff;
  const through = (x: number) => {
    const u = x / viewportW - 0.5;
    return (0.5 + u / (1 - lens * (0.55 + u * u * 1.3))) * viewportW;
  };
  const a = through(left), b = through(left + width);
  return { x: (a + b - width) / 2 - left, scale: (b - a) / Math.max(1, width) };
}
