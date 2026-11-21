// city.js — procedural Solara Bay: a street grid with sidewalks, pastel towers,
// neon signage, palms, parks, a beach and a pier. Also owns building collision
// and the road/lane helpers that traffic and police drive on.

import { G } from './state.js';

export const CELL = 76;            // block + road pitch
export const GRID = 8;             // blocks per side
export const HALF = (GRID * CELL) / 2;
export const ROAD_W = 16;
export const BLOCK = CELL - ROAD_W;
export const SAND_X = 316;         // beach starts east of the grid
export const SHORE_X = 382;        // water line
export const WALK_LIMIT_X = 376;

export const roads = [];
for (let i = 0; i <= GRID; i++) roads.push(i * CELL - HALF);

export const City = {
  colliders: [],                   // {x, z, hw, hd} building AABBs
  landmarks: {},
  signMeshes: [],
};

function blockCenter(i, j) {
  return { x: roads[i] + CELL / 2, z: roads[j] + CELL / 2 };
}

// ---- canvas textures (generated at runtime, no asset files) ----

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 8 + col * 20, y = 10 + row * 20;
      g.fillStyle = Math.random() < lit ? '#ffd98a' : '#2c3550';
      g.fillRect(x, y, 12, 13);
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(x, y, 12, 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.font = 'bold 58px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.85;
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

const FACADES = ['#f2e3c8', '#e8a087', '#7fc4c9', '#e9b7c0', '#d9c49a', '#b7a8d9', '#f4c9a0', '#9fd0b8'];
const NEON = ['#ff5f9e', '#4de3ff', '#ffb347', '#a5ff6e', '#ff6e5f', '#d98aff'];
const SHOP_NAMES = [
  'HOTEL MIRASOL', 'CAFÉ DEL MAR', 'NEON FLAMINGO', 'DISCOTECA OLA',
  'SOLARA MOTORS', 'TACOS TIBURÓN', 'HELADOS POLAR', 'CINE LUNA',
  'MARINA AZUL', 'ROPA SALVAJE', 'BAR EL FARO', 'SUPERMERCADO SOL',
  'HOTEL CARACOL', 'PELUQUERÍA FUEGO', 'JOYERÍA PERLA', 'CLUB MEDUSA',
  'FARMACIA LUZ', 'PANADERÍA ORO', 'MOTEL ESTRELLA', 'GIMNASIO TITÁN',
  'LIBRERÍA ARENA', 'FLORISTERÍA IRIS', 'ARCADE RELÁMPAGO', 'SASTRERÍA FINA',
];

let facadeMats = [];
let roofMat = null;

function initMaterials() {
  facadeMats = FACADES.map((base) => new THREE.MeshLambertMaterial({
    map: facadeTexture(base, 0.22 + Math.random() * 0.2),
  }));
  roofMat = new THREE.MeshLambertMaterial({ color: 0x8a7f77 });
}

function addBuilding(scene, x, z, w, d, h, matIdx) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const base = facadeMats[matIdx % facadeMats.length];
  // Scale the window grid to the building so windows keep a human size.
  const side = base.clone();
  side.map = base.map.clone();
  side.map.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 13)));
  side.map.needsUpdate = true;
  const mesh = new THREE.Mesh(geo, [side, side, roofMat, roofMat, side, side]);
  mesh.position.set(x, h / 2 + 0.15, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  City.colliders.push({ x, z, hw: w / 2, hd: d / 2 });
  return mesh;
}

function addSign(scene, building, text, colorIdx) {
  const { x, z, hw, hd } = City.colliders[City.colliders.length - 1];
  const h = building.geometry.parameters.height;
  const tex = signTexture(text, NEON[colorIdx % NEON.length]);
  const w = Math.min(hw * 2 - 1, 13);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide })
  );
  const face = Math.floor(Math.random() * 4);
  const y = Math.min(h - 2, 6 + Math.random() * 8);
  if (face === 0) { sign.position.set(x, y, z + hd + 0.16); }
  else if (face === 1) { sign.position.set(x, y, z - hd - 0.16); sign.rotation.y = Math.PI; }
  else if (face === 2) { sign.position.set(x + hw + 0.16, y, z); sign.rotation.y = Math.PI / 2; }
  else { sign.position.set(x - hw - 0.16, y, z); sign.rotation.y = -Math.PI / 2; }
  scene.add(sign);
  City.signMeshes.push(sign);
}

// ---- special districts ----

const SPECIAL = {
  '2,4': 'plaza', '4,3': 'bank', '3,5': 'garage',
  '7,6': 'marina', '7,1': 'docks', '1,6': 'warehouse',
  '1,1': 'park', '6,6': 'park', '0,5': 'park', '5,0': 'park',
};

