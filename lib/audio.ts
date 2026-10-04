// A pre-rendered HH:DK composition. A tap starts HTML media playback synchronously.
// Importing this module downloads no music and creates no player.
import { setUI } from "./store";
let player: HTMLAudioElement | null = null;
let desired = false;
let revision = 0;
let deadline: ReturnType<typeof setTimeout> | undefined;
let events: AbortController | null = null;
function clearDeadline() { clearTimeout(deadline); deadline = undefined; }
function fail(ticket: number) {
  if (ticket !== revision) return;
  desired = false; clearDeadline(); player?.pause();
  setUI({ sound: false, soundLoading: false, soundError: true });
}
function build() {
  const audio = player = new Audio("/audio/street-loop.m4a");
  audio.preload = "none"; audio.loop = true; audio.volume = 0.55;
  audio.setAttribute("playsinline", "");
  audio.id = "hhdk-ambient-audio";
  audio.hidden = true;
  document.body.append(audio);
  events = new AbortController();
  audio.addEventListener("playing", () => {
    if (!desired || document.hidden) { audio.pause(); return; }
    clearDeadline(); setUI({ sound: true, soundLoading: false, soundError: false });
  }, { signal: events.signal });
  audio.addEventListener("pause", () => setUI({ sound: false, soundLoading: false }), { signal: events.signal });
  audio.addEventListener("error", () => fail(revision), { signal: events.signal });
  return audio;
}
function play() {
  const ticket = ++revision;
  const audio = player ?? build();
  clearDeadline(); setUI({ soundLoading: true, soundError: false });
  // No async import or await before play: preserve the visitor's tap activation.
  const result = audio.play();
  deadline = setTimeout(() => fail(ticket), 10000);
  result?.catch(() => fail(ticket));
}
export function toggleSound() {
  if (desired) {
    desired = false; ++revision; clearDeadline(); player?.pause();
    setUI({ sound: false, soundLoading: false });
  } else {
    desired = true;
    try { play(); } catch { fail(revision); }
  }
}
export function mountAudioLifecycle() {
  const lifetime = new AbortController();
  const pause = () => {
    ++revision; clearDeadline(); player?.pause();
    setUI({ sound: false, soundLoading: false });
  };
  const resume = () => { if (desired && !document.hidden) { try { play(); } catch { fail(revision); } } };
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : resume(), { signal: lifetime.signal });
  window.addEventListener("pagehide", pause, { signal: lifetime.signal });
  window.addEventListener("pageshow", resume, { signal: lifetime.signal });
  return () => {
    lifetime.abort(); desired = false; pause(); events?.abort(); events = null;
    player?.removeAttribute("src"); player?.load(); player?.remove(); player = null;
  };
}
