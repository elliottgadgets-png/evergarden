// fx-particles.js — orchestration for the builder's particle module.
// S0 preloader spark and S1 hero vortex share ONE instance (no-cut handoff:
// the spark swirl at hold IS the vortex field, blended via setMotionMode).
// S7 outro gets its own 'breathe' instance (composite book+seal, RTL-mirrored,
// per-target tints per AD ruling). S6 kiln 'rise' awaits the builder's module
// update (received file has no motion:'rise'/setHeat yet).
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createParticleFX() {
  const heroEl = document.getElementById('hero-fx');
  const zoneEl = document.getElementById('zone-fx');
  let kiln = null, kilnBooting = false;
  const outroEl = document.querySelector('.outro-fx');
  let mod = null, hero = null, outro = null, outroBooting = false;

  async function loadMod() {
    if (!mod) mod = await import('../src/evergarden-hero-particles.js');
    return mod;
  }

  // S0: spark during the preloader. Returns the instance (or null).
  async function bootSpark() {
    if (REDUCED || !heroEl) return null;
    try {
      const m = await loadMod();
      hero = m.init(heroEl, { motion: 'spark', quality: 'auto', targetUrl: 'targets/s1-armature.png' });
    } catch (e) { hero = null; }
    return hero;
  }

  // S0 -> S1 handoff: same instance, motion crossfade. Called by openSite().
  function handoffToHero() {
    if (hero) hero.setMotionMode('vortex', 1.6);
  }

  async function bootOutro() {
    if (REDUCED || !outroEl || outro || outroBooting) return;
    outroBooting = true;
    try {
      const m = await loadMod();
      // portrait: shrink the composite and lift it above the copy
      const portrait = matchMedia('(max-width: 760px)').matches;
      outro = m.init(outroEl, { motion: 'breathe', quality: 'auto', targets: portrait ? [
        { url: 'targets/s7-commission-book.png', x:  0.36, y: 0.86, scale: 0.27, tint: 0xF4F1EA },
        { url: 'targets/s7-seal-ring.png',       x: -0.46, y: 0.88, scale: 0.21, tint: 0xE8862E },
      ] : [
        { url: 'targets/s7-commission-book.png', x:  0.34, y: 0.70, scale: 0.46, tint: 0xF4F1EA }, // book RIGHT, paper
        { url: 'targets/s7-seal-ring.png',       x: -0.58, y: 0.74, scale: 0.34, tint: 0xE8862E }, // seal LEFT, ember
      ]});
    } catch (e) { outro = null; }
  }

  // spark drive while the main loop is not running yet (preloader)
  function sparkFrame(tSec, loadP) { if (hero) hero.frame(tSec, loadP); }

  // main-loop drive. cf = chapter fraction (pr * (N-1)).
  function frame(tSec, cf) {
    if (hero) {
      if (cf < 1.45) {
        const p = Math.min(1, Math.max(0, cf));
        hero.frame(tSec, p);
        heroEl.style.opacity = cf <= 1 ? '1' : String(Math.max(0, 1 - (cf - 1) / 0.4));
      } else if (heroEl.style.opacity !== '0') heroEl.style.opacity = '0';
    }
    if (cf > 4.4 && !outro && !REDUCED) bootOutro();
    if (outro) {
      const p = Math.min(1, Math.max(0, cf - 5));
      outro.frame(tSec, p);
    }
  }

  // v5.0 kiln zone: environmental sparks rising off the kiln, heat follows pointer.
  async function bootKiln() {
    if (REDUCED || !zoneEl || kiln || kilnBooting) return;
    kilnBooting = true;
    try {
      const m = await loadMod();
      kiln = m.init(zoneEl, { motion: 'rise', quality: 'auto' });
    } catch (e) { kiln = null; }
  }
  function kilnFrame(tSec, cf, nx, ny) {
    const inZone = cf > 4.55 && cf < 6.05;
    if (inZone && !kiln) bootKiln();
    if (!kiln || !zoneEl) return;
    zoneEl.style.opacity = inZone ? String((Math.min(1, (cf - 4.55) / 0.3) * Math.min(1, Math.max(0, (6.05 - cf) / 0.45))).toFixed(3)) : '0';
    if (!inZone) return;
    kiln.setHeat(nx, ny);
    kiln.frame(tSec, Math.min(1, Math.max(0, (cf - 4.55) / 1.45)));
  }

  return { bootSpark, handoffToHero, sparkFrame, frame, kilnFrame };
}
