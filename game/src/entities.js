// entities.js — everyone who moves in Solmar City: Mara Voss on foot and in a
// car, pedestrians, traffic, police, and the armed crew rivals. Pure helpers
// (wanted maths, damage, mission hooks) are exported for the Node test suite.

import {
  clamp, dist, angleDelta, pick, range, circleHitsBox, pushCircleOutOfBox,
} from './util.js';
import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, ROAD_W, isOnRoad } from './world.js';
import { playGunshot, playThud } from './audio.js';

export const PLAYER_R = 14;
export const CAR_W = 46;
export const CAR_H = 24;
const FOOT_SPEED = 175;
const CAR_MAX_SPEED = 330;
const CAR_ACCEL = 260;
const CAR_BRAKE = 420;
const POLICE_MAX_SPEED = 285;

const CAR_COLORS = ['#c94f43', '#3f6fb5', '#d8a03c', '#4d8a5f', '#8a5fb0', '#b8bcc0', '#e0e0d8', '#5f8a8a'];
const PED_SHIRTS = ['#e07840', '#4d7dc9', '#e0c040', '#7dbb6a', '#c95f8a', '#f0e8d8', '#6a5f9e'];

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    health: 100, armor: 0,
    fireCooldown: 0, punchCooldown: 0, punchAnim: 0,
    bustedTimer: 0, invulnerable: 0,
  };
}

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: opts.speed || 0,
    color: opts.color || pick(opts.rng || Math.random, CAR_COLORS),
    kind: opts.kind || 'traffic', // traffic | parked | player | police
    driver: opts.driver !== undefined ? opts.driver : true,
    hp: 100, braking: false, smoke: 0,
    // Traffic only:
    roadAxis: opts.roadAxis || null, roadIndex: opts.roadIndex ?? null,
    dir: opts.dir || 1, targetSpeed: opts.targetSpeed || 110,
    // Police only:
    sirenPhase: Math.random() * 6,
  };
}

export function spawnParkedCars(world, rng) {
  const cars = [];
  for (const spot of world.parkedSpots) {
    cars.push(makeCar(spot.x, spot.y, spot.angle, {
      kind: 'parked', driver: false, rng, speed: 0,
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
        }));
    } else {
      const idx = Math.floor(rng() * H_ROADS.length);
      const lane = rng() < 0.5 ? -18 : 18;
      cars.push(makeCar(range(rng, 100, WORLD_W - 100), H_ROADS[idx] + lane,
        lane > 0 ? 0 : Math.PI, {
          kind: 'traffic', rng, roadAxis: 'h', roadIndex: idx,
          dir: lane > 0 ? 1 : -1, targetSpeed: range(rng, 85, 135),
        }));
    }
  }
  return cars;
}

export function spawnPeds(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    let x; let y;
    if (vertical) {
      const rx = V_ROADS[Math.floor(rng() * V_ROADS.length)];
      x = rx + (rng() < 0.5 ? -ROAD_W / 2 - 9 : ROAD_W / 2 + 9);
      y = range(rng, 120, WORLD_H - 120);
    } else {
      const ry = H_ROADS[Math.floor(rng() * H_ROADS.length)];
      x = range(rng, 120, WORLD_W - 120);
      y = ry + (rng() < 0.5 ? -ROAD_W / 2 - 9 : ROAD_W / 2 + 9);
    }
    peds.push({
      x, y, angle: rng() * Math.PI * 2, speed: range(rng, 28, 55),
      shirt: pick(rng, PED_SHIRTS), walking: true, flee: 0,
      down: false, downTimer: 0, axis: vertical ? 'v' : 'h',
      roadPos: vertical ? x : y,
    });
  }
  return peds;
}

export function makeEnemy(x, y, rng) {
  return {
    x, y, angle: 0, health: 50, speed: 95,
    fireCooldown: range(rng, 0.5, 1.5), alive: true,
  };
}

// --- wanted level (pure) -------------------------------------------------

export function raiseWanted(state, amount) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + amount, 0, 5);
  if (state.wanted > before) state.wantedTimer = 0;
  return state.wanted;
}

// Pure: next wanted value after `seconds` hidden from every police car.
export function wantedAfterHiding(wanted, secondsHidden) {
  if (wanted <= 0) return 0;
  return Math.max(0, wanted - Math.floor(secondsHidden / 6));
}

// --- collisions ----------------------------------------------------------

function collideWithBuildings(entity, r, world) {
  for (const b of world.buildings) {
    if (!circleHitsBox(entity.x, entity.y, r, b.x, b.y, b.w, b.h)) continue;
    const fixed = pushCircleOutOfBox(entity.x, entity.y, r, b.x, b.y, b.w, b.h);
    entity.x = fixed.x;
    entity.y = fixed.y;
    return true;
  }
  return false;
}

