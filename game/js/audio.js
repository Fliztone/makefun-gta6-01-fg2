// audio.js — all sound is synthesized with WebAudio at runtime: engine hum,
// gunfire, sirens, skids, pickups, ocean wash and a slow sunset synth pad.
// No audio files; the context starts on the Play button's user gesture.

let ctx = null;
let master = null;
let engineOsc = null, engineGain = null, engineFilter = null;
let sirenOsc = null, sirenGain = null, sirenLFO = null;
let skidSrc = null, skidGain = null;
let oceanGain = null;
let musicTimer = null;

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);

  // Engine: sawtooth through a lowpass, pitch follows speed.
  engineOsc = ctx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter).connect(engineGain).connect(master);
  engineOsc.start();

  // Siren: two-tone wail, gain follows nearest police distance.
  sirenOsc = ctx.createOscillator();
  sirenOsc.type = 'triangle';
  sirenOsc.frequency.value = 700;
  sirenLFO = ctx.createOscillator();
  sirenLFO.type = 'square';
  sirenLFO.frequency.value = 0.9;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 160;
  sirenLFO.connect(lfoAmt).connect(sirenOsc.frequency);
  sirenGain = ctx.createGain();
  sirenGain.gain.value = 0;
  sirenOsc.connect(sirenGain).connect(master);
  sirenOsc.start();
  sirenLFO.start();

  // Skid: looped filtered noise.
  skidSrc = ctx.createBufferSource();
  skidSrc.buffer = noiseBuffer(1.2);
  skidSrc.loop = true;
  const skidFilter = ctx.createBiquadFilter();
  skidFilter.type = 'bandpass';
  skidFilter.frequency.value = 900;
  skidFilter.Q.value = 0.7;
  skidGain = ctx.createGain();
  skidGain.gain.value = 0;
  skidSrc.connect(skidFilter).connect(skidGain).connect(master);
  skidSrc.start();

  // Ocean wash: looped lowpassed noise, gain by beach proximity.
  const oceanSrc = ctx.createBufferSource();
  oceanSrc.buffer = noiseBuffer(2.5);
  oceanSrc.loop = true;
  const oceanFilter = ctx.createBiquadFilter();
  oceanFilter.type = 'lowpass';
  oceanFilter.frequency.value = 380;
  oceanGain = ctx.createGain();
  oceanGain.gain.value = 0;
  oceanSrc.connect(oceanFilter).connect(oceanGain).connect(master);
  oceanSrc.start();

  startMusic();
}

// A mellow sunset pad: slow chord swells plus a sparse plucked arpeggio.
const CHORDS = [
  [110.0, 164.81, 220.0, 261.63],   // A minor-ish warmth
  [87.31, 130.81, 174.61, 220.0],   // F
  [98.0, 146.83, 196.0, 246.94],    // G
  [82.41, 123.47, 164.81, 207.65],  // E
];
let chordIdx = 0;

function startMusic() {
  const pad = (freqs) => {
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.016, now + 2.2);
      g.gain.linearRampToValueAtTime(0, now + 7.5);
      o.connect(g).connect(master);
      o.start(now);
      o.stop(now + 8);
    }
  };
  const pluck = (f, when) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + 1);
  };
  const bar = () => {
    if (!ctx) return;
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    pad(chord);
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.65) pluck(chord[(i + chordIdx) % chord.length] * 2, now + 0.5 + i * 1.7);
    }
  };
  bar();
  musicTimer = setInterval(bar, 7600);
}

export function setEngine(speedRatio, throttle) {
  if (!ctx) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130 + throttle * 22, t, 0.08);
  engineFilter.frequency.setTargetAtTime(320 + speedRatio * 900, t, 0.1);
  engineGain.gain.setTargetAtTime(speedRatio > 0.01 || throttle > 0 ? 0.05 + speedRatio * 0.05 : 0, t, 0.12);
}

export function setSiren(level) {
  if (!ctx) return;
  sirenGain.gain.setTargetAtTime(Math.min(0.12, level * 0.12), ctx.currentTime, 0.2);
}

export function setSkid(level) {
  if (!ctx) return;
  skidGain.gain.setTargetAtTime(Math.min(0.14, level * 0.14), ctx.currentTime, 0.06);
}

export function setOcean(level) {
  if (!ctx) return;
  oceanGain.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.5);
}

export function gunshot() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.2);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3200, now);
  f.frequency.exponentialRampToValueAtTime(240, now + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  src.connect(f).connect(g).connect(master);
  src.start(now);
  const thump = ctx.createOscillator();
  thump.type = 'square';
  thump.frequency.setValueAtTime(150, now);
  thump.frequency.exponentialRampToValueAtTime(45, now + 0.09);
  const tg = ctx.createGain();
  tg.gain.setValueAtTime(0.25, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  thump.connect(tg).connect(master);
  thump.start(now);
  thump.stop(now + 0.12);
}

export function pickup() {
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    const t = now + i * 0.07;
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.32);
  });
}

export function crash(intensity) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(0.3);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.min(0.4, 0.1 + intensity * 0.3), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  src.connect(f).connect(g).connect(master);
  src.start(now);
}

export function missionComplete() {
  if (!ctx) return;
  const now = ctx.currentTime;
  [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    const t = now + i * 0.11;
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.6);
  });
}

export function setMuted(muted) {
  if (!ctx) return;
  master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
}
// build marker: audio.js