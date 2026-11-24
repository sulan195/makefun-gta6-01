// races.js — the Marina Loop checkpoint race.

import { dist } from './util.js';
import { addRespect } from './progression.js';
import { playPickup, playCash } from './audio.js';

export const RACE_START = { x: 2360, y: 200, name: 'Marina West pier' };
export const RACE_POINTS = [
  { x: 2360, y: 840 },
  { x: 1800, y: 1160 },
  { x: 1160, y: 1480 },
  { x: 520, y: 1160 },
  { x: 840, y: 520 },
  { x: 1800, y: 200 },
];
export const RACE_REWARD = 400;
export const RACE_RESPECT = 6;

export function createRaceState() {
  return { active: false, idx: 0, time: 0, best: 0 };
}

export function raceTarget(state) {
  const race = state.race;
  if (!race) return null;
  if (race.active) return RACE_POINTS[race.idx] || null;
  return RACE_START;
}

export function formatRaceTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m + ':' + s.toFixed(1).padStart(4, '0');
}

export function updateRace(state, dt) {
  if (!state.race) state.race = createRaceState();
  const race = state.race;
  const p = state.player;
  if (!race.active) {
    // Start: roll into the pier ring with a car.
    if (p.car && dist(p.x, p.y, RACE_START.x, RACE_START.y) < 64) {
      race.active = true;
      race.idx = 0;
      race.time = 0;
      state.message = 'RACE START! ' + RACE_POINTS.length + ' checkpoints — go!';
      state.messageUntil = state.clockSeconds + 3;
      playPickup(state.audio);
    }
    return;
  }
  race.time += dt;
  const target = RACE_POINTS[race.idx];
  if (target && p.car && dist(p.x, p.y, target.x, target.y) < 78) {
    race.idx += 1;
    playPickup(state.audio);
    if (race.idx >= RACE_POINTS.length) {
      race.active = false;
      const isBest = !race.best || race.time < race.best;
      if (isBest) race.best = race.time;
      state.money += RACE_REWARD;
      addRespect(state, RACE_RESPECT);
      playCash(state.audio);
      state.message = 'FINISH! ' + formatRaceTime(race.time) + ' — +$' + RACE_REWARD
        + (isBest ? ' (new record!)' : ' (record ' + formatRaceTime(race.best) + ')');
      state.messageUntil = state.clockSeconds + 5;
    } else {
      state.message = 'Checkpoint ' + race.idx + '/' + RACE_POINTS.length;
      state.messageUntil = state.clockSeconds + 1.5;
    }
  }
}
