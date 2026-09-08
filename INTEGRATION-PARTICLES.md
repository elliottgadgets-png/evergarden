# Particle field — S0/S1/S7 integration notes (v2, cycle 4)

## Files
- `src/evergarden-hero-particles.js` — one module covers S0 preloader, S1 hero, S7 outro
- `targets/` — morph-target textures: `s1-armature`, `s7-commission-book`, `s7-seal-ring` (`.png` + `.json` sidecars)
- `vendor/three.module.min.js` + `vendor/three.core.min.js` — three r180 (already integrated for the laptop)
- Harnesses: `test/particles.html` (S1), `test/outro.html` (S7), `test/preloader.html` (S0)

## Contract
```js
import { init } from './src/evergarden-hero-particles.js';
const fx = init(container, opts);   // returns handle
fx.frame(tSeconds, progress01);     // every rAF; progress01 = section-local scroll progress
fx.setMotionMode('vortex', 1.2);    // crossfade base motion ('spark' | 'vortex' | 'breathe')
fx.getState();                      // {motion, vortexMix, spark, t} for cut-free handoff
fx.targetReady;                     // true once target PNGs are decoded
fx.dispose();
```

## Options
| key | default | notes |
|---|---|---|
| quality | 'auto' | ~140k particles desktop / ~48k mobile; 'high' 200k, 'low' 40k |
| count | — | explicit override |
| motion | 'vortex' | 'spark' (S0), 'vortex' (S1), 'breathe' (S7) |
| targetUrl | targets/s1-armature.png | single-target shorthand (S1) |
| targets | — | composite array: `{url, x, y, scale, tint}`; supersedes targetUrl |
| sequence | false | morph target1 → target2 instead of composite |
| ember / steel | #E8862E / #7C8DA6 | palette override |
| initialState | — | seed uniforms from another instance's getState() |
| onReady | — | called after target decode |

## Per-section wiring

### S0 preloader (flint strike)
```js
const fx = init(el, { motion: 'spark' });   // target unused until S1; decode still warms up
// frame(t, loadProgress01): p 0→0.02 black, 0.02–0.22 flash (one ember point), 0.22–0.75 burst→swirl, 0.75–1 swirl holds
```
Transition to S1 (the AD's no-cut constraint): **keep the same instance** and call
`fx.setMotionMode('vortex', 1.6)` as S1 scrolls in — the spark swirl IS the vortex field at vortexMix=1, so the crossfade is a motion blend, not a scene swap.
If separate instances are unavoidable: `init(el2, { motion:'vortex', initialState: fxOld.getState() })` matches uniforms; particle seeds differ between instances, so prefer the single-instance path.

### S1 hero
```js
const fx = init(el, {}); // motion vortex, target s1-armature.png by default
// frame mapping: p 0–0.20 raw vortex, 0.20–0.85 morph to armature, 0.85–1 hold (ember shimmer)
```

### S7 outro (AD rulings applied: composite, RTL mirror, per-target tints)
```js
const fx = init(el, { motion: 'breathe', targets: [
  { url: 'targets/s7-commission-book.png', x:  0.38, y: -0.12, scale: 0.62, tint: 0xF4F1EA }, // book RIGHT, paper
  { url: 'targets/s7-seal-ring.png',       x: -0.56, y:  0.04, scale: 0.45, tint: 0xE8862E }, // seal LEFT, ember
]});
// frame mapping: p 0–0.10 drift, 0.10–0.60 gather, 0.60–1 calm hold (breath pulse)
// (sequence:true = alternative staging: book forms, then reforms into the seal — not AD-selected)
```

### S6 kiln (אור)
```js
const fx = init(el, { motion: 'rise' });
// frame mapping: p 0-0.05 banked glow, 0.05-0.45 kiln ramps up, 0.45-1 full rising heat
fx.setHeat(nx, ny);   // draggable heat source, normalized view coords (-1..1);
                      // near it particles rise faster and burn hotter
```
## Target texture encoding
512×512 PNG; RGB = XYZ normalized −1..1 (`.json` sidecar has bbox + sample count); A=255 = occupied.
Cloud is pre-tiled with jitter: every texel maps to a valid point, so any particle count works.
Regenerate/extend with `node tools-gen/gen-targets.mjs`.

## Notes
- Transparent canvas; page owns backgrounds (#0A0806 S0, #14100C→#0A0806 S1/S7).
- Additive blending; DPR capped 2 (1.5 on 'low').
- Until `targetReady`, morph clamps to the base motion — no pop on slow networks.
- No network calls beyond its own target PNGs.
- Not yet measured on a real device — please check fps on a mid-range phone once wired.
