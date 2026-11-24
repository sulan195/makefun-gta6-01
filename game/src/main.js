
import { buildWorld } from './world.js';
import { makeRng } from './util.js';
import { createInput, attachInput, wasPressed, endFrame } from './input.js';
import {
  createPlayer, createCamera, updateCamera, updatePlayer,
  tryEnterCar, exitCar, meleeAttack,
} from './player.js';
import { spawnParkedCars, spawnTraffic, updateTraffic } from './cars.js';
import { spawnPeds, updatePeds } from './entities.js';
import { updatePolice, updateRoadblock } from './police.js';
import { updateHelicopter } from './helicopter.js';
import {
  createWeaponState, switchWeapon, fireWeapon, createPickups, updatePickups,
} from './combat.js';
import {
  createMissionState, startMission, startFare, updateMissions, updateEnemies,
} from './missions.js';
import { createRaceState, updateRace } from './races.js';
import { createGarageState, garageAction, nearGarage } from './garage.js';
import { createAudio, unlockAudio, updateAudio, setVolume, RADIO_STATIONS } from './audio.js';
import { loadSave, saveGame, slotSummary } from './save.js';
import { updateParticles, updateBurning } from './effects.js';
import { createRenderer, drawScene, rebuildPlayer } from './render.js';
import { createHud, updateHud } from './hud.js';
import { applyShot } from './shots.js';

const STEP = 1 / 60;

export function createGame(seed) {
  const world = buildWorld(seed);
  const rng = makeRng(seed);
  const state = {
    world,
    rng,
    input: createInput(),
    mode: 'title',
    clockSeconds: 0,
    clockMinutes: 10 * 60 + 30,
    player: createPlayer(340, 330),
    camera: createCamera(),
    cars: [],
    police: [],
    peds: [],
    enemies: [],
    particles: [],
    tracers: [],
    scorches: [],
    barriers: [],
    roadblock: null,
    roadblockCooldown: 0,
    heli: null,
    wanted: 0,
    wantedTimer: 0,
    hideTimer: 0,
    money: 50,
    respect: 0,
    garage: createGarageState(),
    weapons: createWeaponState(),
    pickups: createPickups(),
    missions: createMissionState(),
    missionsDone: [],
    race: createRaceState(),
    audio: createAudio(),
    radioStation: 0,
    message: '',
    messageUntil: 0,
    dialog: null,
    garageOpen: false,
    garageMessage: '',
    autoDrive: false,
    shot: null,
    slot: 0,
    difficulty: 1,
    custom: null,
    quality: 'high',
  };
  applyDifficulty(state);
  state.cars = [...spawnParkedCars(world, rng), ...spawnTraffic(world, rng, 10)];
  state.peds = spawnPeds(world, rng, 26);
  startMission(state, 0);
  return state;
}

const DIFFS = [
  { dmg: 0.6, pay: 1.25, cop: 0.88 },
  { dmg: 1, pay: 1, cop: 1 },
  { dmg: 1.5, pay: 0.8, cop: 1.15 },
];

export function applyDifficulty(state) {
  const d = DIFFS[state.difficulty] || DIFFS[1];
  state.diffDmg = d.dmg;
  state.diffPay = d.pay;
  state.diffCop = d.cop;
}

function loadInto(state) {
  const s = loadSave(state.slot);
  if (!s) return false;
  state.money = s.money;
  state.respect = s.respect || 0;
  state.missionsDone = s.missionsDone || [];
  if (s.weapons) state.weapons = s.weapons;
  if (s.garage) state.garage = { engine: s.garage.engine || 0, armor: s.garage.armor || 0 };
  state.difficulty = s.difficulty ?? 1;
  state.custom = s.custom || null;
  applyDifficulty(state);
  if (typeof s.clockMinutes === 'number') state.clockMinutes = s.clockMinutes;
  if (typeof s.raceBest === 'number') state.race.best = s.raceBest;
  state.player.x = s.playerX || state.player.x;
  state.player.y = s.playerY || state.player.y;
  state.player.health = s.health || 100;
  const idx = Math.min(s.missionIndex || 0, 8);
  state.missions = createMissionState();
  if (idx < 8) startMission(state, idx);
  else { state.missions.index = 8; startFare(state); }
  return true;
}

function startPlay(state, cont) {
  if (cont) loadInto(state);
  if (renderer) rebuildPlayer(renderer, state.custom);
  state.mode = 'play';
  state.dialog = null;
}

const menuCtx = { flow: 'new', slot: 0, armed: -1, diff: 1,
  custom: { skin: '#d9a066', hair: '#241a12', style: 0 } };
const MENU_PANES = ['main', 'slots', 'custom', 'diff', 'options', 'help'];

