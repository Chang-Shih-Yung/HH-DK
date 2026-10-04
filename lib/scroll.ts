// Imperative access to the page scroller for code outside React (links, shortcuts, menu).
import type Lenis from "lenis";
import { ui } from "./store";
import { wake } from "./ticker";

let lenis: Lenis | null = null;
let scroller: HTMLElement | null = null;

export function attachScroller(instance: Lenis | null, el: HTMLElement | null) {
  lenis = instance;
  scroller = el;
}

export function getScroller() {
  return scroller;
}

/** Scroll to a section id ("top" and "end" are the page edges) and move keyboard focus with it. */
export function scrollToId(id: string, immediate = false) {
  if (!scroller) return;
  const el = document.getElementById(id);
  const target = id === "top" ? 0 : id === "end" ? scroller.scrollHeight : el;
  if (target === null) return;
  const instant = immediate || ui().reduced;
  if (lenis) lenis.scrollTo(target, { immediate: instant, duration: 1.1, force: true });
  else {
    const top = typeof target === "number" ? target : target.offsetTop;
    scroller.scrollTo({ top, behavior: instant ? "instant" : "smooth" });
  }
  el?.focus({ preventScroll: true });
  history.replaceState(null, "", id === "top" ? location.pathname + location.search : `#${id}`);
  wake();
}

export function scrollBy(delta: number) {
  if (!scroller) return;
  if (lenis) lenis.scrollTo(lenis.targetScroll + delta, { immediate: ui().reduced, force: true });
  else scroller.scrollBy({ top: delta, behavior: ui().reduced ? "instant" : "smooth" });
  wake();
}

/** Used while the menu or a dialog is open. */
export function lockScroll(locked: boolean) {
  if (locked) lenis?.stop();
  else lenis?.start();
  if (scroller) scroller.style.overflowY = locked ? "hidden" : "";
}
