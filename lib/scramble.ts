// Text scramble effects. Each run is a short self-ending animation that writes straight
// to the node, so no component re-renders while it plays.

const GLYPHS = ":*/+—0123456789";
const SWEEP_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>[]=+*^?#%&";
const running = new WeakMap<HTMLElement, number>();

const pick = (set: string) => set[Math.floor(Math.random() * set.length)];

// Write into the existing text node so React keeps owning it.
function setText(el: HTMLElement, text: string) {
  const node = el.firstChild;
  if (node && node.nodeType === Node.TEXT_NODE && !node.nextSibling) node.nodeValue = text;
  else el.textContent = text;
}

export function cancelScramble(el: HTMLElement, text?: string) {
  const id = running.get(el);
  if (id) cancelAnimationFrame(id);
  running.delete(el);
  if (text !== undefined) setText(el, text);
}

/** Hover feedback: the label resolves left to right out of digits, in under a quarter second. */
export function scramble(el: HTMLElement, text: string, duration = 230) {
  cancelScramble(el);
  const chars = [...text];
  const start = performance.now();
  const frame = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    setText(el, chars.map((c, i) => (c === " " || i < chars.length * progress ? c : pick(GLYPHS))).join(""));
    if (progress < 1) running.set(el, requestAnimationFrame(frame));
    else running.delete(el);
  };
  running.set(el, requestAnimationFrame(frame));
}

/** Label change: the new text is set, then a four-character window of noise sweeps across it. */
export function sweep(el: HTMLElement, text: string, step = 40, width = 4) {
  cancelScramble(el);
  const chars = [...text];
  const start = performance.now();
  let shown = -1;
  const frame = (now: number) => {
    const head = Math.floor((now - start) / step);
    if (head !== shown) {
      shown = head;
      setText(el, chars.map((c, i) => (c !== " " && i <= head && i > head - width ? pick(SWEEP_GLYPHS) : c)).join(""));
    }
    if (head - width < chars.length) running.set(el, requestAnimationFrame(frame));
    else {
      setText(el, text);
      running.delete(el);
    }
  };
  running.set(el, requestAnimationFrame(frame));
}
