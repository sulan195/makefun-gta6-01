
import { clamp, dist } from './util.js';
import { WORLD_W, WORLD_H } from './world.js';

export const HELI_MIN_WANTED = 4;

export function shouldSpawnHeli(state) {
  return state.wanted >= HELI_MIN_WANTED && !state.heli;
}

export function createHelicopter(state) {
  const p = state.player;
  return {
    x: clamp(p.x - 320, 60, WORLD_W - 60),
    y: clamp(p.y - 260, 60, WORLD_H - 60),
    angle: 0,
    rotorPhase: 0,
    leaving: false,
    lightX: p.x,
    lightY: p.y,
  };
}

export function heliDecayFactor(state) {
  const heli = state.heli;
  if (!heli || heli.leaving) return 1;
  return dist(heli.x, heli.y, state.player.x, state.player.y) < 540 ? 0.35 : 1;
}

export function updateHelicopter(state, dt) {
  if (shouldSpawnHeli(state)) {
    state.heli = createHelicopter(state);
    state.message = 'CONDOR helicopter overhead! Its searchlight has you locked.';
    state.messageUntil = state.clockSeconds + 3.5;
  }
  const heli = state.heli;
  if (!heli) return;
  heli.rotorPhase += dt * 42;
  const p = state.player;
  if (state.wanted < HELI_MIN_WANTED) heli.leaving = true;
  if (heli.leaving) {
    heli.x -= 300 * dt;
    heli.y -= 300 * dt;
    heli.angle = Math.atan2(-1, -1);
    if (heli.x < -80 || heli.y < -80) state.heli = null;
    return;
  }
  const t = state.clockSeconds;
  const tx = p.x + Math.cos(t * 0.35) * 70;
  const ty = p.y + Math.sin(t * 0.35) * 70 - 30;
  const d = dist(heli.x, heli.y, tx, ty);
  const speed = d > 200 ? 330 : 215;
  if (d > 4) {
    const want = Math.atan2(ty - heli.y, tx - heli.x);
    heli.x += Math.cos(want) * Math.min(d, speed * dt);
    heli.y += Math.sin(want) * Math.min(d, speed * dt);
    heli.angle = want;
  }
  heli.lightX += (p.x - heli.lightX) * Math.min(1, dt * 3.2);
  heli.lightY += (p.y - heli.lightY) * Math.min(1, dt * 3.2);
  heli.lightX += Math.sin(t * 0.9) * 14 * dt;
  heli.lightY += Math.cos(t * 0.7) * 14 * dt;
}
