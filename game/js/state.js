// state.js — the shared game state object every module reads and writes.
// One source of truth for mode, cash, health, wanted heat and entity lists.

export const G = {
  mode: 'menu',            // menu | play | pause | dead | busted | story
  time: 0,                 // seconds since play started
  dt: 0,
  cash: 0,
  health: 100,
  heat: 0,                 // wanted heat, 30 per star
  stars: 0,
  lastCrime: -999,         // G.time of last crime, for cooldown
  crimeFlash: 0,           // hud pulse timer
  player: null,            // set by player.js
  vehicles: [],            // every car: traffic, parked, police, mission
  peds: [],                // pedestrians
  shots: [],               // active tracer/hit records for weapons.js
  missionIndex: 0,         // index into missions.js chain
  missionStage: 0,
  missionTimer: 0,
  missionData: null,       // per-mission scratch (target car, checkpoints…)
  banner: null,            // {text, sub, t} big center banner
  toast: null,             // {text, t} small notification
  stats: { crimes: 0, carsStolen: 0, missionsDone: 0, distance: 0 },
  shake: 0,                // camera shake energy
  muted: false,
};

export function addCash(amount) {
  G.cash = Math.max(0, G.cash + amount);
  if (amount !== 0) showToast((amount > 0 ? '+ $' : '- $') + Math.abs(amount));
}

export function showToast(text, t = 3) {
  G.toast = { text, t };
}

export function showBanner(text, sub = '', t = 3.5) {
  G.banner = { text, sub, t };
}

export function damagePlayer(amount) {
  if (G.mode !== 'play') return;
  G.health -= amount;
  G.shake = Math.min(1.5, G.shake + amount * 0.02);
  if (G.health <= 0) {
    G.health = 0;
    G.mode = 'dead';
  }
}

// Distance helpers used across systems (XZ plane).
export function dist2D(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference a->b, radians.
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// build marker: state.js