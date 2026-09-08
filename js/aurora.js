// aurora.js — living backgrounds. Each world breathes: three huge,
// soft lights drift on slow orbits, tinted by the chapter's mood.
// Rendered tiny and upscaled — the upscale IS the blur.

export function createAurora(canvas, mood) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  const RES = 0.09; // render at 9% resolution
  function size() {
    W = Math.max(2, Math.round(innerWidth * RES));
    H = Math.max(2, Math.round(innerHeight * RES));
    canvas.width = W; canvas.height = H;
  }
  size();
  window.addEventListener('resize', size);

  const orbs = [
    { r: 0.55, sp: 0.11, ph: 0.0, col: 'accent', a: 0.16 },
    { r: 0.42, sp: -0.07, ph: 2.1, col: 'accent', a: 0.11 },
    { r: 0.65, sp: 0.05, ph: 4.2, col: 'bg-glow', a: 0.20 },
  ];

  function frame(t) {
    const tt = t * 0.001;
    ctx.clearRect(0, 0, W, H);
    for (const o of orbs) {
      const x = W * (0.5 + 0.38 * Math.sin(tt * o.sp + o.ph));
      const y = H * (0.45 + 0.34 * Math.cos(tt * o.sp * 1.3 + o.ph * 1.7));
      const rad = Math.max(W, H) * o.r;
      // light worlds: brightening orbs vanish on bone, so drift tinted shade instead
      const lum = mood.bg ? 0.2126*mood.bg[0] + 0.7152*mood.bg[1] + 0.0722*mood.bg[2] : 0;
      const light = lum > 140;
      let c, a = o.a;
      if (light) {
        if (o.col === 'accent') { c = mood.accent.map(v => Math.round(v * 0.62)); a = o.a * 1.7; }
        else { c = (mood.ink || [24,23,28]).map(v => Math.min(255, v + 70)); a = 0.09; }
      } else if (o.col === 'accent') c = mood.accent;
      else c = mood.bg.map(v => Math.min(255, v * 3 + 18));
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  return { frame };
}
