// main.js — boot, virtual scroll, cursor, grain, choreography.
import { createWordSystem, CHAPTER_COUNT } from './word.js';
import { createSectionRouter } from './sections.js';
import { createAurora } from './aurora.js';
import { createSound } from './sound.js';
import { createRevealer } from './motion.js';
import { createParticleFX } from './fx-particles.js';

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

/* ---------- word system ---------- */
const sound = createSound();
const sections = createSectionRouter();
const wordSys = createWordSystem(document.getElementById('word'), {
  onChapter: i => { sound.chapter(i); document.body.dataset.chapter = i; },
  onBurst: () => sound.burst()
});
const aurora = createAurora(document.getElementById('gl'), wordSys.mood);
const pfx = createParticleFX();
window.__egSound = sound;
const soundBtn = document.getElementById('sound-toggle');
if (soundBtn) soundBtn.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.classList.toggle('is-on', on);
});

/* ---------- laptop scene (chapter 1) ---------- */
let laptop = null;
const laptopStage = document.querySelector('[data-ch="2"] .laptop-stage');
if (laptopStage && !prefersReduced) {
  import('./laptop.js').then(mod => { laptop = mod.init(laptopStage, { quality: 'auto' }); }).catch(() => {});
}

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
  snap(v) { scrollTarget = clampScroll(v); scrollCurrent = scrollTarget; },
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
  if (shimmerMap && !prefersReduced) {
    shimmerV = Math.min(18, Math.abs(scrollCurrent - lastScroll) * 0.42);
    lastScroll = scrollCurrent;
    shimmerCur += (shimmerV - shimmerCur) * 0.14;
    if (shimmerCur < 0.15) shimmerCur = 0;
    const sv = shimmerCur.toFixed(1);
    if (shimmerMap._last !== sv) { shimmerMap.setAttribute('scale', sv); shimmerMap._last = sv; }
  }
  aurora.frame(t);
  wordSys.frame(t, pr);
  pfx.frame(t * 0.001, pr * (CHAPTER_COUNT - 1));
  sound.progress(pr);
  sections.frame(t, pr, CHAPTER_COUNT);
  if (cross && document.body.dataset.chapter === '2') {
    const tx = cross._tx ?? innerWidth / 2, ty = cross._ty ?? innerHeight / 2;
    chPos.x += (tx - chPos.x) * 0.12;
    chPos.y += (ty - chPos.y) * 0.12;
    cross.style.transform = `translate(${chPos.x}px, ${chPos.y}px)`;
    if (chRead) chRead.textContent = 'X:' + String(Math.round(chPos.x)).padStart(4, '0') + ' Y:' + String(Math.round(chPos.y)).padStart(4, '0');
  }
  if (laptop) {
    const cf = pr * (CHAPTER_COUNT - 1);
    if (cf > 0.6 && cf < 3.4) {
      const lp = Math.min(1, Math.max(0, (cf - 1.42) / 1.12));
      laptop.frame(t * 0.001, lp);
      if (virtual) laptop.setPointer((cur.tx / innerWidth) * 2 - 1, (cur.ty / innerHeight) * 2 - 1);
    }
  }
  requestAnimationFrame(loop);
}

/* ---------- preloader: assemble ---------- */
const pre = document.getElementById('preloader');
const count = document.getElementById('load-count');
let p = 0;
let fontsReady = false;
wordSys.ready.then(() => { fontsReady = true; });
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
  pfx.handoffToHero();
  sparkAlive = false;
  pre.style.transition = 'opacity 1s ease';
  pre.style.opacity = '0';
  setTimeout(() => pre.remove(), 1100);
  const fr = document.getElementById('frame');
  fr.style.transition = 'opacity 1.4s ease .4s';
  fr.style.opacity = '1';
  requestAnimationFrame(loop);
}
