'use strict';
/* ==========================================================================
   levels/healthcare.js - Level 1: Healthcare.

   A level is ONE self-contained file that registers itself on LEVELS.
   Copy this file to add a new industry (see README "Adding a level").
   It provides: text, palette, tile map, entity list, barriers/switches and the
   procedural art (tile sprites + parallax background). Game code is generic.

   MAP LEGEND (one character = one 16x16 tile; map is 17 rows high)
     .  empty                 #  floor / solid           X  solid wall block
     B  supply crate (breakable with Push Notification)  D  ceiling duct (solid)
     V  vending machine (solid)   L  linen cart stack (solid)
     -  one-way platform (gurney / trolley / nurse counter; Down drops through)
     ?  engagement block (coins)  P  block -> Clear Subject Line (speed)
     E  block -> Executive Sponsor (invincible)   T  block -> Translation Tool (double jump)
     K  block -> Push Notification (breaks crates)
     h  door switch block (bump from below)       l  linen-cart switch block
     c  engagement coin           w  wet floor sign (slippery area)   o  coffee puddle (slippery)
     S  player start      1 2 3  "Manager sign-off" checkpoints      N  the Nurse (goal)
   Gaps in the floor rows are "Lift out of service" shafts.
   ========================================================================== */
(function () {
  // ---- endless hospital ------------------------------------------------------
  // Chunk 0 (the entrance) is hand-built; every further 32-column chunk is generated on demand by
  // generate(k) as you run, so the hospital never ends. Three tiers you can roam: the main floor
  // (row 15), mezzanine platforms (row 12), an upper walkway (row 9) and high perches (row 6).
  // Tiers are always linked by overlapping platforms (3 tiles apart), so every platform is reachable.
  const CW = 32, H = 17, SOL = '#XBDVL?PETKhlHJuR';
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[rnd(0, a.length - 1)];
  const ROLE_POOL = ['nurse', 'doctor', 'porter', 'pharmacist', 'cleaner'];
  const SIGNS = ['OUTPATIENTS', 'X-RAY', 'PHARMACY', 'WARD >>', 'THEATRES', 'LAB', 'CAFE', 'LIFTS', 'ICU', 'STAFF ONLY', 'MIND THE LINEN', 'RECOVERY', 'MATERNITY', 'A&E'];
  const SIGN_COLORS = ['#2d8f87', '#c0392b', '#5b7fa6', '#2f9d62', '#46607a'];

  function newChunk(k) {
    const c0 = k * CW;
    const g = Array.from({ length: H }, () => Array(CW).fill('.'));
    for (let c = 0; c < CW; c++) { g[15][c] = '#'; g[16][c] = '#'; }
    const put = (c, r, str) => { for (let i = 0; i < str.length; i++) if (c + i >= 0 && c + i < CW) g[r][c + i] = str[i]; };
    const plat = (a, b, r) => put(a, r, '-'.repeat(b - a + 1));
    const room = (c, w) => { for (let r = 12; r <= 14; r++) put(c, r, 'R'.repeat(w)); };
    const ch = { c0, g, put, plat, room, ents: [], npcs: [], sp: [], signs: [] };
    return ch;
  }
  // Surface at (x,y) with two clear rows above it (room for a person).
  const clearAbove = (g, x, y) => x >= 0 && x < CW && y >= 2 && (g[y][x] === '-' || SOL.includes(g[y][x])) &&
    !SOL.includes(g[y - 1][x]) && g[y - 1][x] !== '-' && !SOL.includes(g[y - 2][x]);
  const groundOk = (g, x) => x >= 1 && x < CW - 1 && [x - 1, x, x + 1].every(cx => g[15][cx] === '#' && !SOL.includes(g[14][cx]) && !SOL.includes(g[13][cx]));
  const addNpc = (ch, x, y, mode, role) => { if (clearAbove(ch.g, x, y)) ch.npcs.push({ role: role || pick(ROLE_POOL), x: ch.c0 + x, y, mode, range: 2 }); };
  const addSp = (ch, x, y) => { if (clearAbove(ch.g, x, y)) ch.sp.push({ x: ch.c0 + x, y, kind: y === 15 ? 'ground' : 'high' }); };
  const addObstacle = (ch, x, range, forklift) => {
    if (!groundOk(ch.g, x)) return;
    ch.ents.push({ type: 'trolley', variant: pick(['gurney', 'meds', 'linen']), x: ch.c0 + x, range });
  };

  // One bay = 16 columns; b0 is its first column. d (0..1) is the difficulty: shorter platforms, fewer coins,
  // and more obstacles up on the platforms the further you get.
  let coinAcc = 0;   // carries the fractional coin chance across trails so the thinning is smooth, not lumpy
  function bay(ch, b0, type, pit, d, k) {
    const { put, plat, room, g } = ch;
    // coins buy time, so they thin out slowly over ~18 stretches (never to zero): both how often a trail appears and how long it is
    const cd = Math.min(1, Math.max(0, (k - 1) / 18));
    const cg = (c, r, n) => { coinAcc += 0.9 - 0.5 * cd; if (coinAcc >= 1) { coinAcc -= 1; put(c, r, 'c'.repeat(Math.max(1, Math.round(n * (1 - 0.35 * cd))))); } };
    // vending machines (2x2, solid) standing on the upper platforms: hop over them. Trolleys stay on the floor.
    const platObs = (x0, x1, row) => {
      if (d < 0.08 || x1 - x0 < 4) return;
      const mid = Math.floor((x0 + x1) / 2);
      if (Math.random() < 0.25 + 0.65 * d) {
        const sx = mid + pick([-1, 0]); put(sx, row - 2, 'VV'); put(sx, row - 1, 'VV');
        if (d > 0.5 && x1 - x0 >= 7 && Math.random() < 0.5) { const ex = Math.random() < 0.5 ? x0 : x1 - 1; if (Math.abs(ex - sx) >= 3) { put(ex, row - 2, 'VV'); put(ex, row - 1, 'VV'); } }
      }
    };
    if (type === 'tower') {
      const c = b0 + 1 + rnd(0, 2), sh = Math.round(2 * d);
      const m = 5 - sh, w0 = m - 1, w1 = w0 + 7 - sh;                       // mezzanine c..c+m, walkway c+w0..c+w1
      plat(c, c + m, 12); plat(c + w0, c + w1, 9);
      cg(c + 1, 11, 3); cg(c + w0 + 2, 8, 3);
      const perch = Math.random() < 0.7;
      if (perch) { plat(c + w0 + 3, c + w1 - 1, 6); cg(c + w0 + 4, 5, 2); }
      platObs(c, c + m, 12); platObs(c + w0 + 2, c + w1, 9);
      addNpc(ch, c + 1, 12, 'stand'); addNpc(ch, c + w0 + 3, 9, Math.random() < 0.5 ? 'roam' : 'stand');
      if (perch) addNpc(ch, c + w0 + 4, 6, 'stand', Math.random() < 0.55 ? 'nurseLead' : undefined);
      addSp(ch, c + 2, 12); addSp(ch, c + w0 + 2, 9); addSp(ch, c + w1 - 1, 9); if (perch) { addSp(ch, c + w0 + 4, 6); addSp(ch, c + w0 + 5, 6); }
      // ground: a closed room, then an obstacle (or a pit instead of the obstacle)
      const rc = c + m + 2;
      room(rc, 3); addNpc(ch, rc + 1, 12, 'stand'); addSp(ch, rc + 1, 12);
      if (pit) { for (let x = b0 + 13; x <= b0 + 15; x++) { g[15][x] = '.'; g[16][x] = '.'; } }
      else if (rc + 5 <= b0 + 14) addObstacle(ch, rc + 5, 1, Math.random() < 0.35 + 0.3 * d);
      addObstacle(ch, c + 1, 1, false);
      addNpc(ch, c + 1, 15, 'stand'); addNpc(ch, rc - 1 > c + m ? rc - 1 : c + m + 1, 15, 'roam');
    } else if (type === 'twin') {
      const c = b0 + 1, a = 6 - Math.round(2 * d);                           // mezzanine length
      plat(c, c + a - 1, 12); plat(c + 8, c + 7 + a, 12); plat(c + a - 2, c + 9, 9);
      const pc = Math.floor((c + a - 2 + c + 9) / 2); plat(pc - 1, pc + 1, 6);
      cg(pc, 5, 2); cg(c + 1, 11, 3); cg(c + 9, 11, 3);
      platObs(c, c + a - 1, 12); platObs(c + 8, c + 7 + a, 12); platObs(c + a - 2, c + 9, 9);
      addNpc(ch, c + 1, 12, 'stand'); addNpc(ch, c + 9, 12, 'stand'); addNpc(ch, pc, 9, 'roam');
      addNpc(ch, pc, 6, 'stand', Math.random() < 0.6 ? 'nurseLead' : undefined);
      addSp(ch, c + 2, 12); addSp(ch, c + 10, 12); addSp(ch, pc - 1, 9); addSp(ch, pc + 1, 9); addSp(ch, pc, 6);
      addObstacle(ch, c + 7, 2, Math.random() < 0.4 + 0.3 * d);
      addNpc(ch, c + 6, 15, 'stand');
    } else { // hall: closed room, stepping platforms, a trolley in the aisle
      room(b0 + 2, 4);
      plat(b0 + 7, b0 + 12, 12); plat(b0 + 10, b0 + 14, 9); plat(b0 + 11, b0 + 14, 6);
      cg(b0 + 8, 11, 3); cg(b0 + 12, 8, 3);
      platObs(b0 + 7, b0 + 12, 12); platObs(b0 + 10, b0 + 14, 9);
      if (Math.random() < 0.5) put(b0 + 14, 11, pick(['?', '?', 'P', 'E', 'T', 'K']));
      addNpc(ch, b0 + 3, 12, 'stand'); addNpc(ch, b0 + 9, 12, 'roam'); addNpc(ch, b0 + 12, 9, 'stand');
      addNpc(ch, b0 + 12, 6, 'stand', Math.random() < 0.5 ? 'nurseLead' : undefined);
      addSp(ch, b0 + 4, 12); addSp(ch, b0 + 8, 12); addSp(ch, b0 + 11, 9); addSp(ch, b0 + 13, 9); addSp(ch, b0 + 12, 6);
      addObstacle(ch, b0 + 9, 1, true);
      addNpc(ch, b0 + 14, 15, 'stand');
    }
    for (const x of [b0, b0 + 15]) addSp(ch, x, 15);
  }

  function finishChunk(ch) {
    ch.signs.push({ col: ch.c0 + rnd(3, 28), text: pick(SIGNS), color: pick(SIGN_COLORS) });
    return { rows: ch.g.map(r => r.join('')), entities: ch.ents, npcs: ch.npcs, spawnPoints: ch.sp, signs: ch.signs, tunnels: ch.tunnels || [] };
  }

  // Choke point: a staff corridor with a low ceiling (no platforms, no big jumps), trolley traffic and
  // colleagues in the way. Moving through it is slower (see C.ATTACK.TUNNEL_SPEED_MULT).
  function tunnelChunk(k, d) {
    const ch = newChunk(k), { g, put } = ch;
    const T0 = 3, T1 = 28;
    for (let r = 0; r <= 11; r++) for (let c = T0; c <= T1; c++) g[r][c] = r === 11 ? 'Z' : 'Y';
    const lounge = (tunnelCount++ % 2) === 1;   // alternate Staff Corridor / Staff Lounge
    ch.tunnels = [{ from: ch.c0 + T0, to: ch.c0 + T1, name: lounge ? 'Staff Lounge' : 'Staff Corridor', sub: lounge ? 'Break time: wade through' : 'Crowded: push through' }];
    const n = 2 + (d > 0.4 ? 1 : 0) + (d > 0.8 ? 1 : 0);
    [8, 14, 20, 25].slice(0, n).forEach((x, i) => addObstacle(ch, x, i % 2 ? 2 : 1, false));
    [[6, 'stand'], [11, 'stand'], [17, 'stand', 'nurseLead'], [23, 'roam'], [27, 'stand']].forEach(([x, m, r]) => addNpc(ch, x, 15, m, r));
    for (const x of [1, 6, 11, 17, 23, 27, 30]) addSp(ch, x, 15);
    put(12, 14, 'cc'); if (d < 0.6) put(21, 14, 'cc');
    return finishChunk(ch);
  }
  let nextTunnel = 6, tunnelCount = 0;

  function generate(k) {
    if (k <= 1) { coinAcc = 0; nextTunnel = rnd(5, 6); tunnelCount = 0; }
    if (tunnelCount < 2 && k >= nextTunnel) { nextTunnel = k + rnd(...C.ATTACK.CORRIDOR_GAP); return tunnelChunk(k, Math.min(1, Math.max(0, (k - 1) / 9))); }   // two corridors only
    const ch = newChunk(k);
    const pick3 = () => { const r = Math.random(); return r < 0.45 ? 'tower' : r < 0.75 ? 'twin' : 'hall'; };
    const d = Math.min(1, Math.max(0, (k - 1) / 9));     // 0 at the start, full difficulty ~10 chunks (~320 tiles) in
    const tA = pick3(), tB = pick3();
    bay(ch, 0, tA, tA === 'tower' && Math.random() < 0.1 + 0.4 * d, d, k);
    bay(ch, 16, tB, tB === 'tower' && Math.random() < 0.3 * d, d, k);
    return finishChunk(ch);
  }

  // Chunk 0: the Main Entrance, hand-built with a nurse a few steps from the start.
  const first = newChunk(0);
  {
    const { put, plat } = first;
    put(3, 14, 'S'); put(6, 14, 'ccc'); put(9, 11, '?.?.?'); plat(17, 22, 12); put(18, 11, 'ccc');
    plat(21, 27, 9); put(22, 8, 'ccc'); put(27, 14, 'w');
    plat(26, 31, 12); put(28, 11, 'ccc');
    first.ents.push({ type: 'trolley', variant: 'gurney', x: 29, range: 1 });
  }
  const map = first.g.map(r => r.join(''));
  first.signs.push({ col: 8, text: 'MAIN ENTRANCE' });
  const startSigns = first.signs;

  // ------------------------------------------------------------------ art
  let S = null; // sprite cache
  function mk(w, h, fn) {
    const { c, x } = Gfx.canvas(w, h);
    fn(x, (col, rx, ry, rw, rh) => { x.fillStyle = col; x.fillRect(rx, ry, rw, rh); });
    return c;
  }
  const ST = { wall: '#e8f1f0', accent: '#a9d8d3' };

  function buildSprites() {
    S = {};
    // floor
    S.floorTop = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#d3e4e2' : '#dcebe9', 0, 0, 16, 16); R('#ffffff', 0, 0, 16, 1); R('#f1f9f8', 0, 1, 16, 1);
      R('#a9c4c1', 0, 2, 16, 1); R('#b7cfcc', 0, 0, 1, 16); R('#e9f4f3', 3, 6, 4, 1); R('#c6dad7', 9, 10, 5, 1);
    }));
    S.floorBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#bdd3d0' : '#c7dbd8', 0, 0, 16, 16); R('#a9c4c1', 0, 0, 1, 16); R('#a9c4c1', 0, 15, 16, 1);
      R('#d0e2df', 4, 4, 3, 1); R('#b2cac7', 9, 9, 4, 1);
    }));
    S.crate = mk(16, 16, (x, R) => {
      R('#8a6234', 0, 0, 16, 16); R('#c89b64', 1, 1, 14, 14); R('#dcb47c', 1, 1, 14, 2); R('#e8d3a8', 7, 1, 2, 14);
      R('#ffffff', 3, 5, 6, 6); R('#e03131', 5, 6, 2, 4); R('#e03131', 4, 7, 4, 2); R('#a87a45', 1, 13, 14, 2);
    });
    const qb = (fill, edge, hi) => mk(16, 16, (x, R) => {
      R('#0d3f3b', 0, 0, 16, 16); R(edge, 1, 1, 14, 14); R(fill, 2, 2, 12, 12); R(hi, 2, 2, 12, 2);
      R('#0d3f3b', 2, 2, 1, 1); R('#0d3f3b', 13, 2, 1, 1); R('#0d3f3b', 2, 13, 1, 1); R('#0d3f3b', 13, 13, 1, 1);
      Gfx.text(x, '?', 6, 4, { scale: 2, color: '#ffffff', shadow: '#0d3f3b' });
    });
    S.q = [qb('#2fb5a8', '#7fe0d6', '#5fd0c4'), qb('#38c7b9', '#9af0e6', '#78e0d4')];
    S.used = mk(16, 16, (x, R) => { R('#59676a', 0, 0, 16, 16); R('#8a9a99', 1, 1, 14, 14); R('#a2b1b0', 2, 2, 12, 12); R('#7b8b8a', 4, 6, 8, 4); });
    S.duct = mk(16, 16, (x, R) => {
      R('#7f8e94', 0, 0, 16, 16); R('#b6c3c8', 0, 1, 16, 12); R('#e1e8eb', 0, 1, 16, 2); R('#97a6ac', 0, 7, 16, 1);
      R('#6d7c82', 0, 13, 16, 3); R('#5a686d', 7, 0, 2, 16); R('#d0d9dc', 2, 4, 3, 1); R('#d0d9dc', 11, 10, 3, 1);
    });
    // vending machine 2x2: tl, tr, bl, br
    const vm = (right, bottom) => mk(16, 16, (x, R) => {
      R('#1f3a4d', 0, 0, 16, 16);
      if (!right) {
        R('#2e5a78', 1, 0, 15, 16);
        if (!bottom) { R('#e03131', 1, 1, 15, 3); Gfx.text(x, 'SNACKS', 2, 2, { color: '#ffffff' }); }
        const gy = bottom ? 0 : 5;
        R('#bfe8f5', 2, gy, 13, bottom ? 9 : 11); R('#ffffff', 2, gy, 13, 1);
        const cols = ['#e8453c', '#f1c232', '#41c47b', '#ff8a4c', '#5db7ff'];
        for (let ry = 0; ry < (bottom ? 2 : 3); ry++) for (let cx = 0; cx < 3; cx++) R(cols[(ry * 3 + cx) % 5], 3 + cx * 4, gy + 1 + ry * 4, 3, 3);
        if (bottom) { R('#14283a', 2, 10, 13, 4); R('#0b1a27', 4, 11, 9, 2); R('#14283a', 1, 15, 15, 1); }
      } else {
        R('#2e5a78', 0, 0, 15, 16);
        if (!bottom) R('#e03131', 0, 1, 15, 3);
        R('#14283a', 3, bottom ? 1 : 6, 9, 7); R('#7ad7ff', 4, bottom ? 2 : 7, 7, 2);
        R('#ffd23f', 4, bottom ? 5 : 10, 2, 2); R('#e8453c', 7, bottom ? 5 : 10, 2, 2); R('#41c47b', 10, bottom ? 5 : 10, 2, 2);
        if (bottom) { R('#0b1a27', 3, 9, 9, 4); R('#14283a', 0, 15, 15, 1); }
      }
    });
    S.vend = { tl: vm(0, 0), tr: vm(1, 0), bl: vm(0, 1), br: vm(1, 1) };
    // staff-corridor choke point: dark panelled wall above, ceiling strip light on the lowest row
    S.tunWall = [0, 1].map(v => mk(16, 16, (x, R) => {
      R('#46636a', 0, 0, 16, 16); R('#3b565c', 0, 0, 16, 1); R('#527076', v ? 8 : 0, 2, 8, 12); R('#3b565c', v ? 8 : 0, 2, 1, 12); R('#5f8088', v ? 9 : 1, 3, 6, 1);
    }));
    S.tunCeil = mk(16, 16, (x, R) => {
      R('#46636a', 0, 0, 16, 11); R('#2f464b', 0, 11, 16, 5); R('#e9fbff', 2, 11, 12, 2); R('#fffdea', 4, 11, 8, 1); R('#2f464b', 0, 15, 16, 1);
    });
    // closed room: solid wall block with a 'no entry' plate on the door tiles
    S.roomTop = mk(16, 16, (x, R) => {
      R('#6e8594', 0, 0, 16, 16); R('#9db3bf', 0, 0, 16, 3); R('#556a77', 0, 13, 16, 3); R('#8197a4', 0, 6, 16, 1);
    });
    S.roomBody = [mk(16, 16, (x, R) => {
      R('#7f95a3', 0, 0, 16, 16); R('#6e8594', 0, 7, 16, 1); R('#556a77', 0, 15, 16, 1); R('#93a8b5', 0, 0, 1, 16);
    }), mk(16, 16, (x, R) => {
      R('#7f95a3', 0, 0, 16, 16); R('#e9eef0', 2, 1, 12, 14); R('#c7d1d6', 2, 1, 12, 1); R('#37474f', 12, 8, 1, 2);
      R('#e03131', 4, 3, 8, 8); R('#ffffff', 5, 6, 6, 2); R('#37474f', 3, 12, 10, 1);
    })];
    // linen cart stack
    S.linenTop = mk(16, 16, (x, R) => {
      R('#cfd8dc', 0, 8, 16, 8); R('#ffffff', 0, 1, 16, 6); R('#e8f1f0', 0, 7, 16, 3); R('#8fd0c8', 0, 4, 16, 1); R('#bfe0dc', 0, 9, 16, 1);
      R('#ffffff', 1, 0, 14, 1); R('#8fd0c8', 0, 10, 16, 1); R('#e8f1f0', 0, 11, 16, 3); R('#6fb9b2', 0, 14, 16, 2);
    });
    S.linenBottom = mk(16, 16, (x, R) => {
      R('#ffffff', 0, 0, 16, 5); R('#8fd0c8', 0, 2, 16, 1); R('#9aa9ae', 0, 5, 16, 2); R('#cfd8dc', 1, 7, 2, 7); R('#cfd8dc', 13, 7, 2, 7);
      R('#e8f1f0', 3, 8, 10, 5); R('#bfe0dc', 3, 10, 10, 1); R('#37474f', 2, 14, 3, 2); R('#37474f', 11, 14, 3, 2);
    });
    const sw = (used, icon) => mk(16, 16, (x, R) => {
      R('#37474f', 0, 0, 16, 16); R('#78909c', 1, 1, 14, 14); R('#cfd8dc', 1, 1, 14, 2);
      R('#0d1b22', 3, 4, 10, 8);
      R(used ? '#41c47b' : '#e8453c', 4, 5, 8, 6); R(used ? '#8ff0b3' : '#ff8f87', 4, 5, 8, 2);
      if (icon === 'door') { R('#ffffff', 6, 7, 4, 3); } else { R('#ffffff', 5, 8, 6, 1); R('#ffffff', 6, 6, 1, 2); R('#ffffff', 6, 10, 1, 1); R('#ffffff', 10, 10, 1, 1); }
    });
    S.sw = { h: sw(false, 'door'), l: sw(false, 'cart'), hu: sw(true, 'door'), lu: sw(true, 'cart') };
    // one-way platforms: style x position (0 left,1 mid,2 right,3 single)
    S.plat = [0, 1, 2].map(style => [0, 1, 2, 3].map(pos => mk(16, 16, (x, R) => {
      const L = pos === 0 || pos === 3, Rr = pos === 2 || pos === 3;
      if (style === 0) { // gurney
        R('#ffffff', 0, 0, 16, 4); R('#e8f1f0', 0, 3, 16, 1); R('#5fb8b0', 0, 4, 16, 2); R('#8a9a99', 0, 6, 16, 1);
        if (L) { R('#5fb8b0', 0, 0, 3, 4); R('#8a9a99', 2, 7, 2, 5); R('#37474f', 1, 12, 4, 3); R('#cfd8dc', 2, 13, 2, 1); }
        if (Rr) { R('#8a9a99', 12, 7, 2, 5); R('#37474f', 11, 12, 4, 3); R('#cfd8dc', 12, 13, 2, 1); }
      } else if (style === 1) { // supply trolley
        R('#b0bec5', 0, 0, 16, 2); R('#eceff1', 0, 0, 16, 1); R('#78909c', 0, 2, 16, 1); R('#5fb8b0', 0, 3, 16, 1);
        R('#cfd8dc', 0, 8, 16, 1);
        if (L) { R('#90a4ae', 1, 3, 2, 10); R('#37474f', 0, 13, 4, 3); }
        if (Rr) { R('#90a4ae', 13, 3, 2, 10); R('#37474f', 12, 13, 4, 3); }
        if (!L && !Rr) { R('#ffffff', 3, 3, 3, 5); R('#8fd0c8', 9, 4, 3, 4); }
      } else { // nurse station counter
        R('#ffffff', 0, 0, 16, 3); R('#cfd8dc', 0, 3, 16, 1); R('#2d8f87', 0, 4, 16, 10); R('#5fb8b0', 0, 4, 16, 2);
        R('#1d6b65', 0, 13, 16, 1); R('#ffffff', 6, 7, 4, 4); R('#e03131', 7, 8, 2, 2); if (L) R('#1d6b65', 0, 4, 1, 10); if (Rr) R('#1d6b65', 15, 4, 1, 10);
      }
    })));
    S.wet = mk(16, 16, (x, R) => {
      for (let i = 0; i < 13; i++) { const w = 3 + Math.floor(i * 0.7); R('#ffd23f', 8 - Math.floor(w / 2), 2 + i, w, 1); }
      R('#c99a00', 6, 14, 5, 1); R('#1a1a1a', 7, 5, 2, 4); R('#1a1a1a', 7, 10, 2, 2); R('#ffe680', 5, 14, 1, 1);
    });
    S.puddle = mk(16, 16, (x, R) => {
      R('#5a3a24', 1, 13, 14, 3); R('#6f4a2f', 3, 12, 10, 1); R('#3f2817', 5, 14, 6, 1);
      R('#ffffff', 11, 7, 4, 5); R('#cfd8dc', 11, 11, 4, 1); R('#5a3a24', 12, 8, 2, 1); R('#ffffff', 15, 8, 1, 2);
    });
    S.coin = [0, 1, 2, 3].map(f => mk(10, 10, (x, R) => {
      const w = [8, 6, 2, 6][f], ox = 5 - w / 2;
      R('#b8860b', ox, 1, w, 8); R('#f6c945', ox + 1, 1, Math.max(1, w - 2), 8); R('#b8860b', ox + 1, 0, Math.max(1, w - 2), 1); R('#b8860b', ox + 1, 9, Math.max(1, w - 2), 1);
      if (w > 4) { R('#fff3b0', ox + 2, 2, 1, 5); R('#b8860b', ox + 3, 4, w - 5, 2); }
    }));
    S.cp = [false, true].map(on => mk(16, 28, (x, R) => {
      R('#78909c', 7, 6, 2, 22); R('#37474f', 4, 26, 8, 2);
      R('#37474f', 0, 0, 16, 14); R(on ? '#bff0cf' : '#ffffff', 1, 1, 14, 12);
      R(on ? '#41c47b' : '#cfd8dc', 1, 1, 14, 3);
      if (on) { R('#1d8a4a', 3, 7, 2, 2); R('#1d8a4a', 5, 8, 2, 2); R('#1d8a4a', 7, 6, 2, 3); R('#1d8a4a', 9, 4, 2, 3); R('#1d8a4a', 11, 3, 2, 3); }
      else { R('#e03131', 6, 5, 4, 7); R('#e03131', 4, 7, 8, 3); }
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

  // ---- background decor drawers (all drawn at layer coordinates, x = left, y = top)
  const D = {
    window(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#ffffff', 0, 0, 52, 62); R('#c3d8d5', 1, 1, 50, 60); R('#cfeaf7', 3, 3, 46, 56); R('#e8f6fc', 3, 3, 46, 18);
      R('#b4d2e0', 3, 38, 8, 21); R('#a3c3d3', 13, 30, 10, 29); R('#b4d2e0', 25, 42, 9, 17); R('#a3c3d3', 36, 34, 13, 25);
      R('#ffffff', 8, 9, 10, 3); R('#ffffff', 11, 7, 6, 2); R('#ffffff', 32, 13, 12, 3);
      R('#ffffff', 24, 3, 3, 56); R('#ffffff', 3, 30, 46, 3); R('#c3d8d5', 0, 62, 52, 3);
    },
    door(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#ffffff', 0, 0, 38, 98); R('#9fc7c3', 2, 2, 34, 96); R('#8ab8b3', 2, 2, 17, 96); R('#bfdcd8', 19, 2, 1, 96);
      R('#e8f6fc', 6, 12, 9, 20); R('#e8f6fc', 23, 12, 9, 20); R('#cfd8dc', 16, 54, 2, 8); R('#cfd8dc', 21, 54, 2, 8);
      R('#37474f', 12, -8, 14, 6); Gfx.text(c, 'WARD', x + 13, y - 7, { color: '#ffffff' });
    },
    clock(c, x, y, t) {
      Gfx.disc(c, x + 12, y + 12, 12, '#37474f'); Gfx.disc(c, x + 12, y + 12, 10, '#ffffff');
      c.fillStyle = '#37474f';
      const a = t * 0.2, b = t * 0.0167;
      for (let i = 0; i < 12; i++) c.fillRect(x + 12 + Math.round(Math.sin(i / 12 * 6.283) * 8), y + 12 - Math.round(Math.cos(i / 12 * 6.283) * 8), 1, 1);
      for (let i = 1; i <= 5; i++) c.fillRect(x + 12 + Math.round(Math.sin(b) * i * 1.3), y + 12 - Math.round(Math.cos(b) * i * 1.3), 1, 1);
      c.fillStyle = '#e03131';
      for (let i = 1; i <= 8; i++) c.fillRect(x + 12 + Math.round(Math.sin(a) * i), y + 12 - Math.round(Math.cos(a) * i), 1, 1);
    },
    board(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#8a6234', 0, 0, 44, 30); R('#e9d9b0', 2, 2, 40, 26);
      R('#ffffff', 4, 4, 10, 10); R('#8fd0c8', 17, 5, 10, 8); R('#ffd9d6', 30, 4, 10, 12); R('#ffffff', 6, 17, 12, 8); R('#fff3b0', 22, 18, 14, 7);
      R('#e03131', 8, 3, 1, 1); R('#2d8f87', 20, 4, 1, 1); R('#37474f', 6, 6, 6, 1); R('#37474f', 6, 9, 5, 1);
    },
    cross(c, x, y) {
      Gfx.disc(c, x + 16, y + 16, 16, '#ffffff'); Gfx.disc(c, x + 16, y + 16, 14, '#5fb8b0');
      c.fillStyle = '#ffffff'; c.fillRect(x + 13, y + 6, 6, 20); c.fillRect(x + 6, y + 13, 20, 6);
    },
    xray(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#263238', 0, 0, 40, 34); R('#d6efff', 2, 2, 36, 30); R('#b7dcf5', 2, 2, 36, 5);
      R('#ffffff', 19, 5, 2, 24); for (let i = 0; i < 5; i++) { R('#ffffff', 11, 9 + i * 4, 18, 1); }
      R('#9fc4de', 9, 9, 2, 16); R('#9fc4de', 29, 9, 2, 16); R('#ff7b72', 17, 3, 6, 2);
    },
    shelf(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#cfd8dc', 0, 0, 56, 74); R('#eceff1', 2, 2, 52, 70);
      const cols = ['#e8453c', '#41c47b', '#f1c232', '#5db7ff', '#ffffff', '#ff8a4c'];
      for (let r = 0; r < 4; r++) { R('#90a4ae', 2, 16 + r * 18, 52, 2); for (let i = 0; i < 8; i++) R(cols[(i + r * 2) % 6], 4 + i * 6, 6 + r * 18, 4, 10); }
      R('#41c47b', 20, 0, 16, 6); R('#ffffff', 27, 1, 2, 4); R('#ffffff', 25, 2, 6, 2);
    },
    plant(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#b07a52', 4, 24, 14, 12); R('#8a5a36', 4, 24, 14, 2);
      R('#3f9b5a', 8, 6, 6, 18); R('#58c277', 3, 12, 6, 8); R('#58c277', 13, 10, 6, 8); R('#3f9b5a', 1, 18, 5, 5); R('#3f9b5a', 16, 17, 5, 5);
    },
    bench(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#5fb8b0', 0, 0, 44, 8); R('#2d8f87', 0, 8, 44, 4); R('#78909c', 3, 12, 3, 10); R('#78909c', 38, 12, 3, 10);
    },
    slidingDoor(c, x, y) {
      const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
      R('#78909c', 0, 0, 70, 104); R('#cfeaf7', 3, 3, 31, 101); R('#cfeaf7', 36, 3, 31, 101); R('#e8f6fc', 3, 3, 31, 24); R('#e8f6fc', 36, 3, 31, 24);
      R('#ffffff', 34, 3, 2, 101); R('#37474f', 4, 50, 1, 14); R('#37474f', 65, 50, 1, 14); R('#e03131', 28, -9, 14, 8); R('#ffffff', 34, -8, 2, 6); R('#ffffff', 31, -6, 8, 2);
    },
  };

  const art = {
    areaStyle: {
      entrance: { wall: '#e9f2f1', accent: '#a9d8d3', decor: ['slidingDoor', 'plant', 'board'] },
      corridor: { wall: '#e8f1f0', accent: '#a9d8d3', decor: ['door', 'clock', 'board', 'xray', 'plant', 'bench', 'shelf', 'cross', 'door'] },
      admissions: { wall: '#efeee6', accent: '#b9d9c5', decor: ['bench', 'board', 'clock', 'plant', 'bench', 'cross'] },
      radiology: { wall: '#d3e0e8', accent: '#8fb2c4', decor: ['xray', 'door', 'xray', 'clock', 'xray', 'cross'] },
      pharmacy: { wall: '#e1f0e6', accent: '#8fd1a8', decor: ['shelf', 'cross', 'shelf', 'clock', 'shelf', 'board'] },
      ward: { wall: '#f1f3ee', accent: '#b4dcd6', decor: ['door', 'clock', 'door', 'board', 'cross', 'plant'] },
    },
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

    /** Parallax hospital corridor. camX in world px. */
    drawBackground(ctx, camX, time, areaKey) {
      const W = C.VIEW_W, H = C.VIEW_H, R = Gfx.px;
      const st = this.areaStyle[areaKey] || this.areaStyle.corridor;
      ST.wall = Gfx.lerpColor(ST.wall, st.wall, 0.04);
      ST.accent = Gfx.lerpColor(ST.accent, st.accent, 0.04);
      R(ctx, ST.wall, 0, 0, W, H);
      // ceiling band, world-locked light panels
      R(ctx, '#f2f7f7', 0, 0, W, 26); R(ctx, '#c9dcda', 0, 26, W, 2); R(ctx, '#aac6c3', 0, 28, W, 1);
      const lp = 112, l0 = -(Math.round(camX * 0.9) % lp);
      for (let x = l0 - lp; x < W + lp; x += lp) { R(ctx, '#d5e5e3', x + 26, 8, 52, 9); R(ctx, '#fffdea', x + 28, 9, 48, 7); R(ctx, 'rgba(255,253,220,0.16)', x + 18, 18, 68, 36); }
      // far layer (windows), parallax 0.25
      const fp = 170, f0 = -(Math.round(camX * 0.25) % fp);
      for (let x = f0 - fp; x < W + fp; x += fp) D.window(ctx, x + 30, 44);
      // mid layer (doors, clocks, boards...), parallax 0.5
      const mp = 150, mOff = Math.round(camX * 0.5);
      const first = Math.floor(mOff / mp) - 1;
      for (let n = first; n < first + Math.ceil(W / mp) + 3; n++) {
        const lx = n * mp + 55 - mOff;
        const wcol = Math.max(0, Math.min(1e6, Math.round(((n * mp + 55 - 240) / 0.5 + 240) / 16)));
        const key = this.areaKeyAt(wcol), kinds = (this.areaStyle[key] || st).decor;
        const kind = kinds[((n % kinds.length) + kinds.length) % kinds.length];
        const y = { door: 84, clock: 56, board: 78, xray: 72, shelf: 100, plant: 142, bench: 150, cross: 56, slidingDoor: 84, window: 44 }[kind];
        if (kind === 'clock') D.clock(ctx, lx, y, time); else D[kind](ctx, lx, y);
      }
      // wainscot + handrail (near layer)
      R(ctx, ST.accent, 0, 176, W, 64); R(ctx, '#ffffff', 0, 172, W, 3); R(ctx, '#c9dcda', 0, 175, W, 1);
      const wp = 48, w0 = -(Math.round(camX * 0.9) % wp);
      for (let x = w0 - wp; x < W + wp; x += wp) { R(ctx, 'rgba(255,255,255,0.28)', x, 180, 1, 60); R(ctx, 'rgba(0,0,0,0.06)', x + 1, 180, 1, 60); }
      R(ctx, '#7aa7a2', 0, 236, W, 4);
      // hanging signs (parallax 0.5), centred on their column when the camera is at it
      for (const s of this.signs) {
        const sx = 240 + 0.5 * (s.col * 16 - 240) - camX * 0.5;
        const w = Gfx.measure(s.text, 1).w + 12;
        if (sx + w < 0 || sx - w > W) continue;
        R(ctx, '#78909c', Math.round(sx - w / 2 + 4), 28, 1, 14); R(ctx, '#78909c', Math.round(sx + w / 2 - 5), 28, 1, 14);
        R(ctx, '#ffffff', Math.round(sx - w / 2), 41, w, 15); R(ctx, s.color || '#2d8f87', Math.round(sx - w / 2 + 1), 42, w - 2, 13);
        Gfx.text(ctx, s.text, Math.round(sx), 46, { color: '#ffffff', align: 'center' });
      }
    },
    areaKeyAt(col) { for (const a of this.areas) if (col >= a.from && col <= a.to) return a.key; return 'corridor'; },

    /** Floor shaft ("Lift out of service") and wet-floor sheen, drawn behind tiles. */
    drawFloorExtras(ctx, camX, L, time) {
      const T = C.TILE, R = Gfx.px;
      for (const p of L.pits) {
        const x = p.from * T - camX, w = (p.to - p.from + 1) * T;
        if (x + w < 0 || x > C.VIEW_W) continue;
        R(ctx, '#0b161b', x, 240, w, 32); R(ctx, '#17262d', x + 2, 240, w - 4, 32);
        R(ctx, '#2b3f48', x + 4, 240, 2, 32); R(ctx, '#2b3f48', x + w - 6, 240, 2, 32);
        const dy = 246 + Math.round((time * 20) % 14);
        R(ctx, '#41545d', x + 6, dy, w - 12, 2);
        Gfx.text(ctx, 'LIFT OUT\nOF SERVICE', x + w / 2, 252, { color: '#ffd23f', align: 'center' });
        // hazard tape across the top
        for (let i = 0; i < w; i += 6) { R(ctx, '#ffd23f', x + i, 238, 3, 2); R(ctx, '#1a1a1a', x + i + 3, 238, 3, 2); }
      }
      ctx.fillStyle = 'rgba(170,225,255,0.55)';
      for (let tx = Math.floor(camX / T); tx <= Math.floor((camX + C.VIEW_W) / T); tx++) {
        if (L.slip[tx]) { ctx.fillRect(tx * T - camX, 240, T, 1); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(tx * T - camX + ((tx * 5) % 9) + 2, 240, 3, 1); ctx.fillStyle = 'rgba(170,225,255,0.55)'; }
      }
    },
  };

  // ------------------------------------------------------------------ data
  LEVELS.healthcare = {
    id: 'healthcare',
    title: 'Healthcare',
    message: 'Handover briefing at 7am',
    route: ['Main Entrance', 'Corridors', 'Admissions', 'Radiology', 'Pharmacy', 'Ward 4'],
    mode: 'attack',   // timed score-attack round (see js/attack.js and C.ATTACK)
    intro: name => [
      name + ', you work in Internal Communications.',
      'Handover is in 75 seconds. Keep running through the endless hospital',
      'and reach as many frontline colleagues as you can.',
      'Check the upper floors: many are up high. Just touch them.',
      'Nurse Leads count triple. Coins add time.',
      'Trolleys, vending machines and closed rooms block the way.',
      'The CEO joins after the first corridor, an HR Manager after',
      'the second. They steal colleagues and stun you. Dodge them.',
    ],
    goalLine: 'Got it!',
    checkpointLabel: 'Manager sign-off',
    areas: [{ key: 'corridor', name: 'Endless Hospital', from: 0, to: 1e9 }],
    endless: true,
    chunkCols: CW,
    generate,
    signs: startSigns,
    map,
    // Colleagues present when the round starts (the first is a few steps from the start).
    npcStart: [
      { role: 'nurse', x: 12, y: 15, mode: 'stand' },
      { role: 'cleaner', x: 19, y: 12, mode: 'stand' },
      { role: 'doctor', x: 24, y: 15, mode: 'roam', range: 3 },
      { role: 'nurseLead', x: 23, y: 9, mode: 'stand' },
      { role: 'porter', x: 28, y: 12, mode: 'stand' },
    ],
    spawnPoints: [10, 15, 20, 24].map(x => ({ x, y: 15, kind: 'ground' })).concat([{ x: 19, y: 12, kind: 'high' }, { x: 23, y: 9, kind: 'high' }, { x: 29, y: 12, kind: 'high' }]),
    entities: first.ents,
    barriers: [],
    ceo: { firstAfterCheckpoint: 1 },
    readRateQuips: [
      [90, 'HIGHER THAN ANY ALL-STAFF EMAIL EVER SENT.', 'THE NURSE SCREENSHOTTED IT.'],
      [70, 'ACTUALLY OPENED. ACTUALLY READ. SUSPICIOUS.', 'LEGAL WANTS A WORD.'],
      [50, 'BETTER THAN THE INTRANET. LOW BAR.', 'STILL, A WIN IS A WIN.'],
      [30, 'SKIMMED WHILE WALKING. CLASSIC.', 'AT LEAST NOBODY REPLIED ALL.'],
      [0, 'MARKED AS READ. NOT READ.', 'THE CEO SENT A FOLLOW-UP.'],
    ],
    art,
  };
  art.signs = LEVELS.healthcare.signs;
  art.areas = LEVELS.healthcare.areas;
})();
