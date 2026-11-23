// city.js — Solmar City's static geometry, merged into two lit builders:
// `ground` (base land, roads, markings, beach, the animated sea) and
// `props` (buildings with procedural-window walls, palms, trees, signs,
// harbour crane). Props are kept separate so render.js can project them
// onto the ground as real-time sun shadows. Pure data — no DOM, no GL —
// so Node tests can measure the geometry.

import { Builder, rgb, shade } from './gl.js';
import { hashSeed, makeRng } from './util.js';
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W } from './world.js';

const ASPHALT = rgb('#33373d');
const SIDEWALK = rgb('#9aa0a3');
const LANE = rgb('#d9c25a');
const CROSS = rgb('#e8e8e2');
const GRASS = rgb('#7da05c');
const SAND = rgb('#e6d09e');
const LAND = rgb('#b3a37f');
const WATER = rgb('#2e7f9e');

function buildingHeight(b) {
  const h = hashSeed(Math.round(b.x) + ',' + Math.round(b.y)) % 100;
  if (b.district === 'Harbour') return 5 + (h % 5);
  if (b.tall) return 44 + (h % 42);
  return 14 + (h % 17);
}

function palm(b, x, z, s) {
  const green = rgb('#3f7d3a');
  b.cyl(x, 13 * s, z, 1.0 * s, 1.7 * s, 26 * s, 5, rgb('#7a5a3c'));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + (x % 1.7);
    b.box(x + Math.cos(a) * 8 * s, 26.5 * s, z + Math.sin(a) * 8 * s,
      17 * s, 0.7, 3.6 * s, k % 2 ? green : shade('#3f7d3a', 1.25), { ry: -a });
  }
  b.box(x, 25.5 * s, z, 5 * s, 4 * s, 5 * s, shade('#3f7d3a', 0.8));
}

function leafyTree(b, x, z, s) {
  b.cyl(x, 6 * s, z, 0.9 * s, 1.3 * s, 12 * s, 5, rgb('#6b4a2f'));
  b.box(x, 16 * s, z, 15 * s, 10 * s, 15 * s, rgb('#4d8a44'));
  b.box(x, 21.5 * s, z, 10 * s, 6 * s, 10 * s, shade('#4d8a44', 1.2));
}

