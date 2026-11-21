// traffic.js — AI traffic: cars cruise the grid in right-hand lanes, brake
// for obstacles ahead and sometimes turn at intersections.

import { G, clamp, dist2D } from './state.js';
import { roads, HALF, randomRoadPoint, laneOffset, headingFor } from './city.js';
import { makeVehicle, drivePhysics } from './vehicles.js';

const TRAFFIC_COUNT = 16;
const CRUISE = () => 8.5 + Math.random() * 5.5;
const KIND_POOL = ['brisa', 'marlin', 'marlin', 'dorado', 'brisa', 'furgon', 'sunray'];

export function initTraffic() {
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const spot = randomRoadPoint(G.player ? G.player.pos : null, 30);
    const kind = KIND_POOL[Math.floor(Math.random() * KIND_POOL.length)];
    const v = makeVehicle(kind, spot.x, spot.z, spot.heading, {
      ai: 'traffic', axis: spot.axis, dir: spot.dir, road: spot.road,
      targetSpeed: CRUISE(),
    });
    v.speed = v.targetSpeed * 0.6;
    v.turnCooldown = 2 + Math.random() * 4;
  }
}

function aheadBlocked(v) {
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  for (const o of G.vehicles) {
    if (o === v || o.destroyed) continue;
    const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 13) continue;
    const fwd = dx * fx + dz * fz;
    const lat = Math.abs(dx * fz - dz * fx);
    if (fwd > 0 && lat < 2.6) return true;
  }
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.pos.x - v.pos.x, dz = ped.pos.z - v.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 9) continue;
    if (dx * fx + dz * fz > 0) return true;
  }
  return false;
}

function tryTurn(v, dt) {
  v.turnCooldown -= dt;
  if (v.turnCooldown > 0) return;
  // Are we crossing an intersection on the cross axis?
  const t = v.axis === 'z' ? v.pos.z : v.pos.x;
  for (const r of roads) {
    if (Math.abs(t - r) < 1.2) {
      v.turnCooldown = 3 + Math.random() * 5;
      if (Math.random() < 0.4) {
        const newAxis = v.axis === 'z' ? 'x' : 'z';
        const newDir = Math.random() < 0.5 ? 1 : -1;
        const oldRoad = v.road;
        v.axis = newAxis;
        v.dir = newDir;
        v.road = r;
        v.heading = headingFor(newAxis, newDir);
        const off = laneOffset(newAxis, newDir);
        if (newAxis === 'x') { v.pos.z = r + off; v.pos.x = oldRoad; }
        else { v.pos.x = r + off; v.pos.z = oldRoad; }
      }
      return;
    }
  }
}

// Stage extra traffic along the player's street (used for play-test shots).
export function streetTraffic(x, z, heading) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const lx = Math.cos(heading), lz = -Math.sin(heading);
  const axis = Math.abs(fx) > Math.abs(fz) ? 'x' : 'z';
  const kinds = ['marlin', 'brisa', 'dorado', 'furgon'];
  for (let i = 0; i < 4; i++) {
    const d = 26 + i * 17;
    const side = i % 2 ? 1 : -1;
    const sx = x + fx * d + lx * 4 * side;
    const sz = z + fz * d + lz * 4 * side;
    const dir = side > 0 ? (axis === 'z' ? (fz > 0 ? 1 : -1) : (fx > 0 ? 1 : -1))
      : (axis === 'z' ? (fz > 0 ? -1 : 1) : (fx > 0 ? -1 : 1));
    const off = laneOffset(axis, dir);
    const lat = axis === 'z' ? sx : sz;
    let road = roads[0];
    for (const r of roads) if (Math.abs(r - (lat - off)) < Math.abs(road - (lat - off))) road = r;
    const h = headingFor(axis, dir);
    const v = makeVehicle(kinds[i % kinds.length], axis === 'z' ? road + off : sx, axis === 'z' ? sz : road + off, h, {
      ai: 'traffic', axis, dir, road, targetSpeed: 9 + Math.random() * 4,
    });
    v.speed = v.targetSpeed;
    v.turnCooldown = 4;
  }
}

export function updateTraffic(dt) {
  for (const v of G.vehicles) {
    if (v.ai !== 'traffic' || v.destroyed) continue;

    // Respawn if far off the map edge.
    const t = v.axis === 'z' ? v.pos.z : v.pos.x;
    if (Math.abs(t) > HALF + 12 || dist2D(v.pos, G.player.pos) > 520) {
      const spot = randomRoadPoint(G.player.pos, 90);
      v.pos.set(spot.x, 0, spot.z);
      v.heading = spot.heading;
      v.axis = spot.axis; v.dir = spot.dir; v.road = spot.road;
      v.speed = v.targetSpeed * 0.5;
      continue;
    }

    tryTurn(v, dt);

    // Lane keeping.
    const laneCenter = v.road + laneOffset(v.axis, v.dir);
    const e = v.axis === 'z' ? laneCenter - v.pos.x : laneCenter - v.pos.z;
    const steer = clamp((v.axis === 'z' ? e * Math.cos(v.heading) : -e * Math.sin(v.heading)) * 0.3, -1, 1);

    const blocked = aheadBlocked(v);
    const target = blocked ? 0 : v.targetSpeed;
    let throttle = 0;
    if (v.speed < target - 0.5) throttle = 1;
    else if (v.speed > target + 1.5) throttle = -0.6;
    drivePhysics(v, dt, { throttle, steer, handbrake: false });
  }
}
// build marker: traffic.js