
import { dist } from './util.js';

export const UPGRADES = {
  engine: { name: 'Engine', max: 3, prices: [250, 500, 900], blurb: '+25 top speed / level' },
  armor: { name: 'Armor', max: 3, prices: [250, 500, 900], blurb: '-15% car damage / level' },
};
export const RESPRAY_COST = 150;
export const AMMO_DEALS = {
  smg: { amount: 60, cost: 120, label: 'SMG Ammo +60' },
  shotgun: { amount: 12, cost: 120, label: 'Shotgun Ammo +12' },
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
  if (!state.weapons) return { ok: false, reason: 'unknown' };
  state.money -= deal.cost;
  state.weapons.ammo[kind] = (state.weapons.ammo[kind] || 0) + deal.amount;
  return { ok: true, amount: deal.amount, price: deal.cost };
}

export function garageMenuItems(state) {
  const g = ensureGarage(state);
  const items = [];
  for (const key of ['engine', 'armor']) {
    const def = UPGRADES[key];
    const lvl = g[key];
    items.push({
      action: 'upgrade', key,
      label: def.name + ' — level ' + lvl + '/' + def.max,
      detail: lvl >= def.max ? 'MAX' : '$' + def.prices[lvl] + ' · ' + def.blurb,
    });
  }
  items.push({
    action: 'respray', key: 'respray',
    label: 'Respray — fresh paint, fresh plates',
    detail: state.wanted > 0 ? '$' + RESPRAY_COST + ' · clears wanted' : 'no wanted level',
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

export function garageAction(state, n) {
  const item = garageMenuItems(state)[n - 1];
  if (!item) return null;
  let res;
  if (item.action === 'upgrade') res = buyUpgrade(state, item.key);
  else if (item.action === 'respray') res = respray(state);
  else res = buyAmmo(state, item.key);
  if (res.ok) {
    if (item.action === 'upgrade') return item.label.split(' — ')[0] + ' raised to level ' + res.level + '! -$' + res.price;
    if (item.action === 'respray') return 'Respray done — the police lost your trail. -$' + res.price;
    return item.label + ' bought. -$' + res.price;
  }
  if (res.reason === 'poor') return 'Not enough money.';
  if (res.reason === 'max') return 'Already at max level.';
  if (res.reason === 'clean') return 'Your car is clean — no wanted level.';
  return 'Cannot do that.';
}
