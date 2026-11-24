
import { Builder, rgb, shade } from './gl.js';

const GLASS = rgb('#18242f');
const TYRE = rgb('#101215');
const TRIM = rgb('#24272b');

function wheels(b) {
  for (const sx of [15, -15]) {
    for (const sz of [11, -11]) {
      b.box(sx, 5, sz, 11, 10, 3.6, TYRE);
      b.box(sx, 5, sz * 1.16, 5.5, 5.5, 0.8, shade('#9aa2ab', 1));
    }
  }
}

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

export function buildPoliceMesh() {
  const b = new Builder();
  const white = rgb('#eef1f4');
  const blue = rgb('#1248c0');
  const navy = rgb('#0d2c66');
  b.box(0, 5.5, 0, 46, 7, 22, white);
  b.box(-1, 10, 0, 40, 2.6, 20, white);
  b.box(0, 6.2, -11.2, 44, 5.4, 1.2, blue);
  b.box(0, 6.2, 11.2, 44, 5.4, 1.2, blue);
  b.box(6, 11.6, 0, 22, 0.9, 11, blue);
  b.box(-2, 14.5, 0, 24, 7, 19, GLASS);
  b.box(0, 18.4, 0, 20, 1.2, 17, navy);
  b.box(0, 19.6, -4.4, 7, 2.6, 8.2, rgb('#ff2222'), { kind: 4 });
  b.box(0, 19.6, 4.4, 7, 2.6, 8.2, rgb('#2266ff'), { kind: 5 });
  b.box(0, 19.6, 0, 7.5, 2.2, 1.6, rgb('#dfe6ee'));
  b.box(24, 4.5, 0, 3, 7, 17, TRIM);
  b.box(23.4, 6.5, -6.5, 1.4, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(23.4, 6.5, 6.5, 1.4, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(-23.4, 6.5, -6.5, 1.4, 3, 5, rgb('#ff2d20'), { kind: 3 });
  b.box(-23.4, 6.5, 6.5, 1.4, 3, 5, rgb('#ff2d20'), { kind: 3 });
  wheels(b);
  return b;
}

export function buildPersonMesh(variant = 0, custom = null) {
  const b = new Builder();
  const pants = rgb(['#2e3440', '#5a4632', '#31435c'][variant]);
  const skin = rgb(custom ? custom.skin : ['#d9a066', '#a06844', '#f0c8a0'][variant]);
  const hair = rgb(custom ? custom.hair : ['#241a12', '#241a12', '#6b4a2f'][variant]);
  const style = custom ? custom.style : variant;
  const shoe = rgb('#191c1f');
  const white = [1, 1, 1];
  b.box(0, 5.25, -2.1, 5, 10.5, 3.9, pants, { part: 1 });
  b.box(0, 5.25, 2.1, 5, 10.5, 3.9, pants, { part: 2 });
  b.box(0.9, 0.85, -2.1, 6.8, 1.7, 4, shoe, { part: 1 });
  b.box(0.9, 0.85, 2.1, 6.8, 1.7, 4, shoe, { part: 2 });
  b.box(0, 15.2, 0, 6.4, 10.5, 8.2, white, { kind: 6 });
  b.box(0, 17.3, -6.2, 3.6, 5, 3.2, white, { kind: 6, part: 3 });
  b.box(0, 12.3, -6.2, 3.2, 5, 2.9, skin, { part: 3 });
  b.box(0, 17.3, 6.2, 3.6, 5, 3.2, white, { kind: 6, part: 4 });
  b.box(0, 12.3, 6.2, 3.2, 5, 2.9, skin, { part: 4 });
  b.box(0, 23.4, 0, 6, 6, 6, skin);
  if (style === 1) {
    b.box(-0.2, 26.8, 0, 6.8, 1.7, 6.8, hair);
    b.box(4.1, 26.4, 0, 4.2, 0.7, 6, hair);
    b.box(-3.1, 25.2, 0, 1.1, 3.2, 6, hair);
  } else if (style === 2) {
    b.box(-0.3, 26.9, 0, 6.6, 1.7, 6.6, hair);
    b.box(-3.1, 23, 0, 1.5, 10, 6.2, hair);
  } else {
    b.box(-0.3, 26.9, 0, 6.6, 1.7, 6.6, hair);
    b.box(-3.1, 25, 0, 1.3, 5, 6, hair);
  }
  return b;
}

export function buildTruckMesh() {
  const b = new Builder();
  const white = [1, 1, 1];
  b.box(-9, 14, 0, 34, 18, 21, rgb('#dfe3e6'));
  b.box(17.5, 9.5, 0, 13, 11, 19, white, { kind: 6 });
  b.box(22.5, 11.5, 0, 3.5, 6, 16.5, GLASS);
  b.box(24.5, 4.5, 0, 2.5, 5, 19, TRIM);
  b.box(-26.5, 5, 0, 2, 6, 19, TRIM);
  b.box(24.6, 7, -6.5, 1.2, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(24.6, 7, 6.5, 1.2, 3, 5, rgb('#fff3c4'), { kind: 3 });
  b.box(-27.4, 7, -6.5, 1.2, 3, 5, rgb('#ff2d20'), { kind: 3 });
  b.box(-27.4, 7, 6.5, 1.2, 3, 5, rgb('#ff2d20'), { kind: 3 });
  for (const sx of [16, -18]) {
    for (const sz of [11, -11]) b.box(sx, 6, sz, 12, 12, 3.6, TYRE);
  }
  return b;
}

export function buildMotoMesh() {
  const b = new Builder();
  const white = [1, 1, 1];
  b.box(11, 4.8, 0, 2.6, 9.6, 9.6, TYRE);
  b.box(-11, 4.8, 0, 2.6, 9.6, 9.6, TYRE);
  b.box(1, 7.5, 0, 20, 3.4, 4.6, white, { kind: 6 });
  b.box(6, 10, 0, 8, 3, 5, white, { kind: 6 });
  b.box(-5, 10.5, 0, 9, 2.2, 5.4, rgb('#191c1f'));
  b.box(12.5, 11, 0, 1.6, 4.5, 7, GLASS);
  const cloth = rgb('#31435c');
  b.box(-4, 13.5, -3.4, 7, 5, 3.4, cloth);
  b.box(-4, 13.5, 3.4, 7, 5, 3.4, cloth);
  b.box(-3, 19.5, 0, 6.4, 8.5, 6.6, white, { kind: 6 });
  b.box(2.5, 17.5, -4.9, 8.5, 3, 2.6, white, { kind: 6 });
  b.box(2.5, 17.5, 4.9, 8.5, 3, 2.6, white, { kind: 6 });
  b.box(-3, 26, 0, 6.4, 5.8, 6.4, rgb('#d9a066'));
  b.box(-3, 29.4, 0, 7, 1.6, 7, rgb('#c23b2e'));
  return b;
}

export function buildHeliMesh() {
  const b = new Builder();
  const body = rgb('#5a7a94');
  const white = rgb('#edf1f5');
  const blue = rgb('#1248c0');
  b.box(0, 0, 0, 34, 13, 14.5, body);
  b.box(0, 7, 0, 30, 3, 13, white);
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
  b.box(0, 8.6, 0, 3.4, 2.6, 3.4, TRIM);
  b.box(10, -7.6, 0, 6, 2.6, 6, rgb('#ffd34d'), { kind: 3 });
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

export function buildPickupMesh(kind) {
  const b = new Builder();
  const glow = kind === 'weapon' ? rgb('#ff9a2a') : rgb('#51e07a');
  b.box(0, 2.3, 0, 10, 4.6, 10, rgb('#4a5560'));
  b.box(0, 5.5, 0, 9, 1.8, 9, glow, { kind: 3 });
  b.box(0, 2.3, 0, 11.4, 2, 3, glow, { kind: 3 });
  return b;
}

export function buildRingMesh() {
  const b = new Builder();
  b.torus(0, 26, 0, 25, 2.4, 22, rgb('#ffb020'), { kind: 3 });
  return b;
}

export function buildDiamondMesh() {
  const b = new Builder();
  b.box(0, 0, 0, 10, 15, 10, rgb('#ffd34d'), { kind: 3, ry: Math.PI / 4 });
  return b;
}

export function buildGunMesh() {
  const b = new Builder();
  const dark = rgb('#5d646c');
  b.box(1.5, 0, 0, 15, 3, 2.1, dark);
  b.box(-2.5, -2.6, 0, 2.4, 4, 1.9, dark);
  b.box(10, 0.6, 0, 7, 1.4, 1.4, dark);
  b.box(2, 2.2, 0, 5, 1.4, 1.6, rgb('#c8ccd0'));
  return b;
}
