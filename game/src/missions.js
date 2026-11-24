
import { dist } from './util.js';
import { makeCar } from './cars.js';
import { makeEnemy } from './entities.js';
import { raiseWanted } from './police.js';
import { playCash, playPickup, playGunshot } from './audio.js';
import { addRespect } from './progression.js';

export const MISSION_DEFS = [
  {
    id: 'taxi',
    title: 'Mission 1 — First Taxi Run',
    briefing: 'Dax: "Mara, a passenger is waiting in Old Town. Pick her up, take her to the Marina. Keep it quiet."',
    reward: 150, respect: 5,
    steps: [
      { type: 'goto', text: 'Pick up the passenger in Old Town', target: 'taxiStand', radius: 70, needCar: true },
      { type: 'pickup', text: 'Passenger aboard — drive to Marina West', target: 'marina', radius: 80 },
    ],
  },
  {
    id: 'steal',
    title: 'Mission 2 — The Ordered Car',
    briefing: 'Dax: "The crew needs the gray sedan at Harbour Yard. Take it, then shake the police."',
    reward: 300, respect: 8,
    steps: [
      { type: 'goto', text: 'Go to Harbour Yard', target: 'harbourYard', radius: 90 },
      { type: 'steal', text: 'Steal the gray sedan (press E)', target: 'harbourYard', radius: 60 },
      { type: 'escape', text: 'Escape! Drop your wanted level to 0', target: null, radius: 0 },
    ],
  },
  {
    id: 'package',
    title: 'Mission 3 — Hot Package',
    briefing: 'Dax: "This package has to reach Downtown — and the police are already onto you. Do not get caught."',
    reward: 500, respect: 10,
    steps: [
      { type: 'pickup', text: 'Pick up the package at Palmera Park', target: 'parkGate', radius: 70, package: true },
      { type: 'deliver', text: 'Deliver the package to Downtown plaza', target: 'downtown', radius: 80 },
    ],
  },
  {
    id: 'balas',
    title: 'Mission 4 — Payback',
    briefing: 'Dax: "The Sanca crew torched our stash car in Southside. Your turn: destroy their pride and joy until it blows."',
    reward: 700, respect: 12,
    steps: [
      { type: 'goto', text: 'Go to Southside', target: 'southside', radius: 90 },
      { type: 'destroy', text: 'Destroy the Sanca crew car — shoot it until it explodes', target: null, radius: 0 },
    ],
  },
  {
    id: 'kurir',
    title: 'Mission 5 — Midnight Courier',
    briefing: 'Sinta: "Documents at Marina West must reach Old Town tonight. The moment you move, the police will catch the scent — do not stop."',
    reward: 900, respect: 15,
    steps: [
      { type: 'pickup', text: 'Pick up the documents at Marina West', target: 'marina', radius: 75, package: true, raiseWanted: 3 },
      { type: 'deliver', text: 'Deliver the documents to the Taxi stand, Old Town', target: 'taxiStand', radius: 80 },
    ],
  },
  {
    id: 'kawal',
    title: 'Mission 6 — Escort Sinta',
    briefing: 'Dax: "Pick Sinta up at Downtown plaza and take her to Harbour Yard. The Sanca crew is hunting her — keep her safe."',
    reward: 1200, respect: 18, respectReq: 45,
    steps: [
      { type: 'pickup', text: 'Pick up Sinta at Downtown plaza', target: 'downtown', radius: 75, passenger: true },
      { type: 'deliver', text: 'Take Sinta to Harbour Yard', target: 'harbourYard', radius: 85 },
    ],
  },
  {
    id: 'gudang',
    title: 'Mission 7 — Harbour Warehouse',
    briefing: 'Dax: "A car holding our evidence is parked by the Sanca crew at Harbour Yard. Blow the car, then disappear."',
    reward: 1600, respect: 22,
    steps: [
      { type: 'goto', text: 'Go to Harbour Yard', target: 'harbourYard', radius: 90 },
      { type: 'destroy', text: 'Blow up the evidence car', target: null, radius: 0 },
      { type: 'escape', text: 'Escape! Drop your wanted level to 0', target: null, radius: 0 },
    ],
  },
  {
    id: 'bank',
    title: 'Mission 8 — The Bank Solmar Job',
    briefing: 'Dax: "One last score, Mara. Bank Solmar. Take the money — your wanted level will max out — then disappear to Udin\'s Garage."',
    reward: 3000, respect: 30, respectReq: 80, clearWantedOnComplete: true,
    steps: [
      { type: 'goto', text: 'Go to Bank Solmar', target: 'bank', radius: 80 },
      { type: 'pickup', text: 'Take the money at Bank Solmar', target: 'bank', radius: 70, package: true, raiseWanted: 5 },
      { type: 'goto', text: 'Disappear to Udin\'s Garage — you are safe there', target: 'garage', radius: 95 },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    waiting: false,
    passenger: false,
    hasPackage: false,
    targetCar: null,
    escapeTimer: 0,
    fare: null,
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
  if (ms.fare) return 'Take the passenger to ' + ms.fare.name;
  if (ms.waiting) {
    const def = currentMission(ms);
    return 'You need Respect ' + (def ? def.respectReq : 0) + ' for the next mission — run fares & street activities';
  }
  const step = currentStep(ms);
  if (!step) return 'Free roam — Solmar City is yours';
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

function placeTargetCar(state, placeKey, color, guards) {
  const spot = state.world.places[placeKey];
  const car = makeCar(spot.x + 30, spot.y + 10, 0, {
    kind: 'parked', driver: false, color, rng: state.rng,
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
    state.message = 'Dax: "Not yet, Mara. Build your Respect first."';
    state.dialog = {
      text: 'Dax: "' + def.title + ' is waiting. It needs Respect ' + def.respectReq
        + ' — complete fares and street activities to earn it."',
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
  state.money += Math.round(def.reward * (state.diffPay || 1));
  if (def.clearWantedOnComplete) {
    state.wanted = 0;
    state.wantedTimer = 0;
  }
  addRespect(state, def.respect || 0);
  state.missionsDone.push(def.id);
  playCash(state.audio);
  state.message = def.title + ' complete! +$' + def.reward;
  state.messageUntil = state.clockSeconds + 4;
  state.dialog = {
    text: 'Dax: "Good work, Mara. $' + def.reward + ' is in. Keep going."',
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
    state.message = 'All missions complete! Free roam — pick up fares, race at the Marina, or chase Respect.';
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
  state.message = 'A new passenger at ' + from.name + ' — pick them up!';
}

export function updateMissions(state, dt) {
  const ms = state.missions;
  const p = state.player;

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
        state.message = 'Passenger aboard! Take them to ' + dest.name;
        playPickup(state.audio);
      }
    } else if (dist(p.x, p.y, dest.x, dest.y) < 80) {
      state.money += Math.round(ms.fare.reward * (state.diffPay || 1));
      addRespect(state, 2);
      playCash(state.audio);
      state.message = 'Fare complete! +$' + ms.fare.reward;
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
        if (p.car) {
          ms.passenger = true;
          playPickup(state.audio);
          state.message = 'Passenger: "Marina West, and step on it!"';
          advanceStep(state);
        } else {
          state.message = 'The passenger is waiting for a car — press E near one.';
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
          state.message = 'The police caught your scent! Wanted ' + state.wanted + ' — keep moving!';
        } else {
          state.message = 'Package picked up. The police are onto you — be careful!';
        }
        advanceStep(state);
      } else if (step.passenger) {
        if (!p.car) {
          state.message = 'You need to be in a car to pick her up.';
        } else {
          ms.passenger = true;
          playPickup(state.audio);
          state.message = 'Sinta: "Do not let them catch me, Mara."';
          advanceStep(state);
        }
      } else {
        advanceStep(state);
      }
    }
  } else if (step.type === 'steal') {
    if (ms.targetCar && p.car === ms.targetCar) {
      raiseWanted(state, 2);
      state.message = 'Car acquired! The police are coming — RUN!';
      advanceStep(state);
    }
  } else if (step.type === 'destroy') {
    if (ms.targetCar && ms.targetCar.exploded) {
      state.message = 'Target destroyed! The blast echoed across Solmar.';
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

export function updateEnemies(state, dt) {
  const p = state.player;
  const rng = state.rng;
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
        e.walkPhase += dt * 7;
      }
      if (d < 380 && e.fireCooldown <= 0) {
        e.fireCooldown = 1.4;
        const spread = (rng() - 0.5) * 0.35;
        if (rng() < 0.3) {
          state.player.health = Math.max(0, state.player.health - 6);
          state.message = 'A rival shot you!';
          state.messageUntil = state.clockSeconds + 1.5;
        }
        state.tracers.push({
          x1: e.x + Math.cos(want + spread) * 20, y1: e.y + Math.sin(want + spread) * 20, h1: 15,
          x2: e.x + Math.cos(want + spread) * 300, y2: e.y + Math.sin(want + spread) * 300, h2: 10,
          life: 0.07, maxLife: 0.07,
        });
        playGunshot(state.audio);
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.alive);
}
