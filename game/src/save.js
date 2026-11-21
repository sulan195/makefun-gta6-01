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
