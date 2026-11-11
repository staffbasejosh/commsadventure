'use strict';
/* ==========================================================================
   game.js - level world (tiles, collision, items, barriers), state machine,
   camera, fixed-timestep loop and rendering.
   ========================================================================== */
const SOLID = new Set('#XBDVL?PETKhlHJuRYZ'.split(''));
const BLOCKS_WITH_CONTENT = new Set('?PETK'.split(''));

class Level {
  constructor(data, game) {
    this.data = data; this.g = game;
    const T = C.TILE;
    this.rows = data.map.length; this.cols = data.map[0].length;
    this.zoom = data.zoom || 1; this.hudH = data.hud || 0; this.viewW = C.VIEW_W / this.zoom; this.viewH = (C.VIEW_H - this.hudH) / this.zoom;
    data.map.forEach((r, i) => { if (r.length !== this.cols) throw new Error('Level row ' + i + ' has length ' + r.length + ', expected ' + this.cols); });
    this.tiles = data.map.map(r => r.split(''));
    this.time = 0;
    this.start = { x: 3 * T, y: 0 };
    this.checkpoints = []; this.nurseCol = null;
    this.switchTiles = [];
    this.bumps = {}; this.items = []; this.particles = []; this.popups = [];
    this.checkpointIndex = 0; this.completed = false; this.completeT = 0;
    this.currentArea = data.areas[0]; this.lastAreaKey = null;
    this.trail = []; this.trailT = 0; this.safeHist = []; this.safeT = 0;
    this.slip = new Uint8Array(this.cols + 4);

    // parse special tiles
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const ch = this.tiles[y][x];
      if (ch === 'S') { this.start = { x: x * T + 2, y: y * T - C.PLAYER.H + T }; this.tiles[y][x] = '.'; }
      else if (ch >= '1' && ch <= '9') { this.checkpoints.push({ n: +ch, x: x * T, y: y * T, col: x, row: y }); this.tiles[y][x] = '.'; }
      else if (ch === 'N') { this.nurseCol = x; this.tiles[y][x] = '.'; }
      else if (ch === 'w' || ch === 'o') { for (let k = x - 2; k <= x + 2; k++) if (k >= 0 && k < this.cols) this.slip[k] = 1; }
      else if (ch === 'h' || ch === 'l') this.switchTiles.push({ x, y, ch });
    }
    this.checkpoints.sort((a, b) => a.n - b.n);
    // shafts ("Lift out of service"): floor row gaps
    this.pits = [];
    const fr = this.rows - 2;
    for (let x = 0; x < this.cols; x++) {
      if (this.tiles[fr][x] === '.' && this.tiles[fr + 1][x] === '.') {
        let e = x; while (e + 1 < this.cols && this.tiles[fr][e + 1] === '.' && this.tiles[fr + 1][e + 1] === '.') e++;
        this.pits.push({ from: x, to: e }); x = e;
      }
    }
    // barriers (CEO blockers) and their switches
    this.barriers = (data.barriers || []).map(b => ({
      id: b.id, kind: b.kind, x: b.x * T, y: b.y * T, w: b.w * T, h: b.h * T, switch: b.switch,
      state: 'idle', t: 0, wait: 0, delay: b.kind === 'door' ? C.CEO.BARRIER_DELAY_DOOR : C.CEO.BARRIER_DELAY_CART, solidToPlayer: true,
    }));
    this.player = new Player(this.start.x, this.start.y);
    this.enemies = data.entities.map(d => createEnemy(this, d));
    this.attack = data.mode === 'attack';
    this.nurse = this.attack ? { x: -999, y: -999, w: 0, h: 0, received: false, update() {}, draw() {} } : new Nurse(this, this.nurseCol);
    this.ceo = new CEO(this); this.hr = new CEO(this, 'hr'); this.tunnelsPassed = 0; this.curTun = null; this.chaseBoost = 1;
    this.enemies.forEach(e => { /* spawn ground-snap already done in constructor */ });
    this.lastSafe = { x: this.player.x, y: this.player.y };
    this.mapW = this.cols * T; this.tunnels = [];
    this.spawnPoints = (data.spawnPoints || []).slice();
    if (data.endless) { this.signs = (data.signs || []).slice(); data.art.signs = this.signs; }
    if (this.attack) Attack.init(this);
    if (data.endless) this.extendIfNeeded();
  }

  // ---------------------------------------------------------------- endless levels
  /** Append a generated chunk (rows of equal length, entities, colleagues, spawn points) to the right edge. */
  extend(ext) {
    const T = C.TILE, w = ext.rows[0].length, c0 = this.cols;
    for (let y = 0; y < this.rows; y++) for (const ch of ext.rows[y]) this.tiles[y].push(ch);
    this.cols += w; this.mapW = this.cols * T;
    const slip = new Uint8Array(this.cols + 4); slip.set(this.slip); this.slip = slip;
    for (let y = 0; y < this.rows; y++) for (let x = c0; x < this.cols; x++) {
      const ch = this.tiles[y][x];
      if (ch === 'w' || ch === 'o') { for (let k = x - 2; k <= x + 2; k++) if (k >= 0 && k < this.cols) this.slip[k] = 1; }
      else if (ch === 'h' || ch === 'l') this.switchTiles.push({ x, y, ch });
    }
    const fr = this.rows - 2;
    for (let x = c0; x < this.cols; x++) {
      if (this.tiles[fr][x] === '.' && this.tiles[fr + 1][x] === '.') {
        let e = x; while (e + 1 < this.cols && this.tiles[fr][e + 1] === '.' && this.tiles[fr + 1][e + 1] === '.') e++;
        this.pits.push({ from: x, to: e }); x = e;
      }
    }
    for (const d of ext.entities) this.enemies.push(createEnemy(this, d));
    for (const d of ext.npcs) Attack.add(this, d, false, true);
    this.spawnPoints.push(...ext.spawnPoints);
    if (ext.tunnels) this.tunnels.push(...ext.tunnels);
    if (this.signs) this.signs.push(...ext.signs);
  }
  extendIfNeeded() {
    const D = this.data; if (!D.generate) return;
    let guard = 0;
    while (guard++ < 8 && this.mapW - this.player.x < C.ATTACK.AHEAD_TILES * C.TILE) this.extend(D.generate(Math.floor(this.cols / D.chunkCols)));
  }

  // ---------------------------------------------------------------- tile queries
  charAt(tx, ty) {
    if (tx < 0 || tx >= this.cols) return '#';
    if (ty < 0 || ty >= this.rows) return '.';
    return this.tiles[ty][tx];
  }
  solidAt(tx, ty) { return SOLID.has(this.charAt(tx, ty)); }
  solidPx(px, py) { return this.solidAt(Math.floor(px / C.TILE), Math.floor(py / C.TILE)); }
  groundPx(px, py) { const c = this.charAt(Math.floor(px / C.TILE), Math.floor(py / C.TILE)); return SOLID.has(c) || c === '-'; }
  groundTopAt(col, startRow = this.rows - 3) {
    for (let r = startRow; r < this.rows; r++) if (this.solidAt(col, r)) return r * C.TILE;
    return (this.rows - 2) * C.TILE;
  }
  overlapsSolid(x, y, w, h) {
    const T = C.TILE;
    for (let ty = Math.floor(y / T); ty <= Math.floor((y + h - 0.001) / T); ty++)
      for (let tx = Math.floor(x / T); tx <= Math.floor((x + w - 0.001) / T); tx++) if (this.solidAt(tx, ty)) return true;
    return false;
  }
  isSlippery(b) { return !!this.slip[Math.floor((b.x + b.w / 2) / C.TILE)]; }
  standingOnOneWayOnly(b) {
    const T = C.TILE, row = Math.floor((b.y + b.h + 0.5) / T);
    let one = false;
    for (let tx = Math.floor(b.x / T); tx <= Math.floor((b.x + b.w - 0.001) / T); tx++) {
      const c = this.charAt(tx, row);
      if (SOLID.has(c)) return false;
      if (c === '-') one = true;
    }
    return one;
  }

  // ---------------------------------------------------------------- barriers
  solidRectsForPlayer() { return this.barriers.filter(b => b.solidToPlayer && b.state === 'closed'); }
  // For the CEO a closed barrier is a full-height wall, so he can never vault it or land on top of it.
  solidRectsForCEO() { return this.barriers.filter(b => b.state === 'closed').map(b => ({ x: b.x, y: b.y - 240, w: b.w, h: b.h + 240 })); }
  triggerBarrier(b) {
    if (b.state !== 'idle') return;
    b.state = 'closing'; b.t = 0; b.wait = 0;
    if (b.kind === 'door') Sound.play('switch');
  }
  openBarrier(b) { b.state = 'open'; b.t = 0; Sound.play(b.kind === 'pile' ? 'bump' : 'switch'); }
  spawnPile(cx) {
    const T = C.TILE, col = Math.floor(cx / T);
    const top = this.groundTopAt(col);
    this.barriers.push({ id: 'pile' + Math.random(), kind: 'pile', x: cx - 10, y: top - 12, w: 20, h: 12, state: 'closed', t: 0, wait: 0, delay: C.CEO.BARRIER_DELAY_PILE, solidToPlayer: false, temp: true });
  }
  resetBarriers() {
    this.barriers = this.barriers.filter(b => !b.temp);
    for (const b of this.barriers) { b.state = 'idle'; b.t = 0; b.wait = 0; }
    for (const s of this.switchTiles) this.tiles[s.y][s.x] = s.ch;
  }
  updateBarriers(dt) {
    for (const b of this.barriers) {
      if (b.state === 'closing') {
        b.t += dt;
        if (b.t >= (b.kind === 'door' ? 0.35 : 0.5)) { b.state = 'closed'; b.t = 0; Sound.play('slam'); this.shake = 0.25; this.sparkle(b.x + b.w / 2, b.y + b.h, '#cfd8dc', 8); }
      } else if (b.state === 'open') b.t += dt;
    }
  }

  // ---------------------------------------------------------------- collision
  moveBody(b, dx, dy, o) {
    const res = { hitX: false, landed: false, ceil: false, bumped: [] };
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6)); // step <= 6px: no tunnelling
    const sx = dx / n, sy = dy / n;
    for (let i = 0; i < n; i++) {
      if (sx) this._moveX(b, sx, o, res);
      if (sy) this._moveY(b, sy, o, res);
    }
    return res;
  }
  _moveX(b, dx, o, res) {
    const T = C.TILE;
    b.x += dx;
    const ty0 = Math.floor(b.y / T), ty1 = Math.floor((b.y + b.h - 0.001) / T);
    const tx0 = Math.floor(b.x / T), tx1 = Math.floor((b.x + b.w - 0.001) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.solidAt(tx, ty)) { b.x = dx > 0 ? tx * T - b.w : (tx + 1) * T; res.hitX = true; return; }
    }
    if (o && o.rects) for (const r of o.rects) {
      if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) { b.x = dx > 0 ? r.x - b.w : r.x + r.w; res.hitX = true; return; }
    }
  }
  _moveY(b, dy, o, res) {
    const T = C.TILE;
    const prevBottom = b.y + b.h;
    b.y += dy;
    const tx0 = Math.floor(b.x / T), tx1 = Math.floor((b.x + b.w - 0.001) / T);
    const ty0 = Math.floor(b.y / T), ty1 = Math.floor((b.y + b.h - 0.001) / T);
    if (dy > 0) {
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const c = this.charAt(tx, ty);
        if (SOLID.has(c) || (c === '-' && !(o && o.dropThrough) && prevBottom <= ty * T + 0.01)) {
          b.y = ty * T - b.h; b.vy = 0; res.landed = true; return;
        }
      }
    } else {
      let best = null, bestW = 0;
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (this.solidAt(tx, ty)) {
          const w = Math.min(b.x + b.w, (tx + 1) * T) - Math.max(b.x, tx * T);
          if (w > bestW) { bestW = w; best = { tx, ty }; }
          b.y = (ty + 1) * T; b.vy = 0; res.ceil = true;
        }
      }
      if (best) res.bumped.push(best);
    }
    if (o && o.rects) for (const r of o.rects) {
      if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) {
        if (dy > 0) { b.y = r.y - b.h; b.vy = 0; res.landed = true; } else { b.y = r.y + r.h; b.vy = 0; }
        return;
      }
    }
  }

  // ---------------------------------------------------------------- effects
  addPopup(text, x, y, color = '#ffffff') { this.popups.push({ text, x, y, t: 1.2, color }); }
  sparkle(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 120 - 20, t: 0.5 + Math.random() * 0.3, color, s: 2 });
  }
  debris(x, y) {
    for (let i = 0; i < 8; i++) this.particles.push({ x: x + 8, y: y + 8, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 200 - 40, t: 0.9, color: i % 2 ? '#c89b64' : '#8a6234', s: 3, g: true });
  }

  // ---------------------------------------------------------------- blocks
  bumpBlock(tx, ty, p) {
    const T = C.TILE, ch = this.charAt(tx, ty);
    const key = tx + ',' + ty;
    if (BLOCKS_WITH_CONTENT.has(ch)) {
      this.bumps[key] = 0.18; this.tiles[ty][tx] = 'u';
      if (ch === '?') { this.g.addCoin(); this.addPopup(this.coinText(), tx * T + 8, ty * T - 4, '#ffe27a'); Sound.play('coin'); this.sparkle(tx * T + 8, ty * T, '#f6c945', 5); }
      else {
        const kind = { P: 'speed', E: 'sponsor', T: 'djump', K: 'push' }[ch];
        this.items.push({ kind, x: tx * T + 2, y: ty * T, baseY: ty * T - 13, t: 0, alive: true });
        Sound.play('bump');
      }
    } else if (ch === 'B') {
      if (p.power.push > 0) { this.tiles[ty][tx] = '.'; this.debris(tx * T, ty * T); Sound.play('brick'); this.g.addCoin(); this.addPopup(this.coinText(), tx * T + 8, ty * T - 4, '#ffe27a'); }
      else { this.bumps[key] = 0.18; Sound.play('bump'); if (!this.g.hintedPush) { this.g.hintedPush = true; this.g.toastMsg('NEED A PUSH NOTIFICATION TO BREAK THIS', '#5b3a21'); } }
    } else if (ch === 'h' || ch === 'l') {
      this.bumps[key] = 0.18; this.tiles[ty][tx] = ch === 'h' ? 'H' : 'J';
      const b = this.barriers.find(b => b.switch && b.switch.x === tx && b.switch.y === ty);
      if (b) { this.triggerBarrier(b); this.g.toastMsg(b.kind === 'door' ? 'DOOR CLOSED BEHIND YOU!' : 'LINEN CART TIPPED BEHIND YOU!', '#2d6cdf'); }
    } else if (ch !== '.') { this.bumps[key] = 0.1; }
  }

  coinBonus() { return this.data.coinBonus !== undefined ? this.data.coinBonus : C.ATTACK.COIN_BONUS; }
  coinText() { return this.attack ? '+' + this.coinBonus() + 's' : '+1'; }

  // ---------------------------------------------------------------- player damage
  isStomp(p, e) { return p.vy > 0 && p.prevBottom <= e.y + 7 && !p.crouchSkip; }
  hurtPlayer(amount, srcX, o = {}) {
    const p = this.player;
    if (this.completed || p.invuln > 0 || p.power.sponsor > 0) return false;
    if (this.attack) { // score attack: hits cost time (a short stun or slow), not health
      const A = C.ATTACK, slow = amount <= C.INTEGRITY.UNION_HIT;
      p.invuln = A.HIT_GRACE;
      if (!o.noKnock) { p.vx = (p.cx < srcX ? -1 : 1) * C.PLAYER.KNOCKBACK_X; p.vy = -C.PLAYER.KNOCKBACK_Y; p.hurtTimer = C.PLAYER.HURT_STUN; p.onGround = false; }
      if (slow) p.slowTimer = Math.max(p.slowTimer, A.SLOW_TIME); else p.stun = Math.max(p.stun, A.STUN_TIME);
      Sound.play('hurt'); this.addPopup(slow ? 'SLOWED!' : 'STUNNED!', p.cx, p.y - 6, '#ff9f98');
      return true;
    }
    this.g.damage(amount);
    p.invuln = C.INTEGRITY.INVULN_TIME;
    if (!o.noKnock) { p.vx = (p.cx < srcX ? -1 : 1) * C.PLAYER.KNOCKBACK_X; p.vy = -C.PLAYER.KNOCKBACK_Y; p.hurtTimer = C.PLAYER.HURT_STUN; p.onGround = false; }
    Sound.play('hurt');
    this.addPopup('-' + amount + '%', p.cx, p.y - 6, '#ff9f98');
    return true;
  }
  catchByCEO(dt, ceo) {
    const p = this.player, g = this.g;
    if (p.power.sponsor > 0 || this.completed) return;
    if (this.attack) { // 2-second stun, then he can't re-stun you straight away
      if (ceo.catchCd > 0 || p.stun > 0) return;
      p.stun = C.ATTACK.CEO_STUN; ceo.catchCd = C.ATTACK.CEO_CATCH_COOLDOWN;
      p.vx = (p.cx < ceo.cx ? -1 : 1) * C.PLAYER.KNOCKBACK_X; p.vy = -C.PLAYER.KNOCKBACK_Y * 0.7; p.onGround = false;
      Sound.play('hurt'); this.addPopup('STUNNED!', p.cx, p.y - 8, '#ff9f98'); ceo.speak(ceo.hr ? 'Quick check-in?' : 'Do you have a minute?', 1.8);
      return;
    }
    g.drain(C.INTEGRITY.CEO_DRAIN_PER_SEC * dt);
    g.ceoOverlayTimer = C.CEO.OVERLAY_TIME; g.ceoMessage = ceo.message;
    if (ceo.drainSfxT <= 0) { Sound.play('hurt'); ceo.drainSfxT = 0.45; this.addPopup('-' + Math.round(C.INTEGRITY.CEO_DRAIN_PER_SEC * 0.45) + '%', p.cx, p.y - 8, '#ff9f98'); }
    if (!ceo.say) ceo.speak('Do you have a minute?', 1.6);
  }
  playerFell() {
    const p = this.player, g = this.g;
    Sound.play('fall');
    if (!this.attack) g.damage(C.INTEGRITY.FALL);
    else {
      const lost = Math.min(g.reached, C.ATTACK.PIT_PENALTY);
      g.reached -= lost;
      if (lost) this.addPopup('-' + lost, Math.max(40, Math.min(this.mapW - 40, p.x)), 164, '#ff9f98');
    }
    this.addPopup(this.data.pitText || 'LIFT OUT OF SERVICE!', Math.max(40, Math.min(this.mapW - 40, p.x)), 180, '#ffe27a');
    if (g.integrity <= 0) return;
    // reappear on solid floor, on the side of the shaft the player came from
    const T = C.TILE, col = Math.floor((p.x + p.w / 2) / T);
    let pit = this.pits.find(q => col >= q.from - 1 && col <= q.to + 1);
    if (!pit) pit = this.pits.slice().sort((a, b) => Math.abs(a.from - col) - Math.abs(b.from - col))[0];
    const gap = this.attack ? 6 : 2;   // roaming rounds give a longer run-up
    let rc = (this.lastGroundX !== undefined && this.lastGroundX > (pit.to + 0.5) * T) ? pit.to + gap : pit.from - gap;
    rc = Math.max(0, Math.min(this.cols - 1, rc));
    p.setCrouch(this, false); p.h = C.PLAYER.H;
    p.x = rc * T + 2; p.y = this.groundTopAt(rc) - p.h;
    p.vx = p.vy = 0; p.invuln = 1.6; p.onGround = false; p.hurtTimer = 0; p.stun = this.attack ? C.ATTACK.STUN_TIME : 0; p.dropTimer = 0;
    this.g.snapCamera = true;
  }

  // ---------------------------------------------------------------- checkpoints / respawn
  respawn() {
    const p = this.player, T = C.TILE;
    const cp = this.checkpointIndex > 0 ? this.checkpoints[this.checkpointIndex - 1] : null;
    const x = cp ? cp.x + 2 : this.start.x;
    const col = Math.floor(x / T);
    p.setCrouch(this, false); p.h = C.PLAYER.H;
    p.x = x; p.y = this.groundTopAt(col) - p.h; p.vx = p.vy = 0; p.invuln = 2; p.stun = 0; p.hurtTimer = 0; p.onGround = false;
    for (const k in p.power) p.power[k] = 0;
    p.trail = [];
    this.resetBarriers();
    this.ceo.reset(); this.trail = []; this.safeHist = [];
    if (this.checkpointIndex >= (this.data.ceo.firstAfterCheckpoint || 1)) { this.ceo.spawn(false); }
    this.lastSafe = { x: p.x, y: p.y };
    this.g.snapCamera = true;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.g, p = this.player, T = C.TILE;
    this.time += dt;
    if (this.shake > 0) this.shake -= dt;

    if (!this.completed) p.update(dt, this);
    else { p.vx *= 0.8; p.update(dt, this); }
    this.updateBarriers(dt);
    if (this.data.endless) {
      this.extendIfNeeded();
      const pc = Math.floor((p.x + p.w / 2) / T), tun = this.tunnels.find(t => pc >= t.from && pc <= t.to), inT = !!tun;
      if (inT && !p.tunnel) g.banner = { text: (tun.name || 'Staff Corridor').toUpperCase(), sub: (tun.sub || 'Crowded: push through').toUpperCase(), t: 1.8 };
      // leaving a corridor forwards triggers the next chaser (CEO after the 1st, HR Manager after the 2nd)
      if (this.curTun && !inT && pc > this.curTun.to && !this.curTun.passed) { this.curTun.passed = true; this.tunnelsPassed++; Attack.onCorridorPassed(this, this.tunnelsPassed); }
      this.curTun = tun || null;
      p.tunnel = inT;
    }
    for (const e of this.enemies) if (e.alive) e.update(dt);
    this.nurse.update(dt);
    this.ceo.update(dt); this.hr.update(dt);
    if (this.attack) Attack.update(this, dt);
    this.enemies = this.enemies.filter(e => e.alive);

    // recent route (CEO rescue) and where the player last stood (shaft respawn side)
    if (p.onGround) this.lastGroundX = p.x;
    this.trailT -= dt;
    if (this.trailT <= 0 && p.onGround) {
      this.trailT = 0.25;
      this.trail.push({ x: p.x, y: p.y + p.h }); if (this.trail.length > 80) this.trail.shift();
    }
    this.safeT -= dt;
    if (this.safeT <= 0 && p.onGround && p.invuln <= 0.5 && !this.completed) {
      const lx = p.x - 4, rx = p.x + p.w + 4, fy = p.y + p.h + 2;
      if (this.groundPx(lx, fy) && this.groundPx(rx, fy) && !this.slip[Math.floor(p.cx / T)]) {
        this.safeT = 0.2; this.safeHist.push({ x: p.x, y: p.y }); if (this.safeHist.length > 6) this.safeHist.shift();
        this.lastSafe = { x: p.x, y: p.y };
      }
    }

    if (!this.completed) {
      // coins
      for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h - 0.01) / T); ty++)
        for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++)
          if (this.charAt(tx, ty) === 'c') { this.tiles[ty][tx] = '.'; g.addCoin(); Sound.play('coin'); this.addPopup(this.coinText(), tx * T + 8, ty * T - 2, '#ffe27a'); }
      // items
      for (const it of this.items) {
        it.t += dt;
        it.y = it.t < 0.25 ? it.y + (it.baseY - it.y) * Math.min(1, dt * 16) : it.baseY + Math.sin(it.t * 4) * 1.5;
        if (it.alive && overlap(p, { x: it.x, y: it.y, w: 12, h: 12 })) this.collect(it);
      }
      this.items = this.items.filter(i => i.alive);
      // checkpoints
      this.checkpoints.forEach((cp, i) => {
        if (i + 1 > this.checkpointIndex && p.x + p.w > cp.x - 4 && p.x < cp.x + T + 4) this.activateCheckpoint(i + 1);
      });
      // enemies
      for (const e of this.enemies) if (e.alive && overlap(p, e)) e.onTouch(p, dt);
      // nurse = goal
      // generous goal zone around the Nurse station: a jump over her still counts
      const n = this.nurse;
      if (!this.attack && overlap(p, { x: n.x - 8, y: n.y - 56, w: n.w + 16, h: n.h + 56 })) this.deliver();
    } else {
      this.completeT += dt;
      if (this.completeT > 2.6 && g.state === 'playing') g.finish();
    }

    // area banner
    const col = Math.floor((p.x + p.w / 2) / T);
    const area = this.data.areas.find(a => col >= a.from && col <= a.to) || this.data.areas[0];
    this.currentArea = area;
    if (area.key !== this.lastAreaKey) {
      if (this.lastAreaKey !== null) g.banner = { text: area.name.toUpperCase(), sub: 'AREA ' + (this.data.areas.indexOf(area) + 1) + ' OF ' + this.data.areas.length, t: 2.2 };
      this.lastAreaKey = area.key;
    }

    // particles / popups / bumps
    for (const q of this.particles) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.g) q.vy += 600 * dt; else q.vy += 200 * dt; }
    this.particles = this.particles.filter(q => q.t > 0);
    for (const q of this.popups) { q.t -= dt; q.y -= 22 * dt; }
    this.popups = this.popups.filter(q => q.t > 0);
    for (const k in this.bumps) { this.bumps[k] -= dt; if (this.bumps[k] <= 0) delete this.bumps[k]; }
  }

  collect(it) {
    it.alive = false;
    const p = this.player, P = C.POWERUPS;
    const map = { speed: ['speed', P.SPEED], sponsor: ['sponsor', P.SPONSOR], djump: ['djump', P.DOUBLE_JUMP], push: ['push', P.PUSH] };
    const [key, def] = map[it.kind];
    p.power[key] = def.time * (this.attack ? C.ATTACK.POWERUP_SCALE : 1);
    Sound.play('powerup');
    this.sparkle(it.x + 6, it.y + 6, '#ffffff', 12);
    this.g.toastMsg(def.name.toUpperCase() + '! ' + ({ speed: 'FASTER', sponsor: 'INVINCIBLE', djump: 'DOUBLE JUMP', push: 'BREAK CRATES' })[it.kind], '#2d8f87');
  }

  activateCheckpoint(i) {
    this.checkpointIndex = i;
    Sound.play('checkpoint');
    this.g.toastMsg(this.g.playerName + ' got ' + this.data.checkpointLabel.toLowerCase() + '!', '#1d8a4a');
    this.sparkle(this.checkpoints[i - 1].x + 8, this.checkpoints[i - 1].y, '#41c47b', 10);
    if (i === (this.data.ceo.firstAfterCheckpoint || 1) && !this.ceo.active) this.ceo.spawn(true);
  }

  deliver() {
    this.completed = true; this.completeT = 0;
    this.player.locked = true; this.nurse.received = true;
    Sound.play('win');
    this.sparkle(this.nurse.x + 6, this.nurse.y, '#ffe27a', 24);
    if (this.ceo.active) this.ceo.speak('But... my announcement?', 2.6);
  }

  // ---------------------------------------------------------------- draw
  draw(ctx, camX, g, camY = 0) {
    const T = C.TILE, art = this.data.art, time = this.time;
    ctx.save();
    if (this.hudH) { ctx.beginPath(); ctx.rect(0, this.hudH, C.VIEW_W, C.VIEW_H - this.hudH); ctx.clip(); ctx.translate(0, this.hudH); }
    if (this.zoom !== 1) ctx.scale(this.zoom, this.zoom);
    const cy = Math.round(camY); if (cy) ctx.translate(0, -cy);
    art.drawBackground(ctx, camX, time, this.data.areas.find(a => a === this.currentArea).key, cy, this);
    art.drawFloorExtras(ctx, camX, this, time);
    const cam = Math.round(camX);
    const t0 = Math.floor(cam / T), t1 = Math.ceil((cam + this.viewW) / T);
    for (let ty = 0; ty < this.rows; ty++) for (let tx = t0; tx <= t1; tx++) {
      const ch = this.charAt(tx, ty);
      if (ch === '.' || tx < 0 || tx >= this.cols) continue;
      const x = tx * T - cam, y = ty * T;
      if (ch === 'c') { art.drawCoin(ctx, x + 3, y + 3 + Math.round(Math.sin(time * 3 + tx) * 1), time); continue; }
      if (ch === 'w') { art.drawWet(ctx, x, y); continue; }
      if (ch === 'o') { art.drawPuddle(ctx, x, y); continue; }
      const spr = art.tileSprite(ch, tx, ty, this, time);
      if (!spr) continue;
      const bump = this.bumps[tx + ',' + ty];
      const off = bump ? -Math.round(Math.sin((0.18 - bump) / 0.18 * Math.PI) * 4) : 0;
      ctx.drawImage(spr, x, y + off);
    }
    this.checkpoints.forEach((cp, i) => art.drawCheckpoint(ctx, cp.x - cam, cp.y - 12, this.checkpointIndex >= i + 1));
    this.checkpoints.forEach((cp, i) => { if (Math.abs(cp.x - cam - 240) < 200) Gfx.text(ctx, this.data.checkpointShort || 'SIGN-OFF', cp.x - cam + 8, cp.y - 20, { color: '#fff', shadow: '#0a2327', align: 'center' }); });

    this.drawBarriers(ctx, cam, art);
    for (const it of this.items) { art.drawPowerIcon(ctx, it.kind, it.x - cam, it.y); }
    for (const e of this.enemies) e.draw(ctx, cam, time);
    this.nurse.draw(ctx, cam, time);
    this.ceo.draw(ctx, cam, time); this.hr.draw(ctx, cam, time);
    this.player.draw(ctx, cam, g);
    for (const q of this.particles) { ctx.globalAlpha = Math.min(1, q.t * 2.5); Gfx.px(ctx, q.color, Math.round(q.x - cam), Math.round(q.y), q.s, q.s); }
    ctx.globalAlpha = 1;
    for (const q of this.popups) { ctx.globalAlpha = Math.min(1, q.t * 2); Gfx.text(ctx, q.text, Math.round(q.x - cam), Math.round(q.y), { color: q.color, shadow: '#0a2327', align: 'center' }); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawBarriers(ctx, cam, art) {
    const S = art.sprites();
    for (const b of this.barriers) {
      const x = Math.round(b.x - cam);
      if (b.state === 'idle' || (b.state === 'open' && b.t > 0.6)) continue;
      if (x > C.VIEW_W + 40 || x + b.w < -40) continue;
      if (b.kind === 'door') {
        let h = b.h;
        if (b.state === 'closing') h = Math.round(b.h * Math.min(1, b.t / 0.35));
        else if (b.state === 'open') h = Math.round(b.h * (1 - Math.min(1, b.t / 0.6)));
        ctx.fillStyle = '#37474f'; ctx.fillRect(x - 1, b.y, b.w + 2, h);
        ctx.fillStyle = '#90a4ae'; ctx.fillRect(x, b.y, b.w, h);
        for (let yy = 0; yy < h; yy += 8) { ctx.fillStyle = (yy / 8) % 2 ? '#ffd23f' : '#1a1a1a'; ctx.fillRect(x, b.y + yy, b.w, Math.min(4, h - yy)); }
        if (h > 30) Gfx.text(ctx, this.data.doorText || 'STAFF\nONLY', x + b.w / 2, b.y + 30, { color: '#ffffff', shadow: '#1a1a1a', align: 'center' });
      } else if (b.kind === 'cart') {
        let dy = 0;
        if (b.state === 'closing') dy = -Math.round((1 - Math.min(1, b.t / 0.5)) * 90);
        else if (b.state === 'open') { ctx.globalAlpha = 1 - b.t / 0.6; dy = 0; }
        for (let ty = 0; ty < b.h / 16; ty++) for (let tx = 0; tx < b.w / 16; tx++)
          ctx.drawImage(ty === 0 ? S.linenTop : S.linenBottom, x + tx * 16, b.y + ty * 16 + dy);
        ctx.globalAlpha = 1;
      } else { // pile of rescheduled calendar invites
        ctx.globalAlpha = b.state === 'open' ? 1 - b.t / 0.6 : 1;
        Gfx.px(ctx, '#ffffff', x, b.y + 6, b.w, 6); Gfx.px(ctx, '#cfd8dc', x + 2, b.y + 3, b.w - 4, 4); Gfx.px(ctx, '#e8f1f0', x + 4, b.y, b.w - 8, 4);
        Gfx.px(ctx, '#e03131', x + 3, b.y + 8, 3, 2); Gfx.px(ctx, '#2d6cdf', x + 9, b.y + 4, 3, 2);
        ctx.globalAlpha = 1;
        Gfx.text(ctx, 'RESCHEDULED', x + b.w / 2, b.y - 8, { color: '#fff', shadow: '#0a2327', align: 'center' });
      }
    }
  }
}

/* ==========================================================================
   Game: states, loop, camera, scaling.
   States: name, title, intro, playing, paused, gameover, complete
   ========================================================================== */
const Game = {
  state: 'name', canvas: null, ctx: null,
  playerName: C.DEFAULT_NAME, nameBuffer: '',
  levelData: null, level: null,
  menuIndex: 0, menuTime: 0, menuCam: 0, levelIndex: 0, sceneTime: 0, timeLeft: 0, reached: 0, reachedCount: 0, spawned: 0, boardLevel: 'all', ddOpen: false, homeNote: '', homeNoteT: 0, board: [], lastEntry: null, boardPage: 0,
  integrity: 100, integrityFlash: 0, coins: 0, stomped: 0, deaths: 0, time: 0,
  ceoOverlayTimer: 0, ceoMessage: '', corruptSeed: [], toast: '', toastTimer: 0, toastColor: '#0f3a40', banner: null,
  camX: 0, camY: 0, snapCamera: true, results: null, hintedPush: false,
  _acc: 0, _last: 0, debug: false, fps: 0, _frames: 0, _fpsT: 0,

  get player() { return this.level.player; },

  // ---- helpers shared with Level
  addTime(s) { this.timeLeft += s; },
  addCoin() {
    this.coins++;
    if (this.levelData.mode === 'attack') { this.addTime(this.levelData.coinBonus !== undefined ? this.levelData.coinBonus : C.ATTACK.COIN_BONUS); return; }
    if (this.coins % C.INTEGRITY.COINS_PER_BOOST === 0 && this.integrity < 100) {
      this.integrity = Math.min(100, this.integrity + C.INTEGRITY.COIN_BOOST);
      this.toastMsg('ENGAGEMENT BOOST! +' + C.INTEGRITY.COIN_BOOST + '% INTEGRITY', '#1d8a4a');
    }
  },
  damage(n) {
    if (this.levelData.mode === 'attack') return;   // no integrity in score-attack rounds
    this.integrity = Math.max(0, this.integrity - n); this.integrityFlash = 0.4;
    if (this.integrity <= 0 && this.state === 'playing') this.gameOver();
  },
  drain(n) { this.damage(n); },
  toastMsg(text, color) { this.toast = text; this.toastColor = color || '#0f3a40'; this.toastTimer = 2.4; },

  // ---- name handling
  sanitizeName(s) {
    s = String(s || '').replace(/[^A-Za-z0-9 '_.\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, C.NAME_MAX).trim();
    return s;
  },
  loadName() { try { return this.sanitizeName(localStorage.getItem(C.STORAGE_KEY)); } catch (e) { return ''; } },
  saveName(n) { try { localStorage.setItem(C.STORAGE_KEY, n); } catch (e) { /* private mode */ } },

  // ---- setup
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    Gfx.state.main = this.ctx;   // text on this context uses the vector brand fonts
    if (document.fonts && document.fonts.load) ['800 20px Epilogue', '700 20px Epilogue', '500 10px Inter', '700 10px Inter'].forEach(f => document.fonts.load(f).catch(() => {}));
    this.debug = C.DEBUG || /[?&]debug/.test(location.search);
    this.levelData = LEVELS.healthcare;
    this.levelData.art.init();
    this.corruptSeed = [];
    let s = 12345; for (let i = 0; i < 64; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; this.corruptSeed.push(s / 0x7fffffff); }
    window.addEventListener('resize', () => this.resize());
    this.initMouse(); this.initHotkeys();
    this.resize();
    // keep a (non-playing) level around for backdrops and to give menus a valid level
    this.level = new Level(this.levelData, this);
    const saved = this.loadName();
    if (saved) { this.playerName = saved; this.setState('title'); } else this.enterNameEntry(C.DEFAULT_NAME, '');
    window.addEventListener('blur', () => { if (this.state === 'playing') this.setState('paused'); });
    this._last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const s = Math.min(w / C.VIEW_W, h / C.VIEW_H);
    const f = Math.floor(s);
    const scale = f >= 1 && (s - f) < 0.34 ? f : s; // integer scale when it wastes little space
    this.canvas.style.width = Math.floor(C.VIEW_W * scale) + 'px';
    this.canvas.style.height = Math.floor(C.VIEW_H * scale) + 'px';
    // Hi-res backing store (integer multiple of the 480x272 logical size) keeps vector text crisp.
    let S = Math.round(scale * (window.devicePixelRatio || 1));
    S = S <= 4 ? 3 : 6;   // multiple of 3, so the 4/3 world zoom lands on whole device pixels
    Gfx.state.S = S;
    if (this.canvas.width !== C.VIEW_W * S) { this.canvas.width = C.VIEW_W * S; this.canvas.height = C.VIEW_H * S; }
  },

  setState(s) {
    this.state = s; this.menuTime = 0; this.editing = false;
    Input.setTextHandler(null);
    if (s === 'title') this.menuIndex = 0;
    if (s === 'paused') { this.pauseSel = 0; this.pauseConfirm = false; this.confirmSel = 1; }
  },

  enterNameEntry(prefill, returnTo) {
    this.nameBuffer = prefill; this.nameReturn = returnTo;
    this.setState('name');
    Input.setTextHandler(e => {
      if (this.state !== 'name') return;
      if (e.key === 'Backspace') this.nameBuffer = this.nameBuffer.slice(0, -1);
      else if (e.key.length === 1 && this.nameBuffer.length < C.NAME_MAX) {
        const t = this.nameBuffer + e.key;
        if (/^[A-Za-z0-9 '_.\-]$/.test(e.key)) this.nameBuffer = t;
      }
      Sound.unlock();
    });
  },

  // ---- mouse: regions come from UI.regions so drawing and clicking always agree
  mousePos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * C.VIEW_W, y: (e.clientY - r.top) / r.height * C.VIEW_H };
  },
  hitAt(p) { return UI.regions(this).find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h); },
  initMouse() {
    const HOME_IDX = { levels: 0, leaderboard: 1, howto: 2, field: 3 };
    this.canvas.addEventListener('mousemove', e => {
      const h = this.hitAt(this.mousePos(e));
      this.canvas.style.cursor = h ? 'pointer' : 'default';
      if (!h) return;
      if (this.state === 'title' && !this.editing && HOME_IDX[h.id] !== undefined) this.menuIndex = HOME_IDX[h.id];
      else if (this.state === 'levels' && h.id.startsWith('lvl')) this.levelIndex = +h.id.slice(3);
    });
    this.canvas.addEventListener('mousedown', e => {
      this.canvas.focus(); Sound.unlock();
      const p = this.mousePos(e), h = this.hitAt(p);
      if (this.state === 'title') {
        if (this.editing) {
          if (h && h.id === 'field' && p.x < 198) return;      // clicking inside the text keeps editing
          this.saveNameEdit();                                  // tick or click away saves
        } else if (h) this.activateHome(h.id);
      } else if (this.state === 'levels') {
        if (h && h.id === 'back') this.goHome();
        else if (h && h.id.startsWith('lvl')) { this.levelIndex = +h.id.slice(3); this.chooseLevel(); }
      } else if (this.state === 'intro') {
        if (h) this.introAction(h.id);
      } else if (this.state === 'paused') {
        if (h) this.pauseAction(h.id);
      } else if (this.state === 'complete') {
        if (h && h.id === 'again') { Sound.play('confirm'); this.playAgain(); } else if (h && h.id === 'levels') this.goLevels(); else if (h && h.id === 'home') this.goHome();
      } else if (this.state === 'howto' || this.state === 'leaderboard') {
        if (h && h.id === 'back') this.goHome();
        else if (this.state === 'leaderboard') {
          if (h && h.id === 'dd') { this.ddOpen = !this.ddOpen; Sound.play('menu'); }
          else if (h && h.id.startsWith('opt:')) { this.boardLevel = h.id.slice(4); this.boardPage = 0; this.ddOpen = false; Sound.play('menu'); }
          else if (h && (h.id === 'prev' || h.id === 'next')) this.turnPage(h.id === 'next' ? 1 : -1);
          else this.ddOpen = false;
        }
      } else if (this.state === 'name' && h && h.id === 'confirm') {
        const n = this.sanitizeName(this.nameBuffer) || C.DEFAULT_NAME;
        this.playerName = n; this.saveName(n); Sound.play('confirm'); this.setState('title');
      }
    });
  },

  /** Shift+R on the home screen wipes the local leaderboard (deliberately not advertised). */
  initHotkeys() {
    window.addEventListener('keydown', e => {
      if (this.state === 'title' && !this.editing && e.shiftKey && e.code === 'KeyR' && !e.repeat) {
        try { localStorage.removeItem(C.BOARD_KEY); } catch (err) { /* private mode */ }
        this.board = []; this.lastEntry = null; this.homeNote = 'Leaderboard reset'; this.homeNoteT = 2.2; Sound.play('pause');
      }
    });
  },

  // ---- home / menus
  /** Pause menu: resume, end the game early (the score so far is recorded), or quit home after an "are you sure?". */
  pauseAction(id) {
    if (id === 'resume' || id === 'no') {
      if (id === 'no') { this.pauseConfirm = false; Sound.play('menu'); return; }
      Sound.play('pause'); this.setState('playing');
    } else if (id === 'end') {
      this.state = 'playing'; this.endedEarly = true;
      if (this.levelData.mode === 'attack') this.finishAttack(); else this.gameOver();
    } else if (id === 'home') { this.pauseConfirm = true; this.confirmSel = 1; Sound.play('menu'); }
    else if (id === 'yes') this.pauseAction('end');   // leaving mid-game still records the score and shows the results
  },
  goHome() { Sound.play('menu'); this.setState('title'); },
  introAction(id) {
    if (id === 'back') { Sound.play('menu'); this.setState('levels'); }
    else { Sound.play('confirm'); this.setState('playing'); this.level.lastAreaKey = null; }
  },
  goLevels() { Sound.play('menu'); this.setState('levels'); this.levelIndex = 0; },
  activateHome(id) {
    if (id === 'field') { this.menuIndex = 3; Sound.play('menu'); this.startNameEdit(); return; }
    Sound.play('confirm');
    if (id === 'levels') { this.setState('levels'); this.levelIndex = 0; }
    else if (id === 'leaderboard') { this.board = this.loadBoard(); this.setState('leaderboard'); this.boardPage = 0; this.lastEntry = null; this.boardLevel = 'all'; this.ddOpen = false; }
    else if (id === 'howto') this.setState('howto');
  },
  chooseLevel() {
    const lv = C.LEVEL_LIST[this.levelIndex];
    if (!lv || !LEVELS[lv.id]) { Sound.play('bump'); return; }   // placeholder level
    this.levelData = LEVELS[lv.id];
    if (this.levelData.art.init) this.levelData.art.init();
    Sound.play('confirm');
    this.startRun();
  },

  // ---- local leaderboard (this browser only)
  loadBoard() {
    try {
      const a = JSON.parse(localStorage.getItem(C.BOARD_KEY) || '[]');
      if (!Array.isArray(a)) return [];
      for (const e of a) if (e.score === undefined) e.score = this.scoreOf(e);   // older entries
      return a.filter(e => e.outcome === 'round');   // both levels are score-attack rounds now; scores from the retired flag run are dropped
    } catch (e) { return []; }
  },
  /** Single leaderboard score. Works from a stored entry so older entries can be scored too. */
  scoreOf(e) {
    if (e.outcome === 'round') return e.reached || 0;
    const S = C.SCORE;
    const base = (e.coins || 0) * S.PER_COIN + (e.stomped || 0) * S.PER_MANAGER;
    if (e.outcome === 'failed') return Math.round(Math.max(0, (e.progress || 0) * S.FAIL_PROGRESS + base));
    const bonus = Math.max(0, S.TIME_PAR - e.time) * S.TIME_BONUS_PER_SEC;
    return Math.round(Math.max(0, S.DELIVERED_BASE + bonus + base + (e.integrity || 0) * S.PER_INTEGRITY + (e.deaths || 0) * S.PER_RESTART));
  },
  /** Entries for the leaderboard tab being shown (score-attack rounds and flag levels are kept apart). */
  boardPages() { return Math.max(1, Math.ceil(this.boardList().length / C.BOARD_PAGE)); },
  turnPage(d) {
    const n = Math.max(0, Math.min(this.boardPages() - 1, this.boardPage + d));
    if (n !== this.boardPage) { this.boardPage = n; Sound.play('menu'); }
  },
  boardList() {
    const all = this.board || [];
    if (this.boardLevel === 'all') return all.slice();
    const lv = LEVELS[this.boardLevel]; if (!lv) return [];
    return all.filter(e => e.level === lv.title);
  },

  /** Every attempt (delivered or failed) is ranked by its score, highest first. */
  addToBoard(entry) {
    entry.score = this.scoreOf(entry);
    const board = this.loadBoard();
    board.push(entry);
    board.sort((a, b) => b.score - a.score || a.stamp - b.stamp);
    const seen = {};
    const kept = board.filter(e => { const k = e.level + '|' + (e.outcome === 'round'); seen[k] = (seen[k] || 0) + 1; return seen[k] <= C.BOARD_MAX; });
    board.length = 0; board.push(...kept);
    try { localStorage.setItem(C.BOARD_KEY, JSON.stringify(board)); } catch (e) { /* private mode */ }
    this.board = board;
    this.lastEntry = board.find(x => x.stamp === entry.stamp) || null;
  },
  recordResult(r) {
    this.addToBoard({ outcome: 'delivered', name: this.playerName, level: this.levelData.title, time: r.time, readRate: r.readRate, coins: r.coins, stomped: r.stomped, deaths: r.deaths, integrity: r.integrity, stamp: Date.now() + Math.random() });
  },
  recordFailure() {
    const L = this.level, goalX = Math.max(1, (L.nurseCol || 1) * C.TILE);
    const progress = Math.max(0, Math.min(0.99, L.player.x / goalX));
    this.addToBoard({ outcome: 'failed', name: this.playerName, level: this.levelData.title, time: this.time, progress, coins: this.coins, stomped: this.stomped, area: L.currentArea.name, stamp: Date.now() + Math.random() });
  },

  /** Inline name edit on the title screen: Enter saves, Esc cancels. */
  startNameEdit() {
    this.editing = true; this.nameBuffer = this.playerName; this.menuTime = 0;
    Input.setTextHandler(e => {
      if (this.state !== 'title' || !this.editing) return;
      if (e.key === 'Escape') { this.editing = false; Input.setTextHandler(null); Sound.play('menu'); }
      else if (e.key === 'Backspace') this.nameBuffer = this.nameBuffer.slice(0, -1);
      else if (e.key.length === 1 && this.nameBuffer.length < C.NAME_MAX && /^[A-Za-z0-9 '_.\-]$/.test(e.key)) this.nameBuffer += e.key;
      Sound.unlock();
    });
  },
  saveNameEdit() {
    const n = this.sanitizeName(this.nameBuffer) || C.DEFAULT_NAME;
    this.playerName = n; this.saveName(n);
    this.editing = false; Input.setTextHandler(null); Sound.play('confirm');
  },

  startRun() {
    this.level = new Level(this.levelData, this);
    this.integrity = C.INTEGRITY.START; this.coins = 0; this.stomped = 0; this.deaths = 0; this.time = 0;
    this.ceoOverlayTimer = 0; this.toastTimer = 0; this.banner = { text: this.levelData.title.toUpperCase(), sub: this.levelData.areas[0].name.toUpperCase(), t: 2.2 };
    this.hintedPush = false; this.snapCamera = true; this.integrityFlash = 0; this.endedEarly = false;
    if (this.levelData.mode === 'attack') { this.timeLeft = C.ATTACK.ROUND_TIME; this.lastTick = 99; }
    this.introSel = 0;
    this.setState('intro');
  },

  gameOver() {
    if (this.state !== 'playing') return;
    Sound.play('lose'); this.recordFailure(); this.setState('gameover');
  },
  retry() {
    this.deaths++; this.integrity = C.INTEGRITY.START; this.ceoOverlayTimer = 0;
    this.level.respawn();
    this.toastMsg('BACK AT THE LAST ' + this.levelData.checkpointLabel.toUpperCase(), '#0f3a40');
    this.setState('playing');
  },
  /** Round over: build results, rank, high-score entry. */
  finishAttack() {
    if (this.state !== 'playing') return;
    const readRate = this.spawned ? Math.min(100, this.reachedCount / this.spawned * 100) : 0;
    this.results = { mode: 'attack', early: !!this.endedEarly, reached: this.reached, reachedCount: this.reachedCount, spawned: this.spawned, readRate, coins: this.coins, stomped: this.stomped, rank: Attack.rankFor(this.reached) };
    this.addToBoard({ outcome: 'round', name: this.playerName, level: this.levelData.title, time: C.ATTACK.ROUND_TIME, reached: this.reached, readRate, coins: this.coins, stomped: this.stomped, stamp: Date.now() + Math.random() });
    this.completeSel = 0;
    this.results.place = this.board.filter(x => x.level === this.levelData.title && x.outcome === 'round').indexOf(this.lastEntry) + 1;
    Sound.play('win');
    this.setState('complete');
  },
  playAgain() {
    this.startRun(); this.level.lastAreaKey = null; this.setState('playing');
    this.banner = { text: 'GO!', sub: this.levelData.title.toUpperCase() + ' \u00b7 ' + C.ATTACK.ROUND_TIME + ' SECONDS', t: 1.6 };
  },
  finish() {
    const S = C.SCORE, lv = this.level;
    let rr = S.READ_RATE_BASE + this.coins * S.READ_RATE_PER_COIN + this.stomped * S.READ_RATE_PER_MANAGER + this.integrity * S.READ_RATE_INTEGRITY_WEIGHT + this.deaths * S.READ_RATE_PER_DEATH;
    rr = Math.max(3, Math.min(S.READ_RATE_MAX, rr));
    const q = lv.data.readRateQuips.find(x => rr >= x[0]);
    this.results = { time: this.time, coins: this.coins, stomped: this.stomped, deaths: this.deaths, integrity: this.integrity, readRate: rr, quip: q[1], quip2: q[2] };
    this.recordResult(this.results);
    this.results.score = this.lastEntry ? this.lastEntry.score : 0;
    this.results.rank = this.lastEntry ? this.board.indexOf(this.lastEntry) + 1 : 0;
    this.setState('complete');
  },

  // ---- fixed update
  step() {
    Input.poll();
    const dt = C.DT;
    this.menuTime += dt;
    if (Input.pressed('mute') && this.state !== 'name' && !this.editing) Sound.toggleMute();
    if (Input.pressed('jump') || Input.pressed('confirm') || Input.pressed('down')) Sound.unlock();

    switch (this.state) {
      case 'name':
        if (Input.pressed('confirm')) {
          const n = this.sanitizeName(this.nameBuffer) || C.DEFAULT_NAME;
          this.playerName = n; this.saveName(n); Sound.play('confirm');
          this.setState('title');
        }
        this.menuCam += dt * 30;
        break;
      case 'title': {
        this.menuCam += dt * 30; this.sceneTime += dt; if (this.homeNoteT > 0) this.homeNoteT -= dt;
        if (this.editing) { if (Input.pressed('confirm')) this.saveNameEdit(); break; }
        if (Input.pressed('up')) { this.menuIndex = (this.menuIndex + 3) % 4; Sound.play('menu'); }
        if (Input.pressed('down')) { this.menuIndex = (this.menuIndex + 1) % 4; Sound.play('menu'); }
        if (Input.pressed('confirm')) this.activateHome(['levels', 'leaderboard', 'howto', 'field'][this.menuIndex]);
        break;
      }
      case 'levels': {
        this.menuCam += dt * 30;
        const n = C.LEVEL_LIST.length; let i = this.levelIndex, moved = false;
        if (Input.pressed('moveLeft')) { i = i % 2 === 1 ? i - 1 : i; moved = true; }
        if (Input.pressed('moveRight')) { i = i % 2 === 0 && i + 1 < n ? i + 1 : i; moved = true; }
        if (Input.pressed('up')) { i = i >= 2 ? i - 2 : i; moved = true; }
        if (Input.pressed('down')) { i = i + 2 < n ? i + 2 : i; moved = true; }
        if (moved && i !== this.levelIndex) { this.levelIndex = i; Sound.play('menu'); }
        if (Input.pressed('confirm')) this.chooseLevel();
        else if (Input.pressed('pause')) this.goHome();
        break;
      }
      case 'howto': case 'leaderboard':
        this.menuCam += dt * 30;
        if (this.state === 'leaderboard') {
          if (!this.ddOpen) {
            if (Input.pressed('moveRight') || Input.pressed('down')) this.turnPage(1);
            if (Input.pressed('moveLeft') || Input.pressed('up')) this.turnPage(-1);
          }
        }
        if (this.ddOpen && (Input.pressed('confirm') || Input.pressed('pause'))) this.ddOpen = false;
        else if (Input.pressed('confirm') || Input.pressed('pause')) this.goHome();
        break;
      case 'intro':
        this.menuCam += dt * 20;
        if (Input.pressed('moveLeft')) { this.introSel = 1; Sound.play('menu'); }
        else if (Input.pressed('moveRight')) { this.introSel = 0; Sound.play('menu'); }
        else if (Input.pressed('pause')) this.introAction('back');
        else if (Input.pressed('confirm')) this.introAction(this.introSel ? 'back' : 'start');
        break;
      case 'playing':
        if (Input.pressed('pause')) { Sound.play('pause'); this.setState('paused'); break; }
        this.time += dt;
        if (this.integrityFlash > 0) this.integrityFlash -= dt;
        if (this.ceoOverlayTimer > 0) this.ceoOverlayTimer -= dt;
        if (this.toastTimer > 0) this.toastTimer -= dt;
        if (this.banner && this.banner.t > 0) this.banner.t -= dt;
        if (this.levelData.mode === 'attack') {
          this.timeLeft -= dt;
          const sec = Math.ceil(this.timeLeft);
          if (this.timeLeft <= 5 && sec !== this.lastTick && sec > 0) { this.lastTick = sec; Sound.play('beep'); }
          if (this.timeLeft <= 0) { this.timeLeft = 0; this.finishAttack(); break; }
        }
        this.level.update(dt);
        this.updateCamera(dt);
        break;
      case 'paused':
        if (this.pauseConfirm) {
          if (Input.pressed('up') || Input.pressed('down') || Input.pressed('moveLeft') || Input.pressed('moveRight')) { this.confirmSel = 1 - this.confirmSel; Sound.play('menu'); }
          else if (Input.pressed('pause')) { this.pauseConfirm = false; Sound.play('menu'); }
          else if (Input.pressed('confirm')) this.pauseAction(this.confirmSel === 0 ? 'yes' : 'no');
        } else if (Input.pressed('pause')) this.pauseAction('resume');
        else if (Input.pressed('up')) { this.pauseSel = (this.pauseSel + 2) % 3; Sound.play('menu'); }
        else if (Input.pressed('down')) { this.pauseSel = (this.pauseSel + 1) % 3; Sound.play('menu'); }
        else if (Input.pressed('confirm')) this.pauseAction(['resume', 'end', 'home'][this.pauseSel]);
        break;
      case 'gameover':
        if (Input.pressed('confirm')) { Sound.play('confirm'); this.retry(); }
        else if (Input.pressed('pause')) this.setState('title');
        break;
      case 'complete':
        if (this.results && this.results.mode === 'attack') {
          if (Input.pressed('moveLeft')) { this.completeSel = (this.completeSel + 2) % 3; Sound.play('menu'); }
          else if (Input.pressed('moveRight')) { this.completeSel = (this.completeSel + 1) % 3; Sound.play('menu'); }
          else if (Input.pressed('confirm')) { const s = this.completeSel || 0; if (s === 0) { Sound.play('confirm'); this.playAgain(); } else if (s === 1) this.goLevels(); else this.goHome(); }
          else if (Input.pressed('pause')) this.goHome();
        } else if (Input.pressed('confirm')) { Sound.play('confirm'); this.setState('title'); }
        break;
    }
    Input.endStep();
  },

  updateCamera(dt) {
    const p = this.player, L = this.level;
    const target = p.x + p.w / 2 + p.face * C.CAMERA.LOOKAHEAD - L.viewW * C.CAMERA.SCREEN_X;
    const max = L.mapW - L.viewW;
    const t = Math.max(0, Math.min(max, target));
    // vertical: a zoomed level uses one fixed framing (ground floor in view, upper floors above) so the camera never bobs
    const maxY = Math.max(0, L.rows * C.TILE - L.viewH);
    const ty = L.zoom !== 1 ? Math.max(0, Math.min(maxY, C.CAMERA.FIXED_Y)) : 0;
    if (this.snapCamera) { this.camX = t; this.snapCamera = false; }
    else this.camX += (t - this.camX) * Math.min(1, C.CAMERA.FOLLOW * dt);
    this.camY = ty;
    this.camX = Math.max(0, Math.min(max, this.camX));
    this.camY = Math.max(0, Math.min(maxY, this.camY));
  },

  // ---- rendering
  drawMenuBackground(ctx) {
    const art = this.levelData.art, T = C.TILE;
    const Z = this.levelData.zoom || 1, vw = C.VIEW_W / Z, camY = Z !== 1 ? Math.round(C.VIEW_H - C.VIEW_H / Z) : 0;
    ctx.save();
    if (Z !== 1) { ctx.scale(Z, Z); ctx.translate(0, -camY); }
    art.drawBackground(ctx, this.menuCam, this.menuTime, 'corridor', camY);
    const S = art.sprites(), off = -(Math.round(this.menuCam) % T);
    for (let x = off - T; x < vw + T; x += T) {
      const tx = Math.round((x + this.menuCam) / T);
      ctx.drawImage(S.floorTop[tx & 1], x, 240); ctx.drawImage(S.floorBody[tx & 1], x, 256);
    }
    ctx.restore();
  },

  render() {
    const ctx = this.ctx, S = Gfx.state.S;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d1f24'; ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    switch (this.state) {
      case 'name': UI.nameEntry(ctx, this); break;
      case 'title': UI.title(ctx, this); break;
      case 'levels': UI.levels(ctx, this); break;
      case 'howto': UI.howto(ctx, this); break;
      case 'leaderboard': UI.leaderboard(ctx, this); break;
      case 'intro': this.drawWorld(ctx); UI.intro(ctx, this); break;
      case 'playing': this.drawWorld(ctx); UI.hud(ctx, this); break;
      case 'paused': this.drawWorld(ctx); UI.hud(ctx, this); UI.pause(ctx, this); break;
      case 'gameover': this.drawWorld(ctx); UI.hud(ctx, this); UI.gameOver(ctx, this); break;
      case 'complete': UI.complete(ctx, this); break;
    }
    if (Sound.isMuted()) Gfx.text(ctx, 'MUTED', C.VIEW_W - 5, C.VIEW_H - 9, { color: '#ffffff', align: 'right', shadow: '#090D48' });
    if (this.debug && this.level) {
      const p = this.level.player;
      Gfx.text(ctx, 'FPS ' + this.fps + '  X ' + Math.round(p.x) + ' (COL ' + Math.floor(p.x / 16) + ')  Y ' + Math.round(p.y) + '  STATE ' + this.state, 4, C.VIEW_H - 8, { color: '#ffffff', shadow: '#000' });
    }
  },

  drawWorld(ctx) {
    const L = this.level;
    let cx = this.camX;
    if (L.shake > 0) cx += Math.round((Math.random() - 0.5) * 4);
    L.draw(ctx, cx, this, this.camY);
  },

  // ---- main loop (fixed 60 Hz timestep with accumulator)
  frame(now) {
    requestAnimationFrame(t => this.frame(t)); // always reschedule, even if something below throws
    let dt = (now - this._last) / 1000; this._last = now;
    if (dt > 0.25) dt = 0.25;
    this._acc += dt;
    let n = 0;
    try {
      while (this._acc >= C.DT && n < C.MAX_STEPS_PER_FRAME) { this.step(); this._acc -= C.DT; n++; }
      if (n === C.MAX_STEPS_PER_FRAME) this._acc = 0;
      this._frames++; this._fpsT += dt;
      if (this._fpsT >= 1) { this.fps = this._frames; this._frames = 0; this._fpsT = 0; }
      this.render();
    } catch (e) {
      if (this._lastErr !== e.message) { this._lastErr = e.message; console.error(e); }
    }
  },
};

window.addEventListener('load', () => Game.init());
