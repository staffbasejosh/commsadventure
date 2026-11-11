'use strict';
/* ==========================================================================
   levels/finance.js - Finance (a high-street bank branch).

   The same 60-second score-attack round as Healthcare and Manufacturing (see levels/endless.js, js/attack.js and
   C.ATTACK), set in an endless bank branch: frontline colleagues (tellers, security guards, home loan specialists,
   financial advisers, cleaners and Branch Managers, who count triple and add time) to reach, coins for time, two
   choke-point Staff Break Rooms and the CEO / HR Manager chasing you after them. Obstacles: ATMs, vault safes,
   rolling office chairs and cash trolleys, plus customer queues. Everything slows you down; nothing scores.

   MAP LEGEND (one character = one 16x16 tile; map is 17 rows high)
     .  empty                 #  marble floor          X  solid wall block
     B  archive box (breakable)       D  marble pillar (solid)      V  ATM (solid, 2x2)
     R  vault safe (solid)    Y / Z  staff room wall / ceiling (solid)
     -  one-way platform (teller counter / safe deposit rack / marble ledge; Down drops through)
     ?  engagement block (coins)  P / E / T / K  power-up blocks
     c  engagement coin           w  wet floor sign (slippery)   o  coffee spill (slippery)
     S  player start
   Gaps in the floor rows are open vault hatches.
   ========================================================================== */
