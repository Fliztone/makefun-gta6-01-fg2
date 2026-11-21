// main.js — boot and game loop for SOLARA BAY: wires every system together,
// runs the menu / play / pause / dead / busted state machine, autosaves, and
// exposes a small debug hook (window.SOLARA) used for play-testing.

import { G, clamp, addCash, showToast } from './state.js';
import { initInput, Input, hit, requestLock, releaseLock, endFrame } from './input.js';
import { initWorld, updateWorld, World } from './world.js';
import { buildCity, City, SHORE_X, SAND_X } from './city.js';
import { initPlayer, updatePlayer } from './player.js';
import { bindVehicles, makeVehicle, enterVehicle, vehicleCollisions, nearestVehicle } from './vehicles.js';
import { initTraffic, updateTraffic, streetTraffic } from './traffic.js';
import { initPedestrians, updatePedestrians, spawnCrowd } from './pedestrians.js';
import { bindPolice, updatePolice, resetPolice } from './police.js';
import { updateWanted, clearHeat } from './wanted.js';
import { initWeapons, updateWeapons } from './weapons.js';
import { initEffects, updateEffects, spawnSkid } from './effects.js';
import { updateCamera, Cam } from './camera.js';
import { initMissions, beginMission, updateMissions, currentObjective, MISSIONS } from './missions.js';
import { initHUD, updateHUD, setHUDVisible } from './hud.js';
import { initMinimap, drawMinimap } from './minimap.js';
import { initAudio, setEngine, setOcean, setMuted } from './audio.js';
import { saveGame, hasSave, loadGame, applySave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const overlays = {
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause'),
  dead: document.getElementById('dead'),
  busted: document.getElementById('busted'),
};

let lastSkid = { x: 0, z: 0 };
let autosaveT = 0;
let wasLocked = false;
let menuAngle = 0;

function showOverlay(name) {
  for (const k of Object.keys(overlays)) overlays[k].classList.toggle('hidden', k !== name);
}

function boot() {
  initWorld(canvas);
  const scene = World.scene;
  buildCity(scene);
  bindVehicles(scene);
  bindPolice(scene);
  initPlayer(scene, City.landmarks.start);
  initPedestrians(scene);
  initTraffic();
  initEffects(scene);
  initWeapons(scene);
  initMissions(scene);
  initHUD();
  initMinimap();
  initInput(canvas);

  document.getElementById('btn-play').addEventListener('click', () => startGame(false));
  const cont = document.getElementById('btn-continue');
  if (hasSave()) cont.style.display = '';
  cont.addEventListener('click', () => startGame(true));
  document.getElementById('btn-resume').addEventListener('click', resume);
  document.getElementById('btn-save').addEventListener('click', () => {
    if (saveGame()) showToast('Game saved');
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    clearSave();
    location.reload();
  });
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-dead-respawn').addEventListener('click', () => respawn(0.9, 70));
  document.getElementById('btn-busted-respawn').addEventListener('click', () => respawn(0.85, 60));

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (wasLocked && !locked && G.mode === 'play') pause();
    wasLocked = locked;
  });

  showOverlay('menu');
  requestAnimationFrame(loop);
}

function startGame(fromSave) {
  if (fromSave) {
    const data = loadGame();
    if (data) {
      const pos = applySave(data);
      if (pos) {
        G.player.pos.set(pos.x, 0, pos.z);
        G.player.heading = pos.heading || 0;
      }
    }
  } else {
    G.cash = 0;
    G.health = 100;
    G.missionIndex = 0;
  }
  beginMission(G.missionIndex);
  G.mode = 'play';
  showOverlay(null);
  setHUDVisible(true);
  initAudio();
  requestLock(canvas);
  Cam.yaw = G.player.heading;
}

function pause() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  saveGame();
  releaseLock();
  showOverlay('pause');
}

function resume() {
  if (G.mode !== 'pause') return;
  G.mode = 'play';
  showOverlay(null);
  requestLock(canvas);
}

function respawn(cashMul, health) {
  addCash(-Math.round(G.cash * (1 - cashMul)));
  G.health = health;
  clearHeat();
  resetPolice();
  if (G.player.inCar) {
    G.player.inCar.driver = null;
    G.player.inCar = null;
    G.player.mesh.visible = true;
  }
  G.player.pos.set(City.landmarks.start.x, 0, City.landmarks.start.z);
  G.player.vel.x = G.player.vel.z = 0;
  G.mode = 'play';
  showOverlay(null);
  requestLock(canvas);
}

function toggleMute() {
  G.muted = !G.muted;
  setMuted(G.muted);
  document.getElementById('btn-mute').textContent = G.muted ? 'Unmute' : 'Mute';
}

