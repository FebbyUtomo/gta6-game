// The actors: the player, the cars (traffic, parked, police), the pedestrians, the foot
// police, the rival gang and the bullets. Each step function takes the world state `w` and a
// fixed `dt`; the world owns the state and calls these. Cars are circles for collision (their
// radius is half their length) and traffic follows the road centrelines with right-hand lanes.

import { CAR_KINDS, LANE, PLAYER, ROADS_H, ROADS_V, ROAD_W, TRAFFIC_COLORS, WANTED } from './config.js';

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createPlayer(x, y) {
  return {
    x, y, angle: 0, health: PLAYER.health, money: 0, ammo: PLAYER.startAmmo,
    inCar: null, punchCooldown: 0, shootCooldown: 0, invulnerable: 0,
    arrest: 0, moving: false, sprinting: false, dead: false,
  };
}

export function createCar(kind, x, y, angle, driver) {
  const spec = CAR_KINDS[kind];
  return {
    kind, x, y, angle, speed: 0, driver: driver ?? null,
    health: spec.health, maxHealth: spec.health,
    length: spec.length, width: spec.width,
    top: spec.top, accel: spec.accel, reverse: spec.reverse, grip: spec.grip,
    radius: spec.length / 2,
    color: kind === 'taxi' ? '#f2c94c' : TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
    axis: 'v', roadIndex: 0, dir: 1, stuck: 0, fuse: -1, smokeTimer: 0, exploded: false,
  };
}

/** A traffic car placed on a random road, driving in a random direction. */
export function createTrafficCar(city, random) {
  const kind = random() < 0.12 ? 'truck' : random() < 0.18 ? 'taxi' : random() < 0.12 ? 'sports' : 'sedan';
  let car;
  if (random() < 0.5) {
    const i = Math.floor(random() * ROADS_V.length);
    const dir = random() < 0.5 ? 1 : -1;
    const x = ROADS_V[i] + (dir === 1 ? -LANE : LANE);
    const y = 60 + random() * 1800;
    car = createCar(kind, x, y, dir === 1 ? Math.PI / 2 : -Math.PI / 2, 'traffic');
    car.axis = 'v';
    car.roadIndex = i;
    car.dir = dir;
  } else {
    const j = Math.floor(random() * ROADS_H.length);
    const dir = random() < 0.5 ? 1 : -1;
    const y = ROADS_H[j] + (dir === 1 ? LANE : -LANE);
    const x = 60 + random() * 2440;
    car = createCar(kind, x, y, dir === 1 ? 0 : Math.PI, 'traffic');
    car.axis = 'h';
    car.roadIndex = j;
    car.dir = dir;
  }
  car.speed = car.top * (0.45 + random() * 0.2);
  return car;
}

export function createPoliceCar(x, y) {
  const car = createCar('police', x, y, 0, 'police');
  car.color = '#eef1f5';
  car.speed = 0;
  return car;
}

export function createPed(city, random) {
  const p = city.randomSidewalkPoint();
  return {
    x: p.x, y: p.y, angle: random() * TAU, speed: 42 + random() * 26,
    color: '#e8b88a', jacket: '#888888', state: 'walk', fleeTimer: 0, downTimer: 0,
    target: city.randomSidewalkPoint(), radius: 12, scared: 0,
  };
}

export function createCop(x, y) {
  return { x, y, angle: 0, speed: 250, health: 30, radius: 13, shootCooldown: 1 + Math.random(), arrest: 0, state: 'walk', downTimer: 0 };
}

export function createRival(x, y) {
  return { x, y, angle: 0, speed: 120, health: 30, radius: 13, shootCooldown: 0.8 + Math.random(), strafe: 0, strafeDir: 1 };
}

export function createBullet(x, y, angle, from, damage) {
  return {
    x, y, vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
    from, damage, range: PLAYER.shootRange, alive: true,
  };
}

