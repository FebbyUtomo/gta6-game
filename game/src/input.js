// Keyboard and mouse input. Held keys give a steering vector; one-shot presses (enter a
// car, shoot, punch, pause, mute, confirm) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. The mouse gives an aim
// point in screen space, which the renderer converts to a world direction.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_PUNCH = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const SHOOT = new Set(['KeyF']);
const PUNCH = new Set(['Space']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sprint = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function press(code, event) {
    if (UP.has(code)) up = true;
    else if (DOWN.has(code)) down = true;
    else if (LEFT.has(code)) left = true;
    else if (RIGHT.has(code)) right = true;
    else if (SPRINT.has(code)) sprint = true;
    else if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (SHOOT.has(code)) {
      if (!event.repeat) actions |= ACTION_SHOOT;
    } else if (PUNCH.has(code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (MUTE.has(code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  }

  function release(code) {
    if (UP.has(code)) up = false;
    else if (DOWN.has(code)) down = false;
    else if (LEFT.has(code)) left = false;
    else if (RIGHT.has(code)) right = false;
    else if (SPRINT.has(code)) sprint = false;
  }

  window.addEventListener('keydown', (event) => press(event.code, event));
  window.addEventListener('keyup', (event) => release(event.code));
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    sprint = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** The held steering vector, each component -1, 0 or 1. */
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    sprinting() {
      return sprint;
    },
    /** The mouse position in canvas CSS pixels, and whether its button is held. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
