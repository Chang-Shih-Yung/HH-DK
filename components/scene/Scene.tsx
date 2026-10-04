"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import { DIRECTION, DPR_STEPS, HERO, LAMP, LENS } from "@/lib/config";
import { directionProgress, markDirty, rt, smooth } from "@/lib/runtime";
import { setUI, ui, useUI } from "@/lib/store";
import { addTask, wake } from "@/lib/ticker";
import { createArrow } from "./arrow";
import { createHero, loadHeroAssets, type Hero } from "./hero";
import { createPhotos, type Photos } from "./photos";
import { frame, shared } from "./state";

// The only WebGL canvas on the page. It sits *under* the document (z-0, behind the
// scroller), so text and product pictures are ordinary DOM and are never re-rendered
// or distorted by it.
export default function Scene() {
  const dpr = useUI((s) => s.dpr);
  const wrap = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrap} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        orthographic
        flat
        frameloop="never"
        dpr={dpr}
        resize={{ scroll: false, debounce: 0 }}
        camera={{ position: [0, 0, 1200], near: 1, far: 3000 }}
        gl={{ antialias: true, alpha: true, stencil: false, powerPreference: "high-performance" }}
        style={{ pointerEvents: "none" }}
      >
        <Driver wrap={wrap} />
        <PhotoObjects />
        <HeroObjects />
        <ArrowObject />
      </Canvas>
    </div>
  );
}

// Runs the scene from the page's single frame loop. The canvas draws only when one of
// its two scenes is on screen, and continuously only while the hero is animating;
// otherwise it sleeps, hidden, at zero cost.
function Driver({ wrap }: { wrap: RefObject<HTMLDivElement | null> }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    let lost = false;
    let shown = true;
    let time = 0;
    let lampPlaced = false;
    // Frame-time monitor: a running average decides whether to lower the pixel ratio.
    let average = 16.7;
    let samples = 0;
    const capture = new URLSearchParams(location.search).has("capture");
    let draws = 0;
    let nextReport = 0;

    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      frame.releasePhotos?.();
    };
    const onRestored = () => {
      lost = false;
      markDirty();
      wake();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    // An idle canvas must wake for a theme/dialog change as well as for scrolling.
    const offUI = useUI.subscribe((state, previous) => {
      if (state.mode !== previous.mode || state.menuOpen !== previous.menuOpen ||
          state.lightbox !== previous.lightbox || state.reduced !== previous.reduced) {
        markDirty();
        wake();
      }
    });
    // Test-only DOM diagnostics, without changing normal rendering or publishing state.

    const stop = addTask((_, dt) => {
      const state = ui();
      const heroOn = rt.heroH > 0 && rt.scroll < rt.heroH * HERO.dissolveEnd + 1;
      const directionOn = rt.dirH > 0 && rt.scroll > rt.dirTop - rt.h && rt.scroll < rt.dirTop + rt.dirH;
      const photosOn = frame.photosOnScreen?.() ?? false;
      const visible = (heroOn || directionOn || photosOn) && !state.menuOpen && !state.lightbox && !lost;

      if (visible !== shown) {
        shown = visible;
        if (wrap.current) wrap.current.style.visibility = visible ? "visible" : "hidden";
      }
      if (capture) canvas.dataset.active = String(visible);
      if (!visible) return false;

      const closingOn = directionOn && directionProgress() > DIRECTION.streetIn[0];
      const continuous = (heroOn || closingOn) && !state.reduced;
      if (!continuous && !rt.dirty && !frame.settling) return false;
      rt.dirty = false;

      time += dt;
      frame.time = time;
      frame.dt = dt;
      frame.heroOn = heroOn;
      frame.directionOn = directionOn;
      frame.dissolve = smooth(rt.heroH * HERO.dissolveStart, rt.heroH * HERO.dissolveEnd, rt.scroll);
      frame.settling = false;

      // Pointer tilt, eased; shared by the logo and the arrow.
      const sensor = rt.tiltOn && !rt.pointerOn;
      const tx = state.reduced ? 0 : rt.pointerOn ? (1 - (rt.py / rt.h) * 2) * 0.035 : sensor ? -rt.tiltY * 0.035 : 0;
      const ty = state.reduced ? 0 : rt.pointerOn ? ((rt.px / rt.w) * 2 - 1) * 0.045 : sensor ? rt.tiltX * 0.045 : 0;
      const ease = 1 - Math.pow(0.93, dt * 60);
      frame.tiltX += (tx - frame.tiltX) * ease;
      frame.tiltY += (ty - frame.tiltY) * ease;
      if (Math.abs(tx - frame.tiltX) + Math.abs(ty - frame.tiltY) > 0.0002) frame.settling = true;

      // The lamp follows the pointer. With no pointer (phones, or the mouse has left) it
      // drifts on its own over the first screen, and rests while the arrow section is up.
      const still = state.reduced;
      const lampX = rt.pointerOn ? rt.px : sensor && !still ? rt.w * (0.5 + rt.tiltX * 0.32) : heroOn && !still ? rt.w * (0.52 + 0.3 * Math.cos(time * 0.45)) : rt.w * 0.34;
      const lampY = rt.pointerOn ? rt.py : sensor && !still ? rt.h * (0.42 + rt.tiltY * 0.25) : heroOn && !still ? rt.h * (0.42 + 0.16 * Math.sin(time * 0.62)) : rt.h * 0.3;
      if (!lampPlaced) {
        lampPlaced = true;
        frame.lampX = lampX;
        frame.lampY = lampY;
      }
      const follow = 1 - Math.pow(1 - LAMP.follow, dt * 60);
      frame.lampX += (lampX - frame.lampX) * follow;
      frame.lampY += (lampY - frame.lampY) * follow;
      if (Math.abs(lampX - frame.lampX) + Math.abs(lampY - frame.lampY) > 0.5) frame.settling = true;

      const ratio = gl.getPixelRatio();
      shared.uLamp.value.set(frame.lampX * ratio, (rt.h - frame.lampY) * ratio);
      shared.uLampHeight.value = LAMP.height * ratio;
      shared.uLampRange.value = LAMP.range * ratio;
      shared.uLampPower.value = LAMP.power;
      // The edge lens deepens a little while the page is moving.
      shared.uLens.value = LENS.strength + Math.min(LENS.boost, Math.abs(rt.velocity) / 950);
      shared.uDissolve.value = frame.dissolve;
      shared.uPitch.value = HERO.dotPitch * ratio;
      shared.uResolution.value.set(canvas.width, canvas.height);
      shared.uLight.value = state.mode === "light" ? 1 : 0;

      advance(time);
      draws++;
      if (capture && time >= nextReport) {
        nextReport = time + 0.2;
        canvas.dataset.draws = String(draws);
        canvas.dataset.phase = heroOn ? "hero" : directionOn ? "direction" : "photos";
        canvas.dataset.textures = String(gl.info.memory.textures);
        canvas.dataset.geometries = String(gl.info.memory.geometries);
        canvas.dataset.dpr = String(ratio);
      }

      if (continuous) {
        average += (dt * 1000 - average) * 0.05;
        if (++samples > 120) {
          samples = 60;
          const next = DPR_STEPS.find((step) => step < state.dpr - 0.01);
          if (average > 21 && next) {
            samples = 0;
            average = 16.7;
            setUI({ dpr: next });
          }
        }
      }
      return continuous || frame.settling;
    }, 20);

    return () => {
      stop();
      offUI();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [advance, gl, wrap]);

  return null;
}

