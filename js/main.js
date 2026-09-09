// main.js — boot, virtual scroll, cursor, grain, choreography.
import { createSound } from './sound.js';
import { createRevealer } from './motion.js';
import { createParticleFX } from './fx-particles.js';
import { createWorld } from './world.js';

// v5.0 «המסע»: one continuous world. 7 chapters = 7 stretches of one road.
const CHAPTER_COUNT = 7;

const isTouch = matchMedia('(pointer: coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- grain ---------- */
(function grain() {
  const g = document.getElementById('grain');
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const gx = c.getContext('2d');
  const img = gx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 255;
  }
  gx.putImageData(img, 0, 0);
  g.style.backgroundImage = `url(${c.toDataURL()})`;
  let off = 0;
  setInterval(() => {
    off = (off + 37) % 100;
    g.style.transform = `translate(${off - 50}px, ${50 - off}px)`;
  }, 90);
})();

/* ---------- the world + sound ---------- */
const sound = createSound();
const world = createWorld(document.getElementById('gl'));
const pfx = createParticleFX(); // S0 preloader spark only; chapter worlds retired
let chapterCur = -1;
const STATION_WINDOWS = [[0, .04], [.04, .20], [.20, .34], [.34, .46], [.46, .56], [.56, .70], [.74, 1.01]];
function chapterUpdate(pr) {
  const ci = Math.max(0, STATION_WINDOWS.findIndex(([a, b]) => pr >= a && pr < b));
  if (ci === chapterCur) return;
  chapterCur = ci;
  document.body.dataset.chapter = ci;
  sound.chapter(ci);
}
window.__egSound = sound;
const soundBtn = document.getElementById('sound-toggle');
if (soundBtn) soundBtn.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.classList.toggle('is-on', on);
});

/* laptop now lives in the world as the S3 monument (world.js) */

/* ---------- virtual smooth scroll ---------- */
const content = document.getElementById('scroll-content');
let scrollTarget = 0, scrollCurrent = 0, maxScroll = 0;
const virtual = !isTouch && !prefersReduced;
if (!virtual) document.body.classList.add('native-scroll');

function measure() { maxScroll = Math.max(0, content.scrollHeight - innerHeight); }
measure();
window.addEventListener('resize', measure);

function clampScroll(v) { return Math.max(0, Math.min(maxScroll, v)); }

window.__eg = {
  setScroll(v) { scrollTarget = clampScroll(v); },
  snap(v) { scrollTarget = clampScroll(v); scrollCurrent = scrollTarget; window.__egSnapWorld = true; },
  getScroll() { return scrollCurrent; },
  sectionTop(sel) { const el = document.querySelector(sel); return el ? el.offsetTop : -1; }
};

if (virtual) {
  window.addEventListener('wheel', e => {
    e.preventDefault();
    scrollTarget = clampScroll(scrollTarget + e.deltaY);
  }, { passive: false });
  window.addEventListener('keydown', e => {
    const step = { ArrowDown: 120, ArrowUp: -120, PageDown: innerHeight, PageUp: -innerHeight, Space: innerHeight }[e.code];
    if (step) { e.preventDefault(); scrollTarget = clampScroll(scrollTarget + step); }
  });
}

