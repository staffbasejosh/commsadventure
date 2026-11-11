'use strict';
/* ==========================================================================
   levels/transport.js - Transport (an airport terminal, with a plane as the choke point).

   The same 60-second score-attack round as the other levels (see levels/endless.js, js/attack.js and C.ATTACK), set
   in an endless airport: frontline colleagues (check-in agents, cabin crew, baggage handlers, security officers,
   cleaners and Captains, who count triple and add time) to reach, coins for time, two choke-point Plane Cabins
   (aisle, overhead lockers and oval windows) and the CEO / HR Manager chasing you after them. Obstacles: luggage
   trolleys, baggage containers and check-in kiosks, plus union reps (ground staff on the picket). Everything slows
   you down; nothing scores.

   MAP LEGEND (one character = one 16x16 tile; map is 17 rows high)
     .  empty                 #  terminal floor        X  solid wall block
     B  suitcase (breakable)          D  steel column (solid)       V  check-in kiosk (solid, 2x2)
     R  baggage container (solid)     Y / Z  plane cabin wall / overhead lockers (solid)
     -  one-way platform (check-in desk / baggage belt / seating bench; Down drops through)
     ?  engagement block (coins)  P / E / T / K  power-up blocks
     c  engagement coin           w  wet floor sign (slippery)   o  spilled coffee (slippery)
     S  player start
   Gaps in the floor rows are open baggage chutes.
   ========================================================================== */
