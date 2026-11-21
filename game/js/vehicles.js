// vehicles.js — original low-poly car factory (Sunray GT, Marlin, Dorado,
// Brisa, Furgón, patrol cruisers), arcade driving physics, carjacking and
// enter/exit. Every car in the world lives in G.vehicles.

import { G, dist2D, clamp, showToast, damagePlayer } from './state.js';
import { Input, hit } from './input.js';
import { collideCircle } from './city.js';
import { addHeat } from './wanted.js';
import { crash } from './audio.js';
import { spawnSmoke, spawnSparks } from './effects.js';

export const KINDS = {
  brisa:  { name: 'Brisa',       top: 28, accel: 15, grip: 1.0,  w: 1.8, l: 3.6, h: 0.55, cabin: 0.5,  colors: [0x6ec6e8, 0xf2d16b, 0xb8e0a0] },
  marlin: { name: 'Marlin',      top: 33, accel: 18, grip: 1.0,  w: 1.9, l: 4.4, h: 0.58, cabin: 0.52, colors: [0xd8d3c8, 0x7a8aa0, 0x9a6a5a, 0x5a7a6a] },
  dorado: { name: 'Dorado',      top: 38, accel: 23, grip: 0.92, w: 2.0, l: 4.6, h: 0.55, cabin: 0.46, colors: [0xe86a3a, 0x3a3a44, 0xc8b060] },
  sunray: { name: 'Sunray GT',   top: 43, accel: 28, grip: 1.1,  w: 1.95, l: 4.3, h: 0.48, cabin: 0.4, colors: [0xff4f8b, 0xffd76e, 0x4de3ff] },
  furgon: { name: 'Furgón',      top: 25, accel: 12, grip: 0.85, w: 2.1, l: 4.9, h: 0.8,  cabin: 0.95, colors: [0xd8d0c0, 0x8aa0b8] },
  patrol: { name: 'Patrulla',    top: 37, accel: 24, grip: 1.05, w: 1.95, l: 4.6, h: 0.58, cabin: 0.52, colors: [0xf2f2f2] },
};

let nextId = 1;
const darkMat = new THREE.MeshLambertMaterial({ color: 0x22252e });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x2c3e5c });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x1c1c22 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false });

function buildCarMesh(kind, color) {
  const K = KINDS[kind];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(K.w, K.h, K.l), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabinLen = kind === 'furgon' ? K.l * 0.72 : K.l * 0.46;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(K.w * 0.86, K.cabin, cabinLen), glassMat);
  cabin.position.set(0, 0.55 + K.h / 2 + K.cabin / 2 - 0.04, kind === 'furgon' ? -0.2 : -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(K.w * 0.88, 0.08, cabinLen * 0.9), bodyMat);
  roof.position.set(0, cabin.position.y + K.cabin / 2 + 0.03, cabin.position.z);
  group.add(roof);

  if (kind === 'sunray' || kind === 'dorado') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(K.w * 0.9, 0.08, 0.5), bodyMat);
    spoiler.position.set(0, 1.05, -K.l / 2 + 0.3);
    group.add(spoiler);
  }
  if (kind === 'patrol') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(K.w + 0.04, 0.22, K.l * 0.9), darkMat);
    stripe.position.y = 0.55;
    group.add(stripe);
  }

  // Wheels: outer group steers, inner mesh rolls.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx * (K.w / 2 + 0.02), 0.36, wz * (K.l / 2 - 0.85));
    const wheel = new THREE.Mesh(wheelGeo, tireMat);
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push({ pivot, wheel, front: wz > 0 });
  }

  // Lights.
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    head.position.set(s * (K.w / 2 - 0.3), 0.62, K.l / 2 + 0.02);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tail.position.set(s * (K.w / 2 - 0.3), 0.62, -K.l / 2 - 0.02);
    group.add(head, tail);
  }

  let lightbar = null;
  if (kind === 'patrol') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.34), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.34), new THREE.MeshBasicMaterial({ color: 0x2060ff, toneMapped: false }));
    blue.position.x = 0.3;
    bar.add(red, blue);
    bar.position.set(0, cabin.position.y + K.cabin / 2 + 0.16, cabin.position.z);
    group.add(bar);
    lightbar = { red, blue };
  }
  return { group, wheels, lightbar, bodyMat };
}

