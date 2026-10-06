"use client";

import { useUI } from "@/lib/store";

// Flat logo that holds the hero's centre until the 3D one has drawn (or if WebGL is unavailable).
export function FallbackLogo() {
  const ready = useUI((s) => s.sceneReady);
  return (
    <div
      aria-hidden="true"
      className={`absolute left-[8%] top-[28%] w-[83%] -rotate-[4deg] opacity-25 sm:left-[29%] sm:top-[34%] sm:w-[48%] ${ready ? "invisible" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a 2 KB decorative SVG, nothing to optimise */}
      <img src="/brand/square-model.svg" alt="" className="w-full brightness-0 invert" />
    </div>
  );
}
