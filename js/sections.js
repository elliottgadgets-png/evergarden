// sections.js — the studio integration surface.
// Each section of the page can register a module: an object with optional
//   enter(ctx)        — the section became the dominant one on screen
//   exit(ctx)         — it stopped being dominant
//   frame(ctx, t, f)  — every frame while visible; f = 0..1 progress THROUGH the section
// ctx carries { gl, canvas, chapter } so modules can paint the WebGL layer,
// move the particle chapter's parameters, or drive DOM.
// The particle engine remains the connective tissue: modules add to it,
// they do not replace it.

const modules = new Map(); // chapterIndex -> module

export function registerSection(chapterIndex, mod) {
  modules.set(chapterIndex, mod);
}

export function createSectionRouter() {
  let active = -1;
  return {
    frame(t, progress01, chapterCount) {
      const cf = progress01 * (chapterCount - 1);
      const ci = Math.min(chapterCount - 1, Math.round(cf));
      const f = cf - Math.floor(cf);
      if (ci !== active) {
        if (modules.has(active) && modules.get(active).exit) modules.get(active).exit();
        if (modules.has(ci) && modules.get(ci).enter) modules.get(ci).enter();
        active = ci;
      }
      const m = modules.get(ci);
      if (m && m.frame) m.frame(t, f);
    }
  };
}
