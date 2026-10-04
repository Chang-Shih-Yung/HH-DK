import * as THREE from "three";
import { BREAKPOINT_MOBILE } from "@/lib/config";
import { rt } from "@/lib/runtime";
import { getScroller } from "@/lib/scroll";
import { ui } from "@/lib/store";
import { wake } from "@/lib/ticker";
import { loadTexture } from "./loaders";
import { createPhotoMaterial } from "./materials";
import { frame } from "./state";

type Entry = {
  el: HTMLElement;
  img: HTMLImageElement;
  /** Box in page space, measured on resize only. */
  top: number;
  left: number;
  w: number;
  h: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  texture: THREE.Texture | null;
  loading: AbortController | null;
  over: boolean;
  hover: number;
};

/**
 * Desktop only: the pictures of the page, re-drawn in the canvas so they can bend in the
 * lens bands. Each one takes over from its <img> when its texture is ready and hands back
 * (and frees its texture) once it is far from the screen. Phones keep the plain <img>:
 * with native touch scrolling a canvas copy would trail the text.
 */
export function createPhotos(gl: THREE.WebGLRenderer) {
  const group = new THREE.Group();
  const fine = matchMedia("(pointer: fine)").matches;
  let enabled = false;
  // Enough rows to follow the lens curve inside a band; a few columns for its sideways bow.
  const geometry = new THREE.PlaneGeometry(1, 1, 8, 32);
  const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
  const listeners = new AbortController();
  let measured = "";

  const entries: Entry[] = fine
    ? [...document.querySelectorAll<HTMLElement>("[data-photo]")].map((el) => {
        const entry: Entry = { el, img: el.querySelector("img")!, top: 0, left: 0, w: 1, h: 1, mesh: null, texture: null, loading: null, over: false, hover: 0 };
        const set = (over: boolean) => () => {
          entry.over = over;
          rt.dirty = true;
          wake();
        };
        el.addEventListener("pointerenter", set(true), { signal: listeners.signal });
        el.addEventListener("pointerleave", set(false), { signal: listeners.signal });
        el.addEventListener("focus", set(true), { signal: listeners.signal });
        el.addEventListener("blur", set(false), { signal: listeners.signal });
        return entry;
      })
    : [];

  function measure() {
    const scroller = getScroller();
    if (!scroller) return;
    const base = scroller.getBoundingClientRect();
    for (const e of entries) {
      const box = e.el.getBoundingClientRect();
      e.top = box.top - base.top + scroller.scrollTop;
      e.left = box.left - base.left;
      e.w = box.width;
      e.h = box.height;
    }
  }

  function acquire(e: Entry) {
    const url = e.img.currentSrc || e.img.src;
    if (!url || !e.img.complete || e.img.naturalWidth === 0) return;
    const loading = (e.loading = new AbortController());
    loadTexture(url, loading.signal)
      .then((texture) => {
        texture.anisotropy = anisotropy;
        const material = createPhotoMaterial();
        const image = texture.image as { width: number; height: number };
        material.uniforms.uMap.value = texture;
        material.uniforms.uImageAspect.value = image.width / image.height;
        material.uniforms.uFocus.value = parseFloat(e.el.dataset.focus ?? "50") / 100;
        e.texture = texture;
        e.mesh = new THREE.Mesh(geometry, material);
        e.mesh.renderOrder = -5;
        e.mesh.visible = false;
        e.mesh.frustumCulled = false;
        group.add(e.mesh);
        // From here the canvas shows the picture; its <img> steps back.
        e.el.dataset.gl = "on";
        rt.dirty = true;
        wake();
      })
      .catch(() => {})
      .finally(() => {
        if (e.loading === loading) e.loading = null;
      });
  }

  function release(e: Entry) {
    e.loading?.abort();
    e.loading = null;
    delete e.el.dataset.gl;
    if (e.mesh) {
      group.remove(e.mesh);
      e.mesh.material.dispose();
      e.mesh = null;
    }
    e.texture?.dispose();
    e.texture = null;
  }

  return {
    group,
    /** Is any picture on screen (so the canvas has something to draw)? Cheap: cached boxes only. */
    onScreen() {
      if (!fine || rt.w <= BREAKPOINT_MOBILE) {
        // This can be the last callback before the canvas sleeps on a narrow resize.
        // Hand pictures back immediately instead of leaving their DOM images hidden.
        if (enabled) entries.forEach(release);
        enabled = false;
        measured = "";
        return false;
      }
      for (const e of entries) if (e.top - rt.scroll < rt.h && e.top + e.h - rt.scroll > 0) return true;
      return false;
    },
    update() {
      const wide = fine && rt.w > BREAKPOINT_MOBILE;
      if (!wide) {
        if (enabled) entries.forEach(release);
        enabled = false;
        measured = "";
        return;
      }
      enabled = true;
      const key = `${rt.w}:${rt.h}:${rt.limit}`;
      if (key !== measured) {
        measured = key;
        measure();
      }
      const still = ui().reduced;
      for (const e of entries) {
        const y = e.top - rt.scroll;
        // Kept within two screens of the viewport; freed beyond that.
        if (y > rt.h * 3 || y + e.h < -rt.h * 2) {
          if (e.mesh || e.loading) release(e);
          continue;
        }
        if (!e.mesh) {
          if (!e.loading && y < rt.h * 2 && y + e.h > -rt.h) acquire(e);
          continue;
        }
        const visible = y < rt.h && y + e.h > 0;
        e.mesh.visible = visible;
        if (!visible) continue;
        e.mesh.position.set(e.left + e.w / 2 - rt.w / 2, rt.h / 2 - (y + e.h / 2), 40);
        e.mesh.scale.set(e.w, e.h, 1);
        const target = e.over && !still ? 1 : 0;
        e.hover += (target - e.hover) * (1 - Math.pow(0.86, frame.dt * 60));
        if (Math.abs(target - e.hover) > 0.004) frame.settling = true;
        else e.hover = target;
        e.mesh.material.uniforms.uPlaneAspect.value = e.w / e.h;
        e.mesh.material.uniforms.uHover.value = e.hover;
      }
    },
    dispose() {
      listeners.abort();
      entries.forEach(release);
      geometry.dispose();
    },
  };
}

export type Photos = ReturnType<typeof createPhotos>;
