// mechanisms.js — hopper/intake/shooter/climb for REBUILT-style fuel play.
// Mechanisms read the robot's stat block (speed, capacity, intakeRate, ...).
"use strict";

class Mechanism {
  constructor(robot, cfg) { this.robot = robot; this.cfg = cfg || {}; }
  update(dt, world) {}
  draw(ctx, s) {}
  describe() { return ""; }
}

// Intake: while held, pull ground FUEL into the hopper at intakeRate fuel/s.
class Intake extends Mechanism {
  update(dt, world) {
    const r = this.robot;
    if (!Input.down.has(this.cfg.key || "ShiftLeft")) { this._acc = 0; return; }
    this._acc = (this._acc || 0) + dt * (r.def.intakeRate || 8);
    const range = r.def.size / 2 + (this.cfg.range || 0.45);
    for (const f of world.fuel) {
      if (this._acc < 1) break;
      if (f.dead) continue;
      if (Math.hypot(f.x - r.x, f.y - r.y) < range && Math.hypot(f.vx, f.vy) < 2.5
          && r.fuel < r.def.capacity) {
        f.dead = true; r.fuel++; this._acc -= 1;
      }
    }
    if (this._acc > 4) this._acc = 4;
  }
  draw(ctx, s) {
    const r = this.robot;
    if (!Input.down.has(this.cfg.key || "ShiftLeft")) return;
    ctx.beginPath();
    ctx.arc(r.x * s, r.y * s, (r.def.size / 2 + (this.cfg.range || 0.45)) * s, 0, 7);
    ctx.strokeStyle = "#ebc32855"; ctx.stroke();
  }
  describe() { return `[LSHIFT] intake`; }
}
REBUILD.registerMechanism("intake", Intake);

// Shooter base: while held, launch hopper fuel at shootRate toward your hub
// with accuracy spread. dir=+1 forward, dir=-1 backward (bidirectional bots).
class Shooter extends Mechanism {
  constructor(robot, cfg) { super(robot, cfg); this._acc = 0; this.dir = 1; }
  active() { return Input.down.has(this.cfg.key || "Space"); }
  update(dt, world) {
    const r = this.robot;
    if (!this.active() || r.fuel <= 0) { this._acc = 0; return; }
    this._acc += dt * (r.def.shootRate || 10);
    while (this._acc >= 1 && r.fuel > 0) {
      this._acc -= 1; r.fuel--;
      const hub = world.hubs.find(h => h.alliance === r.alliance);
      // aim at hub center through the chosen barrel direction
      const a = r.heading + (this.dir < 0 ? Math.PI : 0);
      const spread = (1 - (r.def.accuracy || 0.9)) * 0.9;
      const ja = a + (Math.random() - 0.5) * spread;
      const d = r.def.size / 2 + 0.12;
      const mx = r.x + Math.cos(a) * d, my = r.y + Math.sin(a) * d;
      // lead the hub: ballistic-ish lob speed scales with distance
      const dist = Math.hypot(hub.x - r.x, hub.y - r.y);
      const spd = Math.min(12, 4 + dist * 1.1);
      world.fuel.push(new Fuel(mx, my, Math.cos(ja) * spd, Math.sin(ja) * spd, r));
    }
  }
  describe() { return `[${(this.cfg.key||"Space")}] shoot`; }
}
REBUILD.registerMechanism("shooter", Shooter);

