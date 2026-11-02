// custom.js — YOUR custom robots. Copy a block, tweak, reload. That's it.
[
  // 6800 Valor — bidirectional shooter: front OR rear barrel, scores either way.
  {
    id: "6800", team: "6800", name: "Valor (BIDIRECTIONAL)", archetype: "turret-shooter",
    rating: "A", tags: ["ON_THE_MOVE"],
    color: "#7a3fd1", accent: "#ff9d4d",
    size: 0.9, maxSpeed: 4.5, accel: 8.4, maxOmega: 5, push: 145,
    capacity: 80, intakeRate: 26, shootRate: 14, accuracy: 0.9, shootMove: 80,
    mechanisms: [
      { type: "intake" },
      { type: "bidirectional-shooter", keyFront: "Space", keyBack: "KeyB" },
      { type: "outtake" },
      { type: "climber" },
    ],
  },
  // Reskin example: 4414 chassis, buffed stats, same tags.
  {
    id: "4414x", team: "4414X", name: "HighTide (tuned reskin)", archetype: "turret-shooter",
    rating: "S+", tags: ["TURRET", "OUTTAKE", "BIG_HOPPER", "ON_THE_MOVE"],
    color: "#111", accent: "#5ee0ff",
    size: 0.9, maxSpeed: 5.4, accel: 10, maxOmega: 6, push: 135,
    capacity: 130, intakeRate: 45, shootRate: 18, accuracy: 0.95, shootMove: 90,
    mechanisms: [{ type: "intake" }, { type: "turret-shooter" }, { type: "outtake" }, { type: "climber" }],
  },
].forEach(d => REBUILD.registerRobot(d));
