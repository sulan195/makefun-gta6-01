// entities.js — pedestrians, enemies and shared collision maths.

import { clamp, dist, pick, range, circleHitsBox, pushCircleOutOfBox } from './util.js';
import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, ROAD_W } from './world.js';
import { playThud } from './audio.js';
import { raiseWanted } from './police.js';

export const PLAYER_R = 14;

const PED_SHIRTS = ['#e07840', '#4d7dc9', '#e0c040', '#7dbb6a', '#c95f8a', '#f0e8d8', '#6a5f9e'];

export function clampToWorld(e, margin = 24) {
  e.x = clamp(e.x, margin, WORLD_W - margin);
  e.y = clamp(e.y, margin, WORLD_H - margin);
}

export function collideWithBuildings(entity, r, world) {
  for (const b of world.buildings) {
    if (!circleHitsBox(entity.x, entity.y, r, b.x, b.y, b.w, b.h)) continue;
    const fixed = pushCircleOutOfBox(entity.x, entity.y, r, b.x, b.y, b.w, b.h);
    entity.x = fixed.x;
    entity.y = fixed.y;
    return true;
  }
  return false;
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
      roadPos: vertical ? x : y, walkPhase: rng() * 6,
      variant: Math.floor(rng() * 3), scale: 0.93 + rng() * 0.14,
    });
  }
  return peds;
}

export function makeEnemy(x, y, rng) {
  return {
    x, y, angle: 0, health: 50, speed: 95,
    fireCooldown: range(rng, 0.5, 1.5), alive: true, walkPhase: 0,
  };
}

export function updatePeds(state, dt) {
  const p = state.player;
  const rng = state.rng;
  for (const ped of state.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.down = false; ped.flee = 0; }
      continue;
    }
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
      ped.walkPhase += dt * 11;
    } else {
      const step = ped.speed * dt;
      if (ped.axis === 'v') {
        ped.y += Math.sin(ped.angle) * step;
        if (ped.y < 130 || ped.y > WORLD_H - 130) ped.angle += Math.PI;
      } else {
        ped.x += Math.cos(ped.angle) * step;
        if (ped.x < 130 || ped.x > WORLD_W - 130) ped.angle += Math.PI;
      }
      if (rng() < 0.002) ped.angle += Math.PI; // change direction
      ped.walkPhase += dt * 6;
    }
    const car = playerCar;
    if (car && Math.abs(car.speed) > 60 && dist(ped.x, ped.y, car.x, car.y) < 30) {
      ped.down = true;
      ped.downTimer = 8;
      ped.x += Math.cos(car.angle) * 26;
      ped.y += Math.sin(car.angle) * 26;
      raiseWanted(state, 1);
      playThud(state.audio);
      state.message = 'You hit a pedestrian! Wanted up.';
      state.messageUntil = state.clockSeconds + 2.5;
    }
    clampToWorld(ped, 60);
  }
}
