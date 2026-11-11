'use strict';
/* ==========================================================================
   enemies.js - obstacles and non-player characters.
   All characters are generic role-based archetypes (no individuals, no brands).
   Each class implements: update(dt), draw(ctx, camX, time), onTouch(player, dt)
   and exposes x, y, w, h, alive.
   ========================================================================== */
function overlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}
function label(ctx, text, cx, y, color = '#ffffff') {
  Gfx.text(ctx, text, Math.round(cx), Math.round(y), { color, shadow: '#0a2327', align: 'center' });
}
function wrap2(s) {
  const w = s.split(' ');
  if (w.length < 2) return s;
  let best = 1, bd = 1e9;
  for (let i = 1; i < w.length; i++) {
    const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length);
    if (d < bd) { bd = d; best = i; }
  }
  return w.slice(0, best).join(' ') + '\n' + w.slice(best).join(' ');
}
const rand = (a, b) => a + Math.random() * (b - a);

/** Base class: places itself, walks/patrols with tile collision. */
class Enemy {
  constructor(L, def, w, h) {
    this.L = L; this.def = def; this.w = w; this.h = h;
    const T = C.TILE;
    this.x = def.x * T + (T - w) / 2;
    this.y = def.y !== undefined ? def.y * T : L.groundTopAt(def.x) - h;
    if (def.y !== undefined && def.floating !== true && def.type !== 'pager') this.y = def.y * T - h;
    this.spawnX = def.x * T + T / 2;
    this.range = def.range === undefined ? 3 : def.range;
    this.vx = 0; this.vy = 0; this.dir = Math.random() < 0.5 ? 1 : -1;
    this.onGround = false; this.alive = true; this.turnCd = 0;
    this.near = false;
  }
  get cx() { return this.x + this.w / 2; }
  walk(dt, speed) {
    const L = this.L, T = C.TILE;
    if (this.turnCd > 0) this.turnCd -= dt;
    const frontX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
    if (this.onGround && this.turnCd <= 0) {
      const wall = L.solidPx(frontX, this.y + this.h - 3) || L.solidPx(frontX, this.y + 3);
      const ground = L.groundPx(frontX + this.dir * 2, this.y + this.h + 2);
      const far = this.dir > 0 ? this.cx > this.spawnX + this.range * T : this.cx < this.spawnX - this.range * T;
      if (wall || !ground || far) { this.dir = -this.dir; this.turnCd = 0.3; }
    }
    this.vx = this.dir * speed;
    this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt);
    const r = L.moveBody(this, this.vx * dt, this.vy * dt, {});
    this.onGround = r.landed;
    if (r.hitX && this.turnCd <= 0) { this.dir = -this.dir; this.turnCd = 0.3; }
    const p = L.player;
    this.near = Math.abs(p.x - this.x) < C.ENEMY.TAUNT_DISTANCE && Math.abs(p.y - this.y) < 60;
  }
  onTouch() {}
  update() {}
  draw() {}
}

/* ---- Manager / Middle Manager: clipboard patrol, stompable ("Approved!") ---- */
class Manager extends Enemy {
  constructor(L, def, middle) {
    super(L, def, 12, 15);
    this.middle = middle; this.hp = middle ? 2 : 1;
    this.state = 'walk'; this.timer = 0; this.angry = false;
  }
  update(dt) {
    if (this.state === 'approved') { this.timer -= dt; if (this.timer <= 0) this.alive = false; return; }
    if (this.state === 'stunned') {
      this.timer -= dt; this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt);
      this.L.moveBody(this, 0, this.vy * dt, {});
      if (this.timer <= 0) { this.state = 'walk'; this.angry = true; }
      return;
    }
    this.walk(dt, this.middle ? (this.angry ? C.ENEMY.MIDDLE_MANAGER_ANGRY_SPEED : C.ENEMY.MIDDLE_MANAGER_SPEED) : C.ENEMY.MANAGER_SPEED);
  }
  onTouch(p) {
    if (this.state !== 'walk') return;
    const L = this.L;
    if (p.power.sponsor > 0) { this.approve(); return; }
    if (L.isStomp(p, this)) {
      p.stompBounce(); p.y = this.y - p.h;
      this.hp--;
      if (this.hp <= 0) this.approve();
      else { this.state = 'stunned'; this.timer = 1.0; Sound.play('stomp'); L.addPopup('ONE MORE!', this.cx, this.y - 8, '#ffe27a'); L.sparkle(this.cx, this.y, '#ffffff', 6); }
      return;
    }
    L.hurtPlayer(C.INTEGRITY.MANAGER_HIT, this.cx);
  }
  approve() {
    this.state = 'approved'; this.timer = 1.0; this.L.g.stomped++;
    if (this.L.attack) { this.L.g.addTime(C.ATTACK.STOMP_BONUS); this.L.addPopup('+' + C.ATTACK.STOMP_BONUS + 's', this.cx, this.y - 20, '#9bf0b8'); }
    Sound.play('approve'); this.L.sparkle(this.cx, this.y + 6, '#41c47b', 10);
  }
  draw(ctx, camX, time) {
    const sx = this.x - camX; if (sx < -40 || sx > C.VIEW_W + 40) return;
    const mid = this.middle;
    const o = {
      face: this.dir, skin: mid ? '#e0b48a' : '#f1c9a0', hair: mid ? '#6b4a2b' : '#2e2e38',
      coat: mid ? '#8a6b4a' : '#8d99a6', sleeve: mid ? '#8a6b4a' : '#8d99a6', shirt: '#ffffff', tie: mid ? '#c0392b' : '#2d6cdf',
      pants: mid ? '#5d4a35' : '#6b7785', glasses: mid ? '#2b2b33' : null, prop: 'clipboard',
      state: this.state === 'approved' || this.state === 'stunned' ? 'crouch' : 'walk', frame: Math.floor(time * 4 + this.x * 0.1) & 3,
    };
    const crouch = o.state === 'crouch';
    Gfx.person(ctx, sx + this.w / 2 - 5, this.y + this.h - (crouch ? 10 : 16), o);
    if (this.state === 'stunned') { const b = Math.floor(time * 12) % 2; Gfx.text(ctx, '* *', sx + this.w / 2, this.y - 6, { color: b ? '#ffd23f' : '#fff', align: 'center', shadow: '#0a2327' }); }
    if (this.state === 'approved') {
      const rise = (1 - this.timer) * 6, x = Math.round(sx + this.w / 2), y = Math.round(this.y - 14 - rise);
      Gfx.px(ctx, '#1d8a4a', x - 24, y, 48, 11); Gfx.px(ctx, '#ffffff', x - 23, y + 1, 46, 9);
      Gfx.px(ctx, '#41c47b', x - 22, y + 2, 44, 7);
      Gfx.text(ctx, 'APPROVED!', x, y + 3, { color: '#ffffff', align: 'center', shadow: '#1d8a4a' });
    } else if (this.near) label(ctx, mid ? 'MIDDLE MANAGER' : 'MANAGER', sx + this.w / 2, this.y - 10, '#d9e2ec');
  }
}

