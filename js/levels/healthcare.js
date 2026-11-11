'use strict';
/* ==========================================================================
   levels/healthcare.js - Healthcare.

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
  // ---- endless hospital: the shared generator (js/levels/endless.js) with the hospital's cast and obstacles
  const { rnd, pick } = Endless;
  const { generate, map, startSigns, first, CW } = Endless.make({
    rolePool: ['nurse', 'doctor', 'porter', 'pharmacist', 'cleaner'],
    leadRole: 'nurseLead',
    signs: ['OUTPATIENTS', 'X-RAY', 'PHARMACY', 'WARD >>', 'THEATRES', 'LAB', 'CAFE', 'LIFTS', 'ICU', 'STAFF ONLY', 'MIND THE LINEN', 'RECOVERY', 'MATERNITY', 'A&E'],
    signColors: ['#2d8f87', '#c0392b', '#5b7fa6', '#2f9d62', '#46607a'],
    obstacle: (ch, x, range) => ch.ents.push({ type: 'trolley', variant: pick(['gurney', 'meds', 'linen']), x: ch.c0 + x, range }),
    firstObstacle: first => first.ents.push({ type: 'trolley', variant: 'gurney', x: 29, range: 1 }),
    startSign: 'MAIN ENTRANCE',
    tunnelNames: [['Staff Corridor', 'Crowded: push through'], ['Staff Lounge', 'Break time: wade through']],
  });

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
      R(v ? '#b4cecb' : '#bcd5d2', 0, 0, 16, 16); R('#ffffff', 0, 0, 16, 1); R('#f1f9f8', 0, 1, 16, 1);
      R('#a9c4c1', 0, 2, 16, 1); R('#b7cfcc', 0, 0, 1, 16); R('#e9f4f3', 3, 6, 4, 1); R('#c6dad7', 9, 10, 5, 1);
    }));
    S.floorBody = [0, 1].map(v => mk(16, 16, (x, R) => {
      R(v ? '#a2bfbc' : '#abc6c3', 0, 0, 16, 16); R('#a9c4c1', 0, 0, 1, 16); R('#a9c4c1', 0, 15, 16, 1);
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
      } else if (style === 1) { // wall-mounted medical cabinet
        R('#ffffff', 0, 0, 16, 2); R('#37474f', 0, 2, 16, 11); R('#7fb7b1', 1, 3, 14, 9); R('#9fd0ca', 1, 3, 14, 2); R('#37474f', 7, 3, 2, 9);
        R('#ffffff', 5, 6, 1, 3); R('#ffffff', 10, 6, 1, 3); R('#5a9a94', 1, 11, 14, 1);
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

  // ---- background decor drawers. Everything stands on a floor line `f` and is drawn at human scale
  // (a person is about 24px, a door 36px), so the player walks along the wall instead of in front of a poster.
  const rect = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const fitSize = (str, size, maxW, o) => { const w = Gfx.measure(str, Object.assign({ size, raw: true }, o)).w; return w > maxW ? Math.max(3.2, size * maxW / w) : size; };
  const D = {
    door(c, x, f) {
      const y = f - 36;
      rect(c, '#9fb4b8', x, y, 24, 36); rect(c, '#cfe3e1', x + 2, y + 2, 10, 34); rect(c, '#c1d8d6', x + 12, y + 2, 10, 34);
      rect(c, '#8fa9ad', x + 11, y + 2, 2, 34); rect(c, '#a9d6ee', x + 4, y + 6, 6, 10); rect(c, '#a9d6ee', x + 14, y + 6, 6, 10);
      rect(c, '#e8f6fc', x + 4, y + 6, 6, 2); rect(c, '#e8f6fc', x + 14, y + 6, 6, 2);
      rect(c, '#78909c', x + 8, y + 20, 1, 6); rect(c, '#78909c', x + 15, y + 20, 1, 6); rect(c, '#9fb4b8', x + 2, f - 5, 20, 4);
    },
    window(c, x, f) {
      const y = f - 38;
      rect(c, '#ffffff', x, y, 32, 26); rect(c, '#cfeaf7', x + 2, y + 2, 28, 22); rect(c, '#e8f6fc', x + 2, y + 2, 28, 8);
      rect(c, '#a3c3d3', x + 3, y + 14, 5, 10); rect(c, '#b4d2e0', x + 10, y + 11, 6, 13); rect(c, '#a3c3d3', x + 18, y + 15, 5, 9); rect(c, '#b4d2e0', x + 24, y + 12, 5, 12);
      rect(c, '#ffffff', x + 6, y + 5, 7, 2); rect(c, '#ffffff', x + 20, y + 6, 6, 2);
      rect(c, '#ffffff', x + 15, y + 2, 2, 22); rect(c, '#c3d8d5', x - 2, y + 26, 36, 2);
    },
    board(c, x, y, n) {   // y = top of the board
      const nt = C.NOTICES[n % C.NOTICES.length], w = 46, h = 30;
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
    clock(c, x, f, t) {
      const cx = x + 7, cy = f - 30;
      Gfx.disc(c, cx, cy, 7, '#37474f'); Gfx.disc(c, cx, cy, 6, '#ffffff');
      c.fillStyle = '#37474f';
      for (let i = 0; i < 12; i += 3) c.fillRect(cx + Math.round(Math.sin(i / 12 * 6.283) * 5), cy - Math.round(Math.cos(i / 12 * 6.283) * 5), 1, 1);
      const a = t * 0.2, b = t * 0.0167;
      for (let i = 1; i <= 3; i++) c.fillRect(cx + Math.round(Math.sin(b) * i), cy - Math.round(Math.cos(b) * i), 1, 1);
      c.fillStyle = '#e03131';
      for (let i = 1; i <= 5; i++) c.fillRect(cx + Math.round(Math.sin(a) * i), cy - Math.round(Math.cos(a) * i), 1, 1);
    },
    cross(c, x, f) {
      Gfx.disc(c, x + 8, f - 28, 8, '#ffffff'); Gfx.disc(c, x + 8, f - 28, 7, '#5fb8b0');
      rect(c, '#ffffff', x + 6, f - 33, 4, 10); rect(c, '#ffffff', x + 3, f - 30, 10, 4);
    },
    xray(c, x, f) {
      const y = f - 32;
      rect(c, '#263238', x, y, 28, 22); rect(c, '#d6efff', x + 2, y + 2, 24, 18); rect(c, '#b7dcf5', x + 2, y + 2, 24, 4);
      rect(c, '#ffffff', x + 13, y + 4, 2, 14); for (let i = 0; i < 4; i++) rect(c, '#ffffff', x + 8, y + 6 + i * 3, 12, 1);
      rect(c, '#9fc4de', x + 6, y + 6, 1, 10); rect(c, '#9fc4de', x + 21, y + 6, 1, 10);
    },
    plant(c, x, f) {
      rect(c, '#b07a52', x + 3, f - 8, 10, 8); rect(c, '#8a5a36', x + 3, f - 8, 10, 1);
      rect(c, '#3f9b5a', x + 6, f - 22, 4, 14); rect(c, '#58c277', x + 2, f - 18, 4, 6); rect(c, '#58c277', x + 10, f - 19, 4, 6); rect(c, '#3f9b5a', x, f - 13, 4, 3); rect(c, '#3f9b5a', x + 12, f - 12, 4, 3);
    },
    bench(c, x, f) {
      rect(c, '#5fb8b0', x, f - 12, 34, 5); rect(c, '#2d8f87', x, f - 7, 34, 2); rect(c, '#78909c', x + 3, f - 5, 2, 5); rect(c, '#78909c', x + 29, f - 5, 2, 5);
      rect(c, '#5fb8b0', x, f - 20, 34, 6); rect(c, '#2d8f87', x, f - 15, 34, 1);
    },
    sanitiser(c, x, f) {
      rect(c, '#e8453c', x, f - 18, 5, 12); rect(c, '#ffffff', x + 1, f - 15, 3, 4); rect(c, '#9fb4b8', x + 1, f - 20, 3, 2);
    },
  };
  const DECOR = ['door', 'window', 'plant', 'door', 'window', 'xray', 'bench', 'clock', 'window', 'door', 'cross', 'board'];   // a noticeboard is also forced every 5th bay (below)
  const DECOR_W = { door: 24, window: 32, board: 46, clock: 14, cross: 16, xray: 28, plant: 16, bench: 34, sanitiser: 5 };
  const hash = (a, b) => { let h = Math.imul(a | 0, 0x45d9f3b) ^ Math.imul((b | 0) + 7, 0x27d4eb2d); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return h >>> 0; };
  const STOREYS = [240, 192, 144, 96];   // floor line of each tier (row 15, 12, 9, 6)

  // Noticeboards hang high on the wall, in a spot with no tiles (platforms, blocks, rooms, machines) in or just below it,
  // so no colleague, trolley or platform can stand in front of one. Decided once per slot from the generated map.
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
    // only cache once the stretch has been generated (columns beyond the map read as empty)
    if ((n * P + 200) / 16 < L.cols) m.set(n, found);
    return found;
  }

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
    drawBackground(ctx, camX, time, areaKey, camY, L) {
      // Drawn in WORLD coordinates (the level has already scaled and scrolled the context), only what is on screen.
      camY = camY || 0;
      const W = Math.ceil(C.VIEW_W / C.ZOOM) + 2, H = Math.ceil(C.VIEW_H / C.ZOOM) + 2, R = Gfx.px;
      const y0 = camY, y1 = camY + H, cx = Math.round(camX);
      const st = this.areaStyle[areaKey] || this.areaStyle.corridor;
      ST.wall = '#e6efee';
      ST.accent = Gfx.lerpColor(ST.accent, st.accent, 0.04);
      R(ctx, ST.wall, 0, y0, W, H);
      // Mario-style backdrop: one flat wall colour, a single skirting line, and a few quiet scenery pieces
      // (door, window, plant, noticeboard) at floor level, faded so the player, colleagues and platforms stand out.
      const f = 240;
      R(ctx, '#d3e0de', 0, f - 5, W, 5); R(ctx, '#c4d4d2', 0, f - 5, W, 1);
      const P = 192, n0 = Math.floor((cx - 60) / P), n1 = Math.floor((cx + W) / P) + 1;
      ctx.globalAlpha = 0.8;
      for (let n = n0; n <= n1; n++) {
        const h = hash(n, 0);
        let kind = ['door', 'window', 'plant', 'window'][(h >>> 4) % 4], x = n * P + 24 + (h >>> 9) % 50 - cx;
        if (n % 5 === 0) {                          // a noticeboard slot: only where nothing can stand or sit in front of it
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
        R(ctx, '#ffffff', Math.round(sx - w / 2), sy, w, 10); R(ctx, s.color || '#2d8f87', Math.round(sx - w / 2 + 1), sy + 1, w - 2, 8);
        Gfx.text(ctx, s.text, Math.round(sx), sy + 2.6, { raw: true, bold: true, size: 5, color: '#ffffff', align: 'center' });
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
    message: 'Score attack',
    route: ['Main Entrance', 'Corridors', 'Admissions', 'Radiology', 'Pharmacy', 'Ward 4'],
    hud: C.HUD_H,    // reserved header strip (the world is drawn below it)
    rolePool: ['nurse', 'doctor', 'porter', 'pharmacist', 'cleaner', 'nurseLead'],
    zoom: C.ZOOM,    // drawn closer, with a camera that also follows you up and down (see Game.updateCamera)
    mode: 'attack',   // timed score-attack round (see js/attack.js and C.ATTACK)
    intro: name => [
      name + ', welcome to the Hospital.',
      '',
      'You have 60 seconds to spread your message to your frontline.',
      '',
      'Avoid the CEO and HR Manager, they want to interrupt your message.',
      '',
      'Avoid the obstacles, they slow you down.',
      '',
      'Collect coins to get more time. Messages delivered to NUMs get extra time.',
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
