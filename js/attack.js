'use strict';
/* ==========================================================================
   attack.js - score-attack round: frontline colleagues (NPCs) to reach.

   A level opts in with `mode: 'attack'`. It supplies:
     npcStart:    [{ role, x, y?, mode:'stand'|'roam', range? }]  colleagues present at the start
     spawnPoints: [{ x, y, kind:'ground'|'high'|'nook' }]         where new colleagues can appear
   (x = tile column, y = row of the surface they stand on.)
   Roles are generic job titles only - no names, no real people.
   ========================================================================== */
const ROLES = {
  nurse:      { label: 'NURSE',      value: 1, weight: 3, coat: '#2fa59b', shirt: '#2fa59b', pants: '#2fa59b', hat: 'cap', prop: 'clipboard', lanyard: '#e03131', skin: '#f1c9a0', hair: '#5a3825', icon: '#2fa59b' },
  doctor:     { label: 'DOCTOR',     value: 1, weight: 2, coat: '#ffffff', shirt: '#9bd3f0', pants: '#3b4a63', glasses: '#222222', prop: 'clipboard', skin: '#c68642', hair: '#202020', icon: '#2b6cb0' },
  porter:     { label: 'PORTER',     value: 1, weight: 2, coat: '#3b5b84', shirt: '#3b5b84', pants: '#26364d', hat: 'cap', skin: '#8d5524', hair: '#202020', icon: '#6b7a90' },
  pharmacist: { label: 'PHARMACIST', value: 1, weight: 2, coat: '#e8f4ee', shirt: '#ffffff', pants: '#5b6b60', glasses: '#2b2b33', lanyard: '#2f9d62', prop: 'clipboard', skin: '#f1c9a0', hair: '#a0522d', icon: '#2f9d62' },
  cleaner:    { label: 'CLEANER',    value: 1, weight: 2, coat: '#f2b705', shirt: '#f2b705', pants: '#37474f', skin: '#e0b48a', hair: '#3a2a1e', icon: '#d49a00' },
  nurseLead:  { label: 'NURSE LEAD', value: 3, weight: 1, coat: '#1f7f78', shirt: '#1f7f78', pants: '#1f7f78', hat: 'cap', prop: 'clipboard', lanyard: '#f2b705', skin: '#c68642', hair: '#202020', icon: '#f2b705', high: true, lead: true },
  // Manufacturing cast (cleaner is shared)
  operator:   { label: 'OPERATOR',   value: 1, weight: 3, coat: '#2b6cb0', shirt: '#2b6cb0', pants: '#26364d', hat: 'hard', vest: '#ff9f1c', skin: '#c68642', hair: '#202020', icon: '#2b6cb0' },
  welder:     { label: 'WELDER',     value: 1, weight: 2, coat: '#8a5a2b', shirt: '#6b4e3a', pants: '#37474f', hat: 'hard', glasses: '#111111', skin: '#f1c9a0', hair: '#5a3825', icon: '#e8742a' },
  packer:     { label: 'PACKER',     value: 1, weight: 2, coat: '#3f9b5a', shirt: '#3f9b5a', pants: '#37474f', hat: 'cap', vest: '#ffd23f', skin: '#e0b48a', hair: '#3a2a1e', icon: '#3f9b5a' },
  driver:     { label: 'DRIVER',     value: 1, weight: 2, coat: '#e8742a', shirt: '#e8742a', pants: '#2b2b33', hat: 'hard', vest: '#ffd23f', skin: '#8d5524', hair: '#202020', icon: '#e8742a' },
  supervisor: { label: 'SHIFT SUPERVISOR', value: 3, weight: 1, coat: '#f4f6f8', shirt: '#f4f6f8', pants: '#3b4a63', hat: 'hard', vest: '#ff9f1c', prop: 'clipboard', lanyard: '#f2b705', skin: '#c68642', hair: '#202020', icon: '#f2b705', high: true, lead: true },
  // Finance (bank branch) cast (cleaner is shared)
  teller:     { label: 'TELLER',     value: 1, weight: 3, coat: '#1f4e79', shirt: '#ffffff', pants: '#26364d', tie: '#c9a227', lanyard: '#c9a227', skin: '#f1c9a0', hair: '#5a3825', icon: '#1f7a5a' },
  guard:      { label: 'SECURITY GUARD', value: 1, weight: 2, coat: '#2b2f3a', shirt: '#ffffff', pants: '#1b1e27', hat: 'cap', skin: '#8d5524', hair: '#202020', icon: '#46607a' },
  loans:      { label: 'HOME LOAN SPECIALIST', value: 1, weight: 2, coat: '#7a3b2e', shirt: '#ffffff', pants: '#3b4a63', glasses: '#2b2b33', prop: 'clipboard', lanyard: '#1f7a5a', skin: '#c68642', hair: '#202020', icon: '#c0603a' },
  advisor:    { label: 'FINANCIAL ADVISER', value: 1, weight: 2, coat: '#2f4a3f', shirt: '#e8f4ee', pants: '#26364d', tie: '#1f7a5a', prop: 'briefcase', skin: '#f1c9a0', hair: '#a0522d', icon: '#2f9d62' },
  manager:    { label: 'BRANCH MANAGER', value: 3, weight: 1, coat: '#1a1f3a', shirt: '#ffffff', pants: '#1a1f3a', tie: '#c9a227', glasses: '#222222', prop: 'clipboard', lanyard: '#f2b705', skin: '#c68642', hair: '#b9bcc4', icon: '#f2b705', high: true, lead: true },
  // Transport (airport) cast (cleaner is shared)
  agent:      { label: 'CHECK-IN AGENT', value: 1, weight: 3, coat: '#1f4e79', shirt: '#ffffff', pants: '#26364d', tie: '#e8742a', hat: 'headset', lanyard: '#e8742a', skin: '#f1c9a0', hair: '#5a3825', icon: '#2b6cb0' },
  crew:       { label: 'CABIN CREW', value: 1, weight: 2, coat: '#c0392b', shirt: '#ffffff', pants: '#7a2218', tie: '#f2b705', skin: '#c68642', hair: '#202020', icon: '#c0392b' },
  handler:    { label: 'BAGGAGE HANDLER', value: 1, weight: 2, coat: '#e8742a', shirt: '#e8742a', pants: '#2b2b33', hat: 'hard', vest: '#ffd23f', skin: '#8d5524', hair: '#202020', icon: '#e8742a' },
  officer:    { label: 'SECURITY OFFICER', value: 1, weight: 2, coat: '#2b2f3a', shirt: '#ffffff', pants: '#1b1e27', hat: 'cap', lanyard: '#1f4e79', skin: '#e0b48a', hair: '#3a2a1e', icon: '#46607a' },
  captain:    { label: 'CAPTAIN', value: 3, weight: 1, coat: '#14213d', shirt: '#ffffff', pants: '#14213d', tie: '#c9a227', hat: 'cap', prop: 'briefcase', lanyard: '#c9a227', skin: '#c68642', hair: '#b9bcc4', icon: '#f2b705', high: true, lead: true },
};

