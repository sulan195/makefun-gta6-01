// models.js — low-poly prop factories. Every model faces +X and stands on y=0.

import { Builder, rgb, shade } from './gl.js';

const GLASS = rgb('#18242f');
const TYRE = rgb('#101215');
const TRIM = rgb('#24272b');

function wheels(b, tint) {
  for (const sx of [15, -15]) {
    for (const sz of [11, -11]) {
      b.box(sx, 5, sz, 11, 10, 3.6, TYRE);
      b.box(sx, 5, sz * 1.16, 5.5, 5.5, 0.8, shade('#9aa2ab', 1));
    }
  }
  void tint;
}

// A city car: tintable body and hood (kind 6), glass cabin, lights.
export function buildCarMesh() {
  const b = new Builder();
  const white = [1, 1, 1];
  b.box(0, 5.5, 0, 46, 7, 22, white, { kind: 6 });
  b.box(-1, 10, 0, 40, 2.6, 20, [0.88, 0.88, 0.88], { kind: 6 });
  b.box(-2, 14.5, 0, 24, 7, 19, GLASS);
  b.box(0, 18.4, 0, 20, 1.2, 17, white, { kind: 6 });
  b.box(23, 3, 0, 3, 4.5, 22, TRIM);
  b.box(-23, 3, 0, 3, 4.5, 22, TRIM);
  b.box(23.4, 6.5, -6.5, 1.4, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(23.4, 6.5, 6.5, 1.4, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(-23.4, 6.5, -6.5, 1.4, 3, 5, rgb('#ff2d20'), { kind: 3 });
  b.box(-23.4, 6.5, 6.5, 1.4, 3, 5, rgb('#ff2d20'), { kind: 3 });
  wheels(b);
  return b;
}

// The police interceptor: white body, a bold blue band on both flanks and
// the hood, a push bar, and the red/blue light bar (kinds 4 and 5 blink in
// the shader). It must read as POLICE in a single still frame.
export function buildPoliceMesh() {
  const b = new Builder();
  const white = rgb('#eef1f4');
  const blue = rgb('#1248c0');
  const navy = rgb('#0d2c66');
  b.box(0, 5.5, 0, 46, 7, 22, white);
  b.box(-1, 10, 0, 40, 2.6, 20, white);
  b.box(0, 6.2, -11.2, 44, 5.4, 1.2, blue);
  b.box(0, 6.2, 11.2, 44, 5.4, 1.2, blue);
  b.box(6, 11.6, 0, 22, 0.9, 11, blue); // hood stripe
  b.box(-2, 14.5, 0, 24, 7, 19, GLASS);
  b.box(0, 18.4, 0, 20, 1.2, 17, navy);
  b.box(0, 19.6, -4.4, 7, 2.6, 8.2, rgb('#ff2222'), { kind: 4 });
  b.box(0, 19.6, 4.4, 7, 2.6, 8.2, rgb('#2266ff'), { kind: 5 });
  b.box(0, 19.6, 0, 7.5, 2.2, 1.6, rgb('#dfe6ee'));
  b.box(24, 4.5, 0, 3, 7, 17, TRIM); // push bar
  b.box(23.4, 6.5, -6.5, 1.4, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(23.4, 6.5, 6.5, 1.4, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(-23.4, 6.5, -6.5, 1.4, 3, 5, rgb('#ff2d20'), { kind: 3 });
  b.box(-23.4, 6.5, 6.5, 1.4, 3, 5, rgb('#ff2d20'), { kind: 3 });
  wheels(b);
  return b;
}

// A person, 26 units tall, origin at the feet, facing +X. The torso and
// arms are tintable (kind 6 = shirt/jacket); legs, head and hair are baked.
// Parts: 1/2 legs, 3/4 arms — the vertex shader swings them while walking.
export function buildPersonMesh() {
  const b = new Builder();
  const pants = rgb('#2e3440');
  const skin = rgb('#d9a066');
  const hair = rgb('#241a12');
  const shoe = rgb('#191c1f');
  const white = [1, 1, 1];
  b.box(0, 4.75, -3.4, 5.5, 9.5, 5.2, pants, { part: 1 });
  b.box(0, 4.75, 3.4, 5.5, 9.5, 5.2, pants, { part: 2 });
  b.box(0.9, 0.9, -3.4, 7.5, 1.8, 5.2, shoe, { part: 1 });
  b.box(0.9, 0.9, 3.4, 7.5, 1.8, 5.2, shoe, { part: 2 });
  b.box(0, 14.5, 0, 7.5, 10, 11.5, white, { kind: 6 });
  b.box(0, 13.9, -8.6, 4.6, 9, 4.6, white, { kind: 6, part: 3 });
  b.box(0, 13.9, 8.6, 4.6, 9, 4.6, white, { kind: 6, part: 4 });
  b.box(0, 22.6, 0, 7.6, 6.8, 7.6, skin);
  b.box(-0.3, 26.4, 0, 8.2, 1.8, 8.2, hair);
  b.box(-3.9, 24.2, 0, 1.4, 5.5, 7.6, hair);
  return b;
}

// CONDOR, the police helicopter: dark blue body, white roof, blue band,
// glass nose, tail boom and fin. The main rotor is a separate mesh so it
// can spin. Origin at the body centre; skids hang below.
export function buildHeliMesh() {
  const b = new Builder();
  const body = rgb('#22384f');
  const white = rgb('#edf1f5');
  const blue = rgb('#1248c0');
  b.box(0, 0, 0, 34, 13, 14.5, body);
  b.box(0, 7.2, 0, 29, 1.8, 12.5, white);
  b.box(0, -1, -7.6, 30, 5, 1, blue);
  b.box(0, -1, 7.6, 30, 5, 1, blue);
  b.box(15.5, 0.5, 0, 7, 8.5, 12, GLASS);
  b.box(-27, 2, 0, 24, 4.5, 4.5, body);
  b.box(-39, 6.5, 0, 3.5, 11, 2, blue);
  b.box(0, -10.5, -8.5, 30, 1.6, 1.6, TRIM);
  b.box(0, -10.5, 8.5, 30, 1.6, 1.6, TRIM);
  b.box(8, -8, -8.5, 2, 4.5, 1.4, TRIM);
  b.box(8, -8, 8.5, 2, 4.5, 1.4, TRIM);
  b.box(-8, -8, -8.5, 2, 4.5, 1.4, TRIM);
  b.box(-8, -8, 8.5, 2, 4.5, 1.4, TRIM);
  b.box(0, 8.6, 0, 3.4, 2.6, 3.4, TRIM); // mast
  b.box(10, -7.6, 0, 6, 2.6, 6, rgb('#ffd34d'), { kind: 3 }); // searchlight housing
  return b;
}

export function buildHeliRotor() {
  const b = new Builder();
  const dark = rgb('#14171b');
  b.box(0, 0, 0, 68, 0.8, 5.5, dark);
  b.box(0, 0, 0, 5.5, 0.8, 68, dark);
  b.box(0, 0.4, 0, 6, 1.6, 6, dark);
  return b;
}

// A roadblock barrier: striped board on two feet, spanning local Z.
export function buildBarrierMesh() {
  const b = new Builder();
  const orange = rgb('#ff7a26');
  const white = rgb('#f2f2f2');
  for (let i = 0; i < 5; i++) {
    b.box(0, 7, -12 + i * 6, 3.2, 8, 5.8, i % 2 ? white : orange);
  }
  b.box(0, 1.2, -10, 7, 2.4, 7, TRIM);
  b.box(0, 1.2, 10, 7, 2.4, 7, TRIM);
  b.box(0, 12.4, -6, 2.4, 2.4, 3.4, rgb('#ff2222'), { kind: 4 });
  b.box(0, 12.4, 6, 2.4, 2.4, 3.4, rgb('#2266ff'), { kind: 5 });
  return b;
}

// Floating pickup crates: weapons glow orange, ammunition green.
export function buildPickupMesh(kind) {
  const b = new Builder();
  const glow = kind === 'weapon' ? rgb('#ff9a2a') : rgb('#51e07a');
  b.box(0, 3, 0, 11, 6, 11, rgb('#22262c'));
  b.box(0, 6.8, 0, 9, 1.8, 9, glow, { kind: 3 });
  b.box(0, 3, 0, 12.4, 2, 3, glow, { kind: 3 });
  return b;
}

// The race checkpoint ring: a fat emissive torus standing in the YZ plane.
export function buildRingMesh() {
  const b = new Builder();
  b.torus(0, 26, 0, 25, 2.4, 22, rgb('#ffb020'), { kind: 3 });
  return b;
}

// The mission marker: a spinning emissive diamond.
export function buildDiamondMesh() {
  const b = new Builder();
  b.box(0, 0, 0, 10, 15, 10, rgb('#ffd34d'), { kind: 3, ry: Math.PI / 4 });
  return b;
}
