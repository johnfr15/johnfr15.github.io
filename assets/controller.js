/* ── Controller engine ───────────────────────────────────────────────
 *
 * The top-level user interface. In the engine hierarchy the *user* is the
 * chief: they drive everything from this panel, which only ever calls
 * handlers exposed by the engines below it —
 *
 *   user ─▶ controller ─▶ slides engine ─▶ scene interface
 *
 * The controller knows nothing about three.js or pdf.js; it is handed the
 * engine handler surfaces at mount time and just wires DOM controls onto
 * them. To add a control: drop a widget into the panel markup below, bind
 * it to a handler, and (if it has state) reflect that handler's state in
 * sync(). Give the matching engine the handler to call.
 * ──────────────────────────────────────────────────────────────────── */

export function mountController({ slides }) {
  const panel = document.createElement('div');
  panel.className = 'ctrl';
  panel.innerHTML = `
    <button class="ctrl-handle" title="hide / show controls" aria-label="toggle controls">⌃</button>
    <div class="ctrl-body">
      <span class="ctrl-label">slides</span>
      <div class="ctrl-group" role="group" aria-label="slide size">
        <button class="ctrl-btn" data-act="smaller" title="smaller">–</button>
        <input class="ctrl-range" type="range" min="0" max="100" value="50" aria-label="slide size">
        <button class="ctrl-btn" data-act="bigger" title="bigger">+</button>
        <span class="ctrl-readout" id="ctrl-size">100%</span>
      </div>
      <span class="ctrl-sep"></span>
      <button class="ctrl-btn ctrl-fs" data-act="fullscreen"
              title="present the active slide fullscreen (Esc to exit)">
        <span class="ctrl-ico">⛶</span><span class="ctrl-fs-txt">fullscreen</span>
      </button>
    </div>`;
  document.body.appendChild(panel);

  const range = panel.querySelector('.ctrl-range');
  const readout = panel.querySelector('#ctrl-size');
  const fsBtn = panel.querySelector('.ctrl-fs');

  // slider 0..100  ↔  engine scale  min..max
  const { min, max } = slides.scaleRange();
  const toScale = (v) => min + (max - min) * (v / 100);
  const toSlider = (s) => Math.round(((s - min) / (max - min)) * 100);

  range.addEventListener('input', () => slides.setScale(toScale(+range.value)));
  panel.querySelector('[data-act="smaller"]').addEventListener('click', () => slides.stepScale(-0.12));
  panel.querySelector('[data-act="bigger"]').addEventListener('click', () => slides.stepScale(+0.12));
  fsBtn.addEventListener('click', () => slides.toggleFullscreen());
  panel.querySelector('.ctrl-handle').addEventListener('click', () => panel.classList.toggle('collapsed'));

  // reflect engine state (covers ± steps, programmatic changes, Esc-exit …)
  function sync(s) {
    if (document.activeElement !== range) range.value = toSlider(s.scale);
    readout.textContent = Math.round(s.scale * 100) + '%';
    fsBtn.classList.toggle('on', s.fullscreen);
  }
  slides.onChange(sync);
  sync(slides.state());

  const api = { panel, sync, destroy: () => panel.remove() };
  window.__RENDU_CONTROLLER__ = api;
  return api;
}
