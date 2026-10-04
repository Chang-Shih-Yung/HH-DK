"use client";

import { useEffect, useRef } from "react";
import { BREAKPOINT_NAV } from "@/lib/config";
import { LOCATION, NAV } from "@/lib/content";
import { getScroller, lockScroll } from "@/lib/scroll";
import { setUI, useUI } from "@/lib/store";
import { NavItem } from "./NavItem";
import { ModeToggle, SoundToggle, TiltToggle } from "./Toggles";

const ITEMS = [{ id: "top", label: "HOME", aria: "Home" }, ...NAV];
const close = () => setUI({ menuOpen: false });

// Full-screen menu for phones and small tablets. Opaque, so the 3D scene underneath is
// paused while it is open. Escape closes it; focus cannot leave the header and the menu.
export function MobileMenu() {
  const open = useUI((s) => s.menuOpen);
  const tilt = useUI((s) => s.tilt);
  const soundError = useUI((s) => s.soundError);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lockScroll(open);
    const scroller = getScroller();
    if (scroller) scroller.inert = open;
    if (!open) return;
    const menu = panel.current!;
    menu.querySelector("a")?.focus({ preventScroll: true });
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-controls="menu"]');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      const controls = [trigger, ...menu.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')].filter((el): el is HTMLElement => Boolean(el));
      const at = controls.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      controls[(at + (e.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (menu.contains(document.activeElement)) trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  // Leaving the phone layout (rotation, resize) closes the menu.
  useEffect(() => {
    const wide = matchMedia(`(min-width: ${BREAKPOINT_NAV + 1}px)`);
    const onChange = () => wide.matches && close();
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      id="menu"
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={!open}
      // Visibility flips at once on open (so focus can move in) and only after the fade on close.
      className={`fixed inset-0 z-40 flex flex-col justify-center bg-bg px-inset md:hidden ${
        open
          ? "visible opacity-100 [transition:opacity_300ms]"
          : "invisible opacity-0 [transition:opacity_300ms,visibility_0s_300ms]"
      }`}
    >
      <nav aria-label="Main navigation" className="flex flex-col items-start text-[10svw] leading-[1.3]">
        {ITEMS.map((item) => (
          <NavItem key={item.id} href={`#${item.id}`} label={item.label} ariaLabel={item.aria} instant onClick={close} />
        ))}
      </nav>
      <p role="status" className="absolute inset-x-inset bottom-20 font-mono text-[11px] text-muted">
        {soundError ? "Sound couldn’t start. Tap SOUND to try again." : tilt === "denied" ? "Motion access wasn’t allowed. Touch still works." : tilt === "unavailable" ? "Tilt isn’t available in this browser." : ""}
      </p>
      <div className="absolute inset-x-inset bottom-[max(18px,env(safe-area-inset-bottom))] flex items-center justify-between text-[11px]">
        <span className="font-mono">{LOCATION.short}</span>
        <ModeToggle />
        <SoundToggle />
        <TiltToggle />
      </div>
    </div>
  );
}
