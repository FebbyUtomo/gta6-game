// Vice Harbor — every tuning number, colour and city fact in one place.
// The city is a road grid: vertical roads at ROADS_V, horizontal at ROADS_H, each ROAD_W
// wide. Blocks sit between the roads; the east edge is a beach and the south edge the docks.
// The renderer scales the 1280x720 view to the window, so no rule here depends on the screen.

export const STEP = 1 / 60;
export const WORLD = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };

export const ROADS_V = [200, 600, 1000, 1400, 1800, 2200];
export const ROADS_H = [180, 520, 860, 1200, 1540];
export const ROAD_W = 72;
export const LANE = 16;

/** Sand starts here (east edge); water starts at WATER_X. Cars cannot enter sand. */
export const BEACH_X = 2380;
export const WATER_X = 2500;
/** The docks strip (south edge); water starts at WATER_Y. */
export const PORT_Y = 1600;
export const WATER_Y = 1860;

/** Where the named places are: doors and markers the missions point at. */
export const PLACES = {
  maraOffice: { x: 790, y: 1090, name: "Mara's Office" },
  garage: { x: 1600, y: 1090, name: 'Spray & Go' },
  hospital: { x: 400, y: 1430, name: 'Harbor General' },
  policeStation: { x: 2000, y: 1430, name: 'Harbor PD' },
  safehouse: { x: 775, y: 400, name: 'Safehouse' },
  park: { x: 400, y: 350, name: 'Palm Park' },
  plaza: { x: 1200, y: 690, name: 'Fountain Plaza' },
  parkingLot: { x: 2000, y: 350, name: 'Lot 7' },
  docks: { x: 2000, y: 1720, name: 'The Docks' },
  beach: { x: 2440, y: 900, name: 'Vice Beach' },
};

/** Packages for the Errands mission, scattered around the city. */
export const PACKAGE_SPOTS = [
  { x: 400, y: 690 },
  { x: 1600, y: 350 },
  { x: 1200, y: 1380 },
];

export const PLAYER = {
  radius: 14,
  walk: 230,
  sprint: 345,
  health: 100,
  punchRange: 36,
  punchArc: 1.15,
  punchDamage: 14,
  punchCooldown: 0.34,
  shootRange: 540,
  shootCooldown: 0.22,
  bulletSpeed: 920,
  startAmmo: 24,
  maxAmmo: 72,
  arrestTime: 1.2,
};

export const CAR_KINDS = {
  sedan: { length: 64, width: 30, accel: 340, top: 430, reverse: 150, grip: 2.6, health: 100, color: '#c94f4f' },
  taxi: { length: 64, width: 30, accel: 330, top: 410, reverse: 150, grip: 2.6, health: 100, color: '#f2c94c' },
  sports: { length: 68, width: 30, accel: 460, top: 560, reverse: 170, grip: 3.1, health: 90, color: '#4fc3f7' },
  truck: { length: 84, width: 34, accel: 260, top: 330, reverse: 120, grip: 2.2, health: 160, color: '#8b93a3' },
  police: { length: 66, width: 30, accel: 420, top: 520, reverse: 170, grip: 3.0, health: 140, color: '#eef1f5' },
};

export const TRAFFIC_COLORS = ['#c94f4f', '#f2c94c', '#4fc3f7', '#7bc96f', '#b07fd4', '#e8873a', '#eef1f5', '#5b8dd9'];

export const PED_COLORS = ['#e8873a', '#7bc96f', '#b07fd4', '#4fc3f7', '#e5534b', '#f2c94c', '#5b8dd9', '#e8a2c0'];

export const WANTED = {
  maxHeat: 125,
  heatPerStar: 25,
  decayPerSecond: 2.2,
  calmAfter: 8,
  heatStealOccupied: 25,
  heatHitPed: 25,
  heatShootWitnessed: 20,
  heatPunchPed: 10,
  heatKillCop: 50,
  witnessRange: 380,
  maxPoliceCars: 5,
};

/** A full day lasts this long in seconds; 0 is noon, 0.5 is midnight. */
export const DAY_LENGTH = 240;

export const PICKUPS = {
  health: { amount: 40, color: '#3ddc84' },
  ammo: { amount: 12, color: '#f2c94c' },
  cash: { amount: 75, color: '#7bc96f' },
};

export const GARAGE_PRICE = 150;

export const PALETTE = {
  backdrop: '#0e1420',
  grass: '#4d8f4a',
  grassDark: '#3f7a3e',
  sand: '#e8d5a0',
  water: '#2b7fb8',
  waterDeep: '#1d5f8f',
  road: '#333a45',
  roadEdge: '#4a5261',
  lane: '#f2c94c',
  sidewalk: '#9aa1ad',
  building: ['#d97b6c', '#e8b04b', '#7fb3d9', '#a98fd4', '#7bc96f', '#e8873a', '#c97b9b', '#6fb3a5'],
  roof: '#2a3040',
  window: '#ffe9a8',
  parkTree: '#2f6b2f',
  parkPond: '#2b7fb8',
  plaza: '#b9a98a',
  fountain: '#7fd4e8',
  dock: '#6b5d4f',
  container: ['#c94f4f', '#4fc3f7', '#f2c94c', '#7bc96f'],
  player: '#ff5a5a',
  playerJacket: '#d92626',
  pedSkin: '#e8b88a',
  policeCar: '#eef1f5',
  policeLightRed: '#ff2e2e',
  policeLightBlue: '#2e7bff',
  rival: '#8a2be2',
  rivalJacket: '#6a1fb0',
  marker: '#ffd23f',
  markerRing: '#ff9f1c',
  text: '#eef1f5',
  muted: '#aab2c0',
  panel: 'rgba(16, 22, 34, 0.94)',
  panelEdge: '#f2c94c',
  health: '#3ddc84',
  healthLow: '#ff2e2e',
  money: '#7bc96f',
  star: '#ffd23f',
  starEmpty: '#5a6272',
  night: 'rgba(8, 10, 32, 0.55)',
  dusk: 'rgba(255, 120, 40, 0.10)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'vice-harbor.save.v1';
export const BEST_KEY = 'vice-harbor.best';
