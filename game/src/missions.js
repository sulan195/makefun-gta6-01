// missions.js — Solmar City's story: three jobs for Mara Voss, then free roam
// with repeatable taxi fares. A mission is a list of steps; each step is
// checked every tick and advances when its condition is met.

import { dist } from './util.js';
import { makeEnemy, raiseWanted } from './entities.js';
import { playCash, playPickup, playGunshot } from './audio.js';

export const MISSION_DEFS = [
  {
    id: 'taxi',
    title: 'Misi 1 — Taksi Pertama',
    briefing: 'Dax: "Mara, penumpang menunggu di Old Town. Jemput dia, antar ke Marina. Jangan bikin ribut."',
    reward: 150,
    steps: [
      { type: 'goto', text: 'Jemput penumpang di Old Town', target: 'taxiStand', radius: 70 },
      { type: 'pickup', text: 'Penumpang naik — antar ke Marina West', target: 'marina', radius: 80 },
    ],
  },
  {
    id: 'steal',
    title: 'Misi 2 — Mobil Pesanan',
    briefing: 'Dax: "Kru butuh sedan abu-abu di Harbour Yard. Ambil, lalu hilang dari radar polisi."',
    reward: 300,
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
    reward: 500,
    steps: [
      { type: 'pickup', text: 'Ambil paket di Palmera Park', target: 'parkGate', radius: 70 },
      { type: 'deliver', text: 'Antar paket ke Downtown plaza', target: 'downtown', radius: 80 },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0, // index into MISSION_DEFS; >= length means free roam
    step: 0,
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
  const m = currentMission(missions);
  return m ? m.steps[missions.step] : null;
}

export function missionObjectiveText(state) {
  const ms = state.missions;
  if (ms.fare) return 'Antar penumpang ke ' + ms.fare.name;
  const step = currentStep(ms);
  if (!step) return 'Free roam — Solmar City milikmu';
  return step.text;
}

export function missionTargetPos(state) {
  const ms = state.missions;
  if (ms.fare) return ms.fare;
  const step = currentStep(ms);
  if (!step || !step.target) return null;
  if (step.type === 'steal' && ms.targetCar) {
    return { x: ms.targetCar.x, y: ms.targetCar.y };
  }
  return state.world.places[step.target];
}

// Called when a mission starts: place its props (target car, rivals).
export function startMission(state, index) {
  const ms = state.missions;
  ms.index = index;
  ms.step = 0;
  ms.passenger = false;
  ms.hasPackage = false;
  ms.targetCar = null;
  const def = MISSION_DEFS[index];
  if (!def) return;
  state.message = def.briefing;
  state.dialog = { text: def.briefing, until: state.clockSeconds + 7 };
  if (def.id === 'steal') {
    // The grey sedan waiting in the harbour yard.
    const yard = state.world.places.harbourYard;
    const car = {
      x: yard.x + 30, y: yard.y + 10, angle: 0, speed: 0,
      color: '#8a8f96', kind: 'parked', driver: false, hp: 100,
      braking: false, smoke: 0, roadAxis: null, roadIndex: null, dir: 1,
      targetSpeed: 110, sirenPhase: 0, missionTarget: true,
    };
    state.cars.push(car);
    ms.targetCar = car;
    // Two armed rivals guard the yard.
    state.enemies.push(makeEnemy(yard.x - 60, yard.y - 40, state.rng));
    state.enemies.push(makeEnemy(yard.x + 90, yard.y + 60, state.rng));
  }
  if (def.id === 'package') {
    // Rivals posted near the park gate.
    const gate = state.world.places.parkGate;
    state.enemies.push(makeEnemy(gate.x - 70, gate.y + 30, state.rng));
    state.enemies.push(makeEnemy(gate.x + 60, gate.y - 50, state.rng));
    raiseWanted(state, 2);
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
  state.missionsDone.push(def.id);
  playCash(state.audio);
  state.message = def.title + ' selesai! +$' + def.reward;
  state.dialog = {
    text: 'Dax: "Bagus, Mara. $' + def.reward + ' masuk. Lanjut."',
    until: state.clockSeconds + 6,
  };
  ms.index += 1;
  ms.step = 0;
  ms.passenger = false;
  ms.hasPackage = false;
  ms.targetCar = null;
  if (ms.index < MISSION_DEFS.length) {
    startMission(state, ms.index);
  } else {
    state.message = 'Semua misi selesai! Free roam — cari penumpang untuk fare tambahan.';
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
  const step = currentStep(ms);
  const p = state.player;

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
      if (ms.index === 0) {
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
      if (ms.index === 0 && !p.car) {
        state.message = 'Kamu harus naik mobil dulu untuk mengantar.';
      } else if (ms.index === 2) {
        ms.hasPackage = true;
        playPickup(state.audio);
        state.message = 'Paket diambil. Polisi sudah mengendusmu — hati-hati!';
        advanceStep(state);
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