function buildPlaza(scene, cx, cz) {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.2, BLOCK), new THREE.MeshLambertMaterial({ color: 0xc0b096 }));
  slab.position.set(cx, 0.1, cz);
  slab.receiveShadow = true;
  scene.add(slab);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 1, 20), new THREE.MeshLambertMaterial({ color: 0xcabfae }));
  basin.position.set(cx, 0.6, cz);
  basin.castShadow = true;
  scene.add(basin);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.3, 20), new THREE.MeshLambertMaterial({ color: 0x57c7d4 }));
  pool.position.set(cx, 1.05, cz);
  scene.add(pool);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3.4, 8), new THREE.MeshLambertMaterial({ color: 0xcabfae }));
  spire.position.set(cx, 2.4, cz);
  scene.add(spire);
  City.colliders.push({ x: cx, z: cz, hw: 5.6, hd: 5.6 });
  City.landmarks.plaza = { x: cx, z: cz + 10 };
}

function buildBank(scene, cx, cz) {
  const mesh = addBuilding(scene, cx, cz, 34, 26, 16, 0);
  const colMat = new THREE.MeshLambertMaterial({ color: 0xf5ecd8 });
  for (let i = -2; i <= 2; i++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 12, 10), colMat);
    col.position.set(cx + i * 6, 6.2, cz + 14.2);
    col.castShadow = true;
    scene.add(col);
  }
  const pediment = new THREE.Mesh(new THREE.BoxGeometry(36, 2.4, 4), colMat);
  pediment.position.set(cx, 13.2, cz + 14);
  scene.add(pediment);
  const tex = signTexture('BANCO SOLARA', '#ffd76e');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  sign.position.set(cx, 15.4, cz + 13.4);
  scene.add(sign);
  City.landmarks.bank = { x: cx, z: cz + 20 };
}

function buildGarage(scene, cx, cz) {
  addBuilding(scene, cx, cz - 6, 30, 20, 7, 3);
  const tex = signTexture("LOLA'S GARAGE", '#ff5f9e');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  sign.position.set(cx, 8.6, cz + 4.2);
  scene.add(sign);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshLambertMaterial({ color: 0x4a4550 }));
  door.position.set(cx, 2.7, cz + 4.05);
  scene.add(door);
  City.landmarks.garage = { x: cx, z: cz + 12 };
}

function buildLot(scene, cx, cz, name) {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.16, BLOCK), new THREE.MeshLambertMaterial({ color: 0x55505c }));
  slab.position.set(cx, 0.08, cz);
  slab.receiveShadow = true;
  scene.add(slab);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xcfc6b8 });
  for (let i = -2; i <= 2; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 8), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(cx + i * 6, 0.18, cz - 8);
    scene.add(line);
  }
  City.landmarks[name] = { x: cx, z: cz + 8 };
}

function buildWarehouse(scene, cx, cz) {
  addBuilding(scene, cx, cz, 40, 30, 9, 4);
  const tex = signTexture('MUELLE 9 · CARGA', '#4de3ff');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  sign.position.set(cx, 10.4, cz + 15.3);
  scene.add(sign);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8794a });
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), crateMat);
    crate.position.set(cx - 16 + i * 4.5, 1.35, cz + 19);
    crate.rotation.y = Math.random() * 0.5;
    crate.castShadow = true;
    scene.add(crate);
  }
  City.landmarks.warehouse = { x: cx, z: cz + 21 };
  City.landmarks.docksPickup = { x: cx + 10, z: cz + 21 };
}

function buildPark(scene, cx, cz) {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.2, BLOCK), new THREE.MeshLambertMaterial({ color: 0x6fae5f }));
  slab.position.set(cx, 0.1, cz);
  slab.receiveShadow = true;
  scene.add(slab);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4, BLOCK), new THREE.MeshLambertMaterial({ color: 0xd8c8a8 }));
  path.rotation.x = -Math.PI / 2;
  path.position.set(cx, 0.22, cz);
  scene.add(path);
}

// ---- palms, lamps, beach ----

function scatterPalms(scene, spots) {
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.3, 5.6, 5);
  trunkGeo.translate(0, 2.8, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  trunks.castShadow = true;
  const frondGeo = new THREE.PlaneGeometry(3.1, 0.85);
  frondGeo.translate(1.55, 0, 0);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3c, side: THREE.DoubleSide });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, spots.length * 6);
  fronds.castShadow = true;
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YZX';
  let fi = 0;
  spots.forEach((p, i) => {
    const lean = (Math.random() - 0.5) * 0.16;
    const s = 0.8 + Math.random() * 0.5;
    dummy.position.set(p.x, 0.1, p.z);
    dummy.rotation.set(lean, Math.random() * Math.PI, lean * 0.7);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    const topY = 5.5 * s;
    for (let k = 0; k < 6; k++) {
      dummy.position.set(p.x, topY, p.z);
      dummy.rotation.set(-Math.PI / 2, (k / 6) * Math.PI * 2 + Math.random() * 0.4, -0.45 - Math.random() * 0.4);
      dummy.scale.setScalar(s * (0.85 + Math.random() * 0.3));
      dummy.updateMatrix();
      fronds.setMatrixAt(fi++, dummy.matrix);
    }
  });
  scene.add(trunks, fronds);
}

