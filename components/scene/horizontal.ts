import * as THREE from "three";

// Reuse the four baked, inflated letter surfaces. Rearrange them to the approved
// horizontal wordmark's measured contours; no extra model download or runtime meshing.
const LETTERS = [
  { source: [-229.010, 40.645, 8.481, 211.316], target: [-425, -241, -68, 69] },
  { source: [59.284, 331.681, 9.732, 211.322], target: [-228, -44, -68, 69] },
  { source: [-230.368, 50.059, -215.701, -11.491], target: [33, 223, -68, 70] },
  { source: [60.668, 333.056, -215.688, -11.497], target: [234, 423, -69, 69] },
] as const;

export function horizontalGeometry(source: THREE.BufferGeometry) {
  const geometry = source.clone();
  const positions = geometry.getAttribute("position");
  // Normalise packed normals to floats before their inverse-scale transform.
  const sourceNormals = source.getAttribute("normal");
  const normals = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    const letter = LETTERS[(y > 0 ? 0 : 2) + (x > 55 ? 1 : 0)];
    const [sx0, sx1, sy0, sy1] = letter.source;
    const [tx0, tx1, ty0, ty1] = letter.target;
    const sx = (tx1 - tx0) / (sx1 - sx0), sy = (ty1 - ty0) / (sy1 - sy0);
    const sz = Math.min(sx, sy);
    positions.setXYZ(i, tx0 + (x - sx0) * sx, ty0 + (y - sy0) * sy, positions.getZ(i) * sz);
    normal.set(sourceNormals.getX(i) / sx, sourceNormals.getY(i) / sy, sourceNormals.getZ(i) / sz).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  geometry.setAttribute("normal", normals);
  geometry.computeBoundingSphere();
  return geometry;
}
