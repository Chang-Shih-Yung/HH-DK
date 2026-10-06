# HH:DK

A single-page, night-only visual prototype for HH:DK: Japanese streetwear, cream/charcoal,
vermilion, inflated glass typography and restrained motion. Product photographs
are generated proposal imagery, not an inventory or storefront.

## Run

Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Production and checks:

```sh
npm run typecheck
npm run lint
node --test tests/mobile-effects.test.mjs
npm run build
npm run start
```

## Structure

- `app/`: Next.js App Router page and global styles; Tailwind CSS 4.
- `components/sections/`: mobile-first homepage and closing sequence.
- `components/scene/`: one Three.js / React Three Fiber canvas, shared geometry,
  background-only water simulation, glass refraction and slow falling emblems.
- `lib/config.ts`: motion, quality and material parameters.
- `lib/ticker.ts`: one visibility-aware frame loop. Offscreen scenes stop drawing;
  menu/dialog states pause the canvas. Water passes sleep once ripples settle.
- `assets/images/editorial/`: six optimized HH:DK streetwear photographs.
- `assets/generated/prompts.json`: image generation prompts and source manifest.
- `public/`: compressed model and textures used by the live page.

Reduced motion keeps a static composition. WebGL failures retain a readable 2D
logo. Mobile uses native momentum scrolling and DOM photo strips, prepared in idle
time near the viewport. CSS view timelines bend the strips at fixed screen edges
where supported; a transform-only fallback preserves their native vertical scroll.
No phone photographs are copied into the WebGL canvas. Far-offscreen strips are
removed, and desktop effects release offscreen texture copies. The closing horizontal 3D wordmark
reuses the opening geometry and textures instead of downloading another model.
The closing street starts returning under the departing arrow and heading, before
the horizontal mark and final copy appear. The shared timing applies on all devices.
Invisible arrows stop drawing; invisible closing navigation stays inert.
The straight grid is independent CSS chrome above the lens and scene. The opening
mark turns during departure; the closing mark rotates in with two emblems already
behind it, then a reversible scroll trajectory throws them outward. Brighter studio
reflections and a focused moving specular light stay within the existing glass pass.

`TILT` in the mobile menu enables calibrated orientation lighting. Permission is
requested directly from the tap where the browser requires it. A single sensor
listener runs only in visible 3D sections, pauses for menus/dialogs/reduced motion,
and recalibrates after screen rotation. Sensor values stay in memory.

`SOUND` starts an HTML audio loop directly from the tap, avoiding asynchronous
module loading before mobile playback activation. The 229 KiB AAC asset is the
original synthesized composition rendered offline by `scripts/render-audio.mjs`.
It is fetched only on activation. Playback pauses in hidden pages, reuses one
player and reports a blocked/failed start instead of showing a false on state.

Approved VIS boards, previous proposals and original generated PNGs stay local
and are excluded from Git and deployment. The published assets are already
prepared: a fresh checkout does not need to run the preparation scripts.
`npm run assets` and `node scripts/prepare-editorial.mjs` are optional local
authoring tools requiring those original files.

## Deploy

The production site is hosted on Vercel. Link the intended project first, then:

```sh
vercel --prod
```

No environment variables or commerce backend are required for this prototype.
