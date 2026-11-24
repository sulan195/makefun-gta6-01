
import { clamp, pick, range, makeRng } from './util.js';
import { V_ROADS, H_ROADS, WORLD_W, WORLD_H } from './world.js';
import { playThud } from './audio.js';
import { carMaxSpeed, carAccel, carDamageFactor } from './garage.js';
import { collideWithBuildings, clampToWorld } from './entities.js';
import { collideBarriers } from './police.js';
import { spawnDust, spawnSparks } from './effects.js';
import { damagePlayer } from './player.js';

export const CAR_W = 46;
export const CAR_H = 24;
const CAR_BRAKE = 420;

const CAR_COLORS = ['#c94f43', '#3f6fb5', '#d8a03c', '#4d8a5f', '#8a5fb0', '#b8bcc0', '#e0e0d8', '#5f8a8a'];

export function makeCar(x, y, angle, opts = {}) {
  const rng = opts.rng || makeRng(7);
  return {
    x, y, angle, speed: opts.speed || 0,
    color: opts.color || pick(rng, CAR_COLORS),
    kind: opts.kind || 'traffic',
    vtype: opts.vtype || 'car',
    driver: opts.driver !== undefined ? opts.driver : true,
    hp: 100, braking: false, smoke: 0,
    burning: 0, exploded: false, warnedLow: false,
    roadAxis: opts.roadAxis || null, roadIndex: opts.roadIndex ?? null,
    dir: opts.dir || 1, targetSpeed: opts.targetSpeed || 110,
    sirenPhase: rng() * 6,
  };
}

export function spawnParkedCars(world, rng) {
  const cars = [];
  let i = 0;
  for (const spot of world.parkedSpots) {
    i += 1;
    cars.push(makeCar(spot.x, spot.y, spot.angle, {
      kind: 'parked', driver: false, rng, speed: 0,
      vtype: i % 9 === 7 ? 'truck' : i % 6 === 4 ? 'moto' : 'car',
    }));
  }
  return cars;
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const idx = Math.floor(rng() * V_ROADS.length);
      const lane = rng() < 0.5 ? -18 : 18;
      cars.push(makeCar(V_ROADS[idx] + lane, range(rng, 100, WORLD_H - 100),
        lane > 0 ? Math.PI / 2 : -Math.PI / 2, {
          kind: 'traffic', rng, roadAxis: 'v', roadIndex: idx,
          dir: lane > 0 ? 1 : -1, targetSpeed: range(rng, 85, 135),
          vtype: rng() < 0.22 ? 'truck' : rng() < 0.14 ? 'moto' : 'car',
        }));
    } else {
      const idx = Math.floor(rng() * H_ROADS.length);
      const lane = rng() < 0.5 ? -18 : 18;
      cars.push(makeCar(range(rng, 100, WORLD_W - 100), H_ROADS[idx] + lane,
        lane > 0 ? 0 : Math.PI, {
          kind: 'traffic', rng, roadAxis: 'h', roadIndex: idx,
          dir: lane > 0 ? 1 : -1, targetSpeed: range(rng, 85, 135),
          vtype: rng() < 0.22 ? 'truck' : rng() < 0.14 ? 'moto' : 'car',
        }));
    }
  }
  return cars;
}

export function lightIsGreenFor(world, axis, clockSeconds) {
  const phase = Math.floor(clockSeconds / 8) % 2;
  return (axis === 'v') === (phase === 0);
}

export function updateTraffic(state, dt) {
  const clock = state.clockSeconds;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    let target = car.targetSpeed;
    const axisRoads = car.roadAxis === 'v' ? H_ROADS : V_ROADS;
    const pos = car.roadAxis === 'v' ? car.y : car.x;
    for (const cross of axisRoads) {
      const d = (cross - pos) * car.dir;
      if (d > 0 && d < 70 && !lightIsGreenFor(state.world, car.roadAxis, clock)) {
        target = 0;
        car.braking = true;
        break;
      }
    }
    for (const other of state.cars) {
      if (other === car || other.kind === 'parked') continue;
      if (other.roadAxis !== car.roadAxis || other.roadIndex !== car.roadIndex) continue;
      if (Math.sign(other.dir) !== Math.sign(car.dir)) continue;
      const along = car.roadAxis === 'v'
        ? (other.y - car.y) * car.dir
        : (other.x - car.x) * car.dir;
      const lateral = car.roadAxis === 'v'
        ? Math.abs(other.x - car.x)
        : Math.abs(other.y - car.y);
      if (along > 0 && along < 64 && lateral < 30) { target = Math.min(target, 0); }
    }
    if (car.speed < target) car.speed = Math.min(target, car.speed + 130 * dt);
    else if (car.speed > target) car.speed = Math.max(target, car.speed - 320 * dt);
    car.braking = target === 0 && car.speed > 10;
    if (car.roadAxis === 'v') car.y += car.speed * car.dir * dt;
    else car.x += car.speed * car.dir * dt;
    if (car.roadAxis === 'v') {
      if (car.y > WORLD_H + 40) car.y = -40;
      if (car.y < -40) car.y = WORLD_H + 40;
    } else {
      if (car.x > WORLD_W + 40) car.x = -40;
      if (car.x < -40) car.x = WORLD_W + 40;
    }
    const pc = state.player.car;
    if (pc && Math.abs(car.x - pc.x) < 52 && Math.abs(car.y - pc.y) < 52
      && Math.hypot(car.x - pc.x, car.y - pc.y) < 52 && Math.abs(car.speed) > 5) {
      car.speed *= 0.5;
    }
  }
}

export function updatePlayerDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car || car.hp <= 0) {
    if (car) car.speed = 0;
    return;
  }
  const rng = state.rng;
  const maxSpeed = carMaxSpeed(state);
  const accel = carAccel(state);
  const forward = input.up ? 1 : input.down ? -0.6 : 0;
  if (forward > 0) car.speed += accel * dt;
  else if (forward < 0) car.speed -= CAR_BRAKE * 0.6 * dt;
  else car.speed -= Math.sign(car.speed) * 90 * dt;
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  car.speed = clamp(car.speed, -120, maxSpeed);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (Math.abs(car.speed) > 5) {
    car.angle += steer * 2.1 * dt * Math.sign(car.speed)
      * clamp(Math.abs(car.speed) / 120, 0.35, 1);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.braking = input.down && car.speed > 40;
  if (collideWithBuildings(car, 22, state.world)) {
    if (Math.abs(car.speed) > 160) {
      car.hp -= 12 * carDamageFactor(state);
      damagePlayer(state, 4);
      playThud(state.audio);
      spawnSparks(state, car.x, car.y, 10, 8);
    }
    car.speed *= 0.4;
  }
  if (collideBarriers(state, car, 22)) car.speed *= 0.35;
  clampToWorld(car);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (Math.abs(car.speed) > 200 && rng() < 0.3) {
    spawnDust(state, car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22);
  }
  if (car.hp <= 30 && car.hp > 0 && !car.warnedLow) {
    car.warnedLow = true;
    state.message = 'Your car is smoking badly! Get out before it burns!';
    state.messageUntil = state.clockSeconds + 3;
  }
  if (car.hp <= 0 && car.smoke === 0) {
    car.smoke = 1;
    state.message = 'Your car is wrecked! Press E to get out.';
    state.messageUntil = state.clockSeconds + 3;
  }
}
