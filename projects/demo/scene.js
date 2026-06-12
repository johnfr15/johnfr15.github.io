/* Demo 3D environment: a stylized network infrastructure diorama.
 *
 * Contract: export build({ THREE, root }) → { targets, update }
 *   - add your Object3Ds into `root`
 *   - `targets` names are what slides bind to (see index.html)
 *   - `update(time, dt)` runs every frame for animations
 */

const PHOSPHOR = 0xffb000;
const BODY = 0x4a443a;
const PANEL = 0x14120d;

export function build({ THREE, root }) {

  const std = (opts) => new THREE.MeshStandardMaterial(
    Object.assign({ color: BODY, roughness: 0.6, metalness: 0.15 }, opts)
  );
  const glow = (intensity = 1.6) => new THREE.MeshStandardMaterial({
    color: PANEL, emissive: PHOSPHOR, emissiveIntensity: intensity, roughness: 0.4,
  });

  /* platform */
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(14, 14.6, 0.5, 64), std({ color: 0x2b2820 }));
    disc.position.y = 0.25;
    root.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14.1, 0.06, 8, 100), glow(1.2));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.52;
    root.add(ring);
  }
  const TOP = 0.5; // platform surface height

  /* gateway — router box + antennas, front of the stage */
  const gateway = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 2.2), std());
    body.position.y = TOP + 0.65;
    gateway.add(body);
    const face = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.18, 1.8), glow());
    face.position.y = TOP + 0.95;
    gateway.add(face);
    for (const x of [-0.7, 0.7]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6), std({ color: 0x4f483c }));
      ant.position.set(x, TOP + 2.1, -0.6);
      gateway.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11), glow(2.2));
      tip.position.set(x, TOP + 2.95, -0.6);
      gateway.add(tip);
    }
    gateway.position.set(0, 0, 8.5);
    root.add(gateway);
  }

  /* firewall — a wall of bricks across the middle */
  const firewall = new THREE.Group();
  {
    const brick = new THREE.BoxGeometry(1.7, 0.75, 0.6);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const b = new THREE.Mesh(brick, row % 2 === col % 2 ? std() : std({ color: 0x564a34 }));
        b.position.set((col - 2) * 1.85 + (row % 2 ? 0.9 : 0), TOP + 0.4 + row * 0.8, 0);
        firewall.add(b);
      }
    }
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.12, 0.66), glow(1.8));
    beacon.position.y = TOP + 3.3;
    firewall.add(beacon);
    firewall.position.set(0, 0, 3.5);
    root.add(firewall);
  }

  /* api — three server towers, stage left */
  const api = new THREE.Group();
  {
    for (let i = 0; i < 3; i++) {
      const tower = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.6, 1.7), std());
      body.position.y = TOP + 1.8;
      tower.add(body);
      for (let s = 0; s < 5; s++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.05), glow(1.4));
        stripe.position.set(0, TOP + 0.7 + s * 0.62, 0.88);
        tower.add(stripe);
      }
      tower.position.set(-6.5 + i * 2.4, 0, -3.5 - (i % 2) * 1.6);
      api.add(tower);
    }
    root.add(api);
  }

  /* db — stacked cylinders, stage right */
  const db = new THREE.Group();
  {
    for (let i = 0; i < 3; i++) {
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.9, 40), std({ color: 0x4d4639 }));
      disk.position.y = TOP + 0.5 + i * 1.05;
      db.add(disk);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.045, 8, 60), glow(1.6));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = TOP + 0.97 + i * 1.05;
      db.add(ring);
    }
    db.position.set(5.6, 0, -4);
    root.add(db);
  }

  /* cables: gateway → firewall → api / db, with packets running along */
  const curves = [
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, TOP + 0.1, 7.3),
      new THREE.Vector3(0, TOP + 0.1, 5.4),
      new THREE.Vector3(0, TOP + 0.1, 4.1),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.8, TOP + 0.1, 2.9),
      new THREE.Vector3(-3.5, TOP + 0.1, 0.2),
      new THREE.Vector3(-5.2, TOP + 0.1, -2.5),
    ]),
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.8, TOP + 0.1, 2.9),
      new THREE.Vector3(3.4, TOP + 0.1, 0),
      new THREE.Vector3(5.4, TOP + 0.1, -2.6),
    ]),
  ];
  const packets = [];
  for (const curve of curves) {
    root.add(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 24, 0.05, 6),
      std({ color: 0x57452a })
    ));
    for (let p = 0; p < 3; p++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09), glow(2.4));
      root.add(dot);
      packets.push({ dot, curve, offset: p / 3, speed: 0.25 + Math.random() * 0.1 });
    }
  }

  return {
    targets: {
      overview: { objects: [root], dir: [0.7, 0.8, 1], distanceScale: 0.62 },
      gateway:  { objects: [gateway], dir: [0.4, 0.5, 1] },
      firewall: { objects: [firewall], dir: [0, 0.45, 1], distanceScale: 1.1 },
      api:      { objects: [api], dir: [-1, 0.5, 0.7] },
      db:       { objects: [db], dir: [1, 0.55, 0.6] },
    },

    update(time) {
      for (const p of packets) {
        const t = (time * p.speed + p.offset) % 1;
        p.dot.position.copy(p.curve.getPointAt(t));
        p.dot.position.y += 0.1;
      }
    },
  };
}