/* ---- Union Rep picket line: bounce you back, cost a little, never hurt ---- */
class Union extends Enemy {
  constructor(L, def) {
    const n = def.count || 3;
    super(L, def, n * 18 - 6, 15);
    this.count = n; this.signs = def.signs || ['FAIR\nROSTERS!', 'MORE\nBREAKS!'];
    this.chantT = rand(1, 3); this.chant = null;
    this.x = def.x * C.TILE;
  }
  update(dt) {
    const p = this.L.player;
    this.near = Math.abs(p.cx - (this.x + this.w / 2)) < 120;
    if (this.chant) { this.chant.t -= dt; if (this.chant.t <= 0) this.chant = null; }
    this.chantT -= dt;
    if (this.chantT <= 0) {
      this.chantT = rand(3, 6);
      if (this.near) this.chant = { text: ['FAIR ROSTERS!', 'MORE BREAKS!', 'NO BREAKS, NO PEACE... KIDDING!', 'WE LOVE COMMS (BUT STILL)!'][Math.floor(Math.random() * 4)], t: 2.2 };
    }
  }
  onTouch(p) {
    const L = this.L;
    if (L.isStomp(p, this)) { p.stompBounce(); p.y = this.y - p.h; Sound.play('bump'); this.chant = { text: 'HEY, MIND THE SIGNS!', t: 1.4 }; return; }
    // side contact: always bounce back; costs integrity if not in invulnerability frames
    const away = p.cx < this.x + this.w / 2 ? -1 : 1;
    p.vx = away * C.PLAYER.KNOCKBACK_X; p.vy = Math.min(p.vy, -90);
    p.x += away * 2;
    if (p.invuln <= 0 && p.power.sponsor <= 0) { L.hurtPlayer(C.INTEGRITY.UNION_HIT, this.x + this.w / 2); this.chant = { text: 'SORRY! SOLIDARITY!', t: 1.4 }; }
  }
  draw(ctx, camX, time) {
    const sx = this.x - camX; if (sx < -60 || sx > C.VIEW_W + 60) return;
    for (let i = 0; i < this.count; i++) {
      const rx = sx + i * 18, bob = Math.round(Math.sin(time * 3 + i * 1.7)), face = i % 2 ? -1 : 1;
      Gfx.person(ctx, rx + 1, this.y - 1, { face, hair: ['#3a2a1e', '#a0522d', '#202020'][i % 3], skin: ['#f1c9a0', '#c68642', '#8d5524'][i % 3],
        coat: '#1f4e79', sleeve: '#1f4e79', shirt: '#ffffff', vest: '#ff9f1c', pants: '#3b4a63', hat: i === 1 ? 'hard' : null, state: 'stand' });
      if (i % 2 === 0) { // outer reps hold the placards (staggered so they never overlap)
        const lift = i === 0 ? 20 : 27;
        Gfx.px(ctx, '#5b3a21', rx + 5, this.y - lift + bob, 1, lift);
        Gfx.sign(ctx, this.signs[(i >> 1) % this.signs.length], rx + 5, this.y - lift + bob);
      }
    }
    if (this.chant) Gfx.bubble(ctx, this.chant.text, sx + this.w / 2, this.y - 44);
    else if (this.near) label(ctx, 'UNION REP', sx + this.w / 2, this.y - 52, '#ffd9a0');
  }
}

