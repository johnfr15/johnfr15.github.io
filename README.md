# johnfr15.github.io

Personal site hosting my École 2600 school projects. Each project ("rendu")
is a **3D environment** of the project's components plus the **soutenance
slides** (written in Markdown, built to PDF with [Marp](https://marp.app))
shown as a scrollable wheel on the right. Slides can be **bound to models**:
when a slide comes up, the camera flies to the component it explains and
highlights it.

Live at **https://johnfr15.github.io**

## Structure

```
index.html                 landing page (reads projects.json)
projects.json              project registry
build.sh                   build all decks locally (Marp → PDF)
.github/workflows/
  deploy.yml               CI: build Marp decks + deploy to Pages
assets/
  site.css                 landing page styles
  viewer.css               viewer chrome (HUD, slide wheel, loader)
  viewer.js                the 3D soutenance engine (Three.js + PDF.js)
  marp-theme.css           "phosphor2600" Marp theme (matches the site)
projects/
  <slug>/
    slides.md              the deck, written in Marp markdown
    slides.pdf             built artifact (generated, no need to commit)
    scene.js               the project's 3D scene (optional)
    index.html             per-project page: title + slide↔model bindings
```

## Add a new project

1. Create a folder and write your deck in Markdown:

   ```sh
   mkdir projects/my-project
   cp projects/demo/slides.md projects/my-project/slides.md   # starting point
   ```

   Frontmatter selects the site theme (`theme: phosphor2600`). Useful
   per-slide directives: `<!-- _class: lead -->` (title slide),
   `<!-- _class: invert -->` (amber slide), `<!-- _paginate: false -->`.

2. Model the 3D environment in `scene.js` (optional — without it you get a
   neutral backdrop). Contract:

   ```js
   export function build({ THREE, root }) {
     const api = new THREE.Group();
     // ...build meshes, add them into `root`...
     root.add(api);

     return {
       targets: {
         // name → what the camera frames when a slide binds to it
         overview: { objects: [root], dir: [0.7, 0.8, 1], distanceScale: 0.8 },
         api,                              // Object3D or [Object3D] also fine
       },
       update(time, dt) { /* optional per-frame animations */ },
     };
   }
   ```

   Target spec options: `objects` (what to frame + highlight), `dir`
   (camera approach direction), `distanceScale` (zoom, default 1.25).

3. Copy the demo page, set the title and the **bindings** (slide number →
   target). A slide without a binding keeps the previous focus:

   ```js
   window.RENDU = {
     title: "My project",
     pdf: "slides.pdf",
     scene: "scene.js",
     bindings: { 1: "overview", 3: "api", 5: ["api", "db"] }
   };
   ```

4. Register it in `projects.json`:

   ```json
   { "slug": "my-project", "title": "My project",
     "subtitle": "One-line description", "year": "2026", "tags": ["ctf"] }
   ```

5. Push. The GitHub Action builds every `projects/*/slides.md` into
   `slides.pdf` and deploys — live at `/projects/my-project/`.

> Already have a PDF (exported from elsewhere)? Skip `slides.md` and just
> drop the file in as `slides.pdf` — the workflow leaves it untouched.

## Write & preview locally

```sh
# live-reload preview of a deck while writing
npx @marp-team/marp-cli -s --theme-set assets/marp-theme.css projects/

# build all decks to PDF (needs Chrome/Chromium installed)
./build.sh

# serve the site (fetch + PDF.js don't work over file://)
python3 -m http.server 8000
```

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`: it builds all
Marp decks, then publishes the whole tree to GitHub Pages.

**One-time setup**: in the repo settings, set *Pages → Build and deployment →
Source* to **GitHub Actions** (instead of "Deploy from a branch").

## Tech

- [Marp](https://marp.app) — Markdown → PDF slides, custom `phosphor2600` theme
- [Three.js](https://threejs.org) — 3D scenes (CDN, no build step)
- [PDF.js](https://mozilla.github.io/pdf.js/) — renders PDF pages for the wheel
- Plain HTML/CSS/JS, deployed by GitHub Actions