// Turret shooter: barrel auto-aims at your hub regardless of chassis heading
// (real TURRET tag). Fire with Space; rotation-independent.
class TurretShooter extends Shooter {
  update(dt, world) {
    const r = this.robot;
    // turret aims itself: track hub
    const hub = world.hubs.find(h => h.alliance === r.alliance);
    this.turretAngle = Math.atan2(hub.y - r.y, hub.x - r.x);
    if (!this.active() || r.fuel <= 0) { this._acc = 0; return; }
    // shooting while moving just widens the spread unless ON_THE_MOVE
    const moving = Math.hypot(r.vx, r.vy) > 0.8;
    this._acc += dt * (r.def.shootRate || 10);
    while (this._acc >= 1 && r.fuel > 0) {
      this._acc -= 1; r.fuel--;
      const spread = (1 - (r.def.accuracy || 0.9)) * (moving && (r.def.shootMove || 0) < 50 ? 2.2 : 0.9);
      const ja = this.turretAngle + (Math.random() - 0.5) * spread;
      const d = r.def.size / 2 + 0.12;
      const dist = Math.hypot(hub.x - r.x, hub.y - r.y);
      const spd = Math.min(12, 4 + dist * 1.1);
      world.fuel.push(new Fuel(r.x + Math.cos(ja) * d, r.y + Math.sin(ja) * d,
        Math.cos(ja) * spd, Math.sin(ja) * spd, r));
    }
  }
  describe() { return "[Space] turret fire (auto-aims at hub)"; }
}
REBUILD.registerMechanism("turret-shooter", TurretShooter);

// Outtake: hold K to dump hopper fuel out the rear as loose balls (real OUTTAKE tag)
class Outtake extends Mechanism {
  update(dt, world) {
    const r = this.robot;
    if (!Input.down.has(this.cfg.key || "KeyK") || r.fuel <= 0) { this._acc = 0; return; }
    this._acc = (this._acc || 0) + dt * 20;
    while (this._acc >= 1 && r.fuel > 0) {
      this._acc -= 1; r.fuel--;
      const a = r.heading + Math.PI + (Math.random() - 0.5) * 0.3;
      world.fuel.push(new Fuel(r.x + Math.cos(a) * (r.def.size / 2 + 0.1),
        r.y + Math.sin(a) * (r.def.size / 2 + 0.1), Math.cos(a) * 2, Math.sin(a) * 2, null));
    }
  }
  describe() { return "[K] outtake (dump fuel)"; }
}
REBUILD.registerMechanism("outtake", Outtake);

// Bidirectional shooter: two barrels, front+back keys, can shoot either way
// while driving — the 6800 Valor archetype.
class BidirectionalShooter extends Shooter {
  active() {
    const f = Input.down.has(this.cfg.keyFront || "Space");
    const b = Input.down.has(this.cfg.keyBack || "KeyB");
    this.dir = b && !f ? -1 : 1;
    return f || b;
  }
  draw(ctx, s) {   // rear barrel marker
    const r = this.robot;
    ctx.save();
    ctx.translate(r.x * s, r.y * s); ctx.rotate(r.heading + Math.PI);
    ctx.strokeStyle = "#ff9d4d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -r.def.size * 0.18 * s);
    ctx.lineTo(r.def.size * 0.55 * s, -r.def.size * 0.18 * s); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
  }
  describe() {
    return `[Space] shoot fwd  [B] shoot BACK`;
  }
}
REBUILD.registerMechanism("bidirectional-shooter", BidirectionalShooter);

// Climber: during endgame, hold near your tower to climb (+traversal pts).
class Climber extends Mechanism {
  constructor(robot, cfg) { super(robot, cfg); this.progress = 0; this.done = false; }
  update(dt, world) {
    if (this.done || world.phase === "teleop") return;
    const r = this.robot;
    const t = world.towers.find(t => t.alliance === r.alliance);
    if (Math.hypot(r.x - t.x, r.y - t.y) < t.r + r.def.size / 2 + 0.2
        && Input.down.has(this.cfg.key || "Tab")) {
      this.progress += dt / (this.cfg.climbTime || 3);
      r.vx = r.vy = r.omega = 0;
      if (this.progress >= 1) {
        this.done = true;
        world.climbed[r.alliance]++;
        world.score[r.alliance] += this.cfg.points || 15;
      }
    } else this.progress = Math.max(0, this.progress - dt);
  }
  draw(ctx, s) {
    if (!this.progress || this.done) return;
    const r = this.robot;
    ctx.beginPath();
    ctx.arc(r.x * s, r.y * s, r.def.size * 0.8 * s, -Math.PI / 2,
            -Math.PI / 2 + this.progress * Math.PI * 2);
    ctx.strokeStyle = "#6aff8a"; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
  }
  describe() { return `[TAB] climb (endgame, at tower)`; }
}
REBUILD.registerMechanism("climber", Climber);
