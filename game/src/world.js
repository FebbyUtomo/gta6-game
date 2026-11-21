// The world: the state and the one step that advances it. The world owns the player, the
// cars, the pedestrians, the police, the rivals, the bullets, the particles and the pickups,
// plus the wanted heat, the clock and the save. It calls the actors for their movement and the
// missions for the story, and returns what happened as events so the loop can react (busted,
// wasted, a mission finishing, the story ending). Nothing here draws and nothing here reads
// the DOM except localStorage, so the same step runs the game and the screenshot scenes.

import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createMissions } from './missions.js';
import { createRandom } from './random.js';
import {
  createCar,
  createCop,
  createPed,
  createPlayer,
  createPoliceCar,
  createTrafficCar,
  damageCar,
  explodeCar,
  nearestCar,
  scarePeds,
  stepBullet,
  stepCop,
  stepPed,
  stepPlayerCar,
  stepPlayerOnFoot,
  stepPoliceCar,
  stepRival,
  stepTrafficCar,
  witnessed,
} from './actors.js';
import { BEST_KEY, GARAGE_PRICE, LANE, PICKUPS, PLACES, ROADS_H, ROADS_V, SAVE_KEY, WANTED, WORLD } from './config.js';

const TRAFFIC_TARGET = 14;
const PED_TARGET = 24;

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const audio = createAudio();
  const missions = createMissions();
  const state = {
    city,
    random,
    audio,
    missions,
    player: createPlayer(790, 1150),
    cars: [],
    peds: [],
    cops: [],
    rivals: [],
    bullets: [],
    particles: [],
    pickups: [],
    time: 0,
    timeOfDay: 0.12,
    heat: 0,
    stars: 0,
    lastCrime: -99,
    banner: null,
    events: {},
    stats: { earned: 0, busted: 0, wasted: 0, stolen: 0 },
    saveTimer: 0,
  };

  // The parking lot's cars, and the first traffic.
  for (const spot of city.parked) {
    const car = createCar(spot.kind, spot.x, spot.y, spot.angle, null);
    state.cars.push(car);
  }
  for (let i = 0; i < TRAFFIC_TARGET; i += 1) state.cars.push(createTrafficCar(city, random));
  for (let i = 0; i < PED_TARGET; i += 1) {
    const ped = createPed(city, random);
    ped.jacket = '#888888';
    state.peds.push(ped);
  }
  // Health and ammo around the city, and a little cash on the street.
  state.pickups.push({ kind: 'health', x: PLACES.hospital.x, y: PLACES.hospital.y + 90, amount: PICKUPS.health.amount, bob: 0 });
  state.pickups.push({ kind: 'health', x: PLACES.park.x, y: PLACES.park.y, amount: PICKUPS.health.amount, bob: 0 });
  state.pickups.push({ kind: 'ammo', x: PLACES.policeStation.x, y: PLACES.policeStation.y + 90, amount: PICKUPS.ammo.amount, bob: 0 });
  state.pickups.push({ kind: 'ammo', x: PLACES.docks.x - 120, y: PLACES.docks.y, amount: PICKUPS.ammo.amount, bob: 0 });
  state.pickups.push({ kind: 'cash', x: 1200, y: 350, amount: 120, bob: 0 });
  state.pickups.push({ kind: 'cash', x: 600, y: 1380, amount: 90, bob: 0 });

  function addHeat(amount) {
    state.heat = Math.min(WANTED.maxHeat, state.heat + amount);
    state.lastCrime = state.time;
    state.stars = Math.min(5, Math.ceil(state.heat / WANTED.heatPerStar));
  }

  function setHeat(value) {
    state.heat = Math.max(0, Math.min(WANTED.maxHeat, value));
    state.stars = Math.min(5, Math.ceil(state.heat / WANTED.heatPerStar));
    if (value > 0) state.lastCrime = state.time;
  }

  function spawnParticle(x, y, kind) {
    const p = { x, y, vx: 0, vy: 0, life: 0, maxLife: 0.5, color: '#ffffff', size: 3, kind };
    if (kind === 'dust') {
      p.vx = (random() - 0.5) * 40;
      p.vy = (random() - 0.5) * 40;
      p.maxLife = 0.6;
      p.color = '#b9a98a';
      p.size = 5;
    } else if (kind === 'muzzle') {
      p.maxLife = 0.08;
      p.color = '#ffd23f';
      p.size = 7;
    } else if (kind === 'hit') {
      p.vx = (random() - 0.5) * 160;
      p.vy = (random() - 0.5) * 160;
      p.maxLife = 0.35;
      p.color = '#ffd23f';
      p.size = 4;
    } else if (kind === 'crash') {
      p.vx = (random() - 0.5) * 220;
      p.vy = (random() - 0.5) * 220;
      p.maxLife = 0.4;
      p.color = '#ff9f1c';
      p.size = 5;
    } else if (kind === 'smoke') {
      p.vy = -40 - random() * 30;
      p.vx = (random() - 0.5) * 20;
      p.maxLife = 1.1;
      p.color = '#5a6272';
      p.size = 9;
    } else if (kind === 'fire') {
      p.vx = (random() - 0.5) * 260;
      p.vy = (random() - 0.5) * 260;
      p.maxLife = 0.5;
      p.color = random() < 0.5 ? '#ff5a2e' : '#ffd23f';
      p.size = 7;
    }
    p.life = p.maxLife;
    state.particles.push(p);
    if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  }

  // The actors and the missions call these on the state object.
  state.addHeat = addHeat;
  state.setHeat = setHeat;
  state.spawnParticle = spawnParticle;

  function save() {
    try {
      const p = state.player;
      const data = {
        money: p.money,
        missionIndex: missions.state.index,
        x: Math.round(p.x),
        y: Math.round(p.y),
        health: Math.round(p.health),
        ammo: p.ammo,
        timeOfDay: state.timeOfDay,
        best: readBest(),
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      if (p.money > readBest()) window.localStorage.setItem(BEST_KEY, String(p.money));
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(data) {
    const p = state.player;
    p.money = data.money ?? 0;
    p.health = data.health ?? 100;
    p.ammo = data.ammo ?? 24;
    p.x = data.x ?? 790;
    p.y = data.y ?? 1150;
    state.timeOfDay = data.timeOfDay ?? 0.12;
    missions.state.index = Math.min(data.missionIndex ?? 0, 4);
    missions.state.phase = 'briefing';
    missions.state.collected = 0;
    missions.state.heatStage = 0;
    missions.state.rivalsSpawned = false;
    missions.state.rivalsDown = 0;
    missions.state.packageTaken = false;
    missions.state.dropPackageSpawned = false;
    missions.startBriefing();
  }

  function respawn(kind) {
    const p = state.player;
    if (p.inCar) {
      p.inCar.driver = null;
      p.inCar = null;
    }
    if (kind === 'busted') {
      p.x = PLACES.policeStation.x;
      p.y = PLACES.policeStation.y + 90;
      p.money = Math.max(0, p.money - 200);
      state.stats.busted += 1;
    } else {
      p.x = PLACES.hospital.x;
      p.y = PLACES.hospital.y + 90;
      p.money = Math.max(0, p.money - 150);
      state.stats.wasted += 1;
    }
    p.health = 100;
    p.ammo = Math.max(12, p.ammo);
    p.invulnerable = 2;
    p.arrest = 0;
    setHeat(0);
    state.cops = [];
    state.cars = state.cars.filter((c) => c.driver !== 'police');
    state.bullets = [];
    missions.restart(state);
    state.events = {};
  }

  function enterOrExitCar() {
    const p = state.player;
    if (p.inCar) {
      const car = p.inCar;
      car.driver = null;
      p.inCar = null;
      // Step out beside the car, on the side away from the road centre.
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * (car.width / 2 + 22);
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * (car.width / 2 + 22);
      const body = { x: p.x, y: p.y, radius: 14 };
      city.collideCircle(body);
      p.x = body.x;
      p.y = body.y;
      return;
    }
    const car = nearestCar(state.cars, p.x, p.y, 64);
    if (!car) return;
    if (car.driver === 'traffic') {
      addHeat(WANTED.heatStealOccupied);
      state.stats.stolen += 1;
      // The driver flees on foot.
      const ped = createPed(city, random);
      ped.x = car.x + 40;
      ped.y = car.y;
      ped.state = 'flee';
      ped.fleeTimer = 4;
      state.peds.push(ped);
      scarePeds(state, car.x, car.y, 200);
    } else if (car.driver === 'police') {
      addHeat(WANTED.heatStealOccupied);
      state.stats.stolen += 1;
    }
    car.driver = 'player';
    p.inCar = car;
    audio.click();
  }

  /** One fixed step. `input` is the input module, `aim` the mouse's world point. */
  function step(dt, input, aim) {
    state.events = {};
    state.time += dt;
    state.timeOfDay = (state.timeOfDay + dt / 240) % 1;
    const p = state.player;
    const actions = input.takeActions();

    // Mute is a global toggle.
    if (actions & 32) {
      const muted = audio.toggleMute();
      state.banner = { text: muted ? 'Sound off (M to turn on)' : 'Sound on', timer: 1.2 };
    }

    // Enter or exit a car.
    if (actions & 4) enterOrExitCar();

    // The player, on foot or driving. Space is the handbrake while driving.
    if (p.inCar) {
      stepPlayerCar(state, dt, input.move(), (actions & 16) !== 0);
    } else {
      stepPlayerOnFoot(state, dt, input.move(), input.sprinting(), aim, actions);
    }

    // Wanted heat cools when the player has been quiet and no police are near.
    if (state.heat > 0 && state.time - state.lastCrime > WANTED.calmAfter) {
      let nearPolice = false;
      for (const car of state.cars) {
        if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 420) nearPolice = true;
      }
      for (const cop of state.cops) {
        if (Math.hypot(cop.x - p.x, cop.y - p.y) < 420) nearPolice = true;
      }
      if (!nearPolice) {
        state.heat = Math.max(0, state.heat - WANTED.decayPerSecond * dt);
        state.stars = Math.min(5, Math.ceil(state.heat / WANTED.heatPerStar));
      }
    }

    // Traffic: keep the streets busy.
    let trafficCount = 0;
    for (const car of state.cars) if (car.driver === 'traffic') trafficCount += 1;
    if (trafficCount < TRAFFIC_TARGET - 2) {
      const car = createTrafficCar(city, random);
      // Keep a new car off the player's screen.
      if (Math.hypot(car.x - p.x, car.y - p.y) > 500) state.cars.push(car);
    }
    for (const car of state.cars) {
      if (car.driver === 'traffic') stepTrafficCar(state, car, dt);
      else if (car.driver === 'police') stepPoliceCar(state, car, dt);
      else if (car !== p.inCar && car.fuse >= 0) {
        car.fuse -= dt;
        if (car.fuse <= 0) explodeCar(state, car);
      }
    }

    // Police: one car per star, up to the cap; none when the heat is gone.
    const wantCars = Math.min(state.stars, WANTED.maxPoliceCars);
    let policeCount = 0;
    for (const car of state.cars) if (car.driver === 'police') policeCount += 1;
    if (state.stars === 0) {
      state.cars = state.cars.filter((c) => c.driver !== 'police');
      state.cops = [];
      policeCount = 0;
    } else if (policeCount < wantCars) {
      // Spawn a police car on the nearest road, a little away from the player.
      const road = city.nearestRoad(p.x, p.y);
      let spawn;
      if (road.axis === 'v') {
        const x = ROADS_V[road.index];
        const y = p.y < WORLD.height / 2 ? Math.min(p.y + 620, WORLD.height - 80) : Math.max(p.y - 620, 80);
        spawn = { x: x + (p.x > x ? -LANE : LANE), y };
      } else {
        const y = ROADS_H[road.index];
        const x = p.x < WORLD.width / 2 ? Math.min(p.x + 620, WORLD.width - 80) : Math.max(p.x - 620, 80);
        spawn = { x, y: y + (p.y > y ? LANE : -LANE) };
      }
      const car = createPoliceCar(spawn.x, spawn.y);
      state.cars.push(car);
    }
    for (const cop of state.cops) stepCop(state, cop, dt);
    state.cops = state.cops.filter((c) => c.state !== 'down' || c.downTimer > 0);

    // Pedestrians, rivals, bullets, particles.
    for (const ped of state.peds) stepPed(state, ped, dt);
    for (const rival of state.rivals) stepRival(state, rival, dt);
    for (const bullet of state.bullets) stepBullet(state, bullet, dt);
    state.bullets = state.bullets.filter((b) => b.alive);
    // A rival that just went down counts toward the mission, once.
    for (const rival of state.rivals) {
      if (rival.health <= 0 && !rival.counted) {
        rival.counted = true;
        missions.onRivalDown();
      }
    }
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // Pickups: bob, and the player collects them on foot or by car.
    for (const pickup of state.pickups) pickup.bob += dt;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    state.pickups = state.pickups.filter((pickup) => {
      if (Math.hypot(pickup.x - px, pickup.y - py) > 34) return true;
      if (pickup.kind === 'health') {
        p.health = Math.min(100, p.health + pickup.amount);
        audio.pickup();
      } else if (pickup.kind === 'ammo') {
        p.ammo = Math.min(72, p.ammo + pickup.amount);
        audio.pickup();
      } else if (pickup.kind === 'cash') {
        p.money += pickup.amount;
        state.stats.earned += pickup.amount;
        audio.pickup();
      } else if (pickup.kind === 'package') {
        missions.onPickup(state, pickup);
        audio.pickup();
      }
      spawnParticle(pickup.x, pickup.y, 'hit');
      return false;
    });

    // The garage: drive in, pay, and the car is fixed and one star is forgotten.
    if (p.inCar) {
      const g = PLACES.garage;
      if (Math.hypot(p.inCar.x - g.x, p.inCar.y - g.y) < 70 && p.inCar.health < p.inCar.maxHealth && p.money >= GARAGE_PRICE) {
        p.money -= GARAGE_PRICE;
        p.inCar.health = p.inCar.maxHealth;
        p.inCar.fuse = -1;
        setHeat(Math.max(0, state.heat - WANTED.heatPerStar));
        state.banner = { text: 'Spray & Go — car repaired, one star forgotten (-$150)', timer: 2.5 };
        audio.mission();
      }
    }

    // The siren wails while any police car is near.
    let policeNear = false;
    for (const car of state.cars) {
      if (car.driver === 'police' && Math.hypot(car.x - p.x, car.y - p.y) < 700) policeNear = true;
    }
    audio.siren(policeNear, dt);
    if (!p.inCar) audio.engine(0, 1);

    // The story.
    const missionResult = missions.update(state);
    if (missionResult === 'complete' || missionResult === 'story') {
      state.events.mission = missionResult;
      save();
    }

    // Busted and wasted.
    if (state.events.busted) {
      audio.busted();
      respawn('busted');
      state.events.busted = true;
    }
    if (p.health <= 0 && !state.events.busted) {
      audio.busted();
      respawn('wasted');
      state.events.wasted = true;
    }

    // A banner fades; the autosave ticks.
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }
    state.saveTimer += dt;
    if (state.saveTimer > 30) {
      state.saveTimer = 0;
      save();
    }
  }

  return {
    state,
    step,
    addHeat,
    setHeat,
    spawnParticle,
    save,
    load,
    applySave,
    respawn,
    readBest,
    get player() {
      return state.player;
    },
    get heat() {
      return state.heat;
    },
    get stars() {
      return state.stars;
    },
  };
}
