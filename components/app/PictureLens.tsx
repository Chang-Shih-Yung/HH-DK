"use client";

import { useEffect } from "react";
import { LENS } from "@/lib/config";
import { rt } from "@/lib/runtime";
import { getScroller } from "@/lib/scroll";
import { ui } from "@/lib/store";
import { addTask } from "@/lib/ticker";

const ANGLE = 13; // degrees at the very edge
const PERSPECTIVE = 700;

// Touch devices: the edge lens for pictures, done with transforms. A picture crossing the
// top or bottom band hinges on the band's inner line and swings its outer edge forward,
// so it widens towards the edge of the screen as it would through a lens. It stays a real
// <img> and scrolls natively; only its tilt is set here, so nothing can trail the text.
// (Desktop bends the pictures properly in the canvas instead — see scene/photos.ts.)
export function PictureLens() {
  useEffect(() => {
    if (!matchMedia("(pointer: coarse)").matches) return;
    const items = [...document.querySelectorAll<HTMLElement>("[data-photo]")].map((el) => ({ el, top: 0, h: 1, applied: "" }));
    let measured = "";
    let scroll = -1;

    const measure = () => {
      const scroller = getScroller();
      if (!scroller) return;
      const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
      for (const item of items) {
        item.el.style.transform = "";
        item.applied = "";
        const box = item.el.getBoundingClientRect();
        item.top = box.top - base;
        item.h = box.height;
      }
    };

    const stop = addTask(() => {
      const key = `${rt.w}:${rt.h}:${rt.limit}`;
      if (key !== measured) {
        measured = key;
        measure();
        scroll = -1;
      }
      if (rt.scroll === scroll) return;
      scroll = rt.scroll;
      const band = rt.h * LENS.band;
      const still = ui().reduced;
      for (const item of items) {
        const y = item.top - rt.scroll;
        const bottom = y + item.h;
        let transform = "";
        let origin = 0;
        if (!still && y < band && bottom > 0) {
          origin = Math.min(item.h, Math.max(0, band - y));
          transform = `perspective(${PERSPECTIVE}px) rotateX(${(-Math.min(1, (band - y) / band) * ANGLE).toFixed(2)}deg)`;
        } else if (!still && bottom > rt.h - band && y < rt.h) {
          origin = Math.min(item.h, Math.max(0, rt.h - band - y));
          transform = `perspective(${PERSPECTIVE}px) rotateX(${(Math.min(1, (bottom - (rt.h - band)) / band) * ANGLE).toFixed(2)}deg)`;
        }
        if (transform === item.applied) continue;
        item.applied = transform;
        item.el.style.transformOrigin = `50% ${origin.toFixed(1)}px`;
        item.el.style.transform = transform;
      }
    });

    return () => {
      stop();
      for (const item of items) item.el.style.transform = "";
    };
  }, []);

  return null;
}
