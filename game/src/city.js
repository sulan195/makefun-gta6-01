
import { Builder, rgb, shade } from './gl.js';
import { hashSeed } from './util.js';
import { WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_W } from './world.js';

const ASPHALT = rgb('#33373d');
const SIDEWALK = rgb('#9aa0a3');
const LANE = rgb('#d9c25a');
const CROSS = rgb('#e8e8e2');
const GRASS = rgb('#7da05c');
const SAND = rgb('#e6d09e');
const LAND = rgb('#b3a37f');
const WATER = rgb('#1d5f8a');

function buildingHeight(b) {
  const h = hashSeed(Math.round(b.x) + ',' + Math.round(b.y)) % 100;
  if (b.district === 'Harbour') return 30 + (h % 16);
  if (b.tall) return 78 + (h % 64);
  return 30 + (h % 22);
}

function palm(b, x, z, s) {
  const green = rgb('#3f7d3a');
  b.cyl(x, 13 * s, z, 1.0 * s, 1.7 * s, 26 * s, 5, rgb('#7a5a3c'));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + (x % 1.7);
    b.box(x + Math.cos(a) * 8 * s, 26.5 * s, z + Math.sin(a) * 8 * s,
      17 * s, 0.7, 3.6 * s, k % 2 ? green : shade('#3f7d3a', 1.25), { ry: -a });
    b.box(x + Math.cos(a + 0.52) * 9 * s, 24.4 * s, z + Math.sin(a + 0.52) * 9 * s,
      15 * s, 0.6, 3.2 * s, shade('#3f7d3a', 0.8), { ry: -a - 0.52 });
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

  ground.box(WORLD_W / 2, -0.35, WORLD_H / 2, 9000, 0.5, 9000, LAND);
  ground.box(WORLD_W / 2, -0.05, 1740 / 2, WORLD_W, 0.1, 1740, rgb('#a89a76'));
  ground.box(WORLD_W / 2, 0.02, (1740 + 1890) / 2, WORLD_W, 0.09, 150, SAND);
  ground.box((1160 + 1480) / 2, 0.015, (840 + 1160) / 2, 232, 0.07, 232, GRASS);

  for (let i = 0; i < 44; i++) {
    const a = (i % 6) * (Math.PI / 3) + (hashSeed('sky' + i) % 100) / 100 * 0.34 - 0.17;
    const rad = 2700 + (hashSeed('skyr' + i) % 500);
    const x = 1280 + Math.cos(a) * rad, z = 1000 + Math.sin(a) * rad;
    if (z > 1750 && z < 3050 && x > -350 && x < 2900) continue;
    const hh = 55 + (hashSeed('skyh' + i) % 95);
    ground.box(x, hh / 2 - 2, z, 80 + (hashSeed('skyw' + i) % 70), hh,
      80, rgb('#55677e'));
  }

  for (let i = 0; i < 70; i++) {
    ground.box(60 + (hashSeed('sand' + i) % 2400), 0.075,
      1754 + (hashSeed('sandz' + i) % 124),
      26 + (hashSeed('sandw' + i) % 42), 0.05, 12 + (hashSeed('sandd' + i) % 16),
      shade('#e6d09e', 0.88 + (hashSeed('sandc' + i) % 17) / 100));
  }
  const TOWEL = ['#e2543e', '#3e7dc9', '#f0b429', '#7dbb6a', '#c95f8a'];
  for (let i = 0; i < 24; i++) {
    ground.box(120 + (hashSeed('towel' + i) % 2300), 0.09,
      1762 + (hashSeed('towelz' + i) % 108), 12, 0.06, 20,
      rgb(TOWEL[i % 5]), { ry: (hashSeed('towelr' + i) % 60) / 100 });
  }
  for (let i = 0; i < 26; i++) {
    ground.box(1216 + (hashSeed('grass' + i) % 208), 0.075,
      896 + (hashSeed('grassz' + i) % 208),
      20 + (hashSeed('grassw' + i) % 26), 0.05, 14 + (hashSeed('grassd' + i) % 18),
      shade('#7da05c', 0.88 + (hashSeed('grassc' + i) % 16) / 100));
  }

  {
    const x0 = -300, x1 = WORLD_W + 300, z0 = 1900, z1 = 3600;
    const nx = 30, nz = 10;
    const ids = [];
    for (let j = 0; j <= nz; j++) {
      ids[j] = [];
      for (let i = 0; i <= nx; i++) {
        ids[j][i] = ground.vert(
          x0 + ((x1 - x0) * i) / nx, 0.05, z0 + ((z1 - z0) * j) / nz,
          0, 1, 0, WATER, 2);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        ground.quad(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]);
      }
    }
  }

  for (let x = 24; x < WORLD_W - 20; x += 44) {
    const j = hashSeed('foam' + x) % 100;
    ground.box(x + (j % 16), 0.09, 1892 + (j % 7), 32 + (j % 14), 0.05, 8,
      shade('#eef7f2', 0.9 + (j % 11) / 100));
  }

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
        ground.box(x + i * 15, 0.125, y - ROAD_W / 2 - 9, 8, 0.03, 10, CROSS);
        ground.box(x + i * 15, 0.125, y + ROAD_W / 2 + 9, 8, 0.03, 10, CROSS);
        ground.box(x - ROAD_W / 2 - 9, 0.125, y + i * 15, 10, 0.03, 8, CROSS);
        ground.box(x + ROAD_W / 2 + 9, 0.125, y + i * 15, 10, 0.03, 8, CROSS);
      }
      props.cyl(x + 46, 5, y + 46, 0.5, 0.65, 10, 6, rgb('#22262a'));
      props.box(x + 46, 11, y + 46, 2.4, 5, 2.4, rgb('#14171a'));
    }
  }

  const lampPole = rgb('#2a2e33');
  const lampHead = rgb('#ffd9a0');
  const lampAt = (x, z) => {
    props.cyl(x, 8, z, 0.35, 0.5, 16, 5, lampPole);
    props.box(x, 16.6, z, 3.4, 1.6, 3.4, lampHead, { kind: 3 });
  };
  for (const x of V_ROADS) {
    for (let z = 120, s = 0; z < WORLD_H - 60; z += 168, s++) lampAt(x + (s % 2 ? 44 : -44), z);
  }
  for (const y of H_ROADS) {
    for (let x = 130, s = 0; x < WORLD_W - 60; x += 168, s++) lampAt(x, y + (s % 2 ? -44 : 44));
  }

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
    if (b.tall && r >= 60 && r < 80) {
      props.spanel(cx, h + 1.4, cz + b.h / 2 + 1, b.w * 0.66, 8, 0, r % 8);
    }
    const r2 = hashSeed('sign' + Math.round(b.x) + ',' + Math.round(b.y)) % 100;
    if (r2 < 38 && h >= 19 && b.district !== 'Harbour') {
      const nv = V_ROADS.reduce((m, a2) =>
        Math.abs(a2 - cx) < Math.abs(m - cx) ? a2 : m, V_ROADS[0]);
      const nh = H_ROADS.reduce((m, a2) =>
        Math.abs(a2 - cz) < Math.abs(m - cz) ? a2 : m, H_ROADS[0]);
      if (Math.abs(nv - cx) < Math.abs(nh - cz)) {
        const east = nv > cx;
        props.spanel(east ? b.x + b.w + 0.7 : b.x - 0.7, 9, cz,
          Math.min(b.h * 0.72, 62), 7.5, east ? -Math.PI / 2 : Math.PI / 2,
          r2 % 8);
      } else {
        const south = nh > cz;
        props.spanel(cx, 9, south ? b.y + b.h + 0.7 : b.y - 0.7,
          Math.min(b.w * 0.72, 62), 7.5, south ? 0 : Math.PI, r2 % 8);
      }
    }
  }

  for (const t of world.trees) {
    const s = (0.8 + (t.r / 12) * 0.5) * 1.25;
    const h = hashSeed('tree' + Math.round(t.x) + ',' + Math.round(t.y)) % 100;
    if (h < 55) palm(props, t.x, t.y, s);
    else leafyTree(props, t.x, t.y, s);
  }

  props.cyl(788, 9, 1428, 0.5, 0.65, 18, 6, rgb('#22262a'));
  props.box(788, 17.5, 1428, 3, 9, 26, rgb('#1248c0'), { kind: 3 });
  props.box(788, 17.5, 1428, 3.4, 2.2, 26, rgb('#ffd34d'), { kind: 3 });
  props.spanel(790, 13.5, 1428, 24, 8, -Math.PI / 2, 2);

  const crane = rgb('#c85a20');
  for (const [cx, cz] of [[2295, 1600], [1887, 1596]]) {
    props.box(cx - 35, 26, cz, 5, 52, 5, crane);
    props.box(cx + 35, 26, cz, 5, 52, 5, crane);
    props.box(cx, 54, cz, 150, 5, 6, crane);
    props.box(cx - 55, 44, cz, 2, 16, 2, rgb('#333333'));
    props.box(cx - 55, 34, cz, 12, 6, 10, rgb('#4d7d8a'));
  }

  const CONT = ['#b3402e', '#2e6fb3', '#3f8a4d', '#c9862b', '#7a4d8a', '#4d7d8a'];
  for (let c = 4; c < V_ROADS.length - 1; c++) {
    const x0 = V_ROADS[c] + 62;
    for (const z of [1556, 1608]) {
      for (let x = x0 + 20; x < V_ROADS[c + 1] - 90; x += 46) {
        const h = hashSeed('cont' + x + ',' + z) % 100;
        if (h < 18) continue;
        for (let s = 0; s < 3 && (s === 0 || h > 24 + s * 31); s++) {
          props.box(x, 6.5 + s * 13, z, 38, 13, 15, rgb(CONT[(h >> (s * 3)) % 6]));
        }
      }
    }
  }

  ground.box(WORLD_W / 2, 0.06, 1718, WORLD_W - 80, 0.1, 44, rgb('#c9b18a'));
  for (let x = 90; x < WORLD_W - 60; x += 118) {
    if (V_ROADS.some((rx) => Math.abs(x - rx) < 58)) continue;
    palm(props, x, 1724, 0.95);
  }
  const UMB = ['#e2543e', '#f2f0e6', '#3e7dc9', '#f0b429'];
  for (let i = 0; i < 22; i++) {
    const x = 150 + i * 108 + (hashSeed('umb' + i) % 60);
    const z = 1796 + (hashSeed('umbz' + i) % 56);
    props.cyl(x, 5, z, 0.3, 0.4, 10, 5, rgb('#e8e2d2'));
    props.box(x, 10.6, z, 17, 1.1, 17, rgb(UMB[i % 4]));
  }
  props.box(2150, 1.2, 1975, 26, 2.4, 250, rgb('#8a6f4d'));
  for (let z = 1870; z <= 2080; z += 42) {
    for (const px of [2139, 2161]) props.cyl(px, -1, z, 1.1, 1.1, 6, 5, rgb('#6b543a'));
  }
  const HULL = ['#f0ead8', '#c23b2e', '#2e6fc2', '#e8b13c'];
  for (let i = 0; i < 11; i++) {
    const x = 200 + i * 215 + (hashSeed('boat' + i) % 90);
    const z = 2030 + (hashSeed('boatz' + i) % 260);
    props.box(x, 1.5, z, 30, 5, 10, rgb(HULL[i % 4]));
    props.box(x - 2, 5.5, z, 12, 3.5, 7, rgb('#f6f2e6'));
    props.cyl(x + 4, 13, z, 0.3, 0.4, 16, 4, rgb('#d8d2c2'));
  }
  for (let i = 0; i < 3; i++) {
    const x = 500 + i * 800 + (hashSeed('sb' + i) % 200);
    const z = 2250 + (hashSeed('sbz' + i) % 200);
    props.box(x, 1.1, z, 27, 3.4, 8.5, rgb('#f6f2e6'));
    props.box(x + 1, 3.6, z, 10, 2.2, 6.5, rgb('#2e6fc2'));
    props.box(x - 10, 3.4, z, 5, 3, 6, rgb('#24272b'));
    const wk = rgb('#d7edf5');
    for (const sd of [-1, 1]) {
      const a1 = ground.vert(x - 14, 0.22, z + sd * 3, 0, 1, 0, wk);
      const a2 = ground.vert(x - 14, 0.22, z + sd * 5.2, 0, 1, 0, wk);
      const a3 = ground.vert(x - 46, 0.22, z + sd * 13.5, 0, 1, 0, wk);
      const a4 = ground.vert(x - 46, 0.22, z + sd * 11.3, 0, 1, 0, wk);
      ground.quad(a1, a2, a3, a4);
    }
  }

  return { ground, props };
}

export function sunForClock(minutes) {
  const t = ((minutes % 1440) + 1440) % 1440;
  const day = (t - 360) / (1140 - 360);
  const ang = Math.PI * (0.08 + 0.84 * Math.min(1, Math.max(0, day)));
  const elev = Math.sin(ang) * 0.95 + 0.04;
  const azim = Math.cos(ang);
  const dir = [azim * 0.82, Math.max(elev, 0.03), 0.42];
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  const sunDir = [dir[0] / l, dir[1] / l, dir[2] / l];
  const warmth = 1 - Math.min(1, Math.max(0, elev) * 1.6);
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
    sunCol: [mixc(1.42, 1.16, 1 - warmth), mixc(0.74, 1.06, 1 - warmth), mixc(0.44, 1.0, 1 - warmth)],
    amb: [0.56 + 0.08 * (1 - warmth), 0.53, 0.48],
    fog: [1.0, 0.76 + 0.1 * (1 - warmth), 0.58 + 0.16 * (1 - warmth)],
    zen: [0.30, 0.52, 0.86],
    hor: [1.0, 0.80, 0.58],
    fogDen: 0.00030,
  };
}