function streetLamps(scene) {
  const spots = [];
  for (let i = 0; i <= GRID; i++) {
    for (let t = -HALF + 20; t < HALF; t += 52) {
      spots.push({ x: roads[i] + ROAD_W / 2 + 1.2, z: t });
      spots.push({ x: t, z: roads[i] - ROAD_W / 2 - 1.2 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 6.4, 5);
  poleGeo.translate(0, 3.2, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x3a3f4a }), spots.length);
  const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 6.5, p.z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles, heads);
}

function roadMarkings(scene) {
  const dashes = [];
  for (let i = 0; i <= GRID; i++) {
    for (let t = -HALF + 4; t < HALF - 2; t += 8) {
      const nearCross = roads.some((r) => Math.abs(t - r) < 11);
      if (nearCross) continue;
      dashes.push({ x: roads[i], z: t, rot: 0 });
      dashes.push({ x: t, z: roads[i], rot: Math.PI / 2 });
    }
  }
  const geo = new THREE.PlaneGeometry(0.32, 3.2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xd8c26a });
  const mesh = new THREE.InstancedMesh(geo, mat, dashes.length);
  const dummy = new THREE.Object3D();
  dashes.forEach((d, i) => {
    dummy.position.set(d.x, 0.03, d.z);
    dummy.rotation.set(-Math.PI / 2, 0, d.rot);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(mesh);
}

function buildBeach(scene) {
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(SHORE_X - SAND_X + 10, HALF * 2 + 120),
    new THREE.MeshLambertMaterial({ color: 0xd9bd85 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((SAND_X + SHORE_X) / 2 + 2, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  // Pier out over the water.
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a7a55 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(74, 0.5, 7), wood);
  deck.position.set(SHORE_X + 34, 1.1, 60);
  deck.castShadow = true;
  scene.add(deck);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 6), wood);
    post.position.set(SHORE_X + 6 + i * 13, -0.4, 60 + (i % 2 ? 2.8 : -2.8));
    scene.add(post);
  }

  // Umbrellas + towels.
  const colors = [0xff6e5f, 0x4de3ff, 0xffd76e, 0xff5f9e, 0xa5ff6e];
  for (let i = 0; i < 9; i++) {
    const x = 330 + Math.random() * 34;
    const z = -240 + i * 52 + Math.random() * 18;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
    pole.position.set(x, 1.2, z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 8), new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
    top.position.set(x, 2.5, z);
    top.castShadow = true;
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshLambertMaterial({ color: colors[(i + 2) % colors.length] }));
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = Math.random();
    towel.position.set(x + 2.2, 0.06, z + 1);
    scene.add(pole, top, towel);
  }
  City.landmarks.safehouse = { x: 344, z: -84 };
  City.landmarks.pier = { x: SHORE_X + 20, z: 60 };
}

// ---- main build ----