class NPC extends Enemy {
  constructor(L, def) {
    super(L, def, 12, 15);
    this.role = def.role; this.R = ROLES[def.role];
    this.value = (C.ATTACK.NPC_VALUES[def.role] !== undefined) ? C.ATTACK.NPC_VALUES[def.role] : this.R.value;
    this.mode = def.mode || 'stand';
    this.state = 'spawn'; this.t = 0; this.timer = 0; this.stolenMsg = '';
    this.dir = Math.random() < 0.5 ? 1 : -1;
    if (def.y !== undefined) this.y = def.y * C.TILE - this.h;
  }
  get active() { return this.state === 'idle' || this.state === 'walk' || this.state === 'spawn'; }
  get reachable() { return this.state === 'idle' || this.state === 'walk' || this.state === 'spawn'; }
  steal(msg) {
    if (!this.reachable) return;
    this.state = 'stolen'; this.timer = C.ATTACK.STOLEN_TIME; this.stolenMsg = msg;
    Sound.play('hurt'); this.L.sparkle(this.cx, this.y + 4, '#ff9f98', 8);
    this.L.addPopup('STOLEN!', this.cx, this.y - 6, '#ff9f98');
  }
  reach() {
    const L = this.L, g = L.g;
    this.state = 'reached'; this.timer = 1.1;
    const lines = C.ATTACK.RECEIVED_LINES; this.reply = lines[Math.floor(Math.random() * lines.length)];
    g.reached += this.value; g.reachedCount++;
    Sound.play('coin');
    L.addPopup('+' + this.value, this.cx, this.y - 16, '#ffe27a');
    if (this.R.lead) { g.addTime(C.ATTACK.NUM_TIME_BONUS); L.addPopup('+' + C.ATTACK.NUM_TIME_BONUS + 's', this.cx, this.y - 28, '#9ff0c8'); }
    L.sparkle(this.cx, this.y + 4, '#ffe27a', this.value > 1 ? 14 : 8);
  }
  update(dt) {
    this.t += dt;
    const p = this.L.player;
    this.near = Math.abs(p.x - this.x) < 100 && Math.abs(p.y - this.y) < 60;
    if (this.state === 'spawn') { if (this.t > 0.5) this.state = this.mode === 'roam' ? 'walk' : 'idle'; return; }
    if (this.state === 'reached') { this.timer -= dt; if (this.timer <= 0) this.alive = false; return; }
    if (this.state === 'stolen') { this.timer -= dt; if (this.timer <= 0) this.alive = false; return; }
    if (this.state === 'walk') this.walk(dt, C.ATTACK.NPC_ROAM_SPEED);
    else { this.vy = Math.min(C.MAX_FALL, this.vy + C.GRAVITY * dt); this.onGround = this.L.moveBody(this, 0, this.vy * dt, {}).landed; if (this.onGround) this.vy = 0; if (p.x < this.x - 2) this.dir = -1; else if (p.x > this.x + 2) this.dir = 1; }
    // delivery is instant: touch (or walk through) a colleague. Generous pad so jumps over them count.
    if (!p.locked && overlap(p, this, 5)) this.reach();
  }
  onTouch() {}
  draw(ctx, camX, time) {
    const sx = Math.round(this.x - camX); if (sx < -40 || sx > C.VIEW_W + 40) return;
    const R = this.R, y = Math.round(this.y);
    let hop = 0, alpha = 1;
    if (this.state === 'reached') hop = Math.abs(Math.sin(this.t * 9)) * 4;
    if (this.state === 'spawn') alpha = Math.min(1, this.t / 0.45);
    if (this.state === 'stolen' && this.timer < 1) alpha = Math.max(0.2, this.timer);
    ctx.globalAlpha = alpha;
    const stolen = this.state === 'stolen';
    const o = Object.assign({ face: this.dir, state: this.state === 'walk' ? 'walk' : 'stand', frame: Math.floor(time * 4 + this.x * 0.1) & 3 }, R);
    if (stolen) { o.coat = o.sleeve = '#8d99a6'; o.shirt = '#8d99a6'; o.lanyard = null; }
    Gfx.person(ctx, sx + this.w / 2 - 5, y + this.h - 16 - hop, o);
    if (this.role === 'cleaner') { // mop
      Gfx.px(ctx, '#9aa7b0', sx + (this.dir > 0 ? 11 : 0), y - 2 - hop, 1, 17); Gfx.px(ctx, '#e8e0c8', sx + (this.dir > 0 ? 9 : -2), y + 13 - hop, 5, 3);
    } else if (R.lead) {
      Gfx.px(ctx, '#f2b705', sx + 5, y + 7 - hop, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (this.state === 'reached') { Gfx.bubble(ctx, this.reply || 'Got it!', sx + this.w / 2, y - 6 - hop); return; }
    if (stolen) { Gfx.bubble(ctx, this.stolenMsg, sx + this.w / 2, y - 4, { border: '#7a1a14', fill: '#fff0f0', color: '#b3261e' }); return; }
    // floating role icon (+ value for the Nurse Lead)
    const bob = Math.round(Math.sin(time * 3 + this.x) * 1.5), ix = sx + this.w / 2, iy = y - 11 + bob;
    drawRoleIcon(ctx, this.role, ix, iy, R.icon, this.value);
    if (this.near) label(ctx, R.label, ix, iy - 14, '#ffffff');
  }
}

/** Tiny pictogram badge above a colleague (smooth vector, drawn over the pixel world). */
function drawRoleIcon(ctx, role, cx, cy, color, value) {
  ctx.beginPath(); ctx.arc(cx, cy, 5.4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  switch (role) {
    case 'nurse': ctx.fillRect(-0.7, -2.6, 1.4, 5.2); ctx.fillRect(-2.6, -0.7, 5.2, 1.4); break;
    case 'doctor': ctx.beginPath(); ctx.arc(0, -0.6, 1.9, Math.PI * 0.1, Math.PI * 0.9, false); ctx.stroke(); ctx.beginPath(); ctx.arc(1.6, 1.4, 0.9, 0, Math.PI * 2); ctx.fill(); break;
    case 'porter': ctx.fillRect(-2.8, -0.8, 5.6, 1.4); ctx.beginPath(); ctx.arc(-1.8, 1.6, 0.8, 0, Math.PI * 2); ctx.arc(1.8, 1.6, 0.8, 0, Math.PI * 2); ctx.fill(); break;
    case 'pharmacist': ctx.rotate(-0.7); ctx.fillRect(-2.6, -1, 2.6, 2); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, -1, 2.6, 2); break;
    case 'cleaner': ctx.beginPath(); ctx.moveTo(-2.2, -1.2); ctx.lineTo(2.2, -1.2); ctx.lineTo(1.5, 2.4); ctx.lineTo(-1.5, 2.4); ctx.closePath(); ctx.fill(); break;
    case 'operator': ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, Math.PI * 2); ctx.lineWidth = 1.4; ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); ctx.fillRect(-0.6, -3.6, 1.2, 1.6); ctx.restore(); } break;
    case 'welder': ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0.9, -0.6); ctx.lineTo(3, 0); ctx.lineTo(0.9, 0.8); ctx.lineTo(0, 3); ctx.lineTo(-0.9, 0.8); ctx.lineTo(-3, 0); ctx.lineTo(-0.9, -0.6); ctx.closePath(); ctx.fill(); break;
    case 'packer': ctx.fillRect(-2.6, -1.6, 5.2, 3.6); ctx.fillStyle = color; ctx.fillRect(-0.4, -1.6, 0.8, 3.6); break;
    case 'driver': ctx.fillRect(-2.8, -0.4, 4.6, 2); ctx.fillRect(1.4, -2.8, 1.1, 4.8); ctx.beginPath(); ctx.arc(-1.6, 2.1, 0.8, 0, Math.PI * 2); ctx.arc(0.6, 2.1, 0.8, 0, Math.PI * 2); ctx.fill(); break;
    case 'teller': Gfx.text(ctx, '$', 0, -3, { font: 'body', bold: true, size: 6.6, color: '#ffffff', align: 'center', raw: true }); break;
    case 'guard': ctx.beginPath(); ctx.moveTo(-2.4, -2.6); ctx.lineTo(2.4, -2.6); ctx.lineTo(2.4, 0.4); ctx.lineTo(0, 3); ctx.lineTo(-2.4, 0.4); ctx.closePath(); ctx.fill(); break;
    case 'loans': ctx.beginPath(); ctx.moveTo(-3, 0.4); ctx.lineTo(0, -2.8); ctx.lineTo(3, 0.4); ctx.closePath(); ctx.fill(); ctx.fillRect(-2, 0.4, 4, 2.6); ctx.fillStyle = color; ctx.fillRect(-0.6, 1.2, 1.2, 1.8); break;
    case 'advisor': ctx.fillRect(-2.8, 0.6, 1.6, 2.2); ctx.fillRect(-0.8, -1, 1.6, 3.8); ctx.fillRect(1.2, -2.8, 1.6, 5.6); break;
    case 'agent': ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2.6, 0.2); ctx.lineTo(-0.8, 2.2); ctx.lineTo(2.8, -2.2); ctx.stroke(); break;
    case 'crew': ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, -2.6); ctx.lineTo(1, 2.8); ctx.lineTo(0, 0.6); ctx.closePath(); ctx.fill(); break;
    case 'handler': ctx.fillRect(-2.8, -1.2, 5.6, 4); ctx.fillRect(-1.2, -2.8, 2.4, 1.2); ctx.fillStyle = color; ctx.fillRect(-0.4, -1.2, 0.8, 4); break;
    case 'officer': ctx.beginPath(); ctx.moveTo(-2.4, -2.6); ctx.lineTo(2.4, -2.6); ctx.lineTo(2.4, 0.4); ctx.lineTo(0, 3); ctx.lineTo(-2.4, 0.4); ctx.closePath(); ctx.fill(); break;
    case 'nurseLead': case 'supervisor': case 'manager': case 'captain': Gfx.text(ctx, String(value), 0, -2.6, { font: 'body', bold: true, size: 6.4, color: '#4a3200', align: 'center', raw: true }); break;
  }
  ctx.restore();
  if (value > 1 && role !== 'nurseLead' && role !== 'supervisor' && role !== 'manager' && role !== 'captain') Gfx.text(ctx, 'x' + value, cx + 7, cy - 2, { size: 5.4, bold: true, color: '#ffe27a', shadow: '#090D48', raw: true });
}

