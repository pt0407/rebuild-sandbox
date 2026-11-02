// engine.js — field, fuel, scoring for the REBUILD sandbox (FRC 2026 REBUILT-style).
// Field: 16.46m x 8.21m. Blue zone left, red zone right, neutral zone middle.
// FUEL is the game piece: scattered in neutral + depot, collected into hoppers.
"use strict";

const REBUILD = window.REBUILD = {
  FIELD_W: 16.46,
  FIELD_H: 8.21,
  NEUTRAL_X0: 6.2, NEUTRAL_X1: 10.26,      // neutral zone band
  robots: {},
  mechanisms: {},
  registerRobot(def) {
    if (!def.id) throw new Error("robot def needs an id");
    this.robots[def.id] = def;
    return def;
  },
  registerMechanism(type, cls) { this.mechanisms[type] = cls; return cls; },
};

const Input = {
  down: new Set(), pressed: new Set(),
  init() {
    window.addEventListener("keydown", e => {
      if (e.repeat) return;
      this.down.add(e.code); this.pressed.add(e.code);
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", e => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
  },
  axis(neg, pos) { return (this.down.has(pos) ? 1 : 0) - (this.down.has(neg) ? 1 : 0); },
  hit(code) { return this.pressed.has(code); },
  endFrame() { this.pressed.clear(); },
};

// One FUEL ball on the ground or in flight.
class Fuel {
  constructor(x, y, vx, vy, owner) {
    this.x = x; this.y = y; this.vx = vx || 0; this.vy = vy || 0;
    this.r = 0.11; this.owner = owner || null; this.dead = false;
  }
  update(dt, world) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    const f = Math.pow(0.25, dt);
    this.vx *= f; this.vy *= f;
    if (this.x < this.r || this.x > REBUILD.FIELD_W - this.r) { this.vx *= -0.5; this.x = Math.max(this.r, Math.min(REBUILD.FIELD_W - this.r, this.x)); }
    if (this.y < this.r || this.y > REBUILD.FIELD_H - this.r) { this.vy *= -0.5; this.y = Math.max(this.r, Math.min(REBUILD.FIELD_H - this.r, this.y)); }
    world.checkScore(this);
  }
  draw(ctx, s) {
    ctx.beginPath();
    ctx.arc(this.x * s, this.y * s, this.r * s, 0, 7);
    ctx.fillStyle = this.owner ? "#ffd84d" : "#ebc328";
    ctx.fill();
  }
}

// Solid obstacle (trench wall / bump). Robots collide; lowProfile robots
// cross trenches at full speed.
class Obstacle {
  constructor(x, y, w, h, kind) {   // kind: "trench" | "bump"
    this.x = x; this.y = y; this.w = w; this.h = h; this.kind = kind;
  }
  contains(px, py) {
    return Math.abs(px - this.x) < this.w / 2 && Math.abs(py - this.y) < this.h / 2;
  }
  draw(ctx, s) {
    ctx.fillStyle = this.kind === "trench" ? "#15171b" : "#2c2f36";
    ctx.strokeStyle = this.kind === "trench" ? "#3a3e48" : "#4a4e58";
    ctx.fillRect((this.x - this.w / 2) * s, (this.y - this.h / 2) * s, this.w * s, this.h * s);
    ctx.strokeRect((this.x - this.w / 2) * s, (this.y - this.h / 2) * s, this.w * s, this.h * s);
    if (this.kind === "bump") {
      ctx.strokeStyle = "#ffffff18";
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo((this.x - this.w / 2) * s, (this.y + i * this.h / 5) * s);
        ctx.lineTo((this.x + this.w / 2) * s, (this.y + i * this.h / 5) * s);
        ctx.stroke();
      }
    }
  }
}