/** The nearest car to a point, within `maxDist`, or null. */
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    if (car.exploded) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Whether a cop or a pedestrian is close enough to witness a crime at (x, y). */
export function witnessed(w, x, y) {
  for (const cop of w.cops) if (dist2(x, y, cop.x, cop.y) < WANTED.witnessRange * WANTED.witnessRange) return true;
  for (const car of w.cars) {
    if (car.driver === 'police' && dist2(x, y, car.x, car.y) < WANTED.witnessRange * WANTED.witnessRange) return true;
  }
  for (const ped of w.peds) {
    if (ped.state !== 'down' && dist2(x, y, ped.x, ped.y) < WANTED.witnessRange * WANTED.witnessRange) return true;
  }
  return false;
}

/** Scare every pedestrian near (x, y): they flee from it. */
export function scarePeds(w, x, y, radius) {
  for (const ped of w.peds) {
    if (ped.state === 'down') continue;
    if (dist2(x, y, ped.x, ped.y) < radius * radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5 + Math.random() * 1.5;
      ped.scared = 1;
    }
  }
}

// ---------------------------------------------------------------- the player

/** Move the player on foot, punch and shoot. `aim` is the world point the mouse points at. */
export function stepPlayerOnFoot(w, dt, move, sprinting, aim, actions) {
  const p = w.player;
  const speed = sprinting ? PLAYER.sprint : PLAYER.walk;
  let mx = move.x;
  let my = move.y;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  p.moving = len > 0.1;
  p.sprinting = sprinting && p.moving;
  if (p.moving) p.angle = Math.atan2(my, mx);
  const body = { x: p.x, y: p.y, radius: PLAYER.radius };
  body.x += mx * speed * dt;
  body.y += my * speed * dt;
  w.city.collideCircle(body);
  p.x = body.x;
  p.y = body.y;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;

  // Aim at the mouse while shooting; otherwise face where you walk.
  if (actions & 8) {
    p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    if (p.shootCooldown <= 0 && p.ammo > 0) {
      p.ammo -= 1;
      p.shootCooldown = PLAYER.shootCooldown;
      w.bullets.push(createBullet(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, p.angle, 'player', 12));
      w.audio.shoot();
      w.spawnParticle(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, 'muzzle');
      if (witnessed(w, p.x, p.y)) w.addHeat(WANTED.heatShootWitnessed);
      scarePeds(w, p.x, p.y, 260);
    }
  }
  if (actions & 16) {
    if (p.punchCooldown <= 0) {
      p.punchCooldown = PLAYER.punchCooldown;
      w.audio.punch();
      const reach = PLAYER.punchRange + PLAYER.radius;
      let hitAny = false;
      for (const list of [w.rivals, w.cops, w.peds]) {
        for (const target of list) {
          if (target.health !== undefined && target.health <= 0) continue;
          if (target.state === 'down') continue;
          const d = Math.hypot(target.x - p.x, target.y - p.y);
          if (d > reach + (target.radius ?? 13)) continue;
          const a = angleDiff(p.angle, Math.atan2(target.y - p.y, target.x - p.x));
          if (Math.abs(a) > PLAYER.punchArc) continue;
          hitAny = true;
          damageActor(w, target, PLAYER.punchDamage, p.angle, 'player');
          if (w.cops.includes(target)) w.addHeat(WANTED.heatPunchPed);
          else if (w.peds.includes(target)) {
            w.addHeat(WANTED.heatPunchPed);
            scarePeds(w, target.x, target.y, 200);
          }
        }
      }
      if (hitAny) w.spawnParticle(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, 'hit');
    }
  }
}

/** Damage an actor (ped, cop or rival): health, knockback, and what its defeat pays. */
export function damageActor(w, target, damage, angle, from) {
  if (target.health === undefined || target.dead) return;
  target.health -= damage;
  target.x += Math.cos(angle) * 8;
  target.y += Math.sin(angle) * 8;
  w.spawnParticle(target.x, target.y, 'hit');
  if (target.health > 0) return;
  if (w.rivals.includes(target)) {
    // A rival goes down for good and drops cash.
    target.dead = true;
    w.pickups.push({ kind: 'cash', x: target.x, y: target.y, amount: 60 + Math.floor(Math.random() * 90), bob: 0 });
    w.audio.pickup();
  } else if (w.peds.includes(target)) {
    target.state = 'down';
    target.downTimer = 4;
    target.health = 30;
  } else if (w.cops.includes(target)) {
    w.addHeat(WANTED.heatKillCop);
    target.state = 'down';
    target.downTimer = 6;
    target.health = 30;
  }
}

