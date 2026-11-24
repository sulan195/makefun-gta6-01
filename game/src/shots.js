
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
  state.quality = 'high';
  const p = state.player;
  if (shot === 'start') {
    state.clockMinutes = 10 * 60 + 20;
    return;
  }
  state.mode = 'play';
  state.dialog = null;
  state.message = '';
  state.messageUntil = 0;

  if (shot === 'drive') {
    state.clockMinutes = 10 * 60 + 45;
    putPlayerInCar(state, 1700, 1680, 0, 200, '#c23b2e');
    state.missions.step = 1;
    state.missions.passenger = true;
    state.autoDrive = true;
    const tc = (x, y, a, dir) => makeCar(x, y, a, { kind: 'traffic', driver: true, rng: state.rng, roadAxis: 'h', roadIndex: 5, dir, speed: 120 });
    state.cars.push(tc(2060, 1698, 0, 1), tc(2380, 1662, Math.PI, -1));
    [[2280, 1742], [2410, 1736], [2190, 1744]].forEach(([x, y], i) => {
      state.peds.push({ x, y, angle: i % 2 ? Math.PI : 0, speed: 34, shirt: ['#e07840', '#4d7dc9', '#f0e8d8'][i], flee: 0, down: false, downTimer: 0, axis: 'h', roadPos: y, walkPhase: i * 2, variant: i % 3, scale: [0.95, 1.06, 1.0][i] });
    });
  } else if (shot === 'chase') {
    state.clockMinutes = 11 * 60 + 10;
    state.money = 2450;
    state.respect = 100;
    state.wanted = 5;
    state.weapons.owned = ['fist', 'pistol', 'smg'];
    state.weapons.ammo.smg = 48;
    state.weapons.current = 'smg';
    putPlayerInCar(state, 1000, 840, 0, 230, '#2e6fc2');
    state.missions.index = 7;
    state.missions.step = 2;
    state.missions.active = true;
    state.missions.hasPackage = true;
    const cop = (x, y, a) => makeCar(x, y, a,
      { kind: 'police', driver: true, rng: state.rng });
    state.police.push(cop(1052, 786, 0));
    state.police.push(cop(758, 796, 0.06));
    state.police.push(cop(736, 884, -0.06));
    spawnRoadblock(state);
    state.heli = createHelicopter(state);
    state.heli.x = 1255;
    state.heli.y = 755;
    state.heli.alt = 52;
    state.heli.lightX = p.x;
    state.heli.lightY = p.y;
    state.autoDrive = true;
  } else if (shot === 'mission') {
    state.clockMinutes = 10 * 60 + 35;
    state.money = 750;
    state.respect = 30;
    state.weapons.owned = ['fist', 'pistol', 'smg'];
    state.weapons.ammo.smg = 60;
    state.weapons.current = 'smg';
    startMission(state, 3);
    p.x = 1075;
    p.y = 1468;
    p.angle = Math.atan2(1490 - 1468, 1190 - 1075);
    state.camera.yaw = p.angle;
    state.camera.orbit = 0;
  }
}