(function () {
  // ---- endless bank branch: the shared generator with the bank's cast and obstacles
  const { pick } = Endless;
  const { generate, map, startSigns, first, CW } = Endless.make({
    rolePool: ['teller', 'guard', 'loans', 'advisor', 'cleaner', 'manager'],
    leadRole: 'manager',
    signs: ['TELLERS', 'HOME LOANS', 'ENQUIRIES', 'SAFE DEPOSIT', 'STAFF ONLY', 'ATMs', 'FOREIGN EXCHANGE', 'INVESTMENTS', 'NEW ACCOUNTS', 'CASH DESK', 'MORTGAGES', 'CUSTOMER SERVICE', 'SECURITY', 'SAVINGS'],
    signColors: ['#1f7a5a', '#1f4e79', '#8a6b1f', '#46607a', '#7a3b2e'],
    // office chairs and cash trolleys; customer queues (3 side by side) join in, more often as you go
    obstacle: (ch, x, range, hard, tunnel) => {
      const r = Math.random(), x0 = ch.c0 + x;
      if (tunnel) return ch.ents.push({ type: 'trolley', variant: hard ? 'cashcart' : 'chair', x: x0, range });
      if (r < (hard ? 0.38 : 0.22)) ch.ents.push({ type: 'union', theme: 'queue', x: x0 - 1, count: 3, signs: pick([['NOW\nSERVING 47', 'TAKE A\nTICKET'], ['NEXT\nPLEASE', 'NOW\nSERVING 12'], ['QUEUE\nHERE', 'NEXT\nPLEASE']]) });
      else ch.ents.push({ type: 'trolley', variant: pick(['chair', 'chair', 'cashcart']), x: x0, range });
    },
    firstObstacle: first => first.ents.push({ type: 'trolley', variant: 'chair', x: 29, range: 1 }),
    coinRate: 0.6,            // fewer coin trails (each coin is worth a full second here)
    npcScale: 0.85,           // about 15% fewer colleagues
    corridorGap: [4, 5],      // the second corridor (and the HR Manager) arrives sooner...
    postHr: { extra: 2 },     // ...and the floor gets busier after that
    startSign: 'MAIN BRANCH',
    tunnelNames: [['Staff Break Room', 'Chairs everywhere: push through'], ['Staff Break Room', 'Lunch rush: wade through']],
  });

  // ------------------------------------------------------------------ art
  let S = null; // sprite cache
  function mk(w, h, fn) {
    const { c, x } = Gfx.canvas(w, h);
    fn(x, (col, rx, ry, rw, rh) => { x.fillStyle = col; x.fillRect(rx, ry, rw, rh); });
    return c;
  }
  const ST = { wall: '#efe9db', accent: '#2f5d50' };
  const slice4 = big => { const t = (sx, sy) => mk(16, 16, x => x.drawImage(big, sx, sy, 16, 16, 0, 0, 16, 16)); return { tl: t(0, 0), tr: t(16, 0), bl: t(0, 16), br: t(16, 16) }; };

  function buildSprites() {
    S = {};
    // marble floor: cream with a checker tint and grey veins
    S.floorTop = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#ddd6c4' : '#e9e3d3', 0, 0, 16, 16); R('#f7f3e8', 0, 0, 16, 1); R('#cfc8b4', 0, 1, 16, 1);
      R('#a89f88', 0, 2, 16, 1); R('#b9b19b', 0, 0, 1, 16); R('#c4bca8', 3, 7, 5, 1); R('#aaa28d', 9, 11, 4, 1); R('#c4bca8', 11, 5, 3, 1);
    }));
    S.floorBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#6a6453' : '#736d5b', 0, 0, 16, 16); R('#58523f', 0, 0, 1, 16); R('#58523f', 0, 15, 16, 1);
      R('#867f6a', 4, 4, 3, 1); R('#625c4a', 9, 9, 4, 1); R('#4f4a39', 2, 2, 2, 2); R('#4f4a39', 12, 12, 2, 2);
    }));
    S.crate = mk(16, 16, (x, R) => { // archive box: white lidded file box with a label
      R('#6b5d3f', 0, 0, 16, 16); R('#e6dcc0', 1, 1, 14, 14); R('#f4ecd6', 1, 1, 14, 2); R('#c9bd9b', 1, 4, 14, 1); R('#c9bd9b', 1, 13, 14, 2);
      R('#ffffff', 4, 6, 8, 5); R('#1f4e79', 5, 7, 6, 1); R('#9aa7b0', 5, 9, 4, 1); R('#6b5d3f', 6, 12, 4, 1);
    });
    const qb = (fill, edge, hi) => mk(16, 16, (x, R) => {
      R('#4a3200', 0, 0, 16, 16); R(edge, 1, 1, 14, 14); R(fill, 2, 2, 12, 12); R(hi, 2, 2, 12, 2);
      R('#4a3200', 2, 2, 1, 1); R('#4a3200', 13, 2, 1, 1); R('#4a3200', 2, 13, 1, 1); R('#4a3200', 13, 13, 1, 1);
      Gfx.text(x, '?', 6, 4, { scale: 2, color: '#ffffff', shadow: '#4a3200' });
    });
    S.q = [qb('#f59e0b', '#fcd34d', '#fbbf24'), qb('#fbbf24', '#fde68a', '#fcd34d')];
    S.used = mk(16, 16, (x, R) => { R('#4b555c', 0, 0, 16, 16); R('#7b868d', 1, 1, 14, 14); R('#96a1a8', 2, 2, 12, 12); R('#6b767d', 4, 6, 8, 4); });
    S.duct = mk(16, 16, (x, R) => { // marble pillar block
      R('#4f5f5a', 0, 0, 16, 16); R('#6f827b', 1, 1, 14, 14); R('#8aa098', 1, 1, 14, 2); R('#5f726b', 4, 3, 1, 12); R('#5f726b', 10, 3, 1, 12);
      R('#c9a227', 0, 0, 16, 1); R('#c9a227', 0, 15, 16, 1); R('#9aa8a2', 7, 4, 2, 1); R('#9aa8a2', 6, 9, 3, 1);
    });
    // ATM 2x2: charcoal body, green header, lit screen, keypad, card slot and a glowing cash tray
    const atm = mk(32, 32, (x, R) => {
      R('#2b3340', 0, 0, 32, 32); R('#46526a', 0, 0, 32, 1); R('#1c222c', 0, 0, 1, 32); R('#1c222c', 31, 0, 1, 32); R('#3a4454', 1, 1, 1, 30);
      R('#1f7a5a', 3, 2, 26, 6); R('#2fa07a', 3, 2, 26, 1);
      Gfx.text(x, 'ATM', 16, 3.2, { font: 'label', size: 3.8, color: '#ffffff', align: 'center' });
      R('#0e1a26', 4, 10, 17, 12); R('#3ee0c0', 5, 11, 15, 10); R('#2bb89c', 5, 17, 15, 4); R('#0e1a26', 7, 13, 8, 1); R('#0e1a26', 7, 15, 11, 1); R('#fffbe0', 14, 18, 4, 2);
      R('#1c222c', 23, 10, 6, 12); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) R('#9aa7b0', 24 + c * 2, 11 + r * 3, 1, 2);
      R('#0b0e12', 4, 24, 11, 2); R('#f2d46b', 5, 24, 3, 1); R('#c0392b', 18, 24, 4, 2);
      R('#0b0e12', 4, 28, 24, 3); R('#7dffb0', 6, 29, 20, 1); R('#14181f', 0, 31, 32, 1);
    });
    S.vend = slice4(atm);
    S.linenTop = mk(16, 16, (x, R) => { R('#2f3a44', 0, 3, 16, 13); R('#c9a227', 0, 3, 16, 2); R('#3b4a63', 1, 6, 14, 8); });
    S.linenBottom = mk(16, 16, (x, R) => { R('#2f3a44', 0, 0, 16, 16); R('#3b4a63', 1, 0, 14, 14); R('#c9a227', 0, 14, 16, 2); });
    const sw = (used, icon) => mk(16, 16, (x, R) => {
      R('#2f3a44', 0, 0, 16, 16); R('#7b8a97', 1, 1, 14, 14); R('#cfd6db', 1, 1, 14, 2);
      R('#1b232b', 3, 4, 10, 8); R(used ? '#34c768' : '#e03131', 4, 5, 8, 6); R(used ? '#8ff0b3' : '#ff8f87', 4, 5, 8, 2);
      R('#ffffff', 5, 7, 6, 1); R('#ffffff', 5, 9, 6, 1);
    });
    S.sw = { h: sw(false), l: sw(false), hu: sw(true), lu: sw(true) };
    // one-way platforms: 0 teller counter, 1 safe-deposit box rack, 2 marble ledge
    S.plat = [0, 1, 2].map(style => [0, 1, 2, 3].map(pos => mk(16, 16, (x, R) => {
      const L = pos === 0 || pos === 3, Rr = pos === 2 || pos === 3;
      if (style === 0) { // walnut counter with a green leather inlay
        R('#5a3418', 0, 0, 16, 6); R('#8a5a2b', 0, 0, 16, 1); R('#1f7a5a', 1, 1, 14, 2); R('#2fa07a', 1, 1, 14, 1); R('#3d2410', 0, 6, 16, 1);
        R('#6b4423', 0, 7, 16, 2); R('#c9a227', 0, 7, 16, 1);
        if (L) { R('#5a3418', 0, 0, 3, 16); R('#3d2410', 2, 0, 1, 16); }
        if (Rr) { R('#5a3418', 13, 0, 3, 16); R('#3d2410', 13, 0, 1, 16); }
      } else if (style === 1) { // safe-deposit boxes: a strip of little numbered steel doors
        R('#9aa7b0', 0, 0, 16, 2); R('#d3dadd', 0, 0, 16, 1); R('#5b6674', 0, 2, 16, 6);
        for (let i = 0; i < 16; i += 5) { R('#7b8a97', i + 1, 3, 4, 4); R('#c9a227', i + 2, 5, 2, 1); }
        R('#37474f', 0, 8, 16, 1);
        if (L) { R('#52606c', 1, 9, 2, 6); R('#37474f', 0, 14, 4, 2); }
        if (Rr) { R('#52606c', 13, 9, 2, 6); R('#37474f', 12, 14, 4, 2); }
      } else { // cream marble ledge with brass trim
        R('#b3a98c', 0, 0, 16, 5); R('#d9d0b6', 0, 0, 16, 1); R('#8c8268', 0, 5, 16, 1); R('#c9a227', 0, 6, 16, 1); R('#8a6b1f', 0, 7, 16, 1);
        R('#978d72', 4, 2, 4, 1); R('#978d72', 10, 3, 3, 1);
        if (L) { R('#a39980', 0, 5, 3, 11); R('#7d7459', 2, 5, 1, 11); R('#c9a227', 0, 14, 4, 2); }
        if (Rr) { R('#a39980', 13, 5, 3, 11); R('#7d7459', 13, 5, 1, 11); R('#c9a227', 12, 14, 4, 2); }
      }
    })));
    S.wet = mk(16, 16, (x, R) => { // wet floor sign
      for (let i = 0; i < 13; i++) { const w = 3 + Math.floor(i * 0.7); R('#ffd23f', 8 - Math.floor(w / 2), 2 + i, w, 1); }
      R('#c99a00', 6, 14, 5, 1); R('#1a1a1a', 7, 5, 2, 4); R('#1a1a1a', 7, 10, 2, 2); R('#ffe680', 5, 14, 1, 1);
    });
    S.puddle = mk(16, 16, (x, R) => { // coffee spill + paper cup
      R('#3a2414', 1, 13, 14, 3); R('#5a3a22', 3, 12, 10, 1); R('#2a180c', 5, 14, 6, 1); R('#7a5233', 4, 13, 3, 1);
      R('#ffffff', 11, 6, 4, 6); R('#d9d9d9', 11, 11, 4, 1); R('#8a5a2b', 11, 7, 4, 1); R('#c9a227', 12, 9, 2, 1); R('#3a2414', 15, 7, 1, 2);
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
    // vault safe (closed room): riveted steel with a brass dial wheel on every other column
    S.roomTop = mk(16, 16, (x, R) => {
      R('#3a4350', 0, 0, 16, 16); R('#6b7684', 0, 2, 16, 12); R('#97a3b2', 0, 2, 16, 1); R('#3a4350', 0, 13, 16, 3);
      R('#c9a227', 0, 0, 16, 1); R('#aab6c4', 2, 4, 1, 1); R('#aab6c4', 13, 4, 1, 1); R('#aab6c4', 2, 11, 1, 1); R('#aab6c4', 13, 11, 1, 1);
    });
    S.roomBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#6b7684', 0, 0, 16, 16); R('#3a4350', 0, 0, 1, 16); R('#3a4350', 15, 0, 1, 16); R('#8a95a4', 1, 0, 1, 16); R('#3a4350', 0, 15, 16, 1);
      R('#aab6c4', 2, 2, 1, 1); R('#aab6c4', 13, 2, 1, 1); R('#aab6c4', 2, 13, 1, 1); R('#aab6c4', 13, 13, 1, 1);
      if (v) { Gfx.disc(x, 8, 8, 6, '#3a4350'); Gfx.disc(x, 8, 8, 5, '#c9a227'); Gfx.disc(x, 8, 8, 3, '#8a6b1f'); R('#3a4350', 7, 2, 2, 12); R('#3a4350', 2, 7, 12, 2); Gfx.disc(x, 8, 8, 1, '#f2d46b'); }
    }));
    // staff break room walls and ceiling (choke points): warm teal panelling, soft ceiling lights
    S.tunWall = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#2d6a62', 0, 0, 16, 16); R('#245a53', 0, 0, 16, 1); R('#3a7d74', v ? 8 : 0, 2, 8, 12); R('#245a53', v ? 8 : 0, 2, 1, 12);
      R('#c9a227', v ? 9 : 1, 3, 1, 1); R('#c9a227', v ? 14 : 6, 3, 1, 1); R('#c9a227', v ? 9 : 1, 12, 1, 1); R('#c9a227', v ? 14 : 6, 12, 1, 1);
    }));
    S.tunCeil = mk(16, 16, (x, R) => {
      R('#e6dfcc', 0, 0, 16, 10); R('#b9b19b', 0, 10, 16, 6); R('#d3cbb6', 0, 5, 16, 1);
      R('#fffbe0', 3, 11, 10, 2); R('#fff3b0', 4, 12, 8, 1); R('#8a8470', 0, 15, 16, 1);
    });
  }

  // ---- background decor drawers: everything stands on a floor line `f`, at human scale (a person is ~24px)
  const rect = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const fitSize = (str, size, maxW, o) => { const w = Gfx.measure(str, Object.assign({ size, raw: true }, o)).w; return w > maxW ? Math.max(3.2, size * maxW / w) : size; };
  const D = {
    tellerWindow(c, x, f) {   // glass partition over a wooden counter
      rect(c, '#5a3418', x, f - 14, 44, 14); rect(c, '#8a5a2b', x, f - 14, 44, 2); rect(c, '#1f7a5a', x + 2, f - 12, 40, 1);
      rect(c, '#c9a227', x + 2, f - 40, 40, 2); rect(c, '#bfe2f5', x + 3, f - 38, 38, 24); rect(c, '#e6f3fb', x + 3, f - 38, 38, 4);
      rect(c, '#9ec9e0', x + 21, f - 38, 1, 24); rect(c, '#c9a227', x + 18, f - 20, 8, 5); Gfx.text(c, 'CASH', x + 22, f - 19, { font: 'label', size: 3.2, color: '#5a3418', align: 'center' });
    },
    window(c, x, f) {
      const y = f - 44;
      rect(c, '#8a6b1f', x, y, 30, 34); rect(c, '#bfe2f5', x + 2, y + 2, 26, 30); rect(c, '#8dc6e8', x + 2, y + 18, 26, 14);
      rect(c, '#7bb3d6', x + 4, y + 20, 5, 12); rect(c, '#6aa3c8', x + 11, y + 23, 6, 9); rect(c, '#7bb3d6', x + 19, y + 19, 7, 13);
      rect(c, '#8a6b1f', x + 14, y + 2, 2, 30); rect(c, '#8a6b1f', x + 2, y + 16, 26, 2);
    },
    vaultDoor(c, x, f) {      // round vault door in a steel frame
      const y = f - 46;
      rect(c, '#4a5563', x, y, 40, 44); rect(c, '#6b7684', x + 2, y + 2, 36, 40); Gfx.disc(c, x + 20, y + 22, 16, '#8a95a4'); Gfx.disc(c, x + 20, y + 22, 13, '#6b7684');
      Gfx.disc(c, x + 20, y + 22, 7, '#c9a227'); Gfx.disc(c, x + 20, y + 22, 3, '#8a6b1f');
      rect(c, '#c9a227', x + 19, y + 9, 2, 26); rect(c, '#c9a227', x + 7, y + 21, 26, 2);
      rect(c, '#aab6c4', x + 4, y + 4, 2, 2); rect(c, '#aab6c4', x + 34, y + 4, 2, 2); rect(c, '#aab6c4', x + 4, y + 38, 2, 2); rect(c, '#aab6c4', x + 34, y + 38, 2, 2);
    },
    rates(c, x, f) {          // interest rates board
      const y = f - 40;
      rect(c, '#8a6b1f', x, y, 34, 26); rect(c, '#14241d', x + 1, y + 1, 32, 24);
      Gfx.text(c, 'RATES', x + 17, y + 3, { font: 'label', size: 3.6, color: '#f2d46b', align: 'center' });
      ['4.99%', '3.25%', '5.10%'].forEach((t, i) => Gfx.text(c, t, x + 17, y + 9 + i * 5, { raw: true, bold: true, size: 4, color: '#7dffb0', align: 'center' }));
    },
    pillar(c, x, f) {
      rect(c, '#d3cbb6', x, f - 70, 14, 5); rect(c, '#e9e3d3', x + 1, f - 65, 12, 61); rect(c, '#c4bca8', x + 4, f - 65, 1, 61); rect(c, '#c4bca8', x + 9, f - 65, 1, 61);
      rect(c, '#d3cbb6', x, f - 9, 14, 4);
    },
    clock(c, x, f) {
      Gfx.disc(c, x + 10, f - 62, 10, '#8a6b1f'); Gfx.disc(c, x + 10, f - 62, 8, '#fbf7ec');
      rect(c, '#2b3340', x + 9, f - 68, 1, 6); rect(c, '#2b3340', x + 10, f - 62, 5, 1); rect(c, '#c0392b', x + 9, f - 62, 1, 1);
    },
    plant(c, x, f) {
      rect(c, '#8a5a2b', x + 2, f - 10, 10, 10); rect(c, '#b9854a', x + 2, f - 10, 10, 2); rect(c, '#2f7d4f', x - 1, f - 22, 6, 12); rect(c, '#3f9b5a', x + 4, f - 28, 6, 18);
      rect(c, '#2f7d4f', x + 9, f - 20, 6, 10); rect(c, '#5fba7d', x + 5, f - 26, 2, 6);
    },
    stanchion(c, x, f) {      // queue posts with a red rope
      for (const px of [x, x + 22]) { rect(c, '#c9a227', px, f - 16, 2, 16); rect(c, '#8a6b1f', px - 2, f - 2, 6, 2); rect(c, '#c9a227', px - 1, f - 18, 4, 2); }
      rect(c, '#c0392b', x + 2, f - 15, 20, 2);
    },
    board(c, x, y, n) {
      const list = C.NOTICES_FIN, nt = list[n % list.length], w = 46, h = 30;
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
    areaStyle: { bank: { wall: '#efe9db', accent: '#2f5d50' } },
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

    /** Mario-simple backdrop in WORLD coordinates: one flat cream wall, a green wainscot band and a few faded floor-level pieces. */
    drawBackground(ctx, camX, time, areaKey, camY, L) {
      camY = camY || 0;
      const W = Math.ceil(C.VIEW_W / C.ZOOM) + 2, H = Math.ceil(C.VIEW_H / C.ZOOM) + 2, R = Gfx.px, cx = Math.round(camX);
      R(ctx, ST.wall, 0, camY, W, H);
      const f = 240;
      R(ctx, '#2f5d50', 0, f - 22, W, 17); R(ctx, '#3d7565', 0, f - 22, W, 1); R(ctx, '#c9a227', 0, f - 23, W, 1);
      R(ctx, '#4a3b2a', 0, f - 5, W, 5); R(ctx, '#6b5a40', 0, f - 5, W, 1);
      const P = 192, n0 = Math.floor((cx - 60) / P), n1 = Math.floor((cx + W) / P) + 1;
      ctx.globalAlpha = 0.85;
      for (let n = n0; n <= n1; n++) {
        const h = hash(n, 0);
        const kind = ['tellerWindow', 'window', 'vaultDoor', 'plant', 'rates', 'pillar', 'clock', 'stanchion'][(h >>> 4) % 8], x = n * P + 24 + (h >>> 9) % 50 - cx;
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
        R(ctx, '#c9a227', Math.round(sx - w / 2 + 3), sy - 2, 1, 2); R(ctx, '#c9a227', Math.round(sx + w / 2 - 4), sy - 2, 1, 2);
        R(ctx, '#ffffff', Math.round(sx - w / 2), sy, w, 10); R(ctx, s.color || '#1f7a5a', Math.round(sx - w / 2 + 1), sy + 1, w - 2, 8);
        Gfx.text(ctx, s.text, Math.round(sx), sy + 2.6, { raw: true, bold: true, size: 5, color: '#ffffff', align: 'center' });
      }
    },
    areaKeyAt() { return 'bank'; },

    /** Open vault hatches, drawn behind tiles. */
    drawFloorExtras(ctx, camX, L, time) {
      const T = C.TILE, R = Gfx.px;
      for (const p of L.pits) {
        const x = p.from * T - camX, w = (p.to - p.from + 1) * T;
        if (x + w < 0 || x > C.VIEW_W) continue;
        R(ctx, '#0b0e12', x, 240, w, 32); R(ctx, '#161b21', x + 2, 240, w - 4, 32);
        R(ctx, '#3b4a63', x + 4, 240, 2, 32); R(ctx, '#3b4a63', x + w - 6, 240, 2, 32);
        const dy = 252 + Math.round((time * 14) % 12);
        R(ctx, '#2f3a44', x + 6, dy, w - 12, 3);
        R(ctx, 'rgba(201,162,39,0.35)', x + 6, 262, w - 12, 10);
        Gfx.text(ctx, 'VAULT HATCH\nOPEN', x + w / 2, 248, { color: '#ffd23f', align: 'center' });
        for (let i = 0; i < w; i += 6) { R(ctx, '#ffd23f', x + i, 238, 3, 2); R(ctx, '#1a1a1a', x + i + 3, 238, 3, 2); }
      }
      ctx.fillStyle = 'rgba(120,150,255,0.45)';
      for (let tx = Math.floor(camX / T); tx <= Math.floor((camX + C.VIEW_W) / T); tx++) {
        if (L.slip[tx]) { ctx.fillRect(tx * T - camX, 240, T, 1); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(tx * T - camX + ((tx * 5) % 9) + 2, 240, 3, 1); ctx.fillStyle = 'rgba(120,150,255,0.45)'; }
      }
    },
  };

  // ------------------------------------------------------------------ data
  LEVELS.finance = {
    id: 'finance',
    title: 'Finance',
    message: 'Score attack',
    coinBonus: 1,    // seconds per coin (Healthcare and Manufacturing: C.ATTACK.COIN_BONUS = 0.5)
    npcScale: 0.85,  // about 15% fewer colleagues spawn during the round
    hud: C.HUD_H,    // reserved header strip (the world is drawn below it)
    rolePool: ['teller', 'guard', 'loans', 'advisor', 'cleaner', 'manager'],
    zoom: C.ZOOM,
    mode: 'attack',  // timed score-attack round (see js/attack.js and C.ATTACK)
    intro: name => [
      name + ', welcome to the Bank.',
      '',
      'You have 60 seconds to spread your message to your frontline.',
      '',
      'Avoid the CEO and HR Manager, they want to interrupt your message.',
      '',
      'Avoid the obstacles, they slow you down.',
      '',
      'Collect coins to get more time. Messages delivered to Branch Managers get extra time.',
    ],
    goalLine: 'Got it!',
    checkpointLabel: 'Manager sign-off',
    pitText: 'VAULT HATCH OPEN!',
    areas: [{ key: 'bank', name: 'Endless Branch', from: 0, to: 1e9 }],
    endless: true,
    chunkCols: CW,
    generate,
    signs: startSigns,
    map,
    // Colleagues present when the round starts (the first is a few steps from the start).
    npcStart: [
      { role: 'teller', x: 12, y: 15, mode: 'stand' },
      { role: 'guard', x: 24, y: 15, mode: 'roam', range: 3 },
      { role: 'manager', x: 23, y: 9, mode: 'stand' },
      { role: 'advisor', x: 28, y: 12, mode: 'stand' },
    ],
    spawnPoints: [10, 15, 20, 24].map(x => ({ x, y: 15, kind: 'ground' })).concat([{ x: 19, y: 12, kind: 'high' }, { x: 23, y: 9, kind: 'high' }, { x: 29, y: 12, kind: 'high' }]),
    entities: first.ents,
    barriers: [],
    ceo: { firstAfterCheckpoint: 1 },
    readRateQuips: [[0, '', '']],
    art,
  };
  art.signs = LEVELS.finance.signs;
  art.areas = LEVELS.finance.areas;
})();
