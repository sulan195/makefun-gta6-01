// world.js — Solmar City: an original sun-soaked coastal city, generated from a
// seed. Roads on a grid, blocks holding buildings, one park district, a harbour
// along the south edge, sidewalks, crosswalks and traffic lights at crossings.
// Everything is plain data; render.js draws it, entities.js drives on it.

import { makeRng, pick, range } from './util.js';

export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROAD_W = 72;
export const SIDEWALK = 18;

// Vertical road centre x positions, horizontal road centre y positions.
export const V_ROADS = [200, 520, 840, 1160, 1480, 1800, 2120, 2360];
export const H_ROADS = [200, 520, 840, 1160, 1480, 1680];

const BUILDING_COLORS = [
  '#e8b48a', '#d9a06f', '#c98f5f', '#b7c4c9', '#9fb3bd', '#d6c9a8',
  '#e0cfae', '#c2a878', '#a8b8a0', '#d8b7a0', '#8fa8b8', '#e6d3b3',
];
const ROOF_COLORS = ['#7d6a58', '#5f7280', '#8a6f5c', '#6b7d6e', '#74604e'];

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parkedSpots = [];

  // District names, by block column/row, for flavour text on the HUD.
  const districts = [];
  for (let r = 0; r < H_ROADS.length - 1; r++) {
    districts[r] = [];
    for (let c = 0; c < V_ROADS.length - 1; c++) {
      if (r === H_ROADS.length - 2 && c >= 4) districts[r][c] = 'Harbour';
      else if (r === 2 && c === 3) districts[r][c] = 'Palmera Park';
      else if (r <= 1) districts[r][c] = 'Old Town';
      else if (c <= 1) districts[r][c] = 'Marina West';
      else if (r >= 3) districts[r][c] = 'Southside';
      else districts[r][c] = 'Downtown';
    }
  }

  for (let r = 0; r < H_ROADS.length - 1; r++) {
    for (let c = 0; c < V_ROADS.length - 1; c++) {
      const x0 = V_ROADS[c] + ROAD_W / 2 + SIDEWALK;
      const x1 = V_ROADS[c + 1] - ROAD_W / 2 - SIDEWALK;
      const y0 = H_ROADS[r] + ROAD_W / 2 + SIDEWALK;
      const y1 = H_ROADS[r + 1] - ROAD_W / 2 - SIDEWALK;
      const district = districts[r][c];
      if (district === 'Palmera Park') {
        // A green square with palm trees and a pond, no buildings.
        for (let i = 0; i < 26; i++) {
          trees.push({
            x: range(rng, x0 + 14, x1 - 14),
            y: range(rng, y0 + 14, y1 - 14),
            r: range(rng, 7, 12),
          });
        }
        continue;
      }
      if (district === 'Harbour') {
        // Crates and containers near the docks, no tall buildings.
        for (let i = 0; i < 5; i++) {
          buildings.push({
            x: range(rng, x0, x1 - 90), y: range(rng, y0, y1 - 50),
            w: range(rng, 60, 90), h: range(rng, 34, 50),
            color: pick(rng, ['#b0703c', '#4d7d8a', '#7a8a4d', '#96604a']),
            roof: '#5c4a3a', tall: false, district,
          });
        }
        continue;
      }
      // Ordinary block: 2-4 buildings with gaps between them.
      const cols = rng() < 0.5 ? 2 : 3;
      const rows = rng() < 0.5 ? 1 : 2;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (rng() < 0.12) continue; // empty lot with a tree or two
          const bx = x0 + i * cw + 8;
          const by = y0 + j * ch + 8;
          const bw = cw - 16 - rng() * 20;
          const bh = ch - 16 - rng() * 20;
          buildings.push({
            x: bx, y: by, w: Math.max(40, bw), h: Math.max(34, bh),
            color: pick(rng, BUILDING_COLORS),
            roof: pick(rng, ROOF_COLORS),
            tall: rng() < 0.3, district,
          });
        }
      }
      if (rng() < 0.6) {
        trees.push({ x: x0 + 10, y: y0 + 10, r: 8 });
        trees.push({ x: x1 - 10, y: y1 - 10, r: 8 });
      }
    }
  }

  // Parked cars along a few road edges.
  for (let i = 0; i < 14; i++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const rx = pick(rng, V_ROADS);
      parkedSpots.push({
        x: rx + ROAD_W / 2 - 12,
        y: range(rng, 240, WORLD_H - 240),
        angle: Math.PI / 2,
      });
    } else {
      const ry = pick(rng, H_ROADS);
      parkedSpots.push({
        x: range(rng, 240, WORLD_W - 240),
        y: ry + ROAD_W / 2 - 12,
        angle: 0,
      });
    }
  }

  // Traffic lights: one per crossing, cycling on a shared clock.
  const lights = [];
  for (const y of H_ROADS) {
    for (const x of V_ROADS) {
      lights.push({ x, y, phase: (x + y) % 2 === 0 ? 0 : 1 });
    }
  }

  return {
    seed, buildings, trees, parkedSpots, lights, districts,
    // Named places the missions use.
    places: {
      taxiStand: { x: 520, y: 520, name: 'Taxi stand, Old Town' },
      marina: { x: 2360, y: 200, name: 'Marina West pier' },
      parkGate: { x: 1160, y: 840, name: 'Palmera Park gate' },
      harbourYard: { x: 2120, y: 1680, name: 'Harbour yard' },
      downtown: { x: 1480, y: 840, name: 'Downtown plaza' },
      hospital: { x: 840, y: 200, name: 'St. Anselm Hospital' },
    },
  };
}

// Which road (if any) is the point on? Returns {axis:'v'|'h', index, along}
// or null when the point is inside a block.
export function roadAt(x, y) {
  for (let i = 0; i < V_ROADS.length; i++) {
    if (Math.abs(x - V_ROADS[i]) <= ROAD_W / 2) return { axis: 'v', index: i, along: y };
  }
  for (let i = 0; i < H_ROADS.length; i++) {
    if (Math.abs(y - H_ROADS[i]) <= ROAD_W / 2) return { axis: 'h', index: i, along: x };
  }
  return null;
}

export function isOnRoad(x, y) {
  return roadAt(x, y) !== null;
}

// Nearest road centre point to (x, y): used to snap pedestrians to sidewalks.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of V_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, axis: 'v' }; }
  }
  for (const ry of H_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, axis: 'h' }; }
  }
  return best;
}

// District name for a point, for the HUD location line.
export function districtAt(world, x, y) {
  let c = 0;
  for (let i = 0; i < V_ROADS.length - 1; i++) if (x > V_ROADS[i]) c = i;
  let r = 0;
  for (let i = 0; i < H_ROADS.length - 1; i++) if (y > H_ROADS[i]) r = i;
  return world.districts[r][c];
}
