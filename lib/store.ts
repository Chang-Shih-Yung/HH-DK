// UI state that changes rarely (theme, menu, loading). Components subscribe to single
// fields; anything per-frame lives in lib/runtime.ts instead.
import { create } from "zustand";
import type { Tier } from "./config";

export type Mode = "dark" | "light";
export type Section = "top" | "edit" | "street" | "direction" | "end";
export type LightboxItem = { src: string; alt: string; title: string; width: number; height: number };

type UI = {
  mode: Mode;
  menuOpen: boolean;
  sound: boolean;
  soundLoading: boolean;
  soundError: boolean;
  tilt: "off" | "asking" | "on" | "denied" | "unavailable";
  tiltAvailable: boolean;
  /** The loader has lifted and the page is interactive. */
  entered: boolean;
  /** The WebGL hero has drawn its first frame. */
  sceneReady: boolean;
  sceneFailed: boolean;
  /** 0 – 1, logo download progress for the loader. */
  progress: number;
  section: Section;
  reduced: boolean;
  tier: Tier;
  /** Current device-pixel-ratio cap; the adaptive monitor may lower it. */
  dpr: number;
  lightbox: LightboxItem | null;
};

export const useUI = create<UI>(() => ({
  mode: "dark",
  menuOpen: false,
  sound: false,
  soundLoading: false,
  soundError: false,
  tilt: "off",
  tiltAvailable: false,
  entered: false,
  sceneReady: false,
  sceneFailed: false,
  progress: 0,
  section: "top",
  reduced: false,
  tier: "mid",
  dpr: 1,
  lightbox: null,
}));

export const ui = useUI.getState;
export const setUI = useUI.setState;

export function setMode(mode: Mode) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.mode = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0c0d0f" : "#edece7");
  }
  setUI({ mode });
}
