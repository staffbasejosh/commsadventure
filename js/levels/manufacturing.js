'use strict';
/* ==========================================================================
   levels/manufacturing.js - Manufacturing.

   The same 60-second score-attack round as Healthcare (see levels/endless.js, js/attack.js and C.ATTACK), set in an
   endless factory: frontline colleagues (operators, welders, packers, drivers, cleaners and Shift Supervisors, who
   count triple and add time) to reach, coins for time, two choke-point corridors (Loading Bay, Break Room) and the
   CEO / HR Manager chasing you after them. Obstacles: pallet jacks, box trolleys, shipping containers, shelving
   units, and the factory's own extras: forklifts and union reps. Everything slows you down; nothing scores.

   MAP LEGEND (one character = one 16x16 tile; map is 17 rows high)
     .  empty                 #  concrete floor          X  solid wall block
     B  wooden crate (breakable)      D  steel girder (solid)       V  shelving unit (solid, 2x2)
     R  shipping container (solid)    Y / Z  loading-bay wall / ceiling (solid)
     -  one-way platform (conveyor / scaffold / rack beam; Down drops through)
     ?  engagement block (coins)  P / E / T / K  power-up blocks
     c  engagement coin           w  caution sign (slippery)   o  oil puddle (slippery)
     S  player start
   Gaps in the floor rows are open floor hatches.
   ========================================================================== */