/* ---------- replay ---------- */
const replay = document.getElementById('replay');
if (replay) replay.addEventListener('click', e => {
  e.preventDefault();
  if (virtual) scrollTarget = 0;
  else window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ---------- cursor ---------- */
const dot = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
const cur = { tx: innerWidth/2, ty: innerHeight/2, rx: innerWidth/2, ry: innerHeight/2 };
if (virtual) {
  window.addEventListener('pointermove', e => { cur.tx = e.clientX; cur.ty = e.clientY; });
  document.querySelectorAll('a').forEach(el => {
    el.addEventListener('pointerenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('pointerleave', () => document.body.classList.remove('cursor-hover'));
  });
}

/* ---------- touch copy ---------- */
if (isTouch) {
  const c = document.querySelector('[data-ch="1"] .sec-micro');
  if (c) c.textContent = 'געו במסך — החומר מרגיש אתכם';
}

/* ---------- fluid camera-tied copy (typography v2: signs on a road) ---------- */
// Each station's copy enters from blur-ahead, locks sharp at the camera beat,
// and recedes (z + defocus) as the camera passes. Driven by chapter distance,
// not scroll triggers; reveal-line IO remains as first-entry fallback.
const copyBlocks = [...document.querySelectorAll('.panel')].map(p => {
  const el = p.querySelector('.hero-copy, .sec-copy, .works-copy, .outro-inner, .cap, .works-inner') || p.querySelector('p, h1, h2');
  const lines = el ? [...el.children] : [];
  return { ch: parseInt(p.dataset.ch || '0', 10), el, lines };
}).filter(b => b.el && b.lines.length);
function fluidCopy(cf) {
  for (const b of copyBlocks) {
    b.lines.forEach((ln, i) => {
      if (b.ch === 3 && cf > 2.25) { if (ln.style.opacity !== '0') ln.style.opacity = '0'; return; } // relief dwell owns ch3
      const d = cf - b.ch - i * 0.055;              // baseline stagger: lines arrive in sequence
      const ad = Math.abs(d);
      if (ad > 1.6) { if (ln.style.opacity !== '0') ln.style.opacity = '0'; return; }
      const t0 = Math.min(1, Math.max(0, 1.35 - ad * 1.05));
      const vis = t0 * t0 * (3 - 2 * t0);
      const sharp = 1 - Math.min(1, ad * 1.3);
      ln.style.opacity = vis.toFixed(3);
      ln.style.transform = `translateY(${(-d * 14).toFixed(1)}px) scale(${(0.97 + sharp * 0.03).toFixed(3)})`;
      const bl = Math.min(1.6, Math.max(0, ad - 0.35) * 2.2);
      ln.style.filter = bl > 0.5 ? `blur(${bl.toFixed(1)}px)` : 'none';
      const head = (ln.matches && ln.matches('h1, h2, .hero-title, .sec-title, .works-title, .cf-big')) ? ln : (ln.querySelector ? ln.querySelector('h1, h2, .hero-title, .sec-title, .works-title, .cf-big') : null);
      if (head) head.style.letterSpacing = `calc(var(--base-track, 0em) + ${(ad * 0.02).toFixed(3)}em)`;
      if (ln.tagName === 'P' && !head) ln.style.fontVariationSettings = `'wght' ${(260 + sharp * 120) | 0}`;
    });
  }
}

/* ---------- reveals (one motion language) ---------- */
// createRevealer() runs in openSite() so entrance choreography plays after the strike.

/* ---------- S0 flint strike: letter-by-letter + spark ---------- */
const loadLabel = document.getElementById('load-label');
if (loadLabel) {
  const txt = loadLabel.textContent;
  loadLabel.textContent = '';
  [...txt].forEach(ch => {
    const sp = document.createElement('span');
    sp.className = 'l' + (ch === ' ' ? ' sp' : '');
    sp.textContent = ch === ' ' ? '\u00A0' : ch;
    loadLabel.appendChild(sp);
  });
}

/* ---------- workbench crosshair (chapter 2) ---------- */
const cross = document.querySelector('.crosshair');
const chRead = cross ? cross.querySelector('.ch-read') : null;
const chPos = { x: innerWidth / 2, y: innerHeight / 2 };
if (cross && virtual) {
  window.addEventListener('pointermove', e => { cross._tx = e.clientX; cross._ty = e.clientY; });
}

/* ---------- progress rail (8 ticks; S0 during preloader, then chapters+1) ---------- */
const railTicks = [...document.querySelectorAll('#rail .rt')];
let railIdx = -1;
function railUpdate() {
  const open = document.body.classList.contains('is-open');
  const ch = parseInt(document.body.dataset.chapter || '0', 10);
  const idx = open ? Math.min(7, ch + 1) : 0;
  if (idx === railIdx) return;
  railIdx = idx;
  railTicks.forEach((el, i) => {
    el.classList.toggle('on', i === idx);
    el.classList.toggle('done', i < idx);
  });
}

/* ---------- S5 cinema: lateral dolly scrubbed by the chapter window ---------- */
const cinemaTrack = document.querySelector('.cinema-track');
const cFrames = cinemaTrack ? [...cinemaTrack.querySelectorAll('.cframe')] : [];
const cProg = document.querySelector('.cinema-progress i');
const CF_N = cFrames.length;
const cBurn = document.querySelector('.cinema-burn');
const cStage = document.querySelector('.cinema-stage');
const cClose = document.querySelector('.cframe-close');
function cinemaDrive(cf) {
  if (!cinemaTrack) return;
  if (cf > 5.1) return;
  if (cf < 3.9) { // the story waits for its panel to fully take the viewport: no blurred words at screen edges during the works acts
    if (cStage) cStage.style.opacity = '0';
    if (cBurn) cBurn.style.opacity = '0';
    return;
  }
  // the stage speaks only when its panel substantially covers the viewport -
  // a sliver of panel at the screen edge must never carry blurred half-words
  if (cStage) {
    const r = cStage.getBoundingClientRect();
    const visH = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    var stageCover = Math.min(1, visH / (innerHeight * 0.72));
  }
  const p = Math.min(1, Math.max(0, (cf - 4.03) / 0.72)); // plays inside the panel's full-cover window (pr ~0.66-0.79)
  cinemaTrack.style.transform = `translate3d(${p * (CF_N - 1) * innerWidth}px, 0, 0)`;
  if (cProg) cProg.style.transform = `scaleX(${p})`;
  // S5→S6 burn-through: the closing frame ignites and the kiln light blooms through
  const q = Math.min(1, Math.max(0, (cf - 4.55) / 0.45));
  const pN = p * (CF_N - 1);
  for (let i = 0; i < CF_N; i++) {
    const d = Math.abs(pN - i);
    let o = Math.min(1, Math.max(0, 1 - Math.max(0, d - 0.18) * 2.2));
    let b = Math.min(10, Math.max(0, d - 0.18) * 18);
    let extra = '';
    if (q > 0 && cFrames[i] === cClose) {
      o *= (1 - q * q);
      b += q * 7;
      extra = ` brightness(${(1 + 2.3 * q).toFixed(2)})`;
    }
    const el = cFrames[i];
    el.style.opacity = o.toFixed(3);
    el.style.filter = (b > 0.1 || extra) ? `blur(${b.toFixed(1)}px)${extra}` : 'none';
  }
  if (cStage) {
    const qFade = q > 0.75 ? Math.max(0, 1 - (q - 0.75) / 0.25) : 1;
    cStage.style.opacity = (qFade * (typeof stageCover === 'number' ? stageCover : 1)).toFixed(3);
  }
  if (cBurn) {
    if (q > 0 && q < 1) {
      cBurn.style.opacity = String(Math.min(1, q * 1.15).toFixed(3));
      cBurn.style.transform = `scale(${(0.15 + q * 1.5).toFixed(3)})`;
    } else if (q >= 1) { cBurn.style.opacity = '0'; }
  }
}

/* ---------- S4 glass shimmer: scroll velocity bends the case glass ---------- */
const shimmerMap = document.querySelector('#glass-shimmer feDisplacementMap');
let shimmerV = 0, shimmerCur = 0, lastScroll = 0;

/* ---------- main loop ---------- */
function loop(t) {
  if (virtual) {
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.08;
    if (Math.abs(scrollTarget - scrollCurrent) < 0.05) scrollCurrent = scrollTarget;
    content.style.transform = `translate3d(0, ${-scrollCurrent}px, 0)`;
  } else {
    scrollCurrent = window.scrollY;
  }
  if (virtual) {
    cur.rx += (cur.tx - cur.rx) * 0.14;
    cur.ry += (cur.ty - cur.ry) * 0.14;
    dot.style.transform = `translate(${cur.tx - 2.5}px, ${cur.ty - 2.5}px)`;
    ring.style.transform = `translate(${cur.rx}px, ${cur.ry}px)`;
  }
  const pr = maxScroll ? scrollCurrent / maxScroll : 0;
  const plate = document.getElementById('plate-soshimi');
  if (plate) plate.classList.toggle('is-on', pr > 0.485 && pr < 0.545);
  const plate2 = document.getElementById('plate-verdant');
  if (plate2) plate2.classList.toggle('is-on', pr > 0.556 && pr < 0.610);
  const plate3 = document.getElementById('plate-video');
  if (plate3) plate3.classList.toggle('is-on', pr > 0.716 && pr < 0.770);
  const worksTitle = document.querySelector('.works-title');
  if (worksTitle) worksTitle.style.opacity = (pr > 0.478 && pr < 0.552) ? '0' : '';
  const worksInner = document.querySelector('.works-inner');
  if (worksInner) { worksInner.style.transition = 'opacity .4s'; worksInner.style.opacity = pr > 0.452 ? '0' : ''; } // works DOM fully exits before the relief act
  const proofGrid = document.querySelector('.proof-grid');
  if (proofGrid) { proofGrid.style.transition = 'opacity .4s'; proofGrid.style.opacity = pr > 0.452 ? '0' : ''; } // S3 proof cells retire with it
  const cfKiln = pr * (CHAPTER_COUNT - 1);
  if (shimmerMap && !prefersReduced) {
    shimmerV = Math.min(18, Math.abs(scrollCurrent - lastScroll) * 0.42);
    lastScroll = scrollCurrent;
    shimmerCur += (shimmerV - shimmerCur) * 0.14;
    if (shimmerCur < 0.15) shimmerCur = 0;
    const sv = shimmerCur.toFixed(1);
    if (shimmerMap._last !== sv) { shimmerMap.setAttribute('scale', sv); shimmerMap._last = sv; }
  }
  world.frame(t, pr);
  fluidCopy(window.__stationCf ?? cfKiln);
  pfx.kilnFrame(t * 0.001, cfKiln, (cur.tx / innerWidth) * 2 - 1, (cur.ty / innerHeight) * 2 - 1);
  chapterUpdate(pr);
  sound.progress(pr);
  railUpdate();
  cinemaDrive(pr * (CHAPTER_COUNT - 1));
  if (cross && document.body.dataset.chapter === '2') {
    const tx = cross._tx ?? innerWidth / 2, ty = cross._ty ?? innerHeight / 2;
    chPos.x += (tx - chPos.x) * 0.12;
    chPos.y += (ty - chPos.y) * 0.12;
    cross.style.transform = `translate(${chPos.x}px, ${chPos.y}px)`;
    if (chRead) chRead.textContent = 'X:' + String(Math.round(chPos.x)).padStart(4, '0') + ' Y:' + String(Math.round(chPos.y)).padStart(4, '0');
  }
  requestAnimationFrame(loop);
}

/* ---------- preloader: assemble ---------- */
const pre = document.getElementById('preloader');
const count = document.getElementById('load-count');
let p = 0;
let fontsReady = false;
document.fonts.ready.then(() => { fontsReady = true; });
let spark = null;
pfx.bootSpark().then(h => { spark = h; });
// spark runs on its own clock until the main loop takes over
let sparkAlive = true;
(function sparkLoop(t) {
  if (!sparkAlive) return;
  if (spark) pfx.sparkFrame(t * 0.001, Math.min(1, p / 100));
  requestAnimationFrame(sparkLoop);
})(0);
const labelLetters = loadLabel ? [...loadLabel.children] : [];
const tick = setInterval(() => {
  const cap = fontsReady ? 100 : 88;
  p = Math.min(cap, p + 2 + Math.random() * 6);
  count.textContent = Math.floor(p);
  const lit = Math.floor((p / 100) * labelLetters.length * 1.15);
  labelLetters.forEach((el, i) => el.classList.toggle('lit', i < lit));
  if (p >= 100) { clearInterval(tick); setTimeout(openSite, 300); }
}, 70);

function openSite() {
  document.body.classList.add('is-open');
  createRevealer();
  // spark's strike hands off to the world: fade the spark canvas out
  const heroFx = document.getElementById('hero-fx');
  if (heroFx) { heroFx.style.transition = 'opacity 1.2s ease .3s'; heroFx.style.opacity = '0'; }
  sparkAlive = false;
  pre.style.transition = 'opacity 1s ease';
  pre.style.opacity = '0';
  setTimeout(() => pre.remove(), 1100);
  const fr = document.getElementById('frame');
  fr.style.transition = 'opacity 1.4s ease .4s';
  fr.style.opacity = '1';
  requestAnimationFrame(loop);
}
