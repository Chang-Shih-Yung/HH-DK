import * as THREE from "three";
import { BREAKPOINT_MOBILE, DIRECTION, LOGO } from "@/lib/config";
import { directionProgress, rt, smooth } from "@/lib/runtime";
import { ui } from "@/lib/store";
import { createGlassMaterial } from "./materials";
import { frame } from "./state";

/** One centred arrow: diagonal-axis rotation at the hero, then a small-to-large
 * scroll entrance in the closing sequence. */
export function createArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(-43, 52);
  shape.quadraticCurveTo(-55, 60, -49, 45);
  shape.lineTo(-13, -43);
  shape.quadraticCurveTo(-7, -55, 1, -43);
  shape.lineTo(14, -9);
  shape.lineTo(48, 3);
  shape.quadraticCurveTo(62, 9, 49, 17);
  shape.lineTo(-43, 52);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 26,
    bevelEnabled: true,
    bevelSegments: 12,
    bevelSize: 3,
    bevelThickness: 7,
    curveSegments: 40,
  });
  geometry.center();

  const material = createGlassMaterial(null, 0, true);
  // Both appearances use the special red: 90% pigment, 10% refracted backdrop.
  material.uniforms.uPigment.value = 0.9;
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  const axis = new THREE.Vector3(1, -1, 0).normalize();
  const rotation = new THREE.Quaternion();
  const orientation = new THREE.Euler();

  function update() {
    const still = ui().reduced;
    const mobile = rt.w <= BREAKPOINT_MOBILE;
    const u = material.uniforms;

    // ── Beside the logo on the first screen ──
    if (frame.heroOn && frame.street) {
      group.visible = true;
      const out = frame.dissolve;
      const scale = frame.logoScale;
      // Offset from the logo's origin, in artwork units: right of the K on wide screens,
      // under it on phones.
      const [ox, oy] = mobile ? [248, 360] : [470, 175];
      const float = still ? 0 : Math.sin(frame.time * 0.5 + 1.3) * 6;
      const x = frame.logoX + ox * scale + frame.tiltY * 320;
      const y = frame.logoY + oy * scale + float - frame.tiltX * 320;
      mesh.position.set(x - rt.w / 2, rt.h / 2 - (y - rt.scroll), 170);
      mesh.scale.setScalar(scale * (mobile ? 1.05 : 0.95));
      orientation.set(0.1 + frame.tiltX * 2, -0.13 + frame.tiltY * 2,
        -0.08 + (still ? 0 : Math.sin(frame.time * 0.33) * 0.05));
      mesh.quaternion.setFromEuler(orientation);
      rotation.setFromAxisAngle(axis, -out * Math.PI * 0.8);
      mesh.quaternion.premultiply(rotation);
      const image = frame.street.image as { width: number; height: number };
      u.uStreet.value = frame.street;
      u.uImageAspect.value = image.width / image.height;
      u.uAspect.value = rt.w / rt.h;
      u.uBackdropMix.value = 1;
      u.uBend.value.set((LOGO.bend * scale) / rt.w, (LOGO.bend * scale) / rt.h);
      u.uDissolve.value = out;
      return;
    }

    // ── The pinned "direction" sequence ──
    group.visible = frame.directionOn;
    if (!frame.directionOn) return;
    const p = directionProgress();
    // The departing arrow no longer submits a giant, invisible plane at the footer.
    if (p >= DIRECTION.arrowOut[1]) { group.visible = false; return; }
    // While the section is still scrolling in, the pinned box has not reached the top yet.
    const boxTop = Math.max(0, rt.dirTop - rt.scroll);
    const arrive = still ? 1 : smooth(0, 0.28, p);
    const turn = still ? 0 : smooth(0.04, 0.54, p);
    const leave = still ? 0 : smooth(0.50, 0.80, p);
    const base = Math.min(rt.w * (mobile ? 1.15 : 0.58), rt.h * 0.92) / 118;
    mesh.scale.setScalar(base * (0.22 + 0.78 * arrive) * (1 + leave * leave * 7));
    mesh.position.set(0, rt.h / 2 - (boxTop + rt.h * (0.45 + (still ? 0 : (1 - arrive) * 0.10))), 100);
    orientation.set(0.08 + frame.tiltX, -0.13 + frame.tiltY, -0.08);
    mesh.quaternion.setFromEuler(orientation);
    rotation.setFromAxisAngle(axis, -(turn * Math.PI * 1.8 + leave * 0.6));
    mesh.quaternion.premultiply(rotation);
    u.uBackdropMix.value = 0;
    u.uDissolve.value = smooth(...DIRECTION.arrowOut, p);
  }

  return {
    group,
    update,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