/* ---- Patients: slow, harmless, cannot be hurt. They only slow you down. ---- */
class Patient extends Enemy {
  constructor(L, def) {
    const v = def.variant || 'wheelchair';
    super(L, def, v === 'gurney' ? 38 : v === 'iv' ? 13 : 14, v === 'gurney' ? 14 : 16);
    this.variant = v; this.say = null; this.sayT = rand(2, 5);
  }
  update(dt) {
    this.walk(dt, C.ENEMY.PATIENT_SPEED);
    if (this.say) { this.say.t -= dt; if (this.say.t <= 0) this.say = null; }
    this.sayT -= dt;
    if (this.sayT <= 0) {
      this.sayT = rand(4, 8);
      if (this.near) this.say = { text: ['Oh, hello!', 'Is it lunch yet?', 'Nice lanyard.', 'Take your time.', 'Mind the wheels!'][Math.floor(Math.random() * 5)], t: 2 };
    }
  }
  onTouch(p) {
    const L = this.L;
    if (p.vy > 0 && p.prevBottom <= this.y + 5) { p.vy = -170; p.y = this.y - p.h; p.cutEnabled = false; Sound.play('bump'); this.say = { text: 'Excuse me!', t: 1.2 }; return; }
    p.slowTimer = C.PLAYER.SLOW_LINGER;
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX); if (sx < -50 || sx > C.VIEW_W + 50) return;
    const y = Math.round(this.y);
    ctx.save();
    if (this.dir < 0) { ctx.translate(sx + this.w, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    const gown = { skin: '#f1c9a0', hair: '#d9d9d9', coat: '#bfe3f5', sleeve: '#bfe3f5', shirt: '#bfe3f5', pants: '#bfe3f5', shoes: '#8ccbc6' };
    if (this.variant === 'wheelchair') {
      Gfx.person(ctx, sx + 2, y + 1, Object.assign({ state: 'crouch', face: 1 }, gown));
      R('#5b7fa6', 1, 4, 2, 8); R('#5b7fa6', 2, 10, 9, 2); R('#8ccbc6', 4, 8, 7, 3);
      Gfx.disc(ctx, sx + 5, y + 11, 5, '#37474f'); Gfx.disc(ctx, sx + 5, y + 11, 3, '#cfd8dc'); Gfx.px(ctx, '#37474f', sx + 5, y + 11, 1, 1);
      Gfx.disc(ctx, sx + 12, y + 14, 2, '#37474f'); R('#78909c', 10, 11, 3, 1);
    } else if (this.variant === 'iv') {
      Gfx.person(ctx, sx + 1, y, Object.assign({ state: 'walk', frame: Math.floor(time * 2) & 3, face: 1 }, gown));
      R('#cfd8dc', 11, -3, 1, 19); R('#cfd8dc', 9, -3, 3, 1); R('#8ecae6', 8, -2, 4, 6); R('#cfeaf7', 9, -1, 2, 2); R('#8ecae6', 9, 4, 1, 5); R('#90a4ae', 9, 15, 5, 1); R('#37474f', 9, 15, 1, 1); R('#37474f', 13, 15, 1, 1);
    } else { // gurney wheeled by a porter
      R('#cfd8dc', 0, 8, 28, 2); R('#ffffff', 0, 5, 28, 4); R('#5fb8b0', 0, 9, 28, 1);
      R('#8a9a99', 3, 10, 2, 3); R('#8a9a99', 23, 10, 2, 3); R('#37474f', 1, 12, 5, 2); R('#37474f', 22, 12, 5, 2);
      R('#ffffff', 1, 3, 6, 3); R('#f1c9a0', 3, 2, 4, 3); R('#d9d9d9', 3, 1, 4, 2); R('#8ccbc6', 8, 3, 18, 3); R('#bfe3f5', 8, 2, 12, 1);
      R('#78909c', 28, 6, 3, 1);
      Gfx.person(ctx, sx + 28, y - 2, { state: 'walk', frame: Math.floor(time * 2) & 3, face: 1, coat: '#2d8f87', sleeve: '#2d8f87', shirt: '#2d8f87', pants: '#2d8f87', skin: '#c68642', hair: '#202020', shoes: '#ffffff', hat: 'cap' });
    }
    ctx.restore();
    if (this.say) Gfx.bubble(ctx, this.say.text, sx + this.w / 2, y - (this.variant === 'iv' ? 8 : 4));
    else if (this.near) label(ctx, 'PATIENT', sx + this.w / 2, y - 12, '#bfe3f5');
  }
}


/* ---- Forklift: a slow, beeping hazard. Bounces you back (small hit); safe to land on top. ---- */
class Forklift extends Enemy {
  constructor(L, def) { super(L, def, 28, 20); this.beepT = rand(0.5, 2); this.say = null; }
  update(dt) {
    this.walk(dt, C.ENEMY.FORKLIFT_SPEED);
    if (this.say) { this.say.t -= dt; if (this.say.t <= 0) this.say = null; }
    this.beepT -= dt;
    if (this.beepT <= 0) { this.beepT = 1.4; if (this.near) { Sound.play('beep'); } }
  }
  onTouch(p) {
    const L = this.L;
    if (L.isStomp(p, this)) { p.stompBounce(); p.y = this.y - p.h; Sound.play('bump'); this.say = { text: 'Hey! Hard hat area!', t: 1.4 }; return; }
    const away = p.cx < this.cx ? -1 : 1;
    p.vx = away * C.PLAYER.KNOCKBACK_X; p.vy = Math.min(p.vy, -90); p.x += away * 2;
    if (p.invuln <= 0 && p.power.sponsor <= 0) { L.hurtPlayer(C.INTEGRITY.UNION_HIT, this.cx); this.say = { text: 'Beep beep! Watch out!', t: 1.4 }; }
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX), y = Math.round(this.y); if (sx < -50 || sx > C.VIEW_W + 50) return;
    ctx.save();
    if (this.dir < 0) { ctx.translate(sx + this.w, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    // forks + mast (front = right)
    R('#546e7a', 24, -1, 2, 18); R('#37474f', 25, 15, 6, 2); R('#37474f', 25, 12, 6, 1);
    // body
    R('#f59e0b', 3, 8, 20, 8); R('#fbbf24', 3, 8, 20, 2); R('#b45309', 3, 15, 20, 1);
    R('#1a1a1a', 4, 12, 3, 3); R('#fbbf24', 15, 12, 6, 1);
    // overhead guard + driver
    R('#37474f', 5, 0, 1, 8); R('#37474f', 14, 0, 1, 8); R('#37474f', 4, -1, 12, 1);
    Gfx.person(ctx, sx + 6, y - 6, { face: 1, state: 'stand', coat: '#2b6cb0', sleeve: '#2b6cb0', shirt: '#2b6cb0', pants: '#2b2b33', skin: '#c68642', hair: '#202020', hat: 'hard', vest: '#ff9f1c' });
    R('#f59e0b', 3, 8, 20, 3);
    // beacon
    const on = Math.floor(time * 4) % 2 === 0;
    R('#37474f', 9, -3, 3, 2); R(on ? '#ff9f1c' : '#b45309', 9, -5, 3, 3);
    // wheels
    Gfx.disc(ctx, sx + 7, y + 17, 3, '#1a1a1a'); Gfx.disc(ctx, sx + 7, y + 17, 1, '#90a4ae');
    Gfx.disc(ctx, sx + 20, y + 17, 3, '#1a1a1a'); Gfx.disc(ctx, sx + 20, y + 17, 1, '#90a4ae');
    ctx.restore();
    if (this.say) Gfx.bubble(ctx, this.say.text, sx + this.w / 2, y - 8);
    else if (this.near) label(ctx, 'FORKLIFT', sx + this.w / 2, y - 14, '#ffd9a0');
  }
}

/* ---- Hospital trolleys: empty gurneys, meds carts, linen carts. Pure obstacles: bounce you back and slow you;
        safe to hop on top of. No people involved. ---- */
class Trolley extends Enemy {
  constructor(L, def) {
    const v = def.variant || 'gurney';
    super(L, def, v === 'gurney' ? 30 : v === 'pallet' ? 28 : 20, v === 'gurney' ? 14 : v === 'pallet' ? 16 : 18);
    this.variant = v; this.say = null;
  }
  update(dt) {
    this.walk(dt, C.ENEMY.TROLLEY_SPEED);
    if (this.say) { this.say.t -= dt; if (this.say.t <= 0) this.say = null; }
  }
  onTouch(p) {
    const L = this.L;
    if (L.isStomp(p, this)) { p.stompBounce(); p.y = this.y - p.h; Sound.play('bump'); return; }
    const away = p.cx < this.cx ? -1 : 1;
    p.vx = away * C.PLAYER.KNOCKBACK_X * 0.8; p.vy = Math.min(p.vy, -70); p.x += away * 2;
    if (p.invuln <= 0 && p.power.sponsor <= 0) { L.hurtPlayer(C.INTEGRITY.UNION_HIT, this.cx); this.say = { text: 'Clunk!', t: 0.8 }; }
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX); if (sx < -50 || sx > C.VIEW_W + 50) return;
    const y = Math.round(this.y);
    ctx.save();
    if (this.dir < 0) { ctx.translate(sx + this.w, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    if (this.variant === 'gurney') {            // empty trolley with a folded blanket
      R('#cfd8dc', 0, 5, 30, 2); R('#ffffff', 0, 2, 30, 4); R('#5fb8b0', 0, 6, 30, 1);
      R('#ffffff', 1, 0, 6, 3); R('#8ccbc6', 9, 0, 14, 3); R('#8a9a99', 4, 7, 2, 4); R('#8a9a99', 24, 7, 2, 4);
      R('#37474f', 2, 10, 5, 4); R('#37474f', 23, 10, 5, 4); R('#78909c', 0, 1, 1, 6);
    } else if (this.variant === 'pallet') {    // pallet jack with a shrink-wrapped stack of boxes
      R('#9aa7b0', 0, 13, 28, 2); R('#78909c', 0, 15, 28, 1); R('#37474f', 3, 15, 3, 1); R('#37474f', 22, 15, 3, 1);
      R('#546e7a', 24, 5, 2, 10); R('#37474f', 22, 4, 6, 2); R('#c89b64', 3, 3, 12, 10); R('#e8c28f', 3, 3, 12, 1); R('#a87a45', 8, 3, 1, 10);
      R('#d9a66b', 16, 7, 7, 6); R('#e8c28f', 16, 7, 7, 1); R('#a87a45', 19, 7, 1, 6); R('rgba(255,255,255,0.35)', 3, 4, 20, 8);
    } else if (this.variant === 'boxcart') {   // wheeled cage trolley stacked with boxes
      R('#78909c', 0, 1, 1, 14); R('#78909c', 19, 1, 1, 14); R('#9aa7b0', 0, 12, 20, 2); R('#37474f', 1, 14, 4, 4); R('#37474f', 15, 14, 4, 4);
      R('#c89b64', 2, 4, 8, 8); R('#e8c28f', 2, 4, 8, 1); R('#a87a45', 5, 4, 1, 8); R('#d9a66b', 11, 6, 7, 6); R('#a87a45', 14, 6, 1, 6); R('#e8e0c8', 4, 0, 5, 4); R('#c0392b', 5, 1, 3, 1);
    } else if (this.variant === 'meds') {      // drawer cart
      R('#2d8f87', 0, 2, 20, 12); R('#5fb8b0', 0, 2, 20, 2); R('#1d6b65', 0, 13, 20, 1);
      R('#e8f6f4', 2, 5, 16, 3); R('#e8f6f4', 2, 9, 16, 3); R('#37474f', 9, 6, 2, 1); R('#37474f', 9, 10, 2, 1);
      R('#e03131', 14, -2, 4, 4); R('#ffffff', 15, -1, 2, 1); R('#ffffff', 16, -2, 0, 0);
      R('#37474f', 1, 14, 4, 4); R('#37474f', 15, 14, 4, 4); R('#78909c', 19, 0, 1, 4);
    } else {                                    // linen cart
      R('#78909c', 0, 6, 20, 1); R('#9aa9ae', 0, 6, 1, 8); R('#9aa9ae', 19, 6, 1, 8); R('#ffffff', 1, 0, 18, 7);
      R('#8fd0c8', 1, 2, 18, 1); R('#e8f1f0', 1, 7, 18, 6); R('#bfe0dc', 1, 9, 18, 1);
      R('#37474f', 1, 14, 4, 4); R('#37474f', 15, 14, 4, 4);
    }
    ctx.restore();
    if (this.say) Gfx.bubble(ctx, this.say.text, sx + this.w / 2, y - 6);
    else if (this.near) label(ctx, this.variant === 'gurney' ? 'TROLLEY' : this.variant === 'meds' ? 'MEDS CART' : this.variant === 'pallet' ? 'PALLET JACK' : this.variant === 'boxcart' ? 'BOX TROLLEY' : 'LINEN CART', sx + this.w / 2, y - 12, '#bfe3f5');
  }
}

/* ---- Delivery drone: hovers and patrols at platform height. Stuns on contact; safe to bounce off the top. ---- */
class Drone extends Enemy {
  constructor(L, def) {
    super(L, def, 16, 9);
    this.baseX = def.x * C.TILE + C.TILE / 2; this.baseY = (def.y !== undefined ? def.y : 10) * C.TILE;
    this.t = rand(0, 6); this.sp = rand(0.7, 1.1) * C.ENEMY.DRONE_SPEED;
    this.x = this.baseX - this.w / 2; this.y = this.baseY; this.prevX = this.x;
  }
  update(dt) {
    this.t += dt; this.prevX = this.x;
    this.x = this.baseX + Math.sin(this.t * this.sp) * this.range * C.TILE - this.w / 2;
    this.y = this.baseY + Math.sin(this.t * 2.4) * 3;
    this.dir = Math.cos(this.t * this.sp) >= 0 ? 1 : -1;
    const p = this.L.player; this.near = Math.abs(p.x - this.x) < 110 && Math.abs(p.y - this.y) < 70;
  }
  onTouch(p) {
    const L = this.L;
    if (L.isStomp(p, this)) { p.stompBounce(); p.y = this.y - p.h; Sound.play('bump'); return; }
    if (p.invuln > 0 || p.power.sponsor > 0) return;
    L.hurtPlayer(C.INTEGRITY.MANAGER_HIT, this.cx);
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX), y = Math.round(this.y); if (sx < -30 || sx > C.VIEW_W + 30) return;
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    const spin = Math.floor(time * 20) % 2 === 0;
    R('#455a64', 4, 3, 8, 5); R('#78909c', 4, 3, 8, 1); R('#e03131', 7, 5, 2, 2); R('#263238', 6, 8, 4, 1);
    R('#455a64', 1, 2, 3, 1); R('#455a64', 12, 2, 3, 1); R('#455a64', 2, 2, 1, 2); R('#455a64', 13, 2, 1, 2);
    R(spin ? '#cfd8dc' : '#90a4ae', -2, 0, 7, 1); R(spin ? '#90a4ae' : '#cfd8dc', 11, 0, 7, 1);
    if (this.near) label(ctx, 'DRONE', sx + 8, y - 10, '#ffd9a0');
  }
}

/* ---- Warehouse worker with a cart / pallet jack: slow, harmless, only slows you down ---- */
class Worker extends Enemy {
  constructor(L, def) {
    const v = def.variant || 'cart';
    super(L, def, v === 'cart' ? 30 : 24, 16);
    this.variant = v; this.say = null; this.sayT = rand(2, 5);
  }
  update(dt) {
    this.walk(dt, C.ENEMY.PATIENT_SPEED);
    if (this.say) { this.say.t -= dt; if (this.say.t <= 0) this.say = null; }
    this.sayT -= dt;
    if (this.sayT <= 0) {
      this.sayT = rand(4, 8);
      if (this.near) this.say = { text: ['Mind the load!', 'Tea break at ten.', 'Watch the yellow line.', 'Is that the safety update?', 'Take your time.'][Math.floor(Math.random() * 5)], t: 2 };
    }
  }
  onTouch(p) {
    if (p.vy > 0 && p.prevBottom <= this.y + 5) { p.vy = -170; p.y = this.y - p.h; p.cutEnabled = false; Sound.play('bump'); this.say = { text: 'Oi, mind the boxes!', t: 1.2 }; return; }
    p.slowTimer = C.PLAYER.SLOW_LINGER;
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX); if (sx < -50 || sx > C.VIEW_W + 50) return;
    const y = Math.round(this.y);
    ctx.save();
    if (this.dir < 0) { ctx.translate(sx + this.w, 0); ctx.scale(-1, 1); ctx.translate(-sx, 0); }
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    const worker = { state: 'walk', frame: Math.floor(time * 2) & 3, face: 1, coat: '#e8742a', sleeve: '#e8742a', shirt: '#e8742a', pants: '#37474f', skin: this.variant === 'cart' ? '#8d5524' : '#f1c9a0', hair: '#202020', hat: 'hard', vest: '#ffd23f' };
    if (this.variant === 'cart') {   // trolley piled with cardboard boxes, pushed from behind
      Gfx.person(ctx, sx, y, worker);
      R('#78909c', 11, 12, 18, 2); R('#546e7a', 11, 4, 1, 9); R('#37474f', 12, 14, 3, 2); R('#37474f', 25, 14, 3, 2);
      R('#c89b64', 13, 6, 9, 6); R('#dcb47c', 13, 6, 9, 1); R('#a87a45', 17, 6, 1, 6); R('#d9a66b', 22, 3, 6, 9); R('#e8c28f', 22, 3, 6, 1); R('#a87a45', 24, 3, 1, 9);
    } else {                          // pallet jack with a stack of boxes
      Gfx.person(ctx, sx, y, worker);
      R('#546e7a', 10, 15, 14, 1); R('#78909c', 10, 13, 14, 2); R('#37474f', 11, 15, 2, 1); R('#37474f', 21, 15, 2, 1);
      R('#c89b64', 12, 6, 10, 7); R('#dcb47c', 12, 6, 10, 1); R('#a87a45', 16, 6, 1, 7); R('#e8c28f', 14, 2, 6, 4); R('#a87a45', 17, 2, 1, 4);
      R('#9aa7b0', 8, 8, 2, 7);
    }
    ctx.restore();
    if (this.say) Gfx.bubble(ctx, this.say.text, sx + this.w / 2, y - 6);
    else if (this.near) label(ctx, 'WAREHOUSE STAFF', sx + this.w / 2, y - 12, '#ffe0b3');
  }
}

/* ---- Beeping Pager: a brief stun. Stomp it to silence it. ---- */
class Pager extends Enemy {
  constructor(L, def) {
    super(L, def, 10, 12);
    this.y = (def.y || 8) * C.TILE; this.baseY = this.y; this.t = rand(0, 6); this.beepT = 0;
  }
  update(dt) {
    this.t += dt; this.y = this.baseY + Math.sin(this.t * 2.5) * 3;
    const p = this.L.player;
    this.near = Math.abs(p.x - this.x) < 120;
    this.beepT -= dt;
    if (this.beepT <= 0) { this.beepT = 1.6; if (Math.abs(p.x - this.x) < 160) Sound.play('beep'); }
  }
  onTouch(p) {
    const L = this.L;
    if (p.power.sponsor > 0 || L.isStomp(p, this)) { p.stompBounce(); p.y = Math.min(p.y, this.y - p.h); this.alive = false; Sound.play('stomp'); L.sparkle(this.cx, this.y + 6, '#ffd23f', 8); L.addPopup('SILENCED!', this.cx, this.y - 6, '#ffe27a'); return; }
    if (L.hurtPlayer(C.INTEGRITY.PAGER_HIT, this.cx, { noKnock: true })) p.stun = C.INTEGRITY.PAGER_STUN;
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX), y = Math.round(this.y);
    if (sx < -20 || sx > C.VIEW_W + 20) return;
    const on = Math.floor(time * 4) % 2 === 0;
    Gfx.px(ctx, '#263238', sx + 1, y + 1, 8, 11); Gfx.px(ctx, '#455a64', sx + 1, y + 1, 8, 1);
    Gfx.px(ctx, on ? '#b7f5a8' : '#7fb872', sx + 2, y + 2, 6, 4); Gfx.px(ctx, '#e8453c', sx + 3, y + 8, 1, 2); Gfx.px(ctx, '#90a4ae', sx + 5, y + 8, 2, 2);
    if (on) { Gfx.px(ctx, '#ffd23f', sx - 2, y + 2, 1, 5); Gfx.px(ctx, '#ffd23f', sx + 11, y + 2, 1, 5); Gfx.px(ctx, '#ffd23f', sx - 4, y + 4, 1, 1); Gfx.px(ctx, '#ffd23f', sx + 13, y + 4, 1, 1); }
    if (this.near) label(ctx, on ? 'BEEP!' : 'PAGER', sx + 5, y - 9, '#ffd23f');
  }
}