// ---------------------------------------------------------------- driving

/** Drive the player's car: throttle, steering, handbrake, collisions, damage and smoke. */
export function stepPlayerCar(w, dt, move, handbrake) {
  const car = w.player.inCar;
  if (!car || car.exploded) return;
  const spec = car;
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const speedAlong = car.speed;
  let accel = 0;
  if (move.y < 0) accel = spec.accel;
  else if (move.y > 0) {
    accel = speedAlong > 10 ? -spec.accel * 1.6 : -spec.accel * 0.6;
  }
  car.speed = clamp(car.speed + accel * dt, -spec.reverse, spec.top);
  // Rolling drag and the handbrake.
  car.speed *= 1 - (handbrake ? 1.6 : 0.25) * dt;
  if (handbrake) car.speed *= 1 - 0.9 * dt;
  if (Math.abs(car.speed) < 4 && move.y === 0) car.speed = 0;
  // Steering follows the speed, and reverses when reversing.
  const steer = move.x;
  const turn = spec.grip * clamp(car.speed / spec.top, -1, 1) * (handbrake ? 1.5 : 1);
  car.angle += steer * turn * dt;
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  const body = { x: car.x, y: car.y, radius: car.radius };
  body.x += nx * car.speed * dt;
  body.y += ny * car.speed * dt;
  const hitWall = w.city.collideCircle(body);
  if (hitWall && Math.abs(car.speed) > 120) {
    damageCar(w, car, Math.abs(car.speed) * 0.08);
    w.audio.crash();
    w.spawnParticle(body.x, body.y, 'crash');
  }
  if (hitWall) car.speed *= 0.45;
  car.x = body.x;
  car.y = body.y;
  // Sand stops a car dead (feet only, beyond the beach road).
  if (w.city.inSand(car.x, car.y)) {
    car.speed *= 0.5;
  }
  // Car-to-car bumps.
  for (const other of w.cars) {
    if (other === car || other.exploded) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    const min = car.radius + other.radius - 6;
    if (d < min && d > 0.01) {
      const push = (min - d) / 2;
      const ux = (other.x - car.x) / d;
      const uy = (other.y - car.y) / d;
      car.x -= ux * push;
      car.y -= uy * push;
      other.x += ux * push;
      other.y += uy * push;
      if (Math.abs(car.speed) > 150) {
        damageCar(w, car, 4);
        damageCar(w, other, 6);
        w.audio.crash();
      }
      car.speed *= 0.92;
    }
  }
  // Running over a pedestrian is a crime and a jolt.
  for (const ped of w.peds) {
    if (ped.state === 'down') continue;
    if (dist2(car.x, car.y, ped.x, ped.y) < (car.radius + ped.radius) * (car.radius + ped.radius) && Math.abs(car.speed) > 60) {
      ped.state = 'down';
      ped.downTimer = 5;
      ped.health = 1;
      w.addHeat(WANTED.heatHitPed);
      w.audio.crash();
      car.speed *= 0.8;
      scarePeds(w, ped.x, ped.y, 260);
    }
  }
  // Engine note and dust; smoke when the car is hurt.
  w.audio.engine(Math.abs(car.speed), car.top);
  if (Math.abs(car.speed) > 260 && Math.random() < 0.35) {
    w.spawnParticle(car.x - nx * car.length * 0.5, car.y - ny * car.length * 0.5, 'dust');
  }
  if (car.health < car.maxHealth * 0.35) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      w.spawnParticle(car.x, car.y - 6, 'smoke');
    }
  }
  if (car.health <= 0 && car.fuse < 0) {
    car.fuse = 2.5;
  }
  if (car.fuse >= 0) {
    car.fuse -= dt;
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.08;
      w.spawnParticle(car.x, car.y, 'smoke');
    }
    if (car.fuse <= 0) explodeCar(w, car);
  }
  void forwardX;
  void forwardY;
}

