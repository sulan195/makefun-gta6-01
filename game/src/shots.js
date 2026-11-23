// shots.js — deterministic staged scenes for the screenshots.
// ?shot=start|drive|chase|mission with ?seed= sets the game up so the
// first frames already show the scene, with no input needed: the shore
// from the air, a coastal drive, a five-star chase, a mission standoff.

import { makeCar } from './cars.js';
import { createHelicopter } from './helicopter.js';
import { spawnRoadblock } from './police.js';
import { startMission } from './missions.js';

function putPlayerInCar(state, x, y, angle, speed, color) {
  const car = makeCar(x, y, angle, {
    kind: 'player', driver: true, color, rng: state.rng,
  });
  car.speed = speed;
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  state.camera.yaw = angle;
  state.camera.orbit = 0;
  return car;
}

export function applyShot(state, shot) {
  const p = state.player;
  if (shot === 'start') {
    // Title screen over the shore at golden hour (render.js flies the
    // cinematic camera while mode is 'title').
    state.clockMinutes = 17 * 60 + 50;
    return;
  }
  state.mode = 'play';
  state.dialog = null;
  state.message = '';
  state.messageUntil = 0;

  if (shot === 'drive') {
    state.clockMinutes = 17 * 60 + 45;
    putPlayerInCar(state, 1700, 1680, 0, 200, '#c23b2e');
    // Mission 1, step 2: the passenger is aboard, heading for the Marina.
    state.missions.step = 1;
    state.missions.passenger = true;
    state.autoDrive = true;
    // Staged coast life: traffic ahead and strollers on the boardwalk.
    const tc = (x, y, a, dir) => makeCar(x, y, a, { kind: 'traffic', driver: true, rng: state.rng, roadAxis: 'h', roadIndex: 5, dir, speed: 120 });
    state.cars.push(tc(2060, 1698, 0, 1), tc(2380, 1662, Math.PI, -1));
    [[2280, 1742], [2410, 1736], [2190, 1744]].forEach(([x, y], i) => {
      state.peds.push({ x, y, angle: i % 2 ? Math.PI : 0, speed: 34, shirt: ['#e07840', '#4d7dc9', '#f0e8d8'][i], flee: 0, down: false, downTimer: 0, axis: 'h', roadPos: y, walkPhase: i * 2 });
    });
  } else if (shot === 'chase') {
    state.clockMinutes = 18 * 60;
    state.money = 2450;
    state.respect = 100;
    state.wanted = 5;
    state.weapons.owned = ['fist', 'pistol', 'smg'];
    state.weapons.ammo.smg = 48;
    state.weapons.current = 'smg';
    putPlayerInCar(state, 1000, 840, 0, 230, '#2e6fc2');
    // Mission 8, final step: the getaway to Udin's Garage.
    state.missions.index = 7;
    state.missions.step = 2;
    state.missions.active = true;
    state.missions.hasPackage = true;
    const cop = (x, y, a) => makeCar(x, y, a,
      { kind: 'police', driver: true, rng: state.rng });
    state.police.push(cop(1052, 786, 0)); // alongside, in frame
    state.police.push(cop(758, 796, 0.06)); // in pursuit behind
    state.police.push(cop(736, 884, -0.06));
    spawnRoadblock(state);
    state.heli = createHelicopter(state);
    state.heli.x = 1265;
    state.heli.y = 648;
    state.heli.lightX = p.x;
    state.heli.lightY = p.y;
    state.autoDrive = true;
  } else if (shot === 'mission') {
    state.clockMinutes = 17 * 60 + 30;
    state.money = 750;
    state.respect = 30;
    state.weapons.owned = ['fist', 'pistol', 'smg'];
    state.weapons.ammo.smg = 60;
    state.weapons.current = 'smg';
    startMission(state, 3); // Mission 4 — Payback: target car + 2 guards
    p.x = 1075;
    p.y = 1468;
    p.angle = Math.atan2(1490 - 1468, 1190 - 1075);
    state.camera.yaw = p.angle;
    state.camera.orbit = 0;
  }
}
