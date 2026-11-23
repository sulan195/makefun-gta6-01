# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sulan195/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sulan195/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City — The Story of Mara Voss**: a full **3D third-person open-world** crime game in the browser, written in vanilla JavaScript with a hand-rolled WebGL2 engine — no libraries, no external assets, everything procedural. Mara Voss, a getaway driver for hire, gets pulled into a heist crew in Solmar City — a sun-soaked coastal city with downtown towers, the Marina West pier, Palmera Park, and the Harbour Yard. Explore on foot or by car, steal cars, outrun roadblocks and the police helicopter, work eight story missions for the crew's fixer Dax, and build Mara's name from Newcomer to Legend of Solmar. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## What is in the game

- **A real 3D city**: a 2560×1920 world rendered in WebGL2 — six districts (Old Town, Downtown, Marina West, Southside, Palmera Park, Harbour), hundreds of window-lit buildings with rooftop clutter, palm trees, a sandy south beach and an animated sea. The whole static city is two merged meshes; real sun shadows are projected from the building geometry, and a full day cycle runs from morning gold through golden hour to night blue.
- **Third-person camera**: follows Mara on foot and in cars, eases behind her heading, and orbits freely with Q / E or a mouse drag — no pointer lock, fully keyboard-playable.
- **On foot and by car**: walk the sidewalks, climb into any car with E, steal traffic cars (the driver flees, and the police notice if they see it), and drive with arcade handling, brake lights, and dust.
- **Traffic and pedestrians**: cars follow the road grid and stop at red lights; pedestrians stroll the sidewalks and flee from danger.
- **Wanted level and police**: 0–5 stars. Patrol cars — in unmistakable white-and-blue livery with flashing red/blue light bars — chase and ram you; at 3 stars they park **roadblocks** across the road ahead, and at 4 stars the **CONDOR helicopter** joins with a volumetric searchlight cone that keeps your wanted level from cooling off. Wrecked cars catch fire and **explode**, chaining into nearby vehicles and scorching the asphalt.
- **Missions and story**: eight sequential jobs with briefings, objective markers, a floating target diamond and dialogue — taxi work, a harbour car theft, a hot package, a revenge wrecking job, a midnight courier run, an escort, a warehouse hit, and the Bank Solmar robbery as the finale. The biggest jobs are gated behind **Respect**: five street ranks (Newcomer → Legend of Solmar) earned from missions, fares, races and fights.
- **Weapons**: fists, pistol, SMG and shotgun on keys 1–4, each with its own damage, fire rate, range and spread, drawn tracers and muzzle sparks; the SMG and shotgun are found in the city and fed with pickups or garage ammunition.
- **Udin's Garage**: the Southside tuning shop (G) — engine and armor upgrades, a wanted-clearing respray, and ammunition, all saved between sessions.
- **Free roam**: repeatable taxi fares and the **Marina Loop street race** — six glowing checkpoint rings against the clock for cash and Respect.
- **Combat**: melee (F) and firearms against armed crew rivals, with health and armor.
- **HUD**: money, health and armor bars, a Respect rank meter, the current weapon and its ammunition, wanted stars, clock, district name, speed, a live minimap (player, police, roadblock, helicopter, garage, mission marker), the mission objective with distance, story dialogue, and a race timer.
- **Menus and saves**: title screen with a cinematic camera over the shore, pause (P), garage menu, busted/wasted screens, and progress saved to localStorage (money, missions, Respect, garage build, arsenal, race best) — continue with C.
- **Sound**: everything is synthesised with WebAudio — engine hum, siren wail, gunshots, a quiet bassline, and two car-radio stations (R). No audio files.
- **Performance**: merged static geometry, one shared mesh per prop type, blob shadows under every vehicle, devicePixelRatio capped at 1.5, well under 150 draw calls per frame.
- **Screenshots**: deterministic staged scenes via `?shot=start|drive|chase|mission&seed=1`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — `game/` is plain static files.

Controls: WASD / arrows to move and drive, E to enter or exit a car (and to open the garage at Udin's), Q / E to orbit the camera, mouse drag to look around, Space or click to shoot, F to punch, 1–4 to switch weapons, G for the garage menu, R for the radio, Shift to brake, P to pause and save, Enter to start.

## Layout

- `game/index.html` — the page: WebGL canvas plus the DOM HUD and overlays, no CDN.
- `game/src/main.js` — bootstrap and the fixed-timestep deterministic loop.
- `game/src/gl.js` — the WebGL2 layer: shaders (lit city, sky, particles, tracers), matrix/vector math, and the mesh builders.
- `game/src/city.js` — merged static geometry: buildings, roads and markings, palms, beach, animated sea, and the time-of-day sun.
- `game/src/models.js` — vertex-colored low-poly factories: cars, the liveried police car, the CONDOR helicopter, people, roadblock barriers, pickups, race rings.
- `game/src/render.js` — the 3D renderer: sun-shadow projection, blob shadows, searchlight cone, tracers, particles.
- `game/src/world.js` — Solmar City data: road grid, districts, buildings, named places.
- `game/src/player.js` — Mara's on-foot controller and the third-person camera.
- `game/src/cars.js` — car factory, parked and traffic spawns, traffic lights, arcade driving.
- `game/src/entities.js` — pedestrians and rival crew members.
- `game/src/police.js` — wanted levels, patrol AI, roadblocks.
- `game/src/helicopter.js` — the CONDOR police helicopter and its searchlight.
- `game/src/combat.js` — the four-weapon arsenal, hit-scan firing, tracers, pickups.
- `game/src/missions.js` — the eight story missions, the step engine, taxi fares.
- `game/src/progression.js` — Respect points and the five street ranks.
- `game/src/garage.js` — Udin's Garage: upgrades, respray, ammunition.
- `game/src/races.js` — the Marina Loop street race.
- `game/src/effects.js` — particles, burning cars, explosions, scorch marks.
- `game/src/hud.js` — DOM HUD, minimap, garage menu, title / pause / busted / wasted screens.
- `game/src/audio.js` — synthesised WebAudio sounds, music, and radio.
- `game/src/input.js` — keyboard and mouse state.
- `game/src/save.js` — localStorage save / load.
- `game/src/shots.js` — deterministic `?shot=` scenes for screenshots.
- `game/src/util.js` — seeded RNG and pure helpers.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and writes `dossier.json`.
- `tests/run-tests.mjs` — the automated test suite (gates, determinism, headless WebGL load, logic and geometry edge cases).

## Tests

```sh
node tests/run-tests.mjs
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
