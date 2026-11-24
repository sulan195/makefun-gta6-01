// progression.js — Respect ranks for Mara's rise.

export const RANKS = [
  { name: 'Newcomer', min: 0 },
  { name: 'Street Connection', min: 20 },
  { name: 'Crew Driver', min: 45 },
  { name: 'Right Hand', min: 80 },
  { name: 'Legend of Solmar', min: 130 },
];

export function rankIndexFor(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if ((respect || 0) >= RANKS[i].min) idx = i;
  }
  return idx;
}

export function rankFor(respect) {
  return RANKS[rankIndexFor(respect)];
}

export function nextRank(respect) {
  const i = rankIndexFor(respect);
  return i + 1 < RANKS.length ? RANKS[i + 1] : null;
}

// Award Respect points. Returns true when a rank was gained (and says so).
export function addRespect(state, amount) {
  if (!amount) return false;
  const before = rankIndexFor(state.respect);
  state.respect = (state.respect || 0) + amount;
  const after = rankIndexFor(state.respect);
  if (after > before) {
    state.message = 'Respect up! You are now ' + RANKS[after].name + '.';
    state.messageUntil = state.clockSeconds + 4;
    return true;
  }
  return false;
}