function showPane(name) {
  for (const p of MENU_PANES) {
    const el = document.getElementById('menu-' + p);
    if (el) el.style.display = p === name ? '' : 'none';
  }
  const f = document.querySelector('#menu-' + name + ' button');
  if (f) f.focus();
}

function openMenuFlow(state, flow) {
  menuCtx.flow = flow;
  menuCtx.armed = -1;
  renderSlots(state);
  showPane('slots');
}

function renderSlots(state) {
  const box = document.getElementById('slots');
  box.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = slotSummary(i);
    const b = document.createElement('button');
    b.textContent = 'SLOT ' + (i + 1) + (s
      ? ' — $' + s.money + ' · Respect ' + s.respect + ' · Mission ' + (s.missionIndex + 1)
      : ' — EMPTY');
    b.addEventListener('click', () => pickSlot(state, i, s));
    box.appendChild(b);
  }
}

function pickSlot(state, i, s) {
  if (menuCtx.flow === 'continue') {
    if (!s) return;
    state.slot = i;
    startPlay(state, true);
    showPane('main');
    return;
  }
  if (s && menuCtx.armed !== i) {
    menuCtx.armed = i;
    renderSlots(state);
    document.getElementById('slots').children[i].textContent =
      'OVERWRITE SLOT ' + (i + 1) + '? CLICK AGAIN';
    return;
  }
  menuCtx.slot = i;
  showPane('custom');
}

function startFromMenu(state) {
  state.slot = menuCtx.slot;
  state.custom = { ...menuCtx.custom };
  state.difficulty = menuCtx.diff;
  applyDifficulty(state);
  startPlay(state, false);
  showPane('main');
}

function respawn(state) {
  const p = state.player;
  state.police = [];
  state.barriers = [];
  state.roadblock = null;
  state.heli = null;
  state.wanted = 0;
  state.wantedTimer = 0;
  p.car = null;
  p.onFoot = true;
  p.bustedTimer = 0;
  if (state.mode === 'busted') {
    const fine = Math.floor(state.money * 0.1);
    state.money -= fine;
    const st = state.world.places.downtown;
    p.x = st.x; p.y = st.y + 40;
    state.message = 'Busted! The police took $' + fine + ' as a fine and dropped you Downtown.';
  } else {
    const h = state.world.places.hospital;
    p.x = h.x; p.y = h.y + 40;
    p.health = 100;
    p.armor = 0;
    state.message = 'You woke up at Solmar Hospital.';
  }
  state.messageUntil = state.clockSeconds + 4;
  state.mode = 'play';
}

let continuePressed = false;

function handleKeys(state) {
  const input = state.input;
  const mode = state.mode;
  if (state.garageOpen) {
    if (wasPressed(input, 'pause') || wasPressed(input, 'garage')
      || wasPressed(input, 'action')) {
      state.garageOpen = false;
      state.garageMessage = '';
    } else {
      for (let n = 1; n <= 5; n++) {
        if (wasPressed(input, 'slot' + n)) {
          state.garageMessage = garageAction(state, n) || '';
          break;
        }
      }
    }
    return;
  }
  if (mode === 'title') {
    let ae = document.activeElement;
    const dir = wasPressed(input, 'down') ? 1 : wasPressed(input, 'up') ? -1 : 0;
    if (dir && (!ae || ae.tagName !== 'INPUT')) {
      const bs = [...document.querySelectorAll('#title button')]
        .filter((b) => b.getClientRects().length);
      if (bs.length) {
        let i = bs.indexOf(ae);
        i = i < 0 ? 0 : (i + dir + bs.length) % bs.length;
        bs[i].focus();
      }
    }
    ae = document.activeElement;
    if ((!ae || ae.tagName !== 'BUTTON') && wasPressed(input, 'confirm')) {
      openMenuFlow(state, 'new');
    } else if (continuePressed) openMenuFlow(state, 'continue');
    continuePressed = false;
    return;
  }
  if (mode === 'busted' || mode === 'wasted') {
    if (wasPressed(input, 'confirm')) respawn(state);
    return;
  }
  if (mode === 'pause') {
    if (wasPressed(input, 'pause')) state.mode = 'play';
    return;
  }
  if (mode !== 'play') return;

  if (wasPressed(input, 'pause')) {
    state.mode = 'pause';
    saveGame(state);
    return;
  }
  const p = state.player;
  if (wasPressed(input, 'action')) {
    if (p.onFoot && nearGarage(state)) {
      state.garageOpen = true;
      state.garageMessage = '';
    } else if (p.onFoot) {
      tryEnterCar(state);
    } else {
      exitCar(state);
    }
  }
  if (wasPressed(input, 'garage') && nearGarage(state)) {
    state.garageOpen = true;
    state.garageMessage = '';
  }
  if (wasPressed(input, 'radio') && p.car) {
    state.radioStation = (state.radioStation + 1) % 3;
    state.message = 'Radio: ' + RADIO_STATIONS[state.radioStation];
    state.messageUntil = state.clockSeconds + 1.5;
  }
  for (let n = 1; n <= 4; n++) {
    if (wasPressed(input, 'slot' + n)) { switchWeapon(state, n); break; }
  }
}

