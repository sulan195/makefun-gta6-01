// util.js — small pure helpers shared by every Solmar City module.
// Nothing here touches the DOM, so Node can import this file for tests.

// mulberry32: a tiny deterministic PRNG. Same seed -> same stream, every run.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Shortest signed turn from angle a to angle b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

// Circle vs axis-aligned box: true when they overlap.
export function circleHitsBox(cx, cy, r, bx, by, bw, bh) {
  const nx = clamp(cx, bx, bx + bw);
  const ny = clamp(cy, by, by + bh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Push a circle out of an axis-aligned box; returns the corrected position.
export function pushCircleOutOfBox(cx, cy, r, bx, by, bw, bh) {
  const nx = clamp(cx, bx, bx + bw);
  const ny = clamp(cy, by, by + bh);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x: cx, y: cy, hit: false };
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: true };
  }
  // Centre is inside the box: push out along the smallest penetration.
  const left = cx - bx;
  const right = bx + bw - cx;
  const top = cy - by;
  const bottom = by + bh - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: bx - r, y: cy, hit: true };
  if (m === right) return { x: bx + bw + r, y: cy, hit: true };
  if (m === top) return { x: cx, y: by - r, hit: true };
  return { x: cx, y: by + bh + r, hit: true };
}

export function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function formatMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
