# EVERGARDEN — גן שגדל לנצח

A living website that is never finished. Every cycle it grows: new sections,
new interactions, new shaders. Everything is hand-built from scratch —
our own JS, our own shaders, our own procedural growth. No templates.

## Run

Static site, no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Seeds (editions)

- **seed 001** — foundation: living WebGL sky, virtual smooth-scroll,
  manifesto reveal, interactive particle field, scroll-grown procedural tree.

## Structure

- `index.html` — the whole garden's skeleton
- `css/style.css` — all styling
- `js/sky.js` — domain-warped fbm WebGL shader, mouse-reactive
- `js/field.js` — perlin-flow particle field with pointer physics
- `js/growth.js` — deterministic recursive tree, drawn by scroll progress
- `js/main.js` — boot, preloader, virtual scroll, cursor, reveal choreography
