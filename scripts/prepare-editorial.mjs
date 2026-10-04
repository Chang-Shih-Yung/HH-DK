// Rebuild the six individual editorials from their generated originals, without
// re-cropping the previous product atlas. Run: node scripts/prepare-editorial.mjs
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "assets/generated/prompts.json"), "utf8"));
const output = path.join(root, "assets/images/editorial");
await mkdir(output, { recursive: true });
await Promise.all(manifest.images.map(({ original, name }) =>
  sharp(path.join(root, "assets/generated", original))
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(path.join(output, `${name}.webp`)),
));
console.log("Six HH:DK editorials ready.");
