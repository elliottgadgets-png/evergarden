// sound.js — procedural audio. No samples, no libraries. v4.0 sound map:
// S1 forge/embers + distant hammer · S2 molten bubble · S3 pencil/ruler +
// laptop hum · S4 gallery hush · S5 projector · S6 kiln roar→cooling ticks ·
// S7 quiet workshop + page turn. Muted by default; everything synthesized
// live in WebAudio. Scenes crossfade on chapter change; a lookahead
// scheduler fires each scene's sparse events while it is active.

export function createSound() {
  let ctx = null, master = null, droneFilter = null, droneGain = null;
  let noiseSrc = null, noiseFilter = null, noiseGain = null;
  let humOsc = null, humGain = null;
  let on = false;
  let lastChapter = -1;
  let sceneTimer = null;

  // per-world scene parameters: drone brightness/level, noise bed
  // character, hum level, and which event generator runs.
  const SCENES = [
    { drone: 200, droneLvl: 0.050, noise: 0.000, noiseHz: 800,  hum: 0.000, ev: null },        // S0 ignition hush
    { drone: 260, droneLvl: 0.065, noise: 0.020, noiseHz: 900,  hum: 0.000, ev: 'forge' },     // S1 forge/embers + hammer
    { drone: 320, droneLvl: 0.055, noise: 0.012, noiseHz: 500,  hum: 0.000, ev: 'bubble' },    // S2 molten bubble
    { drone: 380, droneLvl: 0.035, noise: 0.006, noiseHz: 2400, hum: 0.014, ev: 'pencil' },    // S3 bench: hum + pencil/ruler
    { drone: 240, droneLvl: 0.022, noise: 0.004, noiseHz: 600,  hum: 0.000, ev: null },        // S4 gallery hush
    { drone: 300, droneLvl: 0.030, noise: 0.010, noiseHz: 3200, hum: 0.000, ev: 'projector' }, // S5 projector hiss + chatter
    { drone: 180, droneLvl: 0.060, noise: 0.035, noiseHz: 350,  hum: 0.000, ev: 'kiln' },      // S6 kiln roar → cooling ticks
    { drone: 220, droneLvl: 0.028, noise: 0.006, noiseHz: 1200, hum: 0.000, ev: 'pageturn' },  // S7 quiet workshop + page turn
  ];

  function boot() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // drone: three detuned triangles through a lowpass
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
    lfoG.gain.value = 0.015;
    lfo.connect(lfoG).connect(droneGain.gain);
    lfo.start();

    // noise bed: looped noise buffer through a lowpass, per-scene level
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf; noiseSrc.loop = true;
    noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 800; noiseFilter.Q.value = 0.6;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(master);
    noiseSrc.start();

    // mains hum (S3 laptop): 50hz + first harmonic
    humGain = ctx.createGain(); humGain.gain.value = 0;
    humGain.connect(master);
    for (const f of [50, 100]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = f === 50 ? 1 : 0.35;
      o.connect(g).connect(humGain); o.start();
    }
  }

  /* ---- event voices ---------------------------------------------------- */

  function env(node, t0, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    node.connect(g).connect(master);
    return g;
  }
  function ping(t0, freq, peak, dur, type = 'sine') {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    env(o, t0, peak, dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noiseHit(t0, peak, dur, hz, q = 1, type = 'bandpass', sweepTo = 0) {
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dd = buf.getChannelData(0);
    for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(hz, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur * 0.9);
    const g = ctx.createGain(); g.gain.value = peak;
    src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  const EVENTS = {
    // distant hammer: soft metallic thud every 3.5-8s, plus ember crackle pops
    forge(t0) {
      if (Math.random() < 0.30) {
        ping(t0, 164, 0.10, 0.5, 'triangle');
        ping(t0, 164 * 2.7, 0.03, 0.25);
      }
      for (let i = 0, n = 1 + (Math.random() * 3 | 0); i < n; i++)
        noiseHit(t0 + Math.random() * 0.4, 0.05, 0.03, 2600 + Math.random() * 3000, 4);
    },
    // molten bubble: a slow rising blip
    bubble(t0) {
      if (Math.random() > 0.55) return;
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f0 = 140 + Math.random() * 180;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * (1.6 + Math.random()), t0 + 0.22);
      env(o, t0, 0.07, 0.3);
      o.start(t0); o.stop(t0 + 0.4);
    },
    // pencil stroke / ruler tap
    pencil(t0) {
      const r = Math.random();
      if (r < 0.4) noiseHit(t0, 0.045, 0.16, 3600, 0.8, 'highpass');        // stroke
      else if (r < 0.65) ping(t0, 950 + Math.random() * 300, 0.04, 0.07, 'triangle'); // ruler tap
    },
    // projector: soft mechanical chatter pair + faint fan already in bed
    projector(t0) {
      if (Math.random() > 0.6) return;
      noiseHit(t0, 0.03, 0.02, 1800, 2);
      noiseHit(t0 + 0.07, 0.025, 0.02, 1500, 2);
    },
    // kiln: sparse cooling ticks over the roar bed
    kiln(t0) {
      if (Math.random() > 0.35) return;
      ping(t0, 2000 + Math.random() * 2600, 0.028, 0.09, 'triangle');
    },
    // page turn: one slow noise sweep shortly after arrival
    pageturn(t0) {
      noiseHit(t0, 0.08, 0.5, 900, 0.7, 'bandpass', 3400);
    },
  };

  function scheduleEvents() {
    if (!ctx || !on) return;
    const sc = SCENES[Math.max(0, Math.min(SCENES.length - 1, lastChapter))];
    if (sc && sc.ev) EVENTS[sc.ev](ctx.currentTime + 0.05);
  }

  function toggle() {
    boot();
    if (ctx.state === 'suspended') ctx.resume();
    on = !on;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(on ? 0.9 : 0, ctx.currentTime + 0.6);
    if (on && !sceneTimer) sceneTimer = setInterval(scheduleEvents, 1400);
    if (!on && sceneTimer) { clearInterval(sceneTimer); sceneTimer = null; }
    return on;
  }

  // scroll depth opens the drone's filter: deeper = brighter (within scene base)
  function progress(pr) {
    if (!ctx || !on) return;
    const base = SCENES[Math.max(0, lastChapter)]?.drone ?? 200;
    droneFilter.frequency.setTargetAtTime(base + pr * 500, ctx.currentTime, 0.4);
  }

  // chapter settle: crossfade the scene, then a soft bell, pitch rising
  function chapter(i) {
    if (i === lastChapter) return;
    const first = lastChapter === -1;
    lastChapter = i;
    if (!ctx) return;
    const sc = SCENES[Math.max(0, Math.min(SCENES.length - 1, i))];
    const t = ctx.currentTime;
    droneGain.gain.setTargetAtTime(sc.droneLvl, t, 0.8);
    noiseGain.gain.setTargetAtTime(sc.noise, t, 1.0);
    noiseFilter.frequency.setTargetAtTime(sc.noiseHz, t, 1.0);
    humGain.gain.setTargetAtTime(sc.hum, t, 0.8);
    if (!on) return;
    // page turn fires once on arriving at S7
    if (sc.ev === 'pageturn' && !first) EVENTS.pageturn(t + 0.7);
    const base = 220 * Math.pow(1.26, i % 6);
    for (const [mult, amp, dur] of [[1, 0.14, 2.2], [2.01, 0.045, 1.4], [2.99, 0.018, 0.8]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(amp, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  // click burst: a breath of filtered noise
  function burst() {
    if (!ctx || !on) return;
    noiseHit(ctx.currentTime, 0.35, 0.5, 2400, 1.2, 'bandpass', 300);
  }

  return { toggle, progress, chapter, burst,
    get on() { return on; }, get state() { return ctx ? ctx.state : 'off'; } };
}
