# Vice Harbor — an open-world crime game

A 2D top-down open-world crime game, built for make.fun's **Make GTA 6** bounty
(`gta6-01`). Everything is original: the city, the characters, the vehicles, the names,
the story, the art and the sound. Nothing from Rockstar Games or any other commercial game.

## The story

Rook, a driver-for-hire, owes the fixer **Mara Voss** $40,000. Five jobs clear the debt:

1. **A New Start** — meet Mara at her office.
2. **Wheels** — steal a car and bring it to Spray & Go.
3. **Errands** — collect three packages around the city and deliver them to Mara.
4. **Heat** — lose a two-star wanted level, then reach the safehouse.
5. **The Drop** — clear the rival crew at the docks, take the package, deliver it to Mara.

## The city

Vice Harbor is a road-grid city with a beach on its east edge and the docks on its south:
traffic drives the roads, pedestrians walk the sidewalks, and the map holds a park, a
fountain plaza, a parking lot, a hospital, a police station, a repair garage and a
safehouse. A day/night cycle changes the light, and the streets are lit at night.

## What the game has

- **On foot and by car** — walk, sprint, punch, shoot; enter and exit any car (E).
- **Traffic and pedestrians** — cars follow the roads and stop for the car ahead;
  pedestrians stroll the sidewalks and flee from trouble.
- **Wanted level and police** — stealing a car, hitting a pedestrian or shooting raises
  the heat; police cars chase and ram, foot cops chase and arrest (BUSTED), and at three
  stars they shoot. Lay low and the heat cools.
- **Missions and a story** — a five-job chain with dialogue, objectives, a marker on the
  map and the minimap, and cash rewards.
- **Combat** — punch up close, shoot with a pistol (F or click), ram with a car; rival
  gang members shoot back.
- **HUD with a minimap** — health, money, ammo, wanted stars, speed, the current
  objective, and a live minimap with the player, the cars, the police and the marker.
- **Start screen and save** — a title screen, a pause menu, and a localStorage save
  (money, mission, position, health, ammo) you continue with C.
- **Polish** — a day/night cycle with a light around the player, dust, muzzle flashes,
  smoke and fire, and synthesized WebAudio sound (engine, siren, gunshots, pickups) with
  M to mute.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive a car |
| Shift | Sprint |
| E | Enter / exit a car, continue a dialogue |
| Space | Punch (handbrake in a car) |
| F / click | Shoot |
| P / Esc | Pause |
| M | Mute |
| Enter | Start, confirm |
| C | Continue a save (title screen) |

## How to run it

Serve `game/` with any static server and open `game/index.html` in a desktop browser —
no build step and no network request:

```sh
node serve.ts
# then open http://localhost:8080
```

Or hand it in with the entry program:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `out/` and writes `out/dossier.json`
with the vendored `vendor/makefun-game.ts`.

## Layout

- `game/index.html` — the page and the canvas.
- `game/src/config.js` — every tuning number, colour and city fact.
- `game/src/city.js` — the road grid, the blocks, the buildings and the collision.
- `game/src/actors.js` — the player, the cars, the pedestrians, the police, the rivals
  and the bullets.
- `game/src/missions.js` — the five-job story, its dialogue and its objectives.
- `game/src/world.js` — the state and the one step that advances it.
- `game/src/render.js` — the city, the actors, the HUD, the minimap and the screens.
- `game/src/audio.js` — synthesized WebAudio sound.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the four screenshot scenes (`?shot=chase|drive|mission|start`).
- `game/src/random.js` — a seeded random number generator.
- `main.ts` — the entry program (Node 22, standard library only).
- `vendor/makefun-game.ts` — make.fun's dossier library, unchanged.
- `screenshots/` — four real renders of the game (the first by name is the cover).

## License

MIT. See `LICENSE`.
