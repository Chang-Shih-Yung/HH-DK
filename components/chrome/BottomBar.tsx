"use client";

import { useEffect, useRef } from "react";
import { LOCATION } from "@/lib/content";
import { rt } from "@/lib/runtime";
import { sweep } from "@/lib/scramble";
import { ui, useUI } from "@/lib/store";
import { addTask } from "@/lib/ticker";
import { Globe } from "./Globe";

// The location line answers the scroll: at the end of the page it becomes the sign-off,
// and a short sweep of noise carries each change.
function LocationLabel() {
  const atEnd = useUI((s) => s.section === "end");
  const label = atEnd ? LOCATION.end : LOCATION.home;
  const text = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (text.current && !ui().reduced) sweep(text.current, label);
  }, [label]);

  return (
    <span className="flex items-center gap-2.5">
      <i className="h-[5px] w-[5px] rounded-full bg-accent" aria-hidden="true" />
      <span ref={text}>{label}</span>
    </span>
  );
}

// Pointer read-out for mouse users. Written straight to the node from the frame loop.
function Coords() {
  const text = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let x = -1;
    let y = -1;
    const pad = (n: number) => String(Math.round(n)).padStart(4, "0");
    return addTask(() => {
      if (!text.current || (rt.px === x && rt.py === y)) return;
      x = rt.px;
      y = rt.py;
      text.current.firstChild!.nodeValue = `${pad(x)} X ${pad(y)} Y`;
    });
  }, []);

  return (
    <span ref={text} aria-hidden="true" className="absolute left-1/2 hidden -translate-x-1/2 md:[@media(pointer:fine)]:block">
      0000 X 0000 Y
    </span>
  );
}

export function BottomBar() {
  const menuOpen = useUI((s) => s.menuOpen);
  return (
    <div
      className={`relative flex items-center justify-between px-inset pb-[max(18px,env(safe-area-inset-bottom))] text-[9px] transition-opacity duration-300 sm:pb-[22px] sm:text-[11px] ${
        menuOpen ? "invisible opacity-0" : ""
      }`}
    >
      <LocationLabel />
      <Coords />
      <a href="#top" aria-label="Back to top" data-cursor="TOP" className="pointer-events-auto -mr-1 grid h-11 w-10 place-items-center sm:w-12">
        <Globe />
      </a>
    </div>
  );
}