const Attack = {
  /** Called once when a Level is built. */
  init(L) {
    L.attackT = 0; L.spawnT = C.ATTACK.SPAWN_INTERVAL; L.ceoStarted = false;
    const g = L.g;
    g.reached = 0; g.reachedCount = 0; g.spawned = 0;
    for (const d of (L.data.npcStart || [])) this.add(L, d, false);
  },
  add(L, d, pop, pending) {
    const n = new NPC(L, d);
    L.enemies.push(n);
    if (pending) n.pending = true; else L.g.spawned++;   // generated ahead of you: counted once you get close
    if (pop) L.sparkle(n.cx, n.y + 6, '#ffffff', 10);
    return n;
  },
  unreached(L) { return L.enemies.filter(e => e instanceof NPC && e.reachable); },
  /** Pick a spawn point that is free, off-screen-ish and not on top of the player. */
  spawn(L) {
    const T = C.TILE, p = L.player, pts = L.spawnPoints || [], A = C.ATTACK;
    const live = L.enemies.filter(e => e instanceof NPC && e.state !== 'reached');
    const camL = L.g.camX, camR = L.g.camX + L.viewW;
    const free = pts.filter(s => {
      const px = s.x * T + 8;
      if (Math.abs(px - p.cx) < 6 * T || Math.abs(px - p.cx) > A.SPAWN_RANGE * T) return false;
      if (live.some(n => Math.abs(n.cx - px) < 3 * T && Math.abs(n.y + n.h - s.y * T) < 20)) return false;
      return true;
    });
    if (!free.length) return;
    // prefer points off-screen so people don't pop in under your nose
    const off = free.filter(s => s.x * T < camL - 8 || s.x * T > camR + 8);
    let pool = off.length && Math.random() < 0.7 ? off : free;
    const up = pool.filter(s => s.y < 15);   // most colleagues are on the upper floors
    if (up.length && Math.random() < A.HIGH_BIAS) pool = up;
    const s = pool[Math.floor(Math.random() * pool.length)];
    const roles = (L.data.rolePool || Object.keys(ROLES)).filter(r => !ROLES[r].high || s.kind !== 'ground');
    let total = 0; for (const r of roles) total += ROLES[r].weight;
    let k = Math.random() * total, role = roles[0];
    for (const r of roles) { k -= ROLES[r].weight; if (k <= 0) { role = r; break; } }
    this.add(L, { role, x: s.x, y: s.y, mode: Math.random() < 0.5 ? 'roam' : 'stand', range: 3 }, true);
  },
  update(L, dt) {
    const A = C.ATTACK;
    L.attackT += dt;
    L.spawnT -= dt;
    if (L.spawnT <= 0) {
      const sc = L.data.npcScale || 1;   // levels can thin their cast (0.85 = about 15% fewer colleagues)
      L.spawnT = A.SPAWN_INTERVAL / sc;
      if (this.unreached(L).length < Math.round(A.MAX_ACTIVE * sc)) this.spawn(L);
    }
    // endless levels: colleagues generated ahead count once you reach them; far-away unreached ones fade out
    const pcx = L.player.cx;
    for (const e of L.enemies) {
      if (!(e instanceof NPC) || !e.reachable) continue;
      const d = Math.abs(e.cx - pcx);
      if (e.pending && d < A.ENCOUNTER_TILES * C.TILE) { e.pending = false; L.g.spawned++; }
      else if (d > A.CULL_TILES * C.TILE) { if (!e.pending) e.alive = false; }
    }

  },
  /** Called each time you leave a staff corridor/lounge heading forwards. */
  onCorridorPassed(L, n) {
    const A = C.ATTACK;
    if (n === 1) { if (!L.ceo.active) L.ceo.spawn(true); }
    else if (n === 2) { if (!L.hr.active) L.hr.spawn(true); }
  },
  rankFor(points) {
    let name = C.ATTACK.RANKS[0][1];
    for (const [min, n] of C.ATTACK.RANKS) if (points >= min) name = n;
    return name;
  },
};
