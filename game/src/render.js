// render.js — the 3D renderer for Solmar City: WebGL2 setup, the merged
// city, sun shadows projected from the real building geometry, blob
// shadows, the CONDOR searchlight, tracers and particles. Draw calls stay
// low: the whole static city is two meshes, and every dynamic prop shares
// one of a handful of uploaded models.

import {
  createGL, createProgram, Mesh, MeshA, Points, Builder, BuilderA,
  LIT_VS, LIT_FS, ALPHA_VS, ALPHA_FS, POINTS_VS, POINTS_FS, SKY_VS, SKY_FS,
  m4persp, m4lookAt, m4mul, m4compose, m4basis, m3normal, rgb,
} from './gl.js';
import { buildCity, sunForClock } from './city.js';
import {
  buildCarMesh, buildPoliceMesh, buildPersonMesh, buildHeliMesh,
  buildHeliRotor, buildBarrierMesh, buildPickupMesh, buildRingMesh,
  buildDiamondMesh,
} from './models.js';
import { missionTargetPos } from './missions.js';
import { raceTarget, RACE_POINTS, RACE_START } from './races.js';
import { clamp } from './util.js';

const SHADOW_VS = `#version 300 es
in vec3 aPos;
uniform mat4 uProj, uView, uModel;
void main() { gl_Position = uProj * uView * uModel * vec4(aPos, 1.0); }`;
const SHADOW_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 o;
void main() { o = uColor; }`;

const MARA_TINT = rgb('#9c2b1e');
const ENEMY_TINT = rgb('#43484f');
const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function createRenderer(canvas, world) {
  const gl = createGL(canvas);
  if (!gl) return null;
  const lit = createProgram(gl, LIT_VS, LIT_FS,
    { aPos: 0, aNor: 1, aCol: 2, aKind: 3, aPart: 4 });
  const alpha = createProgram(gl, ALPHA_VS, ALPHA_FS, { aPos: 0, aCol: 1 });
  const points = createProgram(gl, POINTS_VS, POINTS_FS, { aPos: 0, aCol: 1, aSize: 2 });
  const sky = createProgram(gl, SKY_VS, SKY_FS, { aPos: 0 });
  const shadow = createProgram(gl, SHADOW_VS, SHADOW_FS, { aPos: 0 });

  const city = buildCity(world);
  // The sky is one clip-space triangle: the fragment shader rebuilds the
  // view ray per pixel, so there are no cube-face seams or clipped wedges.
  const skyBuilder = new Builder();
  {
    const c = [1, 1, 1];
    const i0 = skyBuilder.vert(-1, -1, 0, 0, 0, 1, c);
    const i1 = skyBuilder.vert(3, -1, 0, 0, 0, 1, c);
    const i2 = skyBuilder.vert(-1, 3, 0, 0, 0, 1, c);
    skyBuilder.idx.push(i0, i1, i2);
  }

  const coneBuilder = new BuilderA();
  coneBuilder.cone([1, 0.96, 0.78], 0.13, 0.035, 20);
  const discBuilder = new BuilderA();
  discBuilder.disc(0, 0, 0, 1, [1, 0.95, 0.72], 0.34, 0, 20);

  const R = {
    gl, lit, alpha, points, sky, shadow,
    ground: new Mesh(gl, city.ground),
    props: new Mesh(gl, city.props),
    skyMesh: new Mesh(gl, skyBuilder),
    car: new Mesh(gl, buildCarMesh()),
    police: new Mesh(gl, buildPoliceMesh()),
    person: new Mesh(gl, buildPersonMesh()),
    heli: new Mesh(gl, buildHeliMesh()),
    rotor: new Mesh(gl, buildHeliRotor()),
    barrier: new Mesh(gl, buildBarrierMesh()),
    pickupWeapon: new Mesh(gl, buildPickupMesh('weapon')),
    pickupAmmo: new Mesh(gl, buildPickupMesh('ammo')),
    ring: new Mesh(gl, buildRingMesh()),
    diamond: new Mesh(gl, buildDiamondMesh()),
    cone: new MeshA(gl, coneBuilder),
    disc: new MeshA(gl, discBuilder),
    dyn: new MeshA(gl, null, true), // blob shadows, scorch marks, pillars
    lines: new MeshA(gl, null, true), // tracers
    ptsAdd: new Points(gl, 2048),
    ptsNorm: new Points(gl, 2048),
    cityCounts: { ground: city.ground.counts(), props: city.props.counts() },
  };
  return R;
}

function setLit(R, model, tint, walk, walkAmp, blink) {
  const { gl, lit } = R;
  gl.uniformMatrix4fv(lit.u('uModel'), false, model);
  gl.uniformMatrix3fv(lit.u('uNorm'), false, m3normal(model));
  gl.uniform3fv(lit.u('uTint'), tint);
  gl.uniform1f(lit.u('uWalk'), walk);
  gl.uniform1f(lit.u('uWalkAmp'), walkAmp);
  gl.uniform1f(lit.u('uBlink'), blink);
}

const ROTZ_DOWN = new Float32Array([0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function drawPerson(R, x, y, angle, tint, walkPhase, walkAmp, down) {
  let m = m4compose(x, 0, y, -angle, 1);
  if (down) m = m4mul(m4compose(x, 2.5, y, -angle, 1), ROTZ_DOWN);
  setLit(R, m, tint, walkPhase, down ? 0 : walkAmp, 0);
  R.person.draw(R.gl);
}

function drawCar(R, car) {
  const isPolice = car.kind === 'police';
  const blink = isPolice ? (Math.sin(car.sirenPhase * 9) > 0 ? 1 : 0) : 0;
  setLit(R, m4compose(car.x, 0, car.y, -car.angle, 1),
    isPolice ? [1, 1, 1] : rgb(car.color), 0, 0, blink);
  (isPolice ? R.police : R.car).draw(R.gl);
}

// Ring orientation: face along the race route through each checkpoint.
function ringRotY(idx) {
  const pts = [RACE_START, ...RACE_POINTS];
  const prev = pts[idx];
  const next = pts[(idx + 1) % pts.length];
  return Math.atan2(-(next.y - prev.y), next.x - prev.x);
}

export function drawScene(R, state) {
  const { gl } = R;
  const sun = sunForClock(state.clockMinutes);
  const t = state.clockSeconds;

  // --- camera -------------------------------------------------------------
  let eye, target;
  if (state.mode === 'title') {
    // From the north shore, looking south across the whole city to the
    // beach and the sea, with the low sun raking in from the west.
    const a = -1.85 + t * 0.016;
    eye = [1400 + Math.cos(a) * 1150, 210 + Math.sin(t * 0.1) * 10, 1400 + Math.sin(a) * 1150];
    target = [1400, 0, 1400];
  } else {
    const c = state.camera;
    eye = [c.x, c.y, c.z];
    target = [c.tx, c.ty, c.tz];
  }
  const view = m4lookAt(eye[0], eye[1], eye[2], target[0], target[1], target[2], 0, 1, 0);
  const proj = m4persp((55 * Math.PI) / 180, 1280 / 800, 1, 5200);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(sun.fog[0], sun.fog[1], sun.fog[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.depthFunc(gl.LEQUAL);

  // --- sky ------------------------------------------------------------------
  gl.useProgram(R.sky.prog);
  const skyView = new Float32Array(view);
  skyView[12] = 0; skyView[13] = 0; skyView[14] = 0;
  gl.uniformMatrix4fv(R.sky.u('uProj'), false, proj);
  gl.uniformMatrix4fv(R.sky.u('uView'), false, skyView);
  gl.uniform3fv(R.sky.u('uSunDir'), sun.sunDir);
  gl.uniform3fv(R.sky.u('uZen'), sun.zen);
  gl.uniform3fv(R.sky.u('uHor'), sun.hor);
  gl.uniform3fv(R.sky.u('uSunCol'), sun.sunCol);
  gl.uniform3fv(R.sky.u('uRight'), [view[0], view[4], view[8]]);
  gl.uniform3fv(R.sky.u('uUp'), [view[1], view[5], view[9]]);
  gl.uniform3fv(R.sky.u('uBack'), [view[2], view[6], view[10]]);
  gl.uniform1f(R.sky.u('uTan'), 0.5206);
  gl.uniform1f(R.sky.u('uAspect'), 1280 / 800);
  gl.depthMask(false);
  R.skyMesh.draw(gl);
  gl.depthMask(true);

  // --- lit world --------------------------------------------------------------
  gl.useProgram(R.lit.prog);
  gl.uniformMatrix4fv(R.lit.u('uProj'), false, proj);
  gl.uniformMatrix4fv(R.lit.u('uView'), false, view);
  gl.uniform3fv(R.lit.u('uSunDir'), sun.sunDir);
  gl.uniform3fv(R.lit.u('uSunCol'), sun.sunCol);
  gl.uniform3fv(R.lit.u('uAmb'), sun.amb);
  gl.uniform3fv(R.lit.u('uCamPos'), eye);
  gl.uniform3fv(R.lit.u('uFogCol'), sun.fog);
  gl.uniform1f(R.lit.u('uFogDen'), sun.fogDen);
  gl.uniform1f(R.lit.u('uTime'), t);

  setLit(R, IDENT, [1, 1, 1], 0, 0, 0);
  R.ground.draw(gl);
  setLit(R, IDENT, [1, 1, 1], 0, 0, 0);
  R.props.draw(gl);

  const p = state.player;
  for (const car of state.cars) {
    if (car === p.car) continue;
    drawCar(R, car);
  }
  if (p.car) drawCar(R, p.car);
  for (const pc of state.police) drawCar(R, pc);
  if (state.roadblock) {
    for (const rc of state.roadblock.cars) drawCar(R, rc);
    for (const b of state.barriers) {
      setLit(R, m4compose(b.x, 0, b.y, Math.PI / 2 - b.angle, 1),
        [1, 1, 1], 0, 0, Math.sin(t * 9) > 0 ? 1 : 0);
      R.barrier.draw(gl);
    }
  }
  for (const ped of state.peds) {
    drawPerson(R, ped.x, ped.y, ped.angle, rgb(ped.shirt),
      ped.walkPhase, ped.flee > 0 ? 1 : 0.75, ped.down);
  }
  for (const e of state.enemies) {
    if (!e.alive) continue;
    drawPerson(R, e.x, e.y, e.angle, ENEMY_TINT, e.walkPhase || 0, 0.9, false);
  }
  if (p.onFoot) {
    drawPerson(R, p.x, p.y, p.angle, MARA_TINT,
      p.walkPhase, p.moving ? 1 : 0, false);
  }
  if (state.heli) {
    const h = state.heli;
    const alt = 84 + Math.sin(t * 0.7) * 3;
    setLit(R, m4compose(h.x, alt, h.y, -h.angle, 1), [1, 1, 1], 0, 0, 0);
    R.heli.draw(gl);
    setLit(R, m4compose(h.x, alt + 10.6, h.y, -(h.rotorPhase % 6.283), 1),
      [1, 1, 1], 0, 0, 0);
    R.rotor.draw(gl);
  }
  if (state.pickups) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = 2 + Math.sin(t * 2 + pk.x * 0.05) * 1.6;
      setLit(R, m4compose(pk.x, bob, pk.y, -t * 1.5, 1), [1, 1, 1], 0, 0, 0);
      (pk.kind === 'weapon' ? R.pickupWeapon : R.pickupAmmo).draw(gl);
    }
  }
  const rTarget = raceTarget(state);
  if (rTarget && state.mode === 'play') {
    const idx = state.race && state.race.active ? state.race.idx + 1 : 0;
    setLit(R, m4compose(rTarget.x, 0, rTarget.y, ringRotY(idx), 1), [1, 1, 1], 0, 0, 0);
    R.ring.draw(gl);
  }
  const mTarget = missionTargetPos(state);
  if (mTarget && state.mode === 'play') {
    setLit(R, m4compose(mTarget.x, 40 + Math.sin(t * 2.4) * 4, mTarget.y, -t * 1.8, 1),
      [1, 1, 1], 0, 0, 0);
    R.diamond.draw(gl);
  }

  // --- sun shadows: the real prop geometry, projected flat ------------------
  const S = sun.sunDir;
  if (S[1] > 0.03) {
    const L = [-S[0], -S[1], -S[2]];
    const k = 1 / L[1];
    const sp = new Float32Array([
      1, 0, 0, 0,
      -L[0] * k, 0, -L[2] * k, 0,
      0, 0, 1, 0,
      L[0] * k * 0.16, 0.16, L[2] * k * 0.16, 1,
    ]);
    gl.useProgram(R.shadow.prog);
    gl.uniformMatrix4fv(R.shadow.u('uProj'), false, proj);
    gl.uniformMatrix4fv(R.shadow.u('uView'), false, view);
    gl.uniformMatrix4fv(R.shadow.u('uModel'), false, sp);
    gl.uniform4fv(R.shadow.u('uColor'),
      [0.04, 0.03, 0.06, clamp((S[1] - 0.03) * 0.5, 0.05, 0.30)]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    R.props.draw(gl);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // --- blob shadows + scorch marks ------------------------------------------
  {
    const b = new BuilderA();
    for (const s of state.scorches || []) {
      b.disc(s.x, 0.17, s.y, 30, [0.03, 0.03, 0.03], 0.5, 0.1);
    }
    const quad = (x, z, w, d, ry, a) =>
      b.groundQuad(x, 0.18, z, w, d, [0.02, 0.02, 0.05, a], ry);
    for (const car of state.cars) quad(car.x, car.y, 54, 32, -car.angle, 0.30);
    for (const pc of state.police) quad(pc.x, pc.y, 54, 32, -pc.angle, 0.30);
    if (state.roadblock) {
      for (const rc of state.roadblock.cars) quad(rc.x, rc.y, 54, 32, -rc.angle, 0.30);
    }
    for (const ped of state.peds) quad(ped.x, ped.y, 15, 15, 0, 0.26);
    if (p.onFoot) quad(p.x, p.y, 15, 15, 0, 0.3);
    if (state.heli) quad(state.heli.x, state.heli.y, 62, 62, 0, 0.16);
    R.dyn.upload(gl, b);
    gl.useProgram(R.alpha.prog);
    gl.uniformMatrix4fv(R.alpha.u('uProj'), false, proj);
    gl.uniformMatrix4fv(R.alpha.u('uView'), false, view);
    gl.uniformMatrix4fv(R.alpha.u('uModel'), false, IDENT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    R.dyn.draw(gl);
    gl.depthMask(true);
  }

  // --- additive glows: searchlight, marker pillar, tracers -------------------
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  if (state.heli && !state.heli.leaving) {
    const h = state.heli;
    const alt = 84 + Math.sin(t * 0.7) * 3;
    const src = [h.x, alt - 8, h.y];
    const dst = [h.lightX, 0, h.lightY];
    const dir = [dst[0] - src[0], dst[1] - src[1], dst[2] - src[2]];
    const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const ya = [-dir[0], -dir[1], -dir[2]]; // local +Y maps from target to source
    let xa = [ya[1], -ya[0], 0]; // cross(ya, [0,0,1])
    let xl = Math.hypot(xa[0], xa[1], xa[2]);
    if (xl < 0.001) { xa = [1, 0, 0]; xl = 1; }
    const rad = 48;
    xa = [xa[0] / xl * rad, xa[1] / xl * rad, xa[2] / xl * rad];
    const za = [
      ya[1] * xa[2] - ya[2] * xa[1],
      ya[2] * xa[0] - ya[0] * xa[2],
      ya[0] * xa[1] - ya[1] * xa[0],
    ];
    const zl = Math.hypot(za[0], za[1], za[2]) || 1;
    const zaN = [za[0] / zl * rad, za[1] / zl * rad, za[2] / zl * rad];
    const coneM = m4basis(xa, ya, zaN, src[0], src[1], src[2]);
    gl.useProgram(R.alpha.prog);
    gl.uniformMatrix4fv(R.alpha.u('uModel'), false, coneM);
    R.cone.draw(gl);
    gl.uniformMatrix4fv(R.alpha.u('uModel'), false,
      m4compose(dst[0], 0.19, dst[2], 0, 54));
    R.disc.draw(gl);
  }
  if (mTarget && state.mode === 'play') {
    const b = new BuilderA();
    b.cone([1, 0.83, 0.3], 0.0, 0.06, 14);
    R.dyn.upload(gl, b);
    gl.useProgram(R.alpha.prog);
    const m = m4basis([15, 0, 0], [0, -95, 0], [0, 0, 15], mTarget.x, 95, mTarget.y);
    gl.uniformMatrix4fv(R.alpha.u('uModel'), false, m);
    R.dyn.draw(gl);
  }
  {
    const b = new BuilderA();
    for (const tr of state.tracers) {
      const a = 0.85 * (tr.life / tr.maxLife);
      const c = [1, 0.85, 0.4, a];
      const i1 = b.vert(tr.x1, tr.h1, tr.y1, c);
      const i2 = b.vert(tr.x2, tr.h2, tr.y2, c);
      b.idx.push(i1, i2);
    }
    R.lines.upload(gl, b);
    gl.useProgram(R.alpha.prog);
    gl.uniformMatrix4fv(R.alpha.u('uModel'), false, IDENT);
    R.lines.draw(gl, gl.LINES);
  }
  gl.disable(gl.BLEND);

  // --- particles ---------------------------------------------------------------
  const drawPts = (cloud, list) => {
    if (!list.length) { cloud.count = 0; return; }
    const pos = new Float32Array(list.length * 3);
    const col = new Float32Array(list.length * 4);
    const size = new Float32Array(list.length);
    list.forEach((pt, i) => {
      pos[i * 3] = pt.x; pos[i * 3 + 1] = pt.h; pos[i * 3 + 2] = pt.y;
      const c = rgb(pt.color);
      const frac = pt.life / pt.maxLife;
      col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2];
      col[i * 4 + 3] = pt.alpha * frac;
      size[i] = pt.size * (0.6 + 0.6 * frac);
    });
    cloud.upload(gl, pos, col, size);
    cloud.draw(gl);
  };
  gl.useProgram(R.points.prog);
  gl.uniformMatrix4fv(R.points.u('uProj'), false, proj);
  gl.uniformMatrix4fv(R.points.u('uView'), false, view);
  gl.enable(gl.BLEND);
  gl.depthMask(false);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  drawPts(R.ptsNorm, state.particles.filter((pt) => pt.alpha < 0.8));
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  drawPts(R.ptsAdd, state.particles.filter((pt) => pt.alpha >= 0.8));
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