export function clampToWorld(e, margin = 24) {
  e.x = clamp(e.x, margin, WORLD_W - margin);
  e.y = clamp(e.y, margin, WORLD_H - margin);
}

// --- traffic lights ------------------------------------------------------

export function lightIsGreenFor(world, axis, clockSeconds) {
  // 8-second cycle; vertical and horizontal take turns.
  const phase = Math.floor(clockSeconds / 8) % 2;
  return (axis === 'v') === (phase === 0);
}

// --- player --------------------------------------------------------------

export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    if (car === state.player.car) continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// E pressed near a car: climb in. Stealing a driven car raises wanted when a
// police car can see it; a parked car is free. Returns a result object.
export function tryEnterCar(state) {
  const player = state.player;
  if (!player.onFoot) return { ok: false, reason: 'already-driving' };
  const car = nearestCar(state, 52);
  if (!car) return { ok: false, reason: 'no-car-nearby' };
  const stolen = car.kind === 'traffic' && car.driver;
  car.wasParked = car.kind === 'parked';
  if (stolen) {
    // The driver flees on foot.
    state.peds.push({
      x: car.x + 20, y: car.y + 20, angle: 0, speed: 120,
      shirt: '#c95f8a', walking: true, flee: 4, down: false, downTimer: 0,
      axis: 'v', roadPos: car.x,
    });
    car.driver = false;
    const policeNear = state.police.some((p) => dist(p.x, p.y, car.x, car.y) < 650);
    if (policeNear) raiseWanted(state, 1);
    state.message = policeNear
      ? 'Polisi melihat pencurian itu! Wanted naik.'
      : 'Mobil dicuri — kabur sebelum polisi datang.';
  }
  car.kind = 'player';
  player.car = car;
  player.onFoot = false;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return { ok: true, stolen, car };
}

export function exitCar(state) {
  const player = state.player;
  if (player.onFoot || !player.car) return false;
  const car = player.car;
  car.speed = 0;
  car.kind = car.wasParked ? 'parked' : 'traffic';
  player.car = null;
  player.onFoot = true;
  player.x = car.x - Math.cos(car.angle) * 34;
  player.y = car.y - Math.sin(car.angle) * 34;
  player.speed = 0;
  return true;
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0) return p.health;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health = Math.max(0, p.health - rest);
  return p.health;
}

function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  let mx = 0; let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * FOOT_SPEED * dt;
    p.y += (my / len) * FOOT_SPEED * dt;
    p.angle = Math.atan2(my, mx);
  }
  collideWithBuildings(p, PLAYER_R, state.world);
  clampToWorld(p);
}

function updatePlayerDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car || car.hp <= 0) {
    if (car) car.speed = 0;
    return;
  }
  const forward = input.up ? 1 : input.down ? -0.6 : 0;
  if (forward > 0) car.speed += CAR_ACCEL * dt;
  else if (forward < 0) car.speed -= CAR_BRAKE * 0.6 * dt;
  else car.speed -= Math.sign(car.speed) * 90 * dt;
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  car.speed = clamp(car.speed, -120, CAR_MAX_SPEED);
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
      car.hp -= 12;
      damagePlayer(state, 4);
      playThud(state.audio);
      spawnSparks(state, car.x, car.y, 8);
    }
    car.speed *= 0.4;
  }
  clampToWorld(car);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Dust puffs at speed.
  if (Math.abs(car.speed) > 200 && Math.random() < 0.3) {
    spawnDust(state, car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22);
  }
  if (car.hp <= 0 && car.smoke === 0) {
    car.smoke = 1;
    state.message = 'Mobilmu rusak! Tekan E untuk keluar.';
  }
}

export function updatePlayer(state, input, dt) {
  const p = state.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  if (p.onFoot) updatePlayerOnFoot(state, input, dt);
  else updatePlayerDriving(state, input, dt);
}

// --- combat ---------------------------------------------------------------

export function aimAngle(state, input, view) {
  // Mouse aim in world space; fall back to facing when the mouse is idle.
  if (input.mouseDown || state.player.car === null) {
    const wx = view.camX + input.mouseX;
    const wy = view.camY + input.mouseY;
    if (dist(wx, wy, state.player.x, state.player.y) > 30) {
      return Math.atan2(wy - state.player.y, wx - state.player.x);
    }
  }
  return state.player.angle;
}