/* ---- Executive Assistant: stomp to decline the CEO's meeting and leave a pile in his way ---- */
class Assistant extends Enemy {
  constructor(L, def) { super(L, def, 12, 15); this.state = 'walk'; this.timer = 0; }
  update(dt) {
    if (this.state === 'declined') { this.timer -= dt; if (this.timer <= 0) this.alive = false; return; }
    this.walk(dt, C.ENEMY.ASSISTANT_SPEED);
  }
  onTouch(p) {
    if (this.state !== 'walk') return;
    const L = this.L;
    if (p.power.sponsor > 0 || L.isStomp(p, this)) {
      if (p.power.sponsor <= 0) { p.stompBounce(); p.y = this.y - p.h; }
      this.state = 'declined'; this.timer = 0.9;
      Sound.play('stomp'); L.addPopup('MEETING DECLINED!', this.cx, this.y - 10, '#ffe27a');
      L.spawnPile(this.cx);
      return;
    }
    L.hurtPlayer(C.INTEGRITY.ASSISTANT_HIT, this.cx);
  }
  draw(ctx, camX, time) {
    const sx = this.x - camX; if (sx < -40 || sx > C.VIEW_W + 40) return;
    const flat = this.state === 'declined';
    Gfx.person(ctx, sx + 1, this.y + this.h - (flat ? 10 : 16), { face: this.dir, hair: '#8a4b2a', skin: '#f1c9a0', coat: '#2b2b36', sleeve: '#2b2b36', shirt: '#ffffff', pants: '#2b2b36', shoes: '#111', hat: 'headset', prop: 'phone',
      state: flat ? 'crouch' : 'walk', frame: Math.floor(time * 3 + this.x) & 3 });
    if (this.near && !flat) label(ctx, 'EXEC ASSISTANT', sx + this.w / 2, this.y - 10, '#d9d2ff');
  }
}

