// effects.js — pooled GPU particles (sparks, smoke, impacts) and fading
// skid marks laid down by drifting tires.

import { G } from './state.js';

const MAX_PARTICLES = 600;
const MAX_SKIDS = 160;

let points = null;
let positions = null, colors = null;
const vel = new Float32Array(MAX_PARTICLES * 3);
const life = new Float32Array(MAX_PARTICLES);
const gravity = new Float32Array(MAX_PARTICLES);
let cursor = 0;

const skids = [];
let skidCursor = 0;
let skidGeo = null;

export function initEffects(scene) {
  positions = new Float32Array(MAX_PARTICLES * 3);
  colors = new Float32Array(MAX_PARTICLES * 3);
  for (let i = 0; i < MAX_PARTICLES; i++) positions[i * 3 + 1] = -100;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.42, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, sizeAttenuation: true,
  });
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  skidGeo = new THREE.PlaneGeometry(0.3, 1.3);
  for (let i = 0; i < MAX_SKIDS; i++) {
    const m = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({
      color: 0x16161c, transparent: true, opacity: 0, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.025;
    m.visible = false;
    scene.add(m);
    skids.push({ mesh: m, t: 0 });
  }
}

function emit(x, y, z, vx, vy, vz, r, g, b, ttl, grav) {
  const i = cursor;
  cursor = (cursor + 1) % MAX_PARTICLES;
  positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
  vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
  colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  life[i] = ttl;
  gravity[i] = grav;
}

export function spawnSparks(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    emit(x, y, z,
      (Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7,
      1, 0.75 + Math.random() * 0.25, 0.25, 0.35 + Math.random() * 0.3, 12);
  }
}

export function spawnSmoke(x, y, z) {
  emit(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6,
    (Math.random() - 0.5) * 0.8, 1.4 + Math.random(), (Math.random() - 0.5) * 0.8,
    0.32, 0.3, 0.34, 1.3 + Math.random() * 0.6, -0.4);
}

export function spawnImpact(x, y, z, r, g, b) {
  for (let i = 0; i < 7; i++) {
    emit(x, y, z,
      (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5,
      r, g, b, 0.4 + Math.random() * 0.25, 10);
  }
}

export function spawnSkid(x, z, heading) {
  const s = skids[skidCursor];
  skidCursor = (skidCursor + 1) % MAX_SKIDS;
  s.mesh.visible = true;
  s.mesh.position.set(x, 0.025, z);
  s.mesh.rotation.z = -heading;
  s.mesh.material.opacity = 0.5;
  s.t = 9;
}

export function updateEffects(dt) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (life[i] <= 0) continue;
    life[i] -= dt;
    if (life[i] <= 0) { positions[i * 3 + 1] = -100; continue; }
    vel[i * 3 + 1] -= gravity[i] * dt;
    positions[i * 3] += vel[i * 3] * dt;
    positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
    positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
    if (positions[i * 3 + 1] < 0.03 && gravity[i] > 0) {
      positions[i * 3 + 1] = 0.03;
      vel[i * 3 + 1] *= -0.3;
    }
  }
  points.geometry.attributes.position.needsUpdate = true;
  points.geometry.attributes.color.needsUpdate = true;

  for (const s of skids) {
    if (s.t <= 0) continue;
    s.t -= dt;
    s.mesh.material.opacity = Math.min(0.5, s.t * 0.12);
    if (s.t <= 0) s.mesh.visible = false;
  }
}
// build marker: effects.js