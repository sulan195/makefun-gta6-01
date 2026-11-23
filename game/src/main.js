// main.js — bootstrap and game loop for Solmar City.
// Parses ?shot= / ?seed=, builds the world, then runs a fixed-timestep loop:
// update (player, traffic, pedestrians, police, missions, particles) and
// draw (world, HUD, screens). The first frame is drawn synchronously so a
// screenshot taken right after load already shows the game.

import { buildWorld } from './world.js';
import { makeRng, hashSeed } from './util.js';
import { createInput, attachInput, wasPressed, endFrame } from './input.js';
import {
  createPlayer, spawnParkedCars, spawnTraffic, spawnPeds,
  updatePlayer, updateTraffic, updatePeds, updatePolice,
  tryEnterCar, exitCar, meleeAttack, aimAngle,
  updateParticles, updateRoadblock, updateBurning, clearRoadblock,
} from './entities.js';
import {
  createWeaponState, createPickups, fireWeapon, switchWeapon, updatePickups,
} from './weapons.js';
import { createGarageState, nearGarage, garageAction } from './garage.js';
import { updateHelicopter } from './helicopter.js';
import { createRaceState, updateRace } from './races.js';
import {
  createMissionState, startMission, updateMissions, updateEnemies,
  missionTargetPos,
} from './missions.js';
import { drawWorld, updateCamera, createView, VIEW_W, VIEW_H } from './render.js';
import { drawHud, drawScreens } from './hud.js';
import { createAudio, unlockAudio, updateAudio, RADIO_STATIONS } from './audio.js';
import { saveGame, loadSave } from './save.js';
import { applyShot } from './shots.js';

function createGame(seed, shot) {
  const world = buildWorld(seed);
  const rng = makeRng(seed);
  const state = {
    world, rng, seed, shot: shot || null,
    player: createPlayer(520, 470),
    cars: [], peds: [], police: [], enemies: [], particles: [],
    money: 50,
    wanted: 0, wantedTimer: 0,
    weapons: createWeaponState(),
    pickups: createPickups(),
    respect: 0,
    garage: createGarageState(),
    garageMenu: false,
    heli: null,
    roadblock: null, roadblockCooldown: 0, barriers: [], scorches: [],
    race: createRaceState(),
    radioStation: 0,
    clockMinutes: 9 * 60, clockSeconds: 0,
    mode: 'title', // title | play | paused | busted | wasted
    missions: createMissionState(),
    missionsDone: [],
    message: '', messageUntil: 0, dialog: null,
    missionTarget: null,
    busted: false,
    autoDrive: false, // ?shot= scenes keep the car rolling without input
    audio: createAudio(),
    input: createInput(),
    view: createView(),
    savedMissions: 0,
  };
  state.cars = spawnParkedCars(world, rng);
  state.cars.push(...spawnTraffic(world, rng, 16));
  state.peds = spawnPeds(world, rng, 22);
  startMission(state, 0);
  if (shot) applyShot(state, shot);
  state.missionTarget = missionTargetPos(state);
  state.view.camX = state.player.x - VIEW_W / 2;
  state.view.camY = state.player.y - VIEW_H / 2;
  return state;
}

