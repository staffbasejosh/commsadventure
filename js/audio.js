'use strict';
/* audio.js - Web Audio SFX, all generated in code (no audio files). */
const Sound = (() => {
  let ctx = null, master = null, muted = false, noiseBuf = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.35;
      master.connect(ctx.destination);
      const len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // one oscillator note with optional pitch slide
  function tone(f0, f1, dur, type = 'square', vol = 0.3, delay = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, delay = 0, lowpass = 3000) {
    if (!ensure()) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }
  function seq(notes, type = 'square', vol = 0.25, step = 0.09) {
    notes.forEach((n, i) => { if (n) tone(n, n, step * 1.2, type, vol, i * step); });
  }

  const sfx = {
    jump:    () => tone(300, 640, 0.14, 'square', 0.18),
    djump:   () => { tone(450, 900, 0.12, 'triangle', 0.25); tone(600, 1200, 0.1, 'sine', 0.15, 0.05); },
    coin:    () => { tone(988, 988, 0.06, 'square', 0.15); tone(1319, 1319, 0.2, 'square', 0.15, 0.06); },
    stomp:   () => { tone(220, 70, 0.14, 'square', 0.3); noise(0.08, 0.25); },
    approve: () => { tone(160, 60, 0.12, 'square', 0.35); noise(0.1, 0.3, 0, 1200); tone(784, 784, 0.1, 'triangle', 0.2, 0.1); },
    hurt:    () => { tone(420, 90, 0.35, 'sawtooth', 0.3); noise(0.12, 0.2); },
    powerup: () => seq([523, 659, 784, 1047, 1319], 'square', 0.2, 0.07),
    bump:    () => tone(130, 90, 0.08, 'square', 0.3),
    brick:   () => { noise(0.25, 0.4, 0, 2500); tone(180, 60, 0.15, 'square', 0.2); },
    checkpoint: () => seq([659, 880, 1175], 'triangle', 0.3, 0.1),
    switch:  () => { tone(1200, 800, 0.05, 'square', 0.2); tone(300, 200, 0.2, 'sawtooth', 0.2, 0.06); },
    slam:    () => { noise(0.3, 0.6, 0, 600); tone(90, 40, 0.3, 'square', 0.4); },
    beep:    () => { tone(2400, 2400, 0.07, 'sine', 0.25); tone(2400, 2400, 0.07, 'sine', 0.25, 0.12); },
    fall:    () => tone(500, 60, 0.6, 'triangle', 0.3),
    ding:    () => { tone(1568, 1568, 0.5, 'sine', 0.3); tone(2093, 2093, 0.5, 'sine', 0.2, 0.01); },
    // "CEO approaching" - an ominous corporate stinger: da-da-da DUUUN
    ceo:     () => { seq([196, 196, 196], 'sawtooth', 0.22, 0.14); tone(156, 130, 0.7, 'sawtooth', 0.28, 0.45); tone(78, 65, 0.7, 'square', 0.15, 0.45); },
    win:     () => { seq([523, 523, 523, 659, 784, 659, 784, 1047], 'square', 0.22, 0.11); tone(1047, 1047, 0.6, 'triangle', 0.25, 0.95); },
    lose:    () => seq([392, 370, 349, 330, 262], 'sawtooth', 0.22, 0.16),
    menu:    () => tone(700, 900, 0.06, 'square', 0.15),
    confirm: () => { tone(660, 660, 0.06, 'square', 0.18); tone(990, 990, 0.1, 'square', 0.18, 0.06); },
    pause:   () => tone(500, 350, 0.1, 'triangle', 0.25),
    stamp:   () => { noise(0.07, 0.4, 0, 800); tone(110, 80, 0.1, 'square', 0.3); },
  };

  return {
    play(name) { const f = sfx[name]; if (f && !muted) { try { f(); } catch (e) { /* audio is optional */ } } },
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.35; return muted; },
    isMuted: () => muted,
  };
})();
