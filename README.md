# Axiom — SaaS Landing Page

A premium, deeply interactive landing page for a fictional AI tools platform.
Built with **zero runtime dependencies** — plain HTML, modern CSS, and vanilla
ES modules. No build step: clone and serve.

## Run it

```bash
# any static server works
python3 -m http.server 8000
# → http://localhost:8000
```

Or deploy the folder as-is to Netlify, Vercel, Cloudflare Pages, or GitHub Pages.

## What's inside

| Interaction | How it works |
| --- | --- |
| **Dynamic hero background** | Canvas particle constellation that drifts, links nearby particles, follows the pointer, and slows/tints as you scroll away. Aurora gradient blobs parallax at independent depths with scroll-driven hue rotation. |
| **Scroll-choreographed hero** | A single rAF scroll loop writes `--hero-progress`; CSS consumes it to drift, scale, and fade the headline, grid, and product shot. |
| **SVG journey track** | The "How it works" path is drawn by scroll (`stroke-dashoffset` from `getTotalLength()`), with a glowing dot riding the curve via `getPointAtLength()`. Step cards ignite as the line reaches them. |
| **Feature cards** | IntersectionObserver reveal with automatic stagger, cursor-tracking spotlight + gradient border glow, springy icon hover. |
| **Pricing toggle** | Accessible `role="switch"` monthly/annual toggle with price flip animation and per-plan billing notes. |
| **Micro-interactions** | Magnetic buttons, shine sweep on CTAs, underline-sweep links, 3D tilt + glare on the hero visual, animated counters, nav that shrinks and hides/reveals with scroll direction, scrollspy, scroll progress bar. |
| **Lazy loading** | `data-src` images swap in via IntersectionObserver (300px lookahead) with a fade/scale-in once loaded. |

## Performance & accessibility

- One unified `requestAnimationFrame` scroll loop — a single `scrollY` read per
  frame fanned out to all subscribers; no layout thrash.
- The hero canvas pauses entirely when off-screen (IntersectionObserver).
- `prefers-reduced-motion` collapses every animation to a static, fully legible page.
- Pointer-dependent effects (tilt, magnetic, spotlight) only activate on
  `pointer: fine` devices.
- Semantic landmarks, focus-visible styles, ARIA on the menu and billing switch.

## Structure

```
index.html        — single-page markup
css/styles.css    — design tokens, layout, all animation styles
js/main.js        — interaction engine (13 small, isolated modules)
assets/           — hand-drawn SVG product art (dashboard, journey steps, avatars)
```