/* ---- The Nurse: the goal ---- */
class Nurse extends Enemy {
  constructor(L, col) {
    super(L, { x: col }, 12, 15);
    this.received = false; this.t = 0; this.alive = true;
  }
  update(dt) {
    this.t += dt;
    const p = this.L.player; this.near = Math.abs(p.x - this.x) < 150;
  }
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX), y = Math.round(this.y);
    if (sx < -80 || sx > C.VIEW_W + 40) return;
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(sx + a, y + b, w, h); };
    const D = this.L.data, hop = this.received ? Math.abs(Math.sin(this.t * 8)) * 4 : 0;
    if (D.drawGoal) {   // a level can draw its own goal character (e.g. the foreman)
      D.drawGoal(ctx, sx, y, hop, this.t);
      label(ctx, D.goalLabel || 'GOAL', sx + 6, y - 11 - hop, '#ffffff');
      if (this.received) Gfx.bubble(ctx, D.goalLine, sx + 6, y - 14 - hop, { scale: 2, fill: '#fffbe0' });
      else if (this.near) Gfx.bubble(ctx, (D.goalNearLines || ['Over here!'])[Math.floor(this.t / 2.5) % (D.goalNearLines || [0]).length], sx + 6, y - 14);
      return;
    }
    // nurse station counter + monitor behind the nurse
    R('#ffffff', 10, 3, 38, 3); R('#2d8f87', 10, 6, 38, 10); R('#5fb8b0', 10, 6, 38, 2); R('#1d6b65', 10, 15, 38, 1);
    R('#263238', 16, -6, 12, 9); R('#7ad7ff', 17, -5, 10, 6); R('#e03131', 21, -4, 2, 4); R('#e03131', 20, -3, 4, 2); R('#78909c', 21, 3, 2, 1);
    R('#ffffff', 34, 0, 8, 3); R('#8ccbc6', 36, 1, 4, 2);
    Gfx.person(ctx, sx + 1, y - hop, { face: -1, state: 'stand', coat: '#2fa59b', sleeve: '#2fa59b', shirt: '#2fa59b', pants: '#2fa59b', shoes: '#ffffff', hair: '#5a3825', hat: 'cap', prop: 'clipboard', lanyard: '#e03131' });
    label(ctx, 'NURSE', sx + 6, y - 11 - hop, '#ffffff');
    if (this.received) Gfx.bubble(ctx, this.L.data.goalLine, sx + 6, y - 14 - hop, { scale: 2, fill: '#fffbe0' });
    else if (this.near) Gfx.bubble(ctx, ['Over here!', 'Handover in five!', 'Is that for me?'][Math.floor(this.t / 2.5) % 3], sx + 6, y - 14);
  }
}

