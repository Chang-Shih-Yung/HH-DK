"use client";

import { useEffect, useRef } from "react";
import { rt } from "@/lib/runtime";
import { BREAKPOINT_NAV } from "@/lib/config";
import { addTask } from "@/lib/ticker";

// Accent dot that trails the mouse and opens into a labelled ring over interactive pictures.
// Mouse only; it settles and then costs nothing until the pointer moves again.
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches) return;
    let x = rt.px;
    let y = rt.py;
    let shown = false;

    const onOver = (e: globalThis.PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.("[data-cursor]") as HTMLElement | null;
      const text = target?.dataset.cursor ?? "";
      dot.current?.toggleAttribute("data-target", Boolean(text));
      if (label.current) label.current.textContent = text;
    };
    document.addEventListener("pointerover", onOver, { passive: true });

    const stop = addTask((_, dt) => {
      const el = dot.current;
      if (!el) return;
      if (rt.w <= BREAKPOINT_NAV) {
        shown = false;
        el.style.opacity = "0";
        return false;
      }
      if (rt.pointerOn !== shown) {
        shown = rt.pointerOn;
        el.style.opacity = shown ? "1" : "0";
      }
      const ease = 1 - Math.pow(0.7, dt * 60);
      x += (rt.px - x) * ease;
      y += (rt.py - y) * ease;
      const far = Math.abs(rt.px - x) + Math.abs(rt.py - y) > 0.3;
      if (!far) {
        x = rt.px;
        y = rt.py;
      }
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      return far;
    });

    return () => {
      document.removeEventListener("pointerover", onOver);
      stop();
    };
  }, []);

  return (
    <div
      ref={dot}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] -m-[3px] hidden h-1.5 w-1.5 place-items-center rounded-full bg-accent opacity-0 transition-[width,height,margin,background-color] duration-200 data-[target]:-m-[31px] data-[target]:h-[62px] data-[target]:w-[62px] data-[target]:border data-[target]:border-white/50 data-[target]:bg-[rgb(15_16_18/0.78)] data-[target]:text-white md:[@media(pointer:fine)]:grid"
    >
      <span ref={label} className="font-mono text-[10px] tracking-[0.04em]" />
    </div>
  );
}
