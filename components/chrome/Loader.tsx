"use client";

import { useEffect, useRef } from "react";
import { LOADER_LIMIT_MS } from "@/lib/config";
import { setUI, useUI } from "@/lib/store";
import { wake } from "@/lib/ticker";
import { Wordmark } from "@/components/ui/Wordmark";

const enter = () => setUI({ entered: true });

// Covers the page until the 3D hero has drawn, but never for long: it lifts at the time
// limit, on SKIP, at once for reduced motion — and by CSS alone if scripts fail.
export function Loader() {
  const entered = useUI((s) => s.entered);
  const done = useUI((s) => s.sceneReady || s.sceneFailed || s.reduced ||
    ((s.section === "edit" || s.section === "street") && s.progress >= 0.94));
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const percent = useRef<HTMLSpanElement>(null);

  // Progress goes straight to the DOM; it is not worth a render per chunk.
  useEffect(() => {
    const paint = (value: number) => {
      if (bar.current) bar.current.style.transform = `scaleX(${value})`;
      if (percent.current) percent.current.textContent = String(Math.round(value * 100)).padStart(2, "0");
    };
    paint(useUI.getState().progress);
    return useUI.subscribe((s, prev) => s.progress !== prev.progress && paint(s.progress));
  }, []);

  useEffect(() => {
    const limit = setTimeout(enter, LOADER_LIMIT_MS);
    return () => clearTimeout(limit);
  }, []);

  useEffect(() => {
    if (done) enter();
  }, [done]);

  // Keep keyboard focus out of the covered page while the loader is up.
  useEffect(() => {
    const app = document.getElementById("app");
    if (app) app.inert = !entered;
    if (entered) {
      if (root.current?.contains(document.activeElement)) document.getElementById("scroller")?.focus({ preventScroll: true });
      wake();
    }
  }, [entered]);

  return (
    <div
      ref={root}
      role="status"
      aria-label="Loading HH:DK"
      data-done={entered}
      inert={entered}
      className="loader fixed inset-0 z-[200] grid place-items-center bg-ink text-cream"
    >
      <div className="w-[min(46vw,380px)]">
        <Wordmark />
      </div>
      <div className="absolute inset-x-gutter bottom-[65px] font-mono text-[11px]">
        <div className="mb-4 flex justify-between">
          <span>LOADING</span>
          <span ref={percent} aria-hidden="true">
            00
          </span>
        </div>
        <div className="h-px bg-[#383a3e]">
          <i ref={bar} className="block h-px origin-left scale-x-0 bg-cream transition-transform duration-300" />
        </div>
      </div>
      <button type="button" onClick={enter} className="absolute right-gutter top-8 min-h-11 font-mono text-xs">
        SKIP →
      </button>
    </div>
  );
}
