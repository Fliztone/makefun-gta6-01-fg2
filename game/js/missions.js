// missions.js — the story of Dante Cruz and fixer Lola Reyes: five chained
// missions (meet, steal a specific car, hot cargo, a street race, the bank
// score) with markers, objectives, cash rewards and progression.

import { G, dist2D, addCash, showBanner, showToast } from './state.js';
import { City } from './city.js';
import { makeVehicle } from './vehicles.js';
import { addHeat } from './wanted.js';
import { pickup, missionComplete } from './audio.js';
import { saveGame } from './save.js';

export const MISSIONS = [
  { name: 'NEW IN TOWN', reward: 150, intro: 'Lola Reyes has work for you. Meet her at Plaza del Sol.' },
  { name: 'WHEELS OF FORTUNE', reward: 400, intro: 'A collector wants the pink Sunray GT at the marina. Bring it to Lola.' },
  { name: 'HOT CARGO', reward: 650, intro: 'Grab the package at the docks. Word is, the drop is being watched.' },
  { name: 'NEON CIRCUIT', reward: 800, intro: 'Prove you can drive. Eight checkpoints, one clock, no excuses.' },
  { name: 'THE BIG SCORE', reward: 1500, intro: 'Banco Solara holds Lola\'s money. Take it back and vanish into the sunset.' },
];

const RACE_CHECKPOINTS = [
  { x: -76, z: 0 }, { x: 0, z: -76 }, { x: 76, z: 0 }, { x: 152, z: 76 },
  { x: 76, z: 152 }, { x: -76, z: 76 }, { x: -152, z: 0 }, { x: -76, z: -76 },
];
const RACE_TIME = 95;

let marker = null;
let markerColor = 0xffd76e;
let advanceDelay = 0;

export function initMissions(scene) {
  marker = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.2, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd76e, toneMapped: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.4, 16, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: 0.16, toneMapped: false, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 8;
  marker.add(ring, beam);
  marker.visible = false;
  scene.add(marker);
  marker.userData = { ring, beam };
}

function setMarker(x, z, color = 0xffd76e) {
  marker.visible = true;
  marker.position.set(x, 0, z);
  markerColor = color;
  marker.userData.ring.material.color.setHex(color);
  marker.userData.beam.material.color.setHex(color);
}

function hideMarker() { marker.visible = false; }

export function beginMission(index) {
  G.missionIndex = index;
  G.missionStage = 0;
  G.missionData = {};
  advanceDelay = 0;
  if (index >= MISSIONS.length) { hideMarker(); return; }
  const m = MISSIONS[index];
  showBanner(m.name, m.intro, 4.5);
  if (index === 1) {
    const spot = City.landmarks.marina;
    G.missionData.car = makeVehicle('sunray', spot.x + 6, spot.z - 6, Math.PI / 2, { color: 0xff4f8b, missionTag: 'target' });
    setMarker(spot.x + 6, spot.z - 6);
  } else if (index === 0) setMarker(City.landmarks.plaza.x, City.landmarks.plaza.z);
  else if (index === 2) setMarker(City.landmarks.docks.x, City.landmarks.docks.z);
  else if (index === 3) setMarker(City.landmarks.raceStart.x, City.landmarks.raceStart.z, 0x4de3ff);
  else if (index === 4) setMarker(City.landmarks.bank.x, City.landmarks.bank.z);
}

function completeMission() {
  const m = MISSIONS[G.missionIndex];
  addCash(m.reward);
  missionComplete();
  showBanner('MISSION COMPLETE', `${m.name} — + $${m.reward}`, 3.2);
  G.stats.missionsDone++;
  hideMarker();
  advanceDelay = 3;
  saveGame();
}

