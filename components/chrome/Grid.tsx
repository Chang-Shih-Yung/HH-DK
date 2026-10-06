import type { CSSProperties } from "react";
const COLUMNS = ["x1", "x2", "x3", "x4"] as const;
const ROWS = ["row1", "row2"] as const;
const at = (vars: Record<string, string>) => vars as CSSProperties;

// Straight viewport chrome above the scene, photographs and navigation. It never enters
// the lens shader or samples the glass, and requires no JavaScript or resize observer.
export function Grid() {
  return (
    <div className="grid-lines pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
      {COLUMNS.map(x => <i key={x} className={`grid-v ${x === "x3" ? "max-sm:hidden" : ""}`} style={at({"--x": `var(--${x})`})} />)}
      {ROWS.map(y => <i key={y} className="grid-h" style={at({"--y": `var(--${y})`})} />)}
      {COLUMNS.flatMap(x => ROWS.map(y => (
        <i key={x + y} className={`grid-mark ${x === "x3" ? "max-sm:hidden" : ""}`}
          style={at({"--x": `var(--${x})`, "--y": `var(--${y})`})} />
      )))}
    </div>
  );
}
