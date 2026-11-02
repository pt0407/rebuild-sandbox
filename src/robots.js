// robots.js — Robot entity with REBUILT-style stat blocks.
//
// Robot def shape (see robots/official.js, robots/custom.js):
//   { id, team, name, archetype, rating("F".."S"), color, accent,
//     size, maxSpeed, maxOmega, accel, lowProfile,
//     capacity, intakeRate, shootRate, accuracy,
//     mechanisms: [{type, ...cfg}] }
"use strict";

class Robot {
  constructor(def, x, y, heading, isPlayer, alliance) {
    this.def = def;
    this.x = x; this.y = y; this.heading = heading;
    this.vx = 0; this.vy = 0; this.omega = 0;
    this.alliance = alliance || def.alliance || "blue";
    this.fuel = 0;                          // hopper contents
    this.isPlayer = !!isPlayer;
    this.mechanisms = (def.mechanisms || []).map(m => {
      const Cls = REBUILD.mechanisms[m.type];
      if (!Cls) { console.warn("unknown mechanism", m.type); return null; }
      return new Cls(this, m);
    }).filter(Boolean);
    this.ai = isPlayer ? null : { mode: "collect", t: 0 };
  }

  driveInput(dt, fwd, turn, world) {
    const d = this.def;
    let speedMul = 1;
    // trenches slow non-low-profile robots to a crawl
    for (const o of world.obstacles)
      if (o.kind === "trench" && o.contains(this.x, this.y) && !d.lowProfile)
        speedMul = 0.25;
    const targetV = fwd * d.maxSpeed * speedMul;
    const targetW = turn * (d.maxOmega || 4);
    const k = Math.min(1, (d.accel || 6) * dt);
    this.vx += (Math.cos(this.heading) * targetV - this.vx) * k;
    this.vy += (Math.sin(this.heading) * targetV - this.vy) * k;
    this.omega += (targetW - this.omega) * Math.min(1, 8 * dt);
  }

  playerControl(dt, world) {
    const fwd = Input.axis("KeyS", "KeyW") + Input.axis("ArrowDown", "ArrowUp");
    const turn = Input.axis("KeyD", "KeyA") + Input.axis("ArrowRight", "ArrowLeft")
               + Input.axis("KeyL", "KeyJ");
    this.driveInput(dt, fwd, turn, world);
    this._intaking = Input.down.has("ShiftLeft");
    this._shooting = Input.down.has("Space") || Input.down.has("KeyB");
  }

  // NPC: fill hopper in neutral, drive to own hub, unload — repeat.
  aiControl(dt, world) {
    const a = this.ai;
    const zone = world.allianceZone(this.alliance);
    const hub = world.hubs.find(h => h.alliance === this.alliance);
    if (this.fuel >= this.def.capacity) a.mode = "score";
    else if (this.fuel === 0) a.mode = "collect";

    let tx, ty, spd = 0.9;
    if (a.mode === "collect") {
      let best = null, bd = 1e9;
      for (const f of world.fuel) {
        if (f.owner) continue;
        const d2 = (f.x - this.x) ** 2 + (f.y - this.y) ** 2;
        if (d2 < bd) { bd = d2; best = f; }
      }
      if (best) { tx = best.x; ty = best.y; }
      else { tx = (REBUILD.NEUTRAL_X0 + REBUILD.NEUTRAL_X1) / 2; ty = REBUILD.FIELD_H / 2; }
      this._intaking = true; this._shooting = false;
      if (bd < 1.2) spd = 0.35;                     // crawl over the pile
    } else {
      // stop short of the hub on our side, then hold and shoot
      tx = hub.x + (this.alliance === "blue" ? 2.2 : -2.2);
      ty = hub.y;
      this._intaking = false;
      this._shooting = Math.hypot(this.x - tx, this.y - ty) < 1.0;
      if (this._shooting) spd = 0;
    }
    const ang = Math.atan2(ty - this.y, tx - this.x);
    let dd = ang - this.heading;
    while (dd > Math.PI) dd -= 2 * Math.PI;
    while (dd < -Math.PI) dd += 2 * Math.PI;
    this.driveInput(dt, Math.abs(dd) < 0.9 ? spd : 0.15, Math.max(-1, Math.min(1, dd * 1.8)), world);
  }

