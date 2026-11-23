// garage.js — Garasi Bang Udin in Southside: the city's one tuning shop.
// Walk (or drive) up to it and press G for the menu: engine and armour
// upgrades for Mara's current ride, a respray that washes the wanted level
// away, and ammunition for the SMG and shotgun. Everything bought here is
// kept in the save. All the maths is pure so Node tests can price it.

import { dist } from './util.js';

export const UPGRADES = {
  engine: { name: 'Mesin', max: 3, prices: [250, 500, 900], blurb: '+25 kecepatan puncak / tingkat' },
  armor: { name: 'Armor', max: 3, prices: [250, 500, 900], blurb: '-15% kerusakan mobil / tingkat' },
};
export const RESPRAY_COST = 150;
export const AMMO_DEALS = {
  smg: { amount: 60, cost: 120, label: 'Amunisi SMG +60' },
  shotgun: { amount: 12, cost: 120, label: 'Amunisi Shotgun +12' },
};
export const GARAGE_RADIUS = 110;

export function createGarageState() {
  return { engine: 0, armor: 0 };
}

export function ensureGarage(state) {
  if (!state.garage) state.garage = createGarageState();
  return state.garage;
}

export function nearGarage(state) {
  const g = state.world.places.garage;
  if (!g) return false;
  return dist(state.player.x, state.player.y, g.x, g.y) < GARAGE_RADIUS;
}

// What Mara's car can do with the current build.
export function carMaxSpeed(state) {
  return 330 + ensureGarage(state).engine * 25;
}
export function carAccel(state) {
  return 260 + ensureGarage(state).engine * 35;
}
export function carDamageFactor(state) {
  return 1 - 0.15 * ensureGarage(state).armor;
}

export function buyUpgrade(state, key) {
  const g = ensureGarage(state);
  const def = UPGRADES[key];
  if (!def) return { ok: false, reason: 'unknown' };
  if (g[key] >= def.max) return { ok: false, reason: 'max' };
  const price = def.prices[g[key]];
  if (state.money < price) return { ok: false, reason: 'poor' };
  state.money -= price;
  g[key] += 1;
  return { ok: true, level: g[key], price };
}

export function respray(state) {
  if (state.wanted <= 0) return { ok: false, reason: 'clean' };
  if (state.money < RESPRAY_COST) return { ok: false, reason: 'poor' };
  state.money -= RESPRAY_COST;
  state.wanted = 0;
  state.wantedTimer = 0;
  return { ok: true, price: RESPRAY_COST };
}

export function buyAmmo(state, kind) {
  const deal = AMMO_DEALS[kind];
  if (!deal) return { ok: false, reason: 'unknown' };
  if (state.money < deal.cost) return { ok: false, reason: 'poor' };
  state.money -= deal.cost;
  if (!state.weapons) return { ok: false, reason: 'unknown' };
  state.weapons.ammo[kind] = (state.weapons.ammo[kind] || 0) + deal.amount;
  return { ok: true, amount: deal.amount, price: deal.cost };
}

// The menu the HUD draws and the keys 1-5 select from.
export function garageMenuItems(state) {
  const g = ensureGarage(state);
  const items = [];
  for (const key of ['engine', 'armor']) {
    const def = UPGRADES[key];
    const lvl = g[key];
    items.push({
      action: 'upgrade', key,
      label: def.name + ' — tingkat ' + lvl + '/' + def.max,
      detail: lvl >= def.max ? 'MAKS' : '$' + def.prices[lvl] + ' · ' + def.blurb,
    });
  }
  items.push({
    action: 'respray', key: 'respray',
    label: 'Respray — cat baru, plat baru',
    detail: state.wanted > 0 ? '$' + RESPRAY_COST + ' · hapus wanted' : 'tidak ada wanted',
  });
  items.push({
    action: 'ammo', key: 'smg',
    label: AMMO_DEALS.smg.label, detail: '$' + AMMO_DEALS.smg.cost,
  });
  items.push({
    action: 'ammo', key: 'shotgun',
    label: AMMO_DEALS.shotgun.label, detail: '$' + AMMO_DEALS.shotgun.cost,
  });
  return items;
}

// Run menu choice n (1-5). Returns a player-facing result line.
export function garageAction(state, n) {
  const item = garageMenuItems(state)[n - 1];
  if (!item) return null;
  let res;
  if (item.action === 'upgrade') res = buyUpgrade(state, item.key);
  else if (item.action === 'respray') res = respray(state);
  else res = buyAmmo(state, item.key);
  if (res.ok) {
    if (item.action === 'upgrade') return item.label.split(' — ')[0] + ' naik ke tingkat ' + res.level + '! -$' + res.price;
    if (item.action === 'respray') return 'Respray selesai — polisi kehilangan jejakmu. -$' + res.price;
    return item.label + ' terbeli. -$' + res.price;
  }
  if (res.reason === 'poor') return 'Uangmu tidak cukup.';
  if (res.reason === 'max') return 'Sudah tingkat maksimal.';
  if (res.reason === 'clean') return 'Mobilmu bersih — tidak ada wanted.';
  return 'Tidak bisa.';
}
