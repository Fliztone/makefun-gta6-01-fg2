// player.js — Dante Cruz on foot: third-person WASD movement relative to the
// camera, sprint, jump, walk animation, and the aim pose used by weapons.js.

import { G, clamp, lerp } from './state.js';
import { Input } from './input.js';
import { collideCircle } from './city.js';
import { tryEnterExit, updatePlayerVehicle } from './vehicles.js';

const WALK = 5.2, SPRINT = 8.6;

function buildCharacter() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5f });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe86a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3a4256 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x241a14 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.08;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
  head.position.y = 1.6;
  head.castShadow = true;
  g.add(head);
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), hair);
  hairMesh.position.y = 1.78;
  g.add(hairMesh);

  const limb = (mat, w, len) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    mesh.position.y = -len / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };
  const lArm = limb(shirt, 0.14, 0.6); lArm.position.set(-0.34, 1.34, 0);
  const rArm = limb(shirt, 0.14, 0.6); rArm.position.set(0.34, 1.34, 0);
  const lLeg = limb(pants, 0.17, 0.76); lLeg.position.set(-0.14, 0.78, 0);
  const rLeg = limb(pants, 0.17, 0.76); rLeg.position.set(0.14, 0.78, 0);
  g.add(lArm, rArm, lLeg, rLeg);

  // Pistol in the right hand.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
  gun.position.set(0, -0.62, 0.12);
  rArm.add(gun);

  return { group: g, lArm, rArm, lLeg, rLeg, gun };
}

export function initPlayer(scene, startPos) {
  const { group, lArm, rArm, lLeg, rLeg, gun } = buildCharacter();
  group.position.set(startPos.x, 0, startPos.z);
  scene.add(group);
  G.player = {
    pos: group.position,
    heading: Math.PI,
    vel: { x: 0, z: 0 },
    vy: 0,
    onGround: true,
    mesh: group,
    parts: { lArm, rArm, lLeg, rLeg },
    gun,
    walkPhase: 0,
    inCar: null,
    aimT: 0,
    speedNow: 0,
  };
  return G.player;
}

export function updatePlayer(dt, camYaw) {
  const p = G.player;
  tryEnterExit();
  if (p.inCar) {
    updatePlayerVehicle(dt);
    p.aimT = 0;
    return;
  }

  // Camera-relative wish direction.
  let mx = 0, mz = 0;
  if (Input.keys['KeyW'] || Input.keys['ArrowUp']) mz -= 1;
  if (Input.keys['KeyS'] || Input.keys['ArrowDown']) mz += 1;
  if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) mx -= 1;
  if (Input.keys['KeyD'] || Input.keys['ArrowRight']) mx += 1;
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const lx = Math.cos(camYaw), lz = -Math.sin(camYaw);
  let wx = fx * -mz + lx * -mx;
  let wz = fz * -mz + lz * -mx;
  const len = Math.hypot(wx, wz);
  const sprint = Input.keys['ShiftLeft'] || Input.keys['ShiftRight'];
  const target = p.aimT > 0.5 ? WALK * 0.55 : sprint ? SPRINT : WALK;
  if (len > 0) { wx /= len; wz /= len; }
  p.vel.x = lerp(p.vel.x, wx * target, Math.min(1, dt * 10));
  p.vel.z = lerp(p.vel.z, wz * target, Math.min(1, dt * 10));

  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;
  collideCircle(p.pos, 0.45);

  // Jump / gravity.
  if (Input.keys['Space'] && p.onGround) { p.vy = 5.4; p.onGround = false; }
  p.vy -= 14 * dt;
  p.pos.y += p.vy * dt;
  if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }

  const speed = Math.hypot(p.vel.x, p.vel.z);
  p.speedNow = speed;
  G.stats.distance += speed * dt;
  if (speed > 0.4) {
    const want = Math.atan2(p.vel.x, p.vel.z);
    let d = want - p.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    p.heading += d * Math.min(1, dt * 12);
  }
  p.mesh.rotation.y = p.heading;

  // Walk / aim animation.
  p.walkPhase += speed * dt * 2.4;
  const swing = Math.sin(p.walkPhase) * clamp(speed / WALK, 0, 1) * 0.7;
  const { lArm, rArm, lLeg, rLeg } = p.parts;
  lLeg.rotation.x = swing;
  rLeg.rotation.x = -swing;
  lArm.rotation.x = -swing * 0.8;
  p.aimT = lerp(p.aimT, Input.right ? 1 : 0, Math.min(1, dt * 9));
  if (p.aimT > 0.05) {
    rArm.rotation.x = -Math.PI / 2 * p.aimT - swing * 0.2 * (1 - p.aimT);
    rArm.rotation.y = -0.15 * p.aimT;
  } else {
    rArm.rotation.x = swing * 0.8;
    rArm.rotation.y = 0;
  }
}

export function playerFocus() {
  return G.player.pos;
}
// build marker: player.js