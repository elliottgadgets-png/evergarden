// growth.js — a procedural tree that grows with the visitor's scroll.
// Deterministic: the same tree grows every visit, but it is ours alone.
export function createGrowth(canvas, section) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  // seeded random
  let seed = 20260908;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // Pre-generate the whole tree as segments with a "birth" order 0..1
  const segs = [];
  const leaves = [];
  function branch(x, y, angle, len, width, depth, birth, span) {
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    segs.push({ x1: x, y1: y, x2, y2, w: width, birth, span });
    if (depth <= 0 || len < 4) {
      leaves.push({ x: x2, y: y2, birth: birth + span, r: 1 + rnd() * 2.5, acid: rnd() > 0.8 });
      return;
    }
    const n = depth > 6 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const spread = 0.32 + rnd() * 0.45;
      const na = angle + (i - (n - 1) / 2) * spread + (rnd() - 0.5) * 0.28;
      const nl = len * (0.68 + rnd() * 0.18);
      branch(x2, y2, na, nl, width * 0.68, depth - 1, birth + span * (0.55 + rnd() * 0.3), span * 0.75);
    }
  }

  function build() {
    segs.length = 0; leaves.length = 0; seed = 20260908;
    const baseLen = Math.min(W, H) * 0.125;
    // grows upward from bottom-center
    branch(W * 0.5, H * 0.965, -Math.PI / 2, baseLen, Math.min(W, H) * 0.013, 9, 0, 0.16);
  }

  function resize() {
    const b = canvas.parentElement.getBoundingClientRect();
    W = b.width; H = b.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }
  resize();
  window.addEventListener('resize', resize);

  let shown = -1;
  function draw(progress, pctEl) {
    if (Math.abs(progress - shown) < 0.0005) return;
    shown = progress;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    // soil line
    ctx.strokeStyle = 'rgba(159,245,200,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.965);
    ctx.bezierCurveTo(W * 0.4, H * 0.96, W * 0.6, H * 0.97, W * 0.8, H * 0.965);
    ctx.stroke();

    for (const s of segs) {
      const local = (progress - s.birth) / s.span;
      if (local <= 0) continue;
      const g = Math.min(1, local);
      const x2 = s.x1 + (s.x2 - s.x1) * g;
      const y2 = s.y1 + (s.y2 - s.y1) * g;
      const alpha = 0.35 + 0.55 * (s.w / (Math.min(W, H) * 0.013));
      ctx.strokeStyle = `rgba(233,242,228,${alpha})`;
      ctx.lineWidth = Math.max(0.6, s.w);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (const l of leaves) {
      const local = (progress - l.birth) / 0.08;
      if (local <= 0) continue;
      const g = Math.min(1, local);
      const rr = l.r * g;
      ctx.fillStyle = l.acid ? `rgba(212,255,106,${0.9 * g})` : `rgba(159,245,200,${0.8 * g})`;
      ctx.beginPath();
      ctx.arc(l.x, l.y, rr, 0, Math.PI * 2);
      ctx.fill();
      // glow halo
      ctx.fillStyle = l.acid ? `rgba(212,255,106,${0.12 * g})` : `rgba(159,245,200,${0.10 * g})`;
      ctx.beginPath();
      ctx.arc(l.x, l.y, rr * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pctEl) pctEl.textContent = Math.round(progress * 100) + '%';
  }
  return { draw };
}