export function damageCar(w, car, amount) {
  if (car.exploded) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    if (car.fuse < 0) car.fuse = 2.5;
  }
}

export function explodeCar(w, car) {
  car.exploded = true;
  car.health = 0;
  w.audio.crash();
  for (let i = 0; i < 14; i += 1) w.spawnParticle(car.x, car.y, 'fire');
  // A blast hurts whoever is close, including the player inside.
  const p = w.player;
  if (w.player.inCar === car) {
    p.health -= 55;
    p.inCar = null;
    p.x = car.x + 40;
    p.y = car.y;
    p.invulnerable = 1;
  } else if (dist2(p.x, p.y, car.x, car.y) < 90 * 90) {
    p.health -= 30;
    p.invulnerable = 1;
  }
  for (const ped of w.peds) {
    if (dist2(ped.x, ped.y, car.x, car.y) < 90 * 90) {
      ped.state = 'down';
      ped.downTimer = 5;
    }
  }
  w.cars = w.cars.filter((c) => c !== car);
}

// ---------------------------------------------------------------- traffic

/** A traffic car: follow its road, turn at intersections, and stop for the car ahead. */
export function stepTrafficCar(w, car, dt) {
  if (car.exploded) return;
  // Find the car ahead on the same road and direction.
  let ahead = null;
  let aheadDist = Infinity;
  for (const other of w.cars) {
    if (other === car || other.exploded) continue;
    if (other.axis !== car.axis || other.roadIndex !== car.roadIndex || other.dir !== car.dir) continue;
    const along = car.axis === 'v' ? other.y - car.y : other.x - car.x;
    if (along * car.dir <= 0) continue;
    const d = Math.abs(along);
    if (d < aheadDist) {
      aheadDist = d;
      ahead = other;
    }
  }
  let target = car.top * 0.55;
  if (ahead !== null && aheadDist < 110) target = Math.min(target, ahead.speed);
  if (ahead !== null && aheadDist < 52) target = 0;
  // The player car ahead counts too.
  const p = w.player;
  if (p.inCar) {
    const pc = p.inCar;
    const along = car.axis === 'v' ? pc.y - car.y : pc.x - car.x;
    const lateral = car.axis === 'v' ? Math.abs(pc.x - car.x) : Math.abs(pc.y - car.y);
    if (along * car.dir > 0 && Math.abs(along) < 90 && lateral < 40) target = 0;
  }
  car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
  if (car.speed < 0) car.speed = 0;
  const step = car.speed * car.dir * dt;
  if (car.axis === 'v') car.y += step;
  else car.x += step;
  // At an intersection, sometimes turn onto the crossing road.
  const cross = car.axis === 'v' ? ROADS_H : ROADS_V;
  const alongPos = car.axis === 'v' ? car.y : car.x;
  for (let k = 0; k < cross.length; k += 1) {
    if (Math.abs(alongPos - cross[k]) < 26 && Math.random() < 0.02) {
      if (car.axis === 'v') {
        car.axis = 'h';
        car.roadIndex = k;
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.y = ROADS_H[k] + (car.dir === 1 ? LANE : -LANE);
        car.angle = car.dir === 1 ? 0 : Math.PI;
      } else {
        car.axis = 'v';
        car.roadIndex = k;
        car.dir = Math.random() < 0.5 ? 1 : -1;
        car.x = ROADS_V[k] + (car.dir === 1 ? -LANE : LANE);
        car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }
      break;
    }
  }
  // Wrap around the map edge: a car that leaves comes back on the other side.
  if (car.axis === 'v' && (car.y < 20 || car.y > 1900)) car.y = car.y < 20 ? 1900 : 20;
  if (car.axis === 'h' && (car.x < 20 || car.x > 2540)) car.x = car.x < 20 ? 2540 : 20;
}

// ---------------------------------------------------------------- police

