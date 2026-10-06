import { DIRECTION } from "./config";
import { smooth } from "./runtime";

/** Orthographic emblems stay behind even the far side of a turning wordmark. */
export const emblemDepth = (viewportWidth: number) => -Math.max(600, viewportWidth * 0.65);

/** Reversible scroll choreography: no repeated impulses or accumulated rotation. */
export function closingMotion(progress: number, index: number, still = false) {
  const turn = still ? 1 : smooth(0.60, 0.97, progress);
  const fling = still ? 1 : smooth(DIRECTION.brandIn[0] + 0.06, 0.95, progress);
  const arc = Math.sin(Math.PI * fling);
  return {
    turn,
    x: (index ? 1 : -1) * 0.19 * fling,
    y: index ? 0.16 * fling - 0.10 * arc : -0.22 * fling - 0.08 * arc,
    angle: (index ? 0.95 : -0.80) * fling,
  };
}
