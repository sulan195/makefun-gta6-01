// progression.js — Mara's street reputation: Respect points and the five
// ranks they unlock. Pure data + helpers; missions, fares and fights award
// points through addRespect, and the later story missions require a rank
// before Dax will hand them out.

export const RANKS = [
  { name: 'Orang Baru', min: 0 },
  { name: 'Kenalan Jalanan', min: 20 },
  { name: 'Sopir Kru', min: 45 },
  { name: 'Tangan Kanan', min: 80 },
  { name: 'Legenda Solmar', min: 130 },
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
    state.message = 'Respect naik! Kamu sekarang ' + RANKS[after].name + '.';
    state.messageUntil = state.clockSeconds + 4;
    return true;
  }
  return false;
}