export function makeVehicle(kind, x, z, heading, opts = {}) {
  const K = KINDS[kind];
  const color = opts.color ?? K.colors[Math.floor(Math.random() * K.colors.length)];
  const { group, wheels, lightbar, bodyMat } = buildCarMesh(kind, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  World_scene().add(group);
  const v = {
    id: nextId++, kind, name: K.name, mesh: group, wheels, lightbar, bodyMat,
    pos: group.position, heading, speed: 0, steer: 0,
    hp: 100, destroyed: false,
    driver: null,               // 'player' when driven
    ai: opts.ai || null,        // 'traffic' | 'police' | null
    axis: opts.axis, dir: opts.dir, road: opts.road,
    targetSpeed: opts.targetSpeed ?? 0,
    skid: 0, smokeT: 0, flashT: 0,
    missionTag: opts.missionTag || null,
  };
  G.vehicles.push(v);
  return v;
}

let _scene = null;
function World_scene() { return _scene; }
export function bindVehicles(scene) { _scene = scene; }

// ---- physics ----

// control: {throttle -1..1, steer -1..1, handbrake bool}
export function drivePhysics(v, dt, control) {
  if (v.destroyed) { v.speed = 0; return; }
  const K = KINDS[v.kind];
  const throttle = control.throttle;
  if (throttle > 0) v.speed += K.accel * throttle * dt;
  else if (throttle < 0) {
    if (v.speed > 0.5) v.speed -= 34 * dt;         // brake
    else v.speed -= K.accel * 0.5 * dt;             // reverse
  }
  v.speed -= v.speed * 0.55 * dt;                   // drag
  if (control.handbrake) v.speed -= v.speed * 2.6 * dt;
  v.speed = clamp(v.speed, -9, K.top);

  // Steering: responsive at low speed, stable at high speed.
  const steerTarget = control.steer;
  v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
  const speedFactor = clamp(Math.abs(v.speed) / 6, 0, 1) / (1 + Math.abs(v.speed) * 0.028);
  const turn = v.steer * 2.3 * speedFactor * K.grip * Math.sign(v.speed || 1);
  v.heading += turn * dt;

  // Drift / skid state.
  const drifting = Math.abs(v.steer) > 0.55 && Math.abs(v.speed) > 14 || control.handbrake && Math.abs(v.speed) > 8;
  v.skid = drifting ? clamp(Math.abs(v.speed) / 24, 0.3, 1) : Math.max(0, v.skid - dt * 3);
  if (drifting) v.speed -= v.speed * 0.35 * dt;

  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  v.pos.x += fx * v.speed * dt;
  v.pos.z += fz * v.speed * dt;

  const impact = Math.abs(v.speed);
  if (collideCircle(v.pos, 1.75) && impact > 4) {
    crash(impact / 30);
    spawnSparks(v.pos.x, 0.7, v.pos.z, 8);
    damageVehicle(v, impact * 0.5);
    if (v.driver === 'player') { G.shake = Math.min(1.4, G.shake + impact * 0.03); damagePlayer(impact * 0.22); }
    v.speed *= -0.25;
  }

  v.mesh.rotation.y = v.heading;
  for (const w of v.wheels) {
    w.wheel.rotation.x += v.speed * dt / 0.36;
    if (w.front) w.pivot.rotation.y = v.steer * 0.42;
  }
  if (v.hp < 45) {
    v.smokeT -= dt;
    if (v.smokeT <= 0) { v.smokeT = 0.12; spawnSmoke(v.pos.x - fx * 1.5, 1.0, v.pos.z - fz * 1.5); }
  }
}

export function damageVehicle(v, amount) {
  if (v.destroyed) return;
  v.hp -= amount;
  if (v.hp <= 0) {
    v.destroyed = true;
    v.speed = 0;
    v.bodyMat.color.multiplyScalar(0.35);
    spawnSmoke(v.pos.x, 1.2, v.pos.z);
    if (v.driver === 'player') {
      exitVehicle(v, true);
      damagePlayer(18);
      showToast('The car is wrecked!');
    }
  }
}

// Car vs car: soft circle separation + momentum exchange.
export function vehicleCollisions(dt) {
  const list = G.vehicles;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.destroyed || b.destroyed) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 25 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (5 - d) / 2;
      const nx = dx / d, nz = dz / d;
      a.pos.x -= nx * push; a.pos.z -= nz * push;
      b.pos.x += nx * push; b.pos.z += nz * push;
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 8) {
        crash(rel / 30);
        spawnSparks((a.pos.x + b.pos.x) / 2, 0.8, (a.pos.z + b.pos.z) / 2, 6);
        damageVehicle(a, rel * 0.3);
        damageVehicle(b, rel * 0.3);
        if (a.driver === 'player' || b.driver === 'player') {
          G.shake = Math.min(1.4, G.shake + rel * 0.025);
          addHeat(6, 'collision');
        }
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.6; b.speed = avg * 0.6;
      }
    }
  }
}

