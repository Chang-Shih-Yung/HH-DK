"use client";

import { useEffect } from "react";
import { createMobileLens } from "@/lib/mobile-lens";

/** Keep phone pictures in the native scroll layer; no canvas copies follow the finger. */
export function MobilePictureLens() {
  useEffect(() => {
    const mobile = matchMedia("(pointer: coarse), (max-width: 600px)");
    let stop: (() => void) | undefined;
    const sync = () => {
      if (mobile.matches && !stop) stop = createMobileLens();
      else if (!mobile.matches && stop) { stop(); stop = undefined; }
    };
    sync();
    mobile.addEventListener("change", sync);
    return () => { mobile.removeEventListener("change", sync); stop?.(); };
  }, []);
  return null;
}
