import * as THREE from "three";
import { BREAKPOINT_MOBILE, LENS } from "@/lib/config";
import { rt } from "@/lib/runtime";
import { getScroller } from "@/lib/scroll";
import { ui } from "@/lib/store";
import { wake } from "@/lib/ticker";
import { createPhotoMaterial } from "./materials";
import { frame } from "./state";
type Entry = {
  el: HTMLElement; img: HTMLImageElement;
  top: number; left: number; w: number; h: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null;
  texture: THREE.Texture | null; over: boolean; hover: number;
};
// Desktop photo planes. Phone photographs stay in the native compositor scroll layer;
// they never allocate canvas copies or GPU textures in this scene.
export function createPhotos(gl: THREE.WebGLRenderer) {
  const group = new THREE.Group();
  const coarse = matchMedia("(pointer: coarse)").matches;
  const geometry = new THREE.PlaneGeometry(1, 1, 8, 32);
  const listeners = new AbortController();
  let measured = "";
  let enabled = false;
  const entries: Entry[] = [...document.querySelectorAll<HTMLElement>("[data-photo]")].map((el) => {
    const e: Entry = { el, img: el.querySelector("img")!, top: 0, left: 0, w: 1, h: 1, mesh: null, texture: null, over: false, hover: 0 };
    const set = (over: boolean) => () => { e.over = over; rt.dirty = true; wake(); };
    el.addEventListener("pointerenter", set(true), { signal: listeners.signal });
    el.addEventListener("pointerleave", set(false), { signal: listeners.signal });
    el.addEventListener("focus", set(true), { signal: listeners.signal });
    el.addEventListener("blur", set(false), { signal: listeners.signal });
    e.img.addEventListener("load", () => { rt.dirty = true; wake(); }, { signal: listeners.signal });
    return e;
  });
  const handheld = () => coarse || rt.w <= BREAKPOINT_MOBILE;
  function measure() {
    const scroller = getScroller(); if (!scroller) return;
    const key = `${rt.w}:${rt.h}:${rt.limit}`; if (key === measured) return;
    measured = key;
    const base = scroller.getBoundingClientRect();
    for (const e of entries) {
      const box = e.el.getBoundingClientRect();
      e.top = box.top - base.top + scroller.scrollTop; e.left = box.left - base.left;
      e.w = box.width; e.h = box.height;
    }
  }
  function intersectsLens(e: Entry) {
    const y = e.top - rt.scroll, bottom = y + e.h, band = rt.h * LENS.band;
    return bottom > 0 && y < rt.h && (!handheld() || y < band || bottom > rt.h - band);
  }
  function release(e: Entry) {
    delete e.el.dataset.gl;
    if (e.mesh) { group.remove(e.mesh); e.mesh.material.dispose(); e.mesh = null; }
    e.texture?.dispose(); e.texture = null;
  }
  function acquire(e: Entry) {
    if (!e.img.complete || !e.img.naturalWidth) return;
    const image = document.createElement("canvas");
    // 512px on phones: at most 1 MiB RGBA per square copy, without mipmaps.
    const limit = handheld() ? 512 : 1536;
    const scale = Math.min(1, limit / Math.max(e.img.naturalWidth, e.img.naturalHeight));
    image.width = Math.round(e.img.naturalWidth * scale); image.height = Math.round(e.img.naturalHeight * scale);
    const context = image.getContext("2d"); if (!context) return;
    context.drawImage(e.img, 0, 0, image.width, image.height);
    const texture = e.texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
    texture.anisotropy = Math.min(handheld() ? 2 : 8, gl.capabilities.getMaxAnisotropy());
    const material = createPhotoMaterial();
    material.uniforms.uMap.value = texture; material.uniforms.uImageAspect.value = image.width / image.height;
    material.uniforms.uFocus.value = parseFloat(e.el.dataset.focus ?? "50") / 100;
    e.mesh = new THREE.Mesh(geometry, material); e.mesh.renderOrder = -5; e.mesh.frustumCulled = false;
    group.add(e.mesh); e.el.dataset.gl = "on";
  }
  return {
    group,
    release() { entries.forEach(release); },
    onScreen() {
      if (handheld() || ui().reduced || ui().sceneFailed) {
        if (enabled) entries.forEach(release); enabled = false; return false;
      }
      measure(); enabled = true;
      let any = false;
      for (const e of entries) {
        if (intersectsLens(e)) any = true;
        else if (handheld() && e.mesh) release(e);
      }
      return any;
    },
    update() {
      if (!enabled) return;
      measure();
      for (const e of entries) {
        const y = e.top - rt.scroll, visible = intersectsLens(e);
        if (handheld() ? !visible : y > rt.h * 2 || y + e.h < -rt.h) {
          if (e.mesh) release(e); continue;
        }
        if (!e.mesh && visible) acquire(e);
        if (!e.mesh) continue;
        e.mesh.visible = visible; if (!visible) continue;
        e.mesh.position.set(e.left + e.w / 2 - rt.w / 2, rt.h / 2 - (y + e.h / 2), 40);
        e.mesh.scale.set(e.w, e.h, 1);
        const target = !handheld() && e.over ? 1 : 0;
        e.hover += (target - e.hover) * (1 - Math.pow(0.86, frame.dt * 60));
        if (Math.abs(target - e.hover) > 0.004) frame.settling = true; else e.hover = target;
        e.mesh.material.uniforms.uPlaneAspect.value = e.w / e.h; e.mesh.material.uniforms.uHover.value = e.hover;
      }
    },
    dispose() { listeners.abort(); entries.forEach(release); geometry.dispose(); },
  };
}
export type Photos = ReturnType<typeof createPhotos>;
