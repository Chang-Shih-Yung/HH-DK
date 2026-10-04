"use client";

import { useEffect, useRef } from "react";
import { setUI, useUI } from "@/lib/store";

const bar = "absolute left-0 h-0.5 w-6 bg-fg transition-transform duration-500 ease-66";

// Two lines that cross into a close mark. Shown up to 800px wide.
export function MenuButton() {
  const open = useUI((s) => s.menuOpen);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Hand keyboard focus back when the menu closes.
  useEffect(() => {
    if (wasOpen.current && !open && document.getElementById("menu")?.contains(document.activeElement))
      button.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  return (
    <button
      ref={button}
      type="button"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="menu"
      onClick={() => setUI({ menuOpen: !open })}
      className="pointer-events-auto -mr-2 grid h-11 w-11 place-items-center md:hidden"
    >
      <span className="relative block h-6 w-6" aria-hidden="true">
        <span className={`${bar} top-1.5 ${open ? "translate-y-[5px] rotate-45" : ""}`} />
        <span className={`${bar} bottom-1.5 ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
      </span>
    </button>
  );
}
