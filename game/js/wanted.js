// wanted.js — the wanted level: crimes add heat, stars follow heat, and
// staying out of police sight lets the heat cool back down.

import { G, clamp, showToast } from './state.js';
import { dist2D } from './state.js';

export const HEAT_PER_STAR = 30;
export const MAX_HEAT = 150;

export function addHeat(amount, reason) {
  if (G.mode !== 'play') return;
  const before = G.stars;
  G.heat = clamp(G.heat + amount, 0, MAX_HEAT);
  G.lastCrime = G.time;
  G.stats.crimes++;
  G.crimeFlash = 1;
  G.stars = Math.min(5, Math.floor(G.heat / HEAT_PER_STAR));
  if (G.stars > before) showToast(`Wanted level ${G.stars} ★ — police responding`);
}

export function clearHeat() {
  G.heat = 0;
  G.stars = 0;
}

// policeVisible: computed by police.js (any cruiser close and hunting).
export function updateWanted(dt, nearestPoliceDist) {
  if (G.heat <= 0) return;
  const unseen = nearestPoliceDist > 70;
  if (G.time - G.lastCrime > 8 && unseen) {
    G.heat = Math.max(0, G.heat - 8 * dt);
    const stars = Math.min(5, Math.floor(G.heat / HEAT_PER_STAR));
    if (stars < G.stars) {
      G.stars = stars;
      if (stars === 0) showToast('You lost the cops. Heat cleared.');
    }
  }
  G.crimeFlash = Math.max(0, G.crimeFlash - dt);
}

export function policePressure() {
  let nearest = Infinity;
  for (const v of G.vehicles) {
    if (v.ai !== 'police' || v.destroyed) continue;
    const d = dist2D(G.player.pos, v.pos);
    if (d < nearest) nearest = d;
  }
  return nearest;
}
// build marker: wanted.js