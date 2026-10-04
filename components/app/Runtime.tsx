"use client";

import { useEffect } from "react";
import { QUALITY } from "@/lib/config";
import { detectTier } from "@/lib/quality";
import { markDirty, rt } from "@/lib/runtime";
import { scrollToId } from "@/lib/scroll";
import { setMode, setUI, ui } from "@/lib/store";
import { wake } from "@/lib/ticker";
import { mountTilt } from "@/lib/tilt";
import { mountAudioLifecycle, toggleSound } from "@/lib/audio";

// Page-wide wiring, registered once: device hints, the pointer, in-page links and
// keyboard shortcuts. Every listener here is passive or delegated, and none sets React state
// on a per-event basis.
export function Runtime() {
  useEffect(() => {
    const off = new AbortController();
    const offTilt = mountTilt();
    const offAudio = mountAudioLifecycle();
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void, passive = true) =>
      window.addEventListener(type, fn, { passive, signal: off.signal });

    // Device and preference hints.
    const tier = detectTier();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    setUI({ tier, dpr: Math.min(window.devicePixelRatio || 1, QUALITY[tier].dpr), reduced: reduced.matches });
    reduced.addEventListener("change", () => (setUI({ reduced: reduced.matches }), markDirty(), wake()), { signal: off.signal });

    // Pointer: mouse and pen through pointer events, fingers through touch events
    // (those keep reporting while the browser scrolls).
    const move = (x: number, y: number) => {
      rt.px = x;
      rt.py = y;
      rt.pointerOn = true;
      markDirty();
      wake();
    };
    on("pointermove", (e) => e.pointerType !== "touch" && move(e.clientX, e.clientY));
    on("pointerdown", (e) => {
      move(e.clientX, e.clientY);
      rt.tap = true;
    });
    on("touchmove", (e) => e.touches[0] && move(e.touches[0].clientX, e.touches[0].clientY));
    const leave = () => {
      rt.pointerOn = false;
      markDirty();
      wake();
    };
    on("touchend", leave);
    on("touchcancel", leave);
    on("blur", leave);
    document.documentElement.addEventListener("pointerleave", leave, { passive: true, signal: off.signal });

    // In-page links glide through the page scroller.
    document.addEventListener(
      "click",
      (e) => {
        const link = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
        if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (ui().menuOpen) setUI({ menuOpen: false });
        scrollToId(link.getAttribute("href")!.slice(1) || "top", link.dataset.jump === "instant");
      },
      { signal: off.signal },
    );

    // Shortcuts: T top · B bottom · D dark · L light · S sound.
    on(
      "keydown",
      (e) => {
        const target = e.target as HTMLElement;
        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        if (target.matches?.("input,textarea,[data-scrollbar]") || ui().menuOpen || ui().lightbox) return;
        const key = e.key.toLowerCase();
        if (key === "t") scrollToId("top");
        else if (key === "b") scrollToId("end");
        else if (key === "d") setMode("dark");
        else if (key === "l") setMode("light");
        else if (key === "s") toggleSound();
      },
      false,
    );

    return () => { off.abort(); offTilt(); offAudio(); };
  }, []);

  return null;
}
