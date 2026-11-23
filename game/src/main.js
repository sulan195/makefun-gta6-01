// main.js — bootstrap and game loop for Solmar City 3D.
// Parses ?shot= / ?seed=, builds the world and the renderer, then runs a
// fixed-timestep simulation: player, traffic, pedestrians, police, the
// helicopter, missions, the race, particles and burning cars — followed by
// the WebGL render and the DOM HUD. The first frame is drawn synchronously
// so a screenshot taken right after load already shows the game.

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
import { createAudio, unlockAudio, updateAudio, RADIO_STATIONS } from './audio.js';
import { loadSave, saveGame, hasSave } from './save.js';
import { updateParticles, updateBurning } from './effects.js';
import { createRenderer, drawScene } from './render.js';
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
    clockMinutes: 16 * 60 + 40,
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
  };
  state.cars = [...spawnParkedCars(world, rng), ...spawnTraffic(world, rng, 10)];
  state.peds = spawnPeds(world, rng, 26);
  startMission(state, 0);
  return state;
}

function loadInto(state) {
  const s = loadSave();
  if (!s) return false;
  state.money = s.money;
  state.respect = s.respect || 0;
  state.missionsDone = s.missionsDone || [];
  if (s.weapons) state.weapons = s.weapons;
  if (s.garage) state.garage = { engine: s.garage.engine || 0, armor: s.garage.armor || 0 };
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
  state.mode = 'play';
  state.dialog = null;
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

// One-shot key actions, handled once per animation frame (not per step).
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
    if (wasPressed(input, 'confirm')) startPlay(state, false);
    else if (continuePressed && hasSave()) startPlay(state, true);
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

  // Combat: held fire (the SMG loves it); F or a fist slot throws a punch.
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

// ------------------------------------------------------------- bootstrap ----

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
canvas.addEventListener('pointerdown', () => {
  if (state.mode === 'title') startPlay(state, false);
});

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
  'Solmar City ready — mode ' + state.mode + ' shot ' + (shot || 'none');
window.__solmarReady = true;

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
