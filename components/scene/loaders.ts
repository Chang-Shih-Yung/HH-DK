import * as THREE from "three";
import { LOGO } from "@/lib/config";

// The inflated logo surface is baked offline (legacy/tools/build-puff.py). Visitors download
// one compact file — quantised positions, packed normals, indices — and decode it once.
export async function loadLogoGeometry(signal: AbortSignal, onProgress: (share: number) => void) {
  const response = await fetch(LOGO.url, { signal });
  if (!response.ok || !response.body) throw new Error("Logo model unavailable");

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(1, received / LOGO.bytes));
  }

  // Some hosts send .gz with Content-Encoding and the browser has already inflated it.
  let stream = new Blob(chunks).stream();
  if (chunks[0]?.[0] === 0x1f && chunks[0]?.[1] === 0x8b) stream = stream.pipeThrough(new DecompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  signal.throwIfAborted();

  const header = new DataView(buffer);
  const count = header.getUint32(0, true);
  const indexCount = header.getUint32(4, true);
  const packed = new Uint16Array(buffer, 8, count * 3);
  const normals = new Int16Array(buffer, 8 + count * 6, count * 3);
  const indices = new Uint32Array(buffer, 8 + count * 12, indexCount);

  // The artwork is authored y-down. Flip it here once (positions, normals, winding) so the
  // mesh needs no mirrored transform at draw time.
  const [min, max] = LOGO.bounds;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3;
    const value = min[axis] + (packed[i] / 65535) * (max[axis] - min[axis]);
    positions[i] = axis === 1 ? -value : value;
    if (axis === 1) normals[i] = Math.max(-32767, -normals[i]);
  }
  for (let i = 0; i < indexCount; i += 3) {
    const swap = indices[i + 1];
    indices[i + 1] = indices[i + 2];
    indices[i + 2] = swap;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

// A plain image element, decoded before upload so the first frame that shows it does not
// stall. (ImageBitmap would also work, but its orientation options are unreliable on older
// iOS and in-app browsers — the phones this page is reviewed on.)
export async function loadTexture(url: string, signal: AbortSignal) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  signal.throwIfAborted();
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