/* ---- The CEO: chases the player, carrying a DIFFERENT, competing message ---- */
class CEO {
  constructor(L, kind = 'ceo') {
    this.L = L; this.kind = kind; this.hr = kind === 'hr'; this.title = this.hr ? 'HR MANAGER' : 'CEO'; this.short = this.hr ? 'HR' : 'CEO';
    this.w = 12; this.h = 16; this.reset();
    this.msgIdx = 0;
  }
  /** Random competing message (attack levels re-roll after every steal; flag levels cycle). */
  pickMessage() {
    const K = C.CEO;
    if (!this.L.attack) return K.MESSAGES[this.msgIdx++ % K.MESSAGES.length];
    const pool = this.hr ? C.ATTACK.HR_MESSAGES : C.ATTACK.CEO_MESSAGES;
    let m; do { m = pool[Math.floor(Math.random() * pool.length)]; } while (m === this.message && pool.length > 1);
    return m;
  }
  get entranceLines() { return this.hr ? C.ATTACK.HR_ENTRANCE : C.CEO.ENTRANCE_LINES; }
  get tauntLines() { return this.hr ? C.ATTACK.HR_TAUNTS : C.CEO.TAUNTS; }
  reset() {
    this.active = false; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.dir = 1; this.onGround = false;
    this.state = 'idle'; this.t = 0; this.entT = 0; this.sayT = 0; this.say = null; this.tauntT = 0; this.jingleCd = 0;
    this.waiting = null; this.gapJump = false; this.stuckT = 0; this.lastX = 0; this.drainSfxT = 0; this.doorT = 0;
    this.message = C.CEO.MESSAGES[0]; this.catchCd = 0;
  }
  get cx() { return this.x + this.w / 2; }
  speak(text, dur = 2.2) { this.say = { text, t: dur }; }

