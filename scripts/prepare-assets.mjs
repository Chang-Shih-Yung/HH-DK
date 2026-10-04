// One-off asset preparation. Reads the approved sources in legacy/assets and writes
// web-ready files for the Next.js app. Run with `npm run assets`.
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { buildStickers } from "./stickers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => path.join(root, "legacy/assets", p);
const out = (p) => path.join(root, p);

await Promise.all(
  ["assets/images/products", "assets/stickers", "public/models", "public/stickers", "public/textures", "lib/generated"].map((d) =>
    mkdir(out(d), { recursive: true }),
  ),
);

// 1. Product atlas (3 × 2) → six square files, so each card decodes only its own picture.
const products = ["nylon-bag", "silver-ring", "daily-cap", "night-layer", "city-pair", "on-the-move"];
const atlas = sharp(src("scene/product-edit.png"));
const { width: aw, height: ah } = await atlas.metadata();
const cell = Math.floor(aw / 3);
await Promise.all(
  products.map((name, i) =>
    atlas
      .clone()
      .extract({ left: (i % 3) * cell, top: Math.floor(i / 3) * Math.floor(ah / 2), width: cell, height: Math.floor(ah / 2) })
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(out(`assets/images/products/${String(i + 1).padStart(2, "0")}-${name}.jpg`)),
  ),
);

// 2. Street photographs for next/image (it produces the responsive AVIF/WebP variants).
await copyFile(src("scene/street-evening.jpg"), out("assets/images/street-evening.jpg"));
await copyFile(src("scene/crossing-bluehour.jpg"), out("assets/images/crossing-bluehour.jpg"));

// 3. Hero water texture. It is shown very dark and desaturated, so WebP at two widths is plenty.
for (const width of [1024, 640]) {
  await sharp(src("scene/crossing-atmosphere.jpg"))
    .resize({ width })
    .webp({ quality: 72 })
    .toFile(out(`public/textures/atmosphere-${width}.webp`));
}

// 4. Falling stickers: vector emblems only. Three approved brand stickers, plus the
//    marks drawn in scripts/stickers.mjs. No photographs.
for (const name of ["badge-front", "badge-back", "ticket"]) {
  await sharp(src(`brand/${name}.png`)).resize({ width: 320 }).png({ compressionLevel: 9 }).toFile(out(`public/stickers/${name}.png`));
}
for (const sticker of await buildStickers(src("brand/wordmark.svg"))) {
  await writeFile(out(`assets/stickers/${sticker.name}.svg`), sticker.svg);
  await sharp(Buffer.from(sticker.svg), { density: 288 })
    .resize({ width: sticker.width })
    .png({ compressionLevel: 9 })
    .toFile(out(`public/stickers/${sticker.name}.png`));
}

// 5. Pre-baked inflated logo (the light LOD is visually identical at page size).
await copyFile(src("brand/models/puff-low.bin.gz"), out("public/models/puff-low.bin.gz"));

// 6. Signed distance field of the logo outline, used as the sticker collider.
//    Grid cells are 5 logo units; the two colon dots are added analytically.
{
  const GW = 136, GH = 88, SCALE = 680 / GW;
  const alpha = await sharp(src("brand/models/outline-mask.png")).resize(GW, GH, { fit: "fill" }).ensureAlpha().extractChannel("alpha").raw().toBuffer();
  const inside = new Uint8Array(GW * GH);
  const dots = [[437 - 393, 750 - 464], [437 - 393, 836 - 464]];
  for (let y = 0; y < GH; y++)
    for (let x = 0; x < GW; x++) {
      const cx = (x + 0.5) * SCALE, cy = (y + 0.5) * SCALE;
      inside[y * GW + x] = alpha[y * GW + x] > 127 || dots.some(([dx, dy]) => Math.hypot(cx - dx, cy - dy) < 38) ? 1 : 0;
    }
  // Felzenszwalb & Huttenlocher exact squared Euclidean distance transform.
  const edt1d = (f, n) => {
    const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    let k = 0;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s;
      do {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
      } while (s <= z[k] && --k >= 0);
      k++;
      v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + f[v[k]];
    }
    return d;
  };
  const edt = (seed) => {
    const INF = 1e12, g = new Float64Array(GW * GH);
    for (let i = 0; i < g.length; i++) g[i] = seed[i] ? 0 : INF;
    for (let x = 0; x < GW; x++) {
      const col = new Float64Array(GH);
      for (let y = 0; y < GH; y++) col[y] = g[y * GW + x];
      const d = edt1d(col, GH);
      for (let y = 0; y < GH; y++) g[y * GW + x] = d[y];
    }
    for (let y = 0; y < GH; y++) {
      const d = edt1d(g.subarray(y * GW, (y + 1) * GW), GW);
      g.set(d, y * GW);
    }
    return g;
  };
  const toInside = edt(inside);
  const toOutside = edt(inside.map((v) => 1 - v));
  // Stored as uint8: distance in cells, range −8 … +23.875, 1/8 cell precision.
  const bytes = new Uint8Array(GW * GH);
  for (let i = 0; i < bytes.length; i++) {
    const sd = inside[i] ? 0.5 - Math.sqrt(toOutside[i]) : Math.sqrt(toInside[i]) - 0.5;
    bytes[i] = Math.max(0, Math.min(255, Math.round((sd + 8) * 8)));
  }
  await writeFile(
    out("lib/generated/logo-sdf.ts"),
    `// Generated by scripts/prepare-assets.mjs — do not edit.\n` +
      `export const LOGO_SDF = { width: ${GW}, height: ${GH}, cell: ${SCALE}, bias: 8, scale: 8, data: "${Buffer.from(bytes).toString("base64")}" } as const;\n`,
  );
}

console.log("assets ready");
