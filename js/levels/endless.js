'use strict';
/* ==========================================================================
   levels/endless.js - the endless, procedurally generated map used by the score-attack levels
   (Healthcare and Manufacturing). Endless.make(cfg) returns { generate, map, startSigns, first, CW }.

   Chunk 0 is hand-built; every further 32-column chunk is generated on demand by generate(k) as you run, so the
   level never ends. Three tiers you can roam: the main floor (row 15), mezzanine platforms (row 12) and an
   upper walkway (row 9), always linked by overlapping platforms (3 tiles apart), so every platform is reachable.
   Roughly every 6 chunks a low-ceilinged choke-point tunnel replaces the platforms (two per run, never a third).

   cfg: rolePool    colleague roles that appear (see ROLES in attack.js)
        leadRole    the bonus role (triple points, +time): Nurse Lead / Shift Supervisor
        signs, signColors   wall sign texts / colours
        obstacle(ch, x, range, hard, tunnel)   pushes a ground obstacle entity onto ch.ents
        firstObstacle(first)                   the obstacle placed in the hand-built first chunk
        startSign   text of the sign by the start
        tunnelNames [[name, subtitle], [name, subtitle]]   alternate the two corridors
   ========================================================================== */
const Endless = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[rnd(0, a.length - 1)];
  function make(cfg) {
  // Chunk 0 (the entrance) is hand-built; every further 32-column chunk is generated on demand by
  // generate(k) as you run, so the hospital never ends. Three tiers you can roam: the main floor
  // (row 15), mezzanine platforms (row 12), and an upper walkway (row 9).
  // Tiers are always linked by overlapping platforms (3 tiles apart), so every platform is reachable.
  const CW = 32, H = 17, SOL = '#XBDVL?PETKhlHJuR';
  const ROLE_POOL = cfg.rolePool, SIGNS = cfg.signs, SIGN_COLORS = cfg.signColors;

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
  // A ground obstacle (level-specific: trolleys, forklifts, union reps...). hard = a tougher one is welcome here.
  const addObstacle = (ch, x, range, hard, tunnel) => {
    if (!groundOk(ch.g, x)) return;
    cfg.obstacle(ch, x, range, !!hard, !!tunnel);
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
      platObs(c, c + m, 12); platObs(c + w0 + 2, c + w1, 9);
      addNpc(ch, c + 1, 12, 'stand'); addNpc(ch, c + w0 + 3, 9, Math.random() < 0.5 ? 'roam' : 'stand', Math.random() < 0.4 ? cfg.leadRole : undefined);
      addNpc(ch, c + w1 - 1, 9, 'stand');
      addSp(ch, c + 2, 12); addSp(ch, c + w0 + 2, 9); addSp(ch, c + w1 - 1, 9);
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
      const pc = Math.floor((c + a - 2 + c + 9) / 2);
      cg(pc, 8, 2); cg(c + 1, 11, 3); cg(c + 9, 11, 3);
      platObs(c, c + a - 1, 12); platObs(c + 8, c + 7 + a, 12); platObs(c + a - 2, c + 9, 9);
      addNpc(ch, c + 1, 12, 'stand'); addNpc(ch, c + 9, 12, 'stand'); addNpc(ch, pc, 9, 'roam', Math.random() < 0.5 ? cfg.leadRole : undefined);
      addNpc(ch, c + 9, 9, 'stand');
      addSp(ch, c + 2, 12); addSp(ch, c + 10, 12); addSp(ch, pc - 1, 9); addSp(ch, pc + 1, 9);
      addObstacle(ch, c + 7, 2, Math.random() < 0.4 + 0.3 * d);
      addNpc(ch, c + 6, 15, 'stand');
    } else { // hall: closed room, stepping platforms, a trolley in the aisle
      room(b0 + 2, 4);
      plat(b0 + 7, b0 + 12, 12); plat(b0 + 10, b0 + 14, 9);
      cg(b0 + 8, 11, 3); cg(b0 + 12, 8, 3);
      platObs(b0 + 7, b0 + 12, 12); platObs(b0 + 10, b0 + 14, 9);
      if (Math.random() < 0.5) put(b0 + 14, 11, pick(['?', '?', 'P', 'E', 'T', 'K']));
      addNpc(ch, b0 + 3, 12, 'stand'); addNpc(ch, b0 + 9, 12, 'roam'); addNpc(ch, b0 + 12, 9, 'stand', Math.random() < 0.5 ? cfg.leadRole : undefined);
      addNpc(ch, b0 + 11, 9, 'stand');
      addSp(ch, b0 + 4, 12); addSp(ch, b0 + 8, 12); addSp(ch, b0 + 11, 9); addSp(ch, b0 + 13, 9);
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
    const tn = cfg.tunnelNames[tunnelCount++ % cfg.tunnelNames.length];   // alternate the two corridor names
    ch.tunnels = [{ from: ch.c0 + T0, to: ch.c0 + T1, name: tn[0], sub: tn[1] }];
    const n = 2 + (d > 0.4 ? 1 : 0) + (d > 0.8 ? 1 : 0);
    [8, 14, 20, 25].slice(0, n).forEach((x, i) => addObstacle(ch, x, i % 2 ? 2 : 1, d > 0.3 && i % 2 === 0, true));
    [[6, 'stand'], [11, 'stand'], [17, 'stand', cfg.leadRole], [23, 'roam'], [27, 'stand']].forEach(([x, m, r]) => addNpc(ch, x, 15, m, r));
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

  // Chunk 0: the entrance, hand-built with a colleague a few steps from the start.
  const first = newChunk(0);
  {
    const { put, plat } = first;
    put(3, 14, 'S'); put(6, 14, 'ccc'); put(9, 11, '?.?.?'); plat(17, 22, 12); put(18, 11, 'ccc');
    plat(21, 27, 9); put(22, 8, 'ccc'); put(27, 14, 'w');
    plat(26, 31, 12); put(28, 11, 'ccc');
    cfg.firstObstacle(first);
  }
  const map = first.g.map(r => r.join(''));
  first.signs.push({ col: 8, text: cfg.startSign });
  const startSigns = first.signs;

    return { generate, map, startSigns, first, CW };
  }
  return { make, rnd, pick };
})();
