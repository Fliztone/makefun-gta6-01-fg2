// minimap.js — top-down canvas map: the street grid, beach, player arrow,
// traffic, blinking police, mission target and race checkpoints.

import { G, clamp } from './state.js';
import { roads, HALF, ROAD_W, SAND_X, SHORE_X } from './city.js';
import { currentObjective, raceState, raceCheckpoints } from './missions.js';

const SIZE = 176;
const RANGE = 125; // metres from centre to edge
let ctx = null;

export function initMinimap() {
  const canvas = document.getElementById('minimap');
  canvas.width = SIZE;
  canvas.height = SIZE;
  ctx = canvas.getContext('2d');
}

function toMap(wx, wz, px, pz) {
  const s = SIZE / (RANGE * 2);
  return { x: (wx - px) * s + SIZE / 2, y: (wz - pz) * s + SIZE / 2 };
}

export function drawMinimap() {
  if (!ctx) return;
  const p = G.player;
  const px = p.pos.x, pz = p.pos.z;
  const s = SIZE / (RANGE * 2);

  ctx.clearRect(0, 0, SIZE, SIZE);
  // Land base.
  ctx.fillStyle = '#2b2833';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Beach + ocean to the east.
  const sand = toMap(SAND_X, 0, px, pz);
  const shore = toMap(SHORE_X, 0, px, pz);
  ctx.fillStyle = '#8a7a52';
  ctx.fillRect(sand.x, 0, shore.x - sand.x, SIZE);
  ctx.fillStyle = '#1d4a5e';
  ctx.fillRect(shore.x, 0, SIZE - shore.x, SIZE);

  // Street grid.
  ctx.strokeStyle = '#5c5668';
  ctx.lineWidth = Math.max(2, ROAD_W * s);
  const lim = toMap(-HALF, -HALF, px, pz);
  const lim2 = toMap(HALF, HALF, px, pz);
  for (const r of roads) {
    const m = toMap(r, r, px, pz);
    ctx.beginPath();
    ctx.moveTo(m.x, lim.y);
    ctx.lineTo(m.x, lim2.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lim.x, m.y);
    ctx.lineTo(lim2.x, m.y);
    ctx.stroke();
  }

  // Traffic.
  ctx.fillStyle = '#9a94a8';
  for (const v of G.vehicles) {
    if (v.ai !== 'traffic' || v.destroyed) continue;
    const m = toMap(v.pos.x, v.pos.z, px, pz);
    if (m.x < 0 || m.x > SIZE || m.y < 0 || m.y > SIZE) continue;
    ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
  }

  // Race checkpoints.
  const race = raceState();
  if (race) {
    ctx.fillStyle = '#4de3ff';
    const cps = raceCheckpoints();
    for (let i = race.cp; i < cps.length; i++) {
      const m = toMap(cps[i].x, cps[i].z, px, pz);
      ctx.beginPath();
      ctx.arc(clamp(m.x, 4, SIZE - 4), clamp(m.y, 4, SIZE - 4), 2.5, 0, 7);
      ctx.fill();
    }
  }

  // Police: blinking red/blue.
  const blink = Math.floor(G.time * 4) % 2 === 0;
  for (const v of G.vehicles) {
    if (v.ai !== 'police' || v.destroyed) continue;
    const m = toMap(v.pos.x, v.pos.z, px, pz);
    if (m.x < 0 || m.x > SIZE || m.y < 0 || m.y > SIZE) continue;
    ctx.fillStyle = blink ? '#ff4040' : '#4080ff';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3.4, 0, 7);
    ctx.fill();
  }

  // Mission target (clamped to the rim when far away).
  const obj = currentObjective();
  if (obj.target) {
    const m = toMap(obj.target.x, obj.target.z, px, pz);
    const cx = clamp(m.x, 8, SIZE - 8);
    const cy = clamp(m.y, 8, SIZE - 8);
    ctx.fillStyle = '#ffd76e';
    ctx.strokeStyle = '#2b2833';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5 + Math.sin(G.time * 4) * 1, 0, 7);
    ctx.fill();
    ctx.stroke();
  }

  // Player arrow.
  const c = toMap(px, pz, px, pz);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(Math.PI - p.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2b2833';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Frame.
  ctx.strokeStyle = 'rgba(255,215,110,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
}
// build marker: minimap.js