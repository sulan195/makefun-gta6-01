// hud.js — everything drawn over the world: money and health, wanted stars,
// the clock, the minimap, the active mission, dialog and toasts, plus the
// title, pause, busted and wasted screens.

import { V_ROADS, H_ROADS, WORLD_W, WORLD_H, districtAt } from './world.js';
import { formatClock, formatMoney, dist, clamp } from './util.js';
import { currentMission, missionObjectiveText } from './missions.js';
import { hasSave } from './save.js';
import { rankFor, nextRank } from './progression.js';
import { weaponHudText } from './weapons.js';
import { garageMenuItems, nearGarage } from './garage.js';
import { formatRaceTime, RACE_POINTS } from './races.js';

const MAP_W = 208;
const MAP_H = 156;

function drawStars(ctx, x, y, wanted) {
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd34d' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', x + i * 24, y);
  }
}

function drawBar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawMinimap(ctx, state, view) {
  const mx = 16;
  const my = view.h - MAP_H - 16;
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 18, 28, 0.78)';
  ctx.fillRect(mx, my, MAP_W, MAP_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, my + 0.5, MAP_W, MAP_H);
  // Water.
  ctx.fillStyle = '#2d6a8a';
  ctx.fillRect(mx, my + 1772 * sy, MAP_W, MAP_H - 1772 * sy);
  // Roads.
  ctx.strokeStyle = '#8a8a80';
  ctx.lineWidth = 2;
  for (const x of V_ROADS) {
    ctx.beginPath();
    ctx.moveTo(mx + x * sx, my);
    ctx.lineTo(mx + x * sx, my + MAP_H);
    ctx.stroke();
  }
  for (const y of H_ROADS) {
    ctx.beginPath();
    ctx.moveTo(mx, my + y * sy);
    ctx.lineTo(mx + MAP_W, my + y * sy);
    ctx.stroke();
  }
  // Mission target.
  const t = state.missionTarget;
  if (t) {
    ctx.fillStyle = '#ffd34d';
    ctx.save();
    ctx.translate(mx + t.x * sx, my + t.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Rivals.
  ctx.fillStyle = '#ff5040';
  for (const e of state.enemies) {
    if (e.alive) ctx.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
  }
  // Police.
  ctx.fillStyle = '#4d9fff';
  for (const pc of state.police) {
    ctx.beginPath();
    ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.roadblock) {
    for (const rc of state.roadblock.cars) {
      ctx.beginPath();
      ctx.arc(mx + rc.x * sx, my + rc.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The CONDOR helicopter.
  if (state.heli) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + state.heli.x * sx, my + state.heli.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The garage: a gold G.
  const gp = state.world.places.garage;
  if (gp) {
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(mx + gp.x * sx - 4, my + gp.y * sy - 4, 8, 8);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G', mx + gp.x * sx, my + gp.y * sy + 2.5);
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // View frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(
    mx + view.camX * sx, my + view.camY * sy,
    view.w * sx, view.h * sy,
  );
  ctx.restore();
}

export function drawHud(ctx, state, view) {
  const p = state.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: money, health, armour, respect, current weapon.
  ctx.fillStyle = 'rgba(8, 18, 28, 0.72)';
  ctx.fillRect(14, 12, 250, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(14.5, 12.5, 250, 128);
  ctx.fillStyle = '#7de07d';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatMoney(state.money), 26, 42);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('NYAWA', 26, 64);
  drawBar(ctx, 82, 54, 170, 11, p.health / 100, '#e04040', 'rgba(255,255,255,0.2)');
  if (p.armor > 0) {
    ctx.fillText('ARMOR', 26, 86);
    drawBar(ctx, 82, 76, 170, 11, p.armor / 100, '#4d9fff', 'rgba(255,255,255,0.2)');
  }
  // Respect: rank name, points, and progress toward the next rank.
  const respect = state.respect || 0;
  const rank = rankFor(respect);
  const next = nextRank(respect);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('RESPECT', 26, 108);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(rank.name + ' · ' + respect, 108, 108);
  if (next) {
    const frac = (respect - rank.min) / (next.min - rank.min);
    drawBar(ctx, 26, 116, 226, 7, frac, '#ffd34d', 'rgba(255,255,255,0.18)');
  } else {
    drawBar(ctx, 26, 116, 226, 7, 1, '#ffd34d', 'rgba(255,255,255,0.18)');
  }
  // Weapon line under the panel.
  ctx.fillStyle = 'rgba(8, 18, 28, 0.72)';
  ctx.fillRect(14, 148, 250, 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(14.5, 148.5, 250, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(weaponHudText(state), 26, 169);
  ctx.fillStyle = '#c8d4dc';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('1-4 ganti', 252, 168);
  ctx.textAlign = 'left';

  // Top-right: wanted stars, clock, district.
  ctx.fillStyle = 'rgba(8, 18, 28, 0.72)';
  ctx.fillRect(view.w - 264, 12, 250, 84);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(view.w - 263.5, 12.5, 250, 84);
  drawStars(ctx, view.w - 252, 36, state.wanted);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(state.clockMinutes), view.w - 26, 66);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#c8d4dc';
  ctx.fillText(districtAt(state.world, p.x, p.y), view.w - 26, 86);

  // Minimap, bottom-left.
  drawMinimap(ctx, state, view);

  // Bottom-right: mission panel.
  const mission = currentMission(state.missions);
  const obj = missionObjectiveText(state);
  const t = state.missionTarget;
  const panelW = 380;
  const panelX = view.w - panelW - 16;
  const panelY = view.h - 96;
  ctx.fillStyle = 'rgba(8, 18, 28, 0.78)';
  ctx.fillRect(panelX, panelY, panelW, 80);
  ctx.strokeStyle = 'rgba(255,211,77,0.6)';
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW, 80);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(mission ? mission.title : 'FREE ROAM', panelX + 14, panelY + 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(obj, panelX + 14, panelY + 46);
  if (t) {
    ctx.fillStyle = '#c8d4dc';
    ctx.fillText(Math.round(dist(p.x, p.y, t.x, t.y)) + ' m ke tujuan', panelX + 14, panelY + 66);
  }

  // Speed, when driving.
  if (!p.onFoot && p.car) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', view.w - 420, view.h - 30);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#c8d4dc';
    ctx.fillText('E keluar mobil · R radio · G garasi', view.w - 420, view.h - 12);
  } else {
    ctx.fillStyle = '#c8d4dc';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WASD jalan · E masuk mobil · Spasi tembak · F pukul · 1-4 senjata · P jeda', view.w - 420, view.h - 12);
  }

  // Race timer, top-centre, while the Marina Loop is live.
  if (state.race && state.race.active) {
    ctx.fillStyle = 'rgba(8, 18, 28, 0.78)';
    ctx.fillRect(view.w / 2 - 150, 12, 300, 40);
    ctx.strokeStyle = 'rgba(55,214,122,0.7)';
    ctx.strokeRect(view.w / 2 - 149.5, 12.5, 300, 40);
    ctx.fillStyle = '#37d67a';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'BALAPAN · CP ' + (state.race.idx + 1) + '/' + RACE_POINTS.length + ' · ' + formatRaceTime(state.race.time),
      view.w / 2, 39,
    );
    ctx.textAlign = 'left';
  }

  // Garage prompt when Mara is at Bang Udin's door.
  if (!state.garageMenu && nearGarage(state)) {
    ctx.fillStyle = 'rgba(8, 18, 28, 0.85)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const label = 'Tekan G — Garasi Bang Udin';
    const gw = ctx.measureText(label).width + 32;
    ctx.fillRect((view.w - gw) / 2, view.h - 250, gw, 34);
    ctx.strokeStyle = 'rgba(255,211,77,0.6)';
    ctx.strokeRect((view.w - gw) / 2 + 0.5, view.h - 249.5, gw, 34);
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.fillText(label, view.w / 2, view.h - 228);
    ctx.textAlign = 'left';
  }

  // Dialog line (story) above the mission panel.
  if (state.dialog && state.clockSeconds < state.dialog.until) {
    ctx.fillStyle = 'rgba(8, 18, 28, 0.85)';
    const dw = 640;
    ctx.fillRect((view.w - dw) / 2, view.h - 190, dw, 52);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect((view.w - dw) / 2 + 0.5, view.h - 189.5, dw, 52);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'italic 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, state.dialog.text, view.w / 2, view.h - 168, dw - 24, 20);
  }

  // Toast message.
  if (state.message && state.clockSeconds < state.messageUntil) {
    ctx.fillStyle = 'rgba(8, 18, 28, 0.85)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    const mw = ctx.measureText(state.message).width + 32;
    ctx.fillRect((view.w - mw) / 2, 112, mw, 34);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, view.w / 2, 134);
  }

  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
}

function drawTitleScreen(ctx, state, view) {
  ctx.save();
  // Dim the city behind the menu.
  ctx.fillStyle = 'rgba(6, 12, 22, 0.62)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR CITY', view.w / 2, 220);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 26px system-ui, sans-serif';
  ctx.fillText('Kisah Mara Voss — sopir sewaan, kru perampokan, satu kota.', view.w / 2, 268);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#c8d4dc';
  const lines = [
    'Jelajahi Solmar City dengan berjalan kaki atau berkendara.',
    'Curi mobil, kabur dari roadblock & helikopter polisi, selesaikan 8 misi Dax.',
    'Naikkan Respect sampai Legenda Solmar, tune mobilmu di Garasi Bang Udin.',
    'WASD / panah bergerak · E masuk & keluar mobil · Spasi / klik tembak · F pukul',
    '1-4 ganti senjata · G garasi · R radio · P jeda & simpan · HUD: kas, Respect, minimap.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, view.w / 2, 330 + i * 26));
  const blink = state.shot ? true : (Math.floor(state.clockSeconds * 2) % 2 === 0);
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('Tekan ENTER untuk bermain', view.w / 2, 500);
  }
  if (hasSave()) {
    ctx.fillStyle = '#7de07d';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Save ditemukan — tekan C untuk Lanjutkan', view.w / 2, 540);
  }
  ctx.fillStyle = '#8a97a3';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Game orisinal — kota, karakter, dan cerita dibuat sendiri. Tanpa aset game komersial.', view.w / 2, 640);
  ctx.fillText('Suara disintesis dengan WebAudio · Progres tersimpan otomatis di browser ini.', view.w / 2, 664);
  ctx.restore();
}

function drawOverlayScreen(ctx, view, title, sub, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 12, 22, 0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, view.w / 2, 330);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(sub, view.w / 2, 380);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Tekan ENTER untuk lanjut', view.w / 2, 450);
  ctx.restore();
}