let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = clamp(dt, 0, 0.05);

  if (hit('Escape')) {
    if (G.mode === 'play') pause();
    else if (G.mode === 'pause') resume();
  }
  if (hit('KeyM')) toggleMute();

  if (G.mode === 'play') {
    G.time += dt;
    updatePlayer(dt, Cam.yaw);
    updateTraffic(dt);
    updatePedestrians(dt);
    vehicleCollisions(dt);
    const nearestPolice = updatePolice(dt);
    updateWanted(dt, nearestPolice);
    updateWeapons(dt, World.camera);
    updateMissions(dt);
    updateEffects(dt);
    laySkids();
    updateCamera(dt);
    updateWorld(G.player.pos);
    updateHUD(dt);
    drawMinimap();
    feedAudio();
    autosaveT += dt;
    if (autosaveT > 25) { autosaveT = 0; saveGame(); }
    if (G.mode === 'dead') { releaseLock(); showOverlay('dead'); }
    if (G.mode === 'busted') { releaseLock(); showOverlay('busted'); }
  } else if (G.mode === 'menu') {
    G.time += dt;
    updateTraffic(dt);
    updatePedestrians(dt);
    updateEffects(dt);
    menuAngle += dt * 0.045;
    const cam = World.camera;
    cam.position.set(Math.sin(menuAngle) * 210, 74, Math.cos(menuAngle) * 210);
    cam.lookAt(0, 12, 0);
    updateWorld({ x: 0, z: 0 });
  } else {
    updateEffects(dt);
  }

  World.renderer.render(World.scene, World.camera);
  endFrame();
}

function laySkids() {
  const v = G.player.inCar;
  if (!v || v.skid < 0.35) return;
  const dx = v.pos.x - lastSkid.x, dz = v.pos.z - lastSkid.z;
  if (dx * dx + dz * dz < 0.45) return;
  lastSkid = { x: v.pos.x, z: v.pos.z };
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
  for (const s of [-1, 1]) {
    spawnSkid(v.pos.x - fx * 1.5 + lx * 0.85 * s, v.pos.z - fz * 1.5 + lz * 0.85 * s, v.heading);
  }
}

function feedAudio() {
  const p = G.player;
  if (p.inCar) {
    const ratio = clamp(Math.abs(p.inCar.speed) / 40, 0, 1);
    const throttle = Input.keys['KeyW'] || Input.keys['ArrowUp'] ? 1 : 0;
    setEngine(ratio, throttle);
  } else {
    setEngine(0, 0);
  }
  setOcean(clamp(1 - (SHORE_X - p.pos.x) / 140, 0, 1) * (p.pos.x > SAND_X - 90 ? 1 : 0));
}

// ---- debug / play-test hook (also used to stage screenshots) ----
window.SOLARA = {
  G,
  state() {
    return {
      mode: G.mode, cash: G.cash, health: G.health, stars: G.stars, heat: G.heat,
      inCar: G.player.inCar ? G.player.inCar.name : null,
      speed: G.player.inCar ? Math.round(G.player.inCar.speed * 3.6) : 0,
      missionIndex: G.missionIndex, objective: currentObjective().text,
      vehicles: G.vehicles.length, peds: G.peds.length,
      pos: { x: Math.round(G.player.pos.x), z: Math.round(G.player.pos.z) },
    };
  },
  start: () => startGame(false),
  teleport(x, z, heading = 0) {
    const p = G.player;
    if (p.inCar) { p.inCar.pos.set(x, 0, z); p.inCar.heading = heading; }
    p.pos.set(x, 0, z);
    p.heading = heading;
    Cam.yaw = heading;
  },
  setStars(n) {
    G.heat = n * 30;
    G.stars = n;
    G.lastCrime = G.time;
  },
  spawnChase(count = 3) {
    const p = G.player;
    for (let i = 0; i < count; i++) {
      const a = p.heading + (i - 1) * 0.4;
      const v = makeVehicle('patrol', p.pos.x + Math.sin(a) * (18 + i * 6), p.pos.z + Math.cos(a) * (18 + i * 6), p.heading, { ai: 'police' });
      v.speed = 12;
    }
  },
  giveCar(kind = 'sunray') {
    const p = G.player;
    const v = makeVehicle(kind, p.pos.x + Math.sin(p.heading) * 4, p.pos.z + Math.cos(p.heading) * 4, p.heading);
    enterVehicle(v);
    return v.name;
  },
  enterMissionCar() {
    const v = G.vehicles.find((c) => c.missionTag === 'target' && !c.destroyed);
    if (v) { enterVehicle(v); return v.name; }
    return null;
  },
  signs() {
    return City.signMeshes.map((s) => ({ x: s.position.x, y: s.position.y, z: s.position.z, ry: s.rotation.y }));
  },
  setYaw(h) { Cam.yaw = h; G.player.heading = h; },
  setPitch(p) { Cam.pitch = p; },
  freeRoam() { beginMission(MISSIONS.length); },
  streetLife() {
    const p = G.player;
    streetTraffic(p.pos.x, p.pos.z, p.heading);
    spawnCrowd(8, p.pos.x, p.pos.z);
  },
  world: World,
  startMission: (i) => beginMission(i),
  drive(speed = 20) { if (G.player.inCar) G.player.inCar.speed = speed; },
};

boot();
// build marker: main.js