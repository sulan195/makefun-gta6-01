// hud.js — everything flat on top of the 3D world: cash, health and armor,
// the Respect rank, weapon and ammunition, wanted stars, the clock and the
// current district, the objective panel with its distance readout, message
// and dialogue lines, the garage menu, and a top-down minimap drawn from
// the same world data the 3D city is built from.

import { V_ROADS, H_ROADS, districtAt } from './world.js';
import { rankFor, nextRank } from './progression.js';
import { weaponHudText } from './combat.js';
import { missionObjectiveText, missionTargetPos } from './missions.js';
import { raceTarget, formatRaceTime } from './races.js';
import { garageMenuItems } from './garage.js';
import { dist } from './util.js';

const el = (id) => document.getElementById(id);

export function formatClock(minutes) {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
}

function buildMinimapBase(world) {
  const c = document.createElement('canvas');
  c.width = 190;
  c.height = 143;
  const g = c.getContext('2d');
  const s = 190 / 2560;
  g.fillStyle = '#1d4e5e';
  g.fillRect(0, 0, 190, 143);
  g.fillStyle = '#23272e';
  g.fillRect(0, 0, 190, 1740 * s);
  g.fillStyle = '#e8d9a0';
  g.fillRect(0, 1740 * s, 190, 150 * s);
  g.fillStyle = '#2e7d46';
  g.fillRect(1240 * s, 1080 * s, 280 * s, 280 * s);
  g.strokeStyle = '#454b54';
  g.lineWidth = 4;
  for (const x of V_ROADS) {
    g.beginPath(); g.moveTo(x * s, 0); g.lineTo(x * s, 1740 * s); g.stroke();
  }
  for (const y of H_ROADS) {
    g.beginPath(); g.moveTo(0, y * s); g.lineTo(190, y * s); g.stroke();
  }
  return c;
}

export function createHud(world) {
  return {
    base: buildMinimapBase(world),
    map: el('minimap').getContext('2d'),
    cache: {},
    garageTick: -1,
  };
}

function setText(hud, id, text) {
  if (hud.cache[id] === text) return;
  hud.cache[id] = text;
  el(id).textContent = text;
}

function setShown(hud, id, show) {
  const key = 'show:' + id;
  if (hud.cache[key] === show) return;
  hud.cache[key] = show;
  el(id).style.display = show ? '' : 'none';
}

export function updateHud(hud, state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  setText(hud, 'cash', '$' + state.money);
  el('healthfill').style.width = Math.max(0, p.health) + '%';
  el('armorfill').style.width = Math.max(0, p.armor) + '%';

  const rank = rankFor(state.respect);
  const next = nextRank(state.respect);
  setText(hud, 'respect',
    'RESPECT ' + state.respect + ' — ' + rank.name.toUpperCase()
    + (next ? ' · next: ' + next.name + ' at ' + next.min : ' · MAX RANK'));
  setText(hud, 'weapon', weaponHudText(state));
  setText(hud, 'starson', '★'.repeat(state.wanted));
  setText(hud, 'starsoff', '☆'.repeat(Math.max(0, 5 - state.wanted)));
  setText(hud, 'clock', formatClock(state.clockMinutes));
  setText(hud, 'district', districtAt(state.world, px, py));
  setText(hud, 'speed', p.car
    ? Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h' : '');

  // Objective + distance to its marker.
  let target = null;
  if (state.missions.fare) {
    target = state.missions.fare.pickedUp
      ? state.missions.fare.dest : state.missions.fare;
  } else {
    target = missionTargetPos(state) || raceTarget(state);
  }
  let obj = missionObjectiveText(state);
  if (state.race && state.race.active) {
    obj = 'Marina Loop — checkpoint ' + (state.race.idx + 1) + '/'
      + '6 · ' + state.race.time.toFixed(1) + 's';
  }
  if (target) obj += '  ·  ' + Math.round(dist(px, py, target.x, target.y)) + 'm';
  setText(hud, 'objective', obj);

  const showMsg = state.message && state.clockSeconds < state.messageUntil;
  setShown(hud, 'message', !!showMsg);
  if (showMsg) setText(hud, 'message', state.message);
  const showDlg = state.dialog && state.clockSeconds < state.dialog.until;
  setShown(hud, 'dialog', !!showDlg);
  if (showDlg) setText(hud, 'dialog', state.dialog.text);

  if (state.race && state.race.active) {
    setShown(hud, 'racetime', true);
    setText(hud, 'racetime', 'MARINA LOOP · ' + formatRaceTime(state.race.time)
      + ' · CHECKPOINT ' + (state.race.idx + 1) + '/6');
  } else {
    setShown(hud, 'racetime', false);
  }

  // Overlays.
  setShown(hud, 'title', state.mode === 'title');
  setShown(hud, 'pause', state.mode === 'pause');
  setShown(hud, 'busted', state.mode === 'busted');
  setShown(hud, 'wasted', state.mode === 'wasted');
  setShown(hud, 'hudmain', state.mode !== 'title');

  // Garage menu (rebuilt at most ~4x per second while open).
  const gOpen = !!state.garageOpen;
  setShown(hud, 'garagemenu', gOpen);
  if (gOpen) {
    const tick = Math.floor(state.clockSeconds * 4);
    if (hud.garageTick !== tick) {
      hud.garageTick = tick;
      const items = garageMenuItems(state);
      el('garageitems').innerHTML = items.map((it, i) =>
        '<div class="gitem"><span class="gkey">' + (i + 1) + '</span> '
        + it.label + '<br><small style="color:#9fb2c1">' + it.detail
        + '</small></div>').join('');
      setText(hud, 'garageresult', state.garageMessage || '');
      setText(hud, 'garagecash', 'Your cash: $' + state.money);
    }
  }

  drawMinimap(hud, state, px, py);
}

function drawMinimap(hud, state, px, py) {
  const g = hud.map;
  const s = 190 / 2560;
  g.drawImage(hud.base, 0, 0);
  const dot = (x, y, color, r) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(x * s, y * s, r, 0, 6.2832);
    g.fill();
  };
  const garage = state.world.places.garage;
  dot(garage.x, garage.y, '#ffb340', 3);
  let target = null;
  if (state.missions.fare) {
    target = state.missions.fare.pickedUp
      ? state.missions.fare.dest : state.missions.fare;
  } else {
    target = missionTargetPos(state) || raceTarget(state);
  }
  if (target) dot(target.x, target.y, '#ffd23e', 3.4);
  if (state.roadblock) {
    for (const rc of state.roadblock.cars) dot(rc.x, rc.y, '#3f8cff', 2.4);
  }
  for (const pc of state.police) dot(pc.x, pc.y, '#3f8cff', 2.4);
  if (state.heli) dot(state.heli.x, state.heli.y, '#7fe7ff', 2.6);
  // Player arrow.
  const a = state.player.car ? state.player.car.angle : state.player.angle;
  g.fillStyle = '#ffffff';
  g.save();
  g.translate(px * s, py * s);
  g.rotate(a);
  g.beginPath();
  g.moveTo(5, 0); g.lineTo(-3.4, -3); g.lineTo(-3.4, 3); g.closePath();
  g.fill();
  g.restore();
}