export function firePistol(state, angle) {
  const p = state.player;
  if (p.fireCooldown > 0) return false;
  p.fireCooldown = 0.28;
  const ox = p.x;
  const oy = p.y;
  const rangeMax = 430;
  let bestD = rangeMax;
  let hit = null;
  let hitKind = null;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  function test(tx, ty, r, obj, kind) {
    const rx = tx - ox;
    const ry = ty - oy;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > bestD) return;
    const perp = Math.abs(rx * dy - ry * dx);
    if (perp < r + 6) { bestD = along; hit = obj; hitKind = kind; }
  }
  for (const e of state.enemies) if (e.alive) test(e.x, e.y, 16, e, 'enemy');
  for (const pd of state.peds) if (!pd.down) test(pd.x, pd.y, 14, pd, 'ped');
  for (const car of state.cars) {
    if (car === p.car) continue;
    test(car.x, car.y, 24, car, 'car');
  }
  for (const pc of state.police) test(pc.x, pc.y, 24, pc, 'police');
  const hx = ox + dx * bestD;
  const hy = oy + dy * bestD;
  spawnSparks(state, hx, hy, 5);
  playGunshot(state.audio);
  if (!hit) return true;
  if (hitKind === 'enemy') {
    hit.health -= 34;
    if (hit.health <= 0) {
      hit.alive = false;
      state.money += 25;
      state.message = 'Rival tumbang. +$25';
      spawnSparks(state, hit.x, hit.y, 14);
    }
  } else if (hitKind === 'ped') {
    hit.down = true;
    hit.downTimer = 6;
    raiseWanted(state, 1);
    state.message = 'Kamu menyerang warga! Wanted naik.';
  } else if (hitKind === 'car') {
    hit.hp -= 14;
    if (hit.hp <= 0) hit.speed = 0;
    raiseWanted(state, 1);
  } else if (hitKind === 'police') {
    hit.hp -= 20;
    raiseWanted(state, 1);
  }
  return true;
}

export function meleeAttack(state) {
  const p = state.player;
  if (p.punchCooldown > 0 || !p.onFoot) return false;
  p.punchCooldown = 0.45;
  p.punchAnim = 0.25;
  playThud(state.audio);
  const ax = p.x + Math.cos(p.angle) * 26;
  const ay = p.y + Math.sin(p.angle) * 26;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (dist(ax, ay, e.x, e.y) < 42) {
      e.health -= 30;
      e.x += Math.cos(p.angle) * 18;
      e.y += Math.sin(p.angle) * 18;
      if (e.health <= 0) {
        e.alive = false;
        state.money += 25;
        state.message = 'Rival tumbang. +$25';
      }
    }
  }
  for (const pd of state.peds) {
    if (!pd.down && dist(ax, ay, pd.x, pd.y) < 36) {
      pd.down = true;
      pd.downTimer = 6;
      raiseWanted(state, 1);
    }
  }
  return true;
}

// --- traffic --------------------------------------------------------------

export function updateTraffic(state, dt) {
  const clock = state.clockSeconds;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    // Stop for a red light at the next crossing.
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
    // Slow for the car ahead on the same road.
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
    // Wrap around the far edge so the streets never empty out.
    if (car.roadAxis === 'v') {
      if (car.y > WORLD_H + 40) car.y = -40;
      if (car.y < -40) car.y = WORLD_H + 40;
    } else {
      if (car.x > WORLD_W + 40) car.x = -40;
      if (car.x < -40) car.x = WORLD_W + 40;
    }
    // A traffic car that hits the player's car slows down hard.
    const pc = state.player.car;
    if (pc && dist(car.x, car.y, pc.x, pc.y) < 52 && Math.abs(car.speed) > 5) {
      car.speed *= 0.5;
    }
  }
}

// --- pedestrians ----------------------------------------------------------

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.down = false; ped.flee = 0; }
      continue;
    }
    // Flee from a fast car, a gunshot, or a nearby brawl.
    const playerCar = p.car;
    const threat = playerCar
      ? dist(ped.x, ped.y, playerCar.x, playerCar.y) < 90 && Math.abs(playerCar.speed) > 120
      : dist(ped.x, ped.y, p.x, p.y) < 40 && p.punchAnim > 0;
    if (threat) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
      ped.angle = away;
    } else {
      // Stroll along the sidewalk; turn at the ends of a block.
      const step = ped.speed * dt;
      if (ped.axis === 'v') {
        ped.y += Math.sin(ped.angle) * step;
        if (ped.y < 130 || ped.y > WORLD_H - 130) ped.angle += Math.PI;
      } else {
        ped.x += Math.cos(ped.angle) * step;
        if (ped.x < 130 || ped.x > WORLD_W - 130) ped.angle += Math.PI;
      }
      if (Math.random() < 0.002) ped.angle += Math.PI; // change direction
    }
    // Hit by a moving car: knocked down, wanted rises.
    const car = playerCar;
    if (car && Math.abs(car.speed) > 60 && dist(ped.x, ped.y, car.x, car.y) < 30) {
      ped.down = true;
      ped.downTimer = 8;
      ped.x += Math.cos(car.angle) * 26;
      ped.y += Math.sin(car.angle) * 26;
      raiseWanted(state, 1);
      playThud(state.audio);
      state.message = 'Kamu menabrak pejalan kaki! Wanted naik.';
    }
    clampToWorld(ped, 60);
  }
}

