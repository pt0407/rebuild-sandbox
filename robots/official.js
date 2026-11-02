// official.js — REAL stats harvested from REBUILD build 1927696's picker.
// Units converted to sandbox units:
//   speed ft/s -> m/s (x0.3048) · accel ft/s² -> arbitrary accel gain
//   capacity FUEL · intakeRate/fireRate bps · shootMove = "shoot on move" %
//   tags: TURRET BIG_HOPPER OUTTAKE CLIMB SHOT_BLOCKER NO_PASSING ON_THE_MOVE V2
[
  {
    id: "4414", team: "4414", name: "HighTide", archetype: "turret-shooter",
    rating: "S+", tags: ["TURRET", "OUTTAKE", "BIG_HOPPER", "ON_THE_MOVE"],
    color: "#c22", accent: "#eee",
    size: 0.9, maxSpeed: 4.51, accel: 8.7, maxOmega: 5, push: 135,
    capacity: 110, intakeRate: 40, shootRate: 14, accuracy: 0.9, shootMove: 85,
    mechanisms: [{ type: "intake" }, { type: "turret-shooter" }, { type: "outtake" }, { type: "climber" }],
  },
  {
    id: "1114", team: "1114", name: "Simbotics", archetype: "dump-bot",
    rating: "S-", tags: ["BIG_HOPPER"],
    color: "#a33", accent: "#ccc",
    size: 0.92, maxSpeed: 4.27, accel: 8.1, maxOmega: 4.5, push: 146,
    capacity: 90, intakeRate: 28, shootRate: 22, accuracy: 0.88, shootMove: 0,
    mechanisms: [{ type: "intake" }, { type: "shooter" }, { type: "climber" }],
  },
  {
    id: "2481", team: "2481", name: "Roboteers", archetype: "dump-bot",
    rating: "S+", tags: ["NO_PASSING", "BIG_HOPPER"],
    color: "#a33", accent: "#ddd",
    size: 0.9, maxSpeed: 3.81, accel: 8.1, maxOmega: 4.2, push: 150,
    capacity: 115, intakeRate: 25, shootRate: 21, accuracy: 0.87, shootMove: 0,
    mechanisms: [{ type: "intake" }, { type: "shooter" }, { type: "climber" }],
  },
  {
    id: "1323", team: "1323", name: "MadTown Robotics", archetype: "turret-shooter",
    rating: "A+", tags: ["TURRET", "SHOT_BLOCKER", "BIG_HOPPER", "ON_THE_MOVE"],
    color: "#c22", accent: "#eee",
    size: 0.9, maxSpeed: 4.51, accel: 8.4, maxOmega: 5, push: 140,
    capacity: 70, intakeRate: 28, shootRate: 12.5, accuracy: 0.9, shootMove: 80,
    mechanisms: [{ type: "intake" }, { type: "turret-shooter" }, { type: "outtake" }, { type: "climber" }],
  },
  {
    id: "359v2", team: "359", name: "Hawaiian Kids V2", archetype: "turret-shooter",
    rating: "B-", tags: ["V2", "TURRET", "OUTTAKE"],
    color: "#c33", accent: "#eee",
    size: 0.85, maxSpeed: 4.51, accel: 8.1, maxOmega: 5, push: 150,
    capacity: 55, intakeRate: 22, shootRate: 10, accuracy: 0.88, shootMove: 70,
    mechanisms: [{ type: "intake" }, { type: "turret-shooter" }, { type: "outtake" }, { type: "climber" }],
  },
  {
    id: "254", team: "254", name: "The Cheesy Poofs", archetype: "low-cycler",
    rating: "A", tags: [],
    color: "#222", accent: "#5ee0ff",
    size: 0.88, maxSpeed: 4.51, accel: 8.1, maxOmega: 5.2, push: 150,
    capacity: 70, intakeRate: 30, shootRate: 24, accuracy: 0.88, shootMove: 20,
    mechanisms: [{ type: "intake" }, { type: "shooter" }, { type: "climber" }],
  },
  {
    id: "4946", team: "4946", name: "The Alpha Dogs", archetype: "turret-shooter",
    rating: "A", tags: ["TURRET", "BIG_HOPPER", "ON_THE_MOVE"],
    color: "#c22", accent: "#eee",
    size: 0.9, maxSpeed: 4.11, accel: 8.1, maxOmega: 4.8, push: 150,
    capacity: 100, intakeRate: 20, shootRate: 16, accuracy: 0.9, shootMove: 75,
    mechanisms: [{ type: "intake" }, { type: "turret-shooter" }, { type: "outtake" }, { type: "climber" }],
  },
  {
    id: "1678", team: "1678", name: "Citrus Circuits", archetype: "dump-bot",
    rating: "A+", tags: ["CLIMB", "OUTTAKE"],
    color: "#e8571e", accent: "#fff",
    size: 0.9, maxSpeed: 4.11, accel: 8.1, maxOmega: 4.8, push: 148,
    capacity: 65, intakeRate: 28, shootRate: 22, accuracy: 0.89, shootMove: 0,
    mechanisms: [{ type: "intake" }, { type: "shooter" }, { type: "outtake" }, { type: "climber" }],
  },
  {
    id: "2910v2", team: "2910", name: "Jack in the Bot V2", archetype: "hooded",
    rating: "A-", tags: ["V2"],
    color: "#0a3d62", accent: "#ebc328",
    size: 0.88, maxSpeed: 4.51, accel: 8.4, maxOmega: 5.2, push: 140,
    capacity: 50, intakeRate: 33, shootRate: 32, accuracy: 0.9, shootMove: 0,
    mechanisms: [{ type: "intake" }, { type: "shooter" }, { type: "climber" }],
  },
].forEach(d => REBUILD.registerRobot(d));
