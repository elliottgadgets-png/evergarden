/**
 * evergarden-hero-particles — S1 hero: raw-material vortex morphing into the
 * armature target (blueprint v4.0 «בנייה חיה בסדנה», scroll-scrubbed).
 *
 * Contract (matches studio spec):
 *   import { init } from './src/evergarden-hero-particles.js';
 *   const fx = init(container, { quality: 'auto' });
 *   fx.frame(tSeconds, progress01);   // every rAF; progress01 = S1-local scroll progress
 *   fx.dispose();                     // full GPU/DOM teardown
 *
 * progress01 mapping (S1-local):
 *   0.00–0.20  raw vortex (material swirling, unformed)
 *   0.20–0.85  morph: particles condense onto the armature target
 *   0.85–1.00  armature holds; ember shimmer on the formed frame
 *
 * Options:
 *   quality   'auto' | 'high' | 'low'   auto: ~140k desktop / ~48k mobile
 *   count     explicit particle count (overrides quality)
 *   targetUrl target PNG (RGB=XYZ -1..1, A=255 occupied). Default: ../targets/s1-armature.png
 *   ember     THREE-compatible hex for sparks   (default v4.0 #E8862E)
 *   steel     hex for secondary filings         (default v4.0 #7C8DA6)
 *   onReady   called when the target texture is decoded and live
 *
 * S7 extensions (commission book + seal ring, calm breathing):
 *   motion    'vortex' (S1 default) | 'breathe' (S7: slow drift + breath pulse)
 *   targets   array of {url, x, y, scale} — composite layout; supersedes targetUrl.
 *             Default S7 set: book center-left, seal right (AD-tunable).
 *   sequence  true: morph target1 -> target2 over progress instead of composite
 *
 * Transparent background, DPR-aware, no network outside its own target asset.
 */
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute vec3 aSeed;     // per-particle random seed 0..1
  attribute vec3 aTarget;   // morph target position (-1..1 target space)
  attribute vec3 aTarget2;  // second target (sequence mode)
  attribute vec3 aTint;     // per-target tint (composite layout)
  attribute float aTintW;   // tint weight 0/1
  attribute float aSize;    // per-particle size factor
  uniform float uTime, uMorph, uMorph2, uPixelRatio, uAspect, uHold, uBreathe, uSpark, uVortexMix;
  varying float vSpark;     // 0..1 ember-ness
  varying float vFade;
  varying vec3 vTint;
  varying float vTintW;

  // cheap hash noise
  float h1(float n){ return fract(sin(n)*43758.5453123); }

  void main(){
    vec3 s = aSeed;

    /* --- base motion --- */
    vec3 field;
    // S0 flint strike: all material collapses to one ember point, bursts into a spiral
    float b = uSpark;
    float bDist = b * (0.22 + 1.3*s.x);
    float bang  = s.z*6.2831853 + b*(1.5 + 3.0*s.x) + uTime*0.45*b;
    vec3 sparkField = vec3(0.0, -0.18, 0.0) + vec3(
      cos(bang)*bDist*uAspect,
      (sin(bang*0.8)*0.5 + 0.5)*bDist*0.45 + (s.y-0.5)*b*1.15,
      sin(bang)*bDist);
    {
    float baseR  = 0.25 + 1.05 * s.x;                    // orbit radius
    float wob    = sin(uTime*0.6 + s.y*41.0)*0.05;
    float r      = baseR + wob;
    float speed  = (0.25 + 0.55*s.y) / (0.35 + baseR);   // inner orbits faster
    float ang    = s.z*6.2831853 + uTime*speed;
    float lift   = sin(uTime*0.35 + s.x*17.0)*0.18*(1.0-s.x*0.5);
    vec3 vortex  = vec3(cos(ang)*r*uAspect, lift + (s.y-0.5)*0.9, sin(ang)*r);

    // slow inward draw while raw: radius breathes toward center
    vortex.xy *= 0.92 + 0.08*sin(uTime*0.22 + s.z*9.0);

    // S7 breathe: near-still drifting motes, slow settle
    vec3 drift = vec3(
      (s.x-0.5)*2.4*uAspect + sin(uTime*0.10 + s.y*23.0)*0.08,
      (s.y-0.5)*1.5 + sin(uTime*0.07 + s.x*19.0)*0.06 - uTime*0.006*(0.3+s.z),
      (s.z-0.5)*0.8);
    vec3 rest = mix(vortex, drift, uBreathe);
    field = mix(sparkField, rest, uVortexMix);
    }

    /* --- morph --- */
    float m = uMorph;
    // per-particle stagger so the form "gathers" instead of crossfading
    float stag = smoothstep(0.0, 1.0, clamp((m*1.35 - s.z*0.35), 0.0, 1.0));
    vec3 pos = mix(field, aTarget*vec3(min(uAspect,1.6),1.0,1.0)*0.86, stag);
    // sequence phase 2: gathered form reforms into the second target
    float m2 = uMorph2;
    float stag2 = smoothstep(0.0, 1.0, clamp((m2*1.35 - s.x*0.35), 0.0, 1.0));
    pos = mix(pos, aTarget2*vec3(min(uAspect,1.6),1.0,1.0)*0.86, stag2);

    // micro-jitter on the formed frame: heat shimmer (S1) / breath (S7)
    float shim = mix(uHold * 0.006, (0.004 + 0.006*sin(uTime*0.8 + s.y*6.283)) * max(stag, stag2), uBreathe);
    pos += shim * vec3(
      sin(uTime*3.1 + s.x*80.0),
      cos(uTime*2.7 + s.y*80.0),
      sin(uTime*2.3 + s.z*80.0));

    vTint = aTint; vTintW = aTintW;
    float flash = (1.0-uVortexMix) * (1.0 - smoothstep(0.0, 0.22, uSpark)) * 1.6;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = -mv.z;
    gl_PointSize = aSize * uPixelRatio * (2.2 + 1.6*stag) * (1.0 + flash*2.5) / max(dist, 0.35);

    // ember spark: few particles, twinkle; denser while raw, shimmer when held
    float emberNess = step(0.86, s.y);
    float tw = 0.55 + 0.45*sin(uTime*(2.0+4.0*s.x) + s.z*40.0);
    float holdGlow = uHold * (0.35 + 0.65*tw);
    vSpark = clamp(emberNess * tw * mix(1.0, uHold*0.9 + 0.25, stag) + holdGlow*step(0.55, s.x) + flash, 0.0, 1.0);
    vFade  = 1.0 - smoothstep(6.0, 9.0, dist);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uEmber, uSteel;
  varying float vSpark;
  varying float vFade;
  varying vec3 vTint;
  varying float vTintW;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.12, length(d));
    if (a < 0.01) discard;
    vec3 col = mix(uSteel, uEmber, clamp(vSpark, 0.0, 1.0));
    col = mix(col, vTint * (0.8 + 0.4*vSpark), vTintW);
    col *= 0.75 + 0.5*vSpark;                       // embers run hotter
    gl_FragColor = vec4(col, a * vFade * (0.55 + 0.45*vSpark));
    #include <colorspace_fragment>
  }
