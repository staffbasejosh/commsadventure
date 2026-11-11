'use strict';
/* player.js - the player-controlled character (named by the player, never assumed). */
class Player {
  constructor(x, y) {
    const P = C.PLAYER;
    this.w = P.W; this.h = P.H;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.face = 1;
    this.onGround = false;
    this.coyote = 0; this.buffer = 0;
    this.cutEnabled = false;
    this.airJumpUsed = false;
    this.crouching = false;
    this.dropTimer = 0;
    this.slowTimer = 0;
    this.stun = 0;          // pager stun
    this.hurtTimer = 0;     // brief loss of control after a hit
    this.invuln = 0;
    this.anim = 0;
    this.prevBottom = y + this.h;
    this.locked = false;    // true during the win sequence
    this.power = { speed: 0, sponsor: 0, djump: 0, push: 0 };
    this.trailT = 0;
    this.trail = [];
  }

  get cx() { return this.x + this.w / 2; }
  get bottom() { return this.y + this.h; }

  setCrouch(L, on) {
    const P = C.PLAYER;
    if (on && !this.crouching) {
      this.crouching = true; this.y += P.H - P.CROUCH_H; this.h = P.CROUCH_H;
    } else if (!on && this.crouching) {
      const ny = this.y - (P.H - P.CROUCH_H);
      if (!L.overlapsSolid(this.x, ny, this.w, P.H)) { this.crouching = false; this.y = ny; this.h = P.H; }
    }
  }

  jump(L, double) {
    const P = C.PLAYER;
    this.vy = -(double ? C.POWERUPS.DOUBLE_JUMP.velocity : P.JUMP_VELOCITY);
    this.coyote = 0; this.buffer = 0; this.onGround = false; this.cutEnabled = true;
    if (double) { this.airJumpUsed = true; Sound.play('djump'); L.sparkle(this.cx, this.y + this.h, '#5db7ff', 8); }
    else Sound.play('jump');
  }

  stompBounce() {
    this.vy = -(Input.down('jump') ? C.PLAYER.STOMP_BOUNCE_HELD : C.PLAYER.STOMP_BOUNCE);
    this.cutEnabled = false; this.onGround = false; this.coyote = 0; this.airJumpUsed = false;
  }

  update(dt, L) {
    const P = C.PLAYER;
    this.prevBottom = this.y + this.h;
    for (const k in this.power) if (this.power[k] > 0) this.power[k] = Math.max(0, this.power[k] - dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.dropTimer > 0) this.dropTimer -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.stun > 0) this.stun -= dt;

    const ctrl = !this.locked && this.stun <= 0 && this.hurtTimer <= 0;
    const left = ctrl && Input.down('moveLeft'), right = ctrl && Input.down('moveRight');
    const downHeld = ctrl && Input.down('down');
    const jumpHeld = ctrl && Input.down('jump');

    // timers: coyote time and jump buffering
    this.coyote = this.onGround ? P.COYOTE_TIME : this.coyote - dt;
    this.buffer = (ctrl && Input.pressed('jump')) ? P.JUMP_BUFFER : this.buffer - dt;

    // crouch / drop through one-way platforms
    this.setCrouch(L, downHeld && this.onGround);
    if (ctrl && Input.pressed('down') && this.onGround && L.standingOnOneWayOnly(this)) {
      this.dropTimer = P.DROP_THROUGH_TIME; this.onGround = false; this.coyote = 0; this.y += 1;
    }

