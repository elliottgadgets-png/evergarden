// trail.js — spore trail: the visitor's pointer seeds drifting spores.
export function createTrail(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const spores = [];
  const MAX = 220;
  let last = { x: -1, y: -1 };

  function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('pointermove', e => {
    if (last.x < 0) { last = { x: e.clientX, y: e.clientY }; return; }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.min(6, Math.floor(dist / 14));
    for (let i = 0; i < steps; i++) {
      if (spores.length >= MAX) spores.shift();
      const t = i / steps;
      spores.push({
        x: last.x + dx * t + (Math.random() - 0.5) * 6,
        y: last.y + dy * t + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.12 - Math.random() * 0.35,
        life: 1,
        decay: 0.006 + Math.random() * 0.008,
        r: 0.8 + Math.random() * 2.2,
        acid: Math.random() > 0.85,
        wob: Math.random() * Math.PI * 2
      });
    }
    last = { x: e.clientX, y: e.clientY };
  });

  let t = 0;
  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    for (let i = spores.length - 1; i >= 0; i--) {
      const s = spores[i];
      s.life -= s.decay;
      if (s.life <= 0) { spores.splice(i, 1); continue; }
      s.wob += 0.03;
      s.x += s.vx + Math.sin(s.wob) * 0.3;
      s.y += s.vy;
      const a = s.life * s.life;
      const base = s.acid ? '212,255,106' : '159,245,200';
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      g.addColorStop(0, `rgba(${base},${0.55 * a})`);
      g.addColorStop(1, `rgba(${base},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${base},${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * s.life * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return { frame };
}