(function () {
  // ---- endless airport: the shared generator with the airport's cast and obstacles
  const { pick } = Endless;
  const { generate, map, startSigns, first, CW } = Endless.make({
    rolePool: ['agent', 'crew', 'handler', 'officer', 'cleaner', 'captain'],
    leadRole: 'captain',
    signs: ['DEPARTURES', 'ARRIVALS', 'CHECK-IN', 'BAGGAGE CLAIM', 'SECURITY', 'DUTY FREE', 'LOUNGE', 'GATE 7', 'GATE 12', 'GATE 21', 'CUSTOMS', 'INFORMATION', 'FOOD COURT', 'TAXIS'],
    signColors: ['#1f4e79', '#2b6cb0', '#46607a', '#1f7a5a', '#8a6b1f'],
    // luggage trolleys; union reps (3 side by side) join in, more often as you go
    obstacle: (ch, x, range, hard, tunnel) => {
      const r = Math.random(), x0 = ch.c0 + x;
      if (tunnel) return ch.ents.push({ type: 'trolley', variant: hard ? 'luggage' : 'cabin', x: x0, range });
      if (r < (hard ? 0.4 : 0.22)) ch.ents.push({ type: 'union', x: x0 - 1, count: 3, signs: pick([['SAFE\nSTAFFING', 'FAIR\nSHIFTS!'], ['MORE\nBREAKS!', 'SAFE\nSTAFFING'], ['FAIR\nROSTERS!', 'MORE\nBREAKS!']]) });
      else ch.ents.push({ type: 'trolley', variant: pick(['luggage', 'luggage', 'cabin']), x: x0, range });
    },
    firstObstacle: first => first.ents.push({ type: 'trolley', variant: 'luggage', x: 29, range: 1 }),
    coinRate: 0.6,            // fewer coin trails (each coin is worth a full second here)
    npcScale: 0.85,           // about 15% fewer colleagues
    corridorGap: [4, 5],      // the second corridor (and the HR Manager) arrives sooner...
    postHr: { extra: 2 },     // ...and the floor gets busier after that
    startSign: 'DEPARTURES',
    tunnelNames: [['Plane Cabin', 'Mind the aisle: push through'], ['Plane Cabin', 'Boarding rush: wade through']],
  });

  // ------------------------------------------------------------------ art
  let S = null; // sprite cache
  function mk(w, h, fn) {
    const { c, x } = Gfx.canvas(w, h);
    fn(x, (col, rx, ry, rw, rh) => { x.fillStyle = col; x.fillRect(rx, ry, rw, rh); });
    return c;
  }
  const ST = { wall: '#dfe8ef', accent: '#27476b' };
  const slice4 = big => { const t = (sx, sy) => mk(16, 16, x => x.drawImage(big, sx, sy, 16, 16, 0, 0, 16, 16)); return { tl: t(0, 0), tr: t(16, 0), bl: t(0, 16), br: t(16, 16) }; };

  function buildSprites() {
    S = {};
    // polished terminal floor: pale grey terrazzo with speckles
    S.floorTop = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#c6cdd4' : '#d2d8de', 0, 0, 16, 16); R('#eef2f5', 0, 0, 16, 1); R('#b6bec6', 0, 1, 16, 1);
      R('#8f99a3', 0, 2, 16, 1); R('#a9b2bb', 0, 0, 1, 16); R('#e4e9ed', 3, 7, 2, 1); R('#98a2ac', 9, 11, 2, 1); R('#e4e9ed', 12, 5, 2, 1); R('#98a2ac', 6, 13, 1, 1);
    }));
    S.floorBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#66717c' : '#6f7a85', 0, 0, 16, 16); R('#55606b', 0, 0, 1, 16); R('#55606b', 0, 15, 16, 1);
      R('#7f8a95', 4, 4, 3, 1); R('#5e6974', 9, 9, 4, 1); R('#4c5660', 2, 2, 2, 2); R('#4c5660', 12, 12, 2, 2);
    }));
    S.crate = mk(16, 16, (x, R) => { // suitcase: hard-shell with straps, handle and wheels
      R('#2b3340', 0, 0, 16, 16); R('#e8742a', 1, 2, 14, 12); R('#f59a5b', 1, 2, 14, 2); R('#b85418', 1, 12, 14, 2);
      R('#2b3340', 6, 0, 4, 2); R('#8a4a1a', 4, 2, 1, 11); R('#8a4a1a', 11, 2, 1, 11); R('#2b3340', 2, 14, 3, 2); R('#2b3340', 11, 14, 3, 2);
      R('#ffffff', 6, 6, 4, 4); R('#1f4e79', 7, 7, 2, 1); R('#c0392b', 7, 9, 2, 1);
    });
    const qb = (fill, edge, hi) => mk(16, 16, (x, R) => {
      R('#4a3200', 0, 0, 16, 16); R(edge, 1, 1, 14, 14); R(fill, 2, 2, 12, 12); R(hi, 2, 2, 12, 2);
      R('#4a3200', 2, 2, 1, 1); R('#4a3200', 13, 2, 1, 1); R('#4a3200', 2, 13, 1, 1); R('#4a3200', 13, 13, 1, 1);
      Gfx.text(x, '?', 6, 4, { scale: 2, color: '#ffffff', shadow: '#4a3200' });
    });
    S.q = [qb('#f59e0b', '#fcd34d', '#fbbf24'), qb('#fbbf24', '#fde68a', '#fcd34d')];
    S.used = mk(16, 16, (x, R) => { R('#4b555c', 0, 0, 16, 16); R('#7b868d', 1, 1, 14, 14); R('#96a1a8', 2, 2, 12, 12); R('#6b767d', 4, 6, 8, 4); });
    S.duct = mk(16, 16, (x, R) => { // steel column block
      R('#46525c', 0, 0, 16, 16); R('#7b8a97', 1, 1, 14, 14); R('#b4c0ca', 1, 1, 14, 2); R('#5f6e7b', 4, 3, 1, 12); R('#5f6e7b', 10, 3, 1, 12);
      R('#2b6cb0', 0, 0, 16, 1); R('#2b6cb0', 0, 15, 16, 1); R('#cfd6db', 7, 5, 2, 1); R('#cfd6db', 6, 10, 3, 1);
    });
    // check-in kiosk 2x2: blue body, white header, lit screen, boarding-pass and tag slots
    const kiosk = mk(32, 32, (x, R) => {
      R('#1f4e79', 0, 0, 32, 32); R('#4f93d9', 0, 0, 32, 1); R('#16395a', 0, 0, 1, 32); R('#16395a', 31, 0, 1, 32); R('#2b6cb0', 1, 1, 1, 30);
      R('#ffffff', 3, 2, 26, 6);
      Gfx.text(x, 'KIOSK', 16, 3.4, { font: 'label', size: 3.6, color: '#1f4e79', align: 'center' });
      R('#0e1a26', 4, 10, 24, 11); R('#bfe2f5', 5, 11, 22, 9); R('#8dc6e8', 5, 16, 22, 4); R('#1f4e79', 7, 13, 10, 1); R('#1f4e79', 7, 15, 14, 1); R('#e8742a', 20, 12, 5, 3);
      R('#0b0e12', 4, 23, 12, 2); R('#ffffff', 5, 23, 6, 1); R('#0b0e12', 19, 23, 9, 2); R('#e8742a', 20, 23, 4, 1);
      R('#16395a', 4, 27, 24, 3); R('#9ec9e0', 6, 28, 20, 1); R('#0f2a44', 0, 31, 32, 1);
    });
    S.vend = slice4(kiosk);
    S.linenTop = mk(16, 16, (x, R) => { R('#46525c', 0, 3, 16, 13); R('#2b6cb0', 0, 3, 16, 2); R('#7b8a97', 1, 6, 14, 8); });
    S.linenBottom = mk(16, 16, (x, R) => { R('#46525c', 0, 0, 16, 16); R('#7b8a97', 1, 0, 14, 14); R('#2b6cb0', 0, 14, 16, 2); });
    const sw = (used) => mk(16, 16, (x, R) => {
      R('#2f3a44', 0, 0, 16, 16); R('#7b8a97', 1, 1, 14, 14); R('#cfd6db', 1, 1, 14, 2);
      R('#1b232b', 3, 4, 10, 8); R(used ? '#34c768' : '#e03131', 4, 5, 8, 6); R(used ? '#8ff0b3' : '#ff8f87', 4, 5, 8, 2);
      R('#ffffff', 5, 7, 6, 1); R('#ffffff', 5, 9, 6, 1);
    });
    S.sw = { h: sw(false), l: sw(false), hu: sw(true), lu: sw(true) };
    // one-way platforms: 0 check-in desk, 1 baggage belt, 2 seating bench
    S.plat = [0, 1, 2].map(style => [0, 1, 2, 3].map(pos => mk(16, 16, (x, R) => {
      const L = pos === 0 || pos === 3, Rr = pos === 2 || pos === 3;
      if (style === 0) { // white check-in counter with a blue front
        R('#e8eef3', 0, 0, 16, 3); R('#ffffff', 0, 0, 16, 1); R('#1f4e79', 0, 3, 16, 5); R('#4f93d9', 0, 3, 16, 1); R('#e8742a', 6, 5, 4, 1); R('#16395a', 0, 8, 16, 1);
        if (L) { R('#1f4e79', 0, 3, 3, 13); R('#16395a', 2, 3, 1, 13); }
        if (Rr) { R('#1f4e79', 13, 3, 3, 13); R('#16395a', 13, 3, 1, 13); }
      } else if (style === 1) { // baggage belt: dark rubber with rollers and silver sides
        R('#2b3238', 0, 0, 16, 4); R('#4a545c', 0, 0, 16, 1); R('#6b767d', 3, 2, 2, 1); R('#6b767d', 10, 2, 2, 1);
        R('#9aa7b0', 0, 4, 16, 3); R('#d3dadd', 0, 4, 16, 1); R('#37474f', 0, 7, 16, 1);
        if (L) { R('#2b3238', 0, 0, 3, 7); Gfx.disc(x, 3, 8, 3, '#9aa7b0'); Gfx.disc(x, 3, 8, 1, '#37474f'); R('#6b767d', 2, 9, 2, 6); R('#37474f', 0, 14, 6, 2); }
        if (Rr) { R('#2b3238', 13, 0, 3, 7); Gfx.disc(x, 12, 8, 3, '#9aa7b0'); Gfx.disc(x, 12, 8, 1, '#37474f'); R('#6b767d', 12, 9, 2, 6); R('#37474f', 10, 14, 6, 2); }
      } else { // bench seats: blue cushions on a steel rail
        R('#2b6cb0', 0, 0, 16, 4); R('#4f93d9', 0, 0, 16, 1); R('#1f4e79', 0, 4, 16, 1); R('#16395a', 7, 1, 1, 3); R('#9aa7b0', 0, 5, 16, 2); R('#d3dadd', 0, 5, 16, 1);
        if (L) { R('#78909c', 1, 7, 2, 8); R('#37474f', 0, 14, 4, 2); }
        if (Rr) { R('#78909c', 13, 7, 2, 8); R('#37474f', 12, 14, 4, 2); }
      }
    })));
    S.wet = mk(16, 16, (x, R) => { // wet floor sign
      for (let i = 0; i < 13; i++) { const w = 3 + Math.floor(i * 0.7); R('#ffd23f', 8 - Math.floor(w / 2), 2 + i, w, 1); }
      R('#c99a00', 6, 14, 5, 1); R('#1a1a1a', 7, 5, 2, 4); R('#1a1a1a', 7, 10, 2, 2); R('#ffe680', 5, 14, 1, 1);
    });
    S.puddle = mk(16, 16, (x, R) => { // coffee spill + paper cup
      R('#3a2414', 1, 13, 14, 3); R('#5a3a22', 3, 12, 10, 1); R('#2a180c', 5, 14, 6, 1); R('#7a5233', 4, 13, 3, 1);
      R('#ffffff', 11, 6, 4, 6); R('#d9d9d9', 11, 11, 4, 1); R('#8a5a2b', 11, 7, 4, 1); R('#1f4e79', 12, 9, 2, 1); R('#3a2414', 15, 7, 1, 2);
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
    // baggage container (closed room): aluminium cargo box with ribs, a cut corner and a stencilled tag
    S.roomTop = mk(16, 16, (x, R) => {
      R('#6b7a88', 0, 0, 16, 16); R('#b4c0ca', 0, 2, 16, 12); R('#dfe6ec', 0, 2, 16, 1); R('#6b7a88', 0, 13, 16, 3);
      for (let i = 3; i < 16; i += 4) R('#8d9aa7', i, 3, 1, 10);
    });
    S.roomBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#b4c0ca', 0, 0, 16, 16); R('#6b7a88', 0, 0, 1, 16); R('#6b7a88', 15, 0, 1, 16);
      for (let i = 3; i < 16; i += 4) R('#8d9aa7', i, 0, 1, 16);
      R('#dfe6ec', 1, 0, 1, 16); R('#6b7a88', 0, 15, 16, 1);
      if (v) { R('#ffffff', 4, 4, 8, 7); R('#1f4e79', 5, 5, 6, 1); R('#e8742a', 5, 7, 6, 1); R('#1f4e79', 5, 9, 4, 1); }
    }));
    // plane cabin walls and ceiling (choke points): cream fuselage with oval windows, overhead lockers above
    S.tunWall = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#ebe6da', 0, 0, 16, 16); R('#d9d3c4', 0, 0, 16, 1); R('#2b6cb0', 0, 13, 16, 3); R('#4f93d9', 0, 13, 16, 1);
      if (!v) { R('#b9b2a0', 3, 3, 10, 9); R('#bcd9ee', 4, 4, 8, 7); R('#8dc6e8', 4, 8, 8, 3); R('#ebe6da', 3, 3, 1, 1); R('#ebe6da', 12, 3, 1, 1); R('#ebe6da', 3, 11, 1, 1); R('#ebe6da', 12, 11, 1, 1); R('#e8f4fb', 5, 5, 2, 1); }
      else { R('#cfc8b6', 6, 4, 4, 1); R('#fffbe0', 7, 6, 2, 1); R('#cfc8b6', 6, 8, 4, 1); }
    }));
    S.tunCeil = mk(16, 16, (x, R) => {
      R('#f2eee4', 0, 0, 16, 11); R('#d9d3c4', 0, 11, 16, 1); R('#cfc8b6', 0, 5, 16, 1); R('#9aa7b0', 6, 7, 4, 1);
      R('#c9c3b2', 0, 12, 16, 4); R('#fffbe0', 5, 13, 6, 1); R('#8a8470', 0, 15, 16, 1);
    });
  }

  // ---- background decor drawers: everything stands on a floor line `f`, at human scale (a person is ~24px)
  const rect = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const fitSize = (str, size, maxW, o) => { const w = Gfx.measure(str, Object.assign({ size, raw: true }, o)).w; return w > maxW ? Math.max(3.2, size * maxW / w) : size; };
  const D = {
    window(c, x, f) {         // big terminal window onto the apron, with a plane on the tarmac
      const y = f - 52, w = 46;
      rect(c, '#46525c', x, y, w, 40); rect(c, '#bfe2f5', x + 2, y + 2, w - 4, 36); rect(c, '#8dc6e8', x + 2, y + 20, w - 4, 10); rect(c, '#7d8b94', x + 2, y + 30, w - 4, 8);
      rect(c, '#ffffff', x + 14, y + 22, 18, 3); rect(c, '#ffffff', x + 24, y + 18, 2, 11); rect(c, '#ffffff', x + 12, y + 20, 2, 3); rect(c, '#c0392b', x + 12, y + 20, 2, 1);
      rect(c, '#46525c', x + w / 2 - 1, y + 2, 2, 36);
    },
    departures(c, x, f) {     // flight information board
      const y = f - 44;
      rect(c, '#2b3340', x, y, 40, 28); rect(c, '#0e1a26', x + 1, y + 1, 38, 26);
      Gfx.text(c, 'DEPARTURES', x + 20, y + 3, { font: 'label', size: 3.4, color: '#ffd23f', align: 'center' });
      [['LHR', '09:40'], ['JFK', '10:15'], ['SYD', '11:05'], ['DXB', '11:50']].forEach((r, i) => {
        Gfx.text(c, r[0], x + 5, y + 9 + i * 4.5, { raw: true, bold: true, size: 3.6, color: '#ffd23f' });
        Gfx.text(c, r[1], x + 28, y + 9 + i * 4.5, { raw: true, bold: true, size: 3.6, color: '#7dffb0', align: 'center' });
      });
    },
    gate(c, x, f) {           // hanging gate sign
      rect(c, '#78909c', x + 5, f - 70, 1, 12); rect(c, '#78909c', x + 25, f - 70, 1, 12);
      rect(c, '#1f4e79', x, f - 58, 30, 14); rect(c, '#ffd23f', x + 1, f - 57, 28, 12); rect(c, '#1f4e79', x + 2, f - 56, 26, 10);
      Gfx.text(c, 'GATE 14', x + 15, f - 54, { raw: true, bold: true, size: 5.4, color: '#ffd23f', align: 'center' });
    },
    clock(c, x, f) {
      Gfx.disc(c, x + 10, f - 62, 10, '#46525c'); Gfx.disc(c, x + 10, f - 62, 8, '#ffffff');
      rect(c, '#2b3340', x + 9, f - 68, 1, 6); rect(c, '#2b3340', x + 10, f - 62, 5, 1); rect(c, '#c0392b', x + 9, f - 62, 1, 1);
    },
    plant(c, x, f) {
      rect(c, '#46525c', x + 2, f - 10, 10, 10); rect(c, '#78909c', x + 2, f - 10, 10, 2); rect(c, '#2f7d4f', x - 1, f - 22, 6, 12); rect(c, '#3f9b5a', x + 4, f - 28, 6, 18);
      rect(c, '#2f7d4f', x + 9, f - 20, 6, 10); rect(c, '#5fba7d', x + 5, f - 26, 2, 6);
    },
    pillar(c, x, f) {
      rect(c, '#9aa7b0', x, f - 70, 14, 5); rect(c, '#cfd6db', x + 1, f - 65, 12, 61); rect(c, '#9aa7b0', x + 4, f - 65, 1, 61); rect(c, '#b4c0ca', x + 9, f - 65, 1, 61);
      rect(c, '#9aa7b0', x, f - 9, 14, 4);
    },
    seats(c, x, f) {          // row of gate seating
      for (let i = 0; i < 3; i++) { rect(c, '#2b6cb0', x + i * 14, f - 16, 12, 6); rect(c, '#4f93d9', x + i * 14, f - 16, 12, 1); rect(c, '#1f4e79', x + i * 14, f - 24, 12, 8); rect(c, '#78909c', x + i * 14 + 5, f - 10, 2, 6); }
      rect(c, '#9aa7b0', x - 1, f - 12, 44, 1);
    },
    board(c, x, y, n) {
      const list = C.NOTICES_AIR, nt = list[n % list.length], w = 46, h = 30;
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
    areaStyle: { terminal: { wall: '#dfe8ef', accent: '#27476b' } },
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

    /** Mario-simple backdrop in WORLD coordinates: one flat pale wall, a navy band and a few faded floor-level pieces. */
    drawBackground(ctx, camX, time, areaKey, camY, L) {
      camY = camY || 0;
      const W = Math.ceil(C.VIEW_W / C.ZOOM) + 2, H = Math.ceil(C.VIEW_H / C.ZOOM) + 2, R = Gfx.px, cx = Math.round(camX);
      R(ctx, ST.wall, 0, camY, W, H);
      const f = 240;
      R(ctx, '#27476b', 0, f - 22, W, 17); R(ctx, '#4f93d9', 0, f - 22, W, 1); R(ctx, '#e8742a', 0, f - 23, W, 1);
      R(ctx, '#1a2f47', 0, f - 5, W, 5); R(ctx, '#2f4d6e', 0, f - 5, W, 1);
      const P = 192, n0 = Math.floor((cx - 60) / P), n1 = Math.floor((cx + W) / P) + 1;
      ctx.globalAlpha = 0.85;
      for (let n = n0; n <= n1; n++) {
        const h = hash(n, 0);
        const kind = ['window', 'departures', 'seats', 'plant', 'gate', 'pillar', 'window', 'clock'][(h >>> 4) % 8], x = n * P + 24 + (h >>> 9) % 50 - cx;
        if (n % 5 === 0) {
          const spot = L && boardSpot(L, n, P);
          if (spot) { D.board(ctx, spot.x - cx, spot.y, Math.round(n / 5) + 1000); continue; }
          if (!L) { D.board(ctx, x, 158, Math.round(n / 5) + 1000); continue; }
        }
        D[kind](ctx, x, f);
      }
      ctx.globalAlpha = 1;
      // wall-mounted direction signs (ground floor), world-locked
      for (const s of this.signs) {
        const sx = s.col * 16 + 8 - cx;
        const w = Math.round(Gfx.measure(s.text, { size: 5, raw: true, bold: true }).w) + 8;
        if (sx + w < 0 || sx - w > W) continue;
        const sy = 194;
        R(ctx, '#78909c', Math.round(sx - w / 2 + 3), sy - 2, 1, 2); R(ctx, '#78909c', Math.round(sx + w / 2 - 4), sy - 2, 1, 2);
        R(ctx, '#ffd23f', Math.round(sx - w / 2), sy, w, 10); R(ctx, s.color || '#1f4e79', Math.round(sx - w / 2 + 1), sy + 1, w - 2, 8);
        Gfx.text(ctx, s.text, Math.round(sx), sy + 2.6, { raw: true, bold: true, size: 5, color: '#ffffff', align: 'center' });
      }
    },
    areaKeyAt() { return 'terminal'; },

    /** Open baggage chutes, drawn behind tiles. */
    drawFloorExtras(ctx, camX, L, time) {
      const T = C.TILE, R = Gfx.px;
      for (const p of L.pits) {
        const x = p.from * T - camX, w = (p.to - p.from + 1) * T;
        if (x + w < 0 || x > C.VIEW_W) continue;
        R(ctx, '#0b0e12', x, 240, w, 32); R(ctx, '#161b21', x + 2, 240, w - 4, 32);
        R(ctx, '#3b4a63', x + 4, 240, 2, 32); R(ctx, '#3b4a63', x + w - 6, 240, 2, 32);
        const dy = 252 + Math.round((time * 14) % 12);
        R(ctx, '#2f3a44', x + 6, dy, w - 12, 3);
        R(ctx, 'rgba(232,116,42,0.35)', x + 6, 262, w - 12, 10);
        Gfx.text(ctx, 'BAGGAGE\nCHUTE', x + w / 2, 248, { color: '#ffd23f', align: 'center' });
        for (let i = 0; i < w; i += 6) { R(ctx, '#ffd23f', x + i, 238, 3, 2); R(ctx, '#1a1a1a', x + i + 3, 238, 3, 2); }
      }
      ctx.fillStyle = 'rgba(120,150,255,0.45)';
      for (let tx = Math.floor(camX / T); tx <= Math.floor((camX + C.VIEW_W) / T); tx++) {
        if (L.slip[tx]) { ctx.fillRect(tx * T - camX, 240, T, 1); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(tx * T - camX + ((tx * 5) % 9) + 2, 240, 3, 1); ctx.fillStyle = 'rgba(120,150,255,0.45)'; }
      }
    },
  };

  // ------------------------------------------------------------------ data
  LEVELS.transport = {
    id: 'transport',
    title: 'Transport',
    message: 'Score attack',
    coinBonus: 1,    // seconds per coin (Healthcare and Manufacturing: C.ATTACK.COIN_BONUS = 0.5)
    npcScale: 0.85,  // about 15% fewer colleagues spawn during the round
    hud: C.HUD_H,    // reserved header strip (the world is drawn below it)
    rolePool: ['agent', 'crew', 'handler', 'officer', 'cleaner', 'captain'],
    zoom: C.ZOOM,
    mode: 'attack',  // timed score-attack round (see js/attack.js and C.ATTACK)
    intro: name => [
      name + ', welcome to the Airport.',
      '',
      'You have 60 seconds to spread your message to your frontline.',
      '',
      'Avoid the CEO and HR Manager, they want to interrupt your message.',
      '',
      'Avoid the obstacles, they slow you down.',
      '',
      'Collect coins to get more time. Messages delivered to Captains get extra time.',
    ],
    goalLine: 'Got it!',
    checkpointLabel: 'Captain sign-off',
    pitText: 'BAGGAGE CHUTE OPEN!',
    areas: [{ key: 'terminal', name: 'Endless Terminal', from: 0, to: 1e9 }],
    endless: true,
    chunkCols: CW,
    generate,
    signs: startSigns,
    map,
    // Colleagues present when the round starts (the first is a few steps from the start).
    npcStart: [
      { role: 'agent', x: 12, y: 15, mode: 'stand' },
      { role: 'handler', x: 24, y: 15, mode: 'roam', range: 3 },
      { role: 'captain', x: 23, y: 9, mode: 'stand' },
      { role: 'crew', x: 28, y: 12, mode: 'stand' },
    ],
    spawnPoints: [10, 15, 20, 24].map(x => ({ x, y: 15, kind: 'ground' })).concat([{ x: 19, y: 12, kind: 'high' }, { x: 23, y: 9, kind: 'high' }, { x: 29, y: 12, kind: 'high' }]),
    entities: first.ents,
    barriers: [],
    ceo: { firstAfterCheckpoint: 1 },
    readRateQuips: [[0, '', '']],
    art,
  };
  art.signs = LEVELS.transport.signs;
  art.areas = LEVELS.transport.areas;
})();
