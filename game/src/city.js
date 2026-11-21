// The city of Vice Harbor: a road grid with blocks between the roads, the beach on the east
// edge and the docks on the south. Buildings are solid rectangles (the collision the world
// pushes actors out of); the park, plaza, parking lot and beach are open ground. Traffic drives
// on the road centrelines and pedestrians walk the sidewalks beside them, so both only need the
// road list below. Everything is generated from one seed, so the city is the same every visit.

import { BEACH_X, PALETTE, PLACES, ROADS_H, ROADS_V, ROAD_W, WATER_X, WATER_Y, WORLD } from './config.js';

/** A building: a solid rectangle with a colour and pre-rolled window dots. */
function makeBuilding(x, y, w, h, color, random, label) {
  const windows = [];
  const cols = Math.max(1, Math.floor(w / 46));
  const rows = Math.max(1, Math.floor(h / 42));
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (random() < 0.72) windows.push({ x: x + 14 + c * 46, y: y + 14 + r * 42 });
    }
  }
  return { x, y, w, h, color, windows, label: label ?? null };
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const containers = [];
  const parked = [];

  // A block's rectangle, between two vertical and two horizontal roads.
  function blockRect(i, j) {
    return {
      x: ROADS_V[i] + ROAD_W / 2 + 8,
      y: ROADS_H[j] + ROAD_W / 2 + 8,
      w: ROADS_V[i + 1] - ROADS_V[i] - ROAD_W - 16,
      h: ROADS_H[j + 1] - ROADS_H[j] - ROAD_W - 16,
    };
  }

  function fillBlock(i, j, label) {
    const b = blockRect(i, j);
    const count = random() < 0.5 ? 1 : 2;
    for (let k = 0; k < count; k += 1) {
      const w = 130 + random() * 90;
      const h = 100 + random() * 70;
      const x = b.x + 12 + random() * Math.max(1, b.w - w - 24);
      const y = b.y + 12 + random() * Math.max(1, b.h - h - 24);
      const color = PALETTE.building[Math.floor(random() * PALETTE.building.length)];
      buildings.push(makeBuilding(x, y, w, h, color, random, k === 0 ? label : null));
    }
  }

  function parkTrees(b) {
    for (let k = 0; k < 14; k += 1) {
      trees.push({ x: b.x + 20 + random() * (b.w - 40), y: b.y + 20 + random() * (b.h - 40), r: 12 + random() * 10 });
    }
  }

  // The park (trees and a pond, no buildings) and the plaza (a fountain, no buildings).
  const park = blockRect(0, 0);
  parkTrees(park);
  const plaza = blockRect(2, 1);

  // The parking lot: parked cars in two rows, each one stealable.
  const lot = blockRect(4, 0);
  const lotKinds = ['sedan', 'taxi', 'sports', 'sedan', 'truck', 'sedan'];
  for (let k = 0; k < 6; k += 1) {
    parked.push({
      kind: lotKinds[k],
      x: lot.x + 40 + (k % 3) * 110,
      y: lot.y + 50 + Math.floor(k / 3) * 130,
      angle: 0,
    });
  }

  // The docks: containers stacked on the piers, and the piers themselves (walkable deck).
  for (let k = 0; k < 10; k += 1) {
    containers.push({
      x: 1560 + (k % 5) * 150,
      y: 1640 + Math.floor(k / 5) * 90,
      w: 120,
      h: 60,
      color: PALETTE.container[k % PALETTE.container.length],
    });
  }

  // Every other block gets buildings; the named places get a labelled one.
  for (let i = 0; i < ROADS_V.length - 1; i += 1) {
    for (let j = 0; j < ROADS_H.length - 1; j += 1) {
      if (i === 0 && j === 0) continue; // park
      if (i === 2 && j === 1) continue; // plaza
      if (i === 4 && j === 0) continue; // parking lot
      if (i === 1 && j === 2) {
        buildings.push(makeBuilding(700, 950, 180, 130, '#e8b04b', random, "Mara's Office"));
        continue;
      }
      if (i === 3 && j === 2) {
        buildings.push(makeBuilding(1500, 950, 200, 130, '#7fb3d9', random, 'Spray & Go'));
        continue;
      }
      if (i === 0 && j === 3) {
        buildings.push(makeBuilding(300, 1290, 200, 140, '#eef1f5', random, 'Harbor General'));
        continue;
      }
      if (i === 4 && j === 3) {
        buildings.push(makeBuilding(1900, 1290, 200, 140, '#5b8dd9', random, 'Harbor PD'));
        continue;
      }
      if (i === 1 && j === 0) {
        buildings.push(makeBuilding(700, 280, 150, 110, '#a98fd4', random, 'Safehouse'));
        continue;
      }
      fillBlock(i, j, null);
    }
  }

  // The beach (east) and the port water (south) are solid for everyone; sand is for feet only.
  const solids = buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  for (const c of containers) solids.push({ x: c.x, y: c.y, w: c.w, h: c.h });

  function inWater(x, y) {
    return x > WATER_X || y > WATER_Y;
  }

  function inSand(x, y) {
    return x > BEACH_X && x <= WATER_X && y < WATER_Y;
  }

  /** Push a circle (x, y, radius) out of every solid it overlaps; returns true if it hit one. */
  function collideCircle(body) {
    let hit = false;
    for (const s of solids) {
      const cx = Math.max(s.x, Math.min(body.x, s.x + s.w));
      const cy = Math.max(s.y, Math.min(body.y, s.y + s.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= body.radius * body.radius) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * body.radius;
        body.y = cy + (dy / d) * body.radius;
      } else {
        body.x = s.x - body.radius;
      }
    }
    // The world edge and the water are solid too.
    if (body.x < body.radius) {
      body.x = body.radius;
      hit = true;
    }
    if (body.x > WORLD.width - body.radius) {
      body.x = WORLD.width - body.radius;
      hit = true;
    }
    if (body.y < body.radius) {
      body.y = body.radius;
      hit = true;
    }
    if (body.y > WORLD.height - body.radius) {
      body.y = WORLD.height - body.radius;
      hit = true;
    }
    if (inWater(body.x, body.y)) {
      if (body.x > WATER_X) body.x = WATER_X - body.radius;
      if (body.y > WATER_Y) body.y = WATER_Y - body.radius;
      hit = true;
    }
    return hit;
  }

  /** Whether a point is on a road (asphalt), used by the traffic AI and the minimap. */
  function onRoad(x, y) {
    for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
    for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
    return false;
  }

  /** The nearest road centre and axis to a point, for spawning traffic. */
  function nearestRoad(x, y) {
    let best = { axis: 'v', index: 0, dist: Infinity };
    for (let i = 0; i < ROADS_V.length; i += 1) {
      const d = Math.abs(x - ROADS_V[i]);
      if (d < best.dist) best = { axis: 'v', index: i, dist: d };
    }
    for (let j = 0; j < ROADS_H.length; j += 1) {
      const d = Math.abs(y - ROADS_H[j]);
      if (d < best.dist) best = { axis: 'h', index: j, dist: d };
    }
    return best;
  }

  /** A random sidewalk point: beside a road, just off the asphalt. */
  function randomSidewalkPoint() {
    if (random() < 0.5) {
      const i = Math.floor(random() * ROADS_V.length);
      const along = 60 + random() * (WORLD.height - 120);
      const side = random() < 0.5 ? -1 : 1;
      return { x: ROADS_V[i] + side * (ROAD_W / 2 + 14), y: along };
    }
    const j = Math.floor(random() * ROADS_H.length);
    const along = 60 + random() * (WORLD.width - 120);
    const side = random() < 0.5 ? -1 : 1;
    return { x: along, y: ROADS_H[j] + side * (ROAD_W / 2 + 14) };
  }

  return {
    buildings,
    trees,
    containers,
    parked,
    park,
    plaza,
    collideCircle,
    onRoad,
    nearestRoad,
    randomSidewalkPoint,
    inWater,
    inSand,
    places: PLACES,
  };
}