  update(dt, world) {
    if (this.isPlayer) this.playerControl(dt, world); else this.aiControl(dt, world);
    this.heading += this.omega * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const m = this.def.size / 2;
    // obstacle collision (bump is solid for everyone; trench solid only if
    // you're not already inside — lowProfile bots sail over)
    for (const o of world.obstacles) {
      if (o.kind === "trench" && this.def.lowProfile) continue;
      if (o.contains(this.x, this.y)) {
        const px = o.w / 2 + m - Math.abs(this.x - o.x);
        const py = o.h / 2 + m - Math.abs(this.y - o.y);
        if (px < py) this.x = o.x + Math.sign(this.x - o.x) * (o.w / 2 + m);
        else this.y = o.y + Math.sign(this.y - o.y) * (o.h / 2 + m);
      }
    }
    this.x = Math.max(m, Math.min(REBUILD.FIELD_W - m, this.x));
    this.y = Math.max(m, Math.min(REBUILD.FIELD_H - m, this.y));

    if (this.isPlayer) {
      for (const mech of this.mechanisms) mech.update(dt, world);
    } else {
      // NPC mechanism drive — direct state manipulation
    }
    if (!this.isPlayer) {
      if (this._intaking && this.fuel < this.def.capacity) {
        const want = Math.ceil(this.def.intakeRate / 30) || 1;
        for (const f of world.fuel) {
          if (f.dead || f.owner) continue;
          if (Math.hypot(f.x - this.x, f.y - this.y) < m + 0.6) {
            f.dead = true; this.fuel += want;
            if (this.fuel >= this.def.capacity) { this.fuel = this.def.capacity; break; }
          }
        }
      }
      if (this._shooting && this.fuel > 0) {
        this.fuel--;
        const hub = world.hubs.find(h => h.alliance === this.alliance);
        const a = Math.atan2(hub.y - this.y, hub.x - this.x)
                + (Math.random() - 0.5) * (1 - this.def.accuracy) * 0.9;
        world.fuel.push(new Fuel(this.x, this.y, Math.cos(a) * 9, Math.sin(a) * 9, this));
      }
    }
    // push loose fuel
    for (const f of world.fuel) {
      if (f.owner) continue;
      const dx = f.x - this.x, dy = f.y - this.y, dist = Math.hypot(dx, dy), min = m + f.r;
      if (dist < min && dist > 0) {
        f.x = this.x + dx / dist * min; f.y = this.y + dy / dist * min;
        f.vx += dx / dist; f.vy += dy / dist;
      }
    }
  }

  draw(ctx, s) {
    const d = this.def, half = d.size / 2 * s;
    ctx.save();
    ctx.translate(this.x * s, this.y * s); ctx.rotate(this.heading);
    ctx.fillStyle = this.alliance === "red" ? this.shade(d.color, -0.15) : d.color;
    ctx.fillRect(-half, -half, half * 2, half * 2);
    ctx.strokeStyle = this.alliance === "blue" ? "#6aa5ff" : "#ff6a6a";
    ctx.strokeRect(-half, -half, half * 2, half * 2);
    // barrel
    ctx.strokeStyle = d.accent || "#fff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -d.size * 0.18 * s);
    ctx.lineTo(d.size * 0.55 * s, -d.size * 0.18 * s); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.rotate(-this.heading);
    ctx.fillStyle = "#fff"; ctx.font = `${Math.max(9, Math.round(d.size * s * 0.35))}px monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(d.team, 0, 0);
    ctx.restore();

    // hopper meter — ring around robot, lights up when full (real sim does this)
    const frac = this.fuel / d.capacity;
    ctx.beginPath();
    ctx.arc(this.x * s, this.y * s, (d.size / 2 + 0.22) * s, -Math.PI / 2,
            -Math.PI / 2 + frac * Math.PI * 2);
    ctx.strokeStyle = frac >= 1 ? "#ffe84d" : "#ebc328";
    ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
    if (frac >= 1) {
      ctx.beginPath();
      ctx.arc(this.x * s, this.y * s, (d.size / 2 + 0.22) * s, 0, 7);
      ctx.strokeStyle = "#ffe84d55"; ctx.stroke();
    }
    for (const mech of this.mechanisms)
      if (this.isPlayer || mech.cfg.alwaysDraw) mech.draw(ctx, s);
  }

  shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }

  helpLines() { return this.mechanisms.map(m => m.describe()).filter(Boolean); }
}
