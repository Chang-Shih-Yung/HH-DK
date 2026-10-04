import { screenTilt, type Attitude } from "./orientation";
import { markDirty, rt } from "./runtime";
import { setUI, ui, useUI } from "./store";
import { wake } from "./ticker";

type Sensor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> };
let request = 0;

/** Called directly from the visitor's click, before any async import or await. */
export async function toggleTilt() {
  const ticket = ++request;
  if (ui().tilt === "on" || ui().tilt === "asking") { setUI({ tilt: "off" }); return; }
  if (!window.isSecureContext || typeof DeviceOrientationEvent === "undefined") {
    setUI({ tilt: "unavailable" }); return;
  }
  setUI({ tilt: "asking" });
  try {
    const sensor = DeviceOrientationEvent as Sensor;
    const permission = sensor.requestPermission ? await sensor.requestPermission() : "granted";
    if (ticket !== request) return;
    setUI(permission === "granted" ? { tilt: "on", menuOpen: false } : { tilt: "denied" });
  } catch {
    if (ticket === request) setUI({ tilt: "denied" });
  }
}

/** Exactly one sensor listener, only while a visible 3D scene can use its values. */
export function mountTilt() {
  const mobile = matchMedia("(pointer: coarse), (max-width: 800px)");
  const lifetime = new AbortController();
  let listening: AbortController | null = null;
  let baseline: Attitude | null = null;
  let last = 0;
  const angle = () => screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;
  const reset = () => {
    baseline = null;
    rt.tiltOn = false;
    rt.tiltX = rt.tiltY = 0;
    markDirty(); wake();
  };
  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta + event.gamma)) return;
    const now = performance.now();
    if (now - last < 1000 / 30) return;
    last = now;
    const current = { beta: event.beta, gamma: event.gamma, angle: angle() };
    if (!baseline || baseline.angle !== current.angle) baseline = current;
    const movement = screenTilt(current, baseline);
    if (rt.tiltOn && Math.abs(rt.tiltX - movement.x) + Math.abs(rt.tiltY - movement.y) < 0.005) return;
    rt.tiltOn = true;
    rt.tiltX = movement.x;
    rt.tiltY = movement.y;
    markDirty(); wake();
  };
  const sync = () => {
    const state = ui();
    const available = mobile.matches && window.isSecureContext && typeof DeviceOrientationEvent !== "undefined";
    if (available !== state.tiltAvailable) setUI({ tiltAvailable: available });
    const active = available && state.tilt === "on" && !document.hidden && !state.reduced &&
      !state.menuOpen && !state.lightbox && !state.sceneFailed &&
      ["top", "direction", "end"].includes(state.section);
    if (active && !listening) {
      reset(); last = 0;
      listening = new AbortController();
      window.addEventListener("deviceorientation", onOrientation, { passive: true, signal: listening.signal });
    } else if (!active && listening) {
      listening.abort(); listening = null; reset();
    }
  };
  mobile.addEventListener("change", sync, { signal: lifetime.signal });
  document.addEventListener("visibilitychange", sync, { signal: lifetime.signal });
  window.addEventListener("pagehide", () => { listening?.abort(); listening = null; reset(); }, { signal: lifetime.signal });
  window.addEventListener("pageshow", sync, { signal: lifetime.signal });
  const unsubscribe = useUI.subscribe(sync);
  sync();
  return () => { ++request; unsubscribe(); lifetime.abort(); listening?.abort(); reset(); };
}
