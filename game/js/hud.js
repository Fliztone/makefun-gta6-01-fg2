// hud.js — DOM heads-up display: cash, health, wanted stars, mission
// objective, speedometer, ammo, contextual prompts, toasts and banners.

import { G, dist2D } from './state.js';
import { nearestVehicle } from './vehicles.js';
import { Weapon } from './weapons.js';
import { currentObjective } from './missions.js';

const el = {};

export function initHUD() {
  for (const id of ['hud', 'cash', 'healthfill', 'stars', 'objtext', 'objdist', 'speedo', 'speedval',
    'carname', 'ammo', 'ammoval', 'prompt', 'toast', 'banner', 'bannertitle', 'bannersub', 'crosshair', 'lowhp']) {
    el[id] = document.getElementById(id);
  }
  el.starSpans = el.stars.querySelectorAll('span');
}

export function updateHUD(dt) {
  const p = G.player;
  el.cash.textContent = '$' + G.cash.toLocaleString('en-US');
  el.healthfill.style.width = Math.max(0, G.health) + '%';
  el.healthfill.classList.toggle('low', G.health < 30);
  el.lowhp.style.opacity = G.health < 30 ? 0.35 + Math.sin(G.time * 5) * 0.12 : 0;

  for (let i = 0; i < 5; i++) {
    el.starSpans[i].classList.toggle('on', i < G.stars);
    el.starSpans[i].classList.toggle('flash', i < G.stars && G.crimeFlash > 0);
  }

  const obj = currentObjective();
  el.objtext.textContent = obj.text;
  if (obj.target) {
    const d = Math.round(dist2D(p.pos, obj.target));
    el.objdist.textContent = d + ' m';
    el.objdist.style.display = '';
  } else {
    el.objdist.style.display = 'none';
  }

  if (p.inCar) {
    el.speedo.style.display = '';
    el.ammo.style.display = 'none';
    el.speedval.textContent = Math.round(Math.abs(p.inCar.speed) * 3.6);
    el.carname.textContent = p.inCar.name.toUpperCase();
    el.prompt.textContent = 'E exit · SPACE handbrake';
    el.crosshair.style.display = 'none';
  } else {
    el.speedo.style.display = 'none';
    el.ammo.style.display = '';
    el.ammoval.textContent = Weapon.reloading > 0 ? '…' : Weapon.ammo + ' / ' + Weapon.mag;
    const near = nearestVehicle(p.pos, 4.2);
    el.prompt.textContent = near ? `E — ${near.ai ? 'carjack' : 'enter'} ${near.name}` : 'LMB shoot · RMB aim · R reload';
    el.crosshair.style.display = p.aimT > 0.5 ? '' : 'none';
    el.crosshair.classList.toggle('aiming', p.aimT > 0.5);
  }

  if (G.toast) {
    G.toast.t -= dt;
    el.toast.textContent = G.toast.text;
    el.toast.style.opacity = Math.min(1, G.toast.t * 2);
    if (G.toast.t <= 0) G.toast = null;
  } else {
    el.toast.style.opacity = 0;
  }
  if (G.banner) {
    G.banner.t -= dt;
    el.bannertitle.textContent = G.banner.text;
    el.bannersub.textContent = G.banner.sub;
    el.banner.style.opacity = Math.min(1, G.banner.t * 1.6);
    if (G.banner.t <= 0) G.banner = null;
  } else {
    el.banner.style.opacity = 0;
  }
}

export function setHUDVisible(visible) {
  el.hud.style.display = visible ? '' : 'none';
}
// build marker: hud.js