// run-tests.mjs — automated tests for the Solmar City entry (gta6-01).
// Run from the repository root:  node tests/run-tests.mjs
// Checks, in order:
//   1. main.ts runs and its output is deterministic (two runs, byte-identical
//      dossier.json) — the harness runs the program twice.
//   2. Gate limits: game/ file count and size, screenshots (3-4, size and
//      dimensions), index.html size, no network references in game/.
//   3. Every game .js file parses as an ES module.
//   4. The game loads in headless Chrome for every ?shot= without JS errors.
//   5. Pure-logic edge cases (10+): wanted, damage, enter/exit car, stealing,
//      combat, missions, save, traffic lights, collisions, busted.

import { execFile } from 'node:child_process';
import {
  readdirSync, readFileSync, statSync, lstatSync, existsSync, rmSync, mkdirSync,
  writeFileSync, copyFileSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'game');
const SHOTS = join(ROOT, 'screenshots');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    failures.push(name + (extra ? ' — ' + extra : ''));
    console.log('  FAIL ' + name + (extra ? ' — ' + extra : ''));
  }
}

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    execFile(cmd, args, { cwd: ROOT, timeout: 120000, ...opts }, (err, stdout, stderr) => {
      res({ code: err ? (err.code ?? 1) : 0, stdout, stderr });
    });
  });
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = (buf[i + 5] << 8) | buf[i + 6];
      const w = (buf[i + 7] << 8) | buf[i + 8];
      return { w, h };
    }
    const len = (buf[i + 2] << 8) | buf[i + 3];
    i += 2 + len;
  }
  return null;
}

function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------- main.ts --
async function testMainDeterminism() {
  console.log('\n[1] main.ts determinism');
  rmSync(join(ROOT, 'out-a'), { recursive: true, force: true });
  rmSync(join(ROOT, 'out-b'), { recursive: true, force: true });
  mkdirSync(join(ROOT, 'out-a'), { recursive: true });
  mkdirSync(join(ROOT, 'out-b'), { recursive: true });
  const a = await run('node', ['main.ts'], { env: { ...process.env, MAKEFUN_OUTPUT_DIR: join(ROOT, 'out-a') } });
  check('main.ts run A exits 0', a.code === 0, a.stderr.slice(0, 300));
  const b = await run('node', ['main.ts'], { env: { ...process.env, MAKEFUN_OUTPUT_DIR: join(ROOT, 'out-b') } });
  check('main.ts run B exits 0', b.code === 0, b.stderr.slice(0, 300));
  const da = readFileSync(join(ROOT, 'out-a', 'dossier.json'));
  const db = readFileSync(join(ROOT, 'out-b', 'dossier.json'));
  check('dossier.json byte-identical across two runs', da.equals(db));
  check('dossier.json under 1.5 MiB', da.length <= 1572864, da.length + ' bytes');
  check('out has game/ and screenshots/', existsSync(join(ROOT, 'out-a', 'game', 'index.html'))
    && existsSync(join(ROOT, 'out-a', 'screenshots')));
  rmSync(join(ROOT, 'out-a'), { recursive: true, force: true });
  rmSync(join(ROOT, 'out-b'), { recursive: true, force: true });
}

