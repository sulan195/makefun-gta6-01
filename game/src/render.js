// render.js — draws Solmar City: the camera, the streets, the buildings, the
// cars and people, the mission beacon, particles, and the time-of-day light.

import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, ROAD_W } from './world.js';
import { clamp, lerp } from './util.js';

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

export function drawWorld(ctx, state, view) {
  const world = state.world;
  const night = isNight(state.clockMinutes);
  ctx.save();
  ctx.translate(-view.camX, -view.camY);

  // Ground: dry grass / sand base.
  ctx.fillStyle = '#b8a06a';
  ctx.fillRect(view.camX - 10, view.camY - 10, view.w + 20, view.h + 20);

  // Harbour water along the south edge.
  ctx.fillStyle = '#2d6a8a';
  ctx.fillRect(view.camX - 10, 1760, view.w + 20, WORLD_H - 1760 + 20);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = 100; x < WORLD_W; x += 160) {
    ctx.fillRect(x, 1800 + ((x / 160) % 2) * 30, 60, 3);
  }

  // Park: green square.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(1214, 894, 212, 212);

  // Blocks: pavement base between roads.
  ctx.fillStyle = '#9a8a70';
  for (let r = 0; r < H_ROADS.length - 1; r++) {
    for (let c = 0; c < V_ROADS.length - 1; c++) {
      const x0 = V_ROADS[c] + ROAD_W / 2;
      const y0 = H_ROADS[r] + ROAD_W / 2;
      const x1 = V_ROADS[c + 1] - ROAD_W / 2;
      const y1 = H_ROADS[r + 1] - ROAD_W / 2;
      if (x1 < view.camX || x0 > view.camX + view.w || y1 < view.camY || y0 > view.camY + view.h) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Roads.
  ctx.fillStyle = '#3a3a40';
  for (const x of V_ROADS) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of H_ROADS) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);

  // Lane dashes.
  ctx.fillStyle = '#d8d8c8';
  for (const x of V_ROADS) {
    for (let y = 40; y < WORLD_H; y += 80) {
      if (inView(view, x, y)) ctx.fillRect(x - 2, y, 4, 34);
    }
  }
  for (const y of H_ROADS) {
    for (let x = 40; x < WORLD_W; x += 80) {
      if (inView(view, x, y)) ctx.fillRect(x, y - 2, 34, 4);
    }
  }

  // Crosswalks at every crossing.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (const cy of H_ROADS) {
    for (const cx of V_ROADS) {
      if (!inView(view, cx, cy, 60)) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx + i * 10 - 3, cy - ROAD_W / 2 + 4, 6, 12);
        ctx.fillRect(cx + i * 10 - 3, cy + ROAD_W / 2 - 16, 6, 12);
      }
    }
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

  // Trees.
  for (const t of world.trees) {
    if (!inView(view, t.x, t.y, 20)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings, with a soft shadow and lit windows at night.
  for (const b of world.buildings) {
    if (!inView(view, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
      for (let wy = b.y + 12; wy < b.y + b.h - 8; wy += 18) {
        for (let wx = b.x + 10; wx < b.x + b.w - 8; wx += 20) {
          if (night && ((wx + wy) % 40 === 0)) ctx.fillRect(wx, wy, 9, 11);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 5);
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

  // Mara Voss on foot.
  const p = state.player;
  if (p.onFoot && inView(view, p.x, p.y, 30)) {
    drawPersonShape(ctx, p.x, p.y, p.angle, '#2c4a6b', false, true, p.punchAnim);
  } else if (!p.onFoot && p.car) {
    drawCarShape(ctx, p.car, true, night);
  }

  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Time-of-day light.
  ctx.fillStyle = daylightTint(state.clockMinutes);
  ctx.fillRect(view.camX, view.camY, view.w, view.h);

  ctx.restore();
}