export function buildCity(world) {
  const ground = new Builder();
  const props = new Builder();

  // Far land under everything, then the city base and the south beach.
  ground.box(WORLD_W / 2, -0.35, WORLD_H / 2, 9000, 0.5, 9000, LAND);
  ground.box(WORLD_W / 2, -0.05, 1740 / 2, WORLD_W, 0.1, 1740, rgb('#a89a76'));
  ground.box(WORLD_W / 2, 0.02, (1740 + 1890) / 2, WORLD_W, 0.09, 150, SAND);
  // Palmera Park green.
  ground.box((1160 + 1480) / 2, 0.015, (840 + 1160) / 2, 232, 0.07, 232, GRASS);

  // The sea: a tessellated plane south of the beach (kind 2 = waves).
  {
    const x0 = -300, x1 = WORLD_W + 300, z0 = 1850, z1 = 2900;
    const nx = 30, nz = 10;
    const ids = [];
    for (let j = 0; j <= nz; j++) {
      ids[j] = [];
      for (let i = 0; i <= nx; i++) {
        ids[j][i] = ground.vert(
          x0 + ((x1 - x0) * i) / nx, -1.4, z0 + ((z1 - z0) * j) / nz,
          0, 1, 0, WATER, 2);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        ground.quad(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]);
      }
    }
  }

  // Sidewalks (under) and asphalt (over), then lane dashes and crosswalks.
  for (const x of V_ROADS) {
    ground.box(x, 0.03, WORLD_H / 2, ROAD_W + 36, 0.06, WORLD_H, SIDEWALK);
    ground.box(x, 0.07, WORLD_H / 2, ROAD_W, 0.08, WORLD_H, ASPHALT);
    for (let z = 40; z < WORLD_H - 30; z += 52) {
      ground.box(x, 0.115, z, 2.4, 0.03, 26, LANE);
    }
  }
  for (const y of H_ROADS) {
    ground.box(WORLD_W / 2, 0.045, y, WORLD_W, 0.06, ROAD_W + 36, SIDEWALK);
    ground.box(WORLD_W / 2, 0.085, y, WORLD_W, 0.08, ROAD_W, ASPHALT);
    for (let x = 40; x < WORLD_W - 30; x += 52) {
      ground.box(x, 0.13, y, 26, 0.03, 2.4, LANE);
    }
  }
  for (const x of V_ROADS) {
    for (const y of H_ROADS) {
      for (let i = -2; i <= 2; i++) {
        ground.box(x + i * 13, 0.125, y - ROAD_W / 2 - 9, 7, 0.03, 10, CROSS);
        ground.box(x - ROAD_W / 2 - 9, 0.125, y + i * 13, 10, 0.03, 7, CROSS);
      }
      // One traffic-light pole per crossing.
      props.cyl(x + 46, 5, y + 46, 0.5, 0.65, 10, 6, rgb('#22262a'));
      props.box(x + 46, 11, y + 46, 2.4, 5, 2.4, rgb('#14171a'));
    }
  }

  // Buildings: windowed walls (kind 1), a roof slab, rooftop clutter.
  for (const b of world.buildings) {
    const h = buildingHeight(b);
    const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
    const wall = rgb(b.color);
    props.box(cx, h / 2, cz, b.w, h, b.h, wall, { kind: 1, kindTop: 0 });
    props.box(cx, h + 0.7, cz, b.w * 0.94, 1.4, b.h * 0.94, rgb(b.roof));
    const r = hashSeed('clutter' + Math.round(b.x) + ',' + Math.round(b.y)) % 100;
    if (r < 45 && b.district !== 'Harbour') {
      props.box(cx + (r % 7) - 3, h + 3, cz + (r % 5) - 2, 7, 3.4, 6, shade(b.roof, 1.35));
    }
    if (r >= 45 && r < 58 && b.district !== 'Harbour') {
      props.cyl(cx - 4, h + 2.6, cz + 3, 2.6, 2.6, 2.6, 8, shade(b.roof, 1.5));
    }
  }

  // Trees and palms from the world data (hash picks the species).
  for (const t of world.trees) {
    const s = 0.8 + (t.r / 12) * 0.5;
    const h = hashSeed('tree' + Math.round(t.x) + ',' + Math.round(t.y)) % 100;
    if (h < 55) palm(props, t.x, t.y, s);
    else leafyTree(props, t.x, t.y, s);
  }

  // Udin's Garage sign on the Southside corner (place at 840, 1480).
  props.cyl(788, 9, 1428, 0.5, 0.65, 18, 6, rgb('#22262a'));
  props.box(788, 17.5, 1428, 3, 9, 26, rgb('#1248c0'), { kind: 3 });
  props.box(788, 17.5, 1428, 3.4, 2.2, 26, rgb('#ffd34d'), { kind: 3 });

  // A harbour crane over the yards.
  const crane = rgb('#c85a20');
  props.box(2260, 26, 1600, 5, 52, 5, crane);
  props.box(2330, 26, 1600, 5, 52, 5, crane);
  props.box(2295, 54, 1600, 150, 5, 6, crane);
  props.box(2240, 44, 1600, 2, 16, 2, rgb('#333333'));
  props.box(2240, 34, 1600, 12, 6, 10, rgb('#4d7d8a'));

  return { ground, props };
}

// Sun for a game clock (minutes): direction TO the sun, its colour, the
// ambient floor and the fog colour. Golden in the morning and evening,
// white at noon, deep blue at night. Deterministic in the clock alone.
export function sunForClock(minutes) {
  const t = ((minutes % 1440) + 1440) % 1440;
  const day = (t - 360) / (1140 - 360); // 06:00 -> 0, 19:00 -> 1
  const ang = Math.PI * (0.08 + 0.84 * Math.min(1, Math.max(0, day)));
  const elev = Math.sin(ang) * 0.95 + 0.04;
  const azim = Math.cos(ang); // +x (east) in the morning, -x (west) by dusk
  const dir = [azim * 0.82, Math.max(elev, 0.03), 0.42];
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  const sunDir = [dir[0] / l, dir[1] / l, dir[2] / l];
  const warmth = 1 - Math.min(1, Math.max(0, elev) * 1.6); // 1 at horizon
  const night = t < 330 || t > 1170;
  if (night) {
    return {
      sunDir: [0.3, 0.8, 0.2], sunCol: [0.22, 0.28, 0.42],
      amb: [0.16, 0.19, 0.28], fog: [0.05, 0.08, 0.14],
      zen: [0.02, 0.04, 0.10], hor: [0.10, 0.13, 0.22], fogDen: 0.00042,
    };
  }
  const mixc = (a, b, f) => a + (b - a) * f;
  return {
    sunDir,
    sunCol: [mixc(1.25, 1.05, 1 - warmth), mixc(0.62, 0.98, 1 - warmth), mixc(0.34, 0.92, 1 - warmth)],
    amb: [0.42 + 0.1 * (1 - warmth), 0.36, 0.30],
    fog: [0.98, 0.72 + 0.1 * (1 - warmth), 0.52 + 0.18 * (1 - warmth)],
    zen: [0.30, 0.52, 0.86],
    hor: [1.0, 0.76, 0.52],
    fogDen: 0.00030,
  };
}

// A seeded RNG re-export so callers that only need the city keep one import.
export { makeRng };