function update(state, dt) {
  if (state.mode !== 'play' || state.garageOpen) {
    state.clockSeconds += dt;
    return;
  }
  const input = state.input;
  const p = state.player;
  state.clockSeconds += dt;
  state.clockMinutes = (state.clockMinutes + dt * 0.5) % 1440;

  if (state.autoDrive) input.up = true;
  updatePlayer(state, input, dt);

  if (p.onFoot && (input.shoot || input.punch)) {
    p.angle = state.camera.yaw + state.camera.orbit;
    if (input.punch || state.weapons.current === 'fist') meleeAttack(state);
    else fireWeapon(state, p.angle);
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateRoadblock(state, dt);
  updateHelicopter(state, dt);
  updateEnemies(state, dt);
  updateMissions(state, dt);
  updateRace(state, dt);
  updatePickups(state);
  updateParticles(state, dt);
  updateBurning(state, dt);
  updateAudio(state.audio, dt, p.car ? p.car.speed : 0,
    state.wanted, p.car ? state.radioStation : 0);
  updateCamera(state, dt);

  if (p.bustedTimer >= 2) state.mode = 'busted';
  else if (p.health <= 0) state.mode = 'wasted';
}

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
const state = createGame(seed);
state.shot = shot;
if (shot) applyShot(state, shot);

const renderer = createRenderer(canvas, state.world);
const hud = createHud(state.world);
attachInput(state.input, window);
addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') continuePressed = true;
  unlockAudio(state.audio);
});
addEventListener('pointerdown', () => unlockAudio(state.audio));

if (renderer) window.__solmarGL = true;
window.__solmarState = state;

function frame() {
  handleKeys(state);
  update(state, STEP);
  if (renderer) drawScene(renderer, state);
  updateHud(hud, state);
  endFrame(state.input);
}
frame();
document.getElementById('status').textContent =
  'SOLMAR HEAT ready — mode ' + state.mode + ' shot ' + (shot || 'none');
window.__solmarReady = true;

function markPicked(sel, btn) {
  document.querySelectorAll(sel).forEach((b) => b.classList.toggle('picked', b === btn));
}
document.querySelectorAll('#menu-main button').forEach((b) => {
  b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (act === 'new') openMenuFlow(state, 'new');
    else if (act === 'continue') openMenuFlow(state, 'continue');
    else if (act === 'options') showPane('options');
    else if (act === 'help') showPane('help');
    else if (act === 'exit') {
      document.getElementById('title').style.display = 'none';
      document.getElementById('exited').style.display = '';
    }
  });
});
document.querySelectorAll('[data-back]').forEach((b) =>
  b.addEventListener('click', () => showPane('main')));
document.querySelectorAll('[data-style]').forEach((b) =>
  b.addEventListener('click', () => {
    menuCtx.custom.style = Number(b.dataset.style);
    markPicked('[data-style]', b);
  }));
document.querySelectorAll('[data-skin]').forEach((b) =>
  b.addEventListener('click', () => {
    menuCtx.custom.skin = b.dataset.skin;
    markPicked('[data-skin]', b);
  }));
document.querySelectorAll('[data-hair]').forEach((b) =>
  b.addEventListener('click', () => {
    menuCtx.custom.hair = b.dataset.hair;
    markPicked('[data-hair]', b);
  }));
document.getElementById('custom-next').addEventListener('click', () => showPane('diff'));
document.querySelectorAll('[data-diff]').forEach((b) =>
  b.addEventListener('click', () => {
    menuCtx.diff = Number(b.dataset.diff);
    markPicked('[data-diff]', b);
  }));
document.getElementById('diff-start').addEventListener('click', () => startFromMenu(state));
document.getElementById('vol').addEventListener('input', (e) =>
  setVolume(state.audio, Number(e.target.value) / 100));
document.querySelectorAll('[data-q]').forEach((b) =>
  b.addEventListener('click', () => {
    state.quality = b.dataset.q;
    markPicked('[data-q]', b);
  }));

let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  handleKeys(state);
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    update(state, STEP);
    acc -= STEP;
    steps += 1;
  }
  if (steps === 5) acc = 0;
  if (renderer) drawScene(renderer, state);
  updateHud(hud, state);
  endFrame(state.input);
}
requestAnimationFrame(loop);
