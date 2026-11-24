
export const SAVE_KEY = 'solmar-city-save-v1';
const keyFor = (slot) => (slot ? SAVE_KEY + '-' + slot : SAVE_KEY);

export function serializeSave(state) {
  return {
    version: 1,
    money: Math.floor(state.money),
    missionIndex: state.missions.index,
    missionsDone: state.missionsDone.slice(),
    playerX: Math.round(state.player.x),
    playerY: Math.round(state.player.y),
    health: Math.round(state.player.health),
    clockMinutes: Math.round(state.clockMinutes),
    respect: Math.round(state.respect || 0),
    garage: state.garage
      ? { engine: state.garage.engine || 0, armor: state.garage.armor || 0 }
      : { engine: 0, armor: 0 },
    weapons: state.weapons
      ? {
        owned: state.weapons.owned.slice(),
        current: state.weapons.current,
        ammo: { smg: state.weapons.ammo.smg || 0, shotgun: state.weapons.ammo.shotgun || 0 },
      }
      : null,
    raceBest: state.race ? Math.round((state.race.best || 0) * 10) / 10 : 0,
    difficulty: state.difficulty ?? 1,
    custom: state.custom || null,
    savedAt: new Date().toISOString(),
  };
}

export function saveGame(state, slot) {
  try {
    const data = serializeSave(state);
    window.localStorage.setItem(keyFor(slot ?? state.slot), JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

const WEAPON_IDS = ['fist', 'pistol', 'smg', 'shotgun'];
const numOr = (v, d) => Number.isFinite(v) ? v : d;
const intIn = (v, hi) => Number.isInteger(v) && v >= 0 && v <= hi;
function cleanWeapons(w) {
  if (w == null) return null;
  const a = w.ammo || {};
  const ok = Array.isArray(w.owned) && WEAPON_IDS.includes(w.current)
    && w.owned.every((id) => WEAPON_IDS.includes(id))
    && ['smg', 'shotgun'].every((k) => numOr(a[k], -1) >= 0);
  return ok ? w : { owned: ['fist'], current: 'fist', ammo: { smg: 0, shotgun: 0 } };
}
export function loadSave(slot) {
  try {
    const raw = window.localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (numOr(data.money, -1) < 0 || !intIn(data.missionIndex, 8)) return null;
    for (const k of ['respect', 'raceBest']) data[k] = Math.max(0, numOr(data[k], 0));
    for (const [k, d] of [['playerX', 0], ['playerY', 0], ['clockMinutes', 1000]]) data[k] = numOr(data[k], d);
    data.health = Math.min(100, Math.max(1, numOr(data.health, 100)));
    if (!Array.isArray(data.missionsDone) || data.missionsDone.some((v) => !['string', 'boolean'].includes(typeof v)))
      data.missionsDone = [...Array(8)].map((_, i) => i < data.missionIndex);
    data.difficulty = intIn(data.difficulty, 2) ? data.difficulty : 1;
    const cu = data.custom;
    const HEX = /^#[0-9a-f]{6}$/i;
    data.custom = cu && HEX.test(cu.skin || '') && HEX.test(cu.hair || '') && intIn(cu.style, 2)
      ? { skin: cu.skin, hair: cu.hair, style: cu.style } : null;
    const g = data.garage || {};
    data.garage = intIn(g.engine, 3) && intIn(g.armor, 3) ? g : { engine: 0, armor: 0 };
    data.weapons = cleanWeapons(data.weapons);
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave(slot) {
  return loadSave(slot) !== null;
}

export function slotSummary(slot) {
  const s = loadSave(slot);
  return s ? { money: s.money, respect: s.respect, missionIndex: s.missionIndex } : null;
}

export function clearSave() {
  try { window.localStorage.removeItem(keyFor(0)); } catch (e) { /* ignore */ }
}
