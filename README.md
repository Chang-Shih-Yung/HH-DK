# HH:DK

A single-page visual prototype for HH:DK: Japanese streetwear, cream/charcoal,
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
logo. Mobile uses DOM product photographs and a hamburger menu; desktop product
effects release offscreen texture copies. The closing horizontal 3D wordmark
reuses the opening geometry and textures instead of downloading another model.

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
