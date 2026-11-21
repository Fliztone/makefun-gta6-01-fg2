// pedestrians.js — locals strolling the sidewalk loops of Solara Bay.
// They flee gunfire and speeding cars, and can be knocked down (a crime).

import { G, clamp, dist2D } from './state.js';
import { GRID, pedLoop, collideCircle } from './city.js';
import { addHeat } from './wanted.js';
import { spawnImpact } from './effects.js';

const PED_COUNT = 30;
const SHIRTS = [0x4de3ff, 0xffd76e, 0xff5f9e, 0xa5ff6e, 0xf2f2f2, 0xe86a3a, 0x9a8ad9, 0x60c0a0];
const SKINS = [0xc98d5f, 0x8a5a3a, 0xe8b48a, 0x6a4530];

function buildPedMesh(shirtColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x40485c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.26), shirt);
  torso.position.y = 1.02;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.29, 0.27), skin);
  head.position.y = 1.5;
  head.castShadow = true;
  g.add(torso, head);
  const legGeo = new THREE.BoxGeometry(0.15, 0.72, 0.15);
  const lLeg = new THREE.Mesh(legGeo, pants);
  lLeg.position.set(-0.12, 0.37, 0);
  const rLeg = new THREE.Mesh(legGeo, pants);
  rLeg.position.set(0.12, 0.37, 0);
  g.add(lLeg, rLeg);
  return { group: g, lLeg, rLeg };
}

function loopPoint(loop, t) {
  const h = loop.half;
  const per = h * 8;
  let d = ((t % per) + per) % per;
  if (d < 2 * h) return { x: loop.cx - h + d, z: loop.cz - h };
  d -= 2 * h;
  if (d < 2 * h) return { x: loop.cx + h, z: loop.cz - h + d };
  d -= 2 * h;
  if (d < 2 * h) return { x: loop.cx + h - d, z: loop.cz + h };
  d -= 2 * h;
  return { x: loop.cx - h, z: loop.cz + h - d };
}

function makePed(scene, i, j, t) {
  const { group, lLeg, rLeg } = buildPedMesh(
    SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
    SKINS[Math.floor(Math.random() * SKINS.length)]
  );
  scene.add(group);
  const loop = pedLoop(i, j);
  const p = loopPoint(loop, t);
  group.position.set(p.x, 0, p.z);
  return {
    mesh: group, pos: group.position, lLeg, rLeg,
    loop, t, speed: 1 + Math.random() * 1.1, dir: Math.random() < 0.5 ? 1 : -1,
    state: 'walk', fleeT: 0, downT: 0, phase: Math.random() * 6,
    fleeX: 0, fleeZ: 0,
  };
}

let _scene = null;

export function initPedestrians(scene) {
  _scene = scene;
  for (let k = 0; k < PED_COUNT; k++) {
    const i = Math.floor(Math.random() * GRID);
    const j = Math.floor(Math.random() * GRID);
    G.peds.push(makePed(scene, i, j, Math.random() * 400));
  }
  // A carjacked driver runs for it (called from vehicles.js).
  window.__spawnFleeingPed = (x, z) => {
    if (G.peds.length > 42) return;
    const ped = makePed(scene, 0, 0, 0);
    ped.pos.set(x, 0, z);
    ped.state = 'flee';
    ped.fleeT = 4;
    ped.fleeX = x + (Math.random() - 0.5) * 20;
    ped.fleeZ = z + (Math.random() - 0.5) * 20;
    G.peds.push(ped);
  };
}

// Extra locals on the blocks around a point (play-test staging).
export function spawnCrowd(n, x, z) {
  if (!_scene) return;
  const bi = clamp(Math.round((x + 304 - 38) / 76), 0, GRID - 1);
  const bj = clamp(Math.round((z + 304 - 38) / 76), 0, GRID - 1);
  for (let k = 0; k < n; k++) {
    const i = clamp(bi + (Math.floor(Math.random() * 3) - 1), 0, GRID - 1);
    const j = clamp(bj + (Math.floor(Math.random() * 3) - 1), 0, GRID - 1);
    G.peds.push(makePed(_scene, i, j, Math.random() * 400));
  }
}