/** A police car: steer toward the player and ram; a foot cop gets out when close. */
export function stepPoliceCar(w, car, dt) {
  if (car.exploded) return;
  const p = w.player;
  const tx = p.inCar ? p.inCar.x : p.x;
  const ty = p.inCar ? p.inCar.y : p.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const turn = clamp(angleDiff(car.angle, want), -1, 1);
  car.angle += turn * 2.4 * dt;
  const target = 430;
  car.speed += clamp(target - car.speed, -300 * dt, 300 * dt);
  const body = { x: car.x, y: car.y, radius: car.radius };
  body.x += Math.cos(car.angle) * car.speed * dt;
  body.y += Math.sin(car.angle) * car.speed * dt;
  const hitWall = w.city.collideCircle(body);
  if (hitWall) car.speed *= 0.5;
  car.x = body.x;
  car.y = body.y;
  // Ramming the player's car damages it.
  if (p.inCar) {
    const d = Math.hypot(p.inCar.x - car.x, p.inCar.y - car.y);
    if (d < car.radius + p.inCar.radius - 4) {
      damageCar(w, p.inCar, 7 * dt * 10);
      p.inCar.speed *= 0.94;
      car.speed *= 0.9;
      if (Math.random() < 0.1) w.audio.crash();
    }
  }
  // Close to a player on foot: a cop gets out and gives chase.
  if (!p.inCar && w.cops.length < 3 && Math.hypot(p.x - car.x, p.y - car.y) < 90 && Math.random() < 0.02) {
    w.cops.push(createCop(car.x + 30, car.y));
    car.speed = 0;
  }
}

/** A foot cop: run the player down and arrest them, or shoot at high wanted levels. */
export function stepCop(w, cop, dt) {
  if (cop.state === 'down') {
    cop.downTimer -= dt;
    if (cop.downTimer <= 0) {
      cop.state = 'walk';
      cop.health = 30;
    }
    return;
  }
  const p = w.player;
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  const want = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.angle = want;
  if (cop.shootCooldown > 0) cop.shootCooldown -= dt;
  if (d < 30) {
    cop.arrest += dt;
    if (cop.arrest >= PLAYER.arrestTime) w.events.busted = true;
  } else {
    cop.arrest = Math.max(0, cop.arrest - dt);
    const body = { x: cop.x, y: cop.y, radius: cop.radius };
    body.x += Math.cos(want) * cop.speed * dt;
    body.y += Math.sin(want) * cop.speed * dt;
    w.city.collideCircle(body);
    cop.x = body.x;
    cop.y = body.y;
  }
  // At three stars and up, a cop shoots instead of only chasing.
  if (w.stars >= 3 && d > 60 && d < 420 && cop.shootCooldown <= 0) {
    cop.shootCooldown = 1.4 + Math.random() * 0.8;
    w.bullets.push(createBullet(cop.x, cop.y, want, 'cop', 8));
    w.audio.shoot();
  }
}

// ---------------------------------------------------------------- pedestrians and rivals

/** A pedestrian: stroll the sidewalks, flee from trouble, lie down when hit. */
export function stepPed(w, ped, dt) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
      ped.health = 30;
    }
    return;
  }
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    const p = w.player;
    const away = Math.atan2(ped.y - p.y, ped.x - p.x);
    const body = { x: ped.x, y: ped.y, radius: ped.radius };
    body.x += Math.cos(away) * ped.speed * 2.1 * dt;
    body.y += Math.sin(away) * ped.speed * 2.1 * dt;
    w.city.collideCircle(body);
    ped.x = body.x;
    ped.y = body.y;
    ped.angle = away;
    if (ped.fleeTimer <= 0) {
      ped.state = 'walk';
      ped.target = w.city.randomSidewalkPoint();
    }
    return;
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 14) {
    ped.target = w.city.randomSidewalkPoint();
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  const body = { x: ped.x, y: ped.y, radius: ped.radius };
  body.x += (dx / d) * ped.speed * dt;
  body.y += (dy / d) * ped.speed * dt;
  w.city.collideCircle(body);
  ped.x = body.x;
  ped.y = body.y;
}