    // horizontal movement: acceleration + friction
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    let maxSpeed = P.RUN_SPEED * (this.power.speed > 0 ? C.POWERUPS.SPEED.mult : 1);
    if (this.crouching) maxSpeed *= P.CROUCH_SPEED_MULT;
    if (this.slowTimer > 0) maxSpeed *= P.PATIENT_SLOW_MULT;
    if (this.tunnel) maxSpeed *= C.ATTACK.TUNNEL_SPEED_MULT;
    const slip = this.onGround && L.isSlippery(this);
    const accel = this.onGround ? (slip ? P.SLIP_ACCEL : P.ACCEL) : P.AIR_ACCEL;
    const fric = this.onGround ? (slip ? P.SLIP_FRICTION : P.FRICTION) : P.AIR_FRICTION;
    if (dir !== 0) {
      this.face = dir;
      if (this.vx * dir < maxSpeed) this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx + dir * accel * dt));
      else this.vx -= Math.sign(this.vx) * Math.min(Math.abs(this.vx) - maxSpeed, fric * dt);
    } else if (this.hurtTimer <= 0 || this.onGround) {
      const d = fric * dt;
      this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
    }

    // jump (buffered, with coyote time and optional double jump)
    if (this.buffer > 0) {
      if (this.coyote > 0) this.jump(L, false);
      else if (this.power.djump > 0 && !this.airJumpUsed) this.jump(L, true);
    }
    // variable jump height
    if (this.cutEnabled && !jumpHeld && this.vy < -P.JUMP_CUT_VELOCITY) this.vy = -P.JUMP_CUT_VELOCITY;

    this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt);

    const wasGround = this.onGround;
    const res = L.moveBody(this, this.vx * dt, this.vy * dt, { dropThrough: this.dropTimer > 0, rects: L.solidRectsForPlayer() });
    if (res.hitX) this.vx = 0;
    this.onGround = res.landed;
    if (res.landed) { this.cutEnabled = false; this.airJumpUsed = false; if (!wasGround && this.vy === 0) { /* landed */ } }
    for (const b of res.bumped) L.bumpBlock(b.tx, b.ty, this);
    if (this.y > L.rows * C.TILE + 24) L.playerFell();

    // animation
    this.anim += Math.abs(this.vx) * dt * 0.11;

    // speed-boost afterimages
    if (this.power.speed > 0 && Math.abs(this.vx) > 40) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = 0.04; this.trail.push({ x: this.x, y: this.y, face: this.face, t: 0.22 }); }
    }
    for (const t of this.trail) t.t -= dt;
    this.trail = this.trail.filter(t => t.t > 0);
  }

  outfit(time) {
    const o = {
      face: this.face, skin: '#f1c9a0', hair: '#4a3322', coat: '#e8743b', shirt: '#ffffff', pants: '#2b3a55', shoes: '#1d1d26',
      lanyard: '#2d8f87', prop: 'envelope', sleeve: '#e8743b',
      state: this.crouching ? 'crouch' : !this.onGround ? 'jump' : Math.abs(this.vx) > 8 ? 'walk' : 'stand',
      frame: Math.floor(this.anim) & 3,
    };
    if (this.power.sponsor > 0) {
      const hues = ['#ff7ac8', '#ffd23f', '#5db7ff', '#8aef9b'];
      o.coat = o.sleeve = hues[Math.floor(time * 12) % 4];
    }
    return o;
  }

  draw(ctx, camX, g) {
    const time = g.time;
    const o = this.outfit(time);
    for (const t of this.trail) {
      ctx.globalAlpha = Math.max(0, t.t * 2);
      Gfx.person(ctx, t.x + this.w / 2 - 5 - camX, t.y + this.h - (this.crouching ? 10 : 16), Object.assign({}, o, { face: t.face, coat: '#f1c232', sleeve: '#f1c232' }));
    }
    ctx.globalAlpha = 1;
    const flicker = this.invuln > 0 && this.power.sponsor <= 0 && Math.floor(time * 20) % 2 === 0;
    const sx = this.x + this.w / 2 - 5 - camX, sy = this.y + this.h - (this.crouching ? 10 : 16);
    if (!flicker) Gfx.person(ctx, sx, sy, o);
    if (this.power.push > 0) { // tiny notification badge over the head
      Gfx.px(ctx, '#e8453c', Math.round(sx + 7), Math.round(sy - 4 + Math.sin(time * 8)), 4, 4); Gfx.px(ctx, '#fff', Math.round(sx + 8), Math.round(sy - 3 + Math.sin(time * 8)), 2, 2);
    }
    if (this.power.djump > 0) {
      Gfx.px(ctx, '#5db7ff', Math.round(sx - 2 + Math.sin(time * 7) * 2), Math.round(sy + 6), 2, 2);
    }
    if (this.stun > 0) {
      Gfx.text(ctx, 'BEEP!', Math.round(sx + 5), Math.round(sy - 12), { color: '#ffd23f', shadow: '#102830', align: 'center' });
    }
    // name tag
    Gfx.text(ctx, g.playerName, Math.round(sx + 5), Math.round(sy - 9), { raw: true, bold: true, color: '#ffffff', shadow: '#090D48', align: 'center' });
  }
}
