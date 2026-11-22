'use strict';
/* ==========================================================================
   input.js - the ONLY place that knows about physical input devices.
   Game logic asks for abstract actions:
     moveLeft, moveRight, jump, up, down, pause, confirm, mute
   Query with Input.down(a), Input.pressed(a), Input.released(a).

   Gamepads are just another source (see padSource below): D-pad = move / menu navigation (Up also jumps),
   X = jump / confirm, Start = pause. No game code needs to know a controller is attached.
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


  // ---- USB / Bluetooth gamepad (Gamepad API). Works with "standard" pads and with generic ones that report the
  // D-pad as buttons 12-15, as a hat switch on axis 9, or as digital axes 0/1.
  //   D-pad left/right  -> moveLeft / moveRight (menus: left/right)       (fixed)
  //   D-pad up          -> up (menus) AND jump;  D-pad down -> down        (fixed)
  //   jump / select / pause buttons are configurable (Controller setup screen); defaults:
  //     jump + select: "X" - the left face button on an Xbox-style pad, the bottom (cross) button on a PlayStation-style
  //                    pad, so both are accepted; generic pads accept buttons 0-3.   pause: Start
  const AXIS_DEAD = 0.5, PAD_KEY = 'messageRun.padMap', PAD_ACTIONS = ['jump', 'confirm', 'back', 'pause'];
  let padMap = {};      // action -> button index chosen by the player (absent = default)
  try { const m = JSON.parse(localStorage.getItem(PAD_KEY) || '{}'); for (const a of PAD_ACTIONS) if (Number.isInteger(m[a]) && m[a] >= 0 && m[a] < 64) padMap[a] = m[a]; } catch (e) { /* private mode / bad data */ }
  const savePadMap = () => { try { localStorage.setItem(PAD_KEY, JSON.stringify(padMap)); } catch (e) { /* private mode */ } };
  let captureCb = null, capturePrev = new Set();
  const connectedPad = () => { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of l) if (p && p.connected) return p; return null; };
  const defaultButtons = (action, std, nb) => action === 'pause' ? (std || nb > 10 ? [9] : [9, 7]) : action === 'back' ? [3] : (std ? [0, 2] : [0, 1, 2]);
  // A button the player has chosen for one action is never also a default for another (so Y can be "back" without also jumping).
  const buttonsFor = (action, std, nb) => {
    if (padMap[action] !== undefined) return [padMap[action]];
    const taken = Object.values(padMap);
    return defaultButtons(action, std, nb).filter(i => !taken.includes(i));
  };
  let lastBtn = null, padPrev = new Set();       // most recent button pressed on any pad (shown on the setup screen)
  function padSource() {
    const out = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const std = p.mapping === 'standard';
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      for (let i = 0; i < p.buttons.length; i++) { const on = b(i); if (on && !padPrev.has(i)) lastBtn = i; if (on) padPrev.add(i); else padPrev.delete(i); }
      if (captureCb) {                                   // "press the button you want to use": swallow all pad input meanwhile
        const dpadBtns = p.buttons.length > 15 ? [12, 13, 14, 15] : [];
        for (let i = 0; i < p.buttons.length; i++) {
          if (!b(i)) { capturePrev.delete(i); continue; }
          if (capturePrev.has(i) || dpadBtns.includes(i)) continue;
          const cb = captureCb; captureCb = null; cb(i); return out;
        }
        continue;
      }
      let U = false, D = false, L = false, R = false;
      if (p.buttons.length > 15) { U = b(12); D = b(13); L = b(14); R = b(15); }
      if (!std) {
        const hat = p.axes[9];                                  // hat switch: -1 up, then clockwise in steps of 2/7; ~1.29 = centred
        if (hat !== undefined && Math.abs(hat) <= 1.01) {
          const i = Math.round((hat + 1) * 3.5);                // 0 up, 1 up-right, 2 right, 3 down-right, 4 down, 5 down-left, 6 left, 7 up-left
          if (i === 0 || i === 1 || i === 7) U = true;
          if (i >= 1 && i <= 3) R = true;
          if (i >= 3 && i <= 5) D = true;
          if (i >= 5 && i <= 7) L = true;
        }
        if (p.axes[0] < -AXIS_DEAD) L = true; if (p.axes[0] > AXIS_DEAD) R = true;   // D-pad reported as axes 0 / 1
        if (p.axes[1] < -AXIS_DEAD) U = true; if (p.axes[1] > AXIS_DEAD) D = true;
      }
      const nb = p.buttons.length;
      if (L) out.moveLeft = true;
      if (R) out.moveRight = true;
      if (U) { out.up = true; out.jump = true; }
      if (D) out.down = true;
      if (buttonsFor('jump', std, nb).some(b)) out.jump = true;
      if (buttonsFor('confirm', std, nb).some(b)) out.confirm = true;
      if (buttonsFor('pause', std, nb).some(b)) out.pause = true;
      if (api.menuMode && buttonsFor('back', std, nb).some(b)) out.pause = true;   // in menus 'back' is the same as pause / Esc
    }
    return out;
  }
  const STD_NAMES = ['A / Cross', 'B / Circle', 'X / Square', 'Y / Triangle', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L-stick', 'R-stick'];
  const padApi = {
    /** Chosen button index for an action, or null while it uses the default. */
    chosen: a => padMap[a] !== undefined ? padMap[a] : null,
    /** Readable name of the button(s) an action uses right now ("Button 3", or the defaults). */
    label(a) {
      const p = connectedPad(), std = !!p && p.mapping === 'standard';
      if (padMap[a] !== undefined) return 'Button ' + padMap[a] + (std && STD_NAMES[padMap[a]] ? ' (' + STD_NAMES[padMap[a]] + ')' : '');
      return a === 'pause' ? 'Start (default)' : a === 'back' ? 'Y / Triangle (default)' : 'X (default)';
    },
    set(a, i) { padMap[a] = i; savePadMap(); },
    reset() { padMap = {}; savePadMap(); },
    connected: () => !!connectedPad(),
    name: () => { const p = connectedPad(); return p ? p.id : ''; },
    /** Wait for the next button press on any controller and hand its index to cb (the held buttons are ignored). */
    capture(cb) {
      capturePrev = new Set();
      const p = connectedPad(); if (p) for (let i = 0; i < p.buttons.length; i++) if (p.buttons[i] && p.buttons[i].pressed) capturePrev.add(i);
      captureCb = cb;
    },
    cancelCapture() { captureCb = null; },
    capturing: () => !!captureCb,
    lastPressed: () => lastBtn,
  };
  window.addEventListener('gamepadconnected', e => console.info('Controller connected:', e.gamepad.id, '(mapping: ' + (e.gamepad.mapping || 'non-standard') + ')'));

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
    /** Gamepad button mapping (Controller setup screen). */
    pad: null,
    /** Set by the game each step: true on every screen except live gameplay (the pad 'back' button only works there). */
    menuMode: false,
    /** While set, raw keydown events (with e.key) are routed to fn (name entry). */
    setTextHandler(fn) { textHandler = fn; },
    /** Test hook: simulate a held action (used by the autopilot bot). */
    _force: {},
  };
  api.addSource(() => api._force);
  api.addSource(padSource);
  api.pad = padApi;
  return api;
})();
