// word.js — נצח: living Hebrew letters. Every glyph is a swarm.
// Words are sampled from real type, then ~6000 hand-driven particles
// assemble, morph between words on scroll, feel the visitor's pointer,
// and finally scatter like embers. No libraries.

// each chapter is its own world: its own word, its own corner of the
// screen, its own accent color, its own background. the scroll is a
// journey between worlds, not a flipbook of the same frame.
const CHAPTERS = [
  { word: 'חוויה', pointer: 1.0, glow: 1.0, lift: 0.0,  spread: 0,
    bg: [11,11,13],    accent: [245,194,107], cxOff: 0, tint: 0 },
  { word: 'דיוק',  pointer: 1.3, glow: 1.0, lift: 0.0,  spread: 0,
    bg: [18,24,54],    accent: [139,157,255], cxOff: -0.17, tint: 0.32 },
  { word: 'סיפור', pointer: 3.2, glow: 1.1, lift: 0.0,  spread: 0,
    bg: [12,44,37],    accent: [111,227,193], cxOff: 0.17, tint: 0.32 },
  { word: 'אור',   pointer: 1.0, glow: 1.9, lift: -0.4, spread: 0,
    bg: [46,17,30],    accent: [255,157,122], cxOff: 0, tint: 0.26 },
  { word: null,    pointer: 0.6, glow: 0.32, lift: -0.3, spread: 1, // starfield: the works float over it; these are the embers
    bg: [8,8,10],     accent: [245,194,107], cxOff: 0, tint: 0 },
  // bloom: the embers remember what they were — the swarm resurrects
  // into the wordmark, smaller and higher, burning brighter.
  { word: 'נצח',   pointer: 1.2, glow: 1.4, lift: 0.0,  spread: 0, scale: 0.4, cyOff: -0.23,
    bg: [11,11,13],    accent: [245,194,107], cxOff: 0, tint: 0 },
];

const COUNT = (typeof innerWidth !== 'undefined' && innerWidth < 720) ? 3200 : 6000;

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