export function updateMissions(dt) {
  if (G.mode !== 'play') return;
  // Marker animation.
  if (marker.visible) {
    marker.userData.ring.position.y = 0.6 + Math.sin(G.time * 2.4) * 0.25;
    marker.userData.ring.rotation.z = G.time * 0.8;
    marker.userData.beam.material.opacity = 0.13 + Math.sin(G.time * 3) * 0.05;
  }
  if (advanceDelay > 0) {
    advanceDelay -= dt;
    if (advanceDelay <= 0) beginMission(G.missionIndex + 1);
    return;
  }
  const i = G.missionIndex;
  if (i >= MISSIONS.length) return;
  const p = G.player;
  const d = G.missionData;

  if (i === 0) {
    if (dist2D(p.pos, City.landmarks.plaza) < 7) {
      showToast('Lola: "You drive, you shoot, you keep your mouth shut. Good."');
      completeMission();
    }
  } else if (i === 1) {
    const car = d.car;
    if (car.destroyed) {
      showToast('The Sunray is wrecked — Lola found another one.');
      const spot = City.landmarks.marina;
      d.car = makeVehicle('sunray', spot.x + 6, spot.z - 6, Math.PI / 2, { color: 0xff4f8b, missionTag: 'target' });
      G.missionStage = 0;
      setMarker(spot.x + 6, spot.z - 6);
      return;
    }
    if (G.missionStage === 0) {
      if (p.inCar === car) {
        G.missionStage = 1;
        showToast('Lola: "Now bring it to my garage. Don\'t scratch it."');
        setMarker(City.landmarks.garage.x, City.landmarks.garage.z);
      }
    } else if (p.inCar === car) {
      setMarker(City.landmarks.garage.x, City.landmarks.garage.z);
      if (dist2D(p.pos, City.landmarks.garage) < 10) completeMission();
    } else {
      setMarker(car.pos.x, car.pos.z);
    }
  } else if (i === 2) {
    if (G.missionStage === 0) {
      if (dist2D(p.pos, City.landmarks.docks) < 8) {
        G.missionStage = 1;
        pickup();
        addHeat(65, 'the drop was watched');
        showToast('Package collected — the drop was watched! Lose the cops and deliver.');
        setMarker(City.landmarks.warehouse.x, City.landmarks.warehouse.z);
      }
    } else if (dist2D(p.pos, City.landmarks.warehouse) < 9) {
      completeMission();
    }
  } else if (i === 3) {
    if (G.missionStage === 0) {
      if (p.inCar && dist2D(p.pos, City.landmarks.raceStart) < 9) {
        G.missionStage = 1;
        d.cp = 0;
        d.timer = RACE_TIME;
        showToast('GO! Hit every checkpoint before the clock dies.');
        setMarker(RACE_CHECKPOINTS[0].x, RACE_CHECKPOINTS[0].z, 0x4de3ff);
      }
    } else {
      d.timer -= dt;
      if (d.timer <= 0) {
        showToast('Time\'s up! The circuit resets — go again.');
        d.cp = 0;
        d.timer = RACE_TIME;
        setMarker(RACE_CHECKPOINTS[0].x, RACE_CHECKPOINTS[0].z, 0x4de3ff);
        return;
      }
      const cp = RACE_CHECKPOINTS[d.cp];
      if (p.inCar && dist2D(p.pos, cp) < 11) {
        d.cp++;
        pickup();
        if (d.cp >= RACE_CHECKPOINTS.length) { completeMission(); return; }
        showToast(`Checkpoint ${d.cp}/${RACE_CHECKPOINTS.length} — ${Math.ceil(d.timer)}s left`);
        setMarker(RACE_CHECKPOINTS[d.cp].x, RACE_CHECKPOINTS[d.cp].z, 0x4de3ff);
      }
    }
  } else if (i === 4) {
    if (G.missionStage === 0) {
      if (dist2D(p.pos, City.landmarks.bank) < 8) {
        G.missionStage = 1;
        addHeat(95, 'bank alarm');
        showBanner('ALARM TRIPPED', 'Three stars. Run for the beach safehouse and shake the police.', 4);
        setMarker(City.landmarks.safehouse.x, City.landmarks.safehouse.z);
      }
    } else if (dist2D(p.pos, City.landmarks.safehouse) < 9 && G.stars === 0) {
      completeMission();
      showBanner('SOLARA BAY IS YOURS', 'The score is settled. The city is yours to roam.', 6);
    }
  }
}

// Objective line + map target for HUD and minimap.
export function currentObjective() {
  const i = G.missionIndex;
  if (advanceDelay > 0) return { text: 'Nice work. Next job incoming…', target: null };
  if (i >= MISSIONS.length) return { text: 'Free roam — Solara Bay is yours. Cause some chaos.', target: null };
  const p = G.player;
  const d = G.missionData;
  if (i === 0) return { text: 'Meet Lola at Plaza del Sol', target: City.landmarks.plaza };
  if (i === 1) {
    if (G.missionStage === 0) return { text: 'Steal the pink Sunray GT at the marina', target: d.car ? d.car.pos : City.landmarks.marina };
    if (p.inCar === d.car) return { text: "Deliver the Sunray to Lola's garage", target: City.landmarks.garage };
    return { text: 'Get back in the pink Sunray GT', target: d.car.pos };
  }
  if (i === 2) {
    if (G.missionStage === 0) return { text: 'Pick up the package at the docks', target: City.landmarks.docks };
    return { text: 'Deliver the package to Muelle 9 — shake the cops', target: City.landmarks.warehouse };
  }
  if (i === 3) {
    if (G.missionStage === 0) return { text: 'Get in a car and reach the start line', target: City.landmarks.raceStart };
    if (!p.inCar) return { text: 'Get back in a car! The clock is running', target: RACE_CHECKPOINTS[d.cp] };
    return { text: `Checkpoint ${d.cp + 1}/${RACE_CHECKPOINTS.length} — ${Math.ceil(d.timer)}s`, target: RACE_CHECKPOINTS[d.cp] };
  }
  if (i === 4) {
    if (G.missionStage === 0) return { text: 'Rob Banco Solara — reach the bank doors', target: City.landmarks.bank };
    if (G.stars > 0) return { text: 'Lose the cops, then reach the beach safehouse', target: City.landmarks.safehouse };
    return { text: 'Reach the beach safehouse', target: City.landmarks.safehouse };
  }
  return { text: '', target: null };
}

export function raceState() {
  if (G.missionIndex === 3 && G.missionStage === 1) return G.missionData;
  return null;
}

export function raceCheckpoints() { return RACE_CHECKPOINTS; }
// build marker: missions.js