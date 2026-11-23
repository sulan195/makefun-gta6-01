// render.js — draws Solmar City: the camera, the streets, the buildings, the
// cars and people, the mission beacon, particles, and the time-of-day light.
// The unmoving city (roads, blocks, buildings, trees, beach) is painted once
// into an offscreen canvas; every frame blits that layer and draws only
// what moves — traffic lights, water sparkle, vehicles, the CONDOR
// helicopter and its searchlight — on top.

import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, ROAD_W } from './world.js';
import { clamp, lerp } from './util.js';
import { raceTarget, RACE_START } from './races.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;

export function createView() {
  return { camX: 0, camY: 0, w: VIEW_W, h: VIEW_H };
}

// Smooth camera follow: the camera chases the player, never leaving the city.
export function updateCamera(view, px, py, dt) {
  const tx = clamp(px - view.w / 2, 0, WORLD_W - view.w);
  const ty = clamp(py - view.h / 2, 0, WORLD_H - view.h);
  const k = 1 - Math.pow(0.001, dt);
  view.camX = lerp(view.camX, tx, k);
  view.camY = lerp(view.camY, ty, k);
}

// Warm afternoon light, cool morning, dark night — from the in-game clock.
export function daylightTint(clockMinutes) {
  const h = (clockMinutes / 60) % 24;
  if (h >= 6 && h < 10) return 'rgba(255, 214, 150, 0.05)';
  if (h >= 10 && h < 15) return 'rgba(255, 255, 255, 0)';
  if (h >= 15 && h < 18) return 'rgba(255, 166, 66, 0.14)';
  if (h >= 18 && h < 20) return 'rgba(120, 80, 160, 0.20)';
  return 'rgba(10, 20, 60, 0.32)';
}

export function isNight(clockMinutes) {
  const h = (clockMinutes / 60) % 24;
  return h < 6 || h >= 19;
}

function inView(view, x, y, m = 80) {
  return x > view.camX - m && x < view.camX + view.w + m
    && y > view.camY - m && y < view.camY + view.h + m;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Small deterministic hash of a position, for decoration that must not
// consume the world RNG (roof clutter, sand speckle, palm placement).
function hash2(x, y) {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function drawCarShape(ctx, car, isPlayer, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -21, -11 + 4, 46, 24, 7);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#141414';
  ctx.fillRect(-16, -14, 10, 5);
  ctx.fillRect(6, -14, 10, 5);
  ctx.fillRect(-16, 9, 10, 5);
  ctx.fillRect(6, 9, 10, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -23, -12, 46, 24, 7);
  ctx.fill();
  // Roof + windshield.
  ctx.fillStyle = 'rgba(20,30,40,0.85)';
  roundRect(ctx, -6, -10, 16, 20, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.75)';
  ctx.fillRect(8, -9, 5, 18);
  // Brake lights.
  if (car.braking) {
    ctx.fillStyle = '#ff2d1e';
    ctx.fillRect(-24, -10, 3, 5);
    ctx.fillRect(-24, 5, 3, 5);
  }
  // Headlights at night.
  if (night) {
    ctx.fillStyle = 'rgba(255, 240, 170, 0.9)';
    ctx.fillRect(22, -9, 3, 4);
    ctx.fillRect(22, 5, 3, 4);
  }
  // Police light bar.
  if (car.kind === 'police') {
    const flash = Math.floor(car.sirenPhase * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d5bff';
    ctx.fillRect(-4, -12, 6, 5);
    ctx.fillStyle = flash ? '#2d5bff' : '#ff2d2d';
    ctx.fillRect(-4, 7, 6, 5);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-23, -12, 46, 4);
  }
  // Mission target car: yellow ring.
  if (car.missionTarget) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Player car: white outline so the eye finds it.
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    roundRect(ctx, -23, -12, 46, 24, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPersonShape(ctx, x, y, angle, shirt, down, isPlayer, punchAnim) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    roundRect(ctx, -13, -6, 26, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(15, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = shirt;
  roundRect(ctx, -9, -8, 18, 16, 6);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(10, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Cap for Mara.
  if (isPlayer) {
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(10, 0, 6.5, -1.2, 1.2);
    ctx.fill();
    ctx.fillRect(14, -3, 6, 6);
  }
  // Punch arm.
  if (punchAnim > 0) {
    ctx.strokeStyle = '#e8b98a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
  }
  ctx.restore();
}

// --- the static city layer ---------------------------------------------------

function isPalm(t) {
  return t.y > 1500 || (Math.floor(t.x) + Math.floor(t.y)) % 4 === 0;
}

function drawPalm(c, t) {
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(t.x + 6, t.y + 12);
  c.lineTo(t.x + 2, t.y + 2);
  c.stroke();
  c.strokeStyle = '#8a6f4d';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(t.x + 4, t.y + 9);
  c.lineTo(t.x, t.y - 2);
  c.stroke();
  // Fronds: six arcs fanning from the crown.
  c.strokeStyle = '#3e7d33';
  c.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    c.beginPath();
    c.moveTo(t.x, t.y - 2);
    c.quadraticCurveTo(
      t.x + Math.cos(a) * t.r * 0.9, t.y - 2 + Math.sin(a) * t.r * 0.9 - 4,
      t.x + Math.cos(a) * t.r * 1.5, t.y - 2 + Math.sin(a) * t.r * 1.5 + 5,
    );
    c.stroke();
  }
}

function drawGarageStatic(c, world) {
  const g = world.places.garage;
  if (!g) return;
  // Concrete pad, workshop block, big roller door, painted sign.
  c.fillStyle = '#8f8f8a';
  c.fillRect(g.x - 78, g.y - 52, 156, 104);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(g.x - 62, g.y - 34, 124, 72);
  c.fillStyle = '#7a6a58';
  c.fillRect(g.x - 66, g.y - 38, 132, 76);
  c.fillStyle = '#4c4438';
  c.fillRect(g.x - 60, g.y - 32, 120, 64);
  c.fillStyle = '#2e2a24';
  c.fillRect(g.x - 30, g.y - 30, 60, 60);
  c.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 4; i++) c.fillRect(g.x - 30, g.y - 22 + i * 15, 60, 3);
  c.fillStyle = '#ffd34d';
  c.font = 'bold 17px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText('GARASI', g.x, g.y - 44);
  c.fillStyle = '#e8e0cc';
  c.font = '10px system-ui, sans-serif';
  c.fillText('BANG UDIN · TUNE · RESPRAY', g.x, g.y + 48);
}

function buildStaticLayer(world) {
  const cv = document.createElement('canvas');
  cv.width = WORLD_W;
  cv.height = WORLD_H;
  const c = cv.getContext('2d');

  // Ground: dry grass / sand base.
  c.fillStyle = '#bfa96f';
  c.fillRect(0, 0, WORLD_W, WORLD_H);

  // South shore: sand band, then harbour water.
  c.fillStyle = '#2d6a8a';
  c.fillRect(0, 1772, WORLD_W, WORLD_H - 1772);
  c.fillStyle = '#35789c';
  c.fillRect(0, 1830, WORLD_W, WORLD_H - 1830);
  c.fillStyle = '#ecd7a0';
  c.fillRect(0, 1718, WORLD_W, 56);
  c.fillStyle = 'rgba(160,130,80,0.5)';
  for (let x = 20; x < WORLD_W; x += 37) {
    for (let y = 1726; y < 1770; y += 17) {
      if (hash2(x, y) % 3 === 0) c.fillRect(x, y, 4, 2);
    }
  }

  // Park: green square.
  c.fillStyle = '#5d8a4a';
  c.fillRect(1214, 894, 212, 212);
  c.fillStyle = '#548040';
  c.fillRect(1230, 910, 180, 180);

  // Blocks: pavement base between roads.
  c.fillStyle = '#a08c6e';
  for (let r = 0; r < H_ROADS.length - 1; r++) {
    for (let col = 0; col < V_ROADS.length - 1; col++) {
      const x0 = V_ROADS[col] + ROAD_W / 2;
      const y0 = H_ROADS[r] + ROAD_W / 2;
      const x1 = V_ROADS[col + 1] - ROAD_W / 2;
      const y1 = H_ROADS[r + 1] - ROAD_W / 2;
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Roads.
  c.fillStyle = '#3c3c42';
  for (const x of V_ROADS) c.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of H_ROADS) c.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);

  // Solid edge lines.
  c.fillStyle = 'rgba(238,238,220,0.55)';
  for (const x of V_ROADS) {
    c.fillRect(x - ROAD_W / 2 + 3, 0, 3, WORLD_H);
    c.fillRect(x + ROAD_W / 2 - 6, 0, 3, WORLD_H);
  }
  for (const y of H_ROADS) {
    c.fillRect(0, y - ROAD_W / 2 + 3, WORLD_W, 3);
    c.fillRect(0, y + ROAD_W / 2 - 6, WORLD_W, 3);
  }

  // Lane dashes.
  c.fillStyle = '#d8d8c8';
  for (const x of V_ROADS) {
    for (let y = 40; y < WORLD_H; y += 80) c.fillRect(x - 2, y, 4, 34);
  }
  for (const y of H_ROADS) {
    for (let x = 40; x < WORLD_W; x += 80) c.fillRect(x, y - 2, 34, 4);
  }

  // Crosswalks + stop lines at every crossing.
  c.fillStyle = 'rgba(240,240,230,0.85)';
  for (const cy of H_ROADS) {
    for (const cx of V_ROADS) {
      for (let i = -3; i <= 3; i++) {
        c.fillRect(cx + i * 10 - 3, cy - ROAD_W / 2 + 4, 6, 12);
        c.fillRect(cx + i * 10 - 3, cy + ROAD_W / 2 - 16, 6, 12);
        c.fillRect(cx - ROAD_W / 2 + 4, cy + i * 10 - 3, 12, 6);
        c.fillRect(cx + ROAD_W / 2 - 16, cy + i * 10 - 3, 12, 6);
      }
      c.fillRect(cx - ROAD_W / 2 + 8, cy - 26, 4, 20);
      c.fillRect(cx + 6, cy + ROAD_W / 2 - 12, 20, 4);
    }
  }

  // The garage, painted into the city itself.
  drawGarageStatic(c, world);

  // Trees and palms.
  for (const t of world.trees) {
    if (isPalm(t)) {
      drawPalm(c, t);
    } else {
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath();
      c.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3f7a34';
      c.beginPath();
      c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#57a047';
      c.beginPath();
      c.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Buildings: long golden-hour shadows, parapet, roof clutter.
  for (const b of world.buildings) {
    c.fillStyle = 'rgba(60,35,10,0.30)';
    c.fillRect(b.x + 13, b.y + 11, b.w, b.h);
    c.fillStyle = b.color;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.fillStyle = b.roof;
    c.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    c.strokeStyle = 'rgba(255,255,255,0.20)';
    c.lineWidth = 2;
    c.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    // Roof clutter (vents, AC boxes) from a position hash — deterministic.
    const h = hash2(b.x, b.y);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    const n = 1 + (h % 3);
    for (let i = 0; i < n; i++) {
      const rx = b.x + 10 + ((h >> (i * 5)) % Math.max(10, b.w - 34));
      const ry = b.y + 10 + ((h >> (i * 7 + 3)) % Math.max(10, b.h - 30));
      c.fillRect(rx, ry, 12, 9);
    }
    if (b.tall) {
      c.fillStyle = 'rgba(255,255,255,0.16)';
      c.fillRect(b.x, b.y, b.w, 5);
    }
  }
  return cv;
}

let staticCache = { world: null, canvas: null };

function drawBarrier(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.fillStyle = '#22252a';
  ctx.fillRect(-17, -3, 4, 12);
  ctx.fillRect(13, -3, 4, 12);
  // Striped plank.
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ff7a26' : '#f2f2ea';
    ctx.fillRect(-18 + i * 9, -9, 9, 7);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeRect(-18, -9, 36, 7);
  ctx.restore();
}

function drawFlames(ctx, state, car) {
  const flick = Math.sin(state.clockSeconds * 31 + car.x * 0.7) * 3;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = '#ff7a26';
  ctx.beginPath();
  ctx.arc(car.x, car.y, 13 + flick, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffc46b';
  ctx.beginPath();
  ctx.arc(car.x - 4, car.y - 2, 7 + flick * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHelicopter(ctx, state, heli) {
  // Ground shadow, offset by altitude.
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath();
  ctx.ellipse(heli.x + 36, heli.y + 118, 30, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Searchlight cone + pool.
  const grad = ctx.createRadialGradient(
    heli.lightX, heli.lightY, 8, heli.lightX, heli.lightY, 118,
  );
  grad.addColorStop(0, 'rgba(255,246,200,0.42)');
  grad.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = 'rgba(255,244,190,0.10)';
  ctx.beginPath();
  ctx.moveTo(heli.x, heli.y);
  ctx.lineTo(heli.lightX - 74, heli.lightY + 20);
  ctx.lineTo(heli.lightX + 74, heli.lightY + 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(heli.lightX, heli.lightY, 118, 0, Math.PI * 2);
  ctx.fill();
  // Airframe.
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = '#232a31';
  ctx.fillRect(-56, -3, 34, 6); // tail boom
  ctx.fillRect(-58, -9, 5, 18); // tail fin
  roundRect(ctx, -24, -12, 50, 24, 10);
  ctx.fill();
  ctx.fillStyle = '#3d4a55';
  roundRect(ctx, 2, -9, 18, 18, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,220,245,0.85)';
  ctx.fillRect(14, -7, 7, 14);
  ctx.fillStyle = '#f2f2ea';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONDOR', -2, 3);
  // Rotor disc: two crossed blades spinning on rotorPhase.
  ctx.strokeStyle = 'rgba(20,20,20,0.75)';
  ctx.lineWidth = 3;
  const ra = heli.rotorPhase;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * -38, Math.sin(ra) * -38);
  ctx.lineTo(Math.cos(ra) * 38, Math.sin(ra) * 38);
  ctx.moveTo(Math.cos(ra + Math.PI / 2) * -38, Math.sin(ra + Math.PI / 2) * -38);
  ctx.lineTo(Math.cos(ra + Math.PI / 2) * 38, Math.sin(ra + Math.PI / 2) * 38);
  ctx.stroke();
  // Skids + blinking beacon.
  ctx.strokeStyle = '#14181c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, 15); ctx.lineTo(18, 15);
  ctx.moveTo(-16, -15); ctx.lineTo(18, -15);
  ctx.stroke();
  if (Math.floor(state.clockSeconds * 2) % 2 === 0) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-24, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWorld(ctx, state, view) {
  const world = state.world;
  const night = isNight(state.clockMinutes);
  if (staticCache.world !== world) {
    staticCache = { world, canvas: buildStaticLayer(world) };
  }
  ctx.save();
  ctx.translate(-view.camX, -view.camY);

  // The whole unmoving city in one blit.
  ctx.drawImage(staticCache.canvas, 0, 0);

  // Animated harbour sparkle: foam lines drifting on the water.
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  for (let x = 60; x < WORLD_W; x += 150) {
    const y = 1800 + ((x / 150) % 3) * 36 + Math.sin(state.clockSeconds * 0.9 + x * 0.05) * 3;
    if (inView(view, x, y, 80)) ctx.fillRect(x, y, 64, 3);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  const foamY = 1776 + Math.sin(state.clockSeconds * 1.3) * 2;
  ctx.fillRect(view.camX, foamY, view.w, 2);

  // Scorch marks from exploded cars.
  for (const s of state.scorches || []) {
    if (!inView(view, s.x, s.y, 60)) continue;
    ctx.fillStyle = 'rgba(12,10,8,0.55)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, 46, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Traffic lights.
  for (const light of world.lights) {
    if (!inView(view, light.x, light.y, 40)) continue;
    const greenV = ((Math.floor(state.clockSeconds / 8) % 2) === 0) === (light.phase === 0);
    ctx.fillStyle = '#222';
    ctx.fillRect(light.x + ROAD_W / 2 - 4, light.y - ROAD_W / 2 - 18, 8, 20);
    ctx.fillStyle = greenV ? '#37d67a' : '#e04040';
    ctx.beginPath();
    ctx.arc(light.x + ROAD_W / 2, light.y - ROAD_W / 2 - 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lit windows on tall buildings at night.
  if (night) {
    ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
    for (const b of world.buildings) {
      if (!b.tall || !inView(view, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      for (let wy = b.y + 12; wy < b.y + b.h - 8; wy += 18) {
        for (let wx = b.x + 10; wx < b.x + b.w - 8; wx += 20) {
          if ((wx + wy) % 40 === 0) ctx.fillRect(wx, wy, 9, 11);
        }
      }
    }
  }

  // Mission beacon: a pulsing diamond and a light column at the target.
  const target = state.missionTarget;
  if (target) {
    const pulse = 1 + 0.25 * Math.sin(state.clockSeconds * 5);
    ctx.fillStyle = 'rgba(255, 211, 77, 0.16)';
    ctx.fillRect(target.x - 14, target.y - 200, 28, 200);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd34d';
    const s = 13 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  // Street-race rings: the start at the pier, then the live checkpoint.
  const racePt = state.mode === 'play' ? raceTarget(state) : null;
  if (racePt) {
    const active = state.race && state.race.active;
    const pulse = 1 + 0.18 * Math.sin(state.clockSeconds * 4);
    ctx.strokeStyle = active ? '#37d67a' : 'rgba(55,214,122,0.75)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(racePt.x, racePt.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    if (!active) {
      ctx.fillStyle = '#37d67a';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BALAPAN', RACE_START.x, RACE_START.y - 48);
    }
  }

  // Weapon pickups lying in the street.
  for (const pk of state.pickups || []) {
    if (pk.taken || !inView(view, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(state.clockSeconds * 3 + pk.x) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(255, 211, 77, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-9, -3, 15, 6);
    ctx.fillRect(4, 2, 6, 4);
    ctx.fillRect(-4, 3, 4, 6);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.label, pk.x, pk.y - 22 + bob);
  }

  // Roadblock: barriers first, then its two patrol cars.
  for (const b of state.barriers || []) {
    if (inView(view, b.x, b.y, 40)) drawBarrier(ctx, b);
  }
  if (state.roadblock) {
    for (const rc of state.roadblock.cars) {
      if (inView(view, rc.x, rc.y, 60)) drawCarShape(ctx, rc, false, night);
    }
  }

  // Cars: parked and traffic first, then police. The player's own car is
  // drawn last, with Mara, so it is never painted twice.
  for (const car of state.cars) {
    if (car === state.player.car) continue;
    if (!inView(view, car.x, car.y, 60)) continue;
    drawCarShape(ctx, car, false, night);
  }
  for (const pc of state.police) {
    if (!inView(view, pc.x, pc.y, 60)) continue;
    drawCarShape(ctx, pc, false, night);
  }

  // Pedestrians and rivals.
  for (const ped of state.peds) {
    if (!inView(view, ped.x, ped.y, 30)) continue;
    drawPersonShape(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.down, false, 0);
  }
  for (const e of state.enemies) {
    if (!e.alive || !inView(view, e.x, e.y, 30)) continue;
    drawPersonShape(ctx, e.x, e.y, e.angle, '#3a3a3a', false, false, 0);
    ctx.fillStyle = '#e04040';
    ctx.fillRect(e.x - 12, e.y - 26, 24, 4);
    ctx.fillStyle = '#37d67a';
    ctx.fillRect(e.x - 12, e.y - 26, 24 * (e.health / 50), 4);
  }

  // Mara Voss on foot, or her car.
  const p = state.player;
  if (p.onFoot && inView(view, p.x, p.y, 30)) {
    drawPersonShape(ctx, p.x, p.y, p.angle, '#2c4a6b', false, true, p.punchAnim);
  } else if (!p.onFoot && p.car) {
    drawCarShape(ctx, p.car, true, night);
  }

  // Flames on burning wrecks-to-be.
  const burningCars = [...state.cars, ...state.police,
    ...(state.roadblock ? state.roadblock.cars : [])];
  for (const car of burningCars) {
    if (car.exploded || car.hp > 0) continue;
    if (inView(view, car.x, car.y, 50)) drawFlames(ctx, state, car);
  }
  if (p.car && p.car.hp <= 0 && !p.car.exploded && inView(view, p.car.x, p.car.y, 50)) {
    drawFlames(ctx, state, p.car);
  }

  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Time-of-day light, plus a warm golden-hour wash low on the screen.
  ctx.fillStyle = daylightTint(state.clockMinutes);
  ctx.fillRect(view.camX, view.camY, view.w, view.h);
  const hour = (state.clockMinutes / 60) % 24;
  if (hour >= 15 && hour < 19) {
    const grad = ctx.createLinearGradient(0, view.camY, 0, view.camY + view.h);
    grad.addColorStop(0, 'rgba(255,170,60,0.05)');
    grad.addColorStop(1, 'rgba(255,110,40,0.13)');
    ctx.fillStyle = grad;
    ctx.fillRect(view.camX, view.camY, view.w, view.h);
  }

  // The CONDOR helicopter and its searchlight, above the light wash.
  if (state.heli) drawHelicopter(ctx, state, state.heli);

  ctx.restore();
}