function startFlee(ped, fromX, fromZ) {
  ped.state = 'flee';
  ped.fleeT = 2.2 + Math.random() * 1.5;
  const dx = ped.pos.x - fromX, dz = ped.pos.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  ped.fleeX = ped.pos.x + (dx / d) * 18;
  ped.fleeZ = ped.pos.z + (dz / d) * 18;
}

export function updatePedestrians(dt) {
  const player = G.player;
  const gunshotRecent = G.time - (G.lastShot || -99) < 1.4;

  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        // Respawn elsewhere on a fresh loop.
        ped.loop = pedLoop(Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID));
        ped.t = Math.random() * 400;
        ped.state = 'walk';
        ped.mesh.rotation.set(0, 0, 0);
        ped.mesh.position.y = 0;
      }
      continue;
    }

    // Threats: gunfire nearby, or a car bearing down.
    if (ped.state === 'walk') {
      if (gunshotRecent && dist2D(ped.pos, player.pos) < 32) startFlee(ped, player.pos.x, player.pos.z);
      for (const v of G.vehicles) {
        if (Math.abs(v.speed) < 7 || v.destroyed) continue;
        const d = dist2D(ped.pos, v.pos);
        if (d < 8) { startFlee(ped, v.pos.x, v.pos.z); break; }
      }
    }

    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const dx = ped.fleeX - ped.pos.x, dz = ped.fleeZ - ped.pos.z;
      const d = Math.hypot(dx, dz);
      if (ped.fleeT <= 0 || d < 1.5) {
        ped.state = 'walk';
        // Rejoin the nearest sidewalk loop.
        const bi = clamp(Math.round((ped.pos.x + 304 - 38) / 76), 0, GRID - 1);
        const bj = clamp(Math.round((ped.pos.z + 304 - 38) / 76), 0, GRID - 1);
        ped.loop = pedLoop(bi, bj);
        ped.t = Math.random() * 400;
      } else {
        ped.pos.x += (dx / d) * 5.2 * dt;
        ped.pos.z += (dz / d) * 5.2 * dt;
        ped.mesh.rotation.y = Math.atan2(dx, dz);
        collideCircle(ped.pos, 0.4);
      }
    } else {
      ped.t += ped.speed * ped.dir * dt;
      const p = loopPoint(ped.loop, ped.t);
      const dx = p.x - ped.pos.x, dz = p.z - ped.pos.z;
      ped.pos.x = p.x;
      ped.pos.z = p.z;
      if (Math.hypot(dx, dz) > 0.001) ped.mesh.rotation.y = Math.atan2(dx, dz);
    }

    // Walk animation.
    const moving = ped.state === 'flee' ? 5.2 : ped.speed;
    ped.phase += moving * dt * 2.6;
    const swing = Math.sin(ped.phase) * 0.55;
    ped.lLeg.rotation.x = swing;
    ped.rLeg.rotation.x = -swing;

    // Run-over check against every moving car.
    for (const v of G.vehicles) {
      if (Math.abs(v.speed) < 5 || v.destroyed) continue;
      if (dist2D(ped.pos, v.pos) < 1.9) {
        ped.state = 'down';
        ped.downT = 14;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.25;
        spawnImpact(ped.pos.x, 0.8, ped.pos.z, 0.85, 0.2, 0.2);
        if (v.driver === 'player') {
          addHeat(Math.abs(v.speed) > 15 ? 40 : 26, 'hit pedestrian');
          G.shake = Math.min(1.2, G.shake + 0.3);
        }
        v.speed *= 0.7;
        break;
      }
    }
  }
}
// build marker: pedestrians.js