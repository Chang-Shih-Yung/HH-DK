import * as THREE from "three";
import { BREAKPOINT_MOBILE, DIRECTION, LOGO, QUALITY, STICKER_KINDS } from "@/lib/config";
import { directionProgress, rt, smooth } from "@/lib/runtime";
import { setUI, ui } from "@/lib/store";
import { createFluid } from "./fluid";
import { loadLogoGeometry, loadTexture } from "./loaders";
import { createBackdropMaterial, createGlassMaterial, createStickerMaterial } from "./materials";
import { createBodies, stepBodies, type Body, type World } from "./physics";
import { frame } from "./state";
import { horizontalGeometry } from "./horizontal";
import { closingMotion, emblemDepth } from "@/lib/closing-motion";

export type HeroAssets = { logo: THREE.BufferGeometry; street: THREE.Texture; stickers: THREE.Texture[] };

/** Everything the first screen needs, fetched in parallel. */
export async function loadHeroAssets(signal: AbortSignal): Promise<HeroAssets> {
  const quality = QUALITY[ui().tier];
  const [logo, street, stickers] = await Promise.all([
    loadLogoGeometry(signal, (share) => setUI({ progress: 0.2 + share * 0.6 })),
    loadTexture(`/textures/atmosphere-${quality.texture}.webp`, signal),
    Promise.all(STICKER_KINDS.map((kind) => loadTexture(kind.src, signal))),
  ]);
  return { logo, street, stickers };
}

// Where the three stickers rest when motion is reduced: the approved static composition.
// [edge as a share of the width, top as a share of the hero, angle°, +1 left-anchored / −1 right-anchored]
const STILL = [
  { desktop: [0.78, 0.29, -12, 1], mobile: [0.18, 0.29, -10, 1] },
  { desktop: [0.88, 0.62, 12, -1], mobile: [0.89, 0.28, 12, -1] },
  { desktop: [0.28, 0.28, 7, 1], mobile: [0.08, 0.48, 7, 1] },
] as const;

/**
 * The first screen: water backdrop, glass logo, falling stickers.
 * Built once, kept for the life of the page (scrolling away only hides it, so coming
 * back never re-downloads or re-uploads anything) and released in dispose().
 */
