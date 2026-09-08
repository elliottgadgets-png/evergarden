// motion.js — the single motion language. Every animation on the site
// speaks it: one ease, three durations. DOM and shaders never disagree.
// (implementation spec v1.0, section 1: EASE expo.out, DUR micro/beat/scene)

export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';   // expo.out
export const DUR = { micro: 300, beat: 700, scene: 1400 };  // ms — the only durations

// data-reveal pattern: y 30px -> 0, opacity 0 -> 1, fires at ~82% viewport, once.
export function createRevealer() {
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  const scan = () => document.querySelectorAll('[data-reveal], .reveal-line').forEach(el => {
    if (!el.classList.contains('is-in')) io.observe(el);
  });
  scan();
  return { scan };
}
