"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { BREAKPOINT_MOBILE, LENS } from "@/lib/config";

const COLUMNS = ["x1", "x2", "x3", "x4"] as const;
const ROWS = ["row1", "row2"] as const;
const at = (vars: Record<string, string>) => vars as CSSProperties;
const GAP = 12;

// Fixed hairline grid above the page: one CSS pixel at 10% of the text colour.
// Rows and crossing marks are plain CSS. The column lines are one SVG path, because they
// pass through the lens bands at the top and bottom of the screen and bow outward there —
// the same curve the canvas applies to everything it draws. Redrawn on resize only.
export function Grid() {
  const frame = useRef<HTMLDivElement>(null);
  const lines = useRef<SVGPathElement>(null);

  useEffect(() => {
    const draw = () => {
      const box = frame.current;
      if (!box || !lines.current) return;
      const w = box.clientWidth;
      const h = box.clientHeight;
      const mobile = w <= BREAKPOINT_MOBILE;
      // Keep in step with --gutter, --row1 and --row2 in globals.css.
      const gutter = mobile ? 20 : Math.min(70, Math.max(24, w * 0.04));
      const columns = mobile ? [gutter, w / 2, w - gutter] : [gutter, gutter + (w - gutter * 2) / 3, gutter + ((w - gutter * 2) * 2) / 3, w - gutter];
      const rows = (mobile ? [0.26, 0.7] : [0.33, 0.68]).map((r) => Math.round(h * r));
      const band = h * LENS.band;

      // Where a line that truly sits at `x` appears at height `y`, seen through the lens.
      const through = (x: number, y: number) => {
        const d = Math.min(y, h - y) / h;
        const t = Math.min(1, Math.max(0, d / LENS.band));
        const fade = 1 - t * t * (3 - 2 * t);
        const lens = fade * fade * LENS.strength;
        const centre = x / w - 0.5;
        let u = centre;
        for (let i = 0; i < 3; i++) u = centre / (1 - lens * (0.55 + u * u * 1.3));
        return (u + 0.5) * w;
      };

      let d = "";
      for (const column of columns) {
        const x = Math.round(column) + 0.5;
        const spans = [
          [0, rows[0] - GAP],
          [rows[0] + GAP, rows[1] - GAP],
          [rows[1] + GAP, h],
        ];
        for (const [from, to] of spans) {
          d += `M${through(x, from).toFixed(2)} ${from}`;
          // Fine steps inside the bands, one straight stroke between them.
          for (let y = from + 6; y < to; y += 6) if (y < band || y > h - band) d += `L${through(x, y).toFixed(2)} ${y}`;
          d += `L${through(x, to).toFixed(2)} ${to}`;
        }
      }
      lines.current.setAttribute("d", d);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(frame.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className="grid-lines pointer-events-none fixed inset-0 z-20" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <path ref={lines} fill="none" stroke="var(--gl)" strokeWidth="1" />
      </svg>
      {ROWS.map((y) => (
        <i key={y} className="grid-h" style={at({ "--y": `var(--${y})` })} />
      ))}
      {COLUMNS.flatMap((x) =>
        ROWS.map((y) => (
          <i
            key={x + y}
            className={`grid-mark ${x === "x3" ? "max-sm:hidden" : ""}`}
            style={at({ "--x": `var(--${x})`, "--y": `var(--${y})` })}
          />
        )),
      )}
    </div>
  );
}
