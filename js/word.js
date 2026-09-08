// word.js — נצח: living Hebrew letters. Every glyph is a swarm.
// Words are sampled from real type, then ~6000 hand-driven particles
// assemble, morph between words on scroll, feel the visitor's pointer,
// and finally scatter like embers. No libraries.

const CHAPTERS = [
  { word: 'נצח',   pointer: 1.0, glow: 1.0, lift: 0.0,  spread: 0 },
  { word: 'תנועה', pointer: 1.3, glow: 1.0, lift: 0.0,  spread: 0 },
  { word: 'מגע',   pointer: 3.2, glow: 1.1, lift: 0.0,  spread: 0 },
  { word: 'אור',   pointer: 1.0, glow: 1.9, lift: -0.4, spread: 0 },
  { word: null,    pointer: 1.2, glow: 0.75, lift: -1.1, spread: 1 }, // embers
];

const COUNT = 6000;

function sampleWord(word, boxW, boxH) {
  const fs = 240;
  const c = document.createElement('canvas');
  const x = c.getContext('2d', { willReadFrequently: true });
  x.font = `900 ${fs}px "Frank Ruhl Libre", serif`;
  const w = Math.ceil(x.measureText(word).width);
  c.width = w + 80;
  c.height = Math.ceil(fs * 1.5);
  x.font = `900 ${fs}px "Frank Ruhl Libre", serif`;
  x.fillStyle = '#fff';
  x.textBaseline = 'middle';
  x.fillText(word, 40, c.height * 0.52);
  const img = x.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let py = 0; py < c.height; py += 2) {
    for (let px = 0; px < c.width; px += 2) {
      if (img[(py * c.width + px) * 4 + 3] > 120) pts.push(px, py);
    }
  }
  const n = pts.length / 2;
  // normalize into box, preserving aspect
  const scale = Math.min(boxW / c.width, boxH / c.height);
  const out = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const j = n ? (Math.floor((i / COUNT) * n + Math.random() * 0.999)) % n : 0;
    const jx = pts[j * 2] - c.width / 2, jy = pts[j * 2 + 1] - c.height / 2;
    out[i * 2] = jx * scale;
    out[i * 2 + 1] = jy * scale;
  }
  return out;
}

function scatterPoints(W, H) {
  const out = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    out[i * 2] = (Math.random() - 0.5) * W * 1.1;
    out[i * 2 + 1] = (Math.random() - 0.5) * H * 1.2;
  }
  return out;
}

