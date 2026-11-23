// police.js — the Solmar City PD: the wanted level, patrol cars that
// chase and ram, and the roadblock unit that parks across the road ahead
// at three stars. Wanted maths are pure and exported for the test suite.

import { clamp, dist, angleDelta, range } from './util.js';
import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, nearestRoadPoint } from './world.js';
import { playThud } from './audio.js';
import { makeCar } from './cars.js';
import { collideWithBuildings, clampToWorld } from './entities.js';
import { carDamageFactor } from './garage.js';
import { heliDecayFactor } from './helicopter.js';
import { damagePlayer } from './player.js';

const POLICE_MAX_SPEED = 285;

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

function nearestPoliceSpawn(state, rng) {
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
    state.police.push(makeCar(spot.x, spot.y, 0, { kind: 'police', rng, speed: 0 }));
  }
  while (state.police.length > want) state.police.pop();

  const p = state.player;
  let nearest = Infinity;
  for (const pc of state.police) {
    const d = dist(pc.x, pc.y, p.x, p.y);
    nearest = Math.min(nearest, d);
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
    if (d < 46) {
      if (p.car) {
        p.car.hp -= 15 * dt * carDamageFactor(state);
        p.car.speed *= 0.985;
        damagePlayer(state, 5 * dt);
        if (rng() < 0.2) playThud(state.audio);
      } else {
        damagePlayer(state, 12 * dt);
      }
      if (p.car && p.car.hp <= 0) p.car.speed = 0;
    }
    if (p.onFoot && d < 42) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 3) state.busted = true;
    }
  }
  if (state.police.length === 0 || nearest > 90) {
    p.bustedTimer = Math.max(0, p.bustedTimer - dt);
  }

  // Wanted decay: hidden from every police car for a while, stars fall
  // off. Under the CONDOR searchlight the hiding clock runs far slower.
  if (state.wanted > 0) {
    if (nearest > 700) {
      state.wantedTimer += dt * heliDecayFactor(state);
      if (state.wantedTimer >= 6) {
        state.wantedTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.wanted === 0) {
          state.message = 'The police lost your trail.';
          state.messageUntil = state.clockSeconds + 2.5;
        }
      }
    } else {
      state.wantedTimer = 0;
    }
  }
}

// ------------------------------------------------------------ roadblocks --
// At three stars the police stop chasing only: they park two cars across
// the road ahead of Mara and drop striped barriers between them. The unit
// is stored apart from the patrol list so the chase maths never moves it;
// it despawns cleanly when she gets far away, the heat cools, or it ages.

export function shouldSpawnRoadblock(state) {
  return state.wanted >= 3 && !state.roadblock
    && (state.roadblockCooldown || 0) <= 0;
}

export function roadblockSpot(state) {
  const p = state.player;
  const bx = p.x + Math.cos(p.angle) * 340;
  const by = p.y + Math.sin(p.angle) * 340;
  const snap = nearestRoadPoint(bx, by);
  return { x: snap.x, y: snap.y, axis: snap.axis };
}

export function spawnRoadblock(state) {
  const spot = roadblockSpot(state);
  const cars = [];
  const barriers = [];
  const along = spot.axis === 'v' ? 'x' : 'y';
  const carAngle = spot.axis === 'v' ? 0 : Math.PI / 2;
  for (const off of [-25, 25]) {
    const pos = { x: spot.x, y: spot.y };
    pos[along] += off;
    cars.push(makeCar(pos.x, pos.y, carAngle, { kind: 'police', speed: 0 }));
  }
  for (const off of [-36, 0, 36]) {
    const pos = { x: spot.x, y: spot.y };
    pos[along] += off;
    barriers.push({ x: pos.x, y: pos.y, angle: carAngle });
  }
  state.roadblock = { x: spot.x, y: spot.y, axis: spot.axis, cars, barriers, age: 0 };
  state.barriers = barriers;
  state.message = 'ROADBLOCK ahead! Turn around or smash through!';
  state.messageUntil = state.clockSeconds + 3;
  return state.roadblock;
}

export function clearRoadblock(state) {
  state.roadblock = null;
  state.barriers = [];
}

export function updateRoadblock(state, dt) {
  state.roadblockCooldown = Math.max(0, (state.roadblockCooldown || 0) - dt);
  const rb = state.roadblock;
  if (!rb) {
    if (shouldSpawnRoadblock(state)) spawnRoadblock(state);
    return;
  }
  rb.age += dt;
  for (const car of rb.cars) car.sirenPhase += dt;
  const p = state.player;
  const wrecked = rb.cars.every((c) => c.exploded);
  if (wrecked || state.wanted < 2 || rb.age > 50
    || dist(p.x, p.y, rb.x, rb.y) > 750) {
    for (const car of rb.cars) {
      if (car.exploded) {
        car.kind = 'wreck';
        state.cars.push(car);
      }
    }
    clearRoadblock(state);
    state.roadblockCooldown = 18;
  }
}

// Barriers are solid: circles (Mara, her car) are pushed out of them.
export function collideBarriers(state, e, r) {
  let hit = false;
  for (const b of state.barriers || []) {
    const d = dist(e.x, e.y, b.x, b.y);
    const min = r + 15;
    if (d < min && d > 0.01) {
      e.x = b.x + ((e.x - b.x) / d) * min;
      e.y = b.y + ((e.y - b.y) / d) * min;
      hit = true;
    }
  }
  return hit;
}
