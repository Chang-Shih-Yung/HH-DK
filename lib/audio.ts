// Background music, synthesised with Web Audio: an eight-bar loop of slow chords, a soft
// bass and an electric-piano melody with a little echo. No audio file is downloaded and
// nothing is created until the visitor turns sound on.
import { setUI, ui } from "./store";

const BPM = 76;
const EIGHTH = 60 / BPM / 2;
const STEPS = 64; // 8 bars of 8 eighth-notes

// D major, IVmaj7 – iii7 – ii7 – V, then IVmaj7 – iii7 – vi7 – V. MIDI note numbers.
const CHORDS = [
  [55, 59, 62, 66],
  [54, 57, 61, 64],
  [52, 55, 59, 62],
  [57, 62, 64, 67],
  [55, 59, 62, 66],
  [54, 57, 61, 64],
  [59, 62, 66, 69],
  [57, 61, 64, 69],
];
const BASS = [43, 42, 40, 45, 43, 42, 47, 45];
// The tune, one entry per eighth-note (0 = rest), on the D-major pentatonic.
// prettier-ignore
const MELODY = [
  78, 0, 81, 0, 83, 0, 81, 78,
  76, 0, 74, 0, 69, 0, 0, 0,
  71, 0, 74, 0, 76, 0, 78, 0,
  76, 0, 0, 0, 74, 0, 76, 0,
  78, 0, 81, 0, 83, 0, 86, 83,
  81, 0, 0, 78, 0, 76, 0, 0,
  74, 0, 78, 0, 76, 0, 74, 0,
  69, 0, 0, 0, 0, 0, 0, 0,
];

const hertz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

let context: AudioContext | null = null;
let master: GainNode;
let lead: GainNode;
let pad: GainNode;
let timer: ReturnType<typeof setInterval> | undefined;
let sleep: ReturnType<typeof setTimeout> | undefined;
let step = 0;
let due = 0;

function build() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  // Melody bus with a dotted-eighth echo.
  lead = context.createGain();
  const echo = context.createDelay(1);
  const feedback = context.createGain();
  const wet = context.createGain();
  echo.delayTime.value = EIGHTH * 1.5;
  feedback.gain.value = 0.32;
  wet.gain.value = 0.3;
  lead.connect(master);
  lead.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(master);

  // Chord bus, rounded off by a low-pass filter.
  pad = context.createGain();
  const soften = context.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.value = 900;
  pad.connect(soften).connect(master);
}

/** One enveloped oscillator. It disconnects itself when it ends. */
function note(bus: AudioNode, type: OscillatorType, frequency: number, at: number, attack: number, length: number, level: number) {
  const osc = context!.createOscillator();
  const env = context!.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(level, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(bus);
  osc.start(at);
  osc.stop(at + length + 0.05);
  osc.onended = () => env.disconnect();
}

function play(index: number, at: number) {
  const bar = Math.floor(index / 8);
  if (index % 8 === 0) {
    for (const midi of CHORDS[bar]) note(pad, "triangle", hertz(midi), at, 0.5, EIGHTH * 8.6, 0.05);
    note(master, "sine", hertz(BASS[bar]), at, 0.03, EIGHTH * 6, 0.16);
  }
  if (index % 8 === 4) note(master, "sine", hertz(BASS[bar]), at, 0.03, EIGHTH * 3, 0.1);
  const midi = MELODY[index];
  if (midi) {
    // Electric-piano colour: the fundamental plus a short, quiet overtone.
    note(lead, "sine", hertz(midi), at, 0.006, 1.5, 0.17);
    note(lead, "sine", hertz(midi) * 2, at, 0.004, 0.45, 0.035);
  }
}

// Notes are queued half a second ahead on the audio clock, so timing never depends on
// how busy the page is.
function schedule() {
  if (!context) return;
  while (due < context.currentTime + 0.5) {
    play(step, due);
    step = (step + 1) % STEPS;
    due += EIGHTH;
  }
}

function start() {
  if (!context) return;
  clearTimeout(sleep);
  due = context.currentTime + 0.12;
  schedule();
  clearInterval(timer);
  timer = setInterval(schedule, 150);
  master.gain.setTargetAtTime(0.85, context.currentTime, 0.4);
}

function stop() {
  if (!context) return;
  clearInterval(timer);
  timer = undefined;
  master.gain.setTargetAtTime(0, context.currentTime, 0.25);
  sleep = setTimeout(() => context?.suspend(), 1500);
}

export async function toggleSound() {
  if (!context) build();
  const on = !ui().sound;
  setUI({ sound: on });
  if (on) {
    await context!.resume();
    start();
  } else stop();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!context || !ui().sound) return;
    if (document.hidden) stop();
    else context.resume().then(start);
  });
}
