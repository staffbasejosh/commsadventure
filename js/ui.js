'use strict';
/* ==========================================================================
   ui.js - text + sprite helpers (Gfx) and every screen/HUD (UI).
   Game world art is drawn procedurally as pixel art. All UI text is real
   vector type (Epilogue for headlines, Inter for body/labels - Staffbase
   brand fonts, loaded from Google Fonts with a system-sans fallback) drawn
   on a hi-res canvas so it stays crisp. Offscreen sprite canvases (tiny
   icons baked into tiles) still use the built-in 3x5 pixel font.
   ========================================================================== */
const Gfx = (() => {
  // ---- Staffbase palette ---------------------------------------------------
  const BRAND = {
    blue: '#23B4FF', dark: '#090D48', white: '#FFFFFF', orange: '#FF9600', orangeHover: '#E46F03',
    midBlue: '#006CFF', purple: '#7A47D1', magenta: '#CD48FD', pink: '#FF475D', green: '#57FF8F',
    light: '#F3F3F3', mid: '#D9D9D9', gray: '#9B9B9B', tint: '#EBF8FF',
  };
  const FAM_HEAD = "Epilogue, Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
  const FAM_BODY = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

  // Backing-store multiplier (canvas pixels per logical pixel); Game.resize() keeps it current.
  const state = { S: 3, main: null };

  // ---- legacy 3x5 pixel font (offscreen sprites only) ----------------------
  const G = {
    A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6], E:[7,4,6,4,7], F:[7,4,6,4,4],
    G:[3,4,5,5,3], H:[5,5,7,5,5], I:[7,2,2,2,7], J:[1,1,1,5,2], K:[5,5,6,5,5], L:[4,4,4,4,7],
    M:[5,7,7,5,5], N:[6,5,5,5,5], O:[2,5,5,5,2], P:[6,5,6,4,4], Q:[2,5,5,6,3], R:[6,5,6,5,5],
    S:[3,4,2,1,6], T:[7,2,2,2,2], U:[5,5,5,5,7], V:[5,5,5,5,2], W:[5,5,7,7,5], X:[5,5,2,5,5],
    Y:[5,5,2,2,2], Z:[7,1,2,4,7],
    0:[7,5,5,5,7], 1:[2,6,2,2,7], 2:[6,1,2,4,7], 3:[6,1,2,1,6], 4:[5,5,7,1,1],
    5:[7,4,6,1,6], 6:[3,4,7,5,7], 7:[7,1,2,2,2], 8:[7,5,7,5,7], 9:[7,5,7,1,6],
    '!':[2,2,2,0,2], '?':[6,1,2,0,2], '.':[0,0,0,0,2], ',':[0,0,0,2,4], ':':[0,2,0,2,0],
    "'":[2,2,0,0,0], '"':[5,5,0,0,0], '-':[0,0,7,0,0], '+':[0,2,7,2,0], '%':[5,1,2,4,5],
    '#':[5,7,5,7,5], '_':[0,0,0,0,7], '/':[1,1,2,4,4], '(':[1,2,2,2,1], ')':[4,2,2,2,4],
    '&':[2,5,2,5,3], '*':[0,5,2,5,0], '=':[0,7,0,7,0], '>':[4,2,1,2,4], '<':[1,2,4,2,1],
    ' ':[0,0,0,0,0],
  };
  const pixCache = new Map();
  function pixMeasure(str, scale) {
    const lines = String(str).split('\n');
    let w = 0;
    for (const l of lines) w = Math.max(w, l.length * 4 * scale - scale);
    return { w: Math.max(0, w), h: lines.length * 6 * scale - scale };
  }
  function pixRender(str, scale, color, shadow, align) {
    const lines = str.split('\n');
    const m = pixMeasure(str, scale);
    const sh = shadow ? scale : 0;
    const cv = document.createElement('canvas');
    cv.width = m.w > 0 ? m.w + sh : 0; cv.height = m.w > 0 ? m.h + sh : 0;
    const c = cv.getContext('2d');
    const pass = (col, ox, oy) => {
      c.fillStyle = col;
      lines.forEach((line, li) => {
        const lw = line.length * 4 * scale - scale;
        const lx = align === 'center' ? Math.floor((m.w - lw) / 2) : align === 'right' ? m.w - lw : 0;
        for (let i = 0; i < line.length; i++) {
          const rows = G[line[i]] || G['?'];
          for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) {
            if (rows[r] & (4 >> b)) c.fillRect(ox + lx + i * 4 * scale + b * scale, oy + li * 6 * scale + r * scale, scale, scale);
          }
        }
      });
    };
    if (shadow) pass(shadow, sh, sh);
    pass(color, 0, 0);
    return cv;
  }
  function pixText(ctx, str, x, y, o) {
    const scale = o.scale || 1, color = o.color || '#fff', align = o.align || 'left';
    str = String(str).toUpperCase();
    const shadow = o.shadow === undefined ? '' : o.shadow;
    const key = scale + '|' + color + '|' + shadow + '|' + align + '|' + str;
    let cv = pixCache.get(key);
    if (!cv) { if (pixCache.size > 300) pixCache.clear(); cv = pixRender(str, scale, color, shadow, align); pixCache.set(key, cv); }
    if (!cv.width || !cv.height) return;
    let dx = x;
    if (align === 'center') dx = x - Math.floor((cv.width - (shadow ? scale : 0)) / 2);
    else if (align === 'right') dx = x - (cv.width - (shadow ? scale : 0));
    ctx.drawImage(cv, Math.round(dx), Math.round(y));
  }

  // ---- vector type ---------------------------------------------------------
  const ACRONYMS = new Set(['CEO', 'HR', 'ICU', 'FAQ']);
  const isCaps = s => /[A-Z]/.test(s) && s === s.toUpperCase();
  /** "ALL CAPS SENTENCE!" -> "All caps sentence!" (keeps a few acronyms). */
  function sentence(s) {
    let out = s.toLowerCase().replace(/\b[a-z]+\b/g, w => ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w);
    return out.replace(/(^|[.!?]\s+)(["'“(]?)([a-z])/g, (m, a, q, c) => a + q + c.toUpperCase());
  }

  const SIZES = {
    head: { 1: 9, 2: 13, 3: 20 },
    body: { 1: 7.5, 2: 11, 3: 15 },
    label: { 1: 6.2, 2: 8.5, 3: 11 },
  };
  /** Work out font, size, spacing and final string for a text call. */
  function spec(str, o) {
    o = o || {};
    const scale = o.scale || 1;
    let s = String(str);
    let kind = o.font;
    if (!kind) kind = scale >= 2 ? 'head' : (!o.raw && isCaps(s) && s.length <= 14 ? 'label' : 'body');
    if (!o.raw && kind !== 'label' && isCaps(s) && (kind === 'head' || s.length > 14)) s = sentence(s);
    const size = o.size || SIZES[kind][scale] || SIZES[kind][1] * scale;
    const weight = kind === 'head' ? 800 : kind === 'label' ? 700 : (o.bold ? 700 : 500);
    const spacing = o.spacing !== undefined ? o.spacing : kind === 'label' ? size * 0.07 + 0.2 : kind === 'head' ? -size * 0.01 : 0;
    return {
      str: s, kind, size, spacing, weight,
      font: weight + ' ' + size + 'px ' + (kind === 'head' ? FAM_HEAD : FAM_BODY),
      pitch: size * 1.3, cap: size * 0.73,
    };
  }

  const mctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  function setSpacing(c, sp) { if ('letterSpacing' in c) c.letterSpacing = sp.toFixed(2) + 'px'; }
  function measure(str, scaleOrOpts) {
    const o = typeof scaleOrOpts === 'object' && scaleOrOpts ? scaleOrOpts : { scale: scaleOrOpts || 1 };
    const sp = spec(str, o);
    const key = sp.font + '|' + sp.spacing + '|' + sp.str;
    let r = mcache.get(key);
    if (!r) {
      mctx.font = sp.font; setSpacing(mctx, sp.spacing);
      const lines = sp.str.split('\n');
      let w = 0;
      for (const l of lines) w = Math.max(w, mctx.measureText(l).width - (sp.spacing > 0 ? sp.spacing : 0));
      r = { w: Math.ceil(w * 10) / 10, h: (lines.length - 1) * sp.pitch + sp.cap, size: sp.size };
      if (mcache.size > 800) mcache.clear();
      mcache.set(key, r);
    }
    return r;
  }
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => mcache.clear());

  /**
   * text(ctx, str, x, y, {scale,color,align,shadow,font,size,bold,raw,spacing})
   * y is the top of the capital letters; x is left / centre / right by align.
   * `shadow` draws a soft contrasting halo (for text over the game world).
   */
  function text(ctx, str, x, y, o = {}) {
    str = String(str);
    if (!str) return;
    if (ctx !== state.main) return pixText(ctx, str, x, y, o);
    const sp = spec(str, o);
    ctx.save();
    ctx.font = sp.font; setSpacing(ctx, sp.spacing);
    ctx.textBaseline = 'alphabetic';
    const align = o.align || 'left';
    ctx.textAlign = align;
    ctx.lineJoin = 'round';
    const lines = sp.str.split('\n');
    const shadow = o.shadow === undefined ? '' : o.shadow;
    lines.forEach((line, i) => {
      const by = y + sp.cap + i * sp.pitch;
      if (shadow) { ctx.lineWidth = Math.max(1.4, sp.size * 0.2); ctx.strokeStyle = shadow; ctx.strokeText(line, x, by); }
      ctx.fillStyle = o.color || '#fff';
      ctx.fillText(line, x, by);
    });
    ctx.restore();
  }

  /** Draw several coloured runs on one line: runs = [[text, colour], ...]. Left-aligned only. */
  function runs(ctx, list, x, y, o = {}) {
    let cx = x;
    for (const [t, color] of list) {
      text(ctx, t, cx, y, Object.assign({}, o, { color, align: 'left' }));
      cx += measure(t, o).w + (o.gap || 0);
    }
  }

  const px = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // ---- smooth shapes (hi-res canvas only) -----------------------------------
  function rrPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /** Rounded rectangle: fill and/or stroke. */
  function rr(ctx, x, y, w, h, r, fill, stroke, lw) {
    rrPath(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  /** White card with a soft Dark Blue shadow. */
  function card(ctx, x, y, w, h, o = {}) {
    ctx.save();
    ctx.shadowColor = o.shadow || 'rgba(9,13,72,0.30)';
    ctx.shadowBlur = (o.blur || 14) * state.S; ctx.shadowOffsetY = 3 * state.S;
    rr(ctx, x, y, w, h, o.r === undefined ? 12 : o.r, o.fill || BRAND.white);
    ctx.restore();
    if (o.stroke) rr(ctx, x, y, w, h, o.r === undefined ? 12 : o.r, null, o.stroke, 1);
  }
  /** Staffbase gradient signature bar: orange -> magenta -> blue. */
  function brandBar(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, BRAND.orange); g.addColorStop(0.5, BRAND.magenta); g.addColorStop(1, BRAND.blue);
    rr(ctx, x, y, w, h, h / 2, g);
  }
  function arrow(ctx, x, cy, color, len = 6) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + len, cy);
    const d = len < 0 ? -1 : 1;
    ctx.moveTo(x + len - 2.6 * d, cy - 2.6); ctx.lineTo(x + len, cy); ctx.lineTo(x + len - 2.6 * d, cy + 2.6);
    ctx.stroke(); ctx.restore();
  }
  /** Pill button. selected = orange primary CTA (Dark Blue label + arrow); otherwise light gray. */
  function cta(ctx, label, x, y, w, h, selected, nudge = 0) {
    rr(ctx, x, y, w, h, h / 2, selected ? BRAND.orange : BRAND.light, selected ? null : BRAND.mid, 1);
    const tw = measure(label, { font: 'label', scale: 1, size: 6.6 }).w;
    const arrowW = selected ? 12 : 0;
    const tx = x + Math.round((w - tw - arrowW) / 2);
    text(ctx, label, tx, y + (h - 6.6 * 0.73) / 2 + 0.2, { font: 'label', size: 6.6, color: BRAND.dark, spacing: 0.6 });
    if (selected) arrow(ctx, tx + tw + 5 + nudge, y + h / 2, BRAND.dark, 6);
  }

  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
      ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }

  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    return { c, x };
  }

  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  /** Speech bubble whose tail points at (tx,ty). Clamped to the screen. */
  function bubble(ctx, str, tx, ty, o = {}) {
    const to = { scale: o.scale || 1, bold: true };
    const m = measure(str, to);
    const pad = 5, w = Math.ceil(m.w) + pad * 2, h = Math.ceil(m.h) + pad * 2 - 1;
    let bx = Math.round(tx - w / 2);
    bx = Math.max(2, Math.min(C.VIEW_W - w - 2, bx));
    let by = Math.round(ty - h - 5);
    if (by < 2) by = 2;
    const border = o.border || BRAND.dark, fill = o.fill || '#ffffff';
    const tailX = Math.max(bx + 7, Math.min(bx + w - 7, Math.round(tx)));
    ctx.save();
    ctx.shadowColor = 'rgba(9,13,72,0.25)'; ctx.shadowBlur = 5 * state.S; ctx.shadowOffsetY = 1.5 * state.S;
    rr(ctx, bx, by, w, h, 6, fill);
    ctx.beginPath(); ctx.moveTo(tailX - 3, by + h - 0.5); ctx.lineTo(tailX, by + h + 4); ctx.lineTo(tailX + 3, by + h - 0.5); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.restore();
    rr(ctx, bx, by, w, h, 6, null, border, 0.8);
    ctx.beginPath(); ctx.moveTo(tailX - 3, by + h - 0.4); ctx.lineTo(tailX, by + h + 4); ctx.lineTo(tailX + 3, by + h - 0.4);
    ctx.strokeStyle = border; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tailX - 2.4, by + h - 0.2); ctx.lineTo(tailX + 2.4, by + h - 0.2); ctx.strokeStyle = fill; ctx.lineWidth = 1.4; ctx.stroke();
    text(ctx, str, bx + pad, by + pad, { scale: o.scale || 1, bold: true, color: o.color || BRAND.dark });
  }

  /** A picket / placard board centred on cx whose bottom edge is at bottomY. */
  function sign(ctx, str, cx, bottomY, o = {}) {
    const to = { scale: 1, bold: true, raw: !!o.raw };
    const m = measure(str, to);
    const pad = 4, w = Math.ceil(m.w) + pad * 2, h = Math.ceil(m.h) + pad * 2 - 1;
    const x = Math.round(cx - w / 2), y = Math.round(bottomY - h);
    rr(ctx, x, y, w, h, 3, o.fill || '#ffffff', o.border || BRAND.dark, 1);
    text(ctx, str, x + w / 2, y + pad, { scale: 1, bold: true, raw: !!o.raw, align: 'center', color: o.color || BRAND.dark });
  }

  /**
   * Generic pixel person, 10x16 sprite box with its top-left at (x,y).
   * o: face(1|-1) state('stand'|'walk'|'jump'|'crouch') frame(0..3) skin hair shirt coat pants shoes tie
   *    glasses hat('cap'|'hard'|'headset') lanyard prop('clipboard'|'briefcase'|'phone'|'envelope')
   */
  function person(ctx, x, y, o) {
    x = Math.round(x); y = Math.round(y);
    ctx.save();
    if (o.face < 0) { ctx.translate(x + 10, y); ctx.scale(-1, 1); } else ctx.translate(x, y);
    const P = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, w, h); };
    const skin = o.skin || '#f1c9a0', hair = o.hair || '#4a3322', shoes = o.shoes || '#2b2b33', pants = o.pants || '#3b4a63';
    const top = o.coat || o.shirt || '#ffffff';
    const crouch = o.state === 'crouch';
    const fr = o.frame | 0;

    // legs
    if (crouch) {
      P(pants, 2, 8, 6, 1); P(shoes, 1, 9, 7, 1);
    } else {
      let back, front;
      if (o.state === 'jump') { back = [1, 4]; front = [6, 3]; }
      else if (o.state === 'walk') {
        const F = [[[1, 4], [6, 3]], [[3, 5], [4, 5]], [[1, 3], [6, 4]], [[3, 5], [4, 5]]][fr & 3];
        back = F[0]; front = F[1];
      } else { back = [2, 5]; front = [5, 5]; }
      for (const [lx, len] of [back, front]) { P(pants, lx, 11, 3, len - 1); P(shoes, lx, 10 + len, 3, 1); }
    }
    const ty = crouch ? 6 : 6, th = crouch ? 2 : 5;
    // torso
    P(top, 2, ty, 6, th);
    if (o.coat) {
      P(o.shirt || '#fff', 4, ty, 3, th);
      if (o.tie) P(o.tie, 5, ty, 1, Math.max(1, th - 1));
    } else if (o.tie) P(o.tie, 5, ty, 1, Math.max(1, th - 1));
    if (o.lanyard && !crouch) { P(o.lanyard, 5, 6, 1, 3); P('#fff', 4, 9, 3, 2); P(o.lanyard, 5, 10, 1, 1); }
    if (o.vest && !crouch) { P(o.vest, 2, 6, 6, 5); P('#fff7b0', 2, 9, 6, 1); }
    // arm (swing)
    if (!crouch) {
      const sw = o.state === 'walk' ? [0, 1, 0, -1][fr & 3] : o.state === 'jump' ? -1 : 0;
      P(o.sleeve || top, 4 + sw, 7, 2, 3); P(skin, 4 + sw, 10, 2, 1);
    }
    // head
    P(skin, 2, 1, 6, 5);
    P(hair, 2, 0, 6, 2); P(hair, 2, 2, 2, 2);
    P(skin, 8, 4, 1, 1);
    if (o.glasses) P(o.glasses, 5, 3, 3, 1); else P('#1b1b22', 6, 3, 1, 1);
    if (o.hat === 'cap') { P('#ffffff', 2, 0, 6, 2); P('#e03131', 4, 0, 1, 2); P('#e03131', 3, 1, 3, 1); }
    else if (o.hat === 'hard') { P('#ffd23f', 1, 0, 8, 2); }
    else if (o.hat === 'headset') { P('#222', 2, 0, 6, 1); P('#222', 8, 3, 1, 3); }
    // props
    if (!crouch) {
      if (o.prop === 'clipboard') { P('#8a5a2b', 7, 7, 3, 6); P('#ffffff', 8, 8, 1, 4); P('#555', 8, 7, 1, 1); }
      else if (o.prop === 'briefcase') { P('#3a2a1e', 7, 11, 4, 3); P('#c9a227', 8, 11, 2, 1); }
      else if (o.prop === 'phone') { P('#1c1c24', 7, 7, 2, 3); P('#7ad7ff', 7, 7, 1, 1); }
      else if (o.prop === 'envelope') { P('#ffffff', 7, 7, 4, 3); P('#8ccbc6', 7, 7, 4, 1); P('#8ccbc6', 8, 8, 2, 1); }
      else if (o.prop === 'megaphone') { P('#d9d9d9', 7, 6, 3, 2); P('#e03131', 9, 5, 2, 4); }
    }
    ctx.restore();
  }

  // Staffbase logo (official horizontal wordmark, from the Brand Assets folder)
  const logoImg = new Image(); let logoOk = false;
  logoImg.onload = () => { logoOk = true; };
  logoImg.src = 'assets/staffbase-logo.svg';
  const logo = { img: logoImg, ready: () => logoOk && logoImg.naturalWidth > 0 };

  return { logo, text, runs, measure, px, disc, canvas, lerpColor, bubble, sign, person, rr, card, brandBar, arrow, cta, BRAND, state, sentence };
})();

