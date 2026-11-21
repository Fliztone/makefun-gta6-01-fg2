// camera.js — smooth third-person camera: mouse orbit on foot, over-shoulder
// aim pose, speed-widening chase view while driving, wall avoidance and shake.

import { G, clamp, lerp, angleDelta } from './state.js';
import { Input } from './input.js';
import { World } from './world.js';
import { City } from './city.js';

export const Cam = {
  yaw: Math.PI,
  pitch: 0.28,
  recoil: 0,
  lastMouseT: -99,
  fov: 62,
};

function blockedDistance(target, dx, dz, want) {
  // Shorten the camera boom if it would pass through a building.
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const t = (want * i) / steps;
    const x = target.x + dx * t, z = target.z + dz * t;
    for (const c of City.colliders) {
      if (x > c.x - c.hw - 0.3 && x < c.x + c.hw + 0.3 && z > c.z - c.hd - 0.3 && z < c.z + c.hd + 0.3) {
        return Math.max(1.2, t - 0.5);
      }
    }
  }
  return want;
}

export function updateCamera(dt) {
  const p = G.player;
  const cam = World.camera;

  if (Input.mouseDX !== 0 || Input.mouseDY !== 0) Cam.lastMouseT = G.time;
  Cam.yaw -= Input.mouseDX * Input.sensitivity;
  Cam.pitch = clamp(Cam.pitch + Input.mouseDY * Input.sensitivity, -0.12, 1.15);

  const aiming = p.aimT > 0.5 && !p.inCar;
  let dist, height, targetY;
  if (p.inCar) {
    // Chase cam: auto-centre behind the car after a moment without mouse input.
    if (G.time - Cam.lastMouseT > 1.8) {
      Cam.yaw += angleDelta(Cam.yaw, p.heading) * Math.min(1, dt * 2.6);
    }
    const speedRatio = clamp(Math.abs(p.inCar.speed) / 40, 0, 1);
    dist = 8.2 + speedRatio * 1.6;
    height = 3.1;
    targetY = 1.2;
    Cam.fov = lerp(Cam.fov, 62 + speedRatio * 9, Math.min(1, dt * 4));
  } else if (aiming) {
    dist = 2.4;
    height = 0.35;
    targetY = 1.55;
    Cam.fov = lerp(Cam.fov, 46, Math.min(1, dt * 10));
  } else {
    dist = 5.6;
    height = 1.1;
    targetY = 1.45;
    Cam.fov = lerp(Cam.fov, 62, Math.min(1, dt * 6));
  }

  const fx = Math.sin(Cam.yaw), fz = Math.cos(Cam.yaw);
  const target = { x: p.pos.x, y: p.pos.y + targetY, z: p.pos.z };
  const boom = blockedDistance(target, -fx, -fz, dist);
  const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  let cx = target.x - fx * boom * cp;
  let cz = target.z - fz * boom * cp;
  let cy = target.y + boom * sp + height * 0.4;
  if (aiming) { cx += Math.cos(Cam.yaw) * 0.65; cz -= Math.sin(Cam.yaw) * 0.65; }
  cy = Math.max(0.5, cy);

  const k = Math.min(1, dt * (aiming ? 18 : 9));
  cam.position.x = lerp(cam.position.x, cx, k);
  cam.position.y = lerp(cam.position.y, cy, k);
  cam.position.z = lerp(cam.position.z, cz, k);

  // Shake.
  if (G.shake > 0.01) {
    cam.position.x += (Math.random() - 0.5) * G.shake * 0.35;
    cam.position.y += (Math.random() - 0.5) * G.shake * 0.3;
    cam.position.z += (Math.random() - 0.5) * G.shake * 0.35;
    G.shake = Math.max(0, G.shake - dt * 2.2);
  }

  cam.lookAt(target.x, target.y + 0.25, target.z);
  if (Math.abs(cam.fov - Cam.fov) > 0.05) {
    cam.fov = Cam.fov;
    cam.updateProjectionMatrix();
  }
}
// build marker: camera.js