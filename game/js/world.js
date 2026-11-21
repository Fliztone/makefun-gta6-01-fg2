// world.js — renderer, sunset sky dome, animated ocean shader, warm lighting
// and fog. The sun hangs low over the water east of Solara Bay.

import { G } from './state.js';

export const World = {
  renderer: null,
  scene: null,
  camera: null,
  sun: null,
  skyUniforms: null,
  waterUniforms: null,
};

const SUN_DIR = { x: 0.82, y: 0.28, z: -0.35 };

export function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb289, 160, 860);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
  camera.position.set(0, 8, 14);

  // Sunset gradient sky with a visible sun disc.
  const skyUniforms = {
    sunDir: { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize() },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1600, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.05, 1.0);
          vec3 zenith  = vec3(0.13, 0.19, 0.42);
          vec3 mid     = vec3(0.72, 0.38, 0.48);
          vec3 horizon = vec3(1.00, 0.62, 0.34);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          col = mix(col, zenith, smoothstep(0.16, 0.72, h));
          float d = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.85, 0.55) * pow(d, 350.0) * 3.0;   // sun disc
          col += vec3(1.0, 0.55, 0.25) * pow(d, 8.0) * 0.35;    // haze glow
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(sky);

  // Lighting: warm hemisphere fill + low golden sun with shadows.
  const hemi = new THREE.HemisphereLight(0xffd2a8, 0x5a4a66, 0.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa860, 2.3);
  sun.position.set(SUN_DIR.x * 400, SUN_DIR.y * 400, SUN_DIR.z * 400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // Ocean: gentle vertex waves + sun glitter in the fragment shader.
  const waterUniforms = {
    time: { value: 0 },
    sunDir: { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize() },
    fogColor: { value: new THREE.Color(0xffb289) },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1800, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      fog: false,
      transparent: false,
      vertexShader: `
        uniform float time;
        varying vec3 vWorld;
        varying float vWave;
        void main() {
          vec3 p = position;
          float w = sin(p.x * 0.08 + time * 0.9) * 0.35
                  + sin(p.y * 0.11 - time * 0.7) * 0.3
                  + sin((p.x + p.y) * 0.05 + time * 0.4) * 0.4;
          p.z += w;
          vWave = w;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float time;
        uniform vec3 sunDir;
        uniform vec3 fogColor;
        varying vec3 vWorld;
        varying float vWave;
        void main() {
          vec3 deep = vec3(0.05, 0.16, 0.28);
          vec3 shallow = vec3(0.12, 0.36, 0.44);
          vec3 col = mix(deep, shallow, clamp(vWave * 0.5 + 0.5, 0.0, 1.0));
          // Fake ripple normal for sun glitter.
          vec3 n = normalize(vec3(
            sin(vWorld.x * 0.35 + time * 1.4) * 0.18 + sin(vWorld.z * 0.22 - time) * 0.12,
            1.0,
            cos(vWorld.z * 0.3 + time * 1.1) * 0.18));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          vec3 h = normalize(sunDir + viewDir);
          float spec = pow(max(dot(n, h), 0.0), 90.0);
          col += vec3(1.0, 0.72, 0.42) * spec * 1.6;
          float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
          col = mix(col, vec3(1.0, 0.6, 0.36), fres * 0.45);
          float dist = length(cameraPosition - vWorld);
          col = mix(col, fogColor, smoothstep(160.0, 860.0, dist));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(1180, -0.45, 0);
  scene.add(water);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  World.renderer = renderer;
  World.scene = scene;
  World.camera = camera;
  World.sun = sun;
  World.skyUniforms = skyUniforms;
  World.waterUniforms = waterUniforms;
  return World;
}

// Keep the shadow frustum centred on the action and animate the ocean.
export function updateWorld(focus) {
  World.waterUniforms.time.value = G.time;
  const sun = World.sun;
  sun.position.set(focus.x + SUN_DIR.x * 400, SUN_DIR.y * 400, focus.z + SUN_DIR.z * 400);
  sun.target.position.set(focus.x, 0, focus.z);
  sun.target.updateMatrixWorld();
}
// build marker: world.js