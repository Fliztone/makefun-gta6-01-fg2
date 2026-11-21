// police.js — Solara Bay PD cruisers: spawn by wanted level, hunt the player
// with pursuit steering, ram cars, shoot at high stars, and arrest on contact.

import { G, clamp, dist2D, angleDelta, showToast, damagePlayer } from './state.js';
import { randomRoadPoint } from './city.js';
import { makeVehicle, drivePhysics } from './vehicles.js';
import { clearHeat } from './wanted.js';
import { setSiren } from './audio.js';
import { spawnSparks } from './effects.js';

let spawnCooldown = 0;
let arrestTimer = 0;
let shootTimer = 0;

export function policeCount() {
  let n = 0;
  for (const v of G.vehicles) if (v.ai === 'police' && !v.destroyed) n++;
  return n;
}

function spawnCruiser() {
  const spot = randomRoadPoint(G.player.pos, 110);
  const v = makeVehicle('patrol', spot.x, spot.z, spot.heading, { ai: 'police', targetSpeed: 33 });
  v.stuckT = 0;
  v.reverseT = 0;
  return v;
}

export function updatePolice(dt) {
  const p = G.player;
  const target = G.stars === 0 ? 0 : Math.min(8, G.stars * 2);
  spawnCooldown -= dt;

  // Maintain the fleet.
  const cruisers = G.vehicles.filter((v) => v.ai === 'police');
  const active = cruisers.filter((v) => !v.destroyed);
  if (active.length < target && spawnCooldown <= 0) {
    spawnCruiser();
    spawnCooldown = 1.6;
  }
  for (const v of cruisers) {
    if (v.destroyed || (G.stars === 0 && dist2D(v.pos, p.pos) > 40) || dist2D(v.pos, p.pos) > 460) {
      v.mesh.visible = false;
      v.ai = 'gone';
      v.destroyed = true;
    } else if (active.length > target && dist2D(v.pos, p.pos) > 140) {
      v.mesh.visible = false;
      v.ai = 'gone';
      v.destroyed = true;
      active.pop();
    }
  }
  // Prune gone hulks so the list never grows without bound.
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i];
    if (v.ai === 'gone' && dist2D(v.pos, p.pos) > 200) {
      World_remove(v.mesh);
      G.vehicles.splice(i, 1);
    }
  }

  let nearest = Infinity;
  let sirenLevel = 0;
  for (const v of G.vehicles) {
    if (v.ai !== 'police' || v.destroyed) continue;
    const d = dist2D(v.pos, p.pos);
    if (d < nearest) nearest = d;
    sirenLevel = Math.max(sirenLevel, clamp(1 - d / 160, 0, 1));

    // Flash the lightbar.
    if (v.lightbar) {
      const phase = Math.floor(G.time * 5) % 2 === 0;
      v.lightbar.red.visible = phase;
      v.lightbar.blue.visible = !phase;
    }

    // Pursuit steering with predictive aim (drive off when heat is cleared).
    const aimX = G.stars === 0 ? v.pos.x + (v.pos.x - p.pos.x) : p.pos.x + (p.inCar ? Math.sin(p.heading) * p.inCar.speed * 0.4 : 0);
    const aimZ = G.stars === 0 ? v.pos.z + (v.pos.z - p.pos.z) : p.pos.z + (p.inCar ? Math.cos(p.heading) * p.inCar.speed * 0.4 : 0);
    const want = Math.atan2(aimX - v.pos.x, aimZ - v.pos.z);
    const steer = clamp(angleDelta(v.heading, want) * 2.4, -1, 1);
    let throttle = d > 10 ? 1 : 0.25;

    // Unstick from walls: reverse briefly when pinned.
    if (Math.abs(v.speed) < 1.2 && throttle > 0.5) v.stuckT += dt; else v.stuckT = 0;
    if (v.stuckT > 1.4) { v.reverseT = 0.9; v.stuckT = 0; }
    if (v.reverseT > 0) {
      v.reverseT -= dt;
      throttle = -1;
    }
    drivePhysics(v, dt, { throttle, steer, handbrake: false });

    // Officers open fire on a wanted foot suspect at 3+ stars.
    if (G.stars >= 3 && !p.inCar && d < 34) {
      shootTimer -= dt;
      if (shootTimer <= 0) {
        shootTimer = 1.1;
        damagePlayer(3 + G.stars);
        spawnSparks(p.pos.x + (Math.random() - 0.5), 1.1, p.pos.z + (Math.random() - 0.5), 3);
      }
    }
  }
  setSiren(G.stars > 0 ? sirenLevel : 0);

  // Arrest: cornered and nearly still.
  const slow = p.inCar ? Math.abs(p.inCar.speed) < 2.5 : p.speedNow < 2.5;
  if (nearest < 4.2 && slow && G.stars > 0) {
    arrestTimer += dt;
    if (arrestTimer > 1.5) {
      arrestTimer = 0;
      G.mode = 'busted';
      clearHeat();
    }
  } else {
    arrestTimer = Math.max(0, arrestTimer - dt * 2);
  }
  return nearest;
}

let _scene = null;
export function bindPolice(scene) { _scene = scene; }
function World_remove(mesh) { if (_scene) _scene.remove(mesh); }

export function resetPolice() {
  arrestTimer = 0;
  shootTimer = 0;
  for (const v of G.vehicles) {
    if (v.ai === 'police') { v.mesh.visible = false; v.ai = 'gone'; v.destroyed = true; }
  }
}
// build marker: police.js