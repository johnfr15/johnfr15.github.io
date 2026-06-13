# CLAUDE.md

GitHub Pages portfolio for John (École 2600). Each project ("rendu") = a 3D
environment + soutenance slides. Slides are written in Marp markdown, built
to PDF, and shown as a 3D wheel; slides bind to 3D models so the camera flies
to what's being explained. No build step for JS — plain ES modules + CDN.

Aesthetic: phosphor-amber CRT terminal. Colors `#ffb000` on `#0b0a08`,
fonts Syne (display) + IBM Plex Mono. Keep ALL new UI in this language.

## The two engines

### Landing page (`index.html` + `assets/site.css`)
Fetches `projects.json` at runtime, renders project cards. Nothing fancy.
Needs an HTTP server (fetch fails over `file://`).

### Soutenance engine (`assets/viewer.js`, ~450 lines, the core)
One shared ES module driving every project page. Pipeline:

1. **Config**: reads `window.RENDU` set by the project's `index.html`:
   `{ title, pdf, scene, bindings, backLink }`. `three` comes from an
   importmap in the project page; pdf.js is dynamically imported from CDN.
2. **Scene loading** (`loadScene`): dynamic-imports the project's `scene.js`
   (resolved against `document.baseURI`, not viewer.js). Module contract:
   `export build({ THREE, root }) → { targets, update? }`. Project meshes go
   in `root` (a Group); engine decorations (grid, dust, lights, focus box)
   live in `engineGroup` so dimming never touches them. No `scene` config →
   fallback wireframe icosahedron. After build, every mesh in `root` gets
   its material **cloned** (per-mesh dimming) and base opacity/emissive
   stashed in `userData`. Two window hooks bridge engine↔scene: the engine
   sets `window.__RENDU_FOCUS__` = current target names (scene `update()`
   reads it to react to the active slide); the scene may set
   `window.__RENDU_VIEW__ = {center:[x,y,z], radius}` to drive the camera
   per-frame (e.g. follow an animated packet), or `null` to release it.
   See `projects/ot-ics-td3/scene.js` for the scripted attack-packet fly-along.
3. **PDF → wheel** (`loadPdf` + `layoutWheel`): pdf.js rasterizes each page
   to a 1100px-wide `<canvas>`, wrapped in `.slide-card` divs inside the
   fixed `#wheel` container (right 30vw). The wheel is **pure DOM/CSS, not
   WebGL**: cards transform by offset from current slide (translateY/Z,
   rotateX, scale, opacity falloff), parent has `perspective`, CSS
   transitions animate the motion. Slides are rasterized once at load.
4. **Bindings / focus** (`resolveBinding` + `setFocus`): `bindings` maps
   1-based slide number → target name(s) from `scene.js`. Unbound slide =
   **sticky** (keeps previous focus). Focus computes a Box3 of the bound
   objects, frames its bounding sphere (distance from fov + a usable-aspect
   estimate that accounts for the wheel), dims all other meshes to 0.16
   opacity, adds a pulsing `Box3Helper`, boosts emissive on focused meshes.
   Focusing `root` itself = overview = no box, nothing dimmed.
5. **Camera rig**: damped spherical orbit `{ center, radius, azimuth,
   elevation }` lerping toward targets each frame + slow idle drift + mouse
   parallax. **`camera.setViewOffset`** shifts the frustum right so the
   focused model frames in the left ~70% (wheel covers the right). Recompute
   on resize (`applyViewOffset`).

### Marp pipeline
`projects/*/slides.md` → `slides.pdf` via marp-cli with the custom theme
`assets/marp-theme.css` (`/* @theme phosphor2600 */`, imports `default`).
Built by `./build.sh` locally (needs Chrome) and by
`.github/workflows/deploy.yml` on push (then deploys whole tree to Pages —
Pages source must be set to "GitHub Actions"). A project may ship a
hand-exported `slides.pdf` with no `.md`; the build loops only over
existing `slides.md`, so don't blanket-gitignore `slides.pdf`.

## Adding a project (the invariant set)
`projects/<slug>/` needs: `slides.md` (or a raw `slides.pdf`), `index.html`
(copy demo's: sets `window.RENDU` + importmap), optional `scene.js`, plus
one entry in `projects.json`. `projects/demo/` is the canonical template —
keep it working; it's both the doc and the test fixture.

## Testing
Playwright (python, installed) against `python3 -m http.server`. Pattern
that works: load `/projects/demo/`, wait ~6s (pdf render + loader fade),
screenshot, send ArrowRight, assert `.counter` text, collect console
errors. Heads-up: `with_server.py` from the webapp-testing skill was flaky
here; a backgrounded http.server + `pkill` works (exit code 144 = pkill,
harmless).

## Gotchas
- pdf.js version is pinned in viewer.js (`PDFJS_VERSION`); worker set via
  `GlobalWorkerOptions.workerSrc`. three.js pinned in each project's
  importmap (0.160.0).
- `wheelShare()` and the viewOffset must stay consistent with `.wheel`
  width in viewer.css (30vw desktop / 38vw mobile).
- Slide wheel cards assume 16:9-ish decks (vertical centering uses a
  0.281 aspect constant in viewer.css).
- Target `dir` is the camera approach direction (world, normalized by
  engine); `distanceScale` < 1 zooms in, default 1.25.
- 2026-06-12: the working tree was wiped once (incl. `.git`) and fully
  rebuilt from a Claude session; history before that is gone.
