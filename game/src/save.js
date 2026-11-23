// save.js — save / load progress to localStorage (money, missions, position).
// Pure serialisation is kept separate so Node tests can exercise it without
// touching storage.

export const SAVE_KEY = 'solmar-city-save-v1';

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
    savedAt: new Date().toISOString(),
  };
}

export function saveGame(state) {
  try {
    const data = serializeSave(state);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
