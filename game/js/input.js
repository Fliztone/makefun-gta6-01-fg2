// input.js — keyboard + mouse state, pointer lock for mouse look.
// Keys are tracked by KeyboardEvent.code so layout never matters.

export const Input = {
  keys: Object.create(null),
  pressed: Object.create(null),   // cleared every frame after systems read it
  mouseDX: 0,
  mouseDY: 0,
  left: false,
  right: false,
  leftPressed: false,
  locked: false,
  sensitivity: 0.0023,
};

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!Input.keys[e.code]) Input.pressed[e.code] = true;
    Input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = Object.create(null); Input.left = Input.right = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { Input.left = true; Input.leftPressed = true; }
    if (e.button === 2) Input.right = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) Input.left = false;
    if (e.button === 2) Input.right = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('mousemove', (e) => {
    if (!Input.locked) return;
    Input.mouseDX += e.movementX || 0;
    Input.mouseDY += e.movementY || 0;
  });

  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === canvas;
  });
}

export function requestLock(canvas) {
  if (document.pointerLockElement !== canvas) {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
}

export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function key(code) { return !!Input.keys[code]; }
export function hit(code) { return !!Input.pressed[code]; }

// Call once at the very end of a frame.
export function endFrame() {
  Input.pressed = Object.create(null);
  Input.leftPressed = false;
  Input.mouseDX = 0;
  Input.mouseDY = 0;
}

export function moveAxes() {
  let x = 0, z = 0;
  if (key('KeyW') || key('ArrowUp')) z -= 1;
  if (key('KeyS') || key('ArrowDown')) z += 1;
  if (key('KeyA') || key('ArrowLeft')) x -= 1;
  if (key('KeyD') || key('ArrowRight')) x += 1;
  return { x, z };
}
// build marker: input.js