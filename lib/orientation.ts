export type Attitude = { beta: number; gamma: number; angle: number };
const delta = (a: number, b: number) => ((a - b + 540) % 360) - 180;
const bounded = (v: number) => Math.max(-1, Math.min(1, Math.abs(v) < 0.5 ? 0 : v / 22));

/** Small movement relative to the way the visitor holds the phone, in screen axes. */
export function screenTilt(current: Attitude, baseline: Attitude) {
  const radians = current.angle * Math.PI / 180;
  const x = delta(current.gamma, baseline.gamma);
  const y = delta(current.beta, baseline.beta);
  return {
    x: bounded(x * Math.cos(radians) + y * Math.sin(radians)),
    y: bounded(y * Math.cos(radians) - x * Math.sin(radians)),
  };
}
