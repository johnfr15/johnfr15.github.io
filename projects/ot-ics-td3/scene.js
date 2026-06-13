/* OT/ICS soutenance scene — the virtualized naval-rudder platform.
 *
 * Two network rails (host-only vboxnet0 front, internal intnet back),
 * five device nodes (NTP, SCADA, Attacker, CC, PLC), and a rudder rig that
 * actually animates: it sweeps with the "order" in nominal mode and freezes
 * when the attack target is focused.
 *
 * Named targets bound from slides: overview, ntp, scada, attacker, cc, plc,
 * rudder, attack (cc+attacker).
 */

const PHOSPHOR = 0xffb000;
const RED = 0xff4433;
const BODY = 0x4a443a;
const PANEL = 0x14120d;

export function build({ THREE, root }) {
  const std = (c = BODY) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.15 });
  const glow = (c = PHOSPHOR, i = 1.6) =>
    new THREE.MeshStandardMaterial({ color: PANEL, emissive: c, emissiveIntensity: i, roughness: 0.4 });

  // ── text label sprite ──────────────────────────────────────────────
  function label(text, sub, color = "#ffb000") {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 160;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(11,10,8,0.85)"; x.fillRect(0, 0, 512, 160);
    x.strokeStyle = color; x.lineWidth = 4; x.strokeRect(4, 4, 504, 152);
    x.textAlign = "center";
    x.fillStyle = color; x.font = "700 64px Syne, sans-serif";
    x.fillText(text, 256, 70);
    if (sub) { x.fillStyle = "#8a8170"; x.font = "400 30px 'IBM Plex Mono', monospace"; x.fillText(sub, 256, 118); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(4, 1.25, 1);
    return spr;
  }

  // ── a device node: box + emissive face + floating label ─────────────
  function device(name, sub, color) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2), std());
    box.position.y = 1; g.add(box);
    const face = new THREE.Mesh(new THREE.BoxGeometry(3.02, 1.3, 0.12), glow(color, 1.3));
    face.position.set(0, 1, 1.0); g.add(face);
    const lab = label(name, sub, "#" + color.toString(16).padStart(6, "0"));
    lab.position.set(0, 3.4, 0); g.add(lab);
    return g;
  }

  // ── platform disc ───────────────────────────────────────────────────
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(22, 22.6, 0.4, 72), std(0x201d17));
  disc.position.y = -0.2; root.add(disc);

  // network rails (two glowing lines)
  function rail(z, color) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 0.35), glow(color, 1.2));
    bar.position.set(0, 0.15, z); root.add(bar);
    return bar;
  }
  rail(7.5, PHOSPHOR);   // host-only vboxnet0 (front)
  rail(-7.5, 0x66ccff);  // internal intnet (back)

  // ── devices ─────────────────────────────────────────────────────────
  // host-only rail (front, z≈7.5): NTP, SCADA, Attacker
  const ntp = device("NTP", ".15.3", PHOSPHOR); ntp.position.set(-11, 0, 9.5); root.add(ntp);
  const scada = device("SCADA", ".15.2", PHOSPHOR); scada.position.set(-3, 0, 9.5); root.add(scada);
  const attacker = device("ATTACKER", ".15.4", RED); attacker.position.set(9, 0, 9.5); root.add(attacker);

  // CC bridges both rails (center)
  const cc = device("CC", ".15.1 / .200.1", PHOSPHOR); cc.position.set(0, 0, 0); root.add(cc);
  // bridge struts to each rail
  for (const z of [7.5, -7.5]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 7.5),
      glow(z > 0 ? PHOSPHOR : 0x66ccff, 1.0));
    strut.position.set(0, 0.4, z / 2); root.add(strut);
  }

  // internal rail (back): PLC
  const plc = device("PLC", ".200.3", 0x66ccff); plc.position.set(-2, 0, -9.5); root.add(plc);

  // ── rudder rig (the gouvernail) — sits beside the PLC ───────────────
  const rudder = new THREE.Group();
  rudder.position.set(9, 0, -9.5);
  {
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 5, 24), std(0x3a342a));
    hull.rotation.x = Math.PI / 2; hull.position.y = 1.4; rudder.add(hull);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.4, 12), std(0x55504a));
    post.position.set(0, 1.4, -2.6); rudder.add(post);
    // two fins (L/R) that rotate to show rudder angle
    const finGeo = new THREE.BoxGeometry(0.12, 2, 1.8);
    const finL = new THREE.Mesh(finGeo, glow(PHOSPHOR, 1.4));
    const finR = new THREE.Mesh(finGeo, glow(PHOSPHOR, 1.4));
    const pivotL = new THREE.Group(), pivotR = new THREE.Group();
    pivotL.position.set(-0.25, 1.4, -3.2); pivotR.position.set(0.25, 1.4, -3.2);
    finL.position.set(0, 0, -0.9); finR.position.set(0, 0, -0.9);
    pivotL.add(finL); pivotR.add(finR);
    rudder.add(pivotL, rudder.pivotR = pivotR); rudder.pivotL = pivotL;
    rudder.add(label("GOUVERNAIL", "rudder 0..80", "#ffb000").translateY(4).translateX(0));
  }
  root.add(rudder);

  // ── packet flows ────────────────────────────────────────────────────
  const flows = [];
  function flow(a, b, color, speed = 0.35) {
    const curve = new THREE.CatmullRomCurve3([
      a.clone().setY(0.4),
      a.clone().lerp(b, 0.5).setY(2.2),
      b.clone().setY(0.4),
    ]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.03, 5), std(0x33291a)));
    for (let i = 0; i < 3; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12), glow(color, 2.6));
      root.add(dot);
      flows.push({ dot, curve, off: i / 3, speed });
    }
  }
  const P = (o) => o.position.clone();
  flow(P(scada), P(cc), PHOSPHOR);          // SCADA -> CC (order)
  flow(P(cc), P(plc), 0x66ccff);            // CC -> PLC (internal)
  const attackFlow = flows.length;
  flow(P(attacker), P(cc), RED, 0.6);       // Attacker -> CC (the attack)

  // ── scripted attack sequence (plays when slide focuses "attackseq") ──
  // a labelled packet = a pill sprite carrying the exact wire value
  function tag(text, color = "#ff5a3c") {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 96;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(11,10,8,0.92)";
    x.strokeStyle = color; x.lineWidth = 4;
    const w = 1016, h = 88;
    x.fillRect(4, 4, w, h); x.strokeRect(4, 4, w, h);
    x.fillStyle = color; x.textAlign = "center";
    x.font = "500 44px 'IBM Plex Mono', monospace";
    x.fillText(text, 512, 62);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(text.length * 0.135 + 0.6, text.length ? 0.62 : 0.62, 1);
    return spr;
  }
  function makeMsg(text, color = RED) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22), glow(color, 2.8));
    const t = tag(text, "#" + color.toString(16).padStart(6, "0"));
    t.position.y = 0.7;
    g.add(ball, t);
    g.visible = false;
    root.add(g);
    g.renderOrder = 999;
    return g;
  }

  // arced path between two nodes, raised in the middle so the pill is readable
  const arc = (a, b, h = 3.2) => new THREE.CatmullRomCurve3([
    a.clone().setY(0.7), a.clone().lerp(b, 0.5).setY(h), b.clone().setY(0.7),
  ]);
  const curveAC = arc(P(attacker), P(cc));   // Attacker -> CC  (HTTP)
  const curveCP = arc(P(cc), P(plc));        // CC -> PLC       (Modbus)
  const curvePR = arc(P(plc), P(rudder), 2.6); // PLC -> rudder (effect)

  const msgGet = makeMsg("GET /attack?plc=gouv&choice=1&offset=10");
  const msg198 = makeMsg("FC6  reg198 = 10   (offset)");
  const msg196 = makeMsg("FC6  reg196 = 1    (choice)");
  const msgRes = makeMsg("gouvernail GELE = 50");
  const attackMsgs = [msgGet, msg198, msg196, msgRes];
  const place = (m, curve, u) => { m.visible = true; m.position.copy(curve.getPointAt(Math.max(0, Math.min(1, u)))); };

  const SEQ = { get: 2.0, mod: 2.0, eff: 1.2, hold: 2.0 };   // phase durations (s)
  const CYCLE = SEQ.get + SEQ.mod + SEQ.eff + SEQ.hold + 0.6;

  // ── animation state ────────────────────────────────────────────────
  let frozen = false;
  let attackHot = false;
  let seqOn = false, wasSeqOn = false, seqStart = 0, attackArrived = false;

  return {
    targets: {
      overview:  { objects: [root], dir: [0.55, 0.7, 1], distanceScale: 0.6 },
      ntp:       { objects: [ntp], dir: [0, 0.5, 1] },
      scada:     { objects: [scada], dir: [0, 0.5, 1] },
      attacker:  { objects: [attacker], dir: [0.4, 0.5, 1] },
      cc:        { objects: [cc], dir: [0.3, 0.6, 1], distanceScale: 1.4 },
      plc:       { objects: [plc], dir: [-0.3, 0.5, 1] },
      rudder:    { objects: [rudder], dir: [0.6, 0.5, 1], distanceScale: 1.2 },
      attack:    { objects: [attacker, cc], dir: [0.5, 0.6, 1], distanceScale: 0.9 },
      // frames the whole kill-chain so the scripted packets are all visible
      attackseq: { objects: [attacker, cc, plc, rudder], dir: [0.25, 0.78, 1], distanceScale: 0.92 },
    },

    // the engine calls update each frame; we read the focused target name
    // via a tiny hook on window so the rudder reacts to the slide.
    update(time) {
      const focus = window.__RENDU_FOCUS__ || [];
      seqOn = focus.includes("attackseq");
      if (seqOn && !wasSeqOn) seqStart = time;   // (re)start the sequence
      wasSeqOn = seqOn;

      // ── drive the scripted attack packets ──
      attackMsgs.forEach((m) => (m.visible = false));
      attackArrived = false;
      if (seqOn) {
        const T = (time - seqStart) % CYCLE;
        const t1 = SEQ.get, t2 = t1 + SEQ.mod, t3 = t2 + SEQ.eff;
        let follow = msgGet;
        if (T < t1) {
          place(msgGet, curveAC, T / SEQ.get);                 // Attacker -> CC
          follow = msgGet;
        } else if (T < t2) {
          const u = (T - t1) / SEQ.mod;                        // CC -> PLC (2 writes)
          place(msg198, curveCP, u);
          if (u > 0.28) place(msg196, curveCP, u - 0.28);
          follow = msg198;
        } else if (T < t3) {
          place(msgRes, curvePR, (T - t2) / SEQ.eff);          // PLC -> rudder
          attackArrived = (T - t2) / SEQ.eff > 0.6;
          follow = msgRes;
        } else {
          place(msgRes, curvePR, 1);                           // parked, freeze held
          attackArrived = true;
          follow = msgRes;
        }
        // ride alongside the active packet so its value label reads at
        // human scale; the engine damps the move (window override hook)
        const p = follow.position;
        window.__RENDU_VIEW__ = { center: [p.x, p.y + 0.5, p.z], radius: 8.5 };
      } else if (wasSeqOn || window.__RENDU_VIEW__) {
        window.__RENDU_VIEW__ = null;   // release the camera back to the engine
      }

      // rudder is frozen by the static "plc/attacker/attack" targets, OR once
      // the scripted packet has reached it during the sequence
      frozen = (!seqOn && (focus.includes("attacker") || focus.includes("attack") ||
               focus.includes("plc"))) || (seqOn && attackArrived);
      attackHot = frozen || seqOn;

      const sweep = (Math.sin(time * 0.5) * 0.5 + 0.5);  // 0..1
      const angle = frozen ? 0.45 : (sweep * 0.9 - 0.45);
      if (rudder.pivotL) {
        rudder.pivotL.rotation.y += (angle - rudder.pivotL.rotation.y) * 0.05;
        rudder.pivotR.rotation.y += (angle - rudder.pivotR.rotation.y) * 0.05;
      }

      // ambient packet flows; the looping red Attacker->CC flow is hidden during
      // the scripted sequence so it doesn't double up with the labelled packet
      for (let i = 0; i < flows.length; i++) {
        const f = flows[i];
        const isAttack = i >= attackFlow;
        f.dot.visible = isAttack ? (attackHot && !seqOn) : true;
        const t = (time * f.speed + f.off) % 1;
        f.dot.position.copy(f.curve.getPointAt(t));
      }
    },
  };
}
