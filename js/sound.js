// sound.js — procedural audio. No samples, no libraries: a drone that
// follows scroll depth, a chime when a chapter settles, a noise swell
// on click bursts. Everything is synthesized live in WebAudio.

export function createSound() {
  let ctx = null, master = null, droneFilter = null, droneGain = null;
  let on = false;
  let lastChapter = -1;

  function boot() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // drone: two detuned triangles through a lowpass
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 220;
    droneFilter.Q.value = 2.5;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    droneFilter.connect(droneGain).connect(master);
    for (const f of [55, 55 * 1.5, 55 * 2.02]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = f > 100 ? 0.18 : 0.5;
      o.connect(g).connect(droneFilter);
      o.start();
    }
    // slow breathing on the drone
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(droneGain.gain);
    lfo.start();
  }

  function toggle() {
    boot();
    if (ctx.state === 'suspended') ctx.resume();
    on = !on;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(on ? 0.9 : 0, ctx.currentTime + 0.6);
    return on;
  }

  // scroll depth opens the drone's filter: deeper = brighter
  function progress(pr) {
    if (!ctx || !on) return;
    droneFilter.frequency.setTargetAtTime(160 + pr * 900, ctx.currentTime, 0.4);
  }

  // chapter settle: a soft bell, pitch rises with chapter index
  function chapter(i) {
    if (i === lastChapter) return;
    lastChapter = i;
    if (!ctx || !on) return;
    const base = 220 * Math.pow(1.26, i % 6);
    for (const [mult, amp, dur] of [[1, 0.16, 2.2], [2.01, 0.05, 1.4], [2.99, 0.02, 0.8]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.1);
    }
  }

  // click burst: a breath of filtered noise
  function burst() {
    if (!ctx || !on) return;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, ctx.currentTime);
    bp.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.4);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(bp).connect(g).connect(master);
    src.start();
  }

  return { toggle, progress, chapter, burst,
    get on() { return on; }, get state() { return ctx ? ctx.state : 'off'; } };
}