/* ==========================================================================
   UI: HUD and full-screen states. Each takes (ctx, game).
   Staffbase look: white cards, Dark Blue type, SB Blue highlights,
   one orange pill CTA, left-aligned sentence-case headlines.
   ========================================================================== */
const UI = (() => {
  const W = C.VIEW_W, H = C.VIEW_H;
  const T = Gfx.text, rr = Gfx.rr, B = Gfx.BRAND;
  const px = Gfx.px;
  const DB = B.dark, SB = B.blue, OR = B.orange;
  const SOFT = 'rgba(9,13,72,0.68)';     // secondary text (Dark Blue, softened)

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
  }

  /** Light wash over the hospital backdrop so menus read as bright, airy cards. */
  function backdrop(ctx, g, a = 0.7) {
    g.drawMenuBackground(ctx);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(235,248,255,' + Math.min(1, a + 0.1) + ')');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  function darkWash(ctx, a) { ctx.fillStyle = 'rgba(9,13,72,' + a + ')'; ctx.fillRect(0, 0, W, H); }

  /** Small coloured bar + section label above a headline. */
  function eyebrow(ctx, x, y, label, color = B.midBlue) {
    Gfx.brandBar(ctx, x, y, 26, 3);
    T(ctx, label, x, y + 8, { font: 'label', color, spacing: 0.7 });
  }
  function vbar(ctx, x, y, h, color = SB) { rr(ctx, x, y, 2, h, 1, color); }

  // ---- shared bits for the menu screens -----------------------------------
  const BACK = { id: 'back', x: 50, y: 234, w: 92, h: 16 };
  const HOME_ROWS = [
    { id: 'levels', title: 'Choose level', sub: 'Pick your industry', icon: 'levels' },
    { id: 'leaderboard', title: 'Leaderboard', sub: 'Top scores', icon: 'board' },
    { id: 'howto', title: 'How to play', sub: 'Controls', icon: 'help' },
  ];
  const homeRow = i => ({ id: HOME_ROWS[i].id, x: 258, y: 28 + i * 47, w: 160, h: 42 });
  const lvlCard = i => ({ id: 'lvl' + i, x: 50 + (i % 2) * 196, y: 90 + Math.floor(i / 2) * 72, w: 184, h: 62 });
  const NAME_FIELD = { id: 'field', x: 56, y: 124, w: 172, h: 26 };

  /** Hit regions for the mouse, per screen (kept next to the drawing code so they always agree). */
  function regions(g) {
    switch (g.state) {
      case 'title': return [homeRow(0), homeRow(1), homeRow(2), NAME_FIELD];
      case 'levels': return [0, 1, 2, 3].map(lvlCard).concat([BACK]);
      case 'howto': return [BACK];
      case 'leaderboard': return g.ddOpen ? lbOptions().map((o, i) => ddRow(i)).concat([BACK]) : [BACK, Object.assign({ id: 'dd' }, DD)].concat(g.boardPages() > 1 ? [PAGE_PREV, PAGE_NEXT] : []);
      case 'complete': return g.results && g.results.mode === 'attack' ? ROUND_BTNS.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })) : [];
      case 'name': return [{ id: 'confirm', x: 90, y: 176, w: 120, h: 18 }];
      case 'paused': return pauseButtons(g);
      case 'intro': return INTRO_BTNS.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
    }
    return [];
  }

  function backButton(ctx, g, hint) {
    Gfx.cta(ctx, 'Back', BACK.x, BACK.y, BACK.w, BACK.h, false);
    if (hint) T(ctx, hint, 154, BACK.y + 4.4, { size: 6.8, color: SOFT });
  }
  function screenHeader(ctx, label, runsList) {
    eyebrow(ctx, 50, 28, label);
    Gfx.runs(ctx, runsList, 50, 48, { scale: 3, size: 19 });
  }

  /** Small flat icons: monochrome glyph on a round/rounded tile. */
  function glyph(ctx, kind, cx, cy, s, color, bg) {
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const u = s / 24;
    ctx.translate(cx, cy); ctx.scale(u, u);
    switch (kind) {
      case 'levels':
        [[-9, -9], [1, -9], [-9, 1], [1, 1]].forEach(p => { rr(ctx, p[0], p[1], 8, 8, 2, color); });
        break;
      case 'board':
        rr(ctx, -11, -1, 7, 10, 1.5, color); rr(ctx, -3.5, -9, 7, 18, 1.5, color); rr(ctx, 4, 3, 7, 6, 1.5, color);
        break;
      case 'help':
        ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, -3.5, 5.2, Math.PI * 1.1, Math.PI * 2.3); ctx.lineTo(0, 3.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 9, 1.9, 0, Math.PI * 2); ctx.fill();
        break;
      case 'healthcare': { // hospital building with a cross on the tower
        const K = (x, y, w, h) => { ctx.fillStyle = bg || '#fff'; ctx.fillRect(x, y, w, h); };
        rr(ctx, -11.5, 9, 23, 2.4, 1, color);
        rr(ctx, -11, -1, 7, 10.5, 1.2, color); rr(ctx, 4, -1, 7, 10.5, 1.2, color); rr(ctx, -4.8, -10, 9.6, 19.5, 1.5, color);
        K(-0.9, -8.2, 1.8, 5.8); K(-2.9, -6.2, 5.8, 1.8);                    // cross
        K(-2.9, -0.2, 2, 2); K(0.9, -0.2, 2, 2); K(-2.9, 3.4, 2, 2); K(0.9, 3.4, 2, 2); // tower windows
        K(-9.2, 1.4, 2.4, 2.2); K(-9.2, 5.2, 2.4, 2.2); K(6.8, 1.4, 2.4, 2.2); K(6.8, 5.2, 2.4, 2.2); // wing windows
        K(-1.4, 5.8, 2.8, 3.7);                                               // door
        break;
      }
      case 'manufacturing': { // forklift (side view, forks to the right)
        rr(ctx, -11.5, 0.5, 18.5, 8.5, 2, color);                              // body + counterweight
        rr(ctx, -5, -9.5, 1.6, 10.5, 0.6, color); rr(ctx, 1, -9.5, 1.6, 10.5, 0.6, color); rr(ctx, -6, -10.5, 9.5, 1.8, 0.8, color); // overhead guard
        ctx.beginPath(); ctx.arc(-1.2, -3.6, 2.3, 0, Math.PI * 2); ctx.fill(); rr(ctx, -3.4, -1.6, 4.4, 2.2, 0.8, color); // driver
        rr(ctx, 8, -11, 2, 21, 0.8, color);                                    // mast
        rr(ctx, 8.8, 7.6, 5, 1.7, 0.6, color);                                 // fork
        rr(ctx, 10.4, 1.2, 3.4, 6.2, 0.8, color);                              // load
        ctx.fillStyle = bg || '#fff'; ctx.fillRect(10.4, 4, 3.4, 0.9);
        [[-6.6, 10.2, 3.1], [3, 10.2, 2.6]].forEach(w => { ctx.beginPath(); ctx.arc(w[0], w[1], w[2], 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.beginPath(); ctx.arc(w[0], w[1], 1.1, 0, Math.PI * 2); ctx.fillStyle = bg || '#fff'; ctx.fill(); });
        break;
      }
      case 'finance': // ascending bars + coin
        rr(ctx, -11, 3, 5.4, 8, 1.2, color); rr(ctx, -4, -3, 5.4, 14, 1.2, color); rr(ctx, 3, -10, 5.4, 21, 1.2, color);
        break;
      case 'transport': { // plane (top view, nose up-right)
        ctx.rotate(Math.PI / 4); ctx.scale(0.92, 0.92);
        rr(ctx, -2, -12, 4, 23, 2, color);                                  // fuselage
        ctx.beginPath(); ctx.moveTo(-1.6, -3); ctx.lineTo(-12, 5); ctx.lineTo(-12, 8); ctx.lineTo(-1.6, 3.5); ctx.closePath(); ctx.fill();   // left wing
        ctx.beginPath(); ctx.moveTo(1.6, -3); ctx.lineTo(12, 5); ctx.lineTo(12, 8); ctx.lineTo(1.6, 3.5); ctx.closePath(); ctx.fill();       // right wing
        ctx.beginPath(); ctx.moveTo(-1.6, 7.5); ctx.lineTo(-6, 11.5); ctx.lineTo(-6, 13.5); ctx.lineTo(-1.6, 11); ctx.closePath(); ctx.fill(); // left tail
        ctx.beginPath(); ctx.moveTo(1.6, 7.5); ctx.lineTo(6, 11.5); ctx.lineTo(6, 13.5); ctx.lineTo(1.6, 11); ctx.closePath(); ctx.fill();     // right tail
        break;
      }
    }
    ctx.restore();
  }
  const LEVEL_COLOR = { healthcare: SB, manufacturing: OR, finance: B.purple, transport: B.midBlue };
  /** Level tile: coloured when playable, gray when it's a placeholder. */
  function levelTile(ctx, id, x, y, s, locked) {
    rr(ctx, x, y, s, s, s * 0.26, locked ? B.mid : (LEVEL_COLOR[id] || SB));
    glyph(ctx, id, x + s / 2, y + s / 2, s * 0.62, locked ? B.gray : '#ffffff', locked ? B.mid : (LEVEL_COLOR[id] || SB));
  }
  function lock(ctx, x, y, color) {
    rr(ctx, x, y + 4, 9, 7, 1.6, color);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x + 4.5, y + 4, 2.6, Math.PI, 0); ctx.stroke(); ctx.restore();
  }

  // ---- home -----------------------------------------------------------------
  const GROUND_Y = 232, SCENE_V = 120, SCENE_P = 460, RUN_X = 118;
  const OBSTACLES = [{ t: 'crate', x: 110 }, { t: 'badge', x: 262 }, { t: 'crate', x: 372 }];
  // jump arc as a pure function of the distance to the nearest obstacle: no state to get out of sync
  function arcHeight(cx, t, halfW = 0) {
    const off = (t * SCENE_V) % SCENE_P;
    let h = 0;
    for (let k = -1; k < 3; k++) for (const o of OBSTACLES) {
      const ox = o.x + k * SCENE_P - off, dx = ox - cx;
      h = Math.max(h, 26 * Math.max(0, 1 - (dx / 26) * (dx / 26)));
    }
    return h;
  }
  const SKY = [[26, 46], [20, 70], [34, 52], [24, 88], [30, 60], [18, 40], [28, 76], [22, 56]]; // building [w, h]
  function skyline(ctx, t, speed, color, scale, step) {
    let tot = 0; for (const b of SKY) tot += b[0] * scale + step;
    let x = -((t * speed) % tot);
    for (let pass = 0; pass < 3; pass++) for (const b of SKY) {
      const w = b[0] * scale, h = b[1] * scale;
      if (x > -w && x < W) { rr(ctx, x, GROUND_Y - h, w, h + 2, 2, color); }
      x += w + step;
    }
  }
  /** Bright Staffbase sky + parallax skyline (drawn behind the card). */
  function homeSky(ctx, g) {
    const t = g.sceneTime;
    const gr = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#DDF1FD');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    // soft brand shapes
    ctx.beginPath(); ctx.arc(420, 40, 70, 0, Math.PI * 2); ctx.fillStyle = 'rgba(35,180,255,0.10)'; ctx.fill();
    ctx.beginPath(); ctx.arc(40, 150, 56, 0, Math.PI * 2); ctx.fillStyle = 'rgba(205,72,253,0.07)'; ctx.fill();
    // clouds
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 190 - t * (6 + i * 2)) % 760 + 760) % 760 - 140, cy = 22 + (i * 47) % 70;
      rr(ctx, cx, cy, 64, 12, 6, 'rgba(255,255,255,0.9)'); rr(ctx, cx + 12, cy - 7, 30, 12, 6, 'rgba(255,255,255,0.9)');
    }
    skyline(ctx, t, 8, '#CFE9FA', 1.5, 14);
    skyline(ctx, t, 18, '#B7DCF3', 1, 10);
  }
  function coin(ctx, cx, cy, t, seed) {
    const sq = Math.abs(Math.cos(t * 5 + seed));
    ctx.beginPath(); ctx.ellipse(cx, cy, 1 + sq * 3.4, 4, 0, 0, Math.PI * 2); ctx.fillStyle = OR; ctx.fill();
    if (sq > 0.4) { ctx.beginPath(); ctx.ellipse(cx, cy, sq * 1.6, 2.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#FFC24D'; ctx.fill(); }
  }
  function obstacle(ctx, o, x) {
    const y = GROUND_Y;
    if (o.t === 'crate') {
      rr(ctx, x - 8, y - 15, 16, 15, 2.5, '#E46F03'); rr(ctx, x - 6.8, y - 13.8, 13.6, 12.6, 1.8, OR);
      ctx.strokeStyle = '#E46F03'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 6, y - 12.5); ctx.lineTo(x + 6, y - 2.5); ctx.moveTo(x + 6, y - 12.5); ctx.lineTo(x - 6, y - 2.5); ctx.stroke();
    } else { // "unread" notification badge
      ctx.beginPath(); ctx.arc(x, y - 8, 8, 0, Math.PI * 2); ctx.fillStyle = B.pink; ctx.fill();
      rr(ctx, x - 1, y - 14, 2, 8, 1, '#ffffff'); ctx.beginPath(); ctx.arc(x, y - 3, 1.3, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
  }
  function sprite2x(ctx, x, feetY, o) {
    ctx.save(); ctx.translate(Math.round(x - 10), Math.round(feetY - 32)); ctx.scale(2, 2); Gfx.person(ctx, 0, 0, o); ctx.restore();
  }
  /** Scrolling ground, obstacles, coins, the runner and the chasing CEO (drawn over the card). */
  function homeGround(ctx, g) {
    const t = g.sceneTime, off = (t * SCENE_V) % SCENE_P;
    // road
    ctx.fillStyle = DB; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    const tw = 24, tx0 = -((t * SCENE_V) % tw);
    for (let x = tx0; x < W; x += tw) { ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, GROUND_Y + 8, 1, H); }
    ctx.fillStyle = 'rgba(35,180,255,0.35)'; ctx.fillRect(0, GROUND_Y + 14, W, 1);
    for (let x = tx0 - 12; x < W; x += tw * 2) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, GROUND_Y + 26, 14, 2); }
    Gfx.brandBar(ctx, 0, GROUND_Y - 1, W, 3.5);
    // coins + obstacles
    for (let k = -1; k < 3; k++) {
      for (const o of OBSTACLES) {
        const ox = o.x + k * SCENE_P - off;
        if (ox < -20 || ox > W + 20) continue;
        for (const dx of [-17, 0, 17]) {
          const cx = ox + dx; if (cx < RUN_X + 6) continue;
          coin(ctx, cx, GROUND_Y - 22 - 26 * Math.max(0, 1 - (dx / 26) * (dx / 26)), t, cx * 0.05);
        }
        obstacle(ctx, o, ox);
      }
      for (let i = 0; i < 5; i++) { const cx = 190 + i * 13 + k * SCENE_P - off; if (cx > RUN_X + 6 && cx < W + 10) coin(ctx, cx, GROUND_Y - 9, t, i); }
    }
    // runner
    const hh = arcHeight(RUN_X, t);
    for (let i = 1; i <= 4; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 - i * 0.1).toFixed(2) + ')'; ctx.fillRect(RUN_X - 12 - i * 5, GROUND_Y - 3 - ((i + Math.floor(t * 10)) % 3), 3, 2); }
    sprite2x(ctx, RUN_X, GROUND_Y - hh, { face: 1, skin: '#f1c9a0', hair: '#4a3322', coat: OR, sleeve: OR, shirt: '#ffffff', pants: DB, shoes: '#1d1d26', lanyard: SB, prop: 'envelope', state: hh > 1 ? 'jump' : 'walk', frame: Math.floor(t * 10) & 3 });
    // name tag
    const nm = g.playerName, nw = Math.ceil(Gfx.measure(nm, { raw: true, bold: true, size: 6.6 }).w) + 12;
    rr(ctx, RUN_X - nw / 2, GROUND_Y - 52 - hh, nw, 11, 5.5, DB);
    T(ctx, nm, RUN_X, GROUND_Y - 49.8 - hh, { raw: true, bold: true, size: 6.6, color: '#ffffff', align: 'center' });
  }

  function title(ctx, g) {
    homeSky(ctx, g);
    Gfx.card(ctx, 36, 10, 408, 174);
    // heading: Staffbase logo (the wordmark) + "Comms Adventure"
    const lg = Gfx.logo;
    if (lg.ready()) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(lg.img, 56, 40, 118, 118 * 260 / 1202.1); ctx.restore(); }
    else T(ctx, 'Staffbase', 56, 42, { scale: 3, size: 22, color: DB });
    T(ctx, 'Comms', 56, 78, { scale: 3, size: 19, color: DB });
    T(ctx, 'Adventure', 56 + Math.ceil(Gfx.measure('Comms ', { scale: 3, size: 19 }).w), 78, { scale: 3, size: 19, color: SB });

    // name field with edit (pencil) / save (tick) icon
    const ed = g.editing, foc = g.menuIndex === 3, F = NAME_FIELD;
    T(ctx, 'DELIVERING AS', 56, F.y - 11, { font: 'label', color: SOFT, spacing: 0.7 });
    rr(ctx, F.x, F.y, F.w, F.h, 8, ed ? '#ffffff' : B.light, ed || foc ? SB : B.mid, ed || foc ? 1.6 : 1);
    const shown = ed ? g.nameBuffer : g.playerName;
    T(ctx, shown, F.x + 10, F.y + 6.5, { scale: 2, size: 12, raw: true, color: DB });
    if (ed) {
      if (Math.floor(g.menuTime * 2) % 2 === 0 && shown.length < C.NAME_MAX) {
        px(ctx, OR, F.x + 10 + Math.ceil(Gfx.measure(shown, { scale: 2, size: 12, raw: true }).w) + 1.5, F.y + 4.5, 1.4, 14);
      }
      ctx.save(); ctx.strokeStyle = SB; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(209, F.y + 13.5); ctx.lineTo(212.5, F.y + 17); ctx.lineTo(219, F.y + 9); ctx.stroke(); ctx.restore();
    } else {
      ctx.save(); ctx.translate(214, F.y + 13); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = foc ? SB : B.gray; ctx.fillRect(-1.6, -6, 3.2, 8);
      ctx.beginPath(); ctx.moveTo(-1.6, 2.4); ctx.lineTo(1.6, 2.4); ctx.lineTo(0, 5.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = DB; ctx.fillRect(-1.6, -7.6, 3.2, 1.4);
      ctx.restore();
    }
    T(ctx, ed ? 'Enter to save  ·  Esc to cancel' : (foc ? 'Enter to edit' : ''), F.x + F.w, F.y - 11, { size: 6.2, color: SOFT, align: 'right' });

    // menu
    rr(ctx, 248, 20, 180, 154, 10, B.tint);
    HOME_ROWS.forEach((row, i) => {
      const r = homeRow(i), sel = g.menuIndex === i && !ed;
      if (sel) Gfx.card(ctx, r.x, r.y, r.w, r.h, { r: 9, blur: 8, stroke: SB });
      else rr(ctx, r.x, r.y, r.w, r.h, 9, '#ffffff', B.mid, 0.8);
      ctx.beginPath(); ctx.arc(r.x + 22, r.y + r.h / 2, 12, 0, Math.PI * 2); ctx.fillStyle = sel ? OR : DB; ctx.fill();
      glyph(ctx, row.icon, r.x + 22, r.y + r.h / 2, 14, sel ? DB : '#ffffff');
      T(ctx, row.title, r.x + 42, r.y + 9, { scale: 2, size: 11, color: DB });
      T(ctx, row.sub, r.x + 42, r.y + 24, { size: 6.8, color: SOFT });
      Gfx.arrow(ctx, r.x + r.w - 16 + (sel ? Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1) : 0), r.y + r.h / 2, sel ? OR : B.gray, 6);
    });
    homeGround(ctx, g);
    if (g.homeNoteT > 0) {
      const w = Math.ceil(Gfx.measure(g.homeNote, { bold: true }).w) + 20;
      ctx.globalAlpha = Math.min(1, g.homeNoteT * 2);
      rr(ctx, 240 - w / 2, 248, w, 14, 7, '#ffffff'); T(ctx, g.homeNote, 240, 251.6, { bold: true, color: DB, align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  // ---- choose level -----------------------------------------------------------
  function levels(ctx, g) {
    backdrop(ctx, g, 0.74);
    Gfx.card(ctx, 30, 14, 420, 244);
    screenHeader(ctx, 'CHOOSE LEVEL', [['Pick your ', DB], ['industry', SB]]);
    T(ctx, 'Every industry has its own challenges. Select your scene and become the hero that saves the day!', 50, 70, { size: 7.4, color: SOFT });
    C.LEVEL_LIST.forEach((lv, i) => {
      const r = lvlCard(i), sel = g.levelIndex === i, ready = !!LEVELS[lv.id];
      if (sel) Gfx.card(ctx, r.x, r.y, r.w, r.h, { r: 10, blur: 9, stroke: ready ? SB : B.gray });
      else rr(ctx, r.x, r.y, r.w, r.h, 10, ready ? '#ffffff' : B.light, B.mid, 0.9);
      levelTile(ctx, lv.id, r.x + 10, r.y + 11, 40, !ready);
      T(ctx, lv.title, r.x + 60, r.y + (ready ? 25 : 17), { scale: 2, size: 12, color: ready ? DB : '#7a7c9c' });
      if (!ready) T(ctx, 'Coming soon', r.x + 60, r.y + 36, { size: 6.8, raw: true, color: B.gray });
      if (ready) Gfx.arrow(ctx, r.x + r.w - 16 + (sel ? Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1) : 0), r.y + r.h - 12, sel ? OR : B.gray, 6);
      else lock(ctx, r.x + r.w - 17, r.y + r.h - 19, B.gray);
    });
    backButton(ctx, g, 'Arrows to choose, Enter to play');
  }

  // ---- how to play --------------------------------------------------------------
  function howto(ctx, g) {
    backdrop(ctx, g, 0.74);
    Gfx.card(ctx, 30, 14, 420, 244);
    screenHeader(ctx, 'HOW TO PLAY', [['Get the ', DB], ['message', SB], [' there in time', DB]]);
    T(ctx, 'CONTROLS', 170, 72, { font: 'label', color: B.midBlue, spacing: 0.7 });
    const rows = [
      ['Move', 'Left / Right arrows'],
      ['Jump', 'Up or Space. Hold to go higher'],
      ['Crouch', 'Down. Also drops through platforms'],
      ['Pause', 'P or Esc'],
      ['Mute', 'M'],
    ];
    rows.forEach((r, i) => {
      const y = 86 + i * 29;
      vbar(ctx, 170, y, 21, SB);
      T(ctx, r[0], 178, y + 1, { bold: true, color: DB });
      T(ctx, r[1], 178, y + 12, { size: 6.8, color: SOFT });
    });
    backButton(ctx, g);
  }

  // ---- leaderboard --------------------------------------------------------------
  const lbTabs = () => C.LEVEL_LIST.filter(l => LEVELS[l.id]);
  const lbOptions = () => [{ id: 'all', title: 'All levels' }].concat(lbTabs());
  const DD = { x: 318, y: 22, w: 112, h: 14 };
  const PAGE_PREV = { id: 'prev', x: 318, y: 234, w: 26, h: 16 }, PAGE_NEXT = { id: 'next', x: 404, y: 234, w: 26, h: 16 };
  const ddRow = i => ({ id: 'opt:' + lbOptions()[i].id, x: DD.x, y: DD.y + DD.h + 2 + i * 14, w: DD.w, h: 14 });
  function leaderboard(ctx, g) {
    backdrop(ctx, g, 0.74);
    Gfx.card(ctx, 30, 14, 420, 244);
    screenHeader(ctx, 'LEADERBOARD', [['Top ', SB], ['scores', DB]]);
    const opts = lbOptions(), cur = opts.find(o => o.id === g.boardLevel) || opts[0];
    const board = g.boardList();
    const cols = { rank: 54, name: 80, level: 230, result: 424 };
    T(ctx, '#', cols.rank, 74, { font: 'label', color: SOFT });
    T(ctx, 'NAME', cols.name, 74, { font: 'label', color: SOFT });
    T(ctx, 'LEVEL', cols.level, 74, { font: 'label', color: SOFT });
    T(ctx, 'SCORE', cols.result, 74, { font: 'label', color: SOFT, align: 'right' });
    if (!board.length) {
      rr(ctx, 50, 90, 380, 120, 10, B.tint);
      T(ctx, 'No scores yet', 240, 128, { scale: 2, size: 14, color: DB, align: 'center' });
      T(ctx, 'Play a round and your score lands here.', 240, 150, { color: SOFT, align: 'center' });
    } else {
      const pages = g.boardPages(), page = Math.min(g.boardPage || 0, pages - 1), off = page * C.BOARD_PAGE;
      board.slice(off, off + C.BOARD_PAGE).forEach((e, k) => {
        const i = off + k, y = 86 + k * 14, mine = g.lastEntry === e;
        if (k % 2 === 0) rr(ctx, 50, y - 2, 380, 13, 5, B.tint);
        if (mine) vbar(ctx, 50, y - 1, 11, OR);
        T(ctx, String(i + 1), cols.rank, y + 1, { bold: true, color: i < 3 ? B.midBlue : DB });
        T(ctx, e.name, cols.name, y + 1, { raw: true, bold: true, color: DB });
        T(ctx, e.level, cols.level, y + 1, { raw: true, color: SOFT });
        T(ctx, e.score.toLocaleString('en-US'), cols.result, y + 1, { bold: true, color: DB, align: 'right' });
      });
      if (pages > 1) {
        [[PAGE_PREV, page > 0, -1], [PAGE_NEXT, page < pages - 1, 1]].forEach(([r, on, d]) => {
          rr(ctx, r.x, r.y, r.w, r.h, 8, on ? B.light : 'rgba(0,0,0,0.04)', on ? B.mid : null, 0.8);
          Gfx.arrow(ctx, r.x + r.w / 2 - d * 2, r.y + r.h / 2, on ? DB : '#b9c0cc', d * 5);
        });
        T(ctx, 'Page ' + (page + 1) + ' of ' + pages, 374, BACK.y + 4.4, { align: 'center', size: 6.8, bold: true, color: DB });
      }
    }
    backButton(ctx, g);
    // level dropdown (drawn last so its list sits on top of the table)
    rr(ctx, DD.x, DD.y, DD.w, DD.h, 7, g.ddOpen ? DB : B.light, g.ddOpen ? null : B.mid, 0.8);
    T(ctx, cur.title, DD.x + 10, DD.y + 3.6, { font: 'label', size: 5.8, color: g.ddOpen ? '#ffffff' : DB, spacing: 0.4 });
    ctx.fillStyle = g.ddOpen ? '#ffffff' : DB; ctx.beginPath();
    const ax = DD.x + DD.w - 12, ay = DD.y + 6;
    if (g.ddOpen) { ctx.moveTo(ax - 3, ay + 2); ctx.lineTo(ax + 3, ay + 2); ctx.lineTo(ax, ay - 2); } else { ctx.moveTo(ax - 3, ay - 2); ctx.lineTo(ax + 3, ay - 2); ctx.lineTo(ax, ay + 2); }
    ctx.closePath(); ctx.fill();
    if (g.ddOpen) opts.forEach((o, i) => {
      const r = ddRow(i), on = o.id === cur.id;
      rr(ctx, r.x, r.y, r.w, r.h, 6, on ? B.tint : '#ffffff', B.mid, 0.8);
      T(ctx, o.title, r.x + 10, r.y + 3.6, { font: 'label', size: 5.8, color: DB, spacing: 0.4 });
    });
  }

  function nameEntry(ctx, g) {
    backdrop(ctx, g, 0.74);
    Gfx.card(ctx, 70, 56, 340, 156);
    eyebrow(ctx, 90, 74, 'WELCOME');
    T(ctx, 'Who’s delivering this message?', 90, 94, { scale: 2, size: 14, color: DB });
    // input field
    rr(ctx, 90, 118, 300, 26, 7, '#ffffff', SB, 1.6);
    const shown = g.nameBuffer;
    const m = Gfx.measure(shown, { raw: true, font: 'body', size: 11, bold: true });
    T(ctx, shown, 101, 125, { raw: true, font: 'body', size: 11, bold: true, color: DB });
    const blink = Math.floor(g.menuTime * 2) % 2 === 0;
    if (blink && shown.length < C.NAME_MAX) px(ctx, OR, 101 + Math.ceil(m.w) + 1.5, 122, 1.4, 14);
    T(ctx, shown.length + ' / ' + C.NAME_MAX, 382, 127, { align: 'right', size: 6.6, color: SOFT });
    T(ctx, 'Letters, numbers and spaces. Empty = “' + C.DEFAULT_NAME + '”', 90, 153, { color: SOFT, size: 7 });
    Gfx.cta(ctx, 'Confirm', 90, 176, 120, 18, true, Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1));
    T(ctx, 'Press Enter', 222, 181, { size: 7, color: SOFT });
  }

  const INTRO_BTNS = [{ id: 'start', x: 236, y: 222, w: 120, h: 18, label: 'Start' }, { id: 'back', x: 124, y: 222, w: 100, h: 18, label: 'Back' }];
  function intro(ctx, g) {
    backdrop(ctx, g, 0.8);
    const L = g.levelData, cx = W / 2;
    Gfx.card(ctx, 40, 20, 400, 232);
    T(ctx, L.title, cx, 40, { scale: 3, size: 20, color: DB, align: 'center' });
    let y = 84;
    L.intro(g.playerName).forEach((line, i) => {
      if (!line) { y += 10; return; }
      T(ctx, line, cx, y, { size: i === 0 ? 9.5 : 8.5, bold: i === 0, color: DB, raw: true, align: 'center' });
      y += 13;
    });
    if (L.mode !== 'attack') {   // flag levels still show the message that corrupts during the run
      y += 6;
      T(ctx, 'YOUR MESSAGE', cx, y, { font: 'label', color: SOFT, spacing: 0.7, align: 'center' });
      T(ctx, '\u201c' + L.message + '\u201d', cx, y + 11, { scale: 2, size: 12, color: DB, align: 'center' });
    }
    const nudge = Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1), sel = g.introSel || 0;
    INTRO_BTNS.forEach((b, i) => Gfx.cta(ctx, b.label, b.x, b.y, b.w, b.h, i === sel, i === sel ? nudge : 0));
  }

  /** Message with characters corrupting as integrity falls. */
  function corruptMessage(msg, integrity, seed) {
    const t = Math.max(0, (100 - integrity) / 100) * 1.25;
    const set = C.INTEGRITY.CORRUPT_CHARS;
    let out = '';
    for (let i = 0; i < msg.length; i++) {
      const ch = msg[i];
      const r = seed[i % seed.length];
      if (ch !== ' ' && r < t) out += set[Math.floor(r * 997 + i) % set.length];
      else out += ch;
    }
    return out;
  }

  function pill(ctx, x, y, w, h, fill) { rr(ctx, x, y, w, h, h / 2, fill); }

  /** Score-attack HUD: no bar, just a countdown (left) and the score with a gold coin (right), drawn straight onto the game. */
  function hudRound(ctx, g) {
    const tl = Math.max(0, g.timeLeft);
    const secs = Math.ceil(tl), mm = Math.floor(secs / 60), ss = secs % 60;
    const urgent = tl <= 10, pulse = urgent && Math.floor(g.time * 4) % 2 === 0;
    const BAR = 20, cx0 = W / 2, cy0 = 17, ring = urgent ? (pulse ? B.pink : '#D12B42') : SB;
    ctx.fillStyle = DB; ctx.fillRect(0, 0, W, BAR);          // slim navy header: white text contrasts on any wall
    Gfx.brandBar(ctx, 0, BAR, W, 1.5);
    // left: label.  right: label, gold coin and score
    T(ctx, 'TIME REMAINING', cx0 - 26, 7.2, { font: 'label', size: 5.8, color: '#ffffff', spacing: 0.9, align: 'right' });
    T(ctx, 'SCORE', cx0 + 26, 7.2, { font: 'label', size: 5.8, color: '#ffffff', spacing: 0.9 });
    const num = String(g.reached), lw = Gfx.measure('SCORE', { font: 'label', size: 5.8, spacing: 0.9 }).w;
    const cx = cx0 + 26 + lw + 11, cy = 10;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = '#b8860b'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fillStyle = '#f6c945'; ctx.fill();
    px(ctx, '#fff3b0', cx - 2.4, cy - 3, 1.3, 5); px(ctx, '#b8860b', cx - 0.5, cy - 1.4, 2.4, 2.8);
    T(ctx, num, cx + 10, 5.4, { scale: 2, size: 11, color: '#ffffff' });
    // centre: countdown in a circle that hangs just below the bar
    ctx.beginPath(); ctx.arc(cx0, cy0, 17.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx0, cy0, 16, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
    ctx.beginPath(); ctx.arc(cx0, cy0, 13.6, 0, Math.PI * 2); ctx.fillStyle = DB; ctx.fill();
    T(ctx, mm + ':' + (ss < 10 ? '0' : '') + ss, cx0, cy0 - 4.2, { scale: 2, size: 11.5, color: '#ffffff', align: 'center' });
  }
  /** Arrow to the nearest unreached colleague when none is on screen. */
  function npcPointer(ctx, g) {
    const L = g.level, p = L.player; let best = null, bd = 1e9, above = false;
    for (const e of L.enemies) if (e instanceof NPC && e.reachable) {
      const sx = e.x - g.camX, sy = e.y - g.camY;
      if (sx > -8 && sx < L.viewW + 8) {
        if (sy > -8 && sy < L.viewH + 8) return;                 // someone is already in view
        if (sy <= -8) above = true;                                // in this stretch, but on a higher floor
        continue;
      }
      const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; best = e; }
    }
    if (above) {                                                   // nudge the player upstairs
      const x = W / 2 - 26, bl = Math.floor(g.time * 3) % 2;
      rr(ctx, x, 30, 52, 14, 7, bl ? B.blue : '#ffffff');
      ctx.fillStyle = DB; ctx.beginPath(); ctx.moveTo(x + 10, 34); ctx.lineTo(x + 15, 41); ctx.lineTo(x + 5, 41); ctx.closePath(); ctx.fill();
      T(ctx, 'Upstairs', x + 20, 34.4, { size: 6, bold: true, color: DB });
      return;
    }
    if (!best) return;
    const left = best.x < g.camX, x = left ? 4 : W - 4 - 52;
    rr(ctx, x, 128, 52, 14, 7, B.blue);
    Gfx.arrow(ctx, left ? x + 6 : x + 40, 135, DB, left ? -6 : 6);
    T(ctx, Math.round(bd / 16) + ' tiles', left ? x + 15 : x + 6, 132.4, { size: 6, bold: true, color: DB });
  }
  function hud(ctx, g) {
    const p = g.player, L = g.level;
    const atk = g.levelData.mode === 'attack';
    if (!atk) {   // top bar (classic levels only; score-attack draws its HUD straight onto the game)
      ctx.save();
      ctx.shadowColor = 'rgba(9,13,72,0.22)'; ctx.shadowBlur = 6 * Gfx.state.S; ctx.shadowOffsetY = 1.5 * Gfx.state.S;
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(0, 0, W, 26);
      ctx.restore();
      Gfx.brandBar(ctx, 0, 25, W, 1.5);
    }
    if (atk) hudRound(ctx, g);
    else {
      // name + integrity meter
      T(ctx, g.playerName, 7, 3, { raw: true, bold: true, color: DB });
      const ig = Math.max(0, Math.round(g.integrity));
      rr(ctx, 6, 13, 102, 9, 4.5, B.mid);
      const col = ig > 60 ? B.green : ig > 30 ? OR : B.pink;
      if (ig > 0) rr(ctx, 6, 13, Math.max(9, ig * 1.02), 9, 4.5, col);
      if (g.integrityFlash > 0 && Math.floor(g.integrityFlash * 20) % 2 === 0 && ig > 0) rr(ctx, 6, 13, Math.max(9, ig * 1.02), 9, 4.5, 'rgba(255,255,255,0.85)');
      T(ctx, 'Integrity ' + ig + '%', 57, 14.6, { align: 'center', size: 6.4, bold: true, color: DB });

      // message box
      const overlay = g.ceoOverlayTimer > 0;
      rr(ctx, 118, 3, 244, 20, 7, overlay ? (Math.floor(g.time * 8) % 2 ? B.pink : '#D12B42') : DB);
      if (overlay) {
        T(ctx, 'COMPETING MESSAGE', 240, 6, { font: 'label', size: 5.4, color: '#ffffff', align: 'center', spacing: 0.6 });
        T(ctx, g.ceoMessage, 240, 13.2, { align: 'center', bold: true, color: '#ffffff' });
      } else {
        T(ctx, 'YOUR MESSAGE', 240, 6, { font: 'label', size: 5.4, color: SB, align: 'center', spacing: 0.6 });
        T(ctx, corruptMessage(L.data.message, g.integrity, g.corruptSeed), 240, 13.2, { raw: true, align: 'center', bold: true, color: '#ffffff' });
      }

      // right stats
      ctx.beginPath(); ctx.arc(W - 96, 7.6, 3.4, 0, Math.PI * 2); ctx.fillStyle = OR; ctx.fill();
      T(ctx, 'Engagement ' + g.coins, W - 90, 4, { bold: true, color: DB });
      T(ctx, 'Time ' + fmtTime(g.time), W - 6, 14, { align: 'right', bold: true, color: DB });
    }

    // power-up chips + area name
    let cx = 6;
    const chips = [['speed', 'SUBJECT LINE', OR, C.POWERUPS.SPEED.time], ['sponsor', 'EXEC SPONSOR', B.purple, C.POWERUPS.SPONSOR.time],
      ['djump', 'TRANSLATION', SB, C.POWERUPS.DOUBLE_JUMP.time], ['push', 'PUSH NOTIF', B.pink, C.POWERUPS.PUSH.time]];
    const pscale = atk ? C.ATTACK.POWERUP_SCALE : 1;
    for (const [k, label, color, total] of chips) {
      const t = p.power[k];
      if (t > 0) {
        const w = Math.ceil(Gfx.measure(label).w) + 12;
        rr(ctx, cx, 29, w, 12, 6, DB);
        rr(ctx, cx + 4, 37.2, Math.max(2, (w - 8) * Math.min(1, t / (total * pscale))), 2, 1, color);
        T(ctx, label, cx + 6, 31.2, { color: '#ffffff' });
        cx += w + 3;
      }
    }
    if (!L.attack) {
      const an = L.currentArea.name.toUpperCase();
      const aw = Math.ceil(Gfx.measure(an, { font: 'label' }).w) + 12;
      rr(ctx, W - 6 - aw, 29, aw, 12, 6, 'rgba(255,255,255,0.94)');
      T(ctx, an, W - 12, 31.2, { font: 'label', align: 'right', color: DB });
    }

    // toast
    if (g.toastTimer > 0) {
      ctx.globalAlpha = Math.min(1, g.toastTimer * 2);
      const w = Math.ceil(Gfx.measure(g.toast, { bold: true }).w) + 26;
      Gfx.card(ctx, 240 - w / 2, 46, w, 17, { r: 8.5, fill: DB, blur: 8, shadow: 'rgba(9,13,72,0.35)' });
      rr(ctx, 240 - w / 2 + 6, 50.5, 2, 8, 1, g.toastColor && g.toastColor !== '#0f3a40' ? g.toastColor : SB);
      T(ctx, g.toast, 240 - w / 2 + 13, 51.4, { bold: true, color: '#ffffff' });
      ctx.globalAlpha = 1;
    }
    // area banner (left-aligned text inside a card)
    if (g.banner && g.banner.t > 0) {
      const b = g.banner, a = Math.min(1, b.t * 1.5, (2.2 - b.t) * 3 + 0.0001);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      const hw = Gfx.measure(b.text, { scale: 3, size: 17 }).w;
      const sw = b.sub ? Gfx.measure(b.sub, { size: 7.2 }).w : 0;
      const w = Math.ceil(Math.max(hw, sw)) + 34, x = Math.round(240 - w / 2);
      Gfx.card(ctx, x, 78, w, b.sub ? 46 : 34, { r: 11, blur: 12 });
      vbar(ctx, x + 14, 88, b.sub ? 26 : 14, OR);
      T(ctx, b.text, x + 22, 88, { scale: 3, size: 17, color: DB });
      if (b.sub) T(ctx, b.sub, x + 22, 108, { size: 7.2, color: SOFT });
      ctx.globalAlpha = 1;
    }
    if (atk) npcPointer(ctx, g);
    // off-screen chaser warnings (CEO, HR Manager)
    let wy = 128;
    for (const c of [L.ceo, L.hr]) {
      if (!c.active) continue;
      const sx = c.x - g.camX, left = sx < -6, right = sx > L.viewW + 6;
      if (left || right) {
        const bl = Math.floor(g.time * 4) % 2, w = c.hr ? 28 : 36, x = left ? 3 : W - 3 - w;
        rr(ctx, x, wy, w, 14, 7, bl ? B.pink : '#D12B42');
        Gfx.arrow(ctx, left ? x + 11 : x + w - 11, wy + 7, '#ffffff', left ? -6 : 6);
        T(ctx, c.short, left ? x + 16 : x + 7, wy + 3.6, { font: 'label', color: '#ffffff' });
        wy += 17;
      }
    }
  }

  const PAUSE_BTNS = [{ id: 'resume', x: 168, y: 112, w: 144, h: 18, label: 'Resume', hint: 'P / Esc' },
                      { id: 'end', x: 168, y: 134, w: 144, h: 18, label: 'End game' },
                      { id: 'home', x: 168, y: 156, w: 144, h: 18, label: 'Home' }];
  const CONFIRM_BTNS = [{ id: 'yes', x: 168, y: 142, w: 144, h: 18, label: 'Yes, show results' },
                        { id: 'no', x: 168, y: 164, w: 144, h: 18, label: 'No, keep playing' }];
  const pauseButtons = g => (g.pauseConfirm ? CONFIRM_BTNS : PAUSE_BTNS).map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
  function pause(ctx, g) {
    darkWash(ctx, 0.55);
    Gfx.card(ctx, 150, 76, 180, g.pauseConfirm ? 126 : 126);
    T(ctx, g.pauseConfirm ? 'Are you sure?' : 'Paused', 168, 92, { scale: 3, size: 20, color: DB });
    const sel = g.pauseSel || 0, nudge = Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1);
    if (g.pauseConfirm) {
      T(ctx, 'Leaving ends this game.', 168, 120, { size: 7.4, color: SOFT });
      T(ctx, 'Your score will be saved.', 168, 130, { size: 7.4, bold: true, color: DB });
      CONFIRM_BTNS.forEach((b, i) => Gfx.cta(ctx, b.label, b.x, b.y, b.w, b.h, i === (g.confirmSel || 0), i === (g.confirmSel || 0) ? nudge : 0));
    } else {
      PAUSE_BTNS.forEach((b, i) => Gfx.cta(ctx, b.label + (b.hint && i === sel ? '  \u00b7  ' + b.hint : ''), b.x, b.y, b.w, b.h, i === sel, i === sel ? nudge : 0));
      T(ctx, 'M to mute', 312, 182, { align: 'right', size: 6.4, color: SOFT });
    }
  }

  function gameOver(ctx, g) {
    darkWash(ctx, 0.72);
    Gfx.card(ctx, 70, 46, 340, 180);
    rr(ctx, 90, 64, 26, 3, 1.5, B.pink);
    T(ctx, 'MESSAGE LOST', 90, 72, { font: 'label', color: B.pink, spacing: 0.7 });
    T(ctx, 'Message', 90, 86, { scale: 3, size: 20, color: DB });
    T(ctx, 'corrupted', 90 + Math.ceil(Gfx.measure('Message ', { scale: 3, size: 20 }).w), 86, { scale: 3, size: 20, color: B.pink });
    T(ctx, corruptMessage(g.level.data.message, 0, g.corruptSeed), 90, 114, { raw: true, bold: true, size: 9, color: B.pink });
    T(ctx, g.playerName + '’s message was lost in a reply-all.', 90, 132, { raw: true, size: 8, color: DB });
    T(ctx, g.levelData.failLine || 'The nurse received: “See attached.”', 90, 144, { size: 8, color: SOFT });
    vbar(ctx, 90, 162, 12, OR);
    T(ctx, 'Checkpoint: ' + (g.level.checkpointIndex > 0 ? g.levelData.checkpointLabel + ' #' + g.level.checkpointIndex : g.levelData.areas[0].name), 98, 163, { bold: true, color: DB });
    Gfx.cta(ctx, 'Retry  ·  Enter', 90, 184, 140, 18, true, Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1));
    T(ctx, 'P / Esc for home', 244, 189, { size: 7, color: SOFT });
  }

  /** End-of-round report: name, score, coins and leaderboard place, then three buttons. */
  const ROUND_BTNS = [{ id: 'again', x: 52, y: 214, w: 140, h: 18, label: 'Play again' },
                      { id: 'levels', x: 200, y: 214, w: 128, h: 18, label: 'Change level' },
                      { id: 'home', x: 336, y: 214, w: 92, h: 18, label: 'Home' }];
  function completeRound(ctx, g) {
    backdrop(ctx, g, 0.8);
    const r = g.results;
    Gfx.card(ctx, 30, 10, 420, 252);
    eyebrow(ctx, 52, 26, g.levelData.title.toUpperCase());
    const w1 = r.early ? 'Game' : 'Time', w2 = r.early ? 'ended' : 'is up!';
    T(ctx, w1, 52, 46, { scale: 3, size: 20, color: DB });
    T(ctx, w2, 52 + Math.ceil(Gfx.measure(w1 + ' ', { scale: 3, size: 20 }).w), 46, { scale: 3, size: 20, color: SB });
    const rows = [
      ['Name', g.playerName, DB, true],
      ['Score', String(r.reached), SB],
      ['Coins collected', String(r.coins), DB],
      ['Leaderboard position', r.place ? '#' + r.place : 'Unranked', DB],
    ];
    rows.forEach((row, i) => {
      const y = 82 + i * 31;
      T(ctx, row[0], 52, y + 7, { size: 8.5, color: SOFT });
      T(ctx, row[1], 428, y + 3, { scale: 2, size: 14, color: row[2], align: 'right', raw: !!row[3] });
      if (i < rows.length - 1) px(ctx, B.mid, 52, y + 25, 376, 0.6);
    });
    const sel = g.completeSel || 0;
    ROUND_BTNS.forEach((b, i) => Gfx.cta(ctx, b.label + (i === sel ? '  \u00b7  Enter' : ''), b.x, b.y, b.w, b.h, i === sel, i === sel ? Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1) : 0));
  }

  function complete(ctx, g) {
    if (g.results && g.results.mode === 'attack') return completeRound(ctx, g);
    backdrop(ctx, g, 0.8);
    const r = g.results;
    Gfx.card(ctx, 30, 10, 420, 252);
    eyebrow(ctx, 52, 26, g.levelData.title.toUpperCase());
    T(ctx, 'Message', 52, 46, { scale: 3, size: 20, color: DB });
    T(ctx, 'delivered!', 52 + Math.ceil(Gfx.measure('Message ', { scale: 3, size: 20 }).w), 46, { scale: 3, size: 20, color: SB });
    T(ctx, '“' + g.levelData.goalLine + '” — the ' + (g.levelData.goalName || 'nurse'), 52, 73, { size: 8, color: SOFT });
    const rows = [
      ['Delivered by', g.playerName, true],
      ['Time', fmtTime(r.time)],
      ['Engagement', r.coins + ' points'],
      ['Managers stomped', String(r.stomped)],
      ['Restarts', String(r.deaths)],
      ['Final integrity', Math.round(r.integrity) + '%'],
    ];
    rows.forEach((row, i) => {
      const y = 92 + i * 15;
      T(ctx, row[0], 52, y, { color: SOFT });
      T(ctx, row[1], 246, y, { align: 'right', bold: true, raw: !!row[2], color: DB });
      if (i < rows.length - 1) px(ctx, B.mid, 52, y + 11, 194, 0.6);
    });
    // read rate stat spotlight
    rr(ctx, 268, 88, 162, 88, 10, B.tint);
    T(ctx, 'YOUR SCORE', 282, 100, { font: 'label', color: B.midBlue, spacing: 0.7 });
    T(ctx, (r.score || 0).toLocaleString('en-US'), 282, 116, { scale: 3, size: 30, color: SB });
    if (r.rank) T(ctx, 'Rank #' + r.rank + ' on the leaderboard', 282, 156, { size: 7, bold: true, color: DB });
    vbar(ctx, 52, 192, 24, OR);
    T(ctx, r.quip, 60, 192, { bold: true, color: DB });
    T(ctx, r.quip2, 60, 205, { color: SOFT });
    Gfx.cta(ctx, 'Back to home  ·  Enter', 52, 228, 168, 18, true, Math.round(Math.sin(g.menuTime * 6) * 1.2 + 1));
  }

  function redCross(ctx, cx, cy, s, color = '#e03131') {
    px(ctx, color, cx - Math.floor(s / 6), cy - Math.floor(s / 2), Math.max(1, Math.floor(s / 3)), s);
    px(ctx, color, cx - Math.floor(s / 2), cy - Math.floor(s / 6), s, Math.max(1, Math.floor(s / 3)));
  }

  return { title, levels, howto, leaderboard, nameEntry, intro, hud, pause, gameOver, complete, fmtTime, corruptMessage, redCross, regions };
})();
