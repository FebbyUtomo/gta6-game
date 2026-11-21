// The screenshot scenes behind ?shot=chase|drive|mission|start. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple autopilot,
// so the frame is what a short game really looks like and the same seed always gives the same
// frame. The chase is the cover: a three-star police chase with the HUD, the minimap and the
// mission objective all on screen at once.

import { PLACES, STEP } from './config.js';
import { createCar, createPoliceCar, createRival } from './actors.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CHASE_SECONDS = 2.5;
const DRIVE_SECONDS = 3.5;
const MISSION_SECONDS = 4;
const START_SECONDS = 5;

/** An input that only steers: no actions, no sprint. */
function autoInput(move) {
  return {
    takeActions() {
      return 0;
    },
    move() {
      return move;
    },
    sprinting() {
      return false;
    },
  };
}

/** Steer a car toward a point ahead on its road: throttle on, steer by the angle to it. */
function driveToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  return { x: steer, y: -1 };
}

function buildUi(world, screen) {
  const w = world.state;
  const missions = w.missions;
  const target = screen === SCREEN_PLAY ? missions.target(w) : null;
  return {
    best: world.readBest(),
    saveExists: false,
    objective: screen === SCREEN_PLAY ? missions.objectiveText() : null,
    missionTitle: screen === SCREEN_PLAY ? missions.current().title : null,
    target,
    banner: w.banner ? w.banner.text : null,
    dialogue: null,
    hint: null,
    muted: false,
    bustedLoss: null,
  };
}

/**
 * Set `world` to the named scene and return the screen and the UI to draw over it.
 * The world is fresh when this runs, so each scene builds its own setup on top of it.
 */
export function stageShot(name, world) {
  const w = world.state;
  const missions = w.missions;

  if (name === 'start') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, autoInput({ x: 0, y: 0 }), { x: w.player.x, y: w.player.y });
    }
    return { screen: SCREEN_TITLE, ui: buildUi(world, SCREEN_TITLE) };
  }

  if (name === 'drive') {
    // A sedan on the road, driving south through traffic.
    const car = createCar('sedan', 1400, 300, Math.PI / 2, 'player');
    car.color = '#c94f4f';
    w.cars.push(car);
    w.player.inCar = car;
    w.player.x = car.x;
    w.player.y = car.y;
    missions.state.index = 1;
    missions.state.phase = 'active';
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) {
      const move = driveToward(car, 1400, car.y + 240);
      world.step(STEP, autoInput(move), { x: car.x, y: car.y });
    }
    return { screen: SCREEN_PLAY, ui: buildUi(world, SCREEN_PLAY) };
  }

  if (name === 'chase') {
    // A sports car already moving south at speed, three stars, and the police in
    // pursuit behind it (not on top of it) so the cover reads as a chase.
    const car = createCar('sports', 1000, 600, Math.PI / 2, 'player');
    car.color = '#4fc3f7';
    car.speed = 300;
    w.cars.push(car);
    w.player.inCar = car;
    w.player.x = car.x;
    w.player.y = car.y;
    missions.state.index = 3;
    missions.state.phase = 'active';
    missions.state.heatStage = 0;
    world.setHeat(75);
    // Two police cars in pursuit behind, so the chase is in the frame.
    const cop1 = createPoliceCar(1000, 200);
    cop1.angle = Math.PI / 2;
    cop1.speed = 320;
    w.cars.push(cop1);
    const cop2 = createPoliceCar(1060, 160);
    cop2.angle = Math.PI / 2;
    cop2.speed = 300;
    w.cars.push(cop2);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const move = driveToward(car, 1000, car.y + 240);
      world.step(STEP, autoInput(move), { x: car.x, y: car.y });
    }
    return { screen: SCREEN_PLAY, ui: buildUi(world, SCREEN_PLAY) };
  }

  // mission: on foot at the docks, rivals in front, the objective on the HUD.
  missions.state.index = 4;
  missions.state.phase = 'active';
  missions.state.rivalsSpawned = true;
  missions.state.rivalsDown = 0;
  missions.state.packageTaken = false;
  missions.state.dropPackageSpawned = false;
  const spots = [
    { x: 1950, y: 1660 },
    { x: 2080, y: 1740 },
    { x: 1900, y: 1780 },
  ];
  for (const s of spots) w.rivals.push(createRival(s.x, s.y));
  w.player.x = 1850;
  w.player.y = 1700;
  w.player.angle = 0.4;
  const marker = { x: PLACES.docks.x, y: PLACES.docks.y };
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const dx = marker.x - w.player.x;
    const dy = marker.y - w.player.y;
    const len = Math.hypot(dx, dy) || 1;
    world.step(STEP, autoInput({ x: dx / len, y: dy / len }), { x: marker.x, y: marker.y });
    if (Math.hypot(marker.x - w.player.x, marker.y - w.player.y) < 90) break;
  }
  return { screen: SCREEN_PLAY, ui: buildUi(world, SCREEN_PLAY) };
}
