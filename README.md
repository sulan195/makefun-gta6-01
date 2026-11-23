# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sulan195/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sulan195/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City — Kisah Mara Voss**: an original open-world crime game in the browser. Mara Voss, a getaway driver for hire, gets pulled into a heist crew in Solmar City — a sun-soaked coastal town of her own, with downtown towers, the Marina West pier, Palmera Park, and the Harbour Yard. Explore on foot or by car, steal cars, outrun roadblocks and the police helicopter, work eight story missions for the crew's fixer Dax, and build Mara's name from Orang Baru to Legenda Solmar. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## What is in the game

- **Open world**: a 2560×1920 city on a road grid — Old Town, Downtown, Marina West, Southside, Palmera Park, and the harbour — under golden-hour light, with palm trees, a sandy south beach and animated harbour water, and a day cycle from morning gold to night blue.
- **On foot and by car**: walk, climb into any car with E, steal traffic cars (the driver flees, and the police notice if they see it), and drive with arcade handling, brake lights, and dust.
- **Traffic and pedestrians**: cars follow the roads and stop at red lights; pedestrians stroll the sidewalks and flee from danger.
- **Wanted level and police**: 0–5 stars. Patrol cars chase and ram you; at 3 stars they park **roadblocks** across the road ahead, and at 4 stars the **CONDOR helicopter** joins with a searchlight that keeps your wanted level from cooling off. Wrecked cars of any kind catch fire and **explode**, scorching the asphalt.
- **Missions and story**: eight sequential jobs with briefings, objective markers, and dialogue — taxi work, a harbour car theft, a hot package, a revenge wrecking job, a midnight courier run, an escort, a warehouse hit, and the Bank Solmar robbery as the finale. The biggest jobs are gated behind **Respect**: five street ranks earned from missions, fares, races and fights.
- **Weapons**: fist, pistol, SMG and shotgun on keys 1–4, each with its own damage, fire rate, range and spread; the SMG and shotgun are found in the city and fed with pickups or garage ammunition.
- **Garasi Bang Udin**: the Southside tuning shop (G) — engine and armour upgrades, a wanted-clearing respray, and ammunition, all saved between sessions.
- **Free roam**: repeatable taxi fares and the **Marina Loop street race** — six checkpoints against the clock for cash and Respect.
- **Combat**: melee (F) and firearms against armed crew rivals, with health and armour.
- **HUD**: money, health and armour bars, a Respect rank meter, the current weapon and its ammunition, wanted stars, clock, district name, speed, a live minimap (player, police, roadblock, helicopter, garage, mission marker), mission objective with distance, story dialog, and a race timer.
- **Menus and saves**: title screen, pause (P), garage menu, and progress saved to localStorage (money, missions, Respect, garage build, arsenal, race best) — continue with C.
- **Sound**: everything is synthesised with WebAudio — engine hum, horn, siren wail, gunshots, a quiet bassline, and two car-radio stations (R). No audio files.
- **Screenshots**: deterministic staged scenes via `?shot=start|drive|chase|mission&seed=1`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — `game/` is plain static files.

Controls: WASD / arrows to move and drive, E to enter or exit a car, Space or click to shoot, F to punch, 1–4 to switch weapons, G for the garage, R for the radio, P to pause and save, Enter to start.

## Layout

- `game/index.html` — the page, canvas only, no CDN.
- `game/src/main.js` — bootstrap and the fixed-timestep loop.
- `game/src/world.js` — Solmar City generation: roads, blocks, buildings, park, harbour.
- `game/src/entities.js` — Mara, pedestrians, traffic, police, roadblocks, wanted level, burning cars.
- `game/src/missions.js` — the eight story missions, fares, and rivals.
- `game/src/weapons.js` — the four-weapon arsenal and its pickups.
- `game/src/progression.js` — Respect points and the five street ranks.
- `game/src/garage.js` — Garasi Bang Udin: upgrades, respray, ammunition.
- `game/src/helicopter.js` — the CONDOR police helicopter and its searchlight.
- `game/src/races.js` — the Marina Loop street race.
- `game/src/render.js` — camera and drawing of the city, cars, people, and the helicopter.
- `game/src/hud.js` — HUD, minimap, garage menu, title / pause / busted screens.
- `game/src/audio.js` — synthesised WebAudio sounds, music, and radio.
- `game/src/input.js` — keyboard and mouse state.
- `game/src/save.js` — localStorage save / load.
- `game/src/shots.js` — deterministic `?shot=` scenes for screenshots.
- `game/src/util.js` — seeded RNG and pure helpers.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and writes `dossier.json`.
- `tests/run-tests.mjs` — the automated test suite (gates, determinism, headless load, logic edge cases).

## Tests

```sh
node tests/run-tests.mjs
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
