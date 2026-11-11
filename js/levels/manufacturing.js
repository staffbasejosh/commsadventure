'use strict';
/* ==========================================================================
   levels/manufacturing.js - Level 2: Manufacturing.

   Same engine, new theme: a factory floor with crates, boxes, shelving,
   conveyors and forklifts. The goal is the Foreman (hard hat, hi-vis vest).
   The route mirrors Healthcare's proportions (224 x 17 tiles, same pit and
   barrier spacing) so the CEO chase, jump arcs and difficulty tuning carry over.

   MAP LEGEND (one character = one 16x16 tile; map is 17 rows high)
     .  empty                 #  concrete floor          X  solid wall block
     B  wooden crate (breakable with Push Notification)   D  steel girder (solid)
     V  shelving unit (solid, 2x2)    L  stack of boxes (solid, 2 high)
     -  one-way platform (conveyor / scaffold / rack beam; Down drops through)
     ?  engagement block (coins)  P  block -> Clear Subject Line (speed)
     E  block -> Executive Sponsor (invincible)   T  block -> Translation Tool (double jump)
     K  block -> Push Notification (breaks crates)
     h  shutter switch block (bump from below)    l  pallet-stack switch block
     c  engagement coin           w  caution sign (slippery)   o  oil puddle (slippery)
     S  player start      1 2 3  "Supervisor sign-off" checkpoints      N  the Foreman (goal)
   Gaps in the floor rows are open floor hatches.
   ========================================================================== */
