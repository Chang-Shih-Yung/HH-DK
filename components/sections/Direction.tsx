"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { DIRECTION } from "@/lib/config";
import { directionProgress, rt, smooth } from "@/lib/runtime";
import { ui, useUI } from "@/lib/store";
import { addTask } from "@/lib/ticker";
import { Wordmark } from "@/components/ui/Wordmark";

// A pinned sequence scrubbed by scroll: the arrow self-rotates, the heading fades out,
// the street returns under the fading arrow, then the wordmark and closing copy follow.
export function Direction() {
  const sceneReady = useUI((state) => state.sceneReady && !state.sceneFailed);
  const kicker = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLParagraphElement>(null);
  const closing = useRef<HTMLElement>(null);
  const brand = useRef<HTMLAnchorElement>(null);
  const tagline = useRef<HTMLHeadingElement>(null);
  const links = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shown = -1;
    let wasReduced: boolean | undefined;
    let open: boolean | null = null;
    let linksOpen: boolean | null = null;
    return addTask(() => {
      if (!closing.current || rt.dirH === 0) return;
      if (rt.scroll < rt.dirTop - rt.h || rt.scroll > rt.dirTop + rt.dirH) return;
      const p = directionProgress();
      const still = ui().reduced;
      if (p === shown && still === wasReduced) return;
      shown = p;
      wasReduced = still;
      const rise = (from: number, to: number) => (still ? "none" : `translateY(${((1 - smooth(from, to, p)) * 105).toFixed(2)}%)`);
      // The heading hands over to the wordmark between these two points.
      const exit = smooth(...DIRECTION.headingOut, p);
      const swap = smooth(...DIRECTION.brandIn, p);
      const leaving = 1 - smooth(...DIRECTION.headingOut, p);

      kicker.current!.style.opacity = String(smooth(0, 0.08, p) * leaving);
      first.current!.style.transform = rise(0.08, 0.26);
      second.current!.style.transform = rise(0.2, 0.38);
      note.current!.style.opacity = String(smooth(0.36, 0.46, p) * leaving);
      heading.current!.style.opacity = String(1 - exit);
      heading.current!.style.transform = still ? "none" : `scale(${(1 + exit * 0.025).toFixed(4)})`;
      brand.current!.style.opacity = String(swap);
      brand.current!.style.transform = `translateY(-50%) scale(${(still ? 1 : 0.95 + swap * 0.05).toFixed(4)})`;
      const words = smooth(...DIRECTION.wordsIn, p);
      tagline.current!.style.opacity = String(words);
      tagline.current!.style.transform = still ? "none" : `translateY(${(1 - words) * 16}px)`;
      links.current!.style.opacity = String(smooth(0.91, 1.0, p));

      // The closing links only take focus and clicks once they are on screen.
      const ready = swap > 0.15;
      if (ready !== open) {
        open = ready;
        closing.current.inert = !ready;
      }
      const navigable = p > 0.93;
      if (navigable !== linksOpen) {
        linksOpen = navigable;
        links.current!.inert = !navigable;
      }
    });
  }, []);

  return (
    <section
      id="direction"
      tabIndex={-1}
      aria-labelledby="direction-title"
      className="relative"
      style={{ height: `calc(var(--vh, 100svh) * ${1 + DIRECTION.travel})` } as CSSProperties}
    >
      <div className="sticky top-0 h-view overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
          <p ref={kicker} className="absolute left-inset top-[110px] font-mono text-[10px] text-muted sm:top-[105px] sm:text-xs">
            03 / A LITTLE DIRECTION
          </p>
          <h2
            ref={heading}
            id="direction-title"
            className="relative z-[5] pt-[22%] text-[12.5vw] font-bold leading-[1.12] tracking-[-0.015em] sm:pt-[10%] sm:text-[clamp(60px,9.6vw,152px)] sm:leading-[1.06] sm:tracking-[-0.028em]"
          >
            <span className="block overflow-hidden">
              <span ref={first} className="block">
                GOOD FINDS.
              </span>
            </span>
            <span className="block overflow-hidden">
              <span ref={second} className="block">
                EVERY DAY.
              </span>
            </span>
          </h2>
          <p ref={note} lang="ja" className="absolute bottom-[130px] text-xs tracking-[0.14em] sm:bottom-[100px] sm:text-[15px]">
            毎日に、いいものを。
          </p>
        </div>

        {/* The closing pairs foreground copy with the horizontal 3D wordmark. */}
        <footer id="end" ref={closing} tabIndex={-1} inert className="closing absolute inset-0">
          <a
            ref={brand}
            href="#top"
            aria-label="HH:DK back to top"
            data-cursor="TOP"
            className="closing-brand absolute inset-x-inset block opacity-0"
          >
            <span className={sceneReady ? "invisible" : ""}><Wordmark /></span>
          </a>
          <h2 ref={tagline} className="pointer-events-none absolute inset-x-inset top-[47%] text-center text-[11.4vw] font-bold leading-[1.08] tracking-[-0.018em] opacity-0 sm:top-[43%] sm:text-[clamp(56px,7.4vw,112px)]">
            <span className="block">A LITTLE<span className="block sm:inline"> STREET.</span></span>
            <span className="block">EVERY DAY.</span>
          </h2>
          <div ref={links} className="closing-links absolute inset-x-inset opacity-0">
            <div className="flex justify-between gap-3 font-mono text-[10px] sm:text-sm">
              <a href="#edit" className="py-3 transition-colors hover:text-accent">
                THE EDIT ↗
              </a>
              <a href="#street" className="py-3 transition-colors hover:text-accent">
                STREET NOTES ↗
              </a>
              <a href="#top" className="py-3 transition-colors hover:text-accent">
                BACK TO TOP ↑
              </a>
            </div>
            <p lang="ja" className="mt-4 text-xs tracking-[0.15em] text-muted sm:mt-7 sm:text-sm">
              街の気分を、日常に。
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
