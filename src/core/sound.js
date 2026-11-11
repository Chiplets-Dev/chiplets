import { cfg } from './config.js';
import { prefs, reducedMotion } from './prefs.js';
import { bus } from './wallet.js';

// Every sound is synthesized with WebAudio, so there are no audio files to download.
// Nothing plays until the visitor's first tap or key press on a game (browser autoplay rules).
let ctx = null;
let out = null;
let noiseBuf = null;
let lastTick = 0;
let voices = 0;
const wantMuted = new Set(); // games with sound="muted" on the page

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch (e) {
    return null;
  }
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 4;
  out = ctx.createGain();
  out.gain.value = 0.55;
  out.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  if (!ensure.watching) {
    ensure.watching = true; // coming back to the tab: try to wake the sound (the next tap does it for sure)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && !sound.muted && wake(ctx));
  }
  return ctx;
}

// Safari (iPhone/iPad especially) leaves the context 'interrupted' after an app switch, a call or a locked screen —
// not 'suspended' — and it can close it outright. Resume from anything but 'running'; replace a closed one.
function wake(c) {
  if (c && c.state !== 'running' && c.state !== 'closed') c.resume().catch(() => {});
}

const ready = () => ctx && ctx.state === 'running';
const done = () => voices--;

function tone({ type = 'sine', f, f2, t = 0, dur = 0.12, vol = 0.2, a = 0.004 }) {
  const t0 = ctx.currentTime + t;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  voices++;
  o.onended = done;
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function noise({ t = 0, dur = 0.1, vol = 0.2, type = 'bandpass', f = 3000, f2, q = 1 }) {
  const t0 = ctx.currentTime + t;
  const s = ctx.createBufferSource();
  const fl = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = noiseBuf;
  fl.type = type;
  fl.frequency.setValueAtTime(f, t0);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g).connect(out);
  voices++;
  s.onended = done;
  s.start(t0);
  s.stop(t0 + dur + 0.03);
}

const note = (semi) => 440 * 2 ** ((semi - 9) / 12); // semitones from C4

const RECIPES = {
  // a reel symbol flicking past
  tick() {
    noise({ dur: 0.025, vol: 0.09, f: 4200, q: 4 });
  },
  // a reel thudding to a stop
  reel() {
    tone({ f: 190, f2: 70, dur: 0.14, vol: 0.32 });
    noise({ dur: 0.05, vol: 0.12, type: 'lowpass', f: 1400 });
  },
  // suspense on the last reel
  riser({ dur = 1.2 } = {}) {
    tone({ f: 220, f2: 880, dur, vol: 0.06, a: 0.08 });
    tone({ f: 224, f2: 896, dur, vol: 0.05, a: 0.08, type: 'triangle' });
  },
  // a plinko ball touching a peg; `row` sets the pitch
  peg({ row = 0 } = {}) {
    tone({ type: 'triangle', f: 1500 - row * 38 + Math.random() * 40, dur: 0.06, vol: 0.07 });
  },
  // a plinko ball dropping into a bucket
  land({ mult = 1 } = {}) {
    if (mult >= 1) tone({ type: 'triangle', f: 660 * (1 + Math.min(3, Math.log2(mult)) / 3), dur: 0.22, vol: 0.12 });
    else tone({ f: 210, f2: 130, dur: 0.16, vol: 0.12 });
  },
  // a safe tile in mines; each one is a semitone higher
  gem({ k = 1 } = {}) {
    const f = note(12 + Math.min(k, 24) - 1) * 2;
    tone({ f, dur: 0.38, vol: 0.13 });
    tone({ f: f * 2.76, dur: 0.18, vol: 0.04 });
  },
  boom() {
    noise({ dur: 0.75, vol: 0.5, type: 'lowpass', f: 1800, f2: 60 });
    tone({ f: 95, f2: 32, dur: 0.55, vol: 0.5 });
  },
  cash() {
    tone({ type: 'square', f: 1568, dur: 0.06, vol: 0.05 });
    tone({ type: 'square', f: 2093, t: 0.06, dur: 0.2, vol: 0.05 });
    noise({ t: 0.02, dur: 0.28, vol: 0.05, type: 'highpass', f: 5000 });
  },
  win() {
    [19, 23, 26].forEach((s, i) => tone({ type: 'triangle', f: note(s), t: i * 0.07, dur: 0.16, vol: 0.13 }));
  },
  bigwin() {
    [12, 16, 19, 24, 28, 31].forEach((s, i) => tone({ type: 'triangle', f: note(s), t: i * 0.07, dur: 0.2, vol: 0.13 }));
    [24, 28, 31].forEach((s) => tone({ f: note(s), t: 0.42, dur: 0.9, vol: 0.06, a: 0.02 }));
    noise({ t: 0.42, dur: 0.7, vol: 0.035, type: 'highpass', f: 6500 });
  },
  jackpot() {
    for (let r = 0; r < 3; r++) [12, 16, 19, 24].forEach((s, i) => tone({ type: 'triangle', f: note(s + r * 5), t: r * 0.32 + i * 0.07, dur: 0.22, vol: 0.12 }));
    [24, 28, 31, 36].forEach((s) => tone({ f: note(s + 10), t: 1.0, dur: 1.4, vol: 0.06, a: 0.03 }));
    noise({ t: 1.0, dur: 1.2, vol: 0.04, type: 'highpass', f: 7000 });
  },
};

