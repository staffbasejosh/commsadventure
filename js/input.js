'use strict';
/* ==========================================================================
   input.js - the ONLY place that knows about physical input devices.
   Game logic asks for abstract actions:
     moveLeft, moveRight, jump, up, down, pause, confirm, mute
   Query with Input.down(a), Input.pressed(a), Input.released(a).

   Adding a gamepad later: register a source that returns the set of actions
   currently held, e.g.
     Input.addSource(() => ({ moveLeft: pad.axes[0] < -0.4, jump: pad.buttons[0].pressed }));
   No game code needs to change.
   ========================================================================== */
const Input = (() => {
  const ACTIONS = ['moveLeft', 'moveRight', 'jump', 'up', 'down', 'pause', 'confirm', 'mute'];
  const KEYMAP = {
    moveLeft: ['ArrowLeft'],
    moveRight: ['ArrowRight'],
    jump: ['ArrowUp', 'Space'],
    up: ['ArrowUp'],              // menu navigation
    down: ['ArrowDown'],
    pause: ['KeyP', 'Escape'],
    confirm: ['Enter', 'NumpadEnter'],
    mute: ['KeyM'],
  };
  const codeToActions = {};
  for (const a of ACTIONS) for (const c of KEYMAP[a]) (codeToActions[c] = codeToActions[c] || []).push(a);

  const held = {};     // action -> set of physical keys holding it
  const latchDown = {}, latchUp = {};
  const cur = {}, prev = {};
  const sources = [];
  let textHandler = null;
  ACTIONS.forEach(a => { held[a] = new Set(); cur[a] = prev[a] = false; });

  const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Escape']);

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (BLOCK.has(e.code)) e.preventDefault();
    const acts = codeToActions[e.code];
    if (acts && !e.repeat) {
      for (const a of acts) { held[a].add(e.code); latchDown[a] = true; }
    }
    if (textHandler) { e.preventDefault(); textHandler(e); }
  });
  window.addEventListener('keyup', e => {
    const acts = codeToActions[e.code];
    if (acts) for (const a of acts) { held[a].delete(e.code); latchUp[a] = true; }
  });
  window.addEventListener('blur', () => { for (const a of ACTIONS) held[a].clear(); });

  const api = {
    ACTIONS,
    /** Call once at the start of every fixed update step. */
    poll() {
      const ext = {};
      for (const s of sources) { const r = s() || {}; for (const a in r) if (r[a]) ext[a] = true; }
      for (const a of ACTIONS) { prev[a] = cur[a]; cur[a] = held[a].size > 0 || !!ext[a]; }
    },
    /** Call once at the end of every fixed update step to clear edge latches. */
    endStep() { for (const a of ACTIONS) { latchDown[a] = false; latchUp[a] = false; } },
    down: a => cur[a],
    pressed: a => !!latchDown[a] || (cur[a] && !prev[a]),
    released: a => !!latchUp[a] || (!cur[a] && prev[a]),
    addSource(fn) { sources.push(fn); },
    /** While set, raw keydown events (with e.key) are routed to fn (name entry). */
    setTextHandler(fn) { textHandler = fn; },
    /** Test hook: simulate a held action (used by the autopilot bot). */
    _force: {},
  };
  api.addSource(() => api._force);
  return api;
})();
