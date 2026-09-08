// main.js — boot, virtual scroll, cursor, grain, choreography.
import { createWordSystem, CHAPTER_COUNT } from './word.js';
import { createSectionRouter } from './sections.js';
import { createAurora } from './aurora.js';
import { createSound } from './sound.js';

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
  onChapter: i => sound.chapter(i),
  onBurst: () => sound.burst()
});
const aurora = createAurora(document.getElementById('gl'), wordSys.mood);
window.__egSound = sound;
const soundBtn = document.getElementById('sound-toggle');
if (soundBtn) soundBtn.addEventListener('click', () => {
  const on = sound.toggle();
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.classList.toggle('is-on', on);
});

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
  const c = document.querySelector('[data-ch="2"] .cap');
  if (c) c.textContent = 'געו במסך — האותיות מרגישות אתכם';
}

/* ---------- reveals ---------- */
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const el = en.target;
    el.style.transition = 'opacity 1.2s cubic-bezier(.22,1,.36,1), transform 1.2s cubic-bezier(.22,1,.36,1)';
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    io.unobserve(el);
  }
}, { threshold: 0.2 });
document.querySelectorAll('.reveal-line').forEach(el => io.observe(el));

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
  aurora.frame(t);
  wordSys.frame(t, pr);
  sound.progress(pr);
  sections.frame(t, pr, CHAPTER_COUNT);
  requestAnimationFrame(loop);
}

/* ---------- preloader: assemble ---------- */
const pre = document.getElementById('preloader');
const count = document.getElementById('load-count');
let p = 0;
let fontsReady = false;
wordSys.ready.then(() => { fontsReady = true; });
const tick = setInterval(() => {
  const cap = fontsReady ? 100 : 88;
  p = Math.min(cap, p + 2 + Math.random() * 6);
  count.textContent = Math.floor(p);
  if (p >= 100) { clearInterval(tick); setTimeout(openSite, 300); }
}, 70);

function openSite() {
  pre.style.transition = 'opacity 1s ease';
  pre.style.opacity = '0';
  setTimeout(() => pre.remove(), 1100);
  const fr = document.getElementById('frame');
  fr.style.transition = 'opacity 1.4s ease .4s';
  fr.style.opacity = '1';
  requestAnimationFrame(loop);
}