export const sound = {
  // Until the visitor chooses, games start muted if the page asked for it: data-sound="off" on the script, or a
  // game with sound="muted". There's one switch for every game on the page, so it's all of them or none.
  get muted() {
    return !!prefs.get('muted', cfg.sound === 'off' || wantMuted.size > 0);
  },
  wantsMuted(el, on) {
    const before = wantMuted.size > 0;
    on ? wantMuted.add(el) : wantMuted.delete(el);
    if (before !== wantMuted.size > 0) bus.dispatchEvent(new CustomEvent('prefs', { detail: { k: 'muted' } })); // repaint the speakers
  },
  set muted(v) {
    prefs.set('muted', !!v);
  },
  toggle() {
    this.muted = !this.muted;
    if (!this.muted) this.unlock();
    return !this.muted;
  },
  // Call from inside a tap/key handler.
  unlock() {
    if (this.muted) return;
    if (ctx && ctx.state === 'closed') ctx = null; // a closed context never comes back: start a new one
    wake(ensure());
  },
  get state() {
    return ctx ? ctx.state : 'none';
  },
  play(name, opts) {
    if (this.muted || !ready() || !RECIPES[name] || voices > 40) return;
    if (name === 'tick' || name === 'peg') {
      if (ctx.currentTime - lastTick < 0.016) return;
      lastTick = ctx.currentTime;
    }
    try {
      RECIPES[name](opts);
    } catch (e) {}
  },
  // A continuous tone that follows a value (the crash multiplier).
  hum() {
    let o = null, g = null;
    return {
      start() {
        if (sound.muted || !ready() || o) return;
        o = ctx.createOscillator();
        g = ctx.createGain();
        const fl = ctx.createBiquadFilter();
        o.type = 'triangle';
        o.frequency.value = 110;
        fl.type = 'lowpass';
        fl.frequency.value = 900;
        g.gain.value = 0.0001;
        o.connect(fl).connect(g).connect(out);
        o.start();
        g.gain.setTargetAtTime(0.03, ctx.currentTime, 0.08);
      },
      set(m) {
        if (o) o.frequency.setTargetAtTime(110 * (1 + Math.log2(Math.max(1, m)) * 0.45), ctx.currentTime, 0.05);
      },
      stop() {
        if (!o) return;
        g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
        o.stop(ctx.currentTime + 0.25);
        o = g = null;
      },
    };
  },
};

// Phone vibration. Follows the sound switch, and stays off for people who asked for reduced motion.
export function haptic(pattern) {
  if (sound.muted || reducedMotion()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch (e) {}
}