function respawnAtHospital(state) {
  const hospital = state.world.places.hospital;
  const p = state.player;
  if (p.car) {
    p.car.kind = 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.onFoot = true;
  p.x = hospital.x;
  p.y = hospital.y + 40;
  p.health = 100;
  p.armor = 0;
  p.bustedTimer = 0;
  p.invulnerable = 2;
  state.wanted = 0;
  state.police = [];
  clearRoadblock(state);
  state.heli = null;
  state.busted = false;
}

function update(state, dt) {
  state.clockSeconds += dt;
  state.clockMinutes = (state.clockMinutes + dt) % (24 * 60);
  const input = state.input;
  // Pause can be toggled from play and from the pause screen itself.
  if (state.mode === 'paused') {
    if (wasPressed(input, 'pause')) state.mode = 'play';
    return;
  }
  if (state.mode !== 'play') return;

  const p = state.player;
  // Staged screenshot scenes keep the car rolling on their own.
  if (state.autoDrive && p.car) input.up = true;

  // The garage menu pauses the street: number keys buy, G/P closes.
  if (state.garageMenu) {
    for (let n = 1; n <= 5; n++) {
      if (wasPressed(input, 'slot' + n)) {
        const line = garageAction(state, n);
        if (line) {
          state.message = line;
          state.messageUntil = state.clockSeconds + 3;
        }
      }
    }
    if (wasPressed(input, 'garage') || wasPressed(input, 'pause')) {
      state.garageMenu = false;
    }
    return;
  }

  if (wasPressed(input, 'pause')) {
    state.mode = 'paused';
    saveGame(state);
    return;
  }
  // Weapon slots 1-4.
  for (let n = 1; n <= 4; n++) {
    if (wasPressed(input, 'slot' + n)) switchWeapon(state, n);
  }
  // Garage door: G near Bang Udin's opens the menu.
  if (wasPressed(input, 'garage')) {
    if (nearGarage(state)) {
      state.garageMenu = true;
      return;
    }
    state.message = 'Garasi Bang Udin ada di Southside — cari ikon G di minimap.';
    state.messageUntil = state.clockSeconds + 2.5;
  }
  // Car radio: R cycles the stations while driving.
  if (wasPressed(input, 'radio')) {
    if (p.car) {
      state.radioStation = (state.radioStation + 1) % RADIO_STATIONS.length;
      state.message = 'Radio: ' + RADIO_STATIONS[state.radioStation];
      state.messageUntil = state.clockSeconds + 1.5;
    } else {
      state.message = 'Radio hanya menyala di dalam mobil.';
      state.messageUntil = state.clockSeconds + 1.5;
    }
  }
  if (wasPressed(input, 'action')) {
    if (p.onFoot) {
      const res = tryEnterCar(state);
      if (!res.ok && res.reason === 'no-car-nearby') {
        state.message = 'Tidak ada mobil di dekatmu.';
        state.messageUntil = state.clockSeconds + 2;
      }
    } else {
      exitCar(state);
    }
  }
  if (wasPressed(input, 'punch')) meleeAttack(state);
  if (input.shoot && p.onFoot) {
    if (state.weapons.current === 'fist') {
      meleeAttack(state);
    } else {
      fireWeapon(state, aimAngle(state, input, state.view));
    }
  } else if (input.shoot && p.car) {
    // No drive-by shooting: honk instead, like a Solmar local.
    if (wasPressed(input, 'shoot')) {
      state.message = 'Klakson! Pengemudi lain minggir.';
      state.messageUntil = state.clockSeconds + 1.5;
    }
  }

  updatePlayer(state, input, dt);
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateRoadblock(state, dt);
  updateHelicopter(state, dt);
  updateBurning(state, dt);
  updatePickups(state);
  updateMissions(state, dt);
  updateEnemies(state, dt);
  updateRace(state, dt);
  updateParticles(state, dt);

  state.missionTarget = missionTargetPos(state);

  if (state.busted) {
    state.mode = 'busted';
    state.money = Math.max(0, state.money - 100);
    return;
  }
  if (p.health <= 0) {
    state.mode = 'wasted';
    state.money = Math.max(0, state.money - 100);
    return;
  }

  // Autosave when a mission is completed.
  if (state.missionsDone.length > state.savedMissions) {
    state.savedMissions = state.missionsDone.length;
    saveGame(state);
  }

  updateCamera(state.view, p.x, p.y, dt);
  updateAudio(state.audio, dt, p.car ? p.car.speed : 0, state.wanted,
    p.car ? state.radioStation : 0);
}

function render(state) {
  const ctx = state.ctx;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#0a0f16';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawWorld(ctx, state, state.view);
  if (state.mode !== 'title') drawHud(ctx, state, state.view);
  drawScreens(ctx, state, state.view);
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
  window.__solmarReady = true;
}

export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = hashSeed(params.get('seed') || 'solmar-1');
  const state = createGame(seed, shot);
  state.ctx = ctx;
  attachInput(state.input, document.body);
  document.addEventListener('keydown', () => unlockAudio(state.audio), { once: true });
  document.addEventListener('mousedown', () => unlockAudio(state.audio), { once: true });
  window.addEventListener('error', (e) => {
    setStatus('ERROR: ' + (e.message || 'unknown'));
  });

  // Title-screen keys are handled here so the loop stays about play.
  document.addEventListener('keydown', (e) => {
    if (state.mode === 'title' && e.code === 'Enter') {
      state.mode = 'play';
      unlockAudio(state.audio);
      state.message = 'Misi 1: jemput penumpang di Old Town.';
      state.messageUntil = state.clockSeconds + 6;
    }
    if (state.mode === 'title' && e.code === 'KeyC') {
      const save = loadSave();
      if (save) {
        state.money = save.money;
        state.missions.index = save.missionIndex;
        state.missionsDone = [];
        state.player.x = save.playerX;
        state.player.y = save.playerY;
        state.player.health = save.health;
        state.clockMinutes = save.clockMinutes;
        if (typeof save.respect === 'number') state.respect = save.respect;
        if (save.garage) {
          state.garage.engine = save.garage.engine || 0;
          state.garage.armor = save.garage.armor || 0;
        }
        if (save.weapons) {
          state.weapons.owned = save.weapons.owned.slice();
          state.weapons.current = save.weapons.current;
          state.weapons.ammo.smg = save.weapons.ammo.smg || 0;
          state.weapons.ammo.shotgun = save.weapons.ammo.shotgun || 0;
        }
        if (save.raceBest) state.race.best = save.raceBest;
        // Re-arm the saved mission (or its Respect gate) at the new spot.
        startMission(state, save.missionIndex);
        state.mode = 'play';
        state.message = 'Lanjutan dimuat. Selamat datang kembali, Mara.';
        state.messageUntil = state.clockSeconds + 5;
      }
    }
    if ((state.mode === 'busted' || state.mode === 'wasted') && e.code === 'Enter') {
      respawnAtHospital(state);
      state.mode = 'play';
    }
  });

  // First frame immediately: screenshots must not catch a black canvas.
  render(state);
  setStatus('Solmar City ready — mode ' + state.mode + ' shot ' + (shot || 'none'));

  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += elapsed;
    let n = 0;
    while (acc >= STEP && n < 5) {
      update(state, STEP);
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    render(state);
    endFrame(state.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return state;
}

boot();