`;

function decodeTarget(url, count) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      const occ = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 127) {
          occ.push(
            (data[i]     / 255) * 2 - 1,
            (data[i + 1] / 255) * 2 - 1,
            (data[i + 2] / 255) * 2 - 1);
        }
      }
      if (!occ.length) { reject(new Error('target texture has no occupied texels')); return; }
      const out = new Float32Array(count * 3);
      const nPts = occ.length / 3;
      for (let i = 0; i < count; i++) {
        // tile the cloud; target texture already carries the jitter
        const p = (i % nPts) * 3;
        out[i * 3]     = occ[p];
        out[i * 3 + 1] = occ[p + 1];
        out[i * 3 + 2] = occ[p + 2];
      }
      resolve(out);
    };
    img.onerror = () => reject(new Error('failed to load target texture: ' + url));
    img.src = url;
  });
}

export function init(container, opts = {}) {
  const quality = opts.quality || 'auto';
  const small = Math.min(container.clientWidth || innerWidth, container.clientHeight || innerHeight) < 720
    || /Mobi|Android/i.test(navigator.userAgent);
  const count = opts.count
    || (quality === 'high' ? 200000 : quality === 'low' ? 40000 : (small ? 48000 : 140000));

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  camera.position.set(0, 0, 3.1);

  const seeds = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
    sizes[i] = 0.7 + Math.random() * 1.3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)); // unused, required
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  // placeholder target attribute: particles hold vortex until the decode lands
  const targetAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  geo.setAttribute('aTarget', targetAttr);
  const target2Attr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  geo.setAttribute('aTarget2', target2Attr);
  const tintAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  geo.setAttribute('aTint', tintAttr);
  const tintWAttr = new THREE.BufferAttribute(new Float32Array(count), 1);
  geo.setAttribute('aTintW', tintWAttr);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const initState = opts.initialState || null;
  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uMorph2: { value: 0 },
    uHold: { value: 0 },
    uBreathe: { value: opts.motion === 'breathe' ? 1 : 0 },
    uSpark: { value: initState ? initState.spark || 0 : 0 },
    uVortexMix: { value: initState ? initState.vortexMix : (opts.motion === 'spark' ? 0 : 1) },
    uPixelRatio: { value: 1 },
    uAspect: { value: 1 },
    uEmber: { value: new THREE.Color(opts.ember ?? 0xE8862E) },
    uSteel: { value: new THREE.Color(opts.steel ?? 0x7C8DA6) },
  };

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  /* target decode (async; morph stays clamped at vortex until ready) */
  let targetReady = false;
  const base = import.meta.url;
  const targets = opts.targets || [
    { url: opts.targetUrl || new URL('../targets/s1-armature.png', base).href },
  ];
  const applyLayout = (buf, layout, nPtsHint) => {
    if (!layout) return buf;
    const { x = 0, y = 0, scale = 1 } = layout;
    for (let i = 0; i < buf.length; i += 3) {
      buf[i] = buf[i] * scale + x;
      buf[i + 1] = buf[i + 1] * scale + y;
    }
    return buf;
  };
  if (opts.sequence && targets.length > 1) {
    // sequence: one target per phase
    Promise.all(targets.slice(0, 2).map((t) => decodeTarget(t.url, count))).then(([b1, b2]) => {
      targetAttr.array.set(applyLayout(b1, targets[0])); targetAttr.needsUpdate = true;
      target2Attr.array.set(applyLayout(b2, targets[1])); target2Attr.needsUpdate = true;
      targetReady = true;
      opts.onReady && opts.onReady();
    }).catch((e) => { console.error('[hero-particles]', e.message); });
  } else {
    // composite: split the particle field across all targets
    const splits = targets.map((t, i) => Math.floor(count / targets.length) + (i === 0 ? count % targets.length : 0));
    Promise.all(targets.map((t, i) => decodeTarget(t.url, splits[i]))).then((bufs) => {
      const out = targetAttr.array;
      let off = 0;
      bufs.forEach((b, i) => {
        out.set(applyLayout(b, targets[i]), off);
        if (targets[i].tint != null) {
          const c = new THREE.Color(targets[i].tint); // linear working space
          const n = b.length / 3, base = off / 3;
          for (let j = 0; j < n; j++) {
            tintAttr.array[(base + j) * 3] = c.r;
            tintAttr.array[(base + j) * 3 + 1] = c.g;
            tintAttr.array[(base + j) * 3 + 2] = c.b;
            tintWAttr.array[base + j] = 1;
          }
          tintAttr.needsUpdate = true; tintWAttr.needsUpdate = true;
        }
        off += b.length;
      });
      targetAttr.needsUpdate = true;
      targetReady = true;
      opts.onReady && opts.onReady();
    }).catch((e) => { console.error('[hero-particles]', e.message); });
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    const dpr = Math.min(devicePixelRatio || 1, quality === 'low' ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = dpr;
    uniforms.uAspect.value = w / h;
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function smooth(a, b, x) { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }

  let sparkMode = opts.motion === 'spark';
  let mixAnim = null;
  const MOTION_MIX = { spark: 0, vortex: 1, breathe: 1 };

  return {
    get targetReady() { return targetReady; },
    // crossfade the base motion (spark -> vortex at the S0->S1 handoff); no cut, same instance
    setMotionMode(mode, blendSecs = 1.2) {
      if (!(mode in MOTION_MIX)) return;
      sparkMode = mode === 'spark';
      uniforms.uBreathe.value = mode === 'breathe' ? 1 : (mode === 'spark' ? uniforms.uBreathe.value : 0);
      mixAnim = { from: uniforms.uVortexMix.value, to: MOTION_MIX[mode], t0: uniforms.uTime.value, dur: Math.max(blendSecs, 0.01) };
    },
    // uniform state for cut-free handoff when the AD wires S0 and S1 as separate instances
    getState() {
      return {
        motion: sparkMode ? 'spark' : (uniforms.uBreathe.value > 0.5 ? 'breathe' : 'vortex'),
        vortexMix: uniforms.uVortexMix.value,
        spark: uniforms.uSpark.value,
        t: uniforms.uTime.value,
      };
    },
    frame(t, progress01 = 0) {
      const p = Math.min(Math.max(progress01, 0), 1);
      uniforms.uTime.value = t;
      // motion-mode tween (setMotionMode)
      if (mixAnim) {
        const k = Math.min((t - mixAnim.t0) / mixAnim.dur, 1);
        uniforms.uVortexMix.value = mixAnim.from + (mixAnim.to - mixAnim.from) * (k*k*(3-2*k));
        if (k >= 1) mixAnim = null;
      }
      if (sparkMode) {
        uniforms.uSpark.value = smooth(0.02, 0.75, p);
      } else if (uniforms.uBreathe.value > 0.5) {
        // S7: gather 0.10..0.60 (sequence: phase2 0.55..0.95), then calm hold
        uniforms.uMorph.value = targetReady ? smooth(0.10, 0.60, p) : 0;
        uniforms.uMorph2.value = (opts.sequence && targetReady) ? smooth(0.55, 0.95, p) : 0;
        uniforms.uHold.value = smooth(0.60, 0.90, p);
      } else {
        // S1: morph window 0.20..0.85; hold shimmer above 0.85
        const m = smooth(0.20, 0.85, p);
        uniforms.uMorph.value = targetReady ? m : 0;
        uniforms.uMorph2.value = 0;
        uniforms.uHold.value = smooth(0.85, 0.98, p);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      ro.disconnect();
      scene.remove(points);
      geo.dispose(); mat.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