  spawn(first) {
    const L = this.L, T = C.TILE, K = C.CEO, p = L.player;
    let col = Math.floor(p.x / T) - K.SPAWN_BEHIND_TILES;
    if (L.attack) { // roaming map: step out just beyond the right edge of the screen, so he meets you head-on
      col = Math.max(2, Math.min(L.cols - 4, Math.floor(p.x / T) + C.ATTACK.CHASER_AHEAD_TILES));
      let guard = 0;   // ...on clear floor (not inside a closed room, not over a lift shaft)
      while (guard++ < 40 && col < L.cols - 3 && !(L.solidAt(col, L.rows - 2) && !L.solidAt(col, L.rows - 3) && !L.solidAt(col, L.rows - 4))) col++;
    } else {
      col = Math.max(1, col);
      while (col < L.cols - 1 && !L.solidAt(col, L.rows - 2)) col++;
    }
    this.x = col * T + 2; this.y = L.groundTopAt(col) - this.h;
    this.vx = this.vy = 0; this.dir = 1; this.active = true; this.state = 'entrance'; this.entT = L.attack ? C.ATTACK.CHASER_ENTRANCE : K.ENTRANCE_TIME; this.doorT = 0;
    this.t = 0; this.waiting = null; this.gapJump = false; this.lastX = this.x; this.stuckT = 0;
    this.message = this.pickMessage();
    this.speak(this.entranceLines[Math.floor(Math.random() * this.entranceLines.length)], 2.4);
    this.tauntT = rand(K.TAUNT_INTERVAL_MIN, K.TAUNT_INTERVAL_MAX);
    Sound.play('ding'); setTimeout(() => Sound.play('ceo'), 250);
    this.jingleCd = K.JINGLE_COOLDOWN;
    if (first) L.g.banner = { text: 'THE ' + this.title + ' HAS ARRIVED', sub: 'THEY HAVE A DIFFERENT MESSAGE. KEEP MOVING.', t: 2.4 };
  }

  rescue() { // fell down a shaft / got stuck: re-enter along the player's recent route
    const L = this.L, p = L.player, T = C.TILE;
    let best = null;
    if (L.attack) { const far = L.trail.filter(s => Math.abs(s.x - p.x) > 6 * T); best = far.length ? far[Math.floor(far.length / 2)] : null; if (!best) best = { x: Math.max(16, p.x - 8 * T), y: p.y }; }
    else for (const s of L.trail) if (s.x <= p.x - 8 * T) best = s;
    if (!best) best = L.trail[0] || { x: p.x - 8 * T, y: p.y };
    this.x = best.x; this.y = best.y - 2; this.vx = this.vy = 0; this.gapJump = false; this.stuckT = 0; this.lastX = this.x;
  }

