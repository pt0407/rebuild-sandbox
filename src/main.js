// main.js — boot, HUD, game loop (3D render via render3d.js)
import { Renderer } from "./render3d.js";
"use strict";

const canvas = document.getElementById("game");
Input.init();

const world = new World();
const renderer = new Renderer(canvas, world);

// ---- roster UI ----
const rosterEl = document.getElementById("roster");
let player = null;
function buildRoster() {
  rosterEl.innerHTML = "<h3>ROBOTS</h3>";
  for (const id in REBUILD.robots) {
    const d = REBUILD.robots[id];
    const div = document.createElement("div");
    div.className = "bot"; div.dataset.id = id;
    div.innerHTML = `<span class="num">${d.team}</span>` +
      `<span>${d.name} <span class="arche">${d.archetype}</span></span>` +
      `<span class="rating">${d.rating}</span>`;
    div.onclick = () => spawnPlayer(id);
    rosterEl.appendChild(div);
  }
}
buildRoster();

function spawnPlayer(id) {
  const def = REBUILD.robots[id];
  world.robots = world.robots.filter(r => r !== player);
  player = new Robot(def, 2.5, REBUILD.FIELD_H / 2, 0, true, "blue");
  world.robots.push(player);
  document.querySelectorAll(".bot").forEach(e =>
    e.classList.toggle("sel", e.dataset.id === id));
  document.getElementById("keys").textContent =
    `WASD drive · JL turn\n${player.helpLines().join("\n")}\n\` 1v1   \\ 3v3`;
}
spawnPlayer("6800");

function spawnAlliance(count) {
  world.robots = world.robots.filter(r => r === player);
  const ids = Object.keys(REBUILD.robots).filter(i => i !== player.def.id);
  for (let i = 0; i < count * 2 - 1; i++) {
    const al = i < count - 1 ? "blue" : "red";
    const def = REBUILD.robots[ids[(Math.random() * ids.length) | 0]];
    const x = al === "blue" ? 2 + i * 0.8 : REBUILD.FIELD_W - 2 - (i - count + 1) * 0.8;
    const r = new Robot(def, x, 1.5 + (i % 5) * 1.3, al === "blue" ? 0 : Math.PI, false, al);
    world.robots.push(r);
  }
}
spawnAlliance(3);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (Input.hit("Backquote")) spawnAlliance(1);
  if (Input.hit("Backslash")) spawnAlliance(3);
  world.update(dt);
  renderer.render();
  document.getElementById("s-blue").textContent = world.score.blue;
  document.getElementById("s-red").textContent = world.score.red;
  const t = Math.max(0, Math.ceil(world.time));
  document.getElementById("clock").textContent =
    world.phase === "done" ? "FINAL"
    : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}${world.phase === "endgame" ? " END" : ""}`;
  document.getElementById("msg").textContent =
    world.phase === "endgame" ? "ENDGAME — CLIMB" : world.phase === "done" ? "MATCH OVER" : "";
  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
