/* dev/bot.js - OPTIONAL developer test autopilot (not loaded by index.html).
   Paste into the browser console (or fetch+eval) after the game has loaded:
     runBot({god:true})            // can't die; checks the level is completable
     runBot({god:false})           // takes damage like a (dumb) player
   It drives the REAL game logic with the same abstract actions a keyboard would,
   stepping the fixed-timestep simulation as fast as possible. */
window.runBot = (opts = {}) => {
  const maxSteps = opts.max || 60 * 300;
  Game.startRun(); Game.setState('playing'); Game.level.lastAreaKey = null;
  const L0 = Game.level, falls = [];
  const origFell = L0.playerFell.bind(L0);
  L0.playerFell = function () { falls.push(Math.floor(this.player.x / 16)); origFell(); };
  const F = Input._force, log = [], hits = [];
  let jumpHold = 0, stuck = 0, lastX = 0, steps = 0, maxX = 0, lastLog = 0, lastInt = 100, ceoCatchSteps = 0, ceoSeen = false;
  for (steps = 0; steps < maxSteps && Game.state !== 'complete'; steps++) {
    if (Game.state === 'gameover') { log.push('GAMEOVER at col ' + Math.floor(Game.player.x / 16) + ' t=' + (steps / 60).toFixed(1)); if (opts.stopOnDeath) break; Game.retry(); continue; }
    if (Game.state !== 'playing') { Game.step(); continue; }
    const L = Game.level, p = L.player;
    if (opts.god) Game.integrity = 100;
    F.moveRight = true; F.moveLeft = false;
    const wall = L.solidPx(p.x + p.w + 3, p.y + p.h - 4) || L.solidPx(p.x + p.w + 3, p.y + 4);
    const pit = p.onGround && !L.groundPx(p.x + p.w + 6, p.y + p.h + 4);
    let en = false;
    for (const e of L.enemies) { const dx = e.x - (p.x + p.w); if (dx > -4 && dx < 30 && Math.abs((e.y + e.h) - (p.y + p.h)) < 24) en = true; }
    if (p.onGround && (wall || pit || en) && jumpHold <= 0) jumpHold = 28;
    F.jump = jumpHold > 0; if (jumpHold > 0) jumpHold--;
    if (Math.abs(p.x - lastX) < 0.2) stuck++; else stuck = 0;
    lastX = p.x;
    if (stuck > 20 && p.onGround) { jumpHold = 30; stuck = 0; }
    Game.step();
    if (L.ceo.active) { ceoSeen = true; if (Math.abs(L.ceo.x - p.x) < 20) ceoCatchSteps++; }
    if (Game.integrity < lastInt - 0.5 && !L.ceo.active) hits.push(Math.floor(p.x / 16));
    lastInt = Game.integrity;
    maxX = Math.max(maxX, p.x);
    if (steps - lastLog >= 600) { lastLog = steps; log.push('t=' + (steps / 60).toFixed(0) + ' col=' + Math.floor(p.x / 16) + ' ceo=' + (L.ceo.active ? Math.floor(L.ceo.x / 16) : '-') + ' int=' + Math.round(Game.integrity)); }
  }
  F.moveRight = F.jump = false;
  return { state: Game.state, secs: (steps / 60).toFixed(1), maxCol: Math.floor(maxX / 16), falls, hitsBeforeCeo: hits.slice(0, 30), ceoCatchSecs: (ceoCatchSteps / 60).toFixed(1), log, coins: Game.coins, stomped: Game.stomped, deaths: Game.deaths, integrity: Math.round(Game.integrity), results: Game.results };
};
