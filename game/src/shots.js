// shots.js — deterministic staged scenes for screenshots. ?shot=start|drive|
// chase|mission with ?seed= sets the game up so the first frame already shows
// the scene, with no input needed. Every placement uses the seeded RNG, so a
// screenshot can be reproduced exactly. The four scenes are the game's shop
// window: golden-hour shore, a coastal drive, a five-star chase with the
// roadblock and the CONDOR helicopter, and a mid-mission firefight setup.

import {
  makeCar, spawnTraffic, spawnPeds, raiseWanted, spawnRoadblock,
} from './entities.js';
import { startMission } from './missions.js';
import { createHelicopter } from './helicopter.js';

function clearTraffic(state) {
  state.cars = state.cars.filter((c) => c.kind === 'parked');
  state.peds = [];
  state.police = [];
  state.enemies = [];
}

function putPlayerInCar(state, x, y, angle, speed) {
  const p = state.player;
  const car = makeCar(x, y, angle, { kind: 'player', color: '#c94f43', speed });
  car.wasParked = false;
  state.cars.push(car);
  p.car = car;
  p.onFoot = false;
  p.x = x;
  p.y = y;
  p.angle = angle;
  p.speed = speed;
}

function giveSmg(state, ammo) {
  if (!state.weapons.owned.includes('smg')) state.weapons.owned.push('smg');
  state.weapons.current = 'smg';
  state.weapons.ammo.smg = ammo;
}

function ringTraffic(state, cx, cy, count) {
  // Traffic cars on the roads near (cx, cy), deterministic from the RNG.
  const near = spawnTraffic(state.world, state.rng, count);
  for (const car of near) {
    car.x = cx + (state.rng() - 0.5) * 900;
    car.y = cy + (state.rng() - 0.5) * 700;
    // Snap onto the nearest road so cars sit on asphalt, not in buildings.
    const vx = [200, 520, 840, 1160, 1480, 1800, 2120, 2360]
      .reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
    const hy = [200, 520, 840, 1160, 1480, 1680]
      .reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    if (Math.abs(vx - car.x) < Math.abs(hy - car.y)) {
      car.x = vx + (car.x > vx ? 18 : -18);
      car.roadAxis = 'v';
      car.angle = car.y > cy ? -Math.PI / 2 : Math.PI / 2;
      car.dir = car.y > cy ? -1 : 1;
    } else {
      car.y = hy + (car.y > hy ? 18 : -18);
      car.roadAxis = 'h';
      car.angle = car.x > cx ? Math.PI : 0;
      car.dir = car.x > cx ? -1 : 1;
    }
    state.cars.push(car);
  }
  const peds = spawnPeds(state.world, state.rng, 14);
  for (const ped of peds) {
    ped.x = cx + (state.rng() - 0.5) * 800;
    ped.y = cy + (state.rng() - 0.5) * 600;
    state.peds.push(ped);
  }
}

export function applyShot(state, name) {
  const p = state.player;
  if (name === 'start') {
    // Title screen over the south shore at golden hour: palms, sand, sea.
    state.mode = 'title';
    state.clockMinutes = 17 * 60 + 15;
    p.x = 1960; p.y = 1440; p.onFoot = true;
    clearTraffic(state);
    ringTraffic(state, 1960, 1440, 7);
    state.view.camX = 1960 - 640;
    state.view.camY = 1440 - 400;
    return;
  }

  if (name === 'drive') {
    // Mara driving the coast road east at golden hour, passenger aboard
    // (mission 1, second step), beach and palms along the south edge.
    state.mode = 'play';
    state.clockMinutes = 17 * 60 + 5;
    clearTraffic(state);
    putPlayerInCar(state, 1700, 1680, 0, 200);
    state.autoDrive = true;
    ringTraffic(state, 1700, 1680, 8);
    startMission(state, 0);
    state.missions.step = 1; // passenger aboard, heading for the Marina
    state.missions.passenger = true;
    state.message = 'Penumpang: "Lihat pantainya… ke Marina West, cepat!"';
    state.messageUntil = state.clockSeconds + 30;
    state.view.camX = 1700 - 640;
    state.view.camY = 1120; // lowest camera: keeps the shore in frame
    return;
  }

  if (name === 'chase') {
    // Five stars, the bank job's getaway (mission 8, final step): patrol
    // cars behind, a roadblock across the road ahead, and the CONDOR
    // helicopter's searchlight locked on Mara. Everything at once.
    state.mode = 'play';
    state.clockMinutes = 16 * 60 + 45;
    clearTraffic(state);
    putPlayerInCar(state, 1160, 840, 0, 270);
    state.autoDrive = true;
    ringTraffic(state, 1160, 840, 3);
    state.money = 2450;
    state.respect = 100;
    giveSmg(state, 48);
    raiseWanted(state, 5);
    for (let i = 0; i < 3; i++) {
      state.police.push(makeCar(
        1160 - 130 - i * 75, 840 + (i % 2 === 0 ? 26 : -26),
        0, { kind: 'police', speed: 260 },
      ));
    }
    spawnRoadblock(state);
    state.heli = createHelicopter(state);
    state.heli.x = 1160 - 150;
    state.heli.y = 840 - 185;
    state.heli.lightX = 1160;
    state.heli.lightY = 840;
    startMission(state, 7);
    state.missions.step = 2; // getaway: reach the garage safehouse
    state.missions.hasPackage = true;
    state.message = 'Polisi mengejarmu! Hilang ke Garasi Bang Udin!';
    state.messageUntil = state.clockSeconds + 30;
    state.view.camX = 1160 - 640;
    state.view.camY = 840 - 400;
    return;
  }

  if (name === 'mission') {
    // Mission 4, the destroy step: Mara on foot in Southside, SMG in hand,
    // the Sanca crew's car marked ahead and its guards watching it. Dax's
    // briefing is still on screen.
    state.mode = 'play';
    state.clockMinutes = 15 * 60 + 30;
    clearTraffic(state);
    state.respect = 30;
    giveSmg(state, 60);
    p.x = 1100; p.y = 1430; p.onFoot = true; p.angle = 0.59;
    startMission(state, 3);
    state.missions.step = 1; // destroy the crew car
    ringTraffic(state, 1160, 1480, 4);
    state.view.camX = 1100 - 640;
    state.view.camY = 1430 - 400;
    return;
  }

  // Unknown ?shot=: plain play mode.
  state.mode = 'play';
}
