import { LENS } from "./config";
import { edgeLens } from "./edge-lens";
import { rt } from "./runtime";
import { getScroller } from "./scroll";
import { ui } from "./store";
import { addTask, wake } from "./ticker";

const SLICES = 12;
type Entry = {
  el: HTMLElement; img: HTMLImageElement; near: boolean; pending: boolean;
  top: number; left: number; w: number; h: number;
  url: string; overlay: HTMLElement | null; slices: HTMLElement[]; transforms: string[];
};

// The browser scrolls these small image strips with the page. Supported browsers drive
// their transforms with CSS view timelines; the fallback changes only strip transforms,
// never the picture's vertical position. Preparation runs in idle time ahead of view.
export function createMobileLens() {
  const root = getScroller();
  if (!root) return () => {};
  const listeners = new AbortController();
  const cssTimeline = CSS.supports("animation-timeline", "view()");
  const entries: Entry[] = [...root.querySelectorAll<HTMLElement>("[data-photo]")].map((el) => ({
    el, img: el.querySelector("img")!, near: false, pending: false,
    top: 0, left: 0, w: 1, h: 1, url: "", overlay: null, slices: [], transforms: [],
  }));
  const byElement = new Map(entries.map((e) => [e.el, e]));
  const queue = new Set<Entry>();
  let alive = true;
  let cancelIdle: (() => void) | undefined;
  let measured = "";
  let lastScroll = -1;
  let reduced = ui().reduced;

  function measure() {
    const boxes = entries.map((e) => e.el.getBoundingClientRect());
    const base = root!.getBoundingClientRect();
    // Batch reads before writes. This never runs in the scroll path.
    entries.forEach((e, i) => {
      e.top = boxes[i].top - base.top + root!.scrollTop;
      e.left = boxes[i].left - base.left;
      e.w = boxes[i].width; e.h = boxes[i].height;
    });
    for (const e of entries) if (e.overlay) styleSlices(e);
  }
  function styleSlices(e: Entry) {
    const cover = Math.max(e.w / e.img.naturalWidth, e.h / e.img.naturalHeight);
    const imageW = e.img.naturalWidth * cover, imageH = e.img.naturalHeight * cover;
    const focus = parseFloat(e.el.dataset.focus ?? "50") / 100;
    e.overlay!.style.setProperty("--lens-origin", `${rt.w / 2 - e.left}px`);
    e.overlay!.style.setProperty("--lens-peak", String(1 / (1 - LENS.strength * 0.85)));
    e.slices.forEach((slice, i) => {
      slice.style.backgroundSize = `${imageW}px ${imageH}px`;
      slice.style.backgroundPosition = `${(e.w - imageW) * focus}px ${(e.h - imageH) / 2 - e.h * i / SLICES}px`;
    });
    e.transforms = [];
  }
  function release(e: Entry) {
    queue.delete(e);
    e.overlay?.remove(); e.overlay = null; e.slices = []; e.transforms = []; e.url = "";
    delete e.el.dataset.domLens;
  }
  async function prepare(e: Entry) {
    if (!e.near || !e.img.complete || !e.img.naturalWidth || e.pending) return;
    const url = e.img.currentSrc || e.img.src;
    if (!url || e.url === url && e.overlay) return;
    e.pending = true;
    try {
      await e.img.decode();
      if (!alive || !e.near || url !== (e.img.currentSrc || e.img.src)) return;
      release(e);
      e.url = url;
      const overlay = e.overlay = document.createElement("span");
      overlay.className = "mobile-picture-lens";
      overlay.setAttribute("aria-hidden", "true");
      overlay.dataset.timeline = cssTimeline ? "css" : "js";
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < SLICES; i++) {
        const slice = document.createElement("i");
        slice.className = "mobile-picture-strip";
        slice.style.top = `${i / SLICES * 100}%`;
        slice.style.height = `calc(${100 / SLICES}% + 0.5px)`;
        slice.style.backgroundImage = `url(${JSON.stringify(url)})`;
        fragment.append(slice); e.slices.push(slice);
      }
      overlay.append(fragment);
      styleSlices(e);
      e.el.append(overlay);
      e.el.dataset.domLens = "on";
      lastScroll = -1;
      wake();
    } catch {
      // A failed/aborted decode leaves the real, accessible image on screen.
      release(e);
    } finally {
      e.pending = false;
      if (alive && e.near && url !== (e.img.currentSrc || e.img.src)) { queue.add(e); schedule(); }
    }
  }
  function schedule() {
    if (cancelIdle || !alive || queue.size === 0) return;
    const run = () => {
      cancelIdle = undefined;
      const e = queue.values().next().value as Entry | undefined;
      if (e) { queue.delete(e); void prepare(e); }
      schedule();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run);
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(run, 80);
      cancelIdle = () => clearTimeout(id);
    }
  }
  measure();
  measured = `${rt.w}:${rt.h}:${rt.limit}`;
  const observer = new IntersectionObserver((changes) => {
    for (const change of changes) {
      const e = byElement.get(change.target as HTMLElement)!;
      e.near = change.isIntersecting;
      if (e.near) { queue.add(e); schedule(); }
      else release(e);
    }
  }, { root, rootMargin: "100% 0px", threshold: 0 });
  for (const e of entries) {
    observer.observe(e.el);
    e.img.addEventListener("load", () => {
      if (e.url !== (e.img.currentSrc || e.img.src)) release(e);
      if (e.near) { queue.add(e); schedule(); }
    }, { signal: listeners.signal });
  }
  const stop = addTask(() => {
    const key = `${rt.w}:${rt.h}:${rt.limit}`;
    if (key !== measured) { measured = key; measure(); lastScroll = -1; }
    // View timelines follow native momentum without a JavaScript frame loop.
    if (cssTimeline) return;
    if (lastScroll === rt.scroll && reduced === ui().reduced) return;
    lastScroll = rt.scroll; reduced = ui().reduced;
    for (const e of entries) {
      if (!e.overlay || !e.near) continue;
      const y = e.top - rt.scroll;
      for (let i = 0; i < e.slices.length; i++) {
        const bend = edgeLens(e.left, e.w, y + (i + 0.5) * e.h / SLICES, rt.w, rt.h, reduced ? 0 : LENS.strength, LENS.band);
        const transform = Math.abs(bend.x) < 0.01 && Math.abs(bend.scale - 1) < 0.0001
          ? "none" : `translateX(${bend.x.toFixed(2)}px) scaleX(${bend.scale.toFixed(5)})`;
        if (e.transforms[i] !== transform) {
          e.slices[i].style.transform = transform;
          e.transforms[i] = transform;
        }
      }
    }
  });
  return () => {
    alive = false; observer.disconnect(); listeners.abort(); stop(); cancelIdle?.();
    entries.forEach(release);
  };
}