/** A rival gang member: hold ground, strafe, and shoot at the player. */
export function stepRival(w, rival, dt) {
  if (rival.health <= 0) return;
  const p = w.player;
  const d = Math.hypot(p.x - rival.x, p.y - rival.y);
  rival.angle = Math.atan2(p.y - rival.y, p.x - rival.x);
  if (rival.shootCooldown > 0) rival.shootCooldown -= dt;
  rival.strafe -= dt;
  if (rival.strafe <= 0) {
    rival.strafe = 0.9 + Math.random() * 0.9;
    rival.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }
  if (d > 260) {
    // Close the distance.
    const body = { x: rival.x, y: rival.y, radius: rival.radius };
    body.x += Math.cos(rival.angle) * rival.speed * dt;
    body.y += Math.sin(rival.angle) * rival.speed * dt;
    w.city.collideCircle(body);
    rival.x = body.x;
    rival.y = body.y;
  } else {
    // Strafe sideways while shooting.
    const side = rival.angle + (Math.PI / 2) * rival.strafeDir;
    const body = { x: rival.x, y: rival.y, radius: rival.radius };
    body.x += Math.cos(side) * rival.speed * 0.6 * dt;
    body.y += Math.sin(side) * rival.speed * 0.6 * dt;
    w.city.collideCircle(body);
    rival.x = body.x;
    rival.y = body.y;
    if (d < 460 && rival.shootCooldown <= 0) {
      rival.shootCooldown = 1.1 + Math.random() * 0.7;
      const spread = (Math.random() - 0.5) * 0.22;
      w.bullets.push(createBullet(rival.x, rival.y, rival.angle + spread, 'rival', 9));
      w.audio.shoot();
      w.spawnParticle(rival.x + Math.cos(rival.angle) * 22, rival.y + Math.sin(rival.angle) * 22, 'muzzle');
    }
  }
}

// ---------------------------------------------------------------- bullets

/** A bullet: fly straight, stop at a wall, and hurt the first actor or car it meets. */
export function stepBullet(w, bullet, dt) {
  if (!bullet.alive) return;
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
  bullet.range -= Math.hypot(bullet.vx, bullet.vy) * dt;
  if (bullet.range <= 0) {
    bullet.alive = false;
    return;
  }
  // A wall stops it.
  const probe = { x: bullet.x, y: bullet.y, radius: 2 };
  if (w.city.collideCircle(probe)) {
    bullet.alive = false;
    w.spawnParticle(bullet.x, bullet.y, 'hit');
    return;
  }
  const p = w.player;
  if (bullet.from !== 'player') {
    if (!p.inCar && dist2(bullet.x, bullet.y, p.x, p.y) < (PLAYER.radius + 4) * (PLAYER.radius + 4)) {
      bullet.alive = false;
      if (p.invulnerable <= 0) {
        p.health -= bullet.damage;
        p.invulnerable = 0.5;
        w.spawnParticle(p.x, p.y, 'hit');
      }
      return;
    }
    if (p.inCar && dist2(bullet.x, bullet.y, p.inCar.x, p.inCar.y) < p.inCar.radius * p.inCar.radius) {
      bullet.alive = false;
      damageCar(w, p.inCar, bullet.damage);
      return;
    }
  } else {
    for (const list of [w.rivals, w.cops, w.peds]) {
      for (const target of list) {
        if (target.health !== undefined && target.health <= 0) continue;
        if (target.state === 'down') continue;
        if (dist2(bullet.x, bullet.y, target.x, target.y) < ((target.radius ?? 13) + 4) * ((target.radius ?? 13) + 4)) {
          bullet.alive = false;
          damageActor(w, target, bullet.damage, Math.atan2(bullet.vy, bullet.vx), 'player');
          return;
        }
      }
    }
    for (const car of w.cars) {
      if (car.exploded || car === p.inCar) continue;
      if (dist2(bullet.x, bullet.y, car.x, car.y) < car.radius * car.radius) {
        bullet.alive = false;
        damageCar(w, car, bullet.damage);
        return;
      }
    }
  }
}
