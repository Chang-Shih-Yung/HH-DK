"use client";

import Lenis from "lenis";
import { useEffect, useRef, type ReactNode } from "react";
import { directionProgress, markDirty, rt } from "@/lib/runtime";
import { attachScroller, scrollToId } from "@/lib/scroll";
import { setUI, ui, useUI, type Section } from "@/lib/store";
import { addTask, wake } from "@/lib/ticker";

const SECTIONS: Section[] = ["top", "edit", "street", "direction"];

// Phones use the browser's compositor-driven momentum scroll, without a JS smoothing
// engine. Lenis is confined to desktop wheel input. Both feed the same scene state.
export function Scroller({ children }: { children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapper.current!;
    const inner = content.current!;
    const lifetime = new AbortController();
    const native = matchMedia("(pointer: coarse), (max-width: 600px)").matches;
    const lenis = native ? null : new Lenis({
      wrapper: el, content: inner, eventsTarget: el, autoRaf: false,
      smoothWheel: !ui().reduced, syncTouch: false, lerp: 0.11,
    });
    attachScroller(lenis, el);
    el.dataset.scrollMode = native ? "native" : "smooth";
    const tops: number[] = [];
    let lastScrollAt = performance.now();
    let needsMeasure = false;
    let settled: ReturnType<typeof setTimeout> | undefined;
    const settle = () => { rt.velocity = 0; markDirty(); wake(); };

    const onScroll = () => {
      // Resize can clamp the native scroll offset before ResizeObserver runs. Keep the
      // previous logical position until the new geometry has restored its progress.
      if (needsMeasure) return;
      const now = performance.now();
      const next = lenis ? lenis.scroll : el.scrollTop;
      rt.velocity = lenis ? lenis.velocity : (next - rt.scroll) * 16.67 / Math.max(16.67, now - lastScrollAt);
      rt.scroll = next;
      lastScrollAt = now;
      const mark = next + rt.h * 0.5;
      let index = 0;
      for (let i = 1; i < tops.length; i++) if (mark >= tops[i]) index = i;
      const section: Section = rt.dirH > 0 && directionProgress() > 0.7 ? "end" : SECTIONS[index];
      if (ui().section !== section) setUI({ section });
      markDirty(); wake();
      if (native) {
        clearTimeout(settled);
        settled = setTimeout(settle, 120);
      }
    };
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const resized = rt.w > 0 && (rt.w !== w || rt.h !== h);
      const pinned = resized && rt.dirH > 0 && rt.scroll >= rt.dirTop;
      const progress = pinned ? directionProgress() : 0;
      const atEnd = rt.limit > 1 && rt.scroll >= rt.limit - 2;
      rt.w = w; rt.h = h;
      if (el.style.getPropertyValue("--vh") !== `${h}px`) el.style.setProperty("--vh", `${h}px`);
      SECTIONS.forEach((id, i) => (tops[i] = document.getElementById(id)?.offsetTop ?? 0));
      rt.heroH = document.getElementById("top")?.offsetHeight ?? h;
      rt.dirTop = tops[3];
      rt.dirH = document.getElementById("direction")?.offsetHeight ?? h;
      lenis?.resize();
      rt.limit = Math.max(1, lenis ? lenis.limit : el.scrollHeight - h);
      if (pinned || atEnd) {
        const target = atEnd ? rt.limit : rt.dirTop + progress * (rt.dirH - h);
        if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
        else el.scrollTop = target;
      }
      needsMeasure = false;
      onScroll();
    };

    window.addEventListener("resize", () => { needsMeasure = true; wake(); }, { passive: true, signal: lifetime.signal });

    let stopTask: (() => void) | undefined;
    let offVirtual: (() => void) | undefined;
    if (lenis) {
      lenis.on("scroll", onScroll);
      offVirtual = lenis.on("virtual-scroll", wake);
      stopTask = addTask((now) => {
        if (needsMeasure) measure();
        lenis.raf(now); return lenis.isScrolling === "smooth";
      }, 0);
    } else {
      el.addEventListener("scroll", onScroll, { passive: true, signal: lifetime.signal });
      el.addEventListener("scrollend", settle, { passive: true, signal: lifetime.signal });
      stopTask = addTask(() => { if (needsMeasure) measure(); }, 0);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el); observer.observe(inner);
    measure();
    const offReduced = useUI.subscribe((state, previous) => {
      if (lenis && state.reduced !== previous.reduced) lenis.options.smoothWheel = !state.reduced;
    });
    if (document.activeElement === document.body) el.focus({ preventScroll: true });
    if (location.hash.length > 1) scrollToId(location.hash.slice(1), true);

    return () => {
      offReduced(); offVirtual?.(); stopTask?.(); lifetime.abort();
      clearTimeout(settled); observer.disconnect();
      attachScroller(null, null); lenis?.destroy();
    };
  }, []);

  return (
    <div id="scroller" ref={wrapper} tabIndex={-1}
      className="no-scrollbar fixed inset-0 z-10 overflow-y-auto overflow-x-hidden overscroll-contain [overflow-anchor:none]">
      <div ref={content} className="relative">{children}</div>
    </div>
  );
}
