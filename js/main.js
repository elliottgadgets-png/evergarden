// main.js — boot, virtual smooth-scroll, cursor, reveals, choreography.
import { createSky } from './sky.js';
import { createField } from './field.js';
import { createGrowth } from './growth.js';
import { createTrail } from './trail.js';

const isTouch = matchMedia('(pointer: coarse)').matches;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- grain (self-drawn, animated) ---------- */
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

/* ---------- sky ---------- */
const sky = createSky(document.getElementById('sky'));

/* ---------- field ---------- */
const fieldSection = document.getElementById('field');
const field = createField(document.getElementById('field-canvas'), fieldSection);

/* ---------- growth ---------- */
const growthSection = document.getElementById('growth');
const growth = createGrowth(document.getElementById('growth-canvas'), growthSection);
const growthPct = document.getElementById('growth-pct');
const growthSticky = growthSection.querySelector('.growth-sticky');

/* ---------- spore trail (pointer devices only) ---------- */
const trail = !isTouch ? createTrail(document.getElementById('trail')) : null;

/* ---------- virtual smooth scroll (desktop only) ---------- */
const content = document.getElementById('scroll-content');
let scrollTarget = 0, scrollCurrent = 0, maxScroll = 0;
const virtual = !isTouch && !prefersReduced;
if (!virtual) document.body.classList.add('native-scroll');

function measure() {
  maxScroll = Math.max(0, content.scrollHeight - innerHeight);
  if (!virtual) document.body.style.height = '';
}
measure();
window.addEventListener('resize', measure);

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
function clampScroll(v) { return Math.max(0, Math.min(maxScroll, v)); }

/* debug / automation hook */
window.__eg = {
  setScroll(v) { scrollTarget = clampScroll(v); },
  snap(v) { scrollTarget = clampScroll(v); scrollCurrent = scrollTarget; },
  getScroll() { return scrollCurrent; },
  sectionTop(sel) { const el = document.querySelector(sel); return el ? el.offsetTop : -1; }
};

/* nav anchors in virtual mode */
document.querySelectorAll('[data-nav]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    const top = el.offsetTop;
    if (virtual) scrollTarget = clampScroll(top);
    else el.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- cursor ---------- */
const dot = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
const cur = { x: innerWidth/2, y: innerHeight/2, rx: innerWidth/2, ry: innerHeight/2, tx: innerWidth/2, ty: innerHeight/2 };
if (virtual) {
  window.addEventListener('pointermove', e => { cur.tx = e.clientX; cur.ty = e.clientY; });
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('pointerenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('pointerleave', () => document.body.classList.remove('cursor-hover'));
  });
}

/* ---------- reveals ---------- */
// wrap manifesto lines
document.querySelectorAll('.m-line').forEach(line => {
  line.innerHTML = `<span class="m-inner">${line.innerHTML}</span>`;
});
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const el = en.target;
    if (el.classList.contains('reveal-line')) {
      el.style.transition = 'opacity 1.1s cubic-bezier(.22,1,.36,1), transform 1.1s cubic-bezier(.22,1,.36,1)';
      el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    }
    if (el.classList.contains('m-line')) {
      const inner = el.querySelector('.m-inner');
      const idx = [...document.querySelectorAll('.m-line')].indexOf(el);
      inner.style.transition = `transform 1.2s ${0.08 * (idx % 6)}s cubic-bezier(.22,1,.36,1)`;
      inner.style.transform = 'translateY(0)';
    }
    io.unobserve(el);
  }
}, { threshold: 0.25 });
document.querySelectorAll('.reveal-line, .m-line').forEach(el => io.observe(el));

/* field runs only while visible */
const fieldIO = new IntersectionObserver(entries => {
  entries.forEach(en => en.isIntersecting ? field.start() : field.stop());
}, { threshold: 0.05 });
fieldIO.observe(fieldSection);

/* ---------- main loop ---------- */
function growthProgress() {
  const r = growthSection.getBoundingClientRect();
  const total = r.height - innerHeight;
  return Math.max(0, Math.min(1, -r.top / (total || 1)));
}

function loop(t) {
  if (virtual) {
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.085;
    if (Math.abs(scrollTarget - scrollCurrent) < 0.05) scrollCurrent = scrollTarget;
    content.style.transform = `translate3d(0, ${-scrollCurrent}px, 0)`;
  } else {
    scrollCurrent = window.scrollY;
  }

  // cursor
  if (virtual) {
    cur.x += (cur.tx - cur.x) * 0.35;
    cur.y += (cur.ty - cur.y) * 0.35;
    cur.rx += (cur.tx - cur.rx) * 0.12;
    cur.ry += (cur.ty - cur.ry) * 0.12;
    dot.style.transform = `translate(${cur.x - 3}px, ${cur.y - 3}px)`;
    ring.style.transform = `translate(${cur.rx - 17}px, ${cur.ry - 17}px)`;
  }

  // manual sticky pin for the growth chapter (virtual scroll: no real scrolling)
  if (virtual) {
    const gr = growthSection.getBoundingClientRect();
    const pin = Math.max(0, Math.min(gr.height - innerHeight, -gr.top));
    growthSticky.style.transform = `translate3d(0, ${pin}px, 0)`;
  }

  if (sky) {
    sky.setScroll(maxScroll ? scrollCurrent / maxScroll : 0);
    sky.frame(t);
  }
  if (trail) trail.frame();
  growth.draw(growthProgress(), growthPct);

  requestAnimationFrame(loop);
}

/* ---------- preloader ---------- */
const pre = document.getElementById('preloader');
const count = document.getElementById('load-count');
const stem = document.getElementById('stem');
const leafL = document.getElementById('leaf-l');
const leafR = document.getElementById('leaf-r');
let p = 0;
const tick = setInterval(() => {
  p = Math.min(100, p + 3 + Math.random() * 9);
  count.textContent = Math.floor(p);
  stem.style.strokeDashoffset = String(60 - (p / 100) * 60);
  if (p > 55) leafL.style.opacity = String((p - 55) / 45);
  if (p > 75) leafR.style.opacity = String((p - 75) / 25);
  if (p >= 100) {
    clearInterval(tick);
    setTimeout(openGarden, 350);
  }
}, 90);

function openGarden() {
  pre.style.transition = 'opacity 1s ease, transform 1.2s cubic-bezier(.22,1,.36,1)';
  pre.style.opacity = '0';
  pre.style.transform = 'translateY(-4%)';
  setTimeout(() => pre.remove(), 1300);

  document.getElementById('frame').style.transition = 'opacity 1.4s ease .5s';
  document.getElementById('frame').style.opacity = '1';

  document.querySelectorAll('.hero-title .ht-word').forEach((w, i) => {
    w.style.transition = `transform 1.4s ${0.15 + i * 0.12}s cubic-bezier(.22,1,.36,1)`;
    w.style.transform = 'translateY(0)';
  });
  document.querySelectorAll('.hero-kicker, .hero-sub').forEach((el, i) => {
    el.style.transition = `opacity 1.2s ease ${0.7 + i * 0.2}s, transform 1.2s cubic-bezier(.22,1,.36,1) ${0.7 + i * 0.2}s`;
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  });
  requestAnimationFrame(loop);
}
