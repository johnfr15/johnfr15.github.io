/* ── 3D soutenance engine ──────────────────────────────────────────────
 *
 * A project page is a 3D environment + a slide wheel (right side).
 * Slides can be bound to models in the scene: when the slide changes,
 * the camera flies to the bound target(s) and highlights them.
 *
 * Per-project config (see projects/demo/index.html):
 *
 *   window.RENDU = {
 *     title: "My project",
 *     pdf: "slides.pdf",
 *     scene: "scene.js",            // optional 3D scene module
 *     bindings: {                   // optional: slide number → target(s)
 *       1: "overview",
 *       3: ["api", "db"],
 *     }
 *   };
 *
 * Scene module contract (see projects/demo/scene.js):
 *
 *   export function build({ THREE, root }) {
 *     // add Object3Ds to `root`, then:
 *     return {
 *       targets: {
 *         overview: { objects: [root], dir: [1, .6, 1] },
 *         api:      apiGroup,        // Object3D, [Object3D], or spec
 *       },
 *       update(time, dt) { ... }     // optional per-frame hook
 *     };
 *   }
 * ──────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';

const PDFJS_VERSION = '4.6.82';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;

const CONFIG = Object.assign(
  { title: document.title || 'rendu', pdf: 'slides.pdf', scene: null, bindings: {}, backLink: '../../' },
  window.RENDU || {}
);

const PHOSPHOR = 0xffb000;
const DIM_OPACITY = 0.16;

// slide-overlay state the controller drives (declared early: wheelShare()
// runs during module init, before the slides-engine block below).
const SCALE_MIN = 0.65, SCALE_MAX = 1.6;
let slideScale = 1;       // controller-driven slide size (× the base wheel share)
let presenting = false;   // slides fullscreen / presentation mode

/* ── DOM chrome ───────────────────────────────────────────────────── */

document.title = `${CONFIG.title} — rendu /2600`;

document.body.insertAdjacentHTML('beforeend', `
  <div class="loader" id="loader">
    <div class="glyph">/2600</div>
    <div class="label" id="loader-label">loading rendu</div>
    <div class="track"><div class="fill" id="loader-fill"></div></div>
  </div>
  <div class="crt-overlay"></div>
  <div class="hud">
    <a class="back" href="${CONFIG.backLink}">&larr; index</a>
    <div class="title">${CONFIG.title}</div>
    <div class="hint">scroll / arrows — slides drive the camera</div>
    <div class="counter"><span class="current" id="counter-current">01</span> / <span id="counter-total">--</span></div>
    <div class="progress"><div class="bar" id="progress-bar"></div></div>
  </div>
  <div class="stage" id="stage" aria-hidden="true"></div>
  <div class="wheel" id="wheel"></div>
`);

const loaderEl = document.getElementById('loader');
const loaderLabel = document.getElementById('loader-label');
const loaderFill = document.getElementById('loader-fill');
const counterCurrent = document.getElementById('counter-current');
const counterTotal = document.getElementById('counter-total');
const progressBar = document.getElementById('progress-bar');
const wheelEl = document.getElementById('wheel');
const stageEl = document.getElementById('stage');

function fail(message) {
  loaderEl.classList.remove('done');
  loaderEl.innerHTML = `
    <div class="glyph">/2600</div>
    <div class="err">${message}</div>
    <div class="label"><a href="${CONFIG.backLink}" style="color:inherit">back to index</a></div>`;
}

/* ── renderer / scene ─────────────────────────────────────────────── */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a08);
scene.fog = new THREE.Fog(0x0b0a08, 30, 110);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

// the wheel takes the right edge: shift the camera frustum so the
// focused model is framed in the remaining left area
// fraction of the viewport the wheel covers → drives the camera frustum
// shift. 0 while presenting (the wheel is replaced by the fullscreen stage).
function wheelShare() {
  if (presenting) return 0;
  return (innerWidth < 760 ? 0.38 : 0.30) * slideScale;
}
function applyViewOffset() {
  camera.aspect = innerWidth / innerHeight;
  camera.setViewOffset(innerWidth, innerHeight, innerWidth * wheelShare() * 0.5, 0, innerWidth, innerHeight);
  camera.updateProjectionMatrix();
}
applyViewOffset();

// engine decorations live apart from project models so dimming never touches them
const engineGroup = new THREE.Group();
scene.add(engineGroup);
const root = new THREE.Group();   // scene modules build in here
scene.add(root);

// drifting amber dust
{
  const count = 500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 120;
    positions[i * 3 + 1] = Math.random() * 40 - 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  engineGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: PHOSPHOR, size: 0.12, transparent: true, opacity: 0.4, depthWrite: false,
  })));
}