export function createHero(gl: THREE.WebGLRenderer, assets: HeroAssets) {
  const quality = QUALITY[ui().tier];
  const group = new THREE.Group();

  // Water.
  const fluid = createFluid(gl, quality.sim);
  const backdropMaterial = createBackdropMaterial(assets.street, quality.sim);
  const screen = new THREE.PlaneGeometry(2, 2);
  const backdrop = new THREE.Mesh(screen, backdropMaterial);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -10;
  group.add(backdrop);

  // Logo: the baked surface plus the two colon dots, one shared glass material.
  const glass = createGlassMaterial(assets.street, 1, false, quality.stickers);
  const logo = new THREE.Group();
  logo.add(new THREE.Mesh(assets.logo, glass));
  const dotGeometry = new THREE.SphereGeometry(38, 40, 28);
  for (const y of [-70, -156]) {
    const dot = new THREE.Mesh(dotGeometry, glass);
    dot.position.set(-296, y, 0);
    dot.scale.z = 1.14;
    logo.add(dot);
  }
  group.add(logo);

  const closingGeometry = horizontalGeometry(assets.logo);
  const closingGlass = createGlassMaterial(assets.street, 1, true, 2);
  closingGlass.transparent = true;
  closingGlass.premultipliedAlpha = true;
  const closingLogo = new THREE.Group();
  const closingLetters = new THREE.Mesh(closingGeometry, closingGlass);
  closingLetters.renderOrder = 100;
  closingLogo.add(closingLetters);
  for (const y of [32.5, -26.5]) {
    const dot = new THREE.Mesh(dotGeometry, closingGlass);
    dot.position.set(-5.5, y, 0);
    dot.scale.set(25 / 38, 25 / 38, 30 / 38);
    dot.renderOrder = 100;
    closingLogo.add(dot);
  }
  group.add(closingLogo);

  // Emblems: one quad geometry, one material per artwork. A mesh changes artwork when
  // its body comes back in from the top as the next design.
  const quad = new THREE.PlaneGeometry(1, 1);
  const stickerMaterials = assets.stickers.map((texture) => createStickerMaterial(texture));
  const closingStickers = assets.stickers.map((texture) => createStickerMaterial(texture, true));
  const closingWorld: World = { w: 1, h: 1, mobile: false, logoX: 0, logoY: 0, logoScale: 1, time: 0 };
  let closingBodies: Body[] = [];
  const closingMeshes = [0, 1].map(() => {
    const mesh = new THREE.Mesh(quad, closingStickers[0]);
    mesh.renderOrder = 20;
    group.add(mesh);
    return mesh;
  });
  let closingBuiltFor = "";
  let closingFall = 0;
  let waterPhase: "hero" | "closing" | null = null;
  const world: World = { w: 1, h: 1, mobile: false, logoX: 0, logoY: 0, logoScale: 1, time: 0 };
  let bodies: Body[] = [];
  let meshes: THREE.Mesh[] = [];
  let builtFor = "";

  const dress = (mesh: THREE.Mesh, body: Body) => {
    mesh.material = stickerMaterials[body.kind];
    mesh.scale.set(body.w, body.h, 1);
    mesh.userData.kind = body.kind;
  };

  const buildStickers = (mobile: boolean) => {
    for (const mesh of meshes) group.remove(mesh);
    world.w = rt.w;
    world.h = rt.heroH;
    world.mobile = mobile;
    bodies = createBodies(quality.stickers, world, Math.random);
    meshes = bodies.map((body, i) => {
      const mesh = new THREE.Mesh(quad, stickerMaterials[body.kind]);
      dress(mesh, body);
      mesh.renderOrder = 10 + i;
      group.add(mesh);
      return mesh;
    });
  };

  frame.street = assets.street;

  const syncGlass = (material: THREE.ShaderMaterial, mesh: THREE.Mesh, i: number) => {
    const u = material.uniforms;
    const ratio = gl.getPixelRatio();
    u[`uEmblem${i}`].value = assets.stickers[mesh.userData.kind];
    u[`uEmblemRect${i}`].value.set(
      (mesh.position.x + rt.w / 2) / rt.w,
      (mesh.position.y + rt.h / 2) / rt.h,
      mesh.scale.x * ratio, mesh.scale.y * ratio,
    );
    u[`uEmblemTurn${i}`].value = mesh.rotation.z;
  };

  function update() {
    const p = directionProgress();
    const ending = frame.directionOn ? smooth(...DIRECTION.streetIn, p) : 0;
    const reveal = frame.directionOn ? smooth(...DIRECTION.brandIn, p) : 0;
    const stamps = frame.directionOn ? smooth(...DIRECTION.stickersIn, p) : 0;
    group.visible = frame.heroOn || ending > 0;
    logo.visible = frame.heroOn;
    closingLogo.visible = !frame.heroOn && reveal > 0;
    for (const mesh of closingMeshes) mesh.visible = !frame.heroOn && stamps > 0;
    if (rt.w === 0 || !group.visible) return;
    for (const mesh of meshes) mesh.visible = frame.heroOn;
    const envelope = backdropMaterial.uniforms;
    envelope.uDissolve.value = frame.heroOn ? frame.dissolve : 1 - ending;
    envelope.uOpacity.value = 1;
    if (!frame.heroOn) {
      // Reuse the first screen's small water simulation, never a second canvas/pass chain.
      if (waterPhase !== "closing") { rt.tap = false; fluid.reset(); waterPhase = "closing"; }
      fluid.step(frame.dt, ui().reduced);
      envelope.uWater.value = fluid.texture;
      envelope.uTime.value = frame.time;
      envelope.uMotion.value = ui().reduced ? 0 : 1;
      envelope.uAspect.value = rt.w / rt.h;
      const mobile = rt.w <= BREAKPOINT_MOBILE;
      const inset = mobile ? 26 : Math.min(70, Math.max(24, rt.w * 0.04)) + 8;
      const scale = (rt.w - inset * 2) / 858;
      closingLogo.scale.setScalar(scale * (0.82 + reveal * 0.18));
      closingLogo.position.set(0, rt.h * (mobile ? 0.12 : 0.10), 120);
      const turn = closingMotion(p, 0, ui().reduced).turn;
      closingLogo.rotation.set(0.14 - turn * 0.06 + frame.tiltX,
        frame.tiltY - 1.1 + turn * 1.2,
        0.20 * (1 - turn) - 0.03);
      // The halftone mask already fades the surface. A second opacity fade delayed its
      // visible entrance until after the preceding copy had completely disappeared.
      closingGlass.uniforms.uOpacity.value = 1;
      closingGlass.uniforms.uDissolve.value = 1 - reveal;
      closingGlass.uniforms.uAspect.value = rt.w / rt.h;
      closingGlass.uniforms.uBend.value.set((LOGO.bend * scale) / rt.w, (LOGO.bend * scale) / rt.h);
      closingGlass.uniforms.uEmblemCount.value = 2;
      const key = `${mobile}:${rt.w}:${rt.h}`;
      if (key !== closingBuiltFor) {
        closingBuiltFor = key;
        closingWorld.w = rt.w;
        closingWorld.h = rt.h;
        closingWorld.mobile = mobile;
        closingBodies = createBodies(2, closingWorld, Math.random);
        closingBodies.forEach((body, i) => {
          body.kind = i ? 1 : 4;
          const spec = STICKER_KINDS[body.kind];
          body.w = mobile ? spec.mobileW : spec.w;
          body.h = mobile ? spec.mobileH : spec.h;
          body.r = Math.max(body.w, body.h) * 0.4;
          body.x = rt.w * (i ? 0.63 : 0.37);
          body.y = rt.h * (mobile ? 0.38 : 0.40);
          body.a = i ? 0.10 : -0.12;
          body.drift = body.vx = i ? 4 : -4;
          body.fall = body.vy = 14 + i * 4;
        });
      }
      closingWorld.time = frame.time;
      // Keep emblems waiting in the glass during the scroll entrance. After the throw
      // settles, the two existing sprites drift down slowly; reversing scroll resets it.
      if (p < 0.95 || ui().reduced) closingFall = 0;
      else closingFall += frame.dt;
      for (const material of closingStickers) material.uniforms.uOpacity.value = stamps;
      closingMeshes.forEach((mesh, i) => {
        const body = closingBodies[i];
        mesh.material = closingStickers[body.kind];
        mesh.userData.kind = body.kind;
        mesh.scale.set(body.w, body.h, 1);
        const fling = closingMotion(p, i, ui().reduced);
        const span = rt.h + body.h * 2 + 24;
        let y = body.y + fling.y * rt.h + closingFall * body.fall;
        if (y > rt.h + body.h + 24) y = ((y + body.h) % span) - body.h;
        const drift = ui().reduced ? 0 : Math.sin(frame.time * 0.4 + i) * 3;
        mesh.position.set(body.x + fling.x * rt.w + drift - rt.w / 2, rt.h / 2 - y, emblemDepth(rt.w));
        mesh.rotation.z = -body.a + fling.angle + (i ? -1 : 1) * closingFall * 0.08;
        syncGlass(closingGlass, mesh, i);
      });
      return;
    }
    const { time, dt } = frame;
    const still = ui().reduced;
    const mobile = rt.w <= BREAKPOINT_MOBILE;
    const aspect = rt.w / rt.h;
    const heroH = rt.heroH;

    // Water.
    if (waterPhase !== "hero") { rt.tap = false; fluid.reset(); waterPhase = "hero"; }
    fluid.step(dt, still);
    const b = backdropMaterial.uniforms;
    b.uWater.value = fluid.texture;
    b.uTime.value = time;
    b.uAspect.value = aspect;
    b.uMotion.value = still ? 0 : 1;
    glass.uniforms.uAspect.value = aspect;

    // Logo: placed against the hero box, so it travels with the page while scrolling.
    const scale = Math.min(rt.w * (mobile ? 0.82 : 0.55), 780, mobile ? Infinity : heroH * 0.87) / LOGO.unit;
    const cx = rt.w * (mobile ? 0.54 : 0.56) + (still ? 0 : Math.sin(time * 0.23) * 10);
    const cy = heroH * (mobile ? 0.46 : heroH < 790 ? 0.64 : 0.56) - (still ? 0 : Math.sin(time * 0.31 + 0.7) * 7);
    logo.scale.setScalar(scale);
    logo.position.set(cx - rt.w / 2, rt.h / 2 - (cy - rt.scroll), 120);
    // It turns a little as the first screen dissolves away.
    const turn = still ? 0 : smooth(0, heroH * 0.56, rt.scroll);
    logo.rotation.set(
      0.07 + frame.tiltX + turn * 0.10,
      -0.055 + frame.tiltY + turn * 1.05,
      -0.04 + turn * 0.07 + (still ? 0 : Math.sin(time * 0.2) * 0.012),
    );
    frame.logoX = cx;
    frame.logoY = cy;
    frame.logoScale = scale;
    // How far the glass bends the backdrop: a fixed distance on the artwork, in screen UV.
    glass.uniforms.uBend.value.set((LOGO.bend * scale) / rt.w, (LOGO.bend * scale) / rt.h);

    // Stickers. Rebuilt only when the layout class or the viewport size changes.
    const key = `${mobile}:${rt.w}:${heroH}`;
    if (key !== builtFor) {
      builtFor = key;
      buildStickers(mobile);
    }
    glass.uniforms.uEmblemCount.value = still ? Math.min(3, meshes.length) : meshes.length;
    if (still) {
      meshes.forEach((mesh, i) => {
        const spot = STILL[i];
        mesh.visible = Boolean(spot);
        if (!spot) return;
        const [x, y, angle, anchor] = mobile ? spot.mobile : spot.desktop;
        const centre = x * rt.w + (anchor * bodies[i].w) / 2;
        mesh.position.set(centre - rt.w / 2, rt.h / 2 - (y * heroH + bodies[i].h / 2 - rt.scroll), emblemDepth(rt.w) + i);
        mesh.rotation.z = (-angle * Math.PI) / 180;
        syncGlass(glass, mesh, i);
      });
      return;
    }
    world.w = rt.w;
    world.h = heroH;
    world.mobile = mobile;
    world.logoX = cx;
    world.logoY = cy;
    world.logoScale = scale;
    world.time = time;
    stepBodies(bodies, dt, world, Math.random);
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const mesh = meshes[i];
      if (mesh.userData.kind !== body.kind) dress(mesh, body);
      mesh.visible = true;
      mesh.position.set(body.x - rt.w / 2, rt.h / 2 - (body.y - rt.scroll), emblemDepth(rt.w) + i);
      mesh.rotation.z = -body.a;
      syncGlass(glass, mesh, i);
    }
  }

  return {
    group,
    update,
    /** After a lost WebGL context the simulation targets come back empty. */
    restore: () => fluid.reset(),
    dispose() {
      fluid.dispose();
      backdropMaterial.dispose();
      glass.dispose();
      closingGlass.dispose();
      closingGeometry.dispose();
      closingStickers.forEach((m) => m.dispose());
      stickerMaterials.forEach((m) => m.dispose());
      screen.dispose();
      quad.dispose();
      dotGeometry.dispose();
      assets.logo.dispose();
      if (frame.street === assets.street) frame.street = null;
      assets.street.dispose();
      assets.stickers.forEach((texture) => texture.dispose());
      group.clear();
    },
  };
}

export type Hero = ReturnType<typeof createHero>;
