// world.js — v5.0 «המסע» (the journey). ONE continuous world, not vignettes:
// the camera travels a single path through a landscape that builds itself as
// you scroll — void → terrain rises → molten veins → canyon walls → kiln sun
// on the horizon → the gate. Chapters are stretches of the road, not scenes.
// Content stays in DOM; the world is WebGL. Built on the vendored three.js.

import * as THREE from 'three';
import { makeCrucible, makeNiche, makeBookSealStand } from './props.js';

const NOISE = /* glsl */`
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){
  float v=0.0,a=0.5;
  for(int i=0;i<4;i++){v+=a*snoise(p);p*=2.03;a*=0.5;}
  return v;
}
float ridged(vec2 p){
  float v=0.0,a=0.55;
  for(int i=0;i<4;i++){v+=a*(1.0-abs(snoise(p)));p*=2.13;a*=0.52;}
  return v;
}`;

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0x14100c, 0.0018);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 2600);

  /* ---------- the road the camera travels ---------- */
  const WAY = [
    [0, 15, 80], [34, 14, -140], [-44, 16, -380], [30, 13, -640],
    [-34, 15, -900], [30, 14, -1180], [-18, 16, -1480], [12, 18, -1780], [0, 22, -2060], [0, 20, -2305],
  ];
  const curve = new THREE.CatmullRomCurve3(WAY.map(p => new THREE.Vector3(...p)), false, 'centripetal', 0.6);
  // per-keyframe FOV along the same parameter (wide on travel beats, tight on arrivals)
  const FOVS = [52, 58, 55, 50, 56, 52, 58, 50, 46, 42];
  function fovAt(t) {
    const x = Math.min(0.999, Math.max(0, t)) * (FOVS.length - 1);
    const i = Math.floor(x), f = x - i;
    return FOVS[i] + (FOVS[Math.min(FOVS.length - 1, i + 1)] - FOVS[i]) * f;
  }

  /* ---------- terrain: builds itself with scroll ---------- */
  const tUni = {
    uTime:  { value: 0 },
    uBuild: { value: 0 },     // 0 flat void → 1 full relief
    uVeins: { value: 0 },     // molten cracks glow
    uSun:   { value: 0 },     // kiln-sun warmth on the ridge line
    uFogColor:   { value: new THREE.Color(0x14100c) },
    uFogDensity: { value: 0.0018 },
  };
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 3200, 150, 260),
    new THREE.ShaderMaterial({
      uniforms: tUni,
      vertexShader: NOISE + /* glsl */`
        uniform float uTime; uniform float uBuild;
        varying float vH; varying vec2 vXZ; varying float vFogDepth;
        void main(){
          vec3 pos = position;
          vec2 xz = vec2(pos.x, -pos.y); // plane is rotated; use world-ish coords
          float hills = fbm(xz * 0.0035);
          float detail = fbm(xz * 0.021 + 7.3);
          float peaks = ridged(xz * 0.0016 + 11.7);
          // far from the road the land rears up into real ranges
          float corridor = smoothstep(14.0, 150.0, abs(xz.x));
          float peakMask = smoothstep(90.0, 420.0, abs(xz.x));
          float h = hills * 46.0 + detail * 7.0 + pow(peaks, 1.9) * 210.0 * peakMask;
          h *= mix(0.06, 1.0, corridor);
          h *= uBuild;
          pos.z += h;
          vH = h; vXZ = xz;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: NOISE + /* glsl */`
        uniform float uTime; uniform float uVeins; uniform float uSun;
        uniform vec3 uFogColor; uniform float uFogDensity;
        varying float vH; varying vec2 vXZ; varying float vFogDepth;
        void main(){
          float hn = clamp(vH / 160.0, 0.0, 1.0);
          vec3 base = mix(vec3(0.07,0.058,0.048), vec3(0.24,0.21,0.18), smoothstep(0.0,0.35,hn)); // valley floor → rock
          base = mix(base, vec3(0.38,0.335,0.28), smoothstep(0.45,0.9,hn));      // high ash ridges
          base *= 0.5 + 0.5 * smoothstep(0.0, 0.5, hn);                          // valley shade
          // molten veins: ridged noise cracks, ember-lit
          float v = 1.0 - abs(snoise(vXZ * 0.0075 + 3.1));
          v = smoothstep(0.885, 0.99, v) + 0.7 * smoothstep(0.94, 1.0, 1.0 - abs(snoise(vXZ * 0.02)));
          float pulse = 0.75 + 0.25 * sin(uTime * 1.4 + vXZ.x * 0.02 + vXZ.y * 0.013);
          vec3 ember = vec3(0.91, 0.52, 0.18);
          vec3 col = base + ember * (v * uVeins * pulse * 1.9 + uVeins * 0.05);
          // kiln-sun warmth kissing the far ridge tops
          col += vec3(0.85, 0.5, 0.2) * pow(hn, 2.0) * uSun * 0.35;
          float f = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
          col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(0, 0, -1000);
  scene.add(terrain);

  /* ---------- the lit path under the camera ---------- */
  const pathUni = {
    uReveal: { value: 0 },
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0x14100c) },
    uFogDensity: { value: 0.0018 },
  };
  {
    const pts = curve.getSpacedPoints(360);
    const posArr = new Float32Array((pts.length) * 2 * 3);
    const tArr = new Float32Array((pts.length) * 2);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], n = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)];
      const dir = new THREE.Vector3().subVectors(n, pr).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(4.2);
      posArr.set([p.x - side.x, 1.4, p.z - side.z], i * 6);
      posArr.set([p.x + side.x, 1.4, p.z + side.z], i * 6 + 3);
      tArr[i * 2] = tArr[i * 2 + 1] = i / (pts.length - 1);
    }
    const idx = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(tArr, 1));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: pathUni, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        attribute float aT; varying float vT; varying float vFogDepth;
        void main(){ vT = aT; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`
        uniform float uReveal; uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity;
        varying float vT; varying float vFogDepth;
        void main(){
          float head = smoothstep(vT, vT + 0.02, uReveal);       // lit only behind the traveller
          if (head < 0.01) discard;
          float glow = 0.5 + 0.5 * sin(uTime * 2.2 - vT * 90.0); // slow ember shimmer
          vec3 col = mix(vec3(0.91,0.52,0.18), vec3(1.0,0.78,0.42), glow * 0.4);
          float f = 1.0 - exp(-uFogDensity*uFogDensity*vFogDepth*vFogDepth);
          col = mix(col, uFogColor, clamp(f,0.0,1.0));
          gl_FragColor = vec4(col, head * 0.55);
        }`,
    });
    scene.add(new THREE.Mesh(g, m));
  }

  /* ---------- ember field ---------- */
  let embers;
  {
    const N = 900;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 500;
      pos[i * 3 + 1] = Math.random() * 120;
      pos[i * 3 + 2] = 120 - Math.random() * 2400;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const uni = { uTime: { value: 0 } };
    embers = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aSeed; uniform float uTime; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + uTime * (2.0 + aSeed * 4.0), 130.0);
          p.x += sin(uTime * 0.4 + aSeed * 40.0) * 6.0;
          vA = 0.25 + 0.75 * fract(aSeed * 7.31 + uTime * 0.11);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.5 + aSeed * 2.8) * (140.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(0.95, 0.6, 0.25, (1.0 - d * 2.0) * vA * 0.7);
        }`,
    }));
    scene.add(embers);
  }

  /* ---------- atmosphere dome ---------- */
  const skyUni = {
    uSunDir: { value: new THREE.Vector3(0, 0.02, -1).normalize() },
    uSun: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2350, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uSunDir; uniform float uSun; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.08, 1.0);
          vec3 zen = vec3(0.030, 0.024, 0.020);
          vec3 hor = vec3(0.105, 0.075, 0.048);
          vec3 col = mix(hor, zen, pow(max(h, 0.0), 0.55));
          float sunward = pow(max(dot(normalize(vDir), uSunDir), 0.0), 5.0);
          col += vec3(0.85, 0.46, 0.16) * sunward * (0.12 + uSun * 0.85);
          col += vec3(0.45, 0.24, 0.09) * pow(max(dot(normalize(vDir), uSunDir), 0.0), 1.6) * uSun * 0.22;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(sky);

  /* ---------- kiln sun on the horizon ---------- */
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(130, 40, 40),
    new THREE.MeshBasicMaterial({ color: 0xE8862E, fog: false, transparent: true, opacity: 0, toneMapped: false })
  );
  sun.position.set(0, -220, -2750);
  scene.add(sun);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,190,110,.9)'); gr.addColorStop(0.35, 'rgba(232,134,46,.38)');
    gr.addColorStop(1, 'rgba(232,134,46,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  }));
  sunGlow.scale.set(560, 560, 1);
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  /* ---------- the gate (S7) ---------- */
  const gate = new THREE.Group();
  const monoMat = new THREE.MeshBasicMaterial({ color: 0x241d16, fog: true });
  for (const sx of [-24, 24]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(9, 150, 9), monoMat);
    m.position.set(sx, 75, 0);
    gate.add(m);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(57, 9, 9), monoMat);
  lintel.position.set(0, 146, 0);
  gate.add(lintel);
  const doorMat = new THREE.MeshBasicMaterial({ color: 0xF4C56B, fog: false, transparent: true, opacity: 0, toneMapped: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(34, 132), doorMat);
  door.position.set(0, 68, 0);
  gate.add(door);
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  }));
  doorGlow.scale.set(300, 340, 1); doorGlow.position.set(0, 70, 6);
  gate.add(doorGlow);
  gate.position.set(0, 0, -2380);
  scene.add(gate);


  /* ---------- authored props (builder factories, re-materialized into the landscape) ---------- */
  // scene has no global lights by design (shader world); each prop carries its own case-light.
  const propsUpdaters = [];
  const texLoader = new THREE.TextureLoader();

  // S2 close: the crucible mid-pour beside the road — where the molten veins come from
  const crucible = makeCrucible();
  {
    const cp = curve.getPointAt(0.285);
    crucible.scale.setScalar(12);
    crucible.position.set(cp.x + 12, 0, cp.z - 4);
    crucible.rotation.y = 0.5;
    scene.add(crucible);
    const pourLight = new THREE.PointLight(0xE8862E, 900, 90, 2);
    pourLight.position.set(cp.x + 12, 16, cp.z);
    scene.add(pourLight);
    propsUpdaters.push((t, pr, pq) => {
      const ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - 0.268) / 0.06));
      crucible.userData.update(t, ph);
      pourLight.intensity = 400 + ph * 1200;
    });
  }

  // S4: three lit niches set into the canyon wall, each holding a finished piece
  const nicheShots = ['assets/work-videoeditor.jpg', 'assets/work-verdant.jpg', 'assets/work-soshimi.jpg'];
  nicheShots.forEach((src, i) => {
    const niche = makeNiche(1.6, 1.05);
    const nt = 0.55 + i * 0.05;
    const np = curve.getPointAt(nt);
    const side = i % 2 === 0 ? 1 : -1;
    niche.scale.setScalar(8);
    niche.position.set(np.x + side * 24, np.y + 15, np.z);
    niche.lookAt(np.x * 0.85, np.y + 8, np.z + 140); niche.rotateY(Math.PI);
    scene.add(niche);
    texLoader.load(src, (tex) => niche.userData.setImage(tex));
    const caseLight = new THREE.PointLight(0xFFD28A, 500, 70, 2);
    caseLight.position.set(np.x + side * 17, np.y + 20, np.z + 20);
    scene.add(caseLight);
    propsUpdaters.push((t, pr, pq) => {
      const ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - nt) / 0.045));
      niche.userData.update(t, ph);
      caseLight.intensity = 200 + ph * 800;
    });
  });

  // S7: the commission book + maker's seal on a plinth before the doorway — one frame with the CTA
  const stand = makeBookSealStand();
  stand.scale.setScalar(10);
  stand.position.set(10, 0, -2344);
  stand.rotation.y = -0.35;
  scene.add(stand);
  const book = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 3.1),
    new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.6 }));
  scene.add(book);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0xE8862E, emissive: 0xE8862E, emissiveIntensity: 0.55, roughness: 0.4 }));
  scene.add(seal);
  {
    // place book + seal on the stand's anchor points (world space)
    stand.updateMatrixWorld(true);
    const bA = stand.localToWorld(stand.userData.bookAnchor.clone());
    const sA = stand.localToWorld(stand.userData.sealAnchor.clone());
    book.position.copy(bA); book.position.y += 0.35; book.rotation.y = -0.35 + 0.2;
    seal.position.copy(sA); seal.position.y += 0.25; seal.rotation.y = -0.35;
    const plinthLight = new THREE.PointLight(0xFFD28A, 700, 90, 2);
    plinthLight.position.set(7, 16, -2336);
    scene.add(plinthLight);
    propsUpdaters.push((t, pr) => {
      const ph = Math.min(1, Math.max(0, (pr - 0.88) / 0.10));
      seal.material.emissiveIntensity = 0.25 + ph * 0.6 + Math.sin(t * 1.7) * 0.08 * ph;
    });
  }

  /* ---------- authored silhouettes: spires that thicken into the canyon ---------- */
  const spireMat = new THREE.MeshBasicMaterial({ color: 0x0e0a07, fog: true });
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 22; i++) {
    const st = 0.08 + (i / 22) * 0.86 + rnd() * 0.02;
    const sp = curve.getPointAt(Math.min(0.98, st));
    const side = rnd() > 0.5 ? 1 : -1;
    const canyon = st > 0.32 && st < 0.60; // S3-S4: walls close in
    const dist = canyon ? 34 + rnd() * 30 : 55 + rnd() * 70;
    const h = canyon ? 70 + rnd() * 90 : 18 + rnd() * 45;
    const r = 4 + rnd() * (canyon ? 10 : 7);
    const geo = new THREE.ConeGeometry(r, h, 5 + Math.floor(rnd() * 3));
    // irregular silhouette: jitter the cone's ring vertices
    const posA = geo.attributes.position;
    for (let v = 0; v < posA.count; v++) {
      posA.setX(v, posA.getX(v) * (0.82 + rnd() * 0.4));
      posA.setZ(v, posA.getZ(v) * (0.82 + rnd() * 0.4));
    }
    geo.computeVertexNormals();
    const spire = new THREE.Mesh(geo, spireMat);
    spire.position.set(sp.x + side * dist, h * 0.32, sp.z + (rnd() - 0.5) * 60);
    spire.rotation.y = rnd() * Math.PI;
    scene.add(spire);
  }

  /* ---------- drive ---------- */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // station remap (camera-path spec v1.0 windows): dwell at stations, travel between
  const REMAP = [[0,0],[0.04,0.012],[0.20,1/6],[0.34,2/6],[0.46,3/6],[0.56,4/6],[0.70,5/6],[0.74,5/6+0.004],[0.88,0.93],[1,1]];
  function pathT(pr) {
    for (let i = 1; i < REMAP.length; i++) {
      if (pr <= REMAP[i][0]) {
        const [p0, q0] = REMAP[i - 1], [p1, q1] = REMAP[i];
        return q0 + (q1 - q0) * ((pr - p0) / Math.max(1e-6, p1 - p0));
      }
    }
    return 1;
  }
  let prS = 0;
  function frame(tms, pr) {
    const t = tms * 0.001;
    if (window.__egSnapWorld) { prS = pr; window.__egSnapWorld = false; }
    prS += (pr - prS) * 0.12;
    tUni.uTime.value = t; pathUni.uTime.value = t;
    tUni.uBuild.value = smooth(0.0, 0.30, prS);
    tUni.uVeins.value = smooth(0.10, 0.26, prS) * (1.0 - smooth(0.58, 0.78, prS) * 0.8);
    tUni.uSun.value = smooth(0.52, 0.80, prS);
    skyUni.uSun.value = tUni.uSun.value;
    sky.position.copy(camera.position);
    pathUni.uReveal.value = prS * 1.02;

    const sunRise = smooth(0.52, 0.86, prS);
    sun.position.y = -220 + sunRise * 330;
    sun.material.opacity = smooth(0.50, 0.72, prS);
    sunGlow.material.opacity = smooth(0.55, 0.85, prS) * 0.5;
    sunGlow.position.copy(sun.position);
    scene.fog.density = 0.0018 - sunRise * 0.0006;
    tUni.uFogDensity.value = scene.fog.density;
    pathUni.uFogDensity.value = scene.fog.density;

    const gateIn = smooth(0.84, 0.97, prS);
    doorMat.opacity = gateIn * 0.8;
    doorGlow.material.opacity = gateIn * 0.4;

    const warm = smooth(0.45, 0.85, prS);
    scene.fog.color.setRGB(0.078 + warm * 0.05, 0.063 + warm * 0.012, 0.047);
    tUni.uFogColor.value.copy(scene.fog.color); pathUni.uFogColor.value.copy(scene.fog.color);

    const pq = Math.min(0.999, pathT(prS));
    for (const u of propsUpdaters) u(t, prS, pq);
    window.__stationCf = pq * 6;
    const scrollMoving = Math.abs(pr - (frame._lastPr ?? pr)) > 1e-5;
    frame._lastPr = pr;
    const pos = curve.getPointAt(pq);
    const ahead = curve.getPointAt(Math.min(1, pq + 0.045));
    if (ahead.distanceTo(pos) < 40) {
      const tan = curve.getTangentAt(Math.min(0.999, pq));
      ahead.set(pos.x + tan.x * 100, pos.y + tan.y * 100, pos.z + tan.z * 100);
    }
    camera.position.set(
      pos.x + (scrollMoving ? 0 : Math.sin(t * 0.63) * 0.9),
      pos.y + 6 + (scrollMoving ? 0 : Math.sin(t * 0.71 + 1.7) * 0.55),
      pos.z
    );
    camera.lookAt(ahead.x * 0.6, ahead.y - 8, ahead.z);
    camera.rotation.z += Math.sin(t * 0.32) * 0.006;
    const fov = fovAt(pq);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // exposure: night opening opens up, kiln flood peaks late
    renderer.toneMappingExposure = 1.0;

    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  window.__world = { tUni, pathUni, sun, doorMat, camera };
  return { frame, resize };
}
