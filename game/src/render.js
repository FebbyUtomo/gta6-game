// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 view
// is scaled to fit the window and centred, the margin filled with the backdrop colour. The
// city is drawn sun-soaked (warm sand, teal water, pastel buildings), the HUD is canvas text
// and bars, and the minimap is a live little map in the corner. Night brings a darkness
// overlay with a light around the player.

import { BEACH_X, FONT, PALETTE, ROADS_H, ROADS_V, ROAD_W, VIEW, WATER_X, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_DIALOGUE = 'dialogue';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

const MINIMAP = { x: 1052, y: 548, w: 208, h: 152 };

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, cx: 0, cy: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    const key = `${size}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function rect(x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  /** The camera: follow the player, clamped to the world, in logical view pixels. */
  function camera(w) {
    const p = w.player.inCar ?? w.player;
    const cx = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const cy = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    view.cx = cx;
    view.cy = cy;
    return { cx, cy };
  }

  function toWorld(sx, sy) {
    const rectBox = canvas.getBoundingClientRect();
    const px = ((sx - rectBox.left) / rectBox.width) * canvas.width;
    const py = ((sy - rectBox.top) / rectBox.height) * canvas.height;
    return { x: (px - view.x) / view.scale + view.cx, y: (py - view.y) / view.scale + view.cy };
  }

  // ------------------------------------------------------------ the city

  function drawGround(w) {
    // Grass base, then the beach, the water and the docks.
    rect(0, 0, WORLD.width, WORLD.height, PALETTE.grass);
    rect(BEACH_X, 0, WATER_X - BEACH_X, WORLD.height, PALETTE.sand);
    rect(WATER_X, 0, WORLD.width - WATER_X, WORLD.height, PALETTE.water);
    // Animated wave lines on the water.
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const y = 120 + i * 220 + Math.sin(w.time * 0.7 + i) * 8;
      context.beginPath();
      context.moveTo(WATER_X + 8, y);
      context.lineTo(WATER_X + 40 + ((i * 37) % 30), y);
      context.stroke();
    }
    rect(0, WATER_Y, WORLD.width, WORLD.height - WATER_Y, PALETTE.waterDeep);
    // The docks deck.
    rect(1500, 1600, 900, 260, PALETTE.dock);
    // The park and the plaza.
    const park = w.city.park;
    rect(park.x - 8, park.y - 8, park.w + 16, park.h + 16, PALETTE.grassDark);
    circle(park.x + park.w * 0.7, park.y + park.h * 0.6, 34, PALETTE.parkPond);
    const plaza = w.city.plaza;
    rect(plaza.x - 8, plaza.y - 8, plaza.w + 16, plaza.h + 16, PALETTE.plaza);
    circle(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, 26, PALETTE.fountain);
    circle(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, 14, '#bfeef7');
    // Trees.
    for (const t of w.city.trees) {
      circle(t.x, t.y, t.r, PALETTE.parkTree);
      circle(t.x - 4, t.y - 4, t.r * 0.55, '#3f8f3f');
    }
  }

  function drawRoads() {
    for (const rx of ROADS_V) {
      rect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height, PALETTE.road);
      rect(rx - ROAD_W / 2, 0, 4, WORLD.height, PALETTE.sidewalk);
      rect(rx + ROAD_W / 2 - 4, 0, 4, WORLD.height, PALETTE.sidewalk);
    }
    for (const ry of ROADS_H) {
      rect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W, PALETTE.road);
      rect(0, ry - ROAD_W / 2, WORLD.width, 4, PALETTE.sidewalk);
      rect(0, ry + ROAD_W / 2 - 4, WORLD.width, 4, PALETTE.sidewalk);
    }
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const rx of ROADS_V) {
      for (let y = 20; y < WORLD.height; y += 56) context.fillRect(rx - 2, y, 4, 28);
    }
    for (const ry of ROADS_H) {
      for (let x = 20; x < WORLD.width; x += 56) context.fillRect(x, ry - 2, 28, 4);
    }
  }

  function drawBuildings(w) {
    for (const b of w.city.buildings) {
      rect(b.x, b.y, b.w, b.h, b.color);
      rect(b.x + 7, b.y + 7, b.w - 14, b.h - 14, PALETTE.roof);
      for (const win of b.windows) {
        rect(win.x, win.y, 12, 10, PALETTE.window);
      }
      if (b.label) {
        text(b.label, b.x + b.w / 2, b.y + b.h / 2, 15, PALETTE.text, 'center', 'middle');
      }
    }
    for (const c of w.city.containers) {
      rect(c.x, c.y, c.w, c.h, c.color);
      rect(c.x + 5, c.y + 5, c.w - 10, c.h - 10, 'rgba(0,0,0,0.25)');
    }
  }

  // ------------------------------------------------------------ actors

  function drawPickups(w) {
    for (const pickup of w.pickups) {
      const bob = Math.sin(pickup.bob * 3) * 3;
      const y = pickup.y + bob;
      const pulse = 0.6 + 0.4 * Math.sin(pickup.bob * 4);
      if (pickup.kind === 'health') {
        circle(pickup.x, y, 13, 'rgba(61,220,132,0.35)');
        rect(pickup.x - 3, y - 9, 6, 18, '#3ddc84');
        rect(pickup.x - 9, y - 3, 18, 6, '#3ddc84');
      } else if (pickup.kind === 'ammo') {
        rect(pickup.x - 10, y - 7, 20, 14, '#f2c94c');
        rect(pickup.x - 6, y - 3, 4, 6, '#8a6d00');
        rect(pickup.x, y - 3, 4, 6, '#8a6d00');
        rect(pickup.x + 6, y - 3, 4, 6, '#8a6d00');
      } else if (pickup.kind === 'cash') {
        circle(pickup.x, y, 11, `rgba(123,201,111,${0.4 + pulse * 0.3})`);
        text('$', pickup.x, y + 5, 16, '#1d5c1d', 'center', 'alphabetic');
      } else if (pickup.kind === 'package') {
        rect(pickup.x - 10, y - 8, 20, 16, '#ffd23f');
        rect(pickup.x - 10, y - 2, 20, 4, '#ff9f1c');
        text('!', pickup.x, y + 6, 14, '#7a4d00', 'center', 'alphabetic');
      }
    }
  }

  function drawMarker(w, target) {
    if (!target) return;
    const pulse = 1 + 0.18 * Math.sin(w.time * 5);
    const r = 18 * pulse;
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(target.x, target.y, 30 + 8 * Math.sin(w.time * 5), 0, Math.PI * 2);
    context.stroke();
    context.save();
    context.translate(target.x, target.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.marker;
    context.fillRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4);
    context.restore();
    text(target.label, target.x, target.y - 44, 16, PALETTE.marker, 'center', 'alphabetic');
  }

  function drawCar(car, time) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const l = car.length;
    const wd = car.width;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-l / 2 + 3, -wd / 2 + 4, l, wd);
    // Body.
    context.fillStyle = car.color;
    context.fillRect(-l / 2, -wd / 2, l, wd);
    // Roof and windshield.
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.fillRect(-l * 0.18, -wd / 2 + 4, l * 0.36, wd - 8);
    context.fillStyle = '#bfe3f2';
    context.fillRect(l * 0.22, -wd / 2 + 5, 10, wd - 10);
    // Wheels.
    context.fillStyle = '#14181f';
    context.fillRect(-l / 2 + 6, -wd / 2 - 3, 12, 5);
    context.fillRect(-l / 2 + 6, wd / 2 - 2, 12, 5);
    context.fillRect(l / 2 - 18, -wd / 2 - 3, 12, 5);
    context.fillRect(l / 2 - 18, wd / 2 - 2, 12, 5);
    // Police light bar, flashing.
    if (car.kind === 'police') {
      const on = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = on ? PALETTE.policeLightRed : '#5a1010';
      context.fillRect(-6, -wd / 2 + 3, 12, 7);
      context.fillStyle = on ? '#123a7a' : PALETTE.policeLightBlue;
      context.fillRect(-6, wd / 2 - 10, 12, 7);
    }
    // Headlights at night.
    context.fillStyle = '#fff6c0';
    context.fillRect(l / 2 - 2, -wd / 2 + 4, 3, 6);
    context.fillRect(l / 2 - 2, wd / 2 - 10, 3, 6);
    context.restore();
    // Smoke when hurt.
    if (car.health < car.maxHealth * 0.35 && !car.exploded) {
      circle(car.x - Math.cos(car.angle) * car.length * 0.3, car.y - Math.sin(car.angle) * car.length * 0.3, 7, 'rgba(90,98,114,0.6)');
    }
  }

  function drawPerson(x, y, angle, jacket, skin, down) {
    context.save();
    context.translate(x, y);
    if (down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.fillRect(-14, -6, 28, 12);
      context.fillStyle = jacket;
      context.fillRect(-12, -7, 24, 14);
      context.fillStyle = skin;
      context.beginPath();
      context.arc(15, 0, 6, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(0, 2, 13, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = jacket;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = skin;
    context.beginPath();
    context.arc(4, 0, 6, 0, Math.PI * 2);
    context.fill();
    // Facing tick.
    context.fillStyle = jacket;
    context.fillRect(10, -3, 7, 6);
    context.restore();
  }

  function drawActors(w) {
    for (const car of w.cars) drawCar(car, w.time);
    for (const ped of w.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.jacket ?? '#7bc96f', '#e8b88a', ped.state === 'down');
    }
    for (const cop of w.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#2e5aa8', '#e8b88a', cop.state === 'down');
    }
    for (const rival of w.rivals) {
      if (rival.health <= 0) {
        drawPerson(rival.x, rival.y, rival.angle, '#6a1fb0', '#e8b88a', true);
        continue;
      }
      drawPerson(rival.x, rival.y, rival.angle, '#6a1fb0', '#e8b88a', false);
    }
    const p = w.player;
    if (p.inCar) {
      // The player's car is drawn with the rest; mark it with a small arrow.
      const car = p.inCar;
      context.save();
      context.translate(car.x, car.y - car.width / 2 - 16);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(0, 8);
      context.lineTo(-7, -4);
      context.lineTo(7, -4);
      context.closePath();
      context.fill();
      context.restore();
    } else if (p.invulnerable <= 0 || Math.floor(p.invulnerable * 10) % 2 === 1) {
      drawPerson(p.x, p.y, p.angle, '#d92626', '#e8b88a', false);
      // A gun in hand.
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.fillStyle = '#22262e';
      context.fillRect(10, -2, 14, 4);
      context.restore();
    }
    for (const bullet of w.bullets) {
      context.strokeStyle = '#ffe9a8';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(bullet.x - bullet.vx * 0.012, bullet.y - bullet.vy * 0.012);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
    }
    for (const pt of w.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      context.globalAlpha = alpha;
      circle(pt.x, pt.y, pt.size * (0.5 + alpha * 0.5), pt.color);
      context.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ lighting

  function drawLighting(w) {
    const t = w.timeOfDay;
    const darkness = 0.55 * (1 - Math.cos(t * Math.PI * 2)) / 2;
    if (darkness < 0.02) return;
    const p = w.player.inCar ?? w.player;
    const { cx, cy } = view;
    const gx = p.x - cx;
    const gy = p.y - cy;
    const gradient = context.createRadialGradient(gx, gy, 140, gx, gy, 620);
    gradient.addColorStop(0, 'rgba(8,10,32,0)');
    gradient.addColorStop(1, `rgba(8,10,32,${darkness})`);
    context.fillStyle = gradient;
    context.fillRect(cx - 40, cy - 40, VIEW.width + 80, VIEW.height + 80);
    // Dusk warmth.
    if ((t > 0.18 && t < 0.32) || (t > 0.68 && t < 0.82)) {
      context.fillStyle = 'rgba(255,120,40,0.06)';
      context.fillRect(cx, cy, VIEW.width, VIEW.height);
    }
  }

  // ------------------------------------------------------------ HUD

  function drawHud(w, ui) {
    const p = w.player;
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Health bar.
    rect(20, 18, 220, 20, 'rgba(0,0,0,0.55)');
    const hpColor = p.health > 40 ? PALETTE.health : PALETTE.healthLow;
    rect(22, 20, 216 * clamp(p.health / 100, 0, 1), 16, hpColor);
    text(`HP ${Math.max(0, Math.ceil(p.health))}`, 26, 34, 15, PALETTE.text, 'left', 'middle');
    // Money and ammo.
    text(`$${p.money.toLocaleString('en-US')}`, 20, 62, 24, PALETTE.money, 'left', 'alphabetic');
    text(`Ammo ${p.ammo}`, 20, 88, 18, PALETTE.text, 'left', 'alphabetic');
    // Wanted stars.
    const stars = w.stars;
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 30 - i * 30, 44, 30, i < stars ? PALETTE.star : PALETTE.starEmpty, 'right', 'alphabetic');
    }
    if (stars > 0) text('WANTED', VIEW.width - 30, 70, 14, PALETTE.star, 'right', 'alphabetic');
    // Speed, while driving.
    if (p.inCar) {
      const mph = Math.round(Math.abs(p.inCar.speed) * 0.12);
      text(`${mph} mph`, VIEW.width / 2, VIEW.height - 24, 26, PALETTE.text, 'center', 'alphabetic');
    }
    // Objective.
    if (ui.objective) {
      rect(20, VIEW.height - 78, 460, 58, 'rgba(0,0,0,0.55)');
      text(ui.missionTitle ?? 'Vice Harbor', 32, VIEW.height - 56, 13, PALETTE.marker, 'left', 'alphabetic');
      text(ui.objective, 32, VIEW.height - 34, 16, PALETTE.text, 'left', 'alphabetic');
    }
    // Context hint.
    if (ui.hint) text(ui.hint, 20, VIEW.height - 96, 15, PALETTE.muted, 'left', 'alphabetic');
    // Banner.
    if (ui.banner) {
      const bw = 640;
      rect((VIEW.width - bw) / 2, 96, bw, 44, 'rgba(20,26,40,0.9)');
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 2;
      context.strokeRect((VIEW.width - bw) / 2, 96, bw, 44);
      text(ui.banner, VIEW.width / 2, 126, 20, PALETTE.marker, 'center', 'middle');
    }
    if (ui.muted) text('Muted (M)', VIEW.width - 20, VIEW.height - 96, 14, PALETTE.muted, 'right', 'alphabetic');
    drawMinimap(w, ui);
  }

  function drawMinimap(w, ui) {
    const m = MINIMAP;
    const sx = m.w / WORLD.width;
    const sy = m.h / WORLD.height;
    rect(m.x - 4, m.y - 4, m.w + 8, m.h + 8, 'rgba(0,0,0,0.6)');
    context.save();
    context.beginPath();
    context.rect(m.x, m.y, m.w, m.h);
    context.clip();
    rect(m.x, m.y, m.w, m.h, '#2f6b2f');
    // Water.
    rect(m.x + WATER_X * sx, m.y, m.w - WATER_X * sx, m.h, PALETTE.water);
    rect(m.x, m.y + WATER_Y * sy, m.w, m.h - WATER_Y * sy, PALETTE.waterDeep);
    // Roads.
    context.strokeStyle = '#c8cdd6';
    context.lineWidth = 2;
    for (const rx of ROADS_V) {
      context.beginPath();
      context.moveTo(m.x + rx * sx, m.y);
      context.lineTo(m.x + rx * sx, m.y + m.h);
      context.stroke();
    }
    for (const ry of ROADS_H) {
      context.beginPath();
      context.moveTo(m.x, m.y + ry * sy);
      context.lineTo(m.x + m.w, m.y + ry * sy);
      context.stroke();
    }
    // Mission marker.
    if (ui.target) {
      const pulse = 1 + 0.3 * Math.sin(w.time * 5);
      circle(m.x + ui.target.x * sx, m.y + ui.target.y * sy, 5 * pulse, PALETTE.marker);
    }
    // Cars and police.
    for (const car of w.cars) {
      circle(m.x + car.x * sx, m.y + car.y * sy, car.driver === 'police' ? 3.5 : 2.5, car.driver === 'police' ? '#2e7bff' : '#eef1f5');
    }
    // The player.
    const p = w.player.inCar ?? w.player;
    context.save();
    context.translate(m.x + p.x * sx, m.y + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(6, 0);
    context.lineTo(-4, -4);
    context.lineTo(-4, 4);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 2;
    context.strokeRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8);
    text('VICE HARBOR', m.x + m.w / 2, m.y - 10, 12, PALETTE.muted, 'center', 'alphabetic');
  }

  /** An arrow at the screen edge pointing at an off-screen target. */
  function drawEdgeArrow(w, target) {
    if (!target) return;
    const p = w.player.inCar ?? w.player;
    const { cx, cy } = view;
    const sx = target.x - cx;
    const sy = target.y - cy;
    if (sx > 40 && sx < VIEW.width - 40 && sy > 40 && sy < VIEW.height - 40) return;
    const ax = clamp(sx, 50, VIEW.width - 50);
    const ay = clamp(sy, 50, VIEW.height - 50);
    const angle = Math.atan2(sy - ay, sx - ax);
    context.save();
    context.translate(ax, ay);
    context.rotate(angle);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(14, 0);
    context.lineTo(-8, -9);
    context.lineTo(-8, 9);
    context.closePath();
    context.fill();
    context.restore();
  }

  // ------------------------------------------------------------ panels

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineH = 30;
    const height = 150 + lines.length * lineH;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    rect(x, y, width, height, PALETTE.panel);
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 64, 44, PALETTE.text, 'center', 'alphabetic');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 112 + i * lineH, 19, PALETTE.muted, 'center', 'alphabetic');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.marker, 'center', 'alphabetic');
  }

  function drawDialogue(ui) {
    const d = ui.dialogue;
    if (!d) return;
    const width = 860;
    const height = 168;
    const x = (VIEW.width - width) / 2;
    const y = VIEW.height - height - 24;
    rect(x, y, width, height, PALETTE.panel);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(d.who, x + 28, y + 36, 18, PALETTE.marker, 'left', 'alphabetic');
    // Wrap the line to the panel.
    const words = d.text.split(' ');
    const lines = [''];
    for (const word of words) {
      const last = lines[lines.length - 1];
      if ((last + ' ' + word).trim().length > 78) lines.push(word);
      else lines[lines.length - 1] = (last + ' ' + word).trim();
    }
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], x + 28, y + 72 + i * 28, 20, PALETTE.text, 'left', 'alphabetic');
    }
    text(`E / Enter — continue  (${d.index + 1}/${d.total})`, x + width - 28, y + height - 20, 15, PALETTE.muted, 'right', 'alphabetic');
  }

  function drawTitle(w, ui) {
    const { cx, cy } = view;
    // The city behind, dimmed.
    context.fillStyle = 'rgba(8,10,32,0.45)';
    context.fillRect(cx, cy, VIEW.width, VIEW.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    text('VICE HARBOR', VIEW.width / 2, 190, 84, '#ffd23f', 'center', 'alphabetic');
    text('An open-world crime story', VIEW.width / 2, 238, 26, PALETTE.text, 'center', 'alphabetic');
    const lines = [
      'WASD / arrows — move and drive    Shift — sprint    E — enter / exit a car',
      'Space — punch (handbrake in a car)    F / click — shoot    P — pause    M — mute',
      'Steal cars, lose the cops, run Mara’s jobs — and clear a $40,000 debt.',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, 300 + i * 32, 19, PALETTE.muted, 'center', 'alphabetic');
    }
    if (ui.saveExists) {
      text('Press Enter to start a new game, or C to continue your save', VIEW.width / 2, 440, 22, PALETTE.marker, 'center', 'alphabetic');
    } else {
      text('Press Enter or click to start', VIEW.width / 2, 440, 22, PALETTE.marker, 'center', 'alphabetic');
    }
    if (ui.best > 0) text(`Best fortune: $${ui.best.toLocaleString('en-US')}`, VIEW.width / 2, 486, 18, PALETTE.muted, 'center', 'alphabetic');
    text('A game of its own — no Rockstar names, art or music.', VIEW.width / 2, VIEW.height - 28, 15, PALETTE.muted, 'center', 'alphabetic');
  }

  /** Paint one frame: the world, the lighting, the HUD and the screen's panel. */
  function draw(w, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const { cx, cy } = camera(w);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - cx * view.scale, view.y - cy * view.scale);
    drawGround(w);
    drawRoads();
    drawBuildings(w);
    drawPickups(w);
    drawMarker(w, ui.target);
    drawActors(w);
    drawLighting(w);
    if (screen === SCREEN_TITLE) {
      drawTitle(w, ui);
      return;
    }
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawEdgeArrow(w, ui.target);
    drawHud(w, ui);
    if (screen === SCREEN_DIALOGUE) drawDialogue(ui);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for you.', 'S — save your game'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Harbor PD caught you.', ui.bustedLoss ?? ''], 'Press Enter to continue', '#2e7bff');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Vice Harbor is unforgiving.', ui.bustedLoss ?? ''], 'Press Enter to continue', '#ff2e2e');
    } else if (screen === SCREEN_STORY) {
      drawPanel('STORY COMPLETE', [`The debt is paid. Fortune: $${w.player.money.toLocaleString('en-US')}.`, 'Vice Harbor is yours now.'], 'Press Enter to keep playing');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld, view };
}