class World {
  constructor() {
    this.fuel = [];
    this.robots = [];
    this.score = { blue: 0, red: 0 };
    this.time = 140;
    this.phase = "teleop";           // "endgame" last 20s
    this.climbed = { blue: 0, red: 0 };

    // hubs: scoring target per alliance — blue shoots at BLUE hub on the LEFT.
    this.hubs = [
      { alliance: "blue", x: 1.5, y: REBUILD.FIELD_H / 2, w: 1.8, h: 2.4 },
      { alliance: "red",  x: REBUILD.FIELD_W - 1.5, y: REBUILD.FIELD_H / 2, w: 1.8, h: 2.4 },
    ];
    // towers for climbing, next to each hub
    this.towers = [
      { alliance: "blue", x: 1.5, y: 1.1, r: 0.6 },
      { alliance: "red",  x: REBUILD.FIELD_W - 1.5, y: 1.1, r: 0.6 },
    ];
    // depots: fuel stacks at each alliance's far corners (real field layout)
    this.depots = [
      { alliance: "blue", x: 0.9, y: 0.8, w: 1.2, h: 0.8 },
      { alliance: "blue", x: 0.9, y: REBUILD.FIELD_H - 0.8, w: 1.2, h: 0.8 },
      { alliance: "red",  x: REBUILD.FIELD_W - 0.9, y: 0.8, w: 1.2, h: 0.8 },
      { alliance: "red",  x: REBUILD.FIELD_W - 0.9, y: REBUILD.FIELD_H - 0.8, w: 1.2, h: 0.8 },
    ];
    // obstacles: two trenches (top/bottom of neutral) + a center bump
    this.obstacles = [
      new Obstacle(8.23, 1.4, 2.4, 0.5, "trench"),
      new Obstacle(8.23, REBUILD.FIELD_H - 1.4, 2.4, 0.5, "trench"),
      new Obstacle(8.23, REBUILD.FIELD_H / 2, 1.0, 1.6, "bump"),
    ];

    // scatter FUEL across the neutral zone — real matches carry ~400 fuel
    let n = 0;
    for (let gx = 0; gx < 24 && n < 320; gx++)
      for (let gy = 0; gy < 14 && n < 320; gy++) {
        const fx = REBUILD.NEUTRAL_X0 + 0.4 + gx * 0.17;
        const fy = 0.7 + gy * 0.5;
        if (!this.obstacles.some(o => o.contains(fx, fy))) {
          this.fuel.push(new Fuel(fx + (Math.random() - .5) * .08, fy + (Math.random() - .5) * .08));
          n++;
        }
      }
    // depot fuel stacks
    for (const d of this.depots)
      for (let i = 0; i < 12; i++)
        this.fuel.push(new Fuel(d.x - d.w / 2 + 0.15 + (i % 4) * 0.3,
                                d.y - d.h / 2 + 0.15 + Math.floor(i / 4) * 0.28));
  }

  allianceZone(alliance) {   // x-range where this alliance may score
    return alliance === "blue" ? [0, REBUILD.NEUTRAL_X0] : [REBUILD.NEUTRAL_X1, REBUILD.FIELD_W];
  }

  checkScore(f) {
    if (!f.owner) return;
    const hub = this.hubs.find(h => h.alliance === f.owner.alliance);
    if (Math.abs(f.x - hub.x) < hub.w / 2 && Math.abs(f.y - hub.y) < hub.h / 2
        && Math.hypot(f.vx, f.vy) > 0.4) {
      this.score[f.owner.alliance]++;
      f.dead = true;
    }
  }

  update(dt) {
    if (this.phase === "teleop") {
      this.time -= dt;
      if (this.time <= 0) { this.phase = "endgame"; this.time = 20; }
    } else if (this.phase === "endgame") {
      this.time -= dt;
      if (this.time <= 0) this.phase = "done";
    }
    for (const r of this.robots) r.update(dt, this);
    for (const f of this.fuel) if (!f.dead) f.update(dt, this);
    this.fuel = this.fuel.filter(f => !f.dead);
  }
}