// faint grid floor
{
  const grid = new THREE.GridHelper(300, 90, PHOSPHOR, PHOSPHOR);
  grid.material.transparent = true;
  grid.material.opacity = 0.06;
  grid.position.y = -0.02;
  engineGroup.add(grid);
}

// base lighting (scene modules can add their own)
engineGroup.add(new THREE.AmbientLight(0xfff4dd, 0.8));
engineGroup.add(new THREE.HemisphereLight(0xfff0d0, 0x2a261c, 0.6));
{
  const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
  key.position.set(12, 24, 10);
  engineGroup.add(key);
  const fill = new THREE.DirectionalLight(0xffd9a0, 0.7);
  fill.position.set(-16, 10, -14);
  engineGroup.add(fill);
  const amber = new THREE.PointLight(PHOSPHOR, 120, 80);
  amber.position.set(-14, 9, -10);
  engineGroup.add(amber);
}

/* ── scene module loading ─────────────────────────────────────────── */

let targets = {};      // name → { objects, dir, distanceScale }
let sceneUpdate = null;

function normalizeTarget(spec) {
  if (spec instanceof THREE.Object3D) spec = { objects: [spec] };
  else if (Array.isArray(spec)) spec = { objects: spec };
  return {
    objects: spec.objects ?? [],
    dir: new THREE.Vector3(...(spec.dir ?? [0.85, 0.55, 1])).normalize(),
    distanceScale: spec.distanceScale ?? 1.25,
  };
}

async function loadScene() {
  if (CONFIG.scene) {
    const mod = await import(new URL(CONFIG.scene, document.baseURI).href);
    const built = mod.build({ THREE, root, scene, renderer });
    for (const [name, spec] of Object.entries(built.targets ?? {})) {
      targets[name] = normalizeTarget(spec);
    }
    sceneUpdate = built.update ?? null;
  } else {
    // fallback backdrop: a slowly breathing wire icosahedron
    const ico = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4, 1),
      new THREE.MeshStandardMaterial({ color: 0x22201a, emissive: PHOSPHOR, emissiveIntensity: 0.12, wireframe: true })
    );
    ico.position.y = 5;
    root.add(ico);
    targets.overview = normalizeTarget(ico);
    sceneUpdate = (t) => { ico.rotation.y = t * 0.12; ico.rotation.x = Math.sin(t * 0.2) * 0.2; };
  }

  if (!targets.overview) targets.overview = normalizeTarget({ objects: [root] });

  // give every project mesh its own material + remember base look (for dim/highlight)
  root.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      obj.material = obj.material.clone();
      obj.material.transparent = true;
      obj.userData.baseOpacity = obj.material.opacity ?? 1;
      obj.userData.baseEmissive = obj.material.emissiveIntensity ?? 1;
      obj.userData.dim = 1;       // current dim factor (1 = fully visible)
      obj.userData.dimTarget = 1;
    }
  });
}

/* ── focus / highlight ────────────────────────────────────────────── */

const focusBounds = new THREE.Box3();
let focusHelper = null;
let focusedMeshes = new Set();
let currentTargetNames = ['overview'];

function resolveBinding(slideNumber) {
  let names = CONFIG.bindings?.[slideNumber] ?? CONFIG.bindings?.[String(slideNumber)];
  if (!names) return null;            // sticky: keep previous focus
  if (!Array.isArray(names)) names = [names];
  return names.filter((n) => targets[n]);
}

function setFocus(names) {
  currentTargetNames = names;
  window.__RENDU_FOCUS__ = names;   // expose active focus to scene.update()
  const specs = names.map((n) => targets[n]);
  const objects = specs.flatMap((s) => s.objects);

  // bounds of everything focused
  focusBounds.makeEmpty();
  for (const obj of objects) {
    obj.updateWorldMatrix(true, true);
    focusBounds.expandByObject(obj);
  }
  if (focusBounds.isEmpty()) focusBounds.setFromObject(root);

  const sphere = focusBounds.getBoundingSphere(new THREE.Sphere());

  // camera goal: frame the sphere, direction from the first target
  const spec = specs[0];
  const vfov = THREE.MathUtils.degToRad(camera.fov / 2);
  const usableAspect = camera.aspect * (1 - wheelShare() * 0.55);
  const dist = Math.max(
    sphere.radius / Math.tan(vfov),
    sphere.radius / (Math.tan(vfov) * usableAspect)
  ) * spec.distanceScale + 0.5;

  view.tCenter.copy(sphere.center);
  view.tRadius = dist;
  const sph = new THREE.Spherical().setFromVector3(spec.dir);
  view.tAzimuth = sph.theta;
  view.tElevation = Math.PI / 2 - sph.phi;

  // dim everything project-side except the focused subtree
  focusedMeshes = new Set();
  for (const obj of objects) obj.traverse((o) => { if (o.isMesh) focusedMeshes.add(o); });
  const everything = focusedMeshes.size === 0 || objects.includes(root);
  root.traverse((o) => {
    if (o.isMesh) o.userData.dimTarget = everything || focusedMeshes.has(o) ? 1 : DIM_OPACITY;
  });

  // pulsing amber box around the focus (hidden on overview)
  if (focusHelper) { engineGroup.remove(focusHelper); focusHelper.dispose?.(); focusHelper = null; }
  if (!everything) {
    const padded = focusBounds.clone().expandByScalar(sphere.radius * 0.08 + 0.15);
    focusHelper = new THREE.Box3Helper(padded, PHOSPHOR);
    focusHelper.material.transparent = true;
    engineGroup.add(focusHelper);
  }
}