  update(dt) {
    if (!this.active) return;
    const L = this.L, p = L.player, T = C.TILE, K = C.CEO;
    this.t += dt; this.doorT += dt;
    if (this.say) { this.say.t -= dt; if (this.say.t <= 0) this.say = null; }
    if (this.jingleCd > 0) this.jingleCd -= dt;
    if (this.drainSfxT > 0) this.drainSfxT -= dt;
    if (this.catchCd > 0) this.catchCd -= dt;

    if (L.completed) { // sulks once the nurse has the message
      this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt); L.moveBody(this, 0, this.vy * dt, {});
      return;
    }
    if (this.state === 'entrance') {
      this.entT -= dt; this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt);
      L.moveBody(this, 0, this.vy * dt, {});
      if (this.entT <= 0) this.state = 'walk';
      return;
    }

    this.tauntT -= dt;
    if (this.tauntT <= 0) { this.tauntT = rand(K.TAUNT_INTERVAL_MIN, K.TAUNT_INTERVAL_MAX); if (!this.say) this.speak(this.tauntLines[Math.floor(Math.random() * this.tauntLines.length)]); }

    const dist = p.x - this.x;
    if (Math.abs(dist) > 24) this.dir = dist > 0 ? 1 : -1;
    // gradually varying speed (sine wobble) + rubber band if the player is far ahead
    let speed = (L.attack ? (this.hr ? C.ATTACK.HR_SPEED : C.ATTACK.CEO_SPEED) * (L.chaseBoost || 1) : K.BASE_SPEED) + K.SPEED_VARIATION * Math.sin(this.t * 2 * Math.PI / K.VARIATION_PERIOD);
    if (Math.abs(dist) / T > K.CATCHUP_DISTANCE_TILES) speed *= K.CATCHUP_MULT;

    // closed barrier in front? stop and wait it out
    if (this.waiting) {
      const b = this.waiting;
      this.vx = 0; b.wait += dt;
      if (b.wait >= b.delay) { L.openBarrier(b); this.waiting = null; this.speak(b.kind === 'door' ? 'Facilities, bless them.' : 'Who left that there?!'); }
    } else {
      if (this.onGround || !this.gapJump) this.vx = this.dir * speed;
      if (this.onGround) this.gapJump = false;
      const probe = { x: this.x + this.dir * 3, y: this.y, w: this.w, h: this.h };
      for (const b of L.barriers) {
        if (b.state === 'closed' && overlap(probe, b)) {
          this.waiting = b; b.wait = 0; this.vx = 0;
          this.speak(b.kind === 'door' ? 'Is this door locked?!' : b.kind === 'cart' ? 'Is that... linen?' : 'Rescheduling...', 2.6);
          break;
        }
      }
    }
    if (this.onGround && !this.waiting) {
      const ax = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      if (L.solidPx(ax, this.y + this.h - 4)) { this.vy = -K.JUMP_VELOCITY; this.onGround = false; }       // step / obstacle
      else if (!L.groundPx(ax + this.dir * 2, this.y + this.h + 2)) {                                      // shaft: leap it
        this.vy = -K.JUMP_VELOCITY; this.vx = this.dir * K.GAP_JUMP_SPEED; this.gapJump = true; this.onGround = false;
      }
    }
    // never reach the nurse: "Staff only"
    const stopX = K.STOP_BEFORE_COL * T;
    if (!L.attack && this.x > stopX && this.vx > 0) { this.vx = 0; if (!this.say) this.speak('Staff only?! Rude.', 3); }

    this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt);
    const r = L.moveBody(this, this.vx * dt, this.vy * dt, { rects: L.solidRectsForCEO() });
    this.onGround = r.landed;
    if (this.y > L.rows * T + 20) this.rescue();
    // stuck watchdog (only when not intentionally waiting)
    if (!this.waiting && Math.abs(this.x - this.lastX) < 1.5 && Math.abs(dist) > 3 * T) this.stuckT += dt; else { this.stuckT = 0; this.lastX = this.x; }
    if (this.stuckT > 2.5) this.rescue();

    // approaching jingle when he gets close
    if (this.jingleCd <= 0 && Math.abs(dist) < 7 * T && Math.abs(dist) > 2 * T) { Sound.play('ceo'); this.jingleCd = K.JINGLE_COOLDOWN; }

    // he steals any colleague he reaches before you do
    if (L.attack) for (const n of L.enemies) if (n instanceof NPC && n.reachable && overlap(this, n, 2)) { n.steal(this.message); this.message = this.pickMessage(); }
    // caught?
    if (!p.locked && overlap(p, this, K.CATCH_PADDING)) L.catchByCEO(dt, this);
  }

  draw(ctx, camX, time) {
    if (!this.active) return;
    const sx = Math.round(this.x - camX);
    if (sx < -60 || sx > C.VIEW_W + 60) return;
    // lift doors for the entrance (score-attack rounds have the chaser run in from the front, no doors)
    if (!this.L.attack && this.doorT < K_DOOR) {
      const open = Math.min(1, this.doorT / 1.0) * 9, dx = sx - 6, dy = Math.round(this.y + this.h - 28);
      Gfx.px(ctx, '#37474f', dx - 1, dy - 1, 26, 30); Gfx.px(ctx, '#fff6c0', dx + 2, dy + 2, 20, 26);
      Gfx.px(ctx, '#90a4ae', dx + 2 - open, dy + 2, 10, 26); Gfx.px(ctx, '#90a4ae', dx + 12 + open, dy + 2, 10, 26);
      Gfx.px(ctx, '#e03131', dx + 9, dy - 5, 6, 3);
    }
    const look = this.hr
      ? { hair: '#8a4b2a', skin: '#c68642', coat: '#5b3fa0', sleeve: '#5b3fa0', shirt: '#ffffff', pants: '#3a2a66', shoes: '#1a1030', lanyard: '#ff9f1c', prop: 'clipboard' }
      : { hair: '#b9bcc4', skin: '#f1c9a0', coat: '#1f2a44', sleeve: '#1f2a44', shirt: '#ffffff', tie: '#d62828', pants: '#1f2a44', shoes: '#0d0d12', glasses: '#0d0d12', prop: 'briefcase' };
    const o = { face: this.dir, ...look, state: this.state === 'entrance' ? 'stand' : this.onGround ? 'walk' : 'jump', frame: Math.floor(this.t * 6) & 3 };
    Gfx.person(ctx, sx + this.w / 2 - 5, this.y + this.h - 16, o);
    // placard with the competing message
    const py = Math.round(this.y - 4 + Math.sin(this.t * 4));
    Gfx.px(ctx, '#5b3a21', sx + this.w / 2, py, 1, 6);
    Gfx.sign(ctx, wrap2(this.message), sx + this.w / 2, py, this.hr ? { fill: '#f3eeff', color: '#4b2f8a', border: '#2c1b5a' } : { fill: '#fff0f0', color: '#b3261e', border: '#7a1a14' });
    const top = py - Gfx.measure(wrap2(this.message)).h - 7;
    label(ctx, this.title, sx + this.w / 2, top - 8, this.hr ? '#d9c9ff' : '#ffb3ad');
    if (this.say) Gfx.bubble(ctx, this.say.text, sx + this.w / 2, top - 9, { border: this.hr ? '#2c1b5a' : '#7a1a14' });
  }
}
const K_DOOR = 1.8;

function createEnemy(L, def) {
  switch (def.type) {
    case 'manager': return new Manager(L, def, false);
    case 'middleManager': return new Manager(L, def, true);
    case 'union': return new Union(L, def);
    case 'patient': return new Patient(L, def);
    case 'pager': return new Pager(L, def);
    case 'forklift': return new Forklift(L, def);
    case 'trolley': return new Trolley(L, def);
    case 'drone': return new Drone(L, def);
    case 'worker': return new Worker(L, def);
    case 'assistant': return new Assistant(L, def);
    default: throw new Error('Unknown enemy type: ' + def.type);
  }
}