function HeroObjects() {
  const gl = useThree((s) => s.gl);
  const [hero, setHero] = useState<Hero | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let instance: Hero | null = null;
    const onRestored = () => instance?.restore();
    gl.domElement.addEventListener("webglcontextrestored", onRestored);
    setUI({ progress: 0.2 });
    loadHeroAssets(abort.signal)
      .then((assets) => {
        instance = createHero(gl, assets);
        setHero(instance);
        setUI({ progress: 0.94 });
        markDirty();
        wake();
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        console.warn("The hero keeps its vector fallback.", error);
        setUI({ sceneFailed: true });
      });
    return () => {
      abort.abort();
      gl.domElement.removeEventListener("webglcontextrestored", onRestored);
      instance?.dispose();
      setHero(null);
    };
  }, [gl]);

  // The hero object reaches the frame callback one React commit after it is created; ask
  // for a frame then, or a page that only draws on demand (reduced motion) never shows it.
  useEffect(() => {
    if (!hero) return;
    markDirty();
    wake();
  }, [hero]);

  // The first drawn frame with the hero in it is what lifts the loader.
  useFrame(() => {
    if (!hero) return;
    hero.update();
    if (!ui().sceneReady) setUI({ sceneReady: true, progress: 1 });
  });

  return hero ? <primitive object={hero.group} /> : null;
}

// Edge-lens photographs; phones keep native images everywhere else.
function PhotoObjects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const photos = useRef<Photos | null>(null);

  useEffect(() => {
    const instance = createPhotos(gl);
    photos.current = instance;
    scene.add(instance.group);
    frame.photosOnScreen = instance.onScreen;
    frame.releasePhotos = instance.release;
    markDirty();
    wake();
    return () => {
      frame.photosOnScreen = null;
      frame.releasePhotos = null;
      photos.current = null;
      scene.remove(instance.group);
      instance.dispose();
    };
  }, [gl, scene]);

  useFrame(() => photos.current?.update());
  return null;
}

function ArrowObject() {
  // Building the arrow allocates nothing on the GPU until it is first drawn, so it can be
  // created during render; three re-uploads it by itself if it is drawn again after dispose.
  const [arrow] = useState(createArrow);
  useEffect(() => () => arrow.dispose(), [arrow]);
  useFrame(() => arrow.update());

  return <primitive object={arrow.group} />;
}
