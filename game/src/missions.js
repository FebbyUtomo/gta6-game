// The story: five jobs from Mara Voss, the fixer who owns Rook's debt. Each mission has a
// briefing (shown as a dialogue panel that pauses the game), an objective the HUD and the
// minimap point at, and a reward. The world asks this module for the current target and
// objective text, and calls update() every step so it can complete the job and start the next.
// Busted or wasted restarts the current job, never the whole story.

import { PACKAGE_SPOTS, PLACES } from './config.js';
import { createRival } from './actors.js';

const MISSIONS = [
  {
    id: 'start',
    title: 'A New Start',
    reward: 100,
    briefing: [
      { who: 'Mara Voss', text: "Rook. You owe me forty grand, and the Harbor doesn't forget a debt." },
      { who: 'Mara Voss', text: 'Work it off. Five jobs, and we are square. First one is easy: come to my office.' },
      { who: 'Rook', text: "On my way, Mara. Don't start the meter." },
    ],
    objective: 'Meet Mara at her office',
    complete: [{ who: 'Mara Voss', text: "Good. You can follow directions. Let's see if you can drive." }],
  },
  {
    id: 'wheels',
    title: 'Wheels',
    reward: 300,
    briefing: [
      { who: 'Mara Voss', text: "I need a car. Not bought — borrowed. Take one off the street and bring it to Spray & Go." },
      { who: 'Mara Voss', text: 'Walk up to a car and press E to get in. Drive it to the garage marker. Try not to scratch it. Much.' },
    ],
    objective: 'Steal a car and bring it to Spray & Go',
    complete: [{ who: 'Mara Voss', text: 'Clean. You drive like you mean it. Next job pays better.' }],
  },
  {
    id: 'errands',
    title: 'Errands',
    reward: 400,
    briefing: [
      { who: 'Mara Voss', text: 'Three packages are stashed around the city. Collect them all, then bring them to me.' },
      { who: 'Mara Voss', text: 'Yellow markers, Rook. Walk or drive, I do not care — just do not lose them.' },
    ],
    objective: 'Collect the packages',
    complete: [{ who: 'Mara Voss', text: 'All three. You are almost useful. One more kind of job, then the big one.' }],
  },
  {
    id: 'heat',
    title: 'Heat',
    reward: 500,
    briefing: [
      { who: 'Mara Voss', text: 'Bad news: the cops have your name. Two stars, and they are coming.' },
      { who: 'Mara Voss', text: 'Lose them — stay out of sight, stop making noise — then get to the safehouse. No shortcuts.' },
    ],
    objective: 'Lose the cops, then reach the safehouse',
    complete: [{ who: 'Mara Voss', text: 'Cool as ever. The heat is off. Now the job that clears your debt.' }],
  },
  {
    id: 'drop',
    title: 'The Drop',
    reward: 800,
    briefing: [
      { who: 'Mara Voss', text: 'Last job. A rival crew is holding my package at the docks. Take them down, grab it, bring it to me.' },
      { who: 'Mara Voss', text: 'They shoot back, Rook. Punch with Space, shoot with F — and do not die owing me money.' },
    ],
    objective: 'Clear the docks, take the package, deliver it to Mara',
    complete: [
      { who: 'Mara Voss', text: 'The package. The debt. Done. Forty grand, wiped clean.' },
      { who: 'Rook', text: 'Pleasure doing business, Mara. Vice Harbor is mine now.' },
    ],
  },
];