export function createWordSystem(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  let chapters = [];

  const px = new Float32Array(COUNT), py = new Float32Array(COUNT);
  const vx = new Float32Array(COUNT), vy = new Float32Array(COUNT);
  const stag = new Float32Array(COUNT);
  const wob = new Float32Array(COUNT);
  const accent = new Uint8Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    stag[i] = Math.random();
    wob[i] = Math.random() * Math.PI * 2;
    accent[i] = Math.random() < 0.12 ? 1 : 0;
  }

  function buildAll() {
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const boxW = Math.min(W * 0.74, 1050);
    const boxH = H * 0.44;
    chapters = CHAPTERS.map(ch => ({
      ...ch,
      pts: ch.word ? sampleWord(ch.word, boxW, boxH) : scatterPoints(W, H)
    }));
  }

  const ready = document.fonts.ready.then(() => buildAll());

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(buildAll, 200);
  });

  const pointer = { x: -9999, y: -9999 };
  const bursts = []; // {x, y, t0}
  let held = false;

  window.addEventListener('pointerdown', e => {
    held = true;
    bursts.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
    if (bursts.length > 4) bursts.shift();
  });
  window.addEventListener('pointerup', () => { held = false; });
  window.addEventListener('pointercancel', () => { held = false; });
  window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; });
  window.addEventListener('pointerleave', () => { pointer.x = -9999; pointer.y = -9999; });

  let seeded = false;
  const smooth = t => t * t * (3 - 2 * t);

  function frame(t, progress01) {
    if (!chapters.length) return;
    if (!seeded) {
      for (let i = 0; i < COUNT; i++) {
        px[i] = W / 2 + (Math.random() - 0.5) * W * 0.7;
        py[i] = H / 2 + (Math.random() - 0.5) * H * 0.8;
      }
      seeded = true;
    }

    const N = chapters.length;
    const cf = Math.min(N - 1, Math.max(0, progress01)) * (N - 1);
    const ci = Math.min(N - 2, Math.floor(cf));
    const f = cf - ci;
    const A = chapters[ci], B = chapters[ci + 1];

    // interpolate chapter behavior
    const pStr = A.pointer + (B.pointer - A.pointer) * f;
    const glow = A.glow + (B.glow - A.glow) * f;
    const lift = A.lift + (B.lift - A.lift) * f;

    const cx = W / 2, cy = H * 0.40;
    const R = 150 * Math.min(1.6, Math.max(0.7, pStr));
    const R2 = R * R;
    const k = 0.021, damp = 0.85;
    const mIn = pointer.x > -999;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const tt = t * 0.001;

    // single pass: physics + halo
    for (let i = 0; i < COUNT; i++) {
      // staggered morph between chapters
      const fi = smooth(Math.min(1, Math.max(0, f * 1.7 - stag[i] * 0.7)));
      const tx = cx + A.pts[i * 2] + (B.pts[i * 2] - A.pts[i * 2]) * fi;
      const ty = cy + A.pts[i * 2 + 1] + (B.pts[i * 2 + 1] - A.pts[i * 2 + 1]) * fi
               + Math.sin(tt * 1.3 + wob[i]) * 0.55;

      vx[i] += (tx - px[i]) * k;
      vy[i] += (ty - py[i]) * k;

      if (mIn) {
        const dx = px[i] - pointer.x, dy = py[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (held) {
          // gravity well: holding the pointer pulls the letters toward you
          const d = Math.sqrt(d2) || 1;
          const pull = -Math.min(1.35, 9000 / (d2 + 900)) * pStr;
          vx[i] += (dx / d) * pull - (dy / d) * pull * 0.5;
          vy[i] += (dy / d) * pull + (dx / d) * pull * 0.5;
        } else if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / R) * 2.6 * pStr;
          vx[i] += (dx / d) * force - (dy / d) * force * 0.45;
          vy[i] += (dy / d) * force + (dx / d) * force * 0.45;
        }
      }
      // click bursts: shockwave that scatters the letters
      for (let b = 0; b < bursts.length; b++) {
        const age = (t - bursts[b].t0) / 1000;
        if (age > 1.1) { bursts.splice(b--, 1); continue; }
        const wave = 1 - age / 1.1;
        const bdx = px[i] - bursts[b].x, bdy = py[i] - bursts[b].y;
        const bd2 = bdx * bdx + bdy * bdy;
        if (bd2 < 320 * 320 && bd2 > 0.01) {
          const bd = Math.sqrt(bd2);
          const bf = (1 - bd / 320) * 9 * wave * wave;
          vx[i] += (bdx / bd) * bf;
          vy[i] += (bdy / bd) * bf;
        }
      }

      vy[i] += lift * 0.03 * (0.5 + stag[i]);

      vx[i] *= damp; vy[i] *= damp;
      px[i] += vx[i]; py[i] += vy[i];
    }

    // halo pass (sparse, cheap glow)
    ctx.fillStyle = `rgba(236,233,226,${0.05 * glow})`;
    for (let i = 0; i < COUNT; i += 3) ctx.fillRect(px[i] - 3, py[i] - 3, 6, 6);

    // core pass, two tints
    ctx.fillStyle = `rgba(236,233,226,${Math.min(1, 0.85 * glow)})`;
    for (let i = 0; i < COUNT; i++) {
      if (!accent[i]) ctx.fillRect(px[i] - 0.8, py[i] - 0.8, 1.7, 1.7);
    }
    ctx.fillStyle = `rgba(245,194,107,${Math.min(1, 0.95 * glow)})`;
    for (let i = 0; i < COUNT; i++) {
      if (accent[i]) ctx.fillRect(px[i] - 0.9, py[i] - 0.9, 2.0, 2.0);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  return { ready, frame };
}