// ------------------------------------------------------------------- gates --
function testGates() {
  console.log('\n[2] gate limits');
  const files = walk(GAME);
  const totalBytes = files.reduce((s, f) => s + statSync(f).size, 0);
  check('game/ has at most 993 files', files.length <= 993, files.length + ' files');
  check('game/ is at most 48 MiB', totalBytes <= 50331648, totalBytes + ' bytes');
  check('every game/ path is under 1000 bytes', files.every((f) => Buffer.byteLength(f) <= 1000));
  const indexHtml = statSync(join(GAME, 'index.html'));
  check('game/index.html is at most 1 MiB', indexHtml.size <= 1048576);
  const noSymlinks = files.every((f) => !lstatSync(f).isSymbolicLink());
  check('game/ holds regular files only', noSymlinks);

  const shots = readdirSync(SHOTS).filter((n) => !n.startsWith('.')).sort();
  check('screenshots/ holds 3 or 4 images', shots.length >= 3 && shots.length <= 4, shots.length + ' files');
  for (const name of shots) {
    const buf = readFileSync(join(SHOTS, name));
    const size = pngSize(buf) || jpegSize(buf);
    check(name + ' is at most 256 KiB', buf.length <= 262144, buf.length + ' bytes');
    check(name + ' is a whole PNG or JPEG', size !== null);
    if (size) {
      check(name + ' long side at most 1280', Math.max(size.w, size.h) <= 1280, size.w + 'x' + size.h);
      check(name + ' short side at least 480', Math.min(size.w, size.h) >= 480, size.w + 'x' + size.h);
    }
  }

  // No network references anywhere under game/.
  const bad = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    if (/https?:\/\//.test(text) || /src\s*=\s*["']\/\//.test(text)) bad.push(f);
  }
  check('no http/https references in game/', bad.length === 0, bad.join(', '));
  const totalSrc = files
    .filter((f) => f.endsWith('.js') || f.endsWith('.html'))
    .reduce((s, f) => s + statSync(f).size, 0);
  // The dossier embeds the game source as text under a 160 KiB cap
  // (main.ts text_max_bytes); keep the source comfortably below it.
  check('game source stays below the dossier text cap (under 150 KiB)', totalSrc < 153600, totalSrc + ' bytes');
}

// ------------------------------------------------------------------ parsing --
async function testParses() {
  console.log('\n[3] ES module parsing');
  const jsFiles = walk(GAME).filter((f) => f.endsWith('.js'));
  mkdirSync(join(ROOT, '.test-tmp'), { recursive: true });
  for (const f of jsFiles) {
    const tmp = join(ROOT, '.test-tmp', 'check-' + f.split('/').pop().replace('.js', '.mjs'));
    copyFileSync(f, tmp);
    const r = await run('node', ['--check', tmp]);
    const rel = f.slice(GAME.length + 1);
    check(rel + ' parses as an ES module', r.code === 0, r.stderr.slice(0, 200));
  }
  rmSync(join(ROOT, '.test-tmp'), { recursive: true, force: true });
}

// ------------------------------------------------------------ headless load --
// The provisioned Chromium needs its Hatch WebGL policy flags, and this VM's
// egress proxy blocks plain localhost navigation, so the test serves game/
// from disk through Playwright route interception: no network request ever
// leaves the browser, exactly like the real game (which loads nothing over
// the network either).
const PLAYWRIGHT = '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright/index.mjs';
const POLICY_PATH = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';

async function testHeadless() {
  console.log('\n[4] headless Chrome load');
  let chromium;
  try {
    ({ chromium } = await import(PLAYWRIGHT));
  } catch (e) {
    check('playwright available in this environment', false, String(e).slice(0, 120));
    return;
  }
  const { createHash } = await import('node:crypto');
  const policy = readFileSync(POLICY_PATH);
  const sha = createHash('sha256').update(policy).digest('hex');
  const browser = await chromium.launch({
    executablePath: '/opt/meta-chromium/chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      `--hatch-webgl-allowed-domains-file=${POLICY_PATH}`,
      `--hatch-webgl-allowed-domains-sha256=${sha}`,
    ],
  });
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  const shots = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text());
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = join(GAME, rel);
      if (existsSync(file)) {
        const ext = file.slice(file.lastIndexOf('.'));
        await route.fulfill({
          status: 200,
          contentType: MIME[ext] || 'application/octet-stream',
          body: readFileSync(file),
        });
      } else {
        await route.fulfill({ status: 404, body: 'not found' });
      }
    });
    await page.goto('http://game.local/' + shot.query, { waitUntil: 'load', timeout: 30000 });
    let ready = false;
    try {
      await page.waitForFunction(() => window.__solmarReady === true, null, { timeout: 10000 });
      ready = true;
    } catch { /* reported below */ }
    await page.waitForTimeout(1200);
    const status = await page.evaluate(() => document.getElementById('status')?.textContent || '');
    check(shot.name + ' page loads (status div ready)',
      ready && status.startsWith('Solmar City ready') && !status.includes('ERROR'), status.slice(0, 120));
    check(shot.name + ' has no uncaught JS error', errors.length === 0, errors.join(' | ').slice(0, 200));
    await page.close();
  }
  await browser.close();
}