/* ── camera rig (damped orbit) ────────────────────────────────────── */

const view = {
  center: new THREE.Vector3(0, 3, 0), tCenter: new THREE.Vector3(0, 3, 0),
  radius: 40, tRadius: 30,
  azimuth: 0.9, tAzimuth: 0.9,
  elevation: 0.5, tElevation: 0.5,
};

const shortestAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ── PDF → slide wheel ────────────────────────────────────────────── */

let total = 0;
const cards = [];

async function loadPdf() {
  const pdfjs = await import(`${PDFJS_BASE}/build/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;

  const doc = await pdfjs.getDocument(CONFIG.pdf).promise;
  total = doc.numPages;
  counterTotal.textContent = String(total).padStart(2, '0');

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1100 / base.width });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const card = document.createElement('div');
    card.className = 'slide-card';
    card.appendChild(canvas);
    const num = document.createElement('span');
    num.className = 'slide-num';
    num.textContent = String(i).padStart(2, '0');
    card.appendChild(num);
    const idx = i - 1;
    card.addEventListener('click', () => goTo(idx));
    wheelEl.appendChild(card);
    cards.push(card);

    loaderLabel.textContent = `rendering slide ${i}/${total}`;
    loaderFill.style.width = `${Math.round((i / total) * 100)}%`;
  }
}

function layoutWheel() {
  const step = innerWidth < 760 ? 110 : 150;
  for (let i = 0; i < cards.length; i++) {
    const off = i - current;
    const abs = Math.abs(off);
    cards[i].style.transform =
      `translateY(${off * step}px) translateZ(${-abs * 70}px) rotateX(${off * -16}deg) scale(${Math.max(1 - abs * 0.1, 0.5)})`;
    cards[i].style.opacity = abs > 3 ? 0 : String(1 - abs * 0.26);
    cards[i].style.zIndex = String(100 - abs);
    cards[i].style.pointerEvents = abs > 3 ? 'none' : 'auto';
    cards[i].classList.toggle('active', off === 0);
  }
}

/* ── navigation ───────────────────────────────────────────────────── */

let current = 0;

function goTo(i) {
  current = Math.max(0, Math.min(total - 1, i));
  counterCurrent.textContent = String(current + 1).padStart(2, '0');
  progressBar.style.width = total > 1 ? `${(current / (total - 1)) * 100}%` : '100%';
  layoutWheel();
  if (presenting) syncStage();
  const names = resolveBinding(current + 1);
  if (names && names.length) setFocus(names);
  emitChange();
}

const next = () => goTo(current + 1);
const prev = () => goTo(current - 1);

let wheelAcc = 0, wheelLock = 0;
addEventListener('wheel', (e) => {
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) > 70) {
    wheelAcc > 0 ? next() : prev();
    wheelAcc = 0;
    wheelLock = now + 420;
  }
}, { passive: true });

addEventListener('keydown', (e) => {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === 'Home') goTo(0);
  else if (e.key === 'End') goTo(total - 1);
  else if (e.key === 'Escape' && presenting) { e.preventDefault(); exitFullscreen(); }
});

let touchStart = null;
addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  if (Math.abs(d) > 40) d < 0 ? next() : prev();
  touchStart = null;
}, { passive: true });

const mouse = { x: 0, y: 0 };
addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
});

addEventListener('resize', () => {
  applyViewOffset();
  renderer.setSize(innerWidth, innerHeight);
  layoutWheel();
});

/* ── slides engine ────────────────────────────────────────────────────
 * The handler surface the Controller (the user's panel) drives. Everything
 * that manipulates the slide overlay lives behind this small interface, so
 * the controller never has to know about the wheel / pdf internals.
 *
 *   user ─▶ controller ─▶ slidesEngine ─▶ (wheel · stage · camera)
 * ──────────────────────────────────────────────────────────────────── */

const changeSubs = new Set();

function slidesState() {
  return { index: current, total, scale: slideScale, fullscreen: presenting };
}
function emitChange() { const s = slidesState(); changeSubs.forEach((f) => f(s)); }

// slide size: scale the wheel width and keep the camera frustum shift matched
function applySlideScale(s) {
  slideScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));
  document.documentElement.style.setProperty('--wheel-scale', slideScale.toFixed(3));
  applyViewOffset();
  layoutWheel();
  emitChange();
}

// presentation mode: lift the active slide card onto a fullscreen stage,
// hand the wheel its card back on exit
let stageCard = null;
function syncStage() {
  const want = cards[current];
  if (!want || stageCard === want) return;
  if (stageCard && stageCard.parentElement === stageEl) wheelEl.appendChild(stageCard);
  stageEl.appendChild(want);
  stageCard = want;
}
function enterFullscreen() {
  if (presenting) return;
  presenting = true;
  document.body.classList.add('presenting');
  syncStage();
  applyViewOffset();
  document.documentElement.requestFullscreen?.().catch(() => {});
  emitChange();
}
function exitFullscreen() {
  if (!presenting) return;
  presenting = false;
  document.body.classList.remove('presenting');
  if (stageCard && stageCard.parentElement === stageEl) wheelEl.appendChild(stageCard);
  stageCard = null;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  applyViewOffset();
  layoutWheel();
  emitChange();
}
function toggleFullscreen() { presenting ? exitFullscreen() : enterFullscreen(); }

// native Esc / browser-chrome exit → leave presentation too
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && presenting) exitFullscreen();
});

const slidesEngine = {
  next, prev, goTo,
  state: slidesState,
  onChange(cb) { changeSubs.add(cb); return () => changeSubs.delete(cb); },
  scaleRange: () => ({ min: SCALE_MIN, max: SCALE_MAX }),
  getScale: () => slideScale,
  setScale: applySlideScale,
  stepScale: (d) => applySlideScale(slideScale + d),
  enterFullscreen, exitFullscreen, toggleFullscreen,
  isFullscreen: () => presenting,
};
window.__RENDU_ENGINE__ = { slides: slidesEngine };

/* ── render loop ──────────────────────────────────────────────────── */

let lastT = 0;

function animate(t) {
  requestAnimationFrame(animate);
  const time = t * 0.001;
  const dt = Math.min(time - lastT, 0.05);
  lastT = time;

  // slow idle orbit around whatever is focused
  view.tAzimuth += dt * 0.05;

  // optional scene-driven camera override (e.g. follow an animated packet);
  // the scene sets window.__RENDU_VIEW__ = { center:[x,y,z], radius } per frame
  const camOv = window.__RENDU_VIEW__;
  if (camOv) {
    view.tCenter.set(camOv.center[0], camOv.center[1], camOv.center[2]);
    view.tRadius = camOv.radius;
  }

  const k = camOv ? 0.11 : 0.05;     // tighter follow when overridden
  view.center.lerp(view.tCenter, k);
  view.radius += (view.tRadius - view.radius) * k;
  view.azimuth += shortestAngle(view.tAzimuth - view.azimuth) * k;
  view.elevation += (view.tElevation - view.elevation) * k;

  const el = view.elevation + mouse.y * -0.06;
  const az = view.azimuth + mouse.x * 0.08;
  camera.position.set(
    view.center.x + view.radius * Math.cos(el) * Math.sin(az),
    view.center.y + view.radius * Math.sin(el),
    view.center.z + view.radius * Math.cos(el) * Math.cos(az)
  );
  camera.lookAt(view.center);

  // dim fade + highlight pulse
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.userData.dim += (o.userData.dimTarget - o.userData.dim) * 0.08;
    o.material.opacity = o.userData.baseOpacity * o.userData.dim;
    if (o.material.emissiveIntensity !== undefined) {
      const boost = focusedMeshes.has(o) && o.userData.dimTarget === 1 && focusHelper ? 1 + pulse * 0.7 : 1;
      o.material.emissiveIntensity = o.userData.baseEmissive * o.userData.dim * boost;
    }
  });
  if (focusHelper) focusHelper.material.opacity = 0.25 + pulse * 0.5;

  sceneUpdate?.(time, dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

/* ── boot ─────────────────────────────────────────────────────────── */

loaderLabel.textContent = 'building scene';

Promise.all([loadScene(), loadPdf()])
  .then(() => {
    goTo(0);
    setFocus(resolveBinding(1) ?? ['overview']);
    loaderEl.classList.add('done');
    // the user's control panel — wires onto the slides engine handlers
    import(new URL('./controller.js', import.meta.url).href)
      .then((m) => m.mountController({ slides: slidesEngine }))
      .catch((e) => console.warn('controller failed to mount', e));
  })
  .catch((err) => {
    console.error(err);
    fail(`could not load the rendu — ${err?.message ?? err}`);
  });
