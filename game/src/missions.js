// missions.js — Solmar City's story: eight jobs for Mara Voss, then free
// roam with repeatable taxi fares and the Marina Loop street race. A
// mission is a list of steps; each step is checked every tick and advances
// when its condition is met. Later jobs are gated behind Respect ranks —
// Dax only trusts Mara with bigger work once the street knows her name.

import { dist } from './util.js';
import { makeCar, makeEnemy, raiseWanted } from './entities.js';
import { playCash, playPickup, playGunshot } from './audio.js';
import { addRespect } from './progression.js';

export const MISSION_DEFS = [
  {
    id: 'taxi',
    title: 'Misi 1 — Taksi Pertama',
    briefing: 'Dax: "Mara, penumpang menunggu di Old Town. Jemput dia, antar ke Marina. Jangan bikin ribut."',
    reward: 150, respect: 5,
    steps: [
      { type: 'goto', text: 'Jemput penumpang di Old Town', target: 'taxiStand', radius: 70, needCar: true },
      { type: 'pickup', text: 'Penumpang naik — antar ke Marina West', target: 'marina', radius: 80 },
    ],
  },
  {
    id: 'steal',
    title: 'Misi 2 — Mobil Pesanan',
    briefing: 'Dax: "Kru butuh sedan abu-abu di Harbour Yard. Ambil, lalu hilang dari radar polisi."',
    reward: 300, respect: 8,
    steps: [
      { type: 'goto', text: 'Pergi ke Harbour Yard', target: 'harbourYard', radius: 90 },
      { type: 'steal', text: 'Curi sedan abu-abu itu (tekan E)', target: 'harbourYard', radius: 60 },
      { type: 'escape', text: 'Kabur! Turunkan wanted sampai 0', target: null, radius: 0 },
    ],
  },
  {
    id: 'package',
    title: 'Misi 3 — Paket Panas',
    briefing: 'Dax: "Paket ini harus sampai ke Downtown — dan polisi sudah mengendusmu. Jangan ketangkap."',
    reward: 500, respect: 10,
    steps: [
      { type: 'pickup', text: 'Ambil paket di Palmera Park', target: 'parkGate', radius: 70, package: true },
      { type: 'deliver', text: 'Antar paket ke Downtown plaza', target: 'downtown', radius: 80 },
    ],
  },
  {
    id: 'balas',
    title: 'Misi 4 — Balas Setimpal',
    briefing: 'Dax: "Kru Sanca membakar mobil simpanan kita di Southside. Gantian: hancurkan mobil andalan mereka sampai meledak."',
    reward: 700, respect: 12,
    steps: [
      { type: 'goto', text: 'Pergi ke Southside', target: 'southside', radius: 90 },
      { type: 'destroy', text: 'Hancurkan mobil kru Sanca — tembak sampai meledak', target: null, radius: 0 },
    ],
  },
  {
    id: 'kurir',
    title: 'Misi 5 — Kurir Tengah Malam',
    briefing: 'Sinta: "Dokumen di Marina West harus sampai ke Old Town malam ini juga. Begitu kamu bergerak, polisi akan mengendus — jangan berhenti."',
    reward: 900, respect: 15,
    steps: [
      { type: 'pickup', text: 'Ambil dokumen di Marina West', target: 'marina', radius: 75, package: true, raiseWanted: 3 },
      { type: 'deliver', text: 'Antar dokumen ke Taxi stand, Old Town', target: 'taxiStand', radius: 80 },
    ],
  },
  {
    id: 'kawal',
    title: 'Misi 6 — Kawal Sinta',
    briefing: 'Dax: "Jemput Sinta di Downtown plaza, antar ke Harbour Yard. Kru Sanca mengincarnya — jaga dia."',
    reward: 1200, respect: 18, respectReq: 45,
    steps: [
      { type: 'pickup', text: 'Jemput Sinta di Downtown plaza', target: 'downtown', radius: 75, passenger: true },
      { type: 'deliver', text: 'Antar Sinta ke Harbour Yard', target: 'harbourYard', radius: 85 },
    ],
  },
  {
    id: 'gudang',
    title: 'Misi 7 — Gudang Harbour',
    briefing: 'Dax: "Mobil berisi barang bukti kita diparkir kru Sanca di Harbour Yard. Ledakkan mobilnya, lalu hilang."',
    reward: 1600, respect: 22,
    steps: [
      { type: 'goto', text: 'Pergi ke Harbour Yard', target: 'harbourYard', radius: 90 },
      { type: 'destroy', text: 'Ledakkan mobil barang bukti itu', target: null, radius: 0 },
      { type: 'escape', text: 'Kabur! Turunkan wanted sampai 0', target: null, radius: 0 },
    ],
  },
  {
    id: 'bank',
    title: 'Misi 8 — Rampok Bank Solmar',
    briefing: 'Dax: "Satu tarikan terakhir, Mara. Bank Solmar. Ambil uangnya — wanted-mu akan penuh — lalu hilang ke Garasi Bang Udin."',
    reward: 3000, respect: 30, respectReq: 80, clearWantedOnComplete: true,
    steps: [
      { type: 'goto', text: 'Pergi ke Bank Solmar', target: 'bank', radius: 80 },
      { type: 'pickup', text: 'Ambil uang di Bank Solmar', target: 'bank', radius: 70, package: true, raiseWanted: 5 },
      { type: 'goto', text: 'Hilang ke Garasi Bang Udin — di sana kamu aman', target: 'garage', radius: 95 },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0, // index into MISSION_DEFS; >= length means free roam
    step: 0,
    active: false, // a mission's props are placed and its steps are live
    waiting: false, // gated behind a Respect requirement
    passenger: false,
    hasPackage: false,
    targetCar: null,
    escapeTimer: 0,
    fare: null, // repeatable taxi fare in free roam
    fareTimer: 0,
  };
}

export function currentMission(missions) {
  return MISSION_DEFS[missions.index] || null;
}

export function currentStep(missions) {
  if (!missions.active) return null;
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function missionObjectiveText(state) {
  const ms = state.missions;
  if (ms.fare) return 'Antar penumpang ke ' + ms.fare.name;
  if (ms.waiting) {
    const def = currentMission(ms);
    return 'Butuh Respect ' + (def ? def.respectReq : 0) + ' untuk misi berikutnya — kerjakan fare & aktivitas jalanan';
  }
  const step = currentStep(ms);
  if (!step) return 'Free roam — Solmar City milikmu';
  return step.text;
}

export function missionTargetPos(state) {
  const ms = state.missions;
  if (ms.fare) return ms.fare;
  const step = currentStep(ms);
  if (!step) return null;
  if ((step.type === 'steal' || step.type === 'destroy') && ms.targetCar) {
    return { x: ms.targetCar.x, y: ms.targetCar.y };
  }
  if (!step.target) return null;
  return state.world.places[step.target];
}

// Place a mission target car (and its guards) at a named place.
function placeTargetCar(state, placeKey, color, guards) {
  const spot = state.world.places[placeKey];
  const car = makeCar(spot.x + 30, spot.y + 10, 0, {
    kind: 'parked', driver: false, color,
  });
  car.missionTarget = true;
  state.cars.push(car);
  state.missions.targetCar = car;
  for (let i = 0; i < guards; i++) {
    state.enemies.push(makeEnemy(
      spot.x - 60 + i * 75, spot.y - 45 + (i % 2) * 85, state.rng,
    ));
  }
}

// Called when a mission starts: place its props (target car, rivals).
// A mission whose Respect requirement is not met yet waits instead —
// updateMissions activates it the moment Mara qualifies.
export function startMission(state, index) {
  const ms = state.missions;
  ms.index = index;
  ms.step = 0;
  ms.passenger = false;
  ms.hasPackage = false;
  ms.targetCar = null;
  ms.active = false;
  ms.waiting = false;
  const def = MISSION_DEFS[index];
  if (!def) return;
  if ((def.respectReq || 0) > (state.respect || 0)) {
    ms.waiting = true;
    state.message = 'Dax: "Belum saatnya, Mara. Naikkan Respect-mu dulu."';
    state.dialog = {
      text: 'Dax: "' + def.title + ' menunggu. Butuh Respect ' + def.respectReq
        + ' — selesaikan fare dan aktivitas jalanan untuk menaikkannya."',
      until: state.clockSeconds + 7,
    };
    return;
  }
  ms.active = true;
  state.message = def.briefing;
  state.dialog = { text: def.briefing, until: state.clockSeconds + 7 };
  if (def.id === 'steal') {
    placeTargetCar(state, 'harbourYard', '#8a8f96', 2);
  }
  if (def.id === 'package') {
    const gate = state.world.places.parkGate;
    state.enemies.push(makeEnemy(gate.x - 70, gate.y + 30, state.rng));
    state.enemies.push(makeEnemy(gate.x + 60, gate.y - 50, state.rng));
    raiseWanted(state, 2);
  }
  if (def.id === 'balas') {
    placeTargetCar(state, 'southside', '#5f8a3c', 2);
  }
  if (def.id === 'kawal') {
    const yard = state.world.places.harbourYard;
    state.enemies.push(makeEnemy(yard.x - 80, yard.y - 30, state.rng));
    state.enemies.push(makeEnemy(yard.x + 70, yard.y + 55, state.rng));
  }
  if (def.id === 'gudang') {
    placeTargetCar(state, 'harbourYard', '#4a4f57', 3);
  }
}

function advanceStep(state) {
  const ms = state.missions;
  const def = currentMission(ms);
  ms.step += 1;
  if (def && ms.step >= def.steps.length) {
    completeMission(state, def);
  }
}

export function completeMission(state, def) {
  const ms = state.missions;
  state.money += def.reward;
  if (def.clearWantedOnComplete) {
    state.wanted = 0;
    state.wantedTimer = 0;
  }
  addRespect(state, def.respect || 0);
  state.missionsDone.push(def.id);
  playCash(state.audio);
  state.message = def.title + ' selesai! +$' + def.reward;
  state.messageUntil = state.clockSeconds + 4;
  state.dialog = {
    text: 'Dax: "Bagus, Mara. $' + def.reward + ' masuk. Lanjut."',
    until: state.clockSeconds + 6,
  };
  ms.index += 1;
  ms.step = 0;
  ms.passenger = false;
  ms.hasPackage = false;
  ms.targetCar = null;
  ms.active = false;
  if (ms.index < MISSION_DEFS.length) {
    startMission(state, ms.index);
  } else {
    state.message = 'Semua misi selesai! Free roam — cari penumpang, balapan di Marina, atau kejar Respect.';
    state.messageUntil = state.clockSeconds + 5;
    startFare(state);
  }
}

export function startFare(state) {
  const ms = state.missions;
  const spots = Object.values(state.world.places);
  const dest = spots[Math.floor(state.rng() * spots.length)];
  const from = spots[Math.floor(state.rng() * spots.length)];
  if (dest === from) return;
  ms.fare = { x: from.x, y: from.y, name: from.name, dest, reward: 60 };
  ms.fareTimer = 0;
  state.message = 'Penumpang baru di ' + from.name + ' — jemput dia!';
}

// One tick of the mission state machine. Pure-ish: mutates state, no drawing.
export function updateMissions(state, dt) {
  const ms = state.missions;
  const p = state.player;

  // A Respect-gated mission activates as soon as Mara qualifies.
  if (ms.waiting) {
    const def = currentMission(ms);
    if (def && (state.respect || 0) >= (def.respectReq || 0)) {
      startMission(state, ms.index);
    }
    return;
  }

  const step = currentStep(ms);

  if (ms.fare) {
    ms.fareTimer += dt;
    const dest = ms.fare.dest;
    if (!ms.fare.pickedUp) {
      if (dist(p.x, p.y, ms.fare.x, ms.fare.y) < 70) {
        ms.fare.pickedUp = true;
        state.message = 'Penumpang naik! Antar ke ' + dest.name;
        playPickup(state.audio);
      }
    } else if (dist(p.x, p.y, dest.x, dest.y) < 80) {
      state.money += ms.fare.reward;
      addRespect(state, 2);
      playCash(state.audio);
      state.message = 'Fare selesai! +$' + ms.fare.reward;
      ms.fare = null;
      startFare(state);
    }
    return;
  }

  if (!step) return;
  const target = missionTargetPos(state);

  if (step.type === 'goto') {
    if (target && dist(p.x, p.y, target.x, target.y) < step.radius) {
      if (step.needCar) {
        // Taxi pickup: the passenger only boards a car.
        if (p.car) {
          ms.passenger = true;
          playPickup(state.audio);
          state.message = 'Penumpang: "Ke Marina West, cepat!"';
          advanceStep(state);
        } else {
          state.message = 'Penumpang menunggu mobil — tekan E di dekat mobil.';
        }
      } else {
        advanceStep(state);
      }
    }
  } else if (step.type === 'pickup') {
    if (target && dist(p.x, p.y, target.x, target.y) < step.radius) {
      if (step.package) {
        ms.hasPackage = true;
        playPickup(state.audio);
        if (step.raiseWanted) {
          raiseWanted(state, step.raiseWanted);
          state.message = 'Polisi mengendusmu! Wanted ' + state.wanted + ' — jangan berhenti!';
        } else {
          state.message = 'Paket diambil. Polisi sudah mengendusmu — hati-hati!';
        }
        advanceStep(state);
      } else if (step.passenger) {
        if (!p.car) {
          state.message = 'Kamu harus naik mobil dulu untuk menjemput.';
        } else {
          ms.passenger = true;
          playPickup(state.audio);
          state.message = 'Sinta: "Jangan sampai mereka menangkapku, Mara."';
          advanceStep(state);
        }
      } else {
        advanceStep(state);
      }
    }
  } else if (step.type === 'steal') {
    if (ms.targetCar && p.car === ms.targetCar) {
      raiseWanted(state, 2);
      state.message = 'Mobil didapat! Polisi datang — KABUR!';
      advanceStep(state);
    }
  } else if (step.type === 'destroy') {
    if (ms.targetCar && ms.targetCar.exploded) {
      state.message = 'Target hancur! Ledakannya terdengar se-Solmar.';
      advanceStep(state);
    }
  } else if (step.type === 'escape') {
    if (state.wanted === 0) {
      advanceStep(state);
    }
  } else if (step.type === 'deliver') {
    if (target && dist(p.x, p.y, target.x, target.y) < step.radius) {
      advanceStep(state);
    }
  }
}

// Enemies: chase the player when close, shoot with poor aim.
export function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    e.fireCooldown -= dt;
    if (d < 420) {
      const want = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = want;
      if (d > 150) {
        e.x += Math.cos(want) * e.speed * dt;
        e.y += Math.sin(want) * e.speed * dt;
      }
      if (d < 380 && e.fireCooldown <= 0) {
        e.fireCooldown = 1.4;
        // Enemy shot: inaccurate, small damage.
        const spread = (Math.random() - 0.5) * 0.35;
        const hitChance = 0.3;
        if (Math.random() < hitChance) {
          state.player.health = Math.max(0, state.player.health - 6);
          state.message = 'Kamu ditembak rival!';
        }
        state.particles.push({
          x: e.x + Math.cos(want + spread) * 20,
          y: e.y + Math.sin(want + spread) * 20,
          vx: Math.cos(want + spread) * 300, vy: Math.sin(want + spread) * 300,
          life: 0.15, maxLife: 0.15, color: '#ff9040', size: 2,
        });
        playGunshot(state.audio);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.alive);
}
