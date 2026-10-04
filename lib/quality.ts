import { BREAKPOINT_MOBILE, type Tier } from "./config";

type Hints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
};

/** A first guess from device hints; the frame-time monitor corrects it at runtime. */
export function detectTier(): Tier {
  const nav = navigator as Hints;
  const slow = nav.connection?.saveData || ["slow-2g", "2g"].includes(nav.connection?.effectiveType ?? "");
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  if (slow || cores <= 2 || memory <= 2) return "low";
  const handheld = matchMedia("(pointer: coarse)").matches || Math.min(innerWidth, innerHeight) <= BREAKPOINT_MOBILE;
  if (handheld || cores <= 4 || memory <= 4) return "mid";
  return "high";
}