(function () {
  // ---- endless factory: the shared generator with the factory's cast and obstacles
  const { pick } = Endless;
  const { generate, map, startSigns, first, CW } = Endless.make({
    rolePool: ['operator', 'welder', 'packer', 'driver', 'cleaner', 'supervisor'],
    leadRole: 'supervisor',
    signs: ['LOADING DOCK', 'WAREHOUSE', 'ASSEMBLY', 'MACHINE SHOP', 'PACKING', 'DISPATCH', 'MIND THE PALLETS', 'SAFETY FIRST', 'HARD HATS ON', 'STAFF ONLY', 'CANTEEN', 'GOODS IN', 'QUALITY CHECK', 'EARPLUGS ON'],
    signColors: ['#e8742a', '#2b6cb0', '#46607a', '#2f9d62', '#c0392b'],
    // pallet jacks and box trolleys; forklifts and union reps (3 side by side) join in, more often as you go
    obstacle: (ch, x, range, hard, tunnel) => {
      const r = Math.random(), x0 = ch.c0 + x;
      if (tunnel) return ch.ents.push(hard ? { type: 'forklift', x: x0, range } : { type: 'trolley', variant: pick(['pallet', 'boxcart']), x: x0, range });
      if (r < (hard ? 0.4 : 0.22)) ch.ents.push({ type: 'forklift', x: x0, range: Math.max(1, range) });
      else if (r < (hard ? 0.75 : 0.5)) ch.ents.push({ type: 'union', x: x0 - 1, count: 3, signs: pick([['SAFE\nSTAFFING', 'FAIR\nSHIFTS!'], ['MORE\nBREAKS!', 'SAFE\nSTAFFING'], ['FAIR\nROSTERS!', 'MORE\nBREAKS!']]) });
      else ch.ents.push({ type: 'trolley', variant: pick(['pallet', 'boxcart']), x: x0, range });
    },
    firstObstacle: first => first.ents.push({ type: 'trolley', variant: 'pallet', x: 29, range: 1 }),
    startSign: 'LOADING DOCK',
    tunnelNames: [['Loading Bay', 'Forklift traffic: push through'], ['Break Room', 'Break time: wade through']],
  });

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
    // shipping container (closed room): ribbed steel box, solid, hop over it
    S.roomTop = mk(16, 16, (x, R) => {
      R('#1e4a7a', 0, 0, 16, 16); R('#2b6cb0', 0, 2, 16, 12); R('#4f93d9', 0, 2, 16, 1); R('#1e4a7a', 0, 13, 16, 3);
      for (let i = 2; i < 16; i += 4) R('#1e4a7a', i, 3, 1, 10);
    });
    S.roomBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#2b6cb0', 0, 0, 16, 16); R('#1e4a7a', 0, 0, 1, 16); R('#1e4a7a', 15, 0, 1, 16);
      for (let i = 2; i < 16; i += 4) R('#1e4a7a', i, 0, 1, 16);
      R('#4f93d9', 1, 0, 1, 16); R('#1e4a7a', 0, 15, 16, 1);
      if (v) { R('#ffffff', 4, 5, 8, 6); R('#e03131', 5, 6, 6, 1); R('#e03131', 5, 8, 6, 1); }
    }));
    // choke-point walls and ceiling (Loading Bay / Break Room)
    S.tunWall = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#46525c', 0, 0, 16, 16); R('#3b454e', 0, 0, 16, 1); R('#566471', v ? 8 : 0, 2, 8, 12); R('#3b454e', v ? 8 : 0, 2, 1, 12);
      R('#9aa7b0', v ? 9 : 1, 3, 1, 1); R('#9aa7b0', v ? 14 : 6, 3, 1, 1); R('#9aa7b0', v ? 9 : 1, 12, 1, 1); R('#9aa7b0', v ? 14 : 6, 12, 1, 1);
    }));
    S.tunCeil = mk(16, 16, (x, R) => {
      R('#46525c', 0, 0, 16, 10); R('#2b3238', 0, 10, 16, 6);
      for (let i = 0; i < 16; i += 8) { R('#f2b705', i, 10, 4, 2); R('#1a1a1a', i + 4, 10, 4, 2); }
      R('#fff7c2', 4, 13, 8, 1); R('#2b3238', 0, 15, 16, 1);
    });
  }

  // ---- background decor drawers: everything stands on a floor line `f`, at human scale (a person is ~24px)
  const rect = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const fitSize = (str, size, maxW, o) => { const w = Gfx.measure(str, Object.assign({ size, raw: true }, o)).w; return w > maxW ? Math.max(3.2, size * maxW / w) : size; };
  const D = {
    shutter(c, x, f) {   // roller shutter door
      const y = f - 36;
      rect(c, '#6b767d', x, y, 28, 36); rect(c, '#b8c2c9', x + 2, y + 2, 24, 34);
      for (let i = 0; i < 34; i += 4) rect(c, '#9aa7b0', x + 2, y + 4 + i, 24, 1);
      rect(c, '#f2b705', x + 2, f - 5, 6, 3); rect(c, '#1a1a1a', x + 8, f - 5, 6, 3); rect(c, '#f2b705', x + 14, f - 5, 6, 3); rect(c, '#1a1a1a', x + 20, f - 5, 6, 3);
    },
    window(c, x, f) {
      const y = f - 38;
      rect(c, '#4a545c', x, y, 32, 24); rect(c, '#bfe2f5', x + 2, y + 2, 28, 20); rect(c, '#8dc6e8', x + 2, y + 12, 28, 10);
      rect(c, '#7bb3d6', x + 4, y + 14, 5, 8); rect(c, '#6aa3c8', x + 12, y + 16, 6, 6); rect(c, '#7bb3d6', x + 21, y + 13, 6, 9);
      rect(c, '#4a545c', x + 15, y + 2, 2, 20); rect(c, '#4a545c', x + 2, y + 11, 28, 1);
    },
    board(c, x, y, n) {
      const list = C.NOTICES_MFG, nt = list[n % list.length], w = 46, h = 30;
      rect(c, 'rgba(0,0,0,0.10)', x + 1, y + h, w, 2);
      rect(c, '#7d8f93', x, y, w, h); rect(c, '#ffffff', x + 1, y + 1, w - 2, h - 2); rect(c, nt.color, x + 1, y + 1, w - 2, 8);
      const ts = fitSize(nt.tag, 4.6, w - 8, { bold: true });
      Gfx.text(c, nt.tag, x + w / 2, y + 1 + (8 - ts * 0.73) / 2, { raw: true, bold: true, size: ts, color: '#ffffff', align: 'center', spacing: 0.2 });
      nt.lines.forEach((l, i) => {
        const s = fitSize(l, 4.6, w - 6, { bold: true });
        Gfx.text(c, l, x + w / 2, y + 12 + i * 6, { raw: true, bold: true, size: s, color: '#090D48', align: 'center' });
      });
      rect(c, '#e8453c', x + 2, y + 2, 1, 1); rect(c, '#e8453c', x + w - 3, y + 2, 1, 1);
    },
    safety(c, x, f) {   // "days since last incident"
      const y = f - 34;
      rect(c, '#1f6f43', x, y, 30, 22); rect(c, '#ffffff', x + 1, y + 1, 28, 20); rect(c, '#1f6f43', x + 1, y + 1, 28, 6);
      Gfx.text(c, 'SAFETY FIRST', x + 15, y + 2.2, { font: 'label', size: 3.6, color: '#ffffff', align: 'center' });
      Gfx.text(c, '365', x + 15, y + 9, { scale: 2, size: 8, color: '#c0392b', align: 'center' });
      Gfx.text(c, 'days without incident', x + 15, y + 17, { raw: true, bold: true, size: 3.2, color: '#1f6f43', align: 'center' });
    },
    drums(c, x, f) {
      rect(c, '#2b6cb0', x, f - 14, 10, 14); rect(c, '#4f93d9', x + 1, f - 14, 3, 14); rect(c, '#1e4a7a', x, f - 9, 10, 1); rect(c, '#1e4a7a', x, f - 4, 10, 1);
      rect(c, '#e8742a', x + 11, f - 14, 10, 14); rect(c, '#f59a5b', x + 12, f - 14, 3, 14); rect(c, '#b85418', x + 11, f - 9, 10, 1); rect(c, '#b85418', x + 11, f - 4, 10, 1);
    },
    crates(c, x, f) {
      rect(c, '#b9854a', x, f - 14, 16, 14); rect(c, '#5a3a1a', x, f - 14, 16, 1); rect(c, '#8a5a2b', x + 7, f - 14, 2, 14); rect(c, '#8a5a2b', x, f - 8, 16, 1);
      rect(c, '#d9a66b', x + 3, f - 26, 11, 12); rect(c, '#5a3a1a', x + 3, f - 26, 11, 1); rect(c, '#8a5a2b', x + 8, f - 26, 1, 12);
    },
    extinguisher(c, x, f) {
      rect(c, '#e8453c', x, f - 18, 5, 12); rect(c, '#ffffff', x + 1, f - 15, 3, 4); rect(c, '#9fb4b8', x + 1, f - 20, 3, 2);
    },
  };
  // Noticeboards hang high on the wall, in a spot with no tiles (platforms, blocks, containers, shelving) in or just below it,
  // so nothing can stand in front of one. Decided once per slot from the generated map.
  const boardCache = new WeakMap();
  function boardSpot(L, n, P) {
    let m = boardCache.get(L); if (!m) { m = new Map(); boardCache.set(L, m); }
    if (m.has(n)) return m.get(n);
    let found = null;
    for (const off of [24, 72, 112]) for (const top of [158, 126, 94]) {
      const x = n * P + off, c0 = Math.floor(x / 16) - 1, c1 = Math.floor((x + 46) / 16) + 1, r0 = Math.floor(top / 16), r1 = Math.floor((top + 62) / 16);
      let ok = true;
      for (let c = c0; c <= c1 && ok; c++) for (let r = r0; r <= r1 && ok; r++) { const ch = L.charAt(c, r); if (ch !== '.' && ch !== 'c') ok = false; }
      if (ok) { found = { x, y: top }; break; }
    }
    if ((n * P + 200) / 16 < L.cols) m.set(n, found);
    return found;
  }
  const hash = (a, b) => { let h = Math.imul(a | 0, 0x45d9f3b) ^ Math.imul((b | 0) + 7, 0x27d4eb2d); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return h >>> 0; };

  const art = {
    areaStyle: { dock: { wall: '#d9dee1', accent: '#aab3b9' } },
    init() { if (!S) buildSprites(); },
    sprites() { return S; },

    /** Returns the sprite canvas for a tile, or null if it should not be drawn. */
    tileSprite(ch, tx, ty, L, time) {
      switch (ch) {
        case '#': return L.solidAt(tx, ty - 1) ? S.floorBody[tx & 1] : S.floorTop[tx & 1];
        case 'X': return S.floorBody[tx & 1];
        case 'R': return L.charAt(tx, ty - 1) === 'R' ? S.roomBody[(tx & 1)] : S.roomTop;
        case 'Y': return S.tunWall[tx & 1];
        case 'Z': return S.tunCeil;
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

    /** Mario-simple backdrop in WORLD coordinates: one flat wall colour, a skirting line and a few faded floor-level pieces. */
    drawBackground(ctx, camX, time, areaKey, camY, L) {
      camY = camY || 0;
      const W = Math.ceil(C.VIEW_W / C.ZOOM) + 2, H = Math.ceil(C.VIEW_H / C.ZOOM) + 2, R = Gfx.px, cx = Math.round(camX);
      ST.wall = '#d9dee1';
      R(ctx, ST.wall, 0, camY, W, H);
      const f = 240;
      R(ctx, '#bcc5ca', 0, f - 5, W, 5); R(ctx, '#aab3b9', 0, f - 5, W, 1); R(ctx, '#e8742a', 0, f - 6, W, 1);
      const P = 192, n0 = Math.floor((cx - 60) / P), n1 = Math.floor((cx + W) / P) + 1;
      ctx.globalAlpha = 0.8;
      for (let n = n0; n <= n1; n++) {
        const h = hash(n, 0);
        const kind = ['shutter', 'window', 'drums', 'safety', 'crates', 'window'][(h >>> 4) % 6], x = n * P + 24 + (h >>> 9) % 50 - cx;
        if (n % 5 === 0) {
          const spot = L && boardSpot(L, n, P);
          if (spot) { D.board(ctx, spot.x - cx, spot.y, Math.round(n / 5) + 1000); continue; }
          if (!L) { D.board(ctx, x, 158, Math.round(n / 5) + 1000); continue; }
        }
        D[kind](ctx, x, f);
        if (kind === 'shutter' && (h >>> 2) % 2) D.extinguisher(ctx, x + 32, f);
      }
      ctx.globalAlpha = 1;
      // wall-mounted direction signs (ground floor), world-locked
      for (const s of this.signs) {
        const sx = s.col * 16 + 8 - cx;
        const w = Math.round(Gfx.measure(s.text, { size: 5, raw: true, bold: true }).w) + 8;
        if (sx + w < 0 || sx - w > W) continue;
        const sy = 194;
        R(ctx, '#78909c', Math.round(sx - w / 2 + 3), sy - 2, 1, 2); R(ctx, '#78909c', Math.round(sx + w / 2 - 4), sy - 2, 1, 2);
        R(ctx, '#ffffff', Math.round(sx - w / 2), sy, w, 10); R(ctx, s.color || '#e8742a', Math.round(sx - w / 2 + 1), sy + 1, w - 2, 8);
        Gfx.text(ctx, s.text, Math.round(sx), sy + 2.6, { raw: true, bold: true, size: 5, color: '#ffffff', align: 'center' });
      }
    },
    areaKeyAt() { return 'dock'; },

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

  // ------------------------------------------------------------------ data
  LEVELS.manufacturing = {
    id: 'manufacturing',
    title: 'Manufacturing',
    message: 'Score attack',
    hud: C.HUD_H,    // reserved header strip (the world is drawn below it)
    rolePool: ['operator', 'welder', 'packer', 'driver', 'cleaner', 'supervisor'],
    zoom: C.ZOOM,
    mode: 'attack',  // timed score-attack round (see js/attack.js and C.ATTACK)
    intro: name => [
      name + ', welcome to the Factory.',
      '',
      'You have 60 seconds to spread your message to your frontline.',
      '',
      'Avoid the CEO and HR Manager, they want to interrupt your message.',
      '',
      'Avoid the obstacles, they slow you down.',
      '',
      'Collect coins to get more time. Messages delivered to Shift Supervisors get extra time.',
    ],
    goalLine: 'Got it!',
    checkpointLabel: 'Supervisor sign-off',
    pitText: 'FLOOR HATCH OPEN!',
    areas: [{ key: 'dock', name: 'Endless Factory', from: 0, to: 1e9 }],
    endless: true,
    chunkCols: CW,
    generate,
    signs: startSigns,
    map,
    // Colleagues present when the round starts (the first is a few steps from the start).
    npcStart: [
      { role: 'operator', x: 12, y: 15, mode: 'stand' },
      { role: 'cleaner', x: 19, y: 12, mode: 'stand' },
      { role: 'driver', x: 24, y: 15, mode: 'roam', range: 3 },
      { role: 'supervisor', x: 23, y: 9, mode: 'stand' },
      { role: 'welder', x: 28, y: 12, mode: 'stand' },
    ],
    spawnPoints: [10, 15, 20, 24].map(x => ({ x, y: 15, kind: 'ground' })).concat([{ x: 19, y: 12, kind: 'high' }, { x: 23, y: 9, kind: 'high' }, { x: 29, y: 12, kind: 'high' }]),
    entities: first.ents,
    barriers: [],
    ceo: { firstAfterCheckpoint: 1 },
    readRateQuips: [[0, '', '']],
    art,
  };
  art.signs = LEVELS.manufacturing.signs;
  art.areas = LEVELS.manufacturing.areas;
})();
