import { STICKERS, STICKER_KINDS } from "@/lib/config";

// Falling emblems: a tiny rigid-disc simulation in plain arrays. No physics library, no
// allocation per step. Coordinates are hero-space pixels, y pointing down.
// The pointer does not touch them: they simply fall, drift and brush past each other.

export type Body = {
  kind: number;
  w: number;
  h: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  /** Emblems stay behind the glass. */
  behind: boolean;
  seed: number;
  fall: number;
  drift: number;
};

export type World = {
  w: number;
  h: number;
  mobile: boolean;
  logoX: number;
  logoY: number;
  logoScale: number;
  time: number;
  budget?: number;
  nextKind?: number;
};

const STEP = 1 / 60;

// Each return to the top takes the next design in the pool.
function dress(b: Body, world: World) {
  b.kind = (world.nextKind ?? 0) % STICKER_KINDS.length;
  world.nextKind = (world.nextKind ?? 0) + 1;
  const mobile = world.mobile;
  const spec = STICKER_KINDS[b.kind];
  b.w = mobile ? spec.mobileW : spec.w;
  b.h = mobile ? spec.mobileH : spec.h;
  b.r = Math.max(b.w, b.h) * STICKERS.bodyRadius;
}

function respawn(b: Body, world: World, random: () => number, first = false) {
  dress(b, world);
  const diagonal = random() < 0.45;
  b.fall = 20 + random() * 22;
  b.drift = diagonal ? 12 + random() * 18 : (random() - 0.5) * 9;
  b.x = diagonal ? -b.w * (0.2 + random() * 0.7) : b.w * 0.5 + random() * Math.max(1, world.w - b.w);
  b.y = diagonal ? random() * world.h * 0.32 : -b.h * 0.6 - random() * (first ? world.h * 0.25 : b.h);
  b.vx = b.drift;
  b.vy = b.fall;
  b.a = (random() - 0.5) * 1.4;
  b.va = (random() - 0.5) * 1.3;
}

export function createBodies(count: number, world: World, random: () => number): Body[] {
  world.nextKind = 0;
  world.budget = 0;
  return Array.from({ length: count }, () => {
    const body: Body = { kind: 0, w: 1, h: 1, r: 1, x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, behind: true, seed: random() * 100, fall: 30, drift: 0 };
    respawn(body, world, random, true);
    return body;
  });
}

/** Advance the simulation by `dt` seconds on a fixed step (at most three sub-steps a frame). */
export function stepBodies(bodies: Body[], dt: number, world: World, random: () => number) {
  world.budget = Math.min((world.budget ?? 0) + dt, STEP * 3);
  while (world.budget >= STEP) {
    world.budget -= STEP;
    integrate(bodies, world, random);
  }
}

function integrate(bodies: Body[], world: World, random: () => number) {
  const { spinDrag, restitution } = STICKERS;
  const ease = 1 - Math.exp(-1.2 * STEP);
  const keepSpin = Math.exp(-spinDrag * STEP);

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    // Separate, slow terminal speeds. A diagonal entry keeps its lateral drift.
    b.vx += (b.drift + Math.sin(world.time * 0.45 + b.seed) * 3 - b.vx) * ease;
    b.vy += (b.fall - b.vy) * ease;
    b.va *= keepSpin;

    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
    b.a += b.va * STEP;

    // Off the bottom: come back in from the top as the next design.
    if (b.y - b.h > world.h + 24 || b.x - b.w > world.w + 24) respawn(b, world, random);
  }

  // Emblems on the same layer bump into each other.
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.behind !== b.behind) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= reach * reach || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (reach - d) * 0.5;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approach < 0) {
        const impulse = (-(1 + restitution) * approach) / 2;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        const slide = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
        a.va -= slide * 0.004;
        b.va += slide * 0.004;
      }
    }
  }
}
