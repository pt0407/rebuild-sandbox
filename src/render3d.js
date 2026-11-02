// render3d.js — Three.js low-poly renderer, REBUILD-style angled view.
// Reads plain world/robot state each frame and syncs meshes. Gameplay code
// stays 2D in meters; we render x → x, y → -z so the field maps to the ground.
import * as THREE from "../vendor/three.module.js";

const M = {
  floor: 0x23262d, blueZone: 0x1d2c47, redZone: 0x47201d,
  wall: 0x3a3e48, fuel: 0xebc328, fuelFlying: 0xffd84d,
  trench: 0x14161a, bump: 0x31343c,
};

export class Renderer {
  constructor(canvas, world) {
    this.world = world;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121316);
    this.scene.fog = new THREE.Fog(0x121316, 30, 60);

    // REBUILD-style camera: 3/4 view from behind an alliance end, ~40° tilt
    this.cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.cam.position.set(REBUILD.FIELD_W / 2, 11.5, REBUILD.FIELD_H + 8.5);
    this.cam.lookAt(REBUILD.FIELD_W / 2, 0, REBUILD.FIELD_H / 2 - 1);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xfff4d6, 0.9);
    sun.position.set(4, 20, 6);
    this.scene.add(sun);

    this.fuelMeshes = new Map();   // Fuel -> Mesh
    this.robotMeshes = new Map();  // Robot -> group
    this.fuelGeo = new THREE.SphereGeometry(0.11, 10, 8);
    this.fuelMat = new THREE.MeshLambertMaterial({ color: M.fuel });
    this.fuelMatHot = new THREE.MeshLambertMaterial({ color: M.fuelFlying, emissive: 0x554400 });

    this.buildField();
    this.loadRealMap();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.r.setSize(innerWidth, innerHeight);
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  box(w, h, d, color, x, y, z, emissive) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color, emissive: emissive || 0 }));
    m.position.set(x, y, z);
    this.scene.add(m);
    return m;
  }

  buildField() {
    const W = REBUILD.FIELD_W, H = REBUILD.FIELD_H;
    const g = (w, d, color, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d),
        new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, -0.025, z);
      this.scene.add(m);
    };
    // real field: one dark carpet, subtle alliance tint at the ends, white lines
    g(W, H, 0x2b2e35, W / 2, H / 2);
    g(REBUILD.NEUTRAL_X0, H, 0x38304a, REBUILD.NEUTRAL_X0 / 2, H / 2);
    g(W - REBUILD.NEUTRAL_X1, H, 0x304052, (W + REBUILD.NEUTRAL_X1) / 2, H / 2);
    // white field lines at zone boundaries + midline
    for (const x of [REBUILD.NEUTRAL_X0, W / 2, REBUILD.NEUTRAL_X1])
      this.box(0.06, 0.02, H, 0xd8dce4, x, 0.011, H / 2, 0x777777);
    // walls
    const wt = 0.12;
    this.box(W + wt * 2, 0.5, wt, M.wall, W / 2, 0.25, -wt / 2);
    this.box(W + wt * 2, 0.5, wt, M.wall, W / 2, 0.25, H + wt / 2);
    this.box(wt, 0.5, H, M.wall, -wt / 2, 0.25, H / 2);
    this.box(wt, 0.5, H, M.wall, W + wt / 2, 0.25, H / 2);
    // hubs: real REBUILD look — colored central structure + 4 truss legs
    for (const h of this.world.hubs) {
      const c = h.alliance === "blue" ? 0x2a56c9 : 0xd42a2a;
      const glow = h.alliance === "blue" ? 0x6aa5ff : 0xff6a6a;
      // central scoring structure (the tall colored block)
      const core = new THREE.Mesh(new THREE.BoxGeometry(h.w * 0.7, 1.9, h.h * 0.55),
        new THREE.MeshLambertMaterial({ color: c }));
      core.position.set(h.x, 0.95, h.y);
      this.scene.add(core);
      // glowing rim around top
      const rim = new THREE.Mesh(new THREE.BoxGeometry(h.w * 0.74, 0.08, h.h * 0.59),
        new THREE.MeshBasicMaterial({ color: glow }));
      rim.position.set(h.x, 1.94, h.y);
      this.scene.add(rim);
      // opening
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(h.w * 0.4, 0.5, h.h * 0.3),
        new THREE.MeshBasicMaterial({ color: 0x0a0c10 }));
      mouth.position.set(h.x, 0.9, h.y);
      this.scene.add(mouth);
      // truss legs at the corners
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const lx = h.x + sx * h.w * 0.55, lz = h.y + sz * h.h * 0.45;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1),
          new THREE.MeshLambertMaterial({ color: c }));
        leg.position.set(lx, 0.95, lz);
        leg.rotation.z = sx * 0.12;
        this.scene.add(leg);
        for (let b = 0; b < 3; b++) {   // cross braces
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, h.h * 0.28),
            new THREE.MeshLambertMaterial({ color: 0x555a63 }));
          brace.position.set(lx - sx * 0.06, 0.45 + b * 0.55, lz);
          this.scene.add(brace);
        }
      }
    }
    // towers (climb poles)
    for (const t of this.world.towers) {
      const c = t.alliance === "blue" ? 0x6aa5ff : 0xff6a6a;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 10),
        new THREE.MeshLambertMaterial({ color: 0x8a8e98 }));
      p.position.set(t.x, 1.7, t.y);
      this.scene.add(p);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshBasicMaterial({ color: c }));
      cap.position.set(t.x, 3.5, t.y);
      this.scene.add(cap);
    }
    // depots: flat pads
    for (const d of this.world.depots)
      this.box(d.w, 0.04, d.h, 0x6b5a1e, d.x, 0.02, d.y, 0x2a2208);
    // obstacles
    for (const o of this.world.obstacles) {
      const h = o.kind === "trench" ? 0.55 : 0.3;
      this.box(o.w, h, o.h, o.kind === "trench" ? M.trench : M.bump, o.x, h / 2, o.y);
      if (o.kind === "bump")   // hazard stripes
        for (let i = -2; i <= 2; i++)
          this.box(o.w, 0.02, 0.06, 0xebc328, o.x, h + 0.01, o.y + i * o.h / 5, 0x332a00);
    }
  }

  labelSprite(text) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const x = c.getContext("2d");
    x.font = "bold 90px monospace"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "#fff"; x.fillText(text, 128, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(0.9, 0.45, 1);
    return sp;
  }

  // Load meshes extracted from the real REBUILD build (models/draw_*.obj).
  // Their coords are world meters centered ~ (±8.5, 0, ±4.5); we offset to
  // our field's origin (0..16.46, 0..8.21).
  async loadRealMap() {
    const OX = 8.23, OZ = 4.105;
    let files;
    try { files = await (await fetch("models/manifest.json")).json(); }
    catch (e) { console.warn("no real-map manifest", e); return; }
    const grp = new THREE.Group();
    grp.name = "realmap";
    this.scene.add(grp);
    for (const f of files) {
      // only instanced captures decode to real positions; skip UI/junk draws
      if (!/^draw_0[01]\.obj$/.test(f)) continue;
      let text;
      try { text = await (await fetch("models/" + f)).text(); }
      catch (e) { continue; }
      const pos = [], col = [];
      for (const line of text.split("\n")) {
        if (line[0] === "v") {
          const p = line.slice(2).split(" ").map(Number);
          pos.push(p[0] + OX, p[1], p[2] + OZ);
          col.push(p[3], p[4], p[5]);
        } else if (line[0] === "f") {
          const idx = line.slice(2).split(" ").map(Number);
          // fan-triangulate polygons
          for (let k = 1; k + 1 < idx.length; k++) {
            for (const i of [idx[0], idx[k], idx[k + 1]]) {
              // we stored verts flat; store per-face indices instead
              col._f = col._f || []; col._f.push(i);
            }
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      if (col._f) geo.setIndex(col._f.map(i => i - 1));
      const mesh = new THREE.Mesh(geo,
        new THREE.MeshLambertMaterial({ vertexColors: true }));
      grp.add(mesh);
    }
  }

  makeRobot(r) {
    // Real REBUILD look: dark chassis, alliance-color bumper slab with team
    // number, gray superstructure per archetype (turret cyl / hopper box / hood).
    const grp = new THREE.Group();
    const d = r.def, s = d.size;
    const tags = d.tags || [];
    const bump = r.alliance === "blue" ? 0x2a56c9 : 0xd42a2a;
    const dark = 0x2e3238, dark2 = 0x454a52;

    const M_ = c => new THREE.MeshLambertMaterial({ color: c });
    const add = (geo, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; grp.add(m); return m;
    };

    // bumper slab — alliance color, team number drawn on the front face
    const bumperGeo = new THREE.BoxGeometry(s, 0.22, s);
    const texC = document.createElement("canvas"); texC.width = 128; texC.height = 32;
    const tx = texC.getContext("2d");
    tx.fillStyle = "#fff"; tx.font = "bold 26px monospace";
    tx.textAlign = "center"; tx.textBaseline = "middle";
    tx.fillText(d.team, 64, 16);
    const bumperTex = new THREE.CanvasTexture(texC);
    const sideMat = new THREE.MeshLambertMaterial({ color: bump, map: bumperTex });
    const bumper = new THREE.Mesh(bumperGeo, M_(bump));
    bumper.position.y = 0.11;
    grp.add(bumper);
    // flat number decals on ±x faces of bumper
    for (const dir of [1, -1]) {
      const dec = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.8, 0.18), sideMat);
      dec.position.set(dir * (s / 2 + 0.003), 0.11, 0);
      dec.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      grp.add(dec);
    }
    // chassis deck
    add(new THREE.BoxGeometry(s * 0.86, 0.18, s * 0.86), M_(new THREE.Color(d.color).multiplyScalar(0.9).getHex()), 0, 0.3, 0);

    // archetype superstructure
    if (tags.includes("BIG_HOPPER")) {
      // tall hopper box spanning most of the top (1114/2481 look)
      add(new THREE.BoxGeometry(s * 0.8, 0.34, s * 0.8), M_(dark), 0, 0.55, 0);
      add(new THREE.BoxGeometry(s * 0.84, 0.06, s * 0.84), M_(dark2), 0, 0.74, 0);
    }
    if (tags.includes("TURRET")) {
      // dark turret base + cylinder on top (4414/1323/4946/359 look)
      add(new THREE.BoxGeometry(s * 0.6, 0.22, s * 0.6), M_(dark), 0, 0.46, -s * 0.05);
      const tur = add(new THREE.CylinderGeometry(s * 0.16, s * 0.19, 0.3, 14), M_(dark2), 0, 0.72, -s * 0.05);
      const barrel = add(new THREE.BoxGeometry(s * 0.34, 0.07, 0.07), M_(dark), s * 0.2, 0.74, -s * 0.05);
      barrel.position.x = s * 0.22;
      grp.userData.turret = tur;
      grp.userData.turretBarrel = barrel;
    }
    if (d.archetype === "hooded") {
      // 2910-style sloped hood over a front shooter
      const hood = add(new THREE.BoxGeometry(s * 0.7, 0.26, s * 0.5), M_(dark), 0, 0.5, s * 0.12);
      hood.rotation.x = -0.35;
    }
    if (d.archetype === "low-cycler" || d.archetype === "dump-bot") {
      // low intake ramp at front (254/1678 look)
      const ramp = add(new THREE.BoxGeometry(s * 0.7, 0.16, s * 0.35), M_(dark), 0, 0.42, s * 0.2);
      ramp.rotation.x = 0.25;
    }
    if (tags.includes("OUTTAKE") || (d.mechanisms || []).some(m => m.type === "outtake")) {
      add(new THREE.BoxGeometry(0.1, 0.12, s * 0.5), M_(dark2), -s * 0.5, 0.3, 0);
    }
    if ((d.mechanisms || []).some(m => m.type === "bidirectional-shooter")) {
      // custom 6800: front + rear orange barrels
      for (const dir of [1, -1])
        add(new THREE.BoxGeometry(0.09, 0.09, s * 0.5), M_(0xff9d4d), dir * s * 0.45, 0.38, -s * 0.15);
    }

    // team number sprite
    const label = this.labelSprite(d.team);
    label.position.y = 1.0;
    grp.add(label);

    // hopper ring (rebuilt on fuel change)
    grp.userData.ringY = 0.05;
    grp.userData.ringR = s / 2 + 0.18;
    grp.userData.ring = null;
    grp.userData.lastFuel = -1;
    this.scene.add(grp);
    return grp;
  }

  syncRobot(r, grp) {
    grp.position.set(r.x, 0, r.y);
    grp.rotation.y = -r.heading;               // canvas y+ → world z+
    // turret aims at own hub (TurretShooter mechanism computes the angle)
    const ts = r.mechanisms.find(m => m.turretAngle !== undefined);
    if (ts && grp.userData.turretBarrel) {
      const rel = ts.turretAngle - r.heading;
      grp.userData.turretBarrel.rotation.y = -rel;
      grp.userData.turretBarrel.position.set(
        Math.cos(-rel) * r.def.size * 0.25, 0.74, Math.sin(-rel) * r.def.size * 0.25 - r.def.size * 0.05);
    }
    if (r.fuel !== grp.userData.lastFuel) {    // rebuild ring only on change
      grp.userData.lastFuel = r.fuel;
      if (grp.userData.ring) { grp.remove(grp.userData.ring); grp.userData.ring.geometry.dispose(); }
      const frac = Math.min(1, r.fuel / r.def.capacity);
      const geo = new THREE.TorusGeometry(grp.userData.ringR, 0.045, 6, 32,
        Math.max(0.001, frac * Math.PI * 2));
      const mat = new THREE.MeshBasicMaterial({ color: frac >= 1 ? 0xffe84d : 0xebc328 });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = Math.PI / 2;
      ring.position.y = grp.userData.ringY;
      grp.add(ring);
      grp.userData.ring = ring;
    }
  }

  render() {
    // fuel
    const seen = new Set();
    for (const f of this.world.fuel) {
      seen.add(f);
      let m = this.fuelMeshes.get(f);
      if (!m) { m = new THREE.Mesh(this.fuelGeo, this.fuelMat); this.scene.add(m); this.fuelMeshes.set(f, m); }
      m.material = f.owner ? this.fuelMatHot : this.fuelMat;
      const speed = Math.hypot(f.vx, f.vy);
      m.position.set(f.x, f.r + speed * 0.06, f.y);   // lob height fake
    }
    for (const [f, m] of this.fuelMeshes)
      if (!seen.has(f)) { this.scene.remove(m); this.fuelMeshes.delete(f); }
    // robots
    const rseen = new Set();
    for (const r of this.world.robots) {
      rseen.add(r);
      let grp = this.robotMeshes.get(r);
      if (!grp) { grp = this.makeRobot(r); this.robotMeshes.set(r, grp); }
      this.syncRobot(r, grp);
    }
    for (const [r, grp] of this.robotMeshes)
      if (!rseen.has(r)) { this.scene.remove(grp); this.robotMeshes.delete(r); }
    this.r.render(this.scene, this.cam);
  }
}