(function () {
  const COLS = 32;
  const row = s => s.replace(/ /g, '');
  // A section is 12 rows (map rows 5..16); 5 blank rows are added on top.
  // Coordinates in the data below (entities, barriers, switches) use GLOBAL map rows 0..16.
  function sec(...rows) {
    const blank = '.'.repeat(COLS), out = [];
    for (let i = 0; i < 5; i++) out.push(blank);
    rows.forEach(r => out.push(row(r)));
    return out;
  }
  const E8 = '........ ........ ........ ........';

  const sections = [
    // 0 ---------------------------------------------------------------- LOADING DOCK (cols 0-31)
    sec(E8, E8, E8, E8, E8, E8,
      '........ .?.?.?.. ........ ........',
      '........ ........ ........ ........',
      '........ ........ ....ccc. ........',
      '...S.ccc ........ w....... .....1..',
      '######## ######## ####...# ########',
      '######## ######## ####...# ########'),
    // 1 ---------------------------------------------------------------- WAREHOUSE A (32-63)
    sec(E8, E8, E8, E8, E8, E8,
      '.??..... ........ ........ ........',
      '........ .-----.P ........ ........',
      '......VV ........ ........ ....ccc.',
      '......VV ..c.c.c. ........ w.......',
      '######## ######## ######## ####...#',
      '######## ######## ######## ####...#'),
    // 2 ---------------------------------------------------------------- WAREHOUSE B (64-95)
    sec('DDDDDDDD ........ ........ ........', E8, E8, E8, E8, E8,
      '....h... ...cccc. .cc..... .l......',
      '........ ..------ ---..... ........',
      '........ ........ ........ ....ccc.',
      '........ ........ ....o... ........',
      '######## ######## ######## ####...#',
      '######## ######## ######## ####...#'),
    // 3 ---------------------------------------------------------------- ASSEMBLY LINE (96-127)
    sec(E8, E8, E8, E8,
      '........ ........ ..cccc.. ........',
      '........ ........ ..----B? B?B.....',
      '........ ...?.?.. ........ ........',
      '.K..T... ......-- -----... ........',
      '........ .VV..... ........ .....ccc',
      '..2..... .VV..... ...w.... ........',
      '######## ######## ######## #####...',
      '######## ######## ######## #####...'),
    // 4 ---------------------------------------------------------------- MACHINE SHOP (128-159)
    sec('DDDDDDDD ........ ........ ........', E8, E8, E8, E8, E8,
      '........ ........ ........ h.......',
      '........ ..cc.... .----... ........',
      '........ ..VV.... ........ ...ccc..',
      '.....o.. ..VV.... ........ ........',
      '######## ######## ######## ###...##',
      '######## ######## ######## ###...##'),
    // 5 ---------------------------------------------------------------- PACKING FLOOR (160-191)
    sec(E8, E8, E8, E8,
      '........ ..cccc.. ........ ........',
      '........ ..----.. B?B?B... ........',
      '........ ........ ........ .....l..',
      '........ -------- ........ ........',
      '........ ........ .....ccc ..LL....',
      '...3.... ........ ...w.... ..LL....',
      '######## #####... #####... ########',
      '######## #####... #####... ########'),
    // 6 ---------------------------------------------------------------- FOREMAN'S OFFICE (192-223)
    sec('DDDDDDDD DDDD.... ........ ........', E8, E8, E8, E8, E8,
      '........ ........ ........ ........',
      '....?E?. ........ ..-----. ........',
      '........ .....ccc ........ ........',
      '........ ........ ....w... ..N.....',
      '######## #####... ######## ########',
      '######## #####... ######## ########'),
  ];
  const map = [];
  for (let r = 0; r < 17; r++) map.push(sections.map(s => s[r]).join(''));

  // ------------------------------------------------------------------ art
  let S = null; // sprite cache
  function mk(w, h, fn) {
    const { c, x } = Gfx.canvas(w, h);
    fn(x, (col, rx, ry, rw, rh) => { x.fillStyle = col; x.fillRect(rx, ry, rw, rh); });
    return c;
  }
  const ST = { wall: '#c9ced2', accent: '#8d99a3' };

  function buildSprites() {
    S = {};
    // concrete floor with a yellow safety line on one variant
    S.floorTop = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#a3acb2' : '#aab3b9', 0, 0, 16, 16); R('#d3dadd', 0, 0, 16, 1); R('#bcc5ca', 0, 1, 16, 1);
      R('#6f7a82', 0, 2, 16, 1); R('#8f9aa1', 0, 0, 1, 16); R('#c2cacf', 3, 6, 4, 1); R('#8d979e', 9, 10, 5, 1);
      if (v) { R('#f2b705', 0, 4, 16, 2); R('#b38600', 0, 6, 16, 1); }
    }));
    S.floorBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#7d878e' : '#868f96', 0, 0, 16, 16); R('#68727a', 0, 0, 1, 16); R('#68727a', 0, 15, 16, 1);
      R('#95a0a7', 4, 4, 3, 1); R('#727c83', 9, 9, 4, 1); R('#5b656c', 2, 2, 2, 2); R('#5b656c', 12, 12, 2, 2);
    }));
    S.crate = mk(16, 16, (x, R) => { // wooden crate with cross braces
      R('#5a3a1a', 0, 0, 16, 16); R('#b9854a', 1, 1, 14, 14); R('#d19a5b', 1, 1, 14, 2);
      R('#8a5a2b', 1, 7, 14, 2); R('#8a5a2b', 7, 1, 2, 14);
      for (let i = 0; i < 12; i++) { R('#8a5a2b', 2 + i, 2 + i, 1, 1); R('#8a5a2b', 13 - i, 2 + i, 1, 1); }
      R('#5a3a1a', 2, 2, 1, 1); R('#5a3a1a', 13, 2, 1, 1); R('#5a3a1a', 2, 13, 1, 1); R('#5a3a1a', 13, 13, 1, 1);
      R('#e8e0c8', 10, 3, 4, 3); R('#c0392b', 11, 4, 2, 1);
    });
    const qb = (fill, edge, hi) => mk(16, 16, (x, R) => {
      R('#4a3200', 0, 0, 16, 16); R(edge, 1, 1, 14, 14); R(fill, 2, 2, 12, 12); R(hi, 2, 2, 12, 2);
      R('#4a3200', 2, 2, 1, 1); R('#4a3200', 13, 2, 1, 1); R('#4a3200', 2, 13, 1, 1); R('#4a3200', 13, 13, 1, 1);
      Gfx.text(x, '?', 6, 4, { scale: 2, color: '#ffffff', shadow: '#4a3200' });
    });
    S.q = [qb('#f59e0b', '#fcd34d', '#fbbf24'), qb('#fbbf24', '#fde68a', '#fcd34d')];
    S.used = mk(16, 16, (x, R) => { R('#4b555c', 0, 0, 16, 16); R('#7b868d', 1, 1, 14, 14); R('#96a1a8', 2, 2, 12, 12); R('#6b767d', 4, 6, 8, 4); });
    S.duct = mk(16, 16, (x, R) => { // steel girder
      R('#2f3a44', 0, 0, 16, 16); R('#52606c', 0, 1, 16, 3); R('#7b8a97', 0, 1, 16, 1); R('#52606c', 0, 12, 16, 3);
      R('#3d4953', 6, 4, 4, 8); R('#9aa8b3', 2, 2, 1, 1); R('#9aa8b3', 13, 2, 1, 1); R('#9aa8b3', 2, 13, 1, 1); R('#9aa8b3', 13, 13, 1, 1);
      R('#f2b705', 0, 15, 4, 1); R('#1a1a1a', 4, 15, 4, 1); R('#f2b705', 8, 15, 4, 1); R('#1a1a1a', 12, 15, 4, 1);
    });
    // shelving unit 2x2: tl, tr, bl, br (orange uprights, steel shelves, cardboard boxes)
    const shelf = (right, bottom) => mk(16, 16, (x, R) => {
      const up = '#e8742a', upD = '#b85418';
      if (!bottom) { R('#cfd6db', right ? 0 : 1, 0, 15, 1); }
      // shelf boards
      R('#9aa7b0', 0, 7, 16, 2); R('#cfd6db', 0, 7, 16, 1); R('#9aa7b0', 0, bottom ? 14 : 15, 16, bottom ? 2 : 1);
      // boxes
      const bx = right ? [1, 8] : [2, 9];
      bx.forEach((b, i) => {
        R(i ? '#d9a66b' : '#c89b64', b, 2, 6, 5); R('#e8c28f', b, 2, 6, 1); R('#a87a45', b + 2, 2, 1, 5);
        R(i ? '#e8e0c8' : '#c89b64', b, 10, 6, 4); R('#a87a45', b, 10, 6, 1); R('#8a5a2b', b + 3, 10, 1, 4);
      });
      // uprights
      if (!right) { R(up, 0, 0, 2, 16); R(upD, 1, 0, 1, 16); } else { R(up, 14, 0, 2, 16); R(upD, 14, 0, 1, 16); }
      if (bottom) { if (!right) R('#37474f', 0, 15, 3, 1); else R('#37474f', 13, 15, 3, 1); }
    });
    S.vend = { tl: shelf(0, 0), tr: shelf(1, 0), bl: shelf(0, 1), br: shelf(1, 1) };
    // stacked boxes on a pallet (L tiles and the "pallet" CEO barrier)
    S.linenTop = mk(16, 16, (x, R) => {
      R('#c89b64', 0, 3, 16, 13); R('#e8c28f', 0, 3, 16, 2); R('#a87a45', 7, 3, 2, 13); R('#a87a45', 0, 10, 16, 1);
      R('#d9a66b', 1, 5, 6, 5); R('#d9a66b', 9, 5, 6, 5); R('#e8e0c8', 2, 11, 5, 3); R('#c0392b', 3, 12, 3, 1);
      R('#a87a45', 0, 3, 1, 13); R('#a87a45', 15, 3, 1, 13);
    });
    S.linenBottom = mk(16, 16, (x, R) => {
      R('#c89b64', 0, 0, 16, 10); R('#a87a45', 7, 0, 2, 10); R('#e8c28f', 1, 1, 5, 3); R('#e8c28f', 10, 1, 5, 3); R('#a87a45', 0, 5, 16, 1);
      R('#b9854a', 0, 10, 16, 2); R('#8a5a2b', 0, 12, 16, 1); R('#b9854a', 0, 13, 4, 3); R('#b9854a', 6, 13, 4, 3); R('#b9854a', 12, 13, 4, 3);
    });
    const sw = (used, icon) => mk(16, 16, (x, R) => {
      R('#2f3a44', 0, 0, 16, 16); R('#7b8a97', 1, 1, 14, 14); R('#cfd6db', 1, 1, 14, 2);
      R('#1b232b', 3, 4, 10, 8);
      R(used ? '#34c768' : '#e03131', 4, 5, 8, 6); R(used ? '#8ff0b3' : '#ff8f87', 4, 5, 8, 2);
      if (icon === 'door') { R('#ffffff', 5, 7, 6, 1); R('#ffffff', 5, 9, 6, 1); } else { R('#ffffff', 5, 7, 6, 3); R('#a87a45', 7, 7, 2, 3); }
    });
    S.sw = { h: sw(false, 'door'), l: sw(false, 'cart'), hu: sw(true, 'door'), lu: sw(true, 'cart') };
    // one-way platforms: 0 conveyor belt, 1 steel scaffold grate, 2 pallet-rack beam
    S.plat = [0, 1, 2].map(style => [0, 1, 2, 3].map(pos => mk(16, 16, (x, R) => {
      const L = pos === 0 || pos === 3, Rr = pos === 2 || pos === 3;
      if (style === 0) { // conveyor
        R('#2b3238', 0, 0, 16, 5); R('#4a545c', 0, 0, 16, 1); R('#f2b705', 2, 2, 3, 1); R('#f2b705', 8, 2, 3, 1); R('#f2b705', 10, 1, 1, 3);
        R('#6b767d', 0, 5, 16, 2); R('#9aa7b0', 0, 5, 16, 1);
        if (L) { R('#2b3238', 0, 0, 3, 7); Gfx.disc(x, 3, 8, 3, '#9aa7b0'); Gfx.disc(x, 3, 8, 1, '#37474f'); R('#6b767d', 2, 9, 2, 6); R('#37474f', 0, 14, 6, 2); }
        if (Rr) { R('#2b3238', 13, 0, 3, 7); Gfx.disc(x, 12, 8, 3, '#9aa7b0'); Gfx.disc(x, 12, 8, 1, '#37474f'); R('#6b767d', 12, 9, 2, 6); R('#37474f', 10, 14, 6, 2); }
      } else if (style === 1) { // steel grate
        R('#9aa7b0', 0, 0, 16, 2); R('#d3dadd', 0, 0, 16, 1); R('#4a545c', 0, 2, 16, 4);
        for (let i = 0; i < 16; i += 4) R('#2b3238', i + 1, 3, 2, 2);
        R('#f2b705', 0, 6, 4, 1); R('#1a1a1a', 4, 6, 4, 1); R('#f2b705', 8, 6, 4, 1); R('#1a1a1a', 12, 6, 4, 1);
        if (L) { R('#52606c', 1, 7, 2, 8); R('#37474f', 0, 14, 4, 2); }
        if (Rr) { R('#52606c', 13, 7, 2, 8); R('#37474f', 12, 14, 4, 2); }
      } else { // pallet rack beam (orange) holding a box
        R('#e8742a', 0, 2, 16, 3); R('#f59a5b', 0, 2, 16, 1); R('#b85418', 0, 5, 16, 1);
        if (!L && !Rr) { R('#d9a66b', 3, -2, 7, 4); R('#a87a45', 6, -2, 1, 4); R('#e8c28f', 3, -2, 7, 1); }
        if (L) { R('#e8742a', 0, 0, 3, 16); R('#b85418', 2, 0, 1, 16); }
        if (Rr) { R('#e8742a', 13, 0, 3, 16); R('#b85418', 13, 0, 1, 16); }
      }
    })));
    S.wet = mk(16, 16, (x, R) => { // caution sign
      for (let i = 0; i < 13; i++) { const w = 3 + Math.floor(i * 0.7); R('#ffd23f', 8 - Math.floor(w / 2), 2 + i, w, 1); }
      R('#c99a00', 6, 14, 5, 1); R('#1a1a1a', 7, 5, 2, 4); R('#1a1a1a', 7, 10, 2, 2); R('#ffe680', 5, 14, 1, 1);
    });
    S.puddle = mk(16, 16, (x, R) => { // oil spill with a rainbow sheen + dripping can
      R('#14161a', 1, 13, 14, 3); R('#23272e', 3, 12, 10, 1); R('#0b0c0f', 5, 14, 6, 1);
      R('#5b8cff', 4, 13, 2, 1); R('#c06bff', 7, 14, 2, 1); R('#4de0a8', 10, 13, 2, 1);
      R('#cfd6db', 11, 6, 4, 6); R('#9aa7b0', 11, 11, 4, 1); R('#e03131', 12, 8, 2, 2); R('#14161a', 15, 7, 1, 2);
    });
    S.coin = [0, 1, 2, 3].map(f => mk(10, 10, (x, R) => {
      const w = [8, 6, 2, 6][f], ox = 5 - w / 2;
      R('#b8860b', ox, 1, w, 8); R('#f6c945', ox + 1, 1, Math.max(1, w - 2), 8); R('#b8860b', ox + 1, 0, Math.max(1, w - 2), 1); R('#b8860b', ox + 1, 9, Math.max(1, w - 2), 1);
      if (w > 4) { R('#fff3b0', ox + 2, 2, 1, 5); R('#b8860b', ox + 3, 4, w - 5, 2); }
    }));
    S.cp = [false, true].map(on => mk(16, 28, (x, R) => { // sign-off board: hard hat (pending) / green tick (done)
      R('#78909c', 7, 6, 2, 22); R('#37474f', 4, 26, 8, 2);
      R('#37474f', 0, 0, 16, 14); R(on ? '#bff0cf' : '#ffffff', 1, 1, 14, 12);
      R(on ? '#41c47b' : '#f2b705', 1, 1, 14, 3);
      if (on) { R('#1d8a4a', 3, 7, 2, 2); R('#1d8a4a', 5, 8, 2, 2); R('#1d8a4a', 7, 6, 2, 3); R('#1d8a4a', 9, 4, 2, 3); R('#1d8a4a', 11, 3, 2, 3); }
      else { R('#f2b705', 4, 6, 8, 4); R('#f2b705', 5, 5, 6, 1); R('#b38600', 3, 10, 10, 1); R('#fff3b0', 6, 6, 2, 1); }
    }));
    const pu = (kind) => mk(12, 12, (x, R) => {
      R('#ffffff', 0, 0, 12, 12); R('#0d3f3b', 1, 1, 10, 10);
      if (kind === 'speed') { R('#f1c232', 1, 1, 10, 10); R('#102830', 6, 2, 3, 1); R('#102830', 5, 3, 3, 2); R('#102830', 4, 5, 4, 1); R('#102830', 5, 6, 3, 2); R('#102830', 3, 8, 3, 2); }
      if (kind === 'sponsor') { R('#ff7ac8', 1, 1, 10, 10); R('#fff3b0', 5, 2, 2, 8); R('#fff3b0', 2, 5, 8, 2); R('#fff3b0', 3, 3, 6, 6); R('#ff7ac8', 4, 4, 4, 4); R('#fff3b0', 5, 5, 2, 2); }
      if (kind === 'djump') { R('#5db7ff', 1, 1, 10, 10); R('#ffffff', 2, 2, 5, 4); R('#ffffff', 5, 6, 5, 4); R('#1d6fb8', 3, 3, 3, 1); R('#1d6fb8', 6, 7, 3, 1); R('#1d6fb8', 4, 9, 1, 1); }
      if (kind === 'push') { R('#ff8a4c', 1, 1, 10, 10); R('#ffffff', 3, 3, 6, 5); R('#ffffff', 2, 7, 8, 1); R('#ffffff', 5, 8, 2, 2); R('#e8453c', 8, 1, 3, 3); }
    });
    S.pu = { speed: pu('speed'), sponsor: pu('sponsor'), djump: pu('djump'), push: pu('push') };
  }

  // ---- background decor drawers (layer coordinates, x = left, y = top)
  const D = {
    skylight(c, x, y) { // high factory window with a sky view
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#4a545c', 0, 0, 56, 50); R('#8dc6e8', 3, 3, 50, 44); R('#bfe2f5', 3, 3, 50, 14);
      R('#4a545c', 17, 3, 2, 44); R('#4a545c', 37, 3, 2, 44); R('#4a545c', 3, 24, 50, 2);
      R('#7bb3d6', 5, 28, 10, 18); R('#6aa3c8', 21, 32, 12, 14); R('#7bb3d6', 41, 30, 10, 16); // distant stacks
      R('#ffffff', 8, 7, 8, 3); R('#ffffff', 11, 5, 5, 2); R('#ffffff', 40, 9, 10, 3);
    },
    column(c, x, y) { // steel support column with hazard stripes
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#4a545c', 0, 0, 16, 150); R('#7b8a97', 2, 0, 3, 150); R('#2f3a44', 12, 0, 4, 150); R('#9aa8b3', 0, 0, 16, 3);
      for (let i = 0; i < 150; i += 8) R('#c3ccd2', 6, i + 4, 4, 1);
      for (let i = 0; i < 40; i += 8) { R('#f2b705', 0, 110 + i, 16, 4); R('#1a1a1a', 0, 114 + i, 16, 4); }
    },
    tank(c, x, y) { // storage tank with pipes
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#8a97a1', 0, 8, 44, 70); R('#aab6bf', 2, 8, 10, 70); R('#6b7882', 32, 8, 12, 70); R('#8a97a1', 4, 2, 36, 7); R('#aab6bf', 6, 2, 12, 6);
      R('#37474f', 0, 30, 44, 3); R('#37474f', 0, 56, 44, 3);
      R('#e8742a', 18, -14, 8, 16); R('#e8742a', 18, -14, 24, 5); R('#b85418', 40, -14, 4, 12);
      R('#f2b705', 14, 40, 16, 12); R('#1a1a1a', 16, 42, 12, 8); R('#f2b705', 20, 43, 4, 6);
      R('#4a545c', 6, 78, 6, 8); R('#4a545c', 32, 78, 6, 8);
    },
    arm(c, x, y, t) { // robot arm that gently moves
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      const sw = Math.round(Math.sin(t * 1.4) * 6);
      R('#37474f', 0, 70, 40, 8); R('#e8742a', 14, 50, 12, 20); R('#f59a5b', 14, 50, 4, 20);
      R('#e8742a', 14 + sw, 30, 8, 22); R('#e8742a', 14 + sw, 28, 30 - sw / 2, 7); R('#b85418', 40 + sw, 24, 4, 20);
      Gfx.disc(c, x + 18 + sw, y + 50, 4, '#37474f'); Gfx.disc(c, x + 22 + sw, y + 30, 3, '#37474f');
      R('#9aa7b0', 38 + sw, 40, 2, 8); R('#9aa7b0', 44 + sw, 40, 2, 8);
    },
    gauge(c, x, y, t) { // "days since last incident" board
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#1f6f43', 0, 0, 50, 42); R('#ffffff', 2, 2, 46, 38); R('#1f6f43', 2, 2, 46, 10);
      Gfx.text(c, 'SAFETY FIRST', x + 25, y + 5, { font: 'label', size: 4.8, color: '#ffffff', align: 'center' });
      Gfx.text(c, 'Days since\nlast incident', x + 25, y + 15, { size: 5.6, bold: true, color: '#1f6f43', align: 'center', raw: true });
      Gfx.text(c, '365', x + 25, y + 30, { scale: 2, size: 9, color: '#c0392b', align: 'center' });
    },
    fan(c, x, y, t) { // spinning extractor fan
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#4a545c', 0, 0, 36, 36); R('#2b3238', 2, 2, 32, 32); Gfx.disc(c, x + 18, y + 18, 15, '#6b767d'); Gfx.disc(c, x + 18, y + 18, 13, '#1b232b');
      const a = t * 6;
      c.fillStyle = '#9aa7b0';
      for (let k = 0; k < 3; k++) { const ang = a + k * 2.094; for (let i = 2; i < 12; i++) c.fillRect(x + 18 + Math.round(Math.cos(ang) * i), y + 18 + Math.round(Math.sin(ang) * i), 2, 2); }
      Gfx.disc(c, x + 18, y + 18, 2, '#e8742a');
    },
    racks(c, x, y) { // distant pallet racking full of boxes
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#e8742a', 0, 0, 3, 90); R('#e8742a', 60, 0, 3, 90); R('#e8742a', 30, 0, 3, 90);
      for (let r = 0; r < 4; r++) {
        R('#b85418', 0, 18 + r * 22, 63, 3);
        for (let i = 0; i < 3; i++) { R(['#c89b64', '#d9a66b', '#b9854a'][(i + r) % 3], 5 + i * 20, 4 + r * 22, 15, 14); R('#a87a45', 12 + i * 20, 4 + r * 22, 1, 14); }
      }
    },
    crates(c, x, y) { // stack of wooden crates and drums
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#b9854a', 0, 22, 26, 26); R('#5a3a1a', 0, 22, 26, 2); R('#8a5a2b', 0, 34, 26, 2); R('#8a5a2b', 12, 22, 2, 26);
      R('#b9854a', 4, 0, 20, 22); R('#5a3a1a', 4, 0, 20, 2); R('#8a5a2b', 13, 0, 2, 22); R('#8a5a2b', 4, 10, 20, 2);
      R('#2b6cb0', 30, 10, 14, 38); R('#4f93d9', 31, 10, 4, 38); R('#1e4a7a', 30, 18, 14, 2); R('#1e4a7a', 30, 38, 14, 2);
    },
    lamp(c, x, y) { // hanging industrial lamp
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#4a545c', 11, -30, 2, 30); R('#37474f', 4, 0, 16, 4); R('#52606c', 2, 4, 20, 4); R('#fff7c2', 3, 8, 18, 3); R('rgba(255,247,194,0.18)', -6, 11, 36, 40);
    },
  };

  const art = {
    areaStyle: {
      dock:      { wall: '#cdd2d6', accent: '#96a3ad', decor: ['skylight', 'crates', 'column', 'gauge', 'racks', 'crates'] },
      warehouse: { wall: '#c8cdd1', accent: '#8f9ca6', decor: ['racks', 'column', 'racks', 'skylight', 'crates', 'gauge', 'racks', 'column'] },
      assembly:  { wall: '#c3cbd1', accent: '#7f95a8', decor: ['arm', 'column', 'arm', 'fan', 'gauge', 'arm'] },
      machine:   { wall: '#bcc3c8', accent: '#7a8791', decor: ['tank', 'column', 'fan', 'tank', 'gauge', 'column'] },
      packing:   { wall: '#d2d2c8', accent: '#a6a58f', decor: ['racks', 'crates', 'column', 'racks', 'gauge', 'crates'] },
      office:    { wall: '#cfd5d0', accent: '#8fa597', decor: ['skylight', 'gauge', 'column', 'skylight', 'crates', 'gauge'] },
    },
    init() { if (!S) buildSprites(); },
    sprites() { return S; },

    /** Returns the sprite canvas for a tile, or null if it should not be drawn. */
    tileSprite(ch, tx, ty, L, time) {
      switch (ch) {
        case '#': return L.solidAt(tx, ty - 1) ? S.floorBody[tx & 1] : S.floorTop[tx & 1];
        case 'X': return S.floorBody[tx & 1];
        case 'B': return S.crate;
        case '?': case 'P': case 'E': case 'T': case 'K': return S.q[Math.floor(time * 3 + tx * 0.5) % 2];
        case 'u': return S.used;
        case 'D': return S.duct;
        case 'V': { const right = L.charAt(tx - 1, ty) === 'V', bottom = L.charAt(tx, ty - 1) === 'V'; return S.vend[(bottom ? 'b' : 't') + (right ? 'r' : 'l')]; }
        case 'L': return L.charAt(tx, ty - 1) === 'L' ? S.linenBottom : S.linenTop;
        case 'h': case 'l': return S.sw[ch];
        case 'H': return S.sw.hu;
        case 'J': return S.sw.lu;
        case '-': {
          let a = tx; while (L.charAt(a - 1, ty) === '-') a--;
          let b = tx; while (L.charAt(b + 1, ty) === '-') b++;
          const pos = a === b ? 3 : tx === a ? 0 : tx === b ? 2 : 1;
          return S.plat[(a >> 0) % 3][pos];
        }
        default: return null;
      }
    },
    drawCoin(ctx, x, y, time) { ctx.drawImage(S.coin[Math.floor(time * 8 + x * 0.05) % 4], Math.round(x), Math.round(y)); },
    drawPowerIcon(ctx, kind, x, y) { ctx.drawImage(S.pu[kind], Math.round(x), Math.round(y)); },
    drawCheckpoint(ctx, x, y, on) { ctx.drawImage(S.cp[on ? 1 : 0], Math.round(x), Math.round(y)); },
    drawWet(ctx, x, y) { ctx.drawImage(S.wet, Math.round(x), Math.round(y)); },
    drawPuddle(ctx, x, y) { ctx.drawImage(S.puddle, Math.round(x), Math.round(y)); },

    /** Parallax factory interior. camX in world px. */
    drawBackground(ctx, camX, time, areaKey) {
      const W = C.VIEW_W, H = C.VIEW_H, R = Gfx.px;
      const st = this.areaStyle[areaKey] || this.areaStyle.dock;
      ST.wall = Gfx.lerpColor(ST.wall, st.wall, 0.04);
      ST.accent = Gfx.lerpColor(ST.accent, st.accent, 0.04);
      R(ctx, ST.wall, 0, 0, W, H);
      // roof trusses, world-locked, with hanging lamps
      R(ctx, '#3b454e', 0, 0, W, 22); R(ctx, '#2b3238', 0, 22, W, 3); R(ctx, '#56626c', 0, 20, W, 2);
      const tp = 56, t0 = -(Math.round(camX * 0.9) % tp);
      for (let x = t0 - tp; x < W + tp; x += tp) { for (let i = 0; i < 28; i++) { R(ctx, '#56626c', x + i, 2 + (i % 2) * 14, 1, 1); } R(ctx, '#56626c', x, 0, 2, 22); }
      const lp = 112, l0 = -(Math.round(camX * 0.9) % lp);
      for (let x = l0 - lp; x < W + lp; x += lp) D.lamp(ctx, x + 40, 28);
      // far layer (skylights), parallax 0.25
      const fp = 190, f0 = -(Math.round(camX * 0.25) % fp);
      for (let x = f0 - fp; x < W + fp; x += fp) D.skylight(ctx, x + 40, 40);
      // mid layer (columns, racks, tanks, robot arms...), parallax 0.5
      const mp = 150, mOff = Math.round(camX * 0.5);
      const first = Math.floor(mOff / mp) - 1;
      for (let n = first; n < first + Math.ceil(W / mp) + 3; n++) {
        const lx = n * mp + 55 - mOff;
        const wcol = Math.max(0, Math.min(223, Math.round(((n * mp + 55 - 240) / 0.5 + 240) / 16)));
        const key = this.areaKeyAt(wcol), kinds = (this.areaStyle[key] || st).decor;
        const kind = kinds[((n % kinds.length) + kinds.length) % kinds.length];
        const y = { skylight: 44, column: 28, tank: 104, arm: 100, gauge: 80, fan: 62, racks: 86, crates: 128, lamp: 40 }[kind];
        if (kind === 'arm' || kind === 'fan' || kind === 'gauge') D[kind](ctx, lx, y, time); else D[kind](ctx, lx, y);
      }
      // lower wall: corrugated steel + painted hazard rail (near layer)
      R(ctx, ST.accent, 0, 176, W, 64); R(ctx, '#e8742a', 0, 172, W, 3); R(ctx, '#b85418', 0, 175, W, 1);
      const wp = 12, w0 = -(Math.round(camX * 0.9) % wp);
      for (let x = w0 - wp; x < W + wp; x += wp) { R(ctx, 'rgba(255,255,255,0.22)', x, 178, 2, 58); R(ctx, 'rgba(0,0,0,0.10)', x + 6, 178, 2, 58); }
      R(ctx, '#5d6b76', 0, 236, W, 4);
      // hanging signs (parallax 0.5)
      for (const s of this.signs) {
        const sx = 240 + 0.5 * (s.col * 16 - 240) - camX * 0.5;
        const w = Gfx.measure(s.text, 1).w + 12;
        if (sx + w < 0 || sx - w > W) continue;
        R(ctx, '#56626c', Math.round(sx - w / 2 + 4), 26, 1, 15); R(ctx, '#56626c', Math.round(sx + w / 2 - 5), 26, 1, 15);
        R(ctx, '#ffffff', Math.round(sx - w / 2), 41, w, 15); R(ctx, s.color || '#e8742a', Math.round(sx - w / 2 + 1), 42, w - 2, 13);
        Gfx.text(ctx, s.text, Math.round(sx), 46, { color: '#ffffff', align: 'center' });
      }
    },
    areaKeyAt(col) { for (const a of this.areas) if (col >= a.from && col <= a.to) return a.key; return 'dock'; },

    /** Open floor hatches and oil sheen, drawn behind tiles. */
    drawFloorExtras(ctx, camX, L, time) {
      const T = C.TILE, R = Gfx.px;
      for (const p of L.pits) {
        const x = p.from * T - camX, w = (p.to - p.from + 1) * T;
        if (x + w < 0 || x > C.VIEW_W) continue;
        R(ctx, '#0b0e12', x, 240, w, 32); R(ctx, '#161b21', x + 2, 240, w - 4, 32);
        R(ctx, '#3b454e', x + 4, 240, 2, 32); R(ctx, '#3b454e', x + w - 6, 240, 2, 32);
        // pipes + a glow far below
        const dy = 252 + Math.round((time * 14) % 12);
        R(ctx, '#2f3a44', x + 6, dy, w - 12, 3);
        R(ctx, 'rgba(232,116,42,0.35)', x + 6, 262, w - 12, 10);
        Gfx.text(ctx, 'FLOOR HATCH\nOPEN', x + w / 2, 248, { color: '#ffd23f', align: 'center' });
        for (let i = 0; i < w; i += 6) { R(ctx, '#ffd23f', x + i, 238, 3, 2); R(ctx, '#1a1a1a', x + i + 3, 238, 3, 2); }
      }
      ctx.fillStyle = 'rgba(120,150,255,0.45)';
      for (let tx = Math.floor(camX / T); tx <= Math.floor((camX + C.VIEW_W) / T); tx++) {
        if (L.slip[tx]) { ctx.fillRect(tx * T - camX, 240, T, 1); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(tx * T - camX + ((tx * 5) % 9) + 2, 240, 3, 1); ctx.fillStyle = 'rgba(120,150,255,0.45)'; }
      }
    },
  };

  /** The Foreman: hard hat, hi-vis vest, clipboard, standing at a control desk. */
  function drawGoal(ctx, sx, y, hop, t) {
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    // control desk + monitor + time clock
    R('#e8742a', 10, 3, 38, 3); R('#4a545c', 10, 6, 38, 10); R('#6b767d', 10, 6, 38, 2); R('#2f3a44', 10, 15, 38, 1);
    R('#263238', 16, -6, 12, 9); R('#9be3ff', 17, -5, 10, 6); R('#34c768', 18, -3, 2, 3); R('#34c768', 21, -4, 2, 4); R('#34c768', 24, -2, 2, 2); R('#78909c', 21, 3, 2, 1);
    R('#ffffff', 34, 0, 8, 3); R('#f2b705', 36, 1, 4, 2);
    Gfx.person(ctx, sx + 1, y - hop, { face: -1, state: 'stand', coat: '#4a5a68', sleeve: '#4a5a68', shirt: '#4a5a68', pants: '#2f3a44', shoes: '#37474f', skin: '#d9a77a', hair: '#7a5a3a', hat: 'hard', vest: '#ff9f1c', prop: 'clipboard' });
  }

  // ------------------------------------------------------------------ data
  LEVELS.manufacturing = {
    id: 'manufacturing',
    title: 'Manufacturing',
    message: 'Safety briefing at 6am',
    route: ['Loading Dock', 'Warehouse', 'Assembly Line', 'Machine Shop', 'Packing Floor', 'Foreman’s Office'],
    intro: name => [
      name + ', you work in Internal Communications.',
      'An important safety update must reach the foreman',
      'before the 6am shift starts.',
      'Managers, pickets and forklifts are in the way.',
      'The CEO has a different message. Always.',
      'Be quick, be clear, and always wear a hard hat.',
    ],
    drawGoal,
    goalLine: 'Safety first!',
    goalName: 'foreman',
    goalLabel: 'FOREMAN',
    goalNearLines: ['Over here!', 'Shift starts in five!', 'Got something for me?'],
    failLine: 'The foreman received: “See noticeboard.”',
    checkpointLabel: 'Supervisor sign-off',
    checkpointShort: 'SIGN-OFF',
    doorText: 'SHUTTER\nDOWN',
    pitText: 'FLOOR HATCH OPEN!',
    areas: [
      { key: 'dock', name: 'Loading Dock', from: 0, to: 31 },
      { key: 'warehouse', name: 'Warehouse', from: 32, to: 95 },
      { key: 'assembly', name: 'Assembly Line', from: 96, to: 127 },
      { key: 'machine', name: 'Machine Shop', from: 128, to: 159 },
      { key: 'packing', name: 'Packing Floor', from: 160, to: 191 },
      { key: 'office', name: 'Foreman’s Office', from: 192, to: 223 },
    ],
    signs: [
      { col: 8, text: 'LOADING DOCK' }, { col: 38, text: 'WAREHOUSE A' }, { col: 58, text: 'FOREMAN >>', color: '#c0392b' },
      { col: 74, text: 'WAREHOUSE B' }, { col: 100, text: 'ASSEMBLY LINE', color: '#2b6cb0' }, { col: 112, text: '412 DAYS WITHOUT A DRAMA', color: '#2b6cb0' },
      { col: 136, text: 'MACHINE SHOP', color: '#46607a' }, { col: 150, text: 'EAR PROTECTION REQUIRED', color: '#46607a' },
      { col: 168, text: 'PACKING', color: '#2f9d62' }, { col: 182, text: 'MIND THE PALLETS', color: '#2f9d62' },
      { col: 198, text: 'FOREMAN', color: '#c0392b' }, { col: 214, text: 'SHIFT HANDOVER', color: '#c0392b' },
    ],
    map,
    // Enemies. x = tile column; y (optional) = tile row of the surface it stands on, otherwise it
    // drops onto the ground. range = patrol radius in tiles.
    entities: [
      { type: 'worker', variant: 'cart', x: 14, range: 3 },
      { type: 'manager', x: 25, range: 3 },
      { type: 'forklift', x: 42, range: 2 },
      { type: 'manager', x: 48, range: 3 },
      { type: 'union', x: 53, signs: ['SAFE\nSTAFFING', 'FAIR\nSHIFTS!'] },
      { type: 'pager', x: 57, y: 13 },
      { type: 'middleManager', x: 71, range: 3 },
      { type: 'assistant', x: 78, range: 1 },
      { type: 'worker', variant: 'jack', x: 83, range: 1 },
      { type: 'forklift', x: 100, range: 3 },
      { type: 'worker', variant: 'jack', x: 108, range: 1 },
      { type: 'manager', x: 113, range: 3 },
      { type: 'worker', variant: 'cart', x: 118, range: 1 },
      { type: 'manager', x: 135, range: 2 },
      { type: 'assistant', x: 142, range: 1 },
      { type: 'union', x: 146, signs: ['MORE\nBREAKS!', 'SAFE\nSTAFFING'] },
      { type: 'manager', x: 165, range: 3 },
      { type: 'pager', x: 167, y: 13 },
      { type: 'assistant', x: 170, range: 1 },
      { type: 'middleManager', x: 177, range: 2 },
      { type: 'forklift', x: 197, range: 3 },
      { type: 'middleManager', x: 212, range: 3 },
    ],
    // Things that drop behind you to slow the CEO (solid to him, and to you if you go back).
    barriers: [
      { id: 'door1', kind: 'door', x: 65, y: 10, w: 1, h: 5, switch: { x: 68, y: 11 } },
      { id: 'cart1', kind: 'cart', x: 87, y: 13, w: 2, h: 2, switch: { x: 89, y: 11 } },
      { id: 'door2', kind: 'door', x: 149, y: 10, w: 1, h: 5, switch: { x: 152, y: 11 } },
      { id: 'cart2', kind: 'cart', x: 178, y: 13, w: 2, h: 2, switch: { x: 189, y: 11 } },
    ],
    ceo: { firstAfterCheckpoint: 1 },
    readRateQuips: [
      [90, 'HIGHER THAN ANY NOTICEBOARD EVER PINNED.', 'THE FOREMAN LAMINATED IT.'],
      [70, 'READ ON BREAK. IT STILL COUNTS.', 'THE KETTLE WAS INVOLVED.'],
      [50, 'BETTER THAN THE TOOLBOX TALK. LOW BAR.', 'STILL, A WIN IS A WIN.'],
      [30, 'SKIMMED WHILE FORKLIFTING. CLASSIC.', 'AT LEAST NOBODY REPLIED ALL.'],
      [0, 'MARKED AS READ. NOT READ.', 'THE CEO PUT UP A POSTER.'],
    ],
    art,
  };
  art.signs = LEVELS.manufacturing.signs;
  art.areas = LEVELS.manufacturing.areas;
})();
