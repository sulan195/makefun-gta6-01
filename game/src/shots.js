// shots.js — deterministic staged scenes for screenshots. ?shot=start|drive|
// chase|mission with ?seed= sets the game up so the first frame already shows
// the scene, with no input needed. Every placement uses the seeded RNG, so a
// screenshot can be reproduced exactly.

import { makeCar, spawnTraffic, spawnPeds, raiseWanted } from './entities.js';
import { startMission } from './missions.js';

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
    // Title screen over downtown at golden hour.
    state.mode = 'title';
    state.clockMinutes = 17 * 60 + 20;
    p.x = 1480; p.y = 840; p.onFoot = true;
    clearTraffic(state);
    ringTraffic(state, 1480, 840, 7);
    state.view.camX = 1480 - 640;
    state.view.camY = 840 - 400;
    return;
  }

  if (name === 'drive') {
    // Mara driving through busy downtown traffic, mission 1 live, minimap on.
    state.mode = 'play';
    state.clockMinutes = 10 * 60;
    clearTraffic(state);
    putPlayerInCar(state, 1480, 1000, Math.PI / 2, 190);
    state.autoDrive = true;
    ringTraffic(state, 1480, 1000, 9);
    startMission(state, 0);
    state.missions.step = 1; // passenger aboard, heading for the Marina
    state.missions.passenger = true;
    state.message = 'Penumpang: "Ke Marina West, cepat!"';
    state.messageUntil = state.clockSeconds + 30;
    state.view.camX = 1480 - 640;
    state.view.camY = 1000 - 400;
    return;
  }

  if (name === 'chase') {
    // Three-star chase: Mara just stole the sedan (mission 2, escape step),
    // police on her tail, sirens, brake lights.
    state.mode = 'play';
    state.clockMinutes = 16 * 60 + 30;
    clearTraffic(state);
    putPlayerInCar(state, 1160, 840, 0, 270);
    state.autoDrive = true;
    ringTraffic(state, 1160, 840, 6);
    raiseWanted(state, 3);
    for (let i = 0; i < 4; i++) {
      state.police.push(makeCar(
        1160 - 120 - i * 70, 840 + (i % 2 === 0 ? 24 : -24),
        0, { kind: 'police', speed: 260 },
      ));
    }
    startMission(state, 1);
    state.missions.step = 2; // escape step: lose the cops
    state.missions.targetCar = state.player.car;
    state.message = 'Polisi mengejarmu! Kabur!';
    state.messageUntil = state.clockSeconds + 30;
    state.view.camX = 1160 - 640;
    state.view.camY = 840 - 400;
    return;
  }

  if (name === 'mission') {
    // Mission 2 in progress: steal the grey sedan at the Harbour Yard.
    state.mode = 'play';
    state.clockMinutes = 12 * 60;
    clearTraffic(state);
    p.x = 2060; p.y = 1620; p.onFoot = true; p.angle = 0.4;
    startMission(state, 1);
    ringTraffic(state, 2120, 1680, 4);
    state.message = 'Dax: "Sedan abu-abu itu. Ambil, lalu hilang."';
    state.messageUntil = state.clockSeconds + 30;
    state.view.camX = 2060 - 640;
    state.view.camY = 1620 - 400;
    return;
  }

  // Unknown ?shot=: plain play mode.
  state.mode = 'play';
}