export function drawGarageMenu(ctx, state, view) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 12, 22, 0.78)';
  ctx.fillRect(0, 0, view.w, view.h);
  const w = 560;
  const h = 400;
  const x = (view.w - w) / 2;
  const y = (view.h - h) / 2;
  ctx.fillStyle = 'rgba(10, 20, 30, 0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,211,77,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('GARASI BANG UDIN', view.w / 2, y + 52);
  ctx.fillStyle = '#7de07d';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText('Kas: ' + formatMoney(state.money), view.w / 2, y + 84);
  ctx.textAlign = 'left';
  const items = garageMenuItems(state);
  items.forEach((item, i) => {
    const iy = y + 128 + i * 44;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + 28, iy - 26, w - 56, 38);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText((i + 1) + '', x + 44, iy);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(item.label, x + 74, iy);
    ctx.fillStyle = '#c8d4dc';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(item.detail, x + w - 44, iy);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#c8d4dc';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Tekan angka 1-5 untuk membeli · G atau P untuk keluar', view.w / 2, y + h - 22);
  ctx.restore();
}

export function drawScreens(ctx, state, view) {
  if (state.garageMenu) {
    drawGarageMenu(ctx, state, view);
    return;
  }
  if (state.mode === 'title') drawTitleScreen(ctx, state, view);
  else if (state.mode === 'paused') {
    drawOverlayScreen(ctx, view, 'JEDA', 'Progres tersimpan. Tekan P untuk lanjut.', '#ffffff');
  } else if (state.mode === 'busted') {
    drawOverlayScreen(ctx, view, 'TERTANGKAP!', 'Polisi membawamu ke kantor. Uang jaminan $100.', '#4d9fff');
  } else if (state.mode === 'wasted') {
    drawOverlayScreen(ctx, view, 'TUMBANG', 'Mara dilarikan ke St. Anselm Hospital. Biaya $100.', '#e04040');
  }
}
