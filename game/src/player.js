
import { clamp, dist, angleDelta } from './util.js';
import { WORLD_W, WORLD_H } from './world.js';
import { playThud } from './audio.js';
import { collideWithBuildings, clampToWorld, PLAYER_R } from './entities.js';
import { collideBarriers, raiseWanted } from './police.js';
import { updatePlayerDriving } from './cars.js';
import { spawnSparks } from './effects.js';

const FOOT_SPEED = 175;

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    health: 100, armor: 0,
    fireCooldown: 0, punchCooldown: 0, punchAnim: 0,
    bustedTimer: 0, invulnerable: 0, walkPhase: 0, moving: false,
  };
}

export function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0) return p.health;
  let rest = amount * (state.diffDmg || 1);
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health = Math.max(0, p.health - rest);
  return p.health;
}

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

export function tryEnterCar(state) {
  const player = state.player;
  if (!player.onFoot) return { ok: false, reason: 'already-driving' };
  const car = nearestCar(state, 52);
  if (!car) return { ok: false, reason: 'no-car-nearby' };
  const stolen = car.kind === 'traffic' && car.driver;
  car.wasParked = car.kind === 'parked';
  if (stolen) {
    state.peds.push({
      x: car.x + 20, y: car.y + 20, angle: 0, speed: 120,
      shirt: '#c95f8a', walking: true, flee: 4, down: false, downTimer: 0,
      axis: 'v', roadPos: car.x, walkPhase: 0,
    });
    car.driver = false;
    const policeNear = state.police.some((pc) => dist(pc.x, pc.y, car.x, car.y) < 650);
    if (policeNear) raiseWanted(state, 1);
    state.message = policeNear
      ? 'The police saw that theft! Wanted up.'
      : 'Car stolen — move before the police show up.';
    state.messageUntil = state.clockSeconds + 2.5;
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

function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  const yaw = state.camera ? state.camera.yaw : p.angle;
  const f = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.moving = f !== 0 || r !== 0;
  if (p.moving) {
    const mx = Math.cos(yaw) * f + Math.sin(yaw) * r;
    const my = Math.sin(yaw) * f - Math.cos(yaw) * r;
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * FOOT_SPEED * dt;
    p.y += (my / len) * FOOT_SPEED * dt;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * 10.5;
  }
  collideWithBuildings(p, PLAYER_R, state.world);
  collideBarriers(state, p, PLAYER_R);
  clampToWorld(p);
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
      spawnSparks(state, e.x, e.y, 4, 14);
      if (e.health <= 0) {
        e.alive = false;
        state.money += 25;
        state.message = 'Rival down. +$25';
        state.messageUntil = state.clockSeconds + 2.5;
      }
    }
  }
  for (const pd of state.peds) {
    if (!pd.down && dist(ax, ay, pd.x, pd.y) < 36) {
      pd.down = true;
      pd.downTimer = 6;
      raiseWanted(state, 1);
      state.message = 'You attacked a civilian! Wanted up.';
      state.messageUntil = state.clockSeconds + 2.5;
    }
  }
  return true;
}

export function createCamera() {
  return {
    yaw: -Math.PI / 2, pitch: 0.34, orbit: 0,
    dist: 108, x: 0, y: 60, z: 0, tx: 0, ty: 12, tz: 0,
  };
}

export function updateCamera(state, dt) {
  const cam = state.camera;
  const p = state.player;
  const input = state.input;
  const focus = p.car || p;
  const speed = p.car ? Math.abs(p.car.speed) : 0;

  let orbitKey = 0;
  if (input && input.camLeft) orbitKey -= 1;
  const eBusy = p.onFoot
    ? nearestCar(state, 52) !== null
    : speed < 40;
  if (input && input.action && !eBusy) orbitKey += 1;
  cam.orbit += orbitKey * 1.9 * dt;
  if (input && (input.dragDX || input.dragDY)) {
    cam.orbit += input.dragDX * 0.0052;
    cam.pitch = clamp(cam.pitch + input.dragDY * 0.003, 0.12, 0.95);
  }
  if (p.car && orbitKey === 0) cam.orbit *= Math.max(0, 1 - dt * 0.55);

  const desired = focus.angle + cam.orbit;
  const ease = p.car ? 3.4 : 4.2;
  cam.yaw += angleDelta(cam.yaw, desired) * Math.min(1, dt * ease);

  const targetDist = 108 + (p.car ? clamp(speed / 330, 0, 1) * 26 : 0);
  cam.dist += (targetDist - cam.dist) * Math.min(1, dt * 2.5);
  const hd = cam.dist * Math.cos(cam.pitch);
  let cx = focus.x - Math.cos(cam.yaw) * hd;
  let cz = focus.y - Math.sin(cam.yaw) * hd;
  let cy = 13 + cam.dist * Math.sin(cam.pitch);
  const probe = { x: cx, y: cz };
  collideWithBuildings(probe, 7, state.world);
  cx = clamp(probe.x, -260, WORLD_W + 260);
  cz = clamp(probe.y, -260, WORLD_H + 420);
  cy = Math.max(cy, 5);
  cam.x = cx; cam.y = cy; cam.z = cz;
  cam.tx = focus.x + Math.cos(cam.yaw) * 34;
  cam.ty = 11;
  cam.tz = focus.y + Math.sin(cam.yaw) * 34;
}
