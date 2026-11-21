// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is there.
// The game moves between screens: title, play, paused, dialogue, busted, wasted and story.
// A save in localStorage keeps money, the mission, the position, health and ammo between
// visits; C on the title screen continues it.
//
// ?seed=N fixes the city's random pattern. ?shot=chase|drive|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, createInput } from './input.js';
import {
  SCREEN_BUSTED,
  SCREEN_DIALOGUE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_STORY,
  SCREEN_TITLE,
  SCREEN_WASTED,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = world.readBest();
  let saveData = world.load();
  let dialogueIndex = 0;
  let dialogueLines = null;
  let bustedLoss = '';
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  /** The UI the renderer needs this frame: objective, target, banner, dialogue, hints. */
  function buildUi() {
    const w = world.state;
    const missions = w.missions;
    const p = w.player;
    let hint = null;
    if (screen === SCREEN_PLAY) {
      if (!p.inCar) {
        const near = w.cars.some((c) => !c.exploded && Math.hypot(c.x - p.x, c.y - p.y) < 70);
        if (near) hint = 'E — enter the car';
        else hint = 'WASD — move    Space — punch    F — shoot    E — enter a car';
      } else {
        hint = 'W/S — drive    A/D — steer    Space — handbrake    E — get out';
      }
    }
    return {
      best,
      saveExists: saveData !== null,
      objective: screen === SCREEN_PLAY || screen === SCREEN_DIALOGUE ? missions.objectiveText() : null,
      missionTitle: screen === SCREEN_PLAY || screen === SCREEN_DIALOGUE ? missions.current().title : null,
      target: screen === SCREEN_PLAY ? missions.target(w) : null,
      banner: w.banner ? w.banner.text : null,
      dialogue: dialogueLines ? { who: dialogueLines[dialogueIndex].who, text: dialogueLines[dialogueIndex].text, index: dialogueIndex, total: dialogueLines.length } : null,
      hint,
      muted: world.state.audio.isMuted(),
      bustedLoss,
    };
  }

  /** Show a dialogue (briefing or mission-complete lines) as a modal panel. */
  function showDialogue(lines) {
    dialogueLines = lines;
    dialogueIndex = 0;
    screen = SCREEN_DIALOGUE;
  }

  function advanceDialogue() {
    if (!dialogueLines) return;
    dialogueIndex += 1;
    if (dialogueIndex < dialogueLines.length) return;
    dialogueLines = null;
    world.state.missions.afterDialogue(world.state);
    const missions = world.state.missions;
    if (missions.state.phase === 'story') {
      screen = SCREEN_STORY;
      announce('Story complete.');
      return;
    }
    if (missions.state.dialogue) {
      // The next briefing follows the complete lines.
      showDialogue(missions.state.dialogue);
      missions.state.dialogue = null;
      return;
    }
    screen = SCREEN_PLAY;
  }

  function startNewGame() {
    world.state.player.money = 0;
    world.state.player.health = 100;
    world.state.player.ammo = 24;
    world.state.player.x = 790;
    world.state.player.y = 1150;
    world.state.missions.state.index = 0;
    world.state.missions.startBriefing();
    showDialogue(world.state.missions.state.dialogue);
    world.state.missions.state.dialogue = null;
    world.state.audio.unlock();
    announce('Vice Harbor. Meet Mara at her office.');
  }

  function continueGame() {
    if (!saveData) return;
    world.applySave(saveData);
    saveData = world.load();
    showDialogue(world.state.missions.state.dialogue);
    world.state.missions.state.dialogue = null;
    world.state.audio.unlock();
    announce('Welcome back to Vice Harbor.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startNewGame();
      return;
    }
    if (screen === SCREEN_DIALOGUE) {
      if (actions & (ACTION_CONFIRM | ACTION_ENTER)) advanceDialogue();
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        const missions = world.state.missions;
        if (missions.state.dialogue) {
          showDialogue(missions.state.dialogue);
          missions.state.dialogue = null;
        } else {
          screen = SCREEN_PLAY;
        }
      }
      return;
    }
    if (screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = SCREEN_PLAY;
      return;
    }
    // Play: pause, and the C key is not an action here (continue lives on the title screen).
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused.');
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const aim = renderer.toWorld(input.mouse().x, input.mouse().y);
    world.step(STEP, input, aim);
    const events = world.state.events;
    if (events.busted) {
      bustedLoss = 'You lost $200 and woke up at Harbor PD.';
      screen = SCREEN_BUSTED;
      announce('Busted.');
    } else if (events.wasted) {
      bustedLoss = 'You lost $150 and woke up at Harbor General.';
      screen = SCREEN_WASTED;
      announce('Wasted.');
    } else if (events.mission === 'story' || events.mission === 'complete') {
      // The mission's complete lines show first; the story screen follows the last one.
      const missions = world.state.missions;
      if (missions.state.dialogue) {
        showDialogue(missions.state.dialogue);
        missions.state.dialogue = null;
      } else if (events.mission === 'story') {
        screen = SCREEN_STORY;
        announce('Story complete.');
      }
    }
    // A fresh briefing (after a mission completes) also arrives as a dialogue.
    if (screen === SCREEN_PLAY && world.state.missions.state.dialogue && world.state.missions.state.phase === 'briefing') {
      showDialogue(world.state.missions.state.dialogue);
      world.state.missions.state.dialogue = null;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, buildUi());
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused.');
    }
  });

  // C continues a save from the title screen (Enter starts a new game).
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && saveData && event.code === 'KeyC') continueGame();
  });

  announce('Vice Harbor. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
