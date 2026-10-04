// Vector sticker artwork for the falling emblems: retro Japanese-mark vocabulary (sun disc,
// rings, boxed letters, halftone) built around the approved HH:DK wordmark paths.
// `npm run assets` writes each as SVG (assets/stickers, the editable source) and as a
// PNG texture (public/stickers).
import { readFile } from "node:fs/promises";

const RED = "#ef3710";
const INK = "#1b1a17";
const CREAM = "#f9f4e6";

export async function buildStickers(wordmarkSvgPath) {
  const source = await readFile(wordmarkSvgPath, "utf8");
  // Path order in the approved file: D, K, second H, first H, colon top, colon bottom.
  const [D, K, H2, H1, DOT1, DOT2] = [...source.matchAll(/<path\b[^>]*d="([^"]+)"/g)].map((m) => `<path d="${m[1]}"/>`);
  const WORDMARK = H1 + H2 + DOT1 + DOT2 + D + K;
  const BOX = { H1: [500, 688], H2: [700, 886], D: [962, 1152], K: [1162, 1348] };
  const LETTER = { H1, H2, D, K };

  /** The whole wordmark, `width` wide, with its top-left corner at (x, y). */
  const mark = (x, y, width, fill) => `<g transform="translate(${x} ${y}) scale(${width / 858}) translate(-500 -186)" fill="${fill}">${WORDMARK}</g>`;
  /** One letter of the wordmark, `height` tall, centred on (cx, cy). */
  const letter = (name, cx, cy, height, fill) => {
    const [x0, x1] = BOX[name];
    return `<g transform="translate(${cx} ${cy}) scale(${height / 138.7}) translate(${-(x0 + x1) / 2} -258.8)" fill="${fill}">${LETTER[name]}</g>`;
  };
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

  // Halftone sun: dots shrink towards the rim.
  let dots = "";
  for (let gy = 0; gy < 15; gy++)
    for (let gx = 0; gx < 15; gx++) {
      const x = 120 + (gx - 7) * 12.5;
      const y = 116 + (gy - 7) * 12.5;
      const d = Math.hypot(x - 120, y - 116) / 86;
      const r = 5.9 * Math.max(0, 1 - d ** 2.3);
      if (r > 0.7) dots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"/>`;
    }

  // Sunburst ticks between the two rings of the stamp.
  let rays = "";
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const [c, n] = [Math.cos(a), Math.sin(a)];
    rays += `<line x1="${(150 + c * 99).toFixed(1)}" y1="${(150 + n * 99).toFixed(1)}" x2="${(150 + c * 122).toFixed(1)}" y2="${(150 + n * 122).toFixed(1)}" stroke="${RED}" stroke-width="${i % 5 === 0 ? 6 : 3}"/>`;
  }

  return [
    {
      name: "sun",
      width: 288,
      svg: svg(
        300,
        300,
        `<rect x="4" y="4" width="292" height="292" rx="36" fill="${CREAM}"/>` +
          `<circle cx="150" cy="118" r="66" fill="${RED}"/>` +
          mark(36, 204, 228, INK) +
          `<rect x="36" y="254" width="228" height="7" fill="${INK}"/>`,
      ),
    },
    {
      name: "ring",
      width: 300,
      svg: svg(
        300,
        300,
        `<circle cx="150" cy="150" r="146" fill="${CREAM}"/>` +
          `<circle cx="150" cy="150" r="135" fill="none" stroke="${RED}" stroke-width="6"/>` +
          `<circle cx="150" cy="150" r="88" fill="none" stroke="${RED}" stroke-width="3"/>` +
          `<circle cx="150" cy="150" r="46" fill="${RED}"/>` +
          rays,
      ),
    },
    {
      name: "boxed",
      width: 450,
      svg: svg(
        420,
        116,
        `<rect x="3" y="3" width="414" height="110" rx="16" fill="${CREAM}"/>` +
          [16, 110, 226, 320].map((x) => `<rect x="${x}" y="16" width="84" height="84" fill="none" stroke="${RED}" stroke-width="5"/>`).join("") +
          letter("H1", 58, 58, 50, INK) +
          letter("H2", 152, 58, 50, INK) +
          letter("D", 268, 58, 50, INK) +
          letter("K", 362, 58, 50, INK) +
          `<circle cx="210" cy="44" r="8" fill="${RED}"/><circle cx="210" cy="72" r="8" fill="${RED}"/>`,
      ),
    },
    {
      name: "pill",
      width: 132,
      svg: svg(
        130,
        340,
        `<rect x="3" y="3" width="124" height="334" rx="34" fill="${INK}"/>` +
          `<circle cx="65" cy="52" r="17" fill="${RED}"/>` +
          `<g transform="translate(65 198) rotate(90) scale(0.268) translate(-929 -259)" fill="${CREAM}">${WORDMARK}</g>`,
      ),
    },
    {
      name: "halftone",
      width: 252,
      svg: svg(
        240,
        300,
        `<rect x="3" y="3" width="234" height="294" rx="14" fill="${CREAM}"/>` +
          `<rect x="14" y="14" width="212" height="272" fill="none" stroke="${RED}" stroke-width="3"/>` +
          `<g fill="${RED}">${dots}</g>` +
          `<rect x="28" y="226" width="184" height="44" fill="${RED}"/>` +
          mark(42, 235.5, 156, CREAM),
      ),
    },
  ];
}