// --- police ---------------------------------------------------------------

function nearestPoliceSpawn(state, rng) {
  // Pick a road point roughly 500-700 units from the player.
  for (let tries = 0; tries < 12; tries++) {
    const vertical = rng() < 0.5;
    let x; let y;
    if (vertical) {
      x = V_ROADS[Math.floor(rng() * V_ROADS.length)];
      y = state.player.y + (rng() < 0.5 ? -1 : 1) * range(rng, 480, 700);
    } else {
      y = H_ROADS[Math.floor(rng() * H_ROADS.length)];
      x = state.player.x + (rng() < 0.5 ? -1 : 1) * range(rng, 480, 700);
    }
    x = clamp(x, 80, WORLD_W - 80);
    y = clamp(y, 80, WORLD_H - 80);
    if (dist(x, y, state.player.x, state.player.y) > 420) return { x, y };
  }
  return { x: clamp(state.player.x + 500, 80, WORLD_W - 80), y: state.player.y };
}

export function updatePolice(state, dt) {
  const rng = state.rng;
  const want = state.wanted > 0 ? Math.min(state.wanted + 1, 5) : 0;
  while (state.police.length < want) {
    const spot = nearestPoliceSpawn(state, rng);
    state.police.push(makeCar(spot.x, spot.y, 0, {
      kind: 'police', rng, speed: 0,
    }));
  }
  while (state.police.length > want) state.police.pop();

  const p = state.player;
  let nearest = Infinity;
  for (const pc of state.police) {
    const d = dist(pc.x, pc.y, p.x, p.y);
    nearest = Math.min(nearest, d);
    // Chase: steer toward the player, faster than traffic, slower than a
    // good getaway car. Next to a player on foot, pull up and stop so the
    // arrest can happen; against a car, keep ramming speed.
    const wantAngle = Math.atan2(p.y - pc.y, p.x - pc.x);
    pc.angle += clamp(angleDelta(pc.angle, wantAngle), -2.6 * dt, 2.6 * dt);
    const target = (p.onFoot && d < 55) ? 0 : (d > 60 ? POLICE_MAX_SPEED : 120);
    if (pc.speed < target) pc.speed += 300 * dt;
    else pc.speed -= 200 * dt;
    pc.x += Math.cos(pc.angle) * pc.speed * dt;
    pc.y += Math.sin(pc.angle) * pc.speed * dt;
    pc.sirenPhase += dt;
    if (collideWithBuildings(pc, 22, state.world)) pc.speed *= 0.5;
    clampToWorld(pc);
    // Ram the player.
    if (d < 46) {
      if (p.car) {
        p.car.hp -= 15 * dt;
        p.car.speed *= 0.985;
        damagePlayer(state, 5 * dt);
        if (Math.random() < 0.2) playThud(state.audio);
      } else {
        damagePlayer(state, 12 * dt);
      }
      if (p.car && p.car.hp <= 0) p.car.speed = 0;
    }
    // Busted: caught on foot, a police car sitting on you.
    if (p.onFoot && d < 42) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 3) state.busted = true;
    }
  }
  if (state.police.length === 0 || nearest > 90) p.bustedTimer = Math.max(0, p.bustedTimer - dt);

  // Wanted decay: hidden from every police car for a while, stars fall off.
  if (state.wanted > 0) {
    if (nearest > 700) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= 6) {
        state.wantedTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.wanted === 0) state.message = 'Polisi kehilangan jejakmu.';
      }
    } else {
      state.wantedTimer = 0;
    }
  }
}

// Roadblock at high wanted: two police cars parked across the road ahead.
export function maybeRoadblock(state) {
  if (state.wanted < 4 || state.roadblockActive) return;
  state.roadblockActive = true;
  const p = state.player;
  const ahead = p.car ? p.angle : p.angle;
  const bx = p.x + Math.cos(ahead) * 320;
  const by = p.y + Math.sin(ahead) * 320;
  for (let i = 0; i < 2; i++) {
    state.police.push(makeCar(
      bx + (i === 0 ? -30 : 30), by + (i === 0 ? 20 : -20),
      ahead + Math.PI / 2, { kind: 'police', speed: 0 },
    ));
  }
  state.message = 'ROADBLOCK di depan! Putar balik!';
}

// --- particles ------------------------------------------------------------

export function spawnSparks(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260,
      life: 0.4, maxLife: 0.4, color: '#ffd34d', size: 3,
    });
  }
}

export function spawnDust(state, x, y) {
  state.particles.push({
    x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
    life: 0.7, maxLife: 0.7, color: '#c9b896', size: 5,
  });
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}
