// input.js — keyboard + mouse state for Solmar City. One object, polled by the
// game loop; edges (pressed-this-frame keys) are consumed by main.js.

export function createInput() {
  return {
    up: false, down: false, left: false, right: false,
    action: false, // E — enter / exit car, pick up
    punch: false,  // F — melee
    shoot: false,  // Space or mouse click — fire pistol
    pause: false,  // P or Escape
    confirm: false, // Enter — start screen / menus
    mouseX: 0, mouseY: 0, mouseDown: false,
    pressed: new Set(), // keys pressed since last consume
  };
}

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  KeyE: 'action',
  KeyF: 'punch',
  Space: 'shoot',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm',
};

export function attachInput(input, element) {
  function onKey(e, down) {
    const name = KEYMAP[e.code];
    if (!name) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (down && !input[name]) input.pressed.add(name);
    input[name] = down;
  }
  function onMouseMove(e) {
    // Aim in canvas pixels, even when CSS scales the canvas.
    const canvas = document.getElementById('game');
    const rect = canvas ? canvas.getBoundingClientRect() : element.getBoundingClientRect();
    const scaleX = canvas ? canvas.width / rect.width : 1;
    const scaleY = canvas ? canvas.height / rect.height : 1;
    input.mouseX = (e.clientX - rect.left) * scaleX;
    input.mouseY = (e.clientY - rect.top) * scaleY;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    input.mouseDown = true;
    input.shoot = true;
    input.pressed.add('shoot');
  }
  function onMouseUp() {
    input.mouseDown = false;
    input.shoot = false;
  }
  element.addEventListener('keydown', (e) => onKey(e, true));
  element.addEventListener('keyup', (e) => onKey(e, false));
  element.addEventListener('mousemove', onMouseMove);
  element.addEventListener('mousedown', onMouseDown);
  element.addEventListener('mouseup', onMouseUp);
  element.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.shoot = false;
    input.mouseDown = false;
  });
}

// Was this control pressed since the last frame? Consumes the edge.
export function wasPressed(input, name) {
  if (input.pressed.has(name)) {
    input.pressed.delete(name);
    return true;
  }
  return false;
}

export function endFrame(input) {
  input.pressed.clear();
}