// --------------------------------------------------------------- logic tests --
async function testLogic() {
  console.log('\n[5] pure-logic edge cases');
  const util = await import('../game/src/util.js');
  const worldMod = await import('../game/src/world.js');
  const ent = await import('../game/src/entities.js');
  const mis = await import('../game/src/missions.js');
  const saveMod = await import('../game/src/save.js');
  const audioMod = await import('../game/src/audio.js');
  const wpn = await import('../game/src/weapons.js');
  const grg = await import('../game/src/garage.js');
  const heliMod = await import('../game/src/helicopter.js');
  const prog = await import('../game/src/progression.js');
  const raceMod = await import('../game/src/races.js');

  function fakeState() {
    const world = worldMod.buildWorld(1);
    return {
      world, rng: util.makeRng(1), seed: 1,
      player: ent.createPlayer(520, 470),
      cars: [], peds: [], police: [], enemies: [], particles: [],
      money: 50, wanted: 0, wantedTimer: 0,
      weapons: wpn.createWeaponState(), pickups: [],
      respect: 0, garage: grg.createGarageState(), garageMenu: false,
      heli: null, roadblock: null, roadblockCooldown: 0, barriers: [], scorches: [],
      race: raceMod.createRaceState(), radioStation: 0,
      clockMinutes: 540, clockSeconds: 0,
      mode: 'play', missions: mis.createMissionState(), missionsDone: [],
      message: '', messageUntil: 0, dialog: null, missionTarget: null,
      busted: false,
      audio: audioMod.createAudio(),
      input: null, view: { camX: 0, camY: 0, w: 1280, h: 800 },
    };
  }

  // 1. Seeded RNG is deterministic.
  const r1 = util.makeRng(42); const r2 = util.makeRng(42);
  check('seeded RNG repeats its stream', r1() === r2() && r1() === r2() && r1() === r2());

  // 2. World generation is deterministic.
  const w1 = worldMod.buildWorld(7); const w2 = worldMod.buildWorld(7);
  check('world generation is deterministic',
    w1.buildings.length === w2.buildings.length
    && w1.buildings[0].x === w2.buildings[0].x
    && w1.buildings[0].y === w2.buildings[0].y);

  // 3. Wanted maths: hiding sheds one star per 6 seconds.
  check('wanted decays one star per 6s hidden', ent.wantedAfterHiding(3, 12) === 1);
  check('wanted never drops below 0', ent.wantedAfterHiding(1, 60) === 0);
  check('raiseWanted caps at 5 stars', (() => {
    const s = fakeState(); s.wanted = 4; ent.raiseWanted(s, 3); return s.wanted === 5;
  })());

  // 4. Armour absorbs 60% of damage; the other 40% hits health.
  check('armour absorbs damage before health', (() => {
    const s = fakeState();
    s.player.armor = 50; s.player.health = 100;
    ent.damagePlayer(s, 10);
    return s.player.armor === 44 && s.player.health === 96;
  })());

  // 5. Entering a parked car works; exiting restores on-foot state.
  check('enter parked car, then exit', (() => {
    const s = fakeState();
    const car = ent.makeCar(540, 470, 0, { kind: 'parked', driver: false });
    s.cars.push(car);
    const res = ent.tryEnterCar(s);
    if (!res.ok || s.player.onFoot) return false;
    const ok = ent.exitCar(s);
    return ok && s.player.onFoot && car.kind === 'parked';
  })());

  // 6. Stealing a driven car with police nearby raises wanted; without, not.
  check('car theft seen by police raises wanted', (() => {
    const s = fakeState();
    const car = ent.makeCar(540, 470, 0, { kind: 'traffic', driver: true });
    s.cars.push(car);
    s.police.push(ent.makeCar(600, 470, 0, { kind: 'police' }));
    ent.tryEnterCar(s);
    return s.wanted === 1;
  })());
  check('car theft unseen raises no wanted', (() => {
    const s = fakeState();
    const car = ent.makeCar(540, 470, 0, { kind: 'traffic', driver: true });
    s.cars.push(car);
    ent.tryEnterCar(s);
    return s.wanted === 0;
  })());

  // 7. No car nearby: enter fails cleanly.
  check('enter car with none nearby fails', (() => {
    const s = fakeState();
    return ent.tryEnterCar(s).ok === false;
  })());

  // 8. Pistol hits an enemy in front and respects its cooldown.
  check('pistol damages an enemy and cools down', (() => {
    const s = fakeState();
    const e = ent.makeEnemy(600, 470, s.rng);
    s.enemies.push(e);
    const fired = ent.firePistol(s, 0);
    const hpAfterFirst = e.health;
    const firedAgain = ent.firePistol(s, 0); // still cooling down
    return fired && hpAfterFirst === 16 && firedAgain === false;
  })());

  // 9. Melee knocks a pedestrian down.
  check('melee knocks a pedestrian down', (() => {
    const s = fakeState();
    s.peds.push({ x: 545, y: 470, angle: 0, speed: 40, shirt: '#fff', walking: true, flee: 0, down: false, downTimer: 0, axis: 'v', roadPos: 520 });
    s.player.angle = 0;
    ent.meleeAttack(s);
    return s.peds[0].down === true;
  })());

  // 10. Mission 1 completes end to end and pays $150.
  check('mission 1 completes and pays', (() => {
    const s = fakeState();
    mis.startMission(s, 0);
    const car = ent.makeCar(520, 520, 0, { kind: 'parked', driver: false });
    s.cars.push(car);
    s.player.car = car; s.player.onFoot = false;
    s.player.x = 520; s.player.y = 520;
    mis.updateMissions(s, 0.1); // pickup
    if (s.missions.step !== 1) return false;
    s.player.x = 2360; s.player.y = 200; // Marina
    mis.updateMissions(s, 0.1); // deliver
    return s.missionsDone.includes('taxi') && s.money === 200 && s.missions.index === 1;
  })());

  // 11. Mission 2: stealing the target car triggers the escape step.
  check('mission 2 steal triggers escape with wanted 2', (() => {
    const s = fakeState();
    mis.startMission(s, 1);
    if (!s.missions.targetCar) return false;
    s.player.x = 2120; s.player.y = 1680; // harbour yard
    mis.updateMissions(s, 0.1); // reach the yard
    if (s.missions.step !== 1) return false;
    s.player.car = s.missions.targetCar; s.player.onFoot = false;
    mis.updateMissions(s, 0.1); // steal the sedan
    return s.missions.step === 2 && s.wanted === 2;
  })());

  // 12. Mission 3: package pickup, then delivery completes it.
  check('mission 3 package run completes', (() => {
    const s = fakeState();
    mis.startMission(s, 2);
    if (s.wanted !== 2) return false;
    s.player.x = 1160; s.player.y = 840; // park gate
    mis.updateMissions(s, 0.1);
    if (!s.missions.hasPackage) return false;
    s.player.x = 1480; s.player.y = 840; // downtown
    mis.updateMissions(s, 0.1);
    return s.missionsDone.includes('package') && s.money === 550;
  })());

  // 13. Traffic stops at a red light.
  check('traffic stops at a red light', (() => {
    const s = fakeState();
    s.clockSeconds = 8; // horizontal green, vertical red
    const car = ent.makeCar(520, 470, Math.PI / 2, {
      kind: 'traffic', roadAxis: 'v', roadIndex: 1, dir: 1, targetSpeed: 110, speed: 100,
    });
    s.cars.push(car);
    ent.updateTraffic(s, 0.5);
    return car.speed < 100;
  })());

  // 14. A pedestrian flees a speeding car.
  check('pedestrian flees a speeding car', (() => {
    const s = fakeState();
    const car = ent.makeCar(520, 470, 0, { kind: 'player', speed: 220 });
    s.player.car = car; s.player.onFoot = false;
    s.peds.push({ x: 560, y: 470, angle: 0, speed: 40, shirt: '#fff', walking: true, flee: 0, down: false, downTimer: 0, axis: 'v', roadPos: 520 });
    ent.updatePeds(s, 0.1);
    return s.peds[0].flee > 0;
  })());

  // 15. Busted: police sitting on a player on foot for 3 seconds.
  check('busted after 3s pinned by police on foot', (() => {
    const s = fakeState();
    s.wanted = 1;
    s.police.push(ent.makeCar(525, 470, 0, { kind: 'police', speed: 0 }));
    for (let i = 0; i < 200; i++) ent.updatePolice(s, 1 / 60);
    return s.busted === true;
  })());

  // 16. Police reinforcements match the wanted level.
  check('police count follows wanted level', (() => {
    const s = fakeState();
    s.wanted = 2;
    ent.updatePolice(s, 0.1);
    return s.police.length === 3;
  })());

  // 17. Save serialisation round-trips the fields the game needs.
  check('save serialises money, mission, position', (() => {
    const s = fakeState();
    s.money = 1234; s.missions.index = 2; s.missionsDone = ['taxi'];
    s.player.x = 111; s.player.y = 222; s.player.health = 77;
    const data = saveMod.serializeSave(s);
    return data.money === 1234 && data.missionIndex === 2
      && data.playerX === 111 && data.playerY === 222 && data.health === 77;
  })());

  // 18. Collision: a circle is pushed out of a building.
  check('circle is pushed out of a building box', (() => {
    const fixed = util.pushCircleOutOfBox(100, 100, 14, 90, 90, 60, 60);
    return fixed.hit === true
      && !util.circleHitsBox(fixed.x, fixed.y, 14, 90, 90, 60, 60);
  })());

  // 19. Traffic light alternates between axes.
  check('traffic light alternates axes', (() => {
    const w = worldMod.buildWorld(3);
    const v0 = ent.lightIsGreenFor(w, 'v', 0);
    const v8 = ent.lightIsGreenFor(w, 'v', 8);
    return v0 === true && v8 === false;
  })());

  // 20. Enemies shoot back and can be removed when defeated.
  check('defeated enemies are removed', (() => {
    const s = fakeState();
    const e = ent.makeEnemy(600, 470, s.rng);
    e.health = 10;
    s.enemies.push(e);
    ent.firePistol(s, 0);
    mis.updateEnemies(s, 0.1);
    return s.enemies.length === 0;
  })());

  // 21. Weapons: Mara starts with fist + pistol; the SMG refuses until owned,
  // then burns finite ammunition at its own fast cooldown.
  check('weapons start as fist+pistol, SMG locked until owned', (() => {
    const s = fakeState();
    if (!s.weapons.owned.includes('fist') || !s.weapons.owned.includes('pistol')) return false;
    if (wpn.switchWeapon(s, 3) !== false) return false; // SMG not owned yet
    s.weapons.owned.push('smg');
    s.weapons.ammo.smg = 3;
    if (wpn.switchWeapon(s, 3) !== true) return false;
    const fired = wpn.fireWeapon(s, 0);
    return fired && s.weapons.ammo.smg === 2
      && s.player.fireCooldown === wpn.WEAPONS.smg.cooldown;
  })());

  // 22. An empty SMG clicks instead of firing; the shotgun spends one shell
  // per shot no matter how many pellets connect.
  check('empty SMG refuses, shotgun spends one shell per shot', (() => {
    const s = fakeState();
    s.weapons.owned.push('smg', 'shotgun');
    s.weapons.current = 'smg';
    s.weapons.ammo.smg = 0;
    if (wpn.fireWeapon(s, 0) !== false) return false;
    s.player.fireCooldown = 0;
    s.weapons.current = 'shotgun';
    s.weapons.ammo.shotgun = 2;
    const e = ent.makeEnemy(580, 470, s.rng);
    s.enemies.push(e);
    const fired = wpn.fireWeapon(s, 0);
    return fired && s.weapons.ammo.shotgun === 1 && e.health < 50;
  })());

  // 23. Respect ranks land on their thresholds and addRespect reports a
  // rank-up exactly when one happens.
  check('respect ranks follow their thresholds', (() => {
    if (prog.rankIndexFor(0) !== 0 || prog.rankIndexFor(19) !== 0) return false;
    if (prog.rankIndexFor(20) !== 1 || prog.rankIndexFor(45) !== 2) return false;
    if (prog.rankIndexFor(80) !== 3 || prog.rankIndexFor(130) !== 4) return false;
    const s = fakeState();
    s.respect = 18;
    if (prog.addRespect(s, 1) !== false) return false; // 19: still rank 0
    return prog.addRespect(s, 1) === true && s.respect === 20; // rank up
  })());

  // 24. A Respect-gated mission waits, then activates when Mara qualifies.
  check('respect-gated mission waits, then activates', (() => {
    const s = fakeState();
    mis.startMission(s, 5); // Kawal Sinta requires Respect 45
    if (!s.missions.waiting || s.missions.active) return false;
    if (mis.currentStep(s.missions) !== null) return false;
    s.respect = 50;
    mis.updateMissions(s, 0.1);
    return s.missions.active && !s.missions.waiting
      && mis.currentStep(s.missions) !== null;
  })());

  // 25. Roadblocks need three stars, place two cars + barriers across the
  // road, and despawn cleanly when Mara is far away.
  check('roadblock spawns at 3 stars and despawns cleanly', (() => {
    const s = fakeState();
    s.wanted = 2;
    if (ent.shouldSpawnRoadblock(s) !== false) return false;
    s.wanted = 3;
    if (ent.shouldSpawnRoadblock(s) !== true) return false;
    const rb = ent.spawnRoadblock(s);
    if (!rb || rb.cars.length !== 2 || rb.barriers.length !== 3) return false;
    if (s.barriers.length !== 3) return false;
    s.player.x = 2400; s.player.y = 1800; // far from the roadblock
    ent.updateRoadblock(s, 0.1);
    return s.roadblock === null && s.barriers.length === 0
      && s.roadblockCooldown > 0;
  })());

  // 26. The CONDOR helicopter needs four stars, shadows the player, and its
  // searchlight slows the wanted decay.
  check('helicopter spawns at 4 stars and slows wanted decay', (() => {
    const s = fakeState();
    s.wanted = 3;
    if (heliMod.shouldSpawnHeli(s) !== false) return false;
    s.wanted = 4;
    if (heliMod.shouldSpawnHeli(s) !== true) return false;
    if (heliMod.heliDecayFactor(s) !== 1) return false; // no heli yet
    heliMod.updateHelicopter(s, 0.1);
    if (!s.heli) return false;
    const d0 = util.dist(s.heli.x, s.heli.y, s.player.x, s.player.y);
    for (let i = 0; i < 60; i++) heliMod.updateHelicopter(s, 1 / 60);
    const d1 = util.dist(s.heli.x, s.heli.y, s.player.x, s.player.y);
    return d1 < d0 && heliMod.heliDecayFactor(s) === 0.35;
  })());

  // 27. The garage sells upgrades and resprays at their listed prices, and
  // refuses when Mara is broke or already maxed.
  check('garage prices, upgrades and respray behave', (() => {
    const s = fakeState();
    if (grg.buyUpgrade(s, 'engine').ok !== false) return false; // $50 < $250
    s.money = 1000;
    const up = grg.buyUpgrade(s, 'engine');
    if (!up.ok || s.garage.engine !== 1 || s.money !== 750) return false;
    if (grg.carMaxSpeed(s) !== 355) return false;
    s.wanted = 3;
    const rs = grg.respray(s);
    if (!rs.ok || s.wanted !== 0 || s.money !== 600) return false;
    const am = grg.buyAmmo(s, 'smg');
    return am.ok && s.weapons.ammo.smg === 60 && s.money === 480;
  })());

  // 28. A wrecked car burns, then explodes: scorch mark, splash damage.
  check('burning car explodes and hurts bystanders', (() => {
    const s = fakeState();
    const car = ent.makeCar(600, 470, 0, { kind: 'parked', driver: false });
    car.hp = 0;
    car.burning = 2.4;
    s.cars.push(car);
    const ped = { x: 640, y: 470, angle: 0, speed: 40, shirt: '#fff', walking: true, flee: 0, down: false, downTimer: 0, axis: 'v', roadPos: 520 };
    s.peds.push(ped);
    ent.updateBurning(s, 0.2);
    return car.exploded === true && s.scorches.length === 1
      && ped.down === true && s.player.health < 100;
  })());

  // 29. Mission 4's destroy step completes only when the target car has
  // actually exploded, and pays out.
  check('mission 4 destroy step needs an explosion and pays', (() => {
    const s = fakeState();
    mis.startMission(s, 3);
    if (!s.missions.targetCar) return false;
    s.player.x = 1160; s.player.y = 1480; // Southside
    mis.updateMissions(s, 0.1);
    if (s.missions.step !== 1) return false;
    s.missions.targetCar.hp = 0; // wrecked but not yet exploded
    mis.updateMissions(s, 0.1);
    if (s.missions.step !== 1) return false;
    s.missions.targetCar.exploded = true;
    mis.updateMissions(s, 0.1);
    return s.missionsDone.includes('balas') && s.money === 750;
  })());

  // 30. The save now round-trips Respect, garage levels and the arsenal.
  check('save serialises respect, garage and weapons', (() => {
    const s = fakeState();
    s.respect = 33;
    s.garage.engine = 2;
    s.weapons.owned.push('smg');
    s.weapons.ammo.smg = 40;
    const data = saveMod.serializeSave(s);
    return data.respect === 33 && data.garage.engine === 2
      && data.weapons.ammo.smg === 40 && data.weapons.owned.includes('smg');
  })());

  // 31. Walking over the SMG pickup arms Mara and loads it.
  check('weapon pickup grants the gun and its ammo', (() => {
    const s = fakeState();
    s.pickups = wpn.createPickups();
    const pk = s.pickups.find((k) => k.weapon === 'smg' && k.kind === 'weapon');
    s.player.x = pk.x; s.player.y = pk.y;
    wpn.updatePickups(s);
    return pk.taken && s.weapons.owned.includes('smg')
      && s.weapons.ammo.smg >= 60 && s.weapons.current === 'smg';
  })());

  // 32. The Marina Loop race starts in a car at the pier, counts its
  // checkpoints, and pays out at the finish.
  check('street race runs its checkpoints and pays', (() => {
    const s = fakeState();
    const car = ent.makeCar(raceMod.RACE_START.x, raceMod.RACE_START.y, 0, { kind: 'player' });
    s.player.car = car; s.player.onFoot = false;
    s.player.x = raceMod.RACE_START.x; s.player.y = raceMod.RACE_START.y;
    raceMod.updateRace(s, 0.1);
    if (!s.race.active) return false;
    for (const pt of raceMod.RACE_POINTS) {
      s.player.x = pt.x; s.player.y = pt.y;
      raceMod.updateRace(s, 0.1);
    }
    return !s.race.active && s.money === 50 + raceMod.RACE_REWARD
      && s.respect === raceMod.RACE_RESPECT && s.race.best > 0;
  })());
}

// ---------------------------------------------------------------------- main --
const section = process.argv[2];
if (!section || section === 'main') await testMainDeterminism();
if (!section || section === 'gates') testGates();
if (!section || section === 'parse') await testParses();
if (!section || section === 'headless') await testHeadless();
if (!section || section === 'logic') await testLogic();

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(' - ' + f);
}
process.exit(failed ? 1 : 0);
