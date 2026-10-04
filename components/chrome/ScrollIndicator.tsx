"use client";

import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { rt } from "@/lib/runtime";
import { getScroller, scrollBy, scrollToId } from "@/lib/scroll";
import { addTask, wake } from "@/lib/ticker";

// Draggable, keyboard-operable page position for mouse users. Touch devices keep the
// native scroll gesture and do not get this control.
export function ScrollIndicator() {
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLElement>(null);
  const drag = useRef({ active: false, grab: 0 });

  useEffect(() => {
    let scroll = -1;
    let limit = -1;
    let height = -1;
    return addTask(() => {
      if (!rail.current || !thumb.current || !track.current) return;
      if (rt.scroll === scroll && rt.limit === limit && rt.h === height) return;
      scroll = rt.scroll;
      limit = rt.limit;
      height = rt.h;
      const railH = rail.current.clientHeight;
      const size = Math.max(24, (railH * rt.h) / (rt.limit + rt.h));
      const progress = rt.limit > 0 ? rt.scroll / rt.limit : 0;
      thumb.current.style.height = `${size}px`;
      thumb.current.style.transform = `translateY(${progress * (railH - size)}px)`;
      track.current.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    });
  }, []);

  const seek = (clientY: number) => {
    const scroller = getScroller();
    if (!rail.current || !thumb.current || !scroller) return;
    const box = rail.current.getBoundingClientRect();
    const range = Math.max(1, box.height - thumb.current.offsetHeight);
    const progress = Math.min(1, Math.max(0, (clientY - box.top - drag.current.grab) / range));
    scroller.scrollTop = progress * rt.limit;
    wake();
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !thumb.current) return;
    const box = thumb.current.getBoundingClientRect();
    drag.current = { active: true, grab: e.clientY >= box.top && e.clientY <= box.bottom ? e.clientY - box.top : box.height / 2 };
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(e.clientY);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => drag.current.active && seek(e.clientY);
  const onUp = () => {
    drag.current.active = false;
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowDown: 80, ArrowUp: -80, PageDown: rt.h * 0.8, PageUp: -rt.h * 0.8 };
    if (e.key in steps) {
      e.preventDefault();
      scrollBy(steps[e.key]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      scrollToId(e.key === "Home" ? "top" : "end");
    }
  };

  return (
    <div
      ref={track}
      role="scrollbar"
      aria-label="Page position"
      aria-controls="scroller"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      tabIndex={0}
      data-scrollbar=""
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
      className="group pointer-events-auto fixed right-[3px] top-1/2 z-30 hidden h-[204px] w-6 -translate-y-1/2 touch-none items-center justify-center md:[@media(pointer:fine)]:flex"
    >
      <span ref={rail} className="relative block h-[200px] w-1.5 overflow-hidden rounded-full bg-[rgb(130_134_141/0.22)]">
        <i
          ref={thumb}
          className="absolute left-0 top-0 block min-h-6 w-1.5 rounded-full bg-fg opacity-70 group-hover:bg-accent group-hover:opacity-100 group-focus-visible:bg-accent group-focus-visible:opacity-100"
        />
      </span>
    </div>
  );
}
