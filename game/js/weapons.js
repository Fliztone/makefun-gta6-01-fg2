// weapons.js — Dante's pistol: aim with RMB, fire with LMB, reload with R.
// Hitscan against pedestrians, cars and buildings, with tracers, muzzle
// flash and impact particles. Firing in public raises the wanted level.

import { G, clamp, dist2D } from './state.js';
import { Input, hit } from './input.js';
import { City } from './city.js';
import { addHeat } from './wanted.js';
import { damageVehicle } from './vehicles.js';
import { spawnImpact, spawnSparks } from './effects.js';
import { gunshot } from './audio.js';

export const Weapon = {
  ammo: 12, mag: 12, reloading: 0, cooldown: 0,
};

let flashLight = null;
let flashT = 0;
const tracers = [];
let tracerGeo = null;

export function initWeapons(scene) {
  flashLight = new THREE.PointLight(0xffc86e, 0, 14, 2);
  scene.add(flashLight);
  tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false, transparent: true, opacity: 0 }));
    m.visible = false;
    scene.add(m);
    tracers.push({ mesh: m, t: 0 });
  }
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const ex = cx - ox, ey = cy - oy, ez = cz - oz;
  const t = ex * dx + ey * dy + ez * dz;
  if (t < 0) return Infinity;
  const d2 = ex * ex + ey * ey + ez * ez - t * t;
  if (d2 > r * r) return Infinity;
  return t - Math.sqrt(r * r - d2);
}

function rayBox(ox, oz, dx, dz, c) {
  // 2D slab test against a building footprint (infinite height).
  let tmin = 0, tmax = 200;
  const lo = [c.x - c.hw, c.z - c.hd], hi = [c.x + c.hw, c.z + c.hd];
  const o = [ox, oz], d = [dx, dz];
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < lo[i] || o[i] > hi[i]) return Infinity;
    } else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

function addTracer(from, to) {
  const tr = tracers.find((t) => t.t <= 0) || tracers[0];
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  tr.mesh.visible = true;
  tr.mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  tr.mesh.scale.set(1, 1, len);
  tr.mesh.lookAt(to.x, to.y, to.z);
  tr.mesh.material.opacity = 0.9;
  tr.t = 0.07;
}

function fire(cam) {
  const p = G.player;
  Weapon.ammo--;
  Weapon.cooldown = 0.22;
  G.lastShot = G.time;
  gunshot();
  addHeat(5, 'gunfire');
  G.shake = Math.min(0.8, G.shake + 0.12);

  const origin = cam.position;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);

  // Muzzle flash at the gun.
  const gunPos = new THREE.Vector3();
  p.gun.getWorldPosition(gunPos);
  flashLight.position.copy(gunPos);
  flashLight.intensity = 6;
  flashT = 0.05;

  // Find the nearest hit: peds, vehicles, buildings.
  let bestT = 160, hitKind = null, hitObj = null;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, ped.pos.x, ped.pos.y + 1, ped.pos.z, 0.62);
    if (t < bestT) { bestT = t; hitKind = 'ped'; hitObj = ped; }
  }
  for (const v of G.vehicles) {
    if (v.destroyed || v.driver === 'player') continue;
    const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, v.pos.x, v.pos.y + 0.7, v.pos.z, 2.1);
    if (t < bestT) { bestT = t; hitKind = 'car'; hitObj = v; }
  }
  const flat = Math.hypot(dir.x, dir.z) || 1e-6;
  for (const c of City.colliders) {
    const t = rayBox(origin.x, origin.z, dir.x / flat, dir.z / flat, c);
    if (t < bestT) { bestT = t; hitKind = 'wall'; hitObj = c; }
  }

  const hitPoint = {
    x: origin.x + dir.x * bestT,
    y: origin.y + dir.y * bestT,
    z: origin.z + dir.z * bestT,
  };
  addTracer(gunPos, hitPoint);

  if (hitKind === 'ped') {
    const ped = hitObj;
    ped.state = 'down';
    ped.downT = 16;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    spawnImpact(hitPoint.x, hitPoint.y, hitPoint.z, 0.85, 0.2, 0.2);
    addHeat(28, 'shot a civilian');
  } else if (hitKind === 'car') {
    damageVehicle(hitObj, 14);
    spawnSparks(hitPoint.x, hitPoint.y, hitPoint.z, 6);
    if (hitObj.ai === 'police') addHeat(16, 'shot at police');
  } else if (hitKind === 'wall') {
    spawnImpact(hitPoint.x, Math.max(0.3, hitPoint.y), hitPoint.z, 0.8, 0.75, 0.6);
  }

  if (Weapon.ammo <= 0) startReload();
}

function startReload() {
  if (Weapon.reloading > 0 || Weapon.ammo === Weapon.mag) return;
  Weapon.reloading = 1.15;
}

export function updateWeapons(dt, cam) {
  Weapon.cooldown -= dt;
  flashT -= dt;
  if (flashT <= 0) flashLight.intensity = 0;
  for (const tr of tracers) {
    if (tr.t <= 0) continue;
    tr.t -= dt;
    tr.mesh.material.opacity = Math.max(0, tr.t / 0.07) * 0.9;
    if (tr.t <= 0) tr.mesh.visible = false;
  }
  if (Weapon.reloading > 0) {
    Weapon.reloading -= dt;
    if (Weapon.reloading <= 0) Weapon.ammo = Weapon.mag;
  }
  const p = G.player;
  if (p.inCar || G.mode !== 'play') return;
  if (hit('KeyR')) startReload();
  if (Input.left && Weapon.cooldown <= 0 && Weapon.reloading <= 0) {
    if (Weapon.ammo > 0) fire(cam);
    else startReload();
  }
}
// build marker: weapons.js