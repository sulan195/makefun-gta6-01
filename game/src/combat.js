
import { dist } from './util.js';
import { raiseWanted } from './police.js';
import { spawnSparks } from './effects.js';
import { playGunshot } from './audio.js';
import { addRespect } from './progression.js';

export const WEAPON_ORDER = ['fist', 'pistol', 'smg', 'shotgun'];

export const WEAPONS = {
  fist: { name: 'Fists', damage: 30, cooldown: 0.45, range: 0, spread: 0, pellets: 1, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 34, cooldown: 0.28, range: 430, spread: 0, pellets: 1, ammo: Infinity },
  smg: { name: 'SMG', damage: 16, cooldown: 0.09, range: 400, spread: 0.055, pellets: 1, ammo: 0 },
  shotgun: { name: 'Shotgun', damage: 13, cooldown: 0.85, range: 260, spread: 0.15, pellets: 6, ammo: 0 },
};

export function createWeaponState() {
  return {
    owned: ['fist', 'pistol'],
    current: 'pistol',
    ammo: { smg: 0, shotgun: 0 },
  };
}

export function ensureWeapons(state) {
  if (!state.weapons) state.weapons = createWeaponState();
  return state.weapons;
}

export function currentWeapon(state) {
  const ws = ensureWeapons(state);
  return WEAPONS[ws.current] || WEAPONS.pistol;
}

export function switchWeapon(state, slot) {
  const ws = ensureWeapons(state);
  const key = WEAPON_ORDER[slot - 1];
  if (!key) return false;
  if (!ws.owned.includes(key)) {
    state.message = 'You do not have the ' + WEAPONS[key].name + ' yet.';
    state.messageUntil = state.clockSeconds + 1.5;
    return false;
  }
  ws.current = key;
  state.message = WEAPONS[key].name + ' ready.';
  state.messageUntil = state.clockSeconds + 1;
  return true;
}

export function weaponHudText(state) {
  const ws = ensureWeapons(state);
  const w = WEAPONS[ws.current];
  if (ws.current === 'fist') return 'FISTS';
  if (ws.current === 'pistol') return 'PISTOL · ∞';
  return w.name.toUpperCase() + ' · ' + (ws.ammo[ws.current] || 0);
}

export function createPickups() {
  return [
    { kind: 'weapon', weapon: 'smg', x: 2060, y: 1560, ammo: 60, taken: false, label: 'SMG' },
    { kind: 'weapon', weapon: 'shotgun', x: 1100, y: 1440, ammo: 12, taken: false, label: 'Shotgun' },
    { kind: 'ammo', weapon: 'smg', x: 1500, y: 906, ammo: 60, taken: false, label: 'SMG Ammo' },
    { kind: 'ammo', weapon: 'shotgun', x: 2300, y: 266, ammo: 12, taken: false, label: 'Shotgun Ammo' },
  ];
}

export function updatePickups(state) {
  const p = state.player;
  if (!p.onFoot || !state.pickups) return;
  const ws = ensureWeapons(state);
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) > 32) continue;
    pk.taken = true;
    if (pk.kind === 'weapon' && !ws.owned.includes(pk.weapon)) {
      ws.owned.push(pk.weapon);
      ws.current = pk.weapon;
      state.message = pk.label + ' acquired! +' + pk.ammo + ' rounds. Press 1-4 to switch weapons.';
    } else {
      state.message = pk.label + ': +' + pk.ammo + ' rounds.';
    }
    ws.ammo[pk.weapon] = (ws.ammo[pk.weapon] || 0) + pk.ammo;
    state.messageUntil = state.clockSeconds + 3.5;
    spawnSparks(state, pk.x, pk.y, 10, 8);
  }
}

export function fireWeapon(state, angle) {
  const p = state.player;
  const ws = ensureWeapons(state);
  const key = ws.current;
  const w = WEAPONS[key];
  if (!w || key === 'fist') return false;
  if (p.fireCooldown > 0) return false;
  if (w.ammo !== Infinity && (ws.ammo[key] || 0) <= 0) {
    p.fireCooldown = 0.3;
    state.message = 'Out of ' + w.name + ' ammo! Refill at the garage or find a pickup.';
    state.messageUntil = state.clockSeconds + 2;
    return false;
  }
  p.fireCooldown = w.cooldown;
  if (w.ammo !== Infinity) ws.ammo[key] -= 1;

  const rng = state.rng;
  const ox = p.x;
  const oy = p.y;
  let wantedCrime = false;
  for (let pellet = 0; pellet < w.pellets; pellet++) {
    const a = angle + (w.spread ? (rng() - 0.5) * 2 * w.spread : 0);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let bestD = w.range;
    let hit = null;
    let hitKind = null;
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
      if (car === p.car || car.exploded) continue;
      test(car.x, car.y, 24, car, 'car');
    }
    for (const pc of state.police) if (!pc.exploded) test(pc.x, pc.y, 24, pc, 'police');
    if (state.roadblock) {
      for (const rc of state.roadblock.cars) {
        if (!rc.exploded) test(rc.x, rc.y, 24, rc, 'police');
      }
    }
    const hx = ox + dx * bestD;
    const hy = oy + dy * bestD;
    state.tracers.push({
      x1: ox + dx * 18, y1: oy + dy * 18, h1: 15,
      x2: hx, y2: hy, h2: hitKind === 'car' || hitKind === 'police' ? 8 : 12,
      life: 0.07, maxLife: 0.07,
    });
    spawnSparks(state, hx, hy, pellet === 0 ? 5 : 2, 9);
    if (!hit) continue;
    if (hitKind === 'enemy') {
      if (hit.alive) {
        hit.health -= w.damage;
        if (hit.health <= 0) {
          hit.alive = false;
          state.money += 25;
          addRespect(state, 1);
          state.message = 'Rival down. +$25';
          state.messageUntil = state.clockSeconds + 2.5;
          spawnSparks(state, hit.x, hit.y, 14, 12);
        }
      }
    } else if (hitKind === 'ped') {
      hit.down = true;
      hit.downTimer = 6;
      wantedCrime = true;
      state.message = 'You attacked a civilian! Wanted up.';
      state.messageUntil = state.clockSeconds + 2.5;
    } else if (hitKind === 'car') {
      hit.hp -= w.damage;
      wantedCrime = true;
    } else if (hitKind === 'police') {
      hit.hp -= w.damage;
      wantedCrime = true;
    }
  }
  playGunshot(state.audio);
  if (wantedCrime) raiseWanted(state, 1);
  return true;
}