export function buildCity(scene) {
  initMaterials();
  City.colliders.length = 0;

  // Asphalt base under the whole grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60),
    new THREE.MeshLambertMaterial({ color: 0x363240 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb4a68c });
  const palmSpots = [];
  let signBudget = SHOP_NAMES.length;

  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const { x: cx, z: cz } = blockCenter(i, j);
      const kind = SPECIAL[`${i},${j}`];
      if (kind === 'plaza') { buildPlaza(scene, cx, cz); palmSpots.push({ x: cx - 24, z: cz - 24 }, { x: cx + 24, z: cz + 24 }, { x: cx - 24, z: cz + 24 }, { x: cx + 24, z: cz - 24 }); continue; }
      if (kind === 'bank') { buildBank(scene, cx, cz); continue; }
      if (kind === 'garage') { buildGarage(scene, cx, cz); continue; }
      if (kind === 'marina') { buildLot(scene, cx, cz, 'marina'); palmSpots.push({ x: cx + 26, z: cz - 26 }, { x: cx + 26, z: cz + 26 }); continue; }
      if (kind === 'docks') { buildLot(scene, cx, cz, 'docks'); continue; }
      if (kind === 'warehouse') { buildWarehouse(scene, cx, cz); continue; }
      if (kind === 'park') {
        buildPark(scene, cx, cz);
        for (let k = 0; k < 5; k++) palmSpots.push({ x: cx - 22 + Math.random() * 44, z: cz - 22 + Math.random() * 44 });
        continue;
      }

      // Sidewalk slab.
      const slab = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.18, BLOCK), sidewalkMat);
      slab.position.set(cx, 0.09, cz);
      slab.receiveShadow = true;
      scene.add(slab);

      // 2x2 sub-lots of buildings; taller toward downtown.
      const downtown = Math.abs(i - 3.5) <= 1.6 && Math.abs(j - 3.5) <= 1.6;
      for (let sx = 0; sx < 2; sx++) {
        for (let sz = 0; sz < 2; sz++) {
          if (Math.random() < 0.12) continue; // vacant lot
          const w = 15 + Math.random() * 9;
          const d = 15 + Math.random() * 9;
          const h = downtown ? 26 + Math.random() * 46 : 8 + Math.random() * 18;
          const bx = cx + (sx ? 14 : -14) + (Math.random() - 0.5) * 3;
          const bz = cz + (sz ? 14 : -14) + (Math.random() - 0.5) * 3;
          const b = addBuilding(scene, bx, bz, w, d, h, Math.floor(Math.random() * FACADES.length));
          if (signBudget > 0 && (downtown || Math.random() < 0.22)) {
            addSign(scene, b, SHOP_NAMES[SHOP_NAMES.length - signBudget], signBudget);
            signBudget--;
          }
        }
      }
      palmSpots.push({ x: cx - BLOCK / 2 + 1.8, z: cz - BLOCK / 2 + 1.8 });
      palmSpots.push({ x: cx + BLOCK / 2 - 1.8, z: cz + BLOCK / 2 - 1.8 });
    }
  }

  // Beachfront palm row.
  for (let z = -280; z <= 280; z += 26) palmSpots.push({ x: SAND_X + 6 + Math.random() * 4, z: z + Math.random() * 8 });

  scatterPalms(scene, palmSpots);
  streetLamps(scene);
  roadMarkings(scene);
  buildBeach(scene);

  City.landmarks.start = { x: -114, z: 72 };
  City.landmarks.raceStart = { x: -114, z: 10 };
  return City;
}

// ---- collision & road helpers ----

// Push a circle out of building AABBs and the city limits; returns impact speed hint.
export function collideCircle(p, r) {
  let hit = false;
  for (const c of City.colliders) {
    const nx = Math.max(c.x - c.hw, Math.min(p.x, c.x + c.hw));
    const nz = Math.max(c.z - c.hd, Math.min(p.z, c.z + c.hd));
    const dx = p.x - nx, dz = p.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push along the shallowest axis.
        const pushX = c.hw - Math.abs(p.x - c.x);
        const pushZ = c.hd - Math.abs(p.z - c.z);
        if (pushX < pushZ) p.x = c.x + Math.sign(p.x - c.x || 1) * (c.hw + r);
        else p.z = c.z + Math.sign(p.z - c.z || 1) * (c.hd + r);
      }
    }
  }
  if (p.x < -HALF - 8) { p.x = -HALF - 8; hit = true; }
  if (p.x > WALK_LIMIT_X) { p.x = WALK_LIMIT_X; hit = true; }
  if (p.z < -HALF - 8) { p.z = -HALF - 8; hit = true; }
  if (p.z > HALF + 8) { p.z = HALF + 8; hit = true; }
  return hit;
}

export function isOnRoad(x, z) {
  const near = (v) => roads.some((r) => Math.abs(v - r) < ROAD_W / 2);
  return near(x) || near(z);
}

// Right-hand lane offset for a direction of travel.
export function laneOffset(axis, dir) {
  return axis === 'z' ? (dir > 0 ? -4 : 4) : (dir > 0 ? 4 : -4);
}

export function headingFor(axis, dir) {
  if (axis === 'z') return dir > 0 ? 0 : Math.PI;
  return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

// A random legal driving spot: {x, z, heading, axis, dir, road}
export function randomRoadPoint(avoid, minDist) {
  for (let tries = 0; tries < 24; tries++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const road = roads[Math.floor(Math.random() * roads.length)];
    const t = -HALF + 10 + Math.random() * (HALF * 2 - 20);
    const off = laneOffset(axis, dir);
    const x = axis === 'z' ? road + off : t;
    const z = axis === 'z' ? t : road + off;
    if (avoid && minDist) {
      const dx = x - avoid.x, dz = z - avoid.z;
      if (dx * dx + dz * dz < minDist * minDist) continue;
    }
    return { x, z, heading: headingFor(axis, dir), axis, dir, road };
  }
  return { x: 4, z: 0, heading: 0, axis: 'z', dir: 1, road: 0 };
}

// Sidewalk loop rectangle for pedestrians around block (i, j).
export function pedLoop(i, j) {
  const { x, z } = blockCenter(i, j);
  return { cx: x, cz: z, half: BLOCK / 2 - 1.7 };
}
// build marker: city.js