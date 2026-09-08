// field.js — living particle field, reacts to the visitor's pointer.
function makeNoise() {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  let seed = 1337;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = t => t * t * (3 - 2 * t);
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  return function noise2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return (
      (1 - v) * ((1 - u) * grad(aa, x, y) + u * grad(ba, x - 1, y)) +
      v * ((1 - u) * grad(ab, x, y - 1) + u * grad(bb, x - 1, y - 1))
    );
  };
}

export function createField(canvas, section) {
  const ctx = canvas.getContext('2d');
  const noise = makeNoise();
  let W = 0, H = 0, running = false, raf = null;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const N = 320;
  const pts = [];
  for (let i = 0; i < N; i++) {
    pts.push({
      x: Math.random(), y: Math.random(),
      vx: 0, vy: 0,
      r: 1.0 + Math.random() * 2.4,
      hue: Math.random()
    });
  }

  const pointer = { x: -9999, y: -9999, active: false };
  section.addEventListener('pointermove', e => {
    const b = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - b.left) / b.width;
    pointer.y = (e.clientY - b.top) / b.height;
    pointer.active = true;
  });
  section.addEventListener('pointerleave', () => { pointer.active = false; });

  function resize() {
    const b = section.getBoundingClientRect();
    W = b.width; H = b.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  function step() {
    if (!running) return;
    t += 0.0035;
    ctx.clearRect(0, 0, W, H);

    for (const pt of pts) {
      const a = noise(pt.x * 2.4 + t, pt.y * 2.4 - t) * Math.PI * 2.4;
      pt.vx += Math.cos(a) * 0.00006;
      pt.vy += Math.sin(a) * 0.00006;

      if (pointer.active) {
        const dx = pt.x - pointer.x, dy = pt.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.03) {
          const f = 0.00035 / (d2 + 0.004);
          pt.vx += dx * f; pt.vy += dy * f;
        }
      }
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.x += pt.vx; pt.y += pt.vy;
      if (pt.x < -0.02) pt.x = 1.02; if (pt.x > 1.02) pt.x = -0.02;
      if (pt.y < -0.02) pt.y = 1.02; if (pt.y > 1.02) pt.y = -0.02;
    }

    // connective tissue
    ctx.lineWidth = 0.5;
    for (let i = 0; i < N; i++) {
      const a = pts[i];
      for (let j = i + 1; j < i + 7; j++) {
        const b = pts[j % N];
        const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H;
        const d2 = dx * dx + dy * dy;
        if (d2 < 110 * 110) {
          const o = (1 - Math.sqrt(d2) / 110) * 0.4;
          ctx.strokeStyle = `rgba(159,245,200,${o})`;
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
          ctx.stroke();
        }
      }
    }
    // spores
    for (const pt of pts) {
      const glow = ctx.createRadialGradient(pt.x * W, pt.y * H, 0, pt.x * W, pt.y * H, pt.r * 5);
      const base = pt.hue > 0.86 ? '212,255,106' : '159,245,200';
      glow.addColorStop(0, `rgba(${base},0.9)`);
      glow.addColorStop(1, `rgba(${base},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pt.x * W, pt.y * H, pt.r * 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${base},0.95)`;
      ctx.beginPath();
      ctx.arc(pt.x * W, pt.y * H, pt.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(step);
  }

  return {
    start() { if (!running) { running = true; step(); } },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); }
  };
}