export function createMissions() {
  const state = {
    index: 0,
    phase: 'briefing', // briefing | active | story
    collected: 0,
    heatStage: 0, // 0 = lose the heat, 1 = reach the safehouse
    rivalsSpawned: false,
    rivalsDown: 0,
    packageTaken: false,
    dropPackageSpawned: false,
    dialogue: null,
  };

  function current() {
    return MISSIONS[state.index];
  }

  function startBriefing() {
    state.phase = 'briefing';
    state.dialogue = current().briefing.slice();
  }

  function dismissBriefing(w) {
    state.dialogue = null;
    state.phase = 'active';
    const m = current();
    if (m.id === 'errands') {
      state.collected = 0;
      for (const spot of PACKAGE_SPOTS) {
        w.pickups.push({ kind: 'package', x: spot.x, y: spot.y, amount: 0, bob: 0 });
      }
    }
    if (m.id === 'heat') {
      state.heatStage = 0;
      w.setHeat(50);
    }
    if (m.id === 'drop' && !state.rivalsSpawned) {
      state.rivalsSpawned = true;
      state.rivalsDown = 0;
      state.packageTaken = false;
      state.dropPackageSpawned = false;
      const spots = [
        { x: 1950, y: 1660 },
        { x: 2080, y: 1740 },
        { x: 1900, y: 1780 },
      ];
      for (const s of spots) w.rivals.push(createRival(s.x, s.y));
    }
  }

  function objectiveText() {
    const m = current();
    if (state.phase === 'story') return 'Story complete — Vice Harbor is yours. Free roam.';
    if (m.id === 'errands') return `Collect the packages (${state.collected}/3), then deliver them to Mara`;
    if (m.id === 'heat') return state.heatStage === 0 ? 'Lose the cops (wanted level must fall to 0)' : 'Reach the safehouse';
    if (m.id === 'drop') {
      if (!state.packageTaken) {
        const left = w_rivalsLeft();
        return left > 0 ? `Take out the rivals at the docks (${3 - left}/3 down)` : 'Grab the package at the docks';
      }
      return 'Deliver the package to Mara';
    }
    return m.objective;
  }

  function w_rivalsLeft() {
    return 3 - state.rivalsDown;
  }

  /** The marker the HUD, minimap and edge arrow point at, or null. */
  function target(w) {
    if (state.phase !== 'active') return null;
    const m = current();
    if (m.id === 'start') return { x: PLACES.maraOffice.x, y: PLACES.maraOffice.y, r: 46, label: "Mara's Office" };
    if (m.id === 'wheels') return { x: PLACES.garage.x, y: PLACES.garage.y, r: 60, label: 'Spray & Go' };
    if (m.id === 'errands') {
      if (state.collected < 3) {
        const remaining = w.pickups.filter((p) => p.kind === 'package');
        if (remaining.length > 0) {
          const first = remaining[0];
          return { x: first.x, y: first.y, r: 40, label: `Package (${state.collected + 1}/3)` };
        }
      }
      return { x: PLACES.maraOffice.x, y: PLACES.maraOffice.y, r: 46, label: "Deliver to Mara" };
    }
    if (m.id === 'heat') {
      if (state.heatStage === 0) return null;
      return { x: PLACES.safehouse.x, y: PLACES.safehouse.y, r: 46, label: 'Safehouse' };
    }
    if (m.id === 'drop') {
      if (!state.packageTaken) {
        const alive = w.rivals.filter((r) => r.health > 0);
        if (alive.length > 0) return { x: alive[0].x, y: alive[0].y, r: 60, label: 'Rivals at the docks' };
        return { x: PLACES.docks.x, y: PLACES.docks.y, r: 46, label: 'The package' };
      }
      return { x: PLACES.maraOffice.x, y: PLACES.maraOffice.y, r: 46, label: "Deliver to Mara" };
    }
    return null;
  }

  /** Called when the player picks up a package (errands) or the drop package. */
  function onPickup(w, pickup) {
    if (pickup.kind === 'package') {
      if (current().id === 'errands') {
        state.collected += 1;
        return true;
      }
      if (current().id === 'drop') {
        state.packageTaken = true;
        return true;
      }
    }
    return false;
  }

  /** Called when a rival is defeated. */
  function onRivalDown() {
    state.rivalsDown += 1;
  }

  /** Advance the story: returns 'complete' when a mission finishes, 'story' at the end. */
  function update(w) {
    if (state.phase !== 'active') return null;
    const m = current();
    const p = w.player;
    const t = target(w);
    if (m.id === 'start' && t !== null) {
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) return finish(w);
    }
    if (m.id === 'wheels' && p.inCar && t !== null) {
      if (Math.hypot(p.inCar.x - t.x, p.inCar.y - t.y) < t.r) return finish(w);
    }
    if (m.id === 'errands' && state.collected >= 3 && t !== null) {
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) return finish(w);
    }
    if (m.id === 'heat') {
      if (state.heatStage === 0 && w.heat <= 0) state.heatStage = 1;
      if (state.heatStage === 1 && t !== null && Math.hypot(p.x - t.x, p.y - t.y) < t.r) return finish(w);
    }
    if (m.id === 'drop') {
      if (!state.packageTaken && state.rivalsDown >= 3 && !state.dropPackageSpawned) {
        state.dropPackageSpawned = true;
        w.pickups.push({ kind: 'package', x: PLACES.docks.x, y: PLACES.docks.y, amount: 0, bob: 0 });
      }
      if (state.packageTaken && t !== null && Math.hypot(p.x - t.x, p.y - t.y) < t.r) return finish(w);
    }
    return null;
  }

  function finish(w) {
    const m = current();
    w.player.money += m.reward;
    w.banner = { text: `MISSION COMPLETE — ${m.title}  +$${m.reward}`, timer: 3.2 };
    w.audio.mission();
    state.dialogue = m.complete.slice();
    state.phase = 'briefing';
    if (state.index >= MISSIONS.length - 1) {
      state.phase = 'story';
      state.dialogue = m.complete.slice();
      return 'story';
    }
    state.index += 1;
    // The next mission's briefing replaces the complete lines after they are read.
    state.nextBriefing = true;
    return 'complete';
  }

  /** After the complete lines are read, show the next mission's briefing. */
  function afterDialogue(w) {
    if (state.phase === 'story') return;
    if (state.nextBriefing) {
      state.nextBriefing = false;
      startBriefing();
      return;
    }
    // The briefing that was just read belongs to the current mission; dismissing it starts it.
    if (state.phase === 'briefing' && state.dialogue === null) {
      dismissBriefing(w);
    }
  }

  /** Restart the current mission after busted/wasted: keep the index, reset its pieces. */
  function restart(w) {
    const m = current();
    state.phase = 'briefing';
    state.collected = 0;
    state.heatStage = 0;
    state.rivalsSpawned = false;
    state.rivalsDown = 0;
    state.packageTaken = false;
    state.dropPackageSpawned = false;
    w.pickups = w.pickups.filter((p) => p.kind !== 'package');
    w.rivals = [];
    if (m.id === 'heat') w.setHeat(0);
    startBriefing();
  }

  return {
    state,
    current,
    startBriefing,
    dismissBriefing,
    objectiveText,
    target,
    onPickup,
    onRivalDown,
    update,
    afterDialogue,
    restart,
    isStoryComplete() {
      return state.phase === 'story';
    },
  };
}
