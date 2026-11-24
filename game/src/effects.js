// effects.js — particles, burning cars and scorch marks.

import { dist } from './util.js';
import { playThud } from './audio.js';
import { damagePlayer } from './player.js';
import { clampToWorld } from './entities.js';

// Particle: {x, y (ground), h (height), vx, vy, vh, life, maxLife,
// color (hex), size, alpha, grav}
export function spawnSparks(state, x, y, n, h = 8) {
  const rng = state.rng;
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y, h: h + rng() * 4,
      vx: (rng() - 0.5) * 260, vy: (rng() - 0.5) * 260, vh: (rng() - 0.5) * 120,
      life: 0.4, maxLife: 0.4, color: '#ffd34d', size: 3, alpha: 0.95, grav: 300,
    });
  }
}

export function spawnDust(state, x, y) {
  const rng = state.rng;
  state.particles.push({
    x, y, h: 3,
    vx: (rng() - 0.5) * 30, vy: (rng() - 0.5) * 30, vh: 14 + rng() * 16,
    life: 0.7, maxLife: 0.7, color: '#c9b896', size: 6, alpha: 0.4, grav: -30,
  });
}

function spawnFlame(state, car, big) {
  const rng = state.rng;
  state.particles.push({
    x: car.x + (rng() - 0.5) * 26, y: car.y + (rng() - 0.5) * 14,
    h: 6 + rng() * 4,
    vx: (rng() - 0.5) * 20, vy: (rng() - 0.5) * 20, vh: 55 + rng() * 45,
    life: 0.5, maxLife: 0.5,
    color: rng() < 0.55 ? '#ff7a26' : '#ffc93c',
    size: big ? 13 : 10, alpha: 0.9, grav: -160,
  });
}

function spawnSmoke(state, car) {
  const rng = state.rng;
  state.particles.push({
    x: car.x + (rng() - 0.5) * 16, y: car.y + (rng() - 0.5) * 10, h: 12,
    vx: (rng() - 0.5) * 14, vy: (rng() - 0.5) * 14, vh: 34 + rng() * 20,
    life: 0.9, maxLife: 0.9, color: '#4a4a4f', size: 11, alpha: 0.42, grav: -60,
  });
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.h += pt.vh * dt;
    pt.vh -= (pt.grav || 0) * dt;
    if (pt.h < 0.5) { pt.h = 0.5; pt.vh = 0; }
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const tr of state.tracers) tr.life -= dt;
  state.tracers = state.tracers.filter((tr) => tr.life > 0);
}

// burning cars
// A car at 0 hp catches fire: flames and smoke for a few seconds, then it
// explodes — hurting everyone close, chaining into nearby cars and
// leaving a scorch mark. Mara's own car warns her long before that.

export function explodeCar(state, car) {
  if (car.exploded) return;
  const rng = state.rng;
  car.exploded = true;
  car.burning = 0;
  car.speed = 0;
  car.color = '#1b1b1b';
  if (!state.scorches) state.scorches = [];
  state.scorches.push({ x: car.x, y: car.y });
  if (state.scorches.length > 40) state.scorches.shift();
  for (let i = 0; i < 26; i++) {
    state.particles.push({
      x: car.x, y: car.y, h: 5 + rng() * 8,
      vx: (rng() - 0.5) * 340, vy: (rng() - 0.5) * 340, vh: 60 + rng() * 190,
      life: 0.7, maxLife: 0.7,
      color: i % 3 === 0 ? '#8a8a8a' : (i % 2 === 0 ? '#ff7a26' : '#ffd34d'),
      size: 8, alpha: 0.95, grav: 260,
    });
  }
  playThud(state.audio);
  const R = 100;
  const p = state.player;
  if (p.car === car) {
    damagePlayer(state, 30);
    p.car = null;
    p.onFoot = true;
    p.x = car.x + 46;
    p.y = car.y + 46;
    clampToWorld(p);
    car.kind = 'wreck';
    state.message = 'Your car EXPLODED! You were thrown clear.';
    state.messageUntil = state.clockSeconds + 3.5;
  } else if (dist(p.x, p.y, car.x, car.y) < R) {
    damagePlayer(state, 30);
  }
  const others = [...state.cars, ...state.police,
    ...(state.roadblock ? state.roadblock.cars : [])];
  for (const other of others) {
    if (other === car || other.exploded) continue;
    if (dist(other.x, other.y, car.x, car.y) < R) other.hp -= 70;
  }
  for (const ped of state.peds) {
    if (!ped.down && dist(ped.x, ped.y, car.x, car.y) < 85) {
      ped.down = true;
      ped.downTimer = 8;
    }
  }
  for (const e of state.enemies) {
    if (e.alive && dist(e.x, e.y, car.x, car.y) < 85) {
      e.health -= 60;
      if (e.health <= 0) e.alive = false;
    }
  }
}

export function updateBurning(state, dt) {
  const rng = state.rng;
  const all = [...state.cars, ...state.police,
    ...(state.roadblock ? state.roadblock.cars : [])];
  for (const car of all) {
    if (car.exploded) continue;
    if (car.hp <= 0) {
      car.burning = (car.burning || 0) + dt;
      if (rng() < 0.55) spawnFlame(state, car, false);
      if (rng() < 0.3) spawnSmoke(state, car);
      if (car.burning >= 2.5) explodeCar(state, car);
    } else if (car.hp < 40 && rng() < 0.22) {
      spawnSmoke(state, car);
    }
  }
  // Exploded patrol cars leave the force; the wreck stays on the street.
  for (let i = state.police.length - 1; i >= 0; i--) {
    if (state.police[i].exploded) {
      const wreck = state.police.splice(i, 1)[0];
      wreck.kind = 'wreck';
      state.cars.push(wreck);
    }
  }
}
