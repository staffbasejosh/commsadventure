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
  //   D-pad left/right  -> moveLeft / moveRight (menus: left/right)
  //   D-pad up          -> up (menus) AND jump;  D-pad down -> down (crouch / menus)
  //   X                 -> jump AND confirm.  "X" is the left face button on an Xbox-style pad and the bottom (cross)
  //                        button on a PlayStation-style pad, so both are accepted; generic pads accept buttons 0-3.
  //   Start             -> pause
  const AXIS_DEAD = 0.5;
  function padSource() {
    const out = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const std = p.mapping === 'standard';
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
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
      const X = std ? b(0) || b(2) : b(0) || b(1) || b(2) || b(3);
      const start = b(9) || (!std && p.buttons.length <= 10 && b(7));
      if (L) out.moveLeft = true;
      if (R) out.moveRight = true;
      if (U) { out.up = true; out.jump = true; }
      if (D) out.down = true;
      if (X) { out.jump = true; out.confirm = true; }
      if (start) out.pause = true;
    }
    return out;
  }
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
    /** While set, raw keydown events (with e.key) are routed to fn (name entry). */
    setTextHandler(fn) { textHandler = fn; },
    /** Test hook: simulate a held action (used by the autopilot bot). */
    _force: {},
  };
  api.addSource(() => api._force);
  api.addSource(padSource);
  return api;
})();
