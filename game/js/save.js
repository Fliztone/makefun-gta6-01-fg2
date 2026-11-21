// save.js — localStorage persistence: cash, health, story progress, position.
// The game autosaves on mission completion and from the pause menu.

import { G } from './state.js';

const KEY = 'solara-bay-save-v1';

export function saveGame() {
  try {
    const p = G.player;
    const data = {
      cash: G.cash,
      health: G.health,
      missionIndex: G.missionIndex,
      stats: G.stats,
      pos: p ? { x: p.pos.x, z: p.pos.z, heading: p.heading } : null,
      at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function applySave(data) {
  G.cash = data.cash;
  G.health = Math.max(40, data.health || 100);
  G.missionIndex = data.missionIndex || 0;
  G.stats = Object.assign(G.stats, data.stats || {});
  return data.pos;
}
// build marker: save.js