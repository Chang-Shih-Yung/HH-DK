import * as THREE from "three";
import { RIPPLE } from "@/lib/config";
import { rt } from "@/lib/runtime";
import { createSimMaterial } from "./materials";

const STEP = 1 / 60;

// A small height-field simulation shared by the opening and closing backdrops.
// It advances on a fixed 60 Hz step, so ripples travel at the same speed on 120 Hz phones.
export function createFluid(gl: THREE.WebGLRenderer, size: number) {
  const float = gl.extensions.has("EXT_color_buffer_float") || gl.extensions.has("EXT_color_buffer_half_float");
  const options = {
    type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  };
  let read = new THREE.WebGLRenderTarget(size, size, options);
  let write = new THREE.WebGLRenderTarget(size, size, options);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = createSimMaterial(size);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  let lastX = -1;
  let lastY = -1;
  let budget = 0;
  let active = 0;

  const pass = () => {
    material.uniforms.uPrevious.value = read.texture;
    gl.setRenderTarget(write);
    gl.render(scene, camera);
    [read, write] = [write, read];
  };

  const reset = () => {
    material.uniforms.uReset.value = 1;
    pass();
    pass();
    material.uniforms.uReset.value = 0;
    gl.setRenderTarget(null);
    lastX = lastY = -1;
    budget = active = 0;
  };
  reset();

  return {
    get texture() {
      return read.texture;
    },
    reset,
    /** Advance by `dt` seconds, feeding the pointer in as a moving drop. */
    step(dt: number, still: boolean) {
      if (still) return;
      const x = rt.px / Math.max(1, rt.w);
      const y = 1 - rt.py / Math.max(1, rt.h);
      const travel = lastX < 0 ? 0 : Math.hypot((x - lastX) * rt.w, (y - lastY) * rt.h);
      const u = material.uniforms;
      u.uAspect.value = rt.w / Math.max(1, rt.h);
      u.uPointer.value.set(x, y);
      u.uLast.value.set(lastX < 0 ? x : lastX, lastY < 0 ? y : lastY);
      let drop = rt.pointerOn ? Math.min(RIPPLE.dropMax, travel * RIPPLE.drop) : 0;
      if (rt.tap) drop = Math.max(drop, RIPPLE.tap);
      rt.tap = false;
      // The height-field passes sleep after the waves settle. The backdrop's very slow
      // ambient sheen needs no simulation; a new pointer stroke wakes these same targets.
      if (drop > 0) active = 3;
      if (active <= 0) { lastX = rt.pointerOn ? x : -1; lastY = y; return; }
      active = Math.max(0, active - dt);

      budget = Math.min(budget + dt, STEP * 2);
      let stepped = false;
      while (budget >= STEP) {
        budget -= STEP;
        u.uDrop.value = stepped ? 0 : drop;
        pass();
        stepped = true;
      }
      if (stepped) {
        gl.setRenderTarget(null);
        lastX = rt.pointerOn ? x : -1;
        lastY = y;
      }
    },
    dispose() {
      read.dispose();
      write.dispose();
      quad.geometry.dispose();
      material.dispose();
    },
  };
}

export type Fluid = ReturnType<typeof createFluid>;
