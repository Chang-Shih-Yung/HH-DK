"use client";

import Lenis from "lenis";
import { useEffect, useRef, type ReactNode } from "react";
import { directionProgress, markDirty, rt } from "@/lib/runtime";
import { attachScroller, scrollToId } from "@/lib/scroll";
import { setUI, ui, useUI, type Section } from "@/lib/store";
import { addTask, wake } from "@/lib/ticker";

// Sections with a place in the document. The closing ("end") is the tail of the pinned
// direction sequence, so it is reached by progress, not by position.
const SECTIONS: Section[] = ["top", "edit", "street", "direction"];

// The page scrolls inside this fixed box, never the document, so the viewport (and with it
// the WebGL canvas) keeps one size while a phone's browser bars move. Lenis smooths the
// wheel on desktop; touch scrolling stays native and compositor-driven.
export function Scroller({ children }: { children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapper.current!;
    const inner = content.current!;
    const lenis = new Lenis({
      wrapper: el,
      content: inner,
      eventsTarget: el,
      autoRaf: false,
      smoothWheel: !ui().reduced,
      syncTouch: false,
      lerp: 0.11,
    });
    attachScroller(lenis, el);

    // Section geometry is measured here, on resize only; frames just read the numbers.
    const tops: number[] = [];
    const measure = () => {
      rt.w = el.clientWidth;
      rt.h = el.clientHeight;
      el.style.setProperty("--vh", `${rt.h}px`);
      SECTIONS.forEach((id, i) => (tops[i] = document.getElementById(id)?.offsetTop ?? 0));
      rt.heroH = document.getElementById("top")?.offsetHeight ?? rt.h;
      rt.dirTop = tops[3];
      rt.dirH = document.getElementById("direction")?.offsetHeight ?? rt.h;
      lenis.resize();
      rt.limit = Math.max(1, lenis.limit);
      onScroll();
    };

    const onScroll = () => {
      rt.scroll = lenis.scroll;
      rt.velocity = lenis.velocity;
      // The section whose top has passed the middle of the screen is the current one.
      const mark = rt.scroll + rt.h * 0.5;
      let index = 0;
      for (let i = 1; i < tops.length; i++) if (mark >= tops[i]) index = i;
      const section: Section = rt.dirH > 0 && directionProgress() > 0.7 ? "end" : SECTIONS[index];
      if (ui().section !== section) setUI({ section });
      markDirty();
      wake();
    };

    lenis.on("scroll", onScroll);
    const offVirtual = lenis.on("virtual-scroll", wake);
    const stopTask = addTask((now) => {
      lenis.raf(now);
      return lenis.isScrolling === "smooth";
    }, 0);

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(inner);
    measure();

    // Follow the motion preference without re-creating the scroller.
    let reduced = ui().reduced;
    const offReduced = useUI.subscribe((s) => {
      if (s.reduced === reduced) return;
      reduced = s.reduced;
      lenis.options.smoothWheel = !reduced;
    });

    // Keyboard scrolling should work before anything has focus; deep links land on their section.
    if (document.activeElement === document.body) el.focus({ preventScroll: true });
    if (location.hash.length > 1) scrollToId(location.hash.slice(1), true);

    return () => {
      offReduced();
      offVirtual();
      stopTask();
      observer.disconnect();
      attachScroller(null, null);
      lenis.destroy();
    };
  }, []);

  return (
    <div
      id="scroller"
      ref={wrapper}
      tabIndex={-1}
      className="no-scrollbar fixed inset-0 z-10 overflow-y-auto overflow-x-hidden overscroll-contain [overflow-anchor:none]"
    >
      <div ref={content} className="relative">
        {children}
      </div>
    </div>
  );
}