export function createWordSystem(canvas, hooks = {}) {
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
    chapters = CHAPTERS.map(ch => {
      const pts = ch.word ? sampleWord(ch.word, boxW, boxH) : scatterPoints(W, H);
      const sc = ch.scale || 1;
      if (sc !== 1) for (let i = 0; i < pts.length; i++) pts[i] *= sc;
      return { ...ch, pts };
    });
  }

  const ready = document.fonts.ready.then(() => buildAll());

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(buildAll, 200);
  });

  const pointer = { x: -9999, y: -9999 };
  let lastRealMove = 0;   // 0 = never moved: ghost starts active
  const bursts = []; // {x, y, t0}
  let held = false;

  window.addEventListener('pointerdown', e => {
    held = true;
    if (hooks.onBurst) hooks.onBurst();
    bursts.push({ x: e.clientX, y: e.clientY, t0: performance.now() });
    if (bursts.length > 4) bursts.shift();
  });
  window.addEventListener('pointerup', () => { held = false; });
  window.addEventListener('pointercancel', () => { held = false; });
  window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; lastRealMove = performance.now(); });
  window.addEventListener('pointerleave', () => { pointer.x = -9999; pointer.y = -9999; });

  // type-to-morph: the visitor types, the swarm spells it
  let typed = '', typedAt = 0, typedPts = null, typedMix = 0;
  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace') { typed = typed.slice(0, -1); typedPts = null; typedAt = performance.now(); return; }
    if (e.key.length !== 1) return;
    if (!/[\u0590-\u05FFa-zA-Z0-9!?.]/.test(e.key)) return;
    const now = performance.now();
    if (now - typedAt > 1500) typed = '';
    typed = (typed + e.key).slice(-9);
    typedAt = now;
    typedPts = null;
  });

  let seeded = false;
  let energy = 0;   // scroll-velocity energy: fast scrolls shake the letters
  let lastProg = 0, lastT = 0;
  const smooth = t => t * t * (3 - 2 * t);
  let lastBgCss = '';

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
    const pr = Math.min(1, Math.max(0, progress01));
    if (lastT) {
      const dt = Math.max(1, t - lastT);
      energy = Math.min(1, energy + Math.abs(pr - lastProg) / dt * 900);
    }
    energy *= 0.94;
    lastProg = pr; lastT = t;

    const cf = pr * (N - 1);
    const ci = Math.min(N - 2, Math.floor(cf));
    const f = cf - ci;
    const A = chapters[ci], B = chapters[ci + 1];
    if (hooks.onChapter && f < 0.04) hooks.onChapter(ci);

    // interpolate chapter behavior
    const pStr = A.pointer + (B.pointer - A.pointer) * f;
    const glow = A.glow + (B.glow - A.glow) * f;
    const lift = A.lift + (B.lift - A.lift) * f;

    const cxOff = (A.cxOff || 0) + ((B.cxOff || 0) - (A.cxOff || 0)) * f;
    const cx = W / 2 + W * cxOff;
    const cyOff = (A.cyOff || 0) + ((B.cyOff || 0) - (A.cyOff || 0)) * f;
    const cy = H * (0.40 + cyOff);

    // world colors: background and accent drift between chapters
    const mix3 = (a, b) => a && b ? [
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f)] : [11, 11, 13];
    const bgc = mix3(A.bg, B.bg);
    const acc = mix3(A.accent, B.accent);
    const bgCss = `rgb(${bgc[0]},${bgc[1]},${bgc[2]})`;
    if (bgCss !== lastBgCss) {
      document.documentElement.style.setProperty('--ink', bgCss);
      lastBgCss = bgCss;
    }
    const accCss = `${acc[0]},${acc[1]},${acc[2]}`;
    const tint = (A.tint || 0) + ((B.tint || 0) - (A.tint || 0)) * f;
    const core = [0, 1, 2].map(k => Math.round(236 + (acc[k] - 236) * tint * 0.9));
    const coreCss = `${core[0]},${core[1]},${core[2]}`;
    const R = 150 * Math.min(1.6, Math.max(0.7, pStr));
    const R2 = R * R;
    const k = 0.021, damp = 0.85;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const tt = t * 0.001;

    // ghost hand: when no real pointer for a while, an invisible visitor stirs the letters
    const idle = t - lastRealMove > 6000 || lastRealMove === 0;
    let gx = pointer.x, gy = pointer.y, mIn = pointer.x > -999;
    if (idle) {
      mIn = true;
      const gt = tt * 0.45;
      gx = W / 2 + Math.sin(gt) * W * 0.22 + Math.sin(gt * 2.7) * W * 0.06;
      gy = H * 0.40 + Math.cos(gt * 1.3) * H * 0.12 + Math.sin(gt * 3.1) * H * 0.04;
    }

    // single pass: physics + halo
    for (let i = 0; i < COUNT; i++) {
      // staggered morph between chapters
      const fi = smooth(Math.min(1, Math.max(0, f * 1.7 - stag[i] * 0.7)));
      let tx = A.pts[i * 2] + (B.pts[i * 2] - A.pts[i * 2]) * fi;
      let ty = A.pts[i * 2 + 1] + (B.pts[i * 2 + 1] - A.pts[i * 2 + 1]) * fi;
      if (typedMix > 0.01 && typedPts) {
        tx += (typedPts[i * 2] - tx) * typedMix;
        ty += (typedPts[i * 2 + 1] - ty) * typedMix;
      }
      tx += cx;
      ty += cy + Math.sin(tt * 1.3 + wob[i]) * 0.55;

      vx[i] += (tx - px[i]) * k;
      vy[i] += (ty - py[i]) * k;

      if (mIn) {
        const dx = px[i] - gx, dy = py[i] - gy;
        const idleSoft = idle ? 0.55 : 1;
        const d2 = dx * dx + dy * dy;
        if (held) {
          // gravity well: holding the pointer pulls the letters toward you
          const d = Math.sqrt(d2) || 1;
          const pull = -Math.min(1.35, 9000 / (d2 + 900)) * pStr;
          vx[i] += (dx / d) * pull - (dy / d) * pull * 0.5;
          vy[i] += (dy / d) * pull + (dx / d) * pull * 0.5;
        } else if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / R) * 2.6 * pStr * idleSoft;
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

      // scroll energy: turbulence while the page flies
      if (energy > 0.02) {
        vx[i] += Math.sin(wob[i] * 12.9 + tt * 31) * energy * 0.9;
        vy[i] += Math.cos(wob[i] * 7.7 + tt * 27) * energy * 0.9;
      }

      vx[i] *= damp; vy[i] *= damp;
      px[i] += vx[i]; py[i] += vy[i];
    }

    // typed override: blend chapter targets with the visitor's own word
    const wantTyped = typed && (t - typedAt < 6000);
    typedMix += ((wantTyped ? 1 : 0) - typedMix) * 0.14;
    if (wantTyped && !typedPts) typedPts = sampleWord(typed, Math.min(W * 0.74, 1050), H * 0.44);
    if (!typed) typedMix = Math.max(0, typedMix - 0.02);

    // halo pass (sparse, cheap glow)
    ctx.fillStyle = `rgba(${coreCss},${0.05 * glow})`;
    for (let i = 0; i < COUNT; i += 3) ctx.fillRect(px[i] - 3, py[i] - 3, 6, 6);

    // core pass, two tints
    ctx.fillStyle = `rgba(${coreCss},${Math.min(1, 0.85 * glow)})`;
    for (let i = 0; i < COUNT; i++) {
      if (!accent[i]) ctx.fillRect(px[i] - 0.8, py[i] - 0.8, 1.7, 1.7);
    }
    ctx.fillStyle = `rgba(${accCss},${Math.min(1, 0.95 * glow)})`;
    for (let i = 0; i < COUNT; i++) {
      if (accent[i]) ctx.fillRect(px[i] - 0.9, py[i] - 0.9, 2.0, 2.0);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  return { ready, frame };
}
