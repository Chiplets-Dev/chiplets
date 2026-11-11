import { reducedMotion } from './prefs.js';

// Particle effects drawn on one canvas laid over a game card. Created on first use; does nothing
// for people who asked for reduced motion.
const CONFETTI = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f87171', '#facc15'];

export function createFx(host) {
  let cv = null, cx = null, raf = 0, last = 0, W = 0, H = 0;
  let parts = [];

  function ensure() {
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'fx';
      cv.setAttribute('aria-hidden', 'true');
      host.append(cv);
      cx = cv.getContext('2d');
    }
    const w = host.clientWidth, h = host.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
    if (w !== W || h !== H) {
      W = w;
      H = h;
      cv.width = w * d;
      cv.height = h * d;
      cx.setTransform(d, 0, 0, d, 0, 0);
    }
  }

  function add(list) {
    if (reducedMotion()) return;
    ensure();
    parts.push(...list);
    if (parts.length > 500) parts.splice(0, parts.length - 500);
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    cx.clearRect(0, 0, W, H);
    parts = parts.filter((p) => (p.life -= dt) > 0);
    for (const p of parts) {
      p.vy += p.g * dt;
      p.vx *= 1 - p.drag * dt;
      p.vy *= 1 - p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const fade = Math.min(1, p.life / 0.35);
      cx.globalAlpha = fade;
      draw(p, fade);
    }
    cx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
  }

  function draw(p, fade) {
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.rot);
    if (p.shape === 'coin') {
      cx.scale(Math.max(0.15, Math.abs(Math.cos(p.rot * 2.2))), 1); // flipping
      cx.fillStyle = '#fbbf24';
      cx.strokeStyle = '#b45309';
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.arc(0, 0, p.size, 0, 7);
      cx.fill();
      cx.stroke();
      cx.fillStyle = '#fde68a';
      cx.beginPath();
      cx.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.35, 0, 7);
      cx.fill();
    } else if (p.shape === 'rect') {
      cx.fillStyle = p.color;
      cx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else if (p.shape === 'star') {
      const s = p.size * (0.4 + 0.6 * fade);
      cx.fillStyle = p.color;
      cx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.3 : s;
        const a = (i * Math.PI) / 4;
        cx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      cx.fill();
    } else {
      cx.fillStyle = p.color;
      cx.beginPath();
      cx.arc(0, 0, p.size * (0.3 + 0.7 * fade), 0, 7);
      cx.fill();
    }
    cx.restore();
  }

  const P = (o) => ({ vx: 0, vy: 0, g: 0, drag: 0, rot: 0, vr: 0, size: 6, color: '#fff', shape: 'dot', life: 1, ...o });

  return {
    // Gold coins bursting up from a point.
    coins(x, y, n = 24) {
      add(Array.from({ length: n }, () => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 260 + Math.random() * 340;
        return P({ shape: 'coin', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, drag: 0.4, size: 5 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, life: 1.1 + Math.random() * 0.6 });
      }));
    },
    // Confetti falling across the whole card.
    confetti(n = 130) {
      if (reducedMotion()) return;
      ensure();
      add(Array.from({ length: n }, () =>
        P({ shape: 'rect', x: Math.random() * W, y: -10 - Math.random() * H * 0.5, vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 160, g: 260, drag: 0.8, size: 7 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, color: CONFETTI[(Math.random() * CONFETTI.length) | 0], life: 2.2 + Math.random() * 1.2 }),
      ));
    },
    // A small twinkle (safe tile, cash-out).
    sparkle(x, y, color = '#ffffff', n = 10) {
      add(Array.from({ length: n }, () => {
        const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
        return P({ shape: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, size: 3 + Math.random() * 4, vr: (Math.random() - 0.5) * 8, color, life: 0.45 + Math.random() * 0.35 });
      }));
    },
    // An explosion (mine, crash).
    burst(x, y, colors = ['#fb7185', '#f97316', '#fbbf24'], n = 34) {
      add(Array.from({ length: n }, () => {
        const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 380;
        return P({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 300, drag: 2.2, size: 2.5 + Math.random() * 4, color: colors[(Math.random() * colors.length) | 0], life: 0.5 + Math.random() * 0.5 });
      }));
    },
    shake() {
      if (reducedMotion()) return;
      host.classList.remove('shake');
      void host.offsetWidth;
      host.classList.add('shake');
      setTimeout(() => host.classList.remove('shake'), 520);
    },
    get count() {
      return parts.length;
    },
  };
}
