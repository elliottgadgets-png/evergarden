/**
 * STUDIO — laptop 3D scene
 * A stylized laptop that opens with scroll progress to reveal a living
 * miniature website glowing inside its screen (recursion as proof of craft).
 *
 * API:
 *   import { init } from './laptop.js';
 *   const hero = init(containerElement, { quality: 'auto' | 'high' | 'low' });
 *   hero.frame(timeSeconds, progress01);        // call from your rAF loop
 *   hero.setPointer(nx, ny);                    // normalized -1..1, optional
 *   hero.dispose();
 *
 * Notes:
 *  - Transparent background (alpha) — composites over the site's grain/palette.
 *  - No network calls: everything procedural; only static import of three.
 *  - DPR-aware with adaptive step-down when frame time runs long.
 *  - Imports three via bare specifier 'three' — map it with an import map:
 *      <script type="importmap">
 *        {"imports":{"three":"./vendor/three.module.min.js"}}
 *      </script>
 */
import * as THREE from 'three';

const DPR_CAP = 2;
const LID_CLOSED = Math.PI / 2 - 0.045; // lid folded down onto the deck
const LID_OPEN = -0.30;                 // ~107° open, tilted slightly back

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInOut(x) { return x * x * (3 - 2 * x); }
function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function remap(x, a, b) { return clamp01((x - a) / (b - a)); }

/* ------------------------------------------------------------------ *
 *  The living miniature site drawn onto the laptop screen.
 *  A tiny generic business site: browser chrome, glowing hero,
 *  title, shimmering text bars and drifting particles. It scrolls
 *  with the same progress that opens the laptop — the site inside
 *  responds to the site outside.
 * ------------------------------------------------------------------ */
