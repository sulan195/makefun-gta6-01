
export function createInput() {
  return {
    up: false, down: false, left: false, right: false,
    action: false, punch: false, shoot: false, pause: false,
    confirm: false, garage: false, radio: false, camLeft: false,
    slot1: false, slot2: false, slot3: false, slot4: false, slot5: false,
    mouseX: 0, mouseY: 0, mouseDown: false,
    dragDX: 0, dragDY: 0,
    pressed: new Set(),
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
  KeyG: 'garage',
  KeyR: 'radio',
  KeyQ: 'camLeft',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5',
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
    const canvas = document.getElementById('game');
    const rect = canvas ? canvas.getBoundingClientRect() : element.getBoundingClientRect();
    const scaleX = canvas ? canvas.width / rect.width : 1;
    const scaleY = canvas ? canvas.height / rect.height : 1;
    const nx = (e.clientX - rect.left) * scaleX;
    const ny = (e.clientY - rect.top) * scaleY;
    if (input.mouseDown) {
      input.dragDX += nx - input.mouseX;
      input.dragDY += ny - input.mouseY;
    }
    input.mouseX = nx;
    input.mouseY = ny;
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
    input.camLeft = false;
    input.action = false;
  });
}

export function wasPressed(input, name) {
  if (input.pressed.has(name)) {
    input.pressed.delete(name);
    return true;
  }
  return false;
}

export function endFrame(input) {
  input.pressed.clear();
  input.dragDX = 0;
  input.dragDY = 0;
}