// ---- enter / exit / carjack ----

export function nearestVehicle(pos, maxDist) {
  let best = null, bestD = maxDist;
  for (const v of G.vehicles) {
    if (v.destroyed) continue;
    const d = dist2D(pos, v.pos);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function enterVehicle(v) {
  const p = G.player;
  const wasAi = v.ai;
  const occupied = wasAi === 'traffic' || wasAi === 'police';
  v.ai = null;
  v.driver = 'player';
  p.inCar = v;
  p.mesh.visible = false;
  G.stats.carsStolen++;
  if (occupied) {
    addHeat(v.kind === 'patrol' ? 34 : 22, 'carjack');
    showToast(`Carjacked a ${v.name}!`);
    // The ousted driver flees on foot.
    if (window.__spawnFleeingPed) window.__spawnFleeingPed(v.pos.x + 2, v.pos.z);
  } else {
    showToast(`Entered ${v.name}`);
  }
}

export function exitVehicle(v, forced = false) {
  const p = G.player;
  if (!forced && Math.abs(v.speed) > 8) { showToast('Slow down to get out'); return false; }
  const leftX = v.pos.x - Math.cos(v.heading) * 2.4;
  const leftZ = v.pos.z + Math.sin(v.heading) * 2.4;
  p.pos.set(leftX, 0, leftZ);
  collideCircle(p.pos, 0.5);
  p.heading = v.heading;
  p.inCar = null;
  p.mesh.visible = true;
  v.driver = null;
  v.speed *= 0.4;
  return true;
}

export function tryEnterExit() {
  if (!(hit('KeyE') || hit('KeyF'))) return;
  const p = G.player;
  if (p.inCar) { exitVehicle(p.inCar); return; }
  const v = nearestVehicle(p.pos, 4.2);
  if (v) enterVehicle(v);
}

// Read player controls and drive the possessed car.
export function updatePlayerVehicle(dt) {
  const p = G.player;
  const v = p.inCar;
  if (!v) return;
  let throttle = 0, steer = 0;
  if (Input.keys['KeyW'] || Input.keys['ArrowUp']) throttle = 1;
  if (Input.keys['KeyS'] || Input.keys['ArrowDown']) throttle = -1;
  if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) steer = 1;
  if (Input.keys['KeyD'] || Input.keys['ArrowRight']) steer = -1;
  drivePhysics(v, dt, { throttle, steer, handbrake: !!Input.keys['Space'] });
  p.pos.copy(v.pos);
  p.heading = v.heading;
  G.stats.distance += Math.abs(v.speed) * dt;
}
// build marker: vehicles.js