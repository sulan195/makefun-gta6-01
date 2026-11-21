# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sulan195/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sulan195/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City — Kisah Mara Voss**: an original open-world crime game in the browser. Mara Voss, a getaway driver for hire, gets pulled into a heist crew in Solmar City — a sun-soaked coastal town of her own, with downtown towers, the Marina West pier, Palmera Park, and the Harbour Yard. Explore on foot or by car, steal cars, outrun the police, and run three story missions for the crew's fixer, Dax. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## What is in the game

- **Open world**: a 2560×1920 city on a road grid — Old Town, Downtown, Marina West, Southside, Palmera Park, and the harbour, with a day cycle from morning gold to night blue.
- **On foot and by car**: walk, climb into any car with E, steal traffic cars (the driver flees, and the police notice if they see it), and drive with arcade handling, brake lights, and dust.
- **Traffic and pedestrians**: cars follow the roads and stop at red lights; pedestrians stroll the sidewalks and flee from danger.
- **Wanted level and police**: 0–5 stars. Police patrol cars chase and ram you, roadblocks appear at 4 stars, and stars fall off when you stay hidden.
- **Missions and story**: three sequential jobs with briefings, objective markers, and dialogue — (1) pick up a passenger and drive them to the Marina, (2) steal a grey sedan from the Harbour Yard and lose the cops, (3) deliver a hot package while wanted — then free roam with repeatable taxi fares.
- **Combat**: melee (F) and a pistol (Space / click to shoot) against armed crew rivals, with health and armour.
- **HUD**: money, health and armour bars, wanted stars, clock, district name, speed, a live minimap (player, police, rivals, mission marker), mission objective with distance, and story dialog.
- **Menus and saves**: title screen, pause (P), and progress saved to localStorage (money, missions, position) — continue with C.
- **Sound**: everything is synthesised with WebAudio — engine hum, horn, siren wail, gunshots, and a quiet bassline. No audio files.
- **Screenshots**: deterministic staged scenes via `?shot=start|drive|chase|mission&seed=1`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests — `game/` is plain static files.

Controls: WASD / arrows to move and drive, E to enter or exit a car, Space or click to shoot, F to punch, P to pause and save, Enter to start.

## Layout

- `game/index.html` — the page, canvas only, no CDN.
- `game/src/main.js` — bootstrap and the fixed-timestep loop.
- `game/src/world.js` — Solmar City generation: roads, blocks, buildings, park, harbour.
- `game/src/entities.js` — Mara, pedestrians, traffic, police, wanted level, combat.
- `game/src/missions.js` — the three story missions, fares, and rivals.
- `game/src/render.js` — camera and drawing of the city, cars, and people.
- `game/src/hud.js` — HUD, minimap, title / pause / busted screens.
- `game/src/audio.js` — synthesised WebAudio sounds and music.
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
