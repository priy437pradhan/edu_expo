# OTV Education Expo — "The Long Hall" (Direction F)

A scroll-driven WebGL landing page. Everything is local — **no internet
connection or build step required.** Just serve the folder.

## Run it

Any static server works (the page uses `fetch`/WebGL, so opening the file
with `file://` directly will not load — serve over `http://`):

- **VS Code Live Server:** right-click `index.html` → "Open with Live Server".
- **Python:** `python3 -m http.server` then open the shown URL.
- **Node:** `npx serve` (or any static host).

## Structure

```
index.html      Markup + page logic (smooth-scroll, ScrollTrigger, form, menu)
styles.css      All styles (design tokens live in :root at the top)
scene.js        The Three.js gallery corridor (window.initLongHall)
vendor/         Pinned libraries (three r128, gsap 3.12.5, ScrollTrigger, lenis 1.1.14)
assets/
  otv-logo.png
  gallery/      The 9 corridor photographs
```

## Notes for smooth performance

- **Gallery images are pre-optimised** (resized to 1920px wide, ~0.5–1MB each).
  The originals were 8–23MB; keep replacements lightweight or the scroll will
  stutter while textures decode.
- Smooth scrolling is driven by **Lenis** + GSAP `ScrollTrigger` (see the
  bottom script in `index.html`). Do **not** add `scroll-behavior: smooth` in
  CSS — it fights Lenis and causes jank.
- The WebGL renderer caps `devicePixelRatio` at 1.5 and avoids
  `preserveDrawingBuffer` for performance (`scene.js`).
- Respects `prefers-reduced-motion`: animations and smooth-scroll are skipped
  when the user has that OS setting on.

## Design tokens

Colours and fonts are CSS custom properties in `styles.css` `:root`
(`--paper`, `--ink`, `--accent`, `--accent-2`, `--serif`, `--grotesk`).
Fonts (Cormorant Garamond + Hanken Grotesk) load from Google Fonts via a
`<link>` in `index.html` — swap for self-hosted files if you need full offline
typography.