function createScreenCanvas() {
  const W = 640, H = 400;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // pre-built particle field for the mini site
  const motes = Array.from({ length: 42 }, (_, i) => ({
    x: (i * 97.13) % W,
    y: (i * 61.77) % H,
    r: 0.6 + ((i * 7) % 10) / 10 * 1.6,
    s: 6 + ((i * 13) % 10),       // drift speed
    p: (i * 0.37) % 1,            // phase
  }));

  function draw(t, progress, glow) {
    const scroll = easeInOut(progress) * 130; // mini page scrolls as you scroll

    // page background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d1512');
    bg.addColorStop(1, '#080d0b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(0, -scroll);

    // hero glow orb
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
    const gx = W / 2, gy = 150;
    const orb = ctx.createRadialGradient(gx, gy, 0, gx, gy, 150 + 30 * pulse);
    orb.addColorStop(0, `rgba(140, 245, 190, ${0.8 * glow})`);
    orb.addColorStop(0.35, `rgba(80, 190, 140, ${0.42 * glow})`);
    orb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, W, H + 200);

    // abstract brand-mark (brand-neutral while identity is decided)
    ctx.save();
    ctx.translate(gx, 148);
    ctx.strokeStyle = `rgba(236, 246, 240, ${0.95 * glow})`;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(236, 246, 240, ${0.95 * glow})`;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      const a = r * Math.PI / 2 + t * 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 36, Math.sin(a) * 36);
      ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
      ctx.stroke();
    }
    ctx.restore();
    const subShim = 0.5 + 0.5 * Math.sin(t * 1.8);
    ctx.fillStyle = `rgba(160, 205, 182, ${(0.35 + 0.3 * subShim) * glow})`;
    roundRect(ctx, gx - 70, 190, 140, 8, 4);
    ctx.fill();

    // mini nav links
    ctx.textAlign = 'center';
    ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
    const nav = ['עבודות', 'שירותים', 'אודות', 'צור קשר'];
    nav.forEach((n, i) => {
      ctx.fillStyle = `rgba(170, 215, 190, ${0.75 * glow})`;
      ctx.fillText(n, gx - 120 + i * 80, 62);
    });
    // CTA button
    const ctaPulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.fillStyle = `rgba(126, 231, 176, ${(0.85 + 0.15 * ctaPulse) * glow})`;
    roundRect(ctx, gx - 62, 210, 124, 26, 13);
    ctx.fill();
    ctx.fillStyle = `rgba(6, 14, 10, ${0.95 * glow})`;
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText('בואו נבנה', gx, 227);

    // shimmering text bars (fake content)
    for (let i = 0; i < 9; i++) {
      const y = 250 + i * 34;
      const wBars = 330 - (i % 3) * 55;
      const shimmer = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.1);
      ctx.fillStyle = `rgba(150, 210, 180, ${(0.22 + 0.22 * shimmer) * glow})`;
      roundRect(ctx, gx - wBars / 2, y, wBars, 9, 4.5);
      ctx.fill();
    }

    // mini cards row
    for (let c = 0; c < 3; c++) {
      const cw = 150, ch = 90, cx = gx - 1.5 * cw - 20 + c * (cw + 20), cy = 590;
      ctx.fillStyle = `rgba(24, 40, 32, ${0.95 * glow})`;
      roundRect(ctx, cx, cy, cw, ch, 10);
      ctx.fill();
      ctx.strokeStyle = `rgba(110, 190, 150, ${0.25 * glow})`;
      ctx.lineWidth = 1;
      roundRect(ctx, cx, cy, cw, ch, 10);
      ctx.stroke();
      const cardGlow = ctx.createRadialGradient(cx + cw / 2, cy + 34, 0, cx + cw / 2, cy + 34, 44);
      cardGlow.addColorStop(0, `rgba(126,231,176,${(0.45 + 0.25 * Math.sin(t * 1.8 + c * 2)) * glow})`);
      cardGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cardGlow;
      ctx.fillRect(cx, cy, cw, ch);
    }
    ctx.restore();

    // drifting motes (screen-space, above content)
    for (const m of motes) {
      const my = (m.y - t * m.s) % H;
      const yy = my < 0 ? my + H : my;
      const a = (0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + m.p * 9))) * glow;
      ctx.fillStyle = `rgba(150, 235, 190, ${a})`;
      ctx.beginPath();
      ctx.arc(m.x, yy, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // browser chrome (fixed on top)
    ctx.fillStyle = '#0d1412';
    ctx.fillRect(0, 0, W, 30);
    const dots = ['#e0705f', '#e0b25f', '#6fc97e'];
    dots.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(18 + i * 16, 15, 4.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#101a16';
    roundRect(ctx, 78, 8, W - 160, 14, 7); ctx.fill();
    ctx.fillStyle = 'rgba(150,200,175,0.75)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('your-site.co.il', 88, 18);
  }

  return { canvas, draw };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* keyboard deck texture: key grid + trackpad */
function createKeyboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#14181c'; x.fillRect(0, 0, 512, 256);
  // keys
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 14; col++) {
      const kw = 30, kh = 24, gap = 5;
      const kx = 22 + col * (kw + gap), ky = 18 + row * (kh + gap);
      const lift = ((row * 31 + col * 17) % 13) / 13;
      x.fillStyle = `rgb(${30 + lift * 10}, ${34 + lift * 10}, ${40 + lift * 12})`;
      roundRect(x, kx, ky, kw, kh, 4);
      x.fill();
    }
  }
  // spacebar
  x.fillStyle = '#232830';
  roundRect(x, 150, 162, 212, 22, 5); x.fill();
  // trackpad
  x.fillStyle = '#1b2026';
  roundRect(x, 181, 196, 150, 52, 8); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.05)';
  roundRect(x, 181, 196, 150, 52, 8); x.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* soft contact-shadow texture */
function createShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* tiny gradient environment for metallic reflections (one-time PMREM) */
function createEnvironment(renderer) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 16, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      void main(){
        float h = normalize(vP).y * 0.5 + 0.5;
        vec3 ground = vec3(0.02, 0.03, 0.03);
        vec3 horizon = vec3(0.10, 0.16, 0.13);
        vec3 zenith = vec3(0.30, 0.42, 0.38);
        vec3 col = h < 0.5 ? mix(ground, horizon, h * 2.0) : mix(horizon, zenith, (h - 0.5) * 2.0);
        // warm key light blob
        vec3 d = normalize(vP);
        float key = pow(max(dot(d, normalize(vec3(0.5, 0.8, 0.4))), 0.0), 24.0);
        col += vec3(1.0, 0.95, 0.85) * key * 2.2;
        float rim = pow(max(dot(d, normalize(vec3(-0.6, 0.3, -0.5))), 0.0), 16.0);
        col += vec3(0.4, 0.8, 0.6) * rim * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  geo.dispose(); mat.dispose();
  return envTex;
}

export function init(container, opts = {}) {
  const quality = opts.quality || 'auto';

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0); // transparent — site layers composite around it
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  if (quality === 'low') pixelRatio = Math.min(pixelRatio, 1.25);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = createEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 1.55, 6.4);

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x9fd8bc, 0x0a0d0c, 0.85));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.1);
  key.position.set(3, 5, 4);
  scene.add(key);
  const screenGlowLight = new THREE.PointLight(0x7ee7b0, 0, 5.5, 2);
  screenGlowLight.position.set(0, 1.2, 1.4);
  scene.add(screenGlowLight);

  /* ---------- laptop ---------- */
  const laptop = new THREE.Group();
  scene.add(laptop);

  const aluBody = new THREE.MeshStandardMaterial({
    color: 0x9aa2ab, metalness: 0.9, roughness: 0.34, envMapIntensity: 1.1,
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x14171b, metalness: 0.6, roughness: 0.5,
  });

  const BASE_W = 3.2, BASE_D = 2.15, BASE_H = 0.11;
  const base = new THREE.Mesh(new THREE.BoxGeometry(BASE_W, BASE_H, BASE_D), aluBody);
  base.position.y = BASE_H / 2;
  laptop.add(base);

  // keyboard deck inlay
  const kbTex = createKeyboardTexture();
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(BASE_W * 0.94, BASE_D * 0.9),
    new THREE.MeshStandardMaterial({ map: kbTex, metalness: 0.25, roughness: 0.75 })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, BASE_H + 0.001, -0.02);
  laptop.add(deck);

  // hinge barrel
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, BASE_W * 0.7, 20),
    darkTrim
  );
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, BASE_H, -BASE_D / 2 + 0.03);
  laptop.add(hinge);

  // lid (pivots at the hinge)
  const SCREEN_W = 3.06, SCREEN_H = 1.95, LID_T = 0.07;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, BASE_H, -BASE_D / 2 + 0.03);
  laptop.add(lidPivot);

  const lidShell = new THREE.Mesh(new THREE.BoxGeometry(SCREEN_W + 0.08, SCREEN_H + 0.08, LID_T), aluBody);
  lidShell.position.set(0, SCREEN_H / 2 + 0.02, -LID_T / 2);
  lidPivot.add(lidShell);

  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W + 0.02, SCREEN_H + 0.02), darkTrim);
  bezel.position.set(0, SCREEN_H / 2 + 0.02, 0.001);
  lidPivot.add(bezel);

  // the living screen
  const mini = createScreenCanvas();
  mini.draw(0, 0, 0);
  const screenTex = new THREE.CanvasTexture(mini.canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W * 0.94, SCREEN_H * 0.92), screenMat);
  screen.position.set(0, SCREEN_H / 2 + 0.02, 0.002);
  lidPivot.add(screen);

  // glowing emblem on the outside of the lid — the closed-laptop money shot
  const emblemCanvas = document.createElement('canvas');
  emblemCanvas.width = emblemCanvas.height = 256;
  const ectx = emblemCanvas.getContext('2d');
  ectx.shadowColor = '#7ee7b0'; ectx.shadowBlur = 34;
  ectx.strokeStyle = '#a9f5cd';
  ectx.lineWidth = 10;
  ectx.beginPath(); ectx.arc(128, 128, 52, 0, Math.PI * 2); ectx.stroke();
  ectx.fillStyle = '#a9f5cd';
  ectx.beginPath(); ectx.arc(128, 128, 16, 0, Math.PI * 2); ectx.fill();
  ectx.lineWidth = 6;
  for (let r = 0; r < 4; r++) {
    const a = r * Math.PI / 2 + Math.PI / 4;
    ectx.beginPath();
    ectx.moveTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70);
    ectx.lineTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
    ectx.stroke();
  }
  const emblemTex = new THREE.CanvasTexture(emblemCanvas);
  emblemTex.colorSpace = THREE.SRGBColorSpace;
  const emblemMat = new THREE.MeshBasicMaterial({
    map: emblemTex, transparent: true, toneMapped: false,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), emblemMat);
  emblem.rotation.y = Math.PI;
  emblem.rotation.z = Math.PI; // in-plane flip so the glyph reads upright from the front
  emblem.position.set(0, SCREEN_H / 2 + 0.02, -LID_T - 0.002);
  lidPivot.add(emblem);

  // screen glow halo (additive sprite behind/around the lid)
  const haloTex = createShadowTexture(); // radial gradient reused as glow shape
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, color: 0x53d69a, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(5.4, 3.6, 1);
  halo.position.set(0, SCREEN_H / 2 + 0.02, -0.15);
  lidPivot.add(halo);

  // soft contact shadow under laptop
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 4.4),
    new THREE.MeshBasicMaterial({ map: createShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.02;
  scene.add(shadow);

  /* ---------- ambient particles (light motes around the laptop) ---------- */
  const MOTES = quality === 'low' ? 90 : 240;
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(MOTES * 3);
  const seed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 7;
    pos[i * 3 + 1] = Math.random() * 3.4 - 0.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
    seed[i] = Math.random();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0 }, uPR: { value: pixelRatio } },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uPR;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.4 + aSeed * 40.0) * 0.18;
        p.x += sin(uTime * 0.23 + aSeed * 31.0) * 0.22;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 20.0);
        vA = tw;
        gl_PointSize = (1.5 + aSeed * 2.6) * uPR * tw * (4.5 / -mv.z);
      }`,
    fragmentShader: `
      varying float vA;
      uniform float uGlow;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vA * (0.15 + 0.5 * uGlow);
        gl_FragColor = vec4(0.55, 0.95, 0.72, a);
      }`,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  /* ---------- state ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let disposed = false;
  let lastT = 0;
  let emaDt = 16;
  let dprStep = 0;
  const DPR_STEPS = [Math.min(window.devicePixelRatio || 1, DPR_CAP), 1.5, 1.25, 1];

  let distScale = 1;
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // keep the laptop inside narrow (portrait/mobile) viewports
    distScale = camera.aspect >= 1.05 ? 1 : Math.min(2.1, 1.05 / camera.aspect * 1.08);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container);
  else window.addEventListener('resize', resize);

  function frame(t, progress01) {
    if (disposed) return;
    const p = clamp01(progress01 || 0);
    const dt = lastT ? Math.min(100, (t - lastT) * 1000) : 16;
    lastT = t;

    // adaptive DPR: if frames run long, step down (only in auto quality)
    emaDt = emaDt * 0.95 + dt * 0.05;
    if (quality === 'auto' && emaDt > 24 && dprStep < DPR_STEPS.length - 1) {
      dprStep++;
      renderer.setPixelRatio(DPR_STEPS[dprStep]);
      pMat.uniforms.uPR.value = DPR_STEPS[dprStep];
      emaDt = 16;
      resize();
    }

    // pointer easing
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // lid opening: spans most of the scroll, smooth both ends
    const open = easeInOut(remap(p, 0.08, 0.85));
    lidPivot.rotation.x = THREE.MathUtils.lerp(LID_CLOSED, LID_OPEN, open);

    // screen life: brightness ramps in as the lid passes ~35°
    const glow = easeInOut(remap(p, 0.2, 0.8));
    screenMat.color.setScalar(0.15 + 0.85 * glow);
    haloMat.opacity = 0.45 * glow;
    screenGlowLight.intensity = 2.8 * glow;
    // emblem glows while closed, fades as the screen takes over
    emblemMat.opacity = (0.55 + 0.35 * Math.sin(t * 1.6)) * (1 - easeInOut(remap(p, 0.15, 0.5)));

    // redraw the living mini site (throttled to ~30fps — cheap canvas)
    if (!frame._lastMini || t - frame._lastMini > 0.033 || Math.abs((frame._lastP ?? -1) - p) > 0.002) {
      mini.draw(t, p, Math.max(glow, 0.25));
      screenTex.needsUpdate = true;
      frame._lastMini = t;
      frame._lastP = p;
    }

    // choreography: closed laptop presented at a 3/4 angle, rotating to
    // face the viewer as it opens; gentle float once alive
    const turn = easeInOut(remap(p, 0.0, 0.55));
    const float = Math.sin(t * 0.9) * 0.035 * (0.4 + 0.6 * glow);
    laptop.position.y = 0.14 + float + 0.24 * easeInOut(remap(p, 0.1, 0.6));
    laptop.rotation.y = THREE.MathUtils.lerp(0.45, 0, turn) + pointer.x * 0.10 + Math.sin(t * 0.22) * 0.02;
    laptop.rotation.x = THREE.MathUtils.lerp(0.42, 0, turn) + pointer.y * 0.045;

    camera.position.z = THREE.MathUtils.lerp(6.1, 5.0, easeInOut(remap(p, 0.25, 1))) * distScale;
    camera.position.y = THREE.MathUtils.lerp(2.3, 1.2, easeInOut(remap(p, 0.15, 1)));
    camera.position.x = THREE.MathUtils.lerp(0.5, 0, turn) + pointer.x * 0.22;
    camera.lookAt(0, 0.55 + 0.35 * glow, 0);

    // debug hook (test harness only): window.__camOverride = [x,y,z, tx,ty,tz]
    if (typeof window !== 'undefined' && window.__camOverride) {
      const c = window.__camOverride;
      camera.position.set(c[0], c[1], c[2]);
      camera.lookAt(c[3] || 0, c[4] ?? 0.6, c[5] || 0);
    }

    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uGlow.value = glow;

    renderer.render(scene, camera);
  }

  return {
    frame,
    __camera: camera, // debug hook for the test harness
    setPointer(nx, ny) {
      pointer.tx = clamp01((nx + 1) / 2) * 2 - 1;
      pointer.ty = clamp01((ny + 1) / 2) * 2 - 1;
    },
    dispose() {
      disposed = true;
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); });
        }
      });
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}
