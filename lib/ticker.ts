// One requestAnimationFrame loop for the whole page. Smooth scrolling, DOM effects and the
// WebGL scene run as ordered tasks inside the same callback, and the loop stops itself as
// soon as no task reports work, so an idle page costs nothing per frame.

/** Return true while the task still needs frames. */
export type Task = (now: number, dt: number) => boolean | void;

type Entry = { fn: Task; order: number };

let tasks: Entry[] = [];
let raf = 0;
let last = 0;

// `?capture` keeps the loop alive in a hidden document, for screenshot tools and automated
// browsers that render pages without ever showing them. Visitors never need it.
const capture = typeof location !== "undefined" && new URLSearchParams(location.search).has("capture");
const asleep = () => document.hidden && !capture;

function frame(now: number) {
  raf = 0;
  // After a sleep the first delta is a nominal frame; long frames are clamped.
  const dt = last ? Math.min(Math.max(now - last, 0) / 1000, 0.1) : 1 / 60;
  last = now;
  let busy = false;
  const current = tasks;
  for (let i = 0; i < current.length; i++) if (current[i].fn(now, dt)) busy = true;
  if (busy) {
    if (!raf) raf = requestAnimationFrame(frame);
  } else if (!raf) last = 0;
}

/** Ask for a frame. Safe to call from any event handler, any number of times. */
export function wake() {
  if (raf || typeof document === "undefined" || asleep()) return;
  raf = requestAnimationFrame(frame);
}

/** Lower `order` runs first: scroll (0) → DOM (10) → scene (20). */
export function addTask(fn: Task, order = 10) {
  const entry = { fn, order };
  tasks = [...tasks, entry].sort((a, b) => a.order - b.order);
  wake();
  return () => {
    tasks = tasks.filter((t) => t !== entry);
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (asleep()) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    } else wake();
  });
}
