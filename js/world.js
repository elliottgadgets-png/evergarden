// world.js — v5.0 «המסע» (the journey). ONE continuous world, not vignettes:
// the camera travels a single path through a landscape that builds itself as
// you scroll — void → terrain rises → molten veins → canyon walls → kiln sun
// on the horizon → the gate. Chapters are stretches of the road, not scenes.
// Content stays in DOM; the world is WebGL. Built on the vendored three.js.

import * as THREE from 'three';
import { makeCrucible, makeNiche, makeBookSealStand } from './props.js';
import { makeRelief, SOSHIMI_DEPTH, VERDANT_DEPTH, VIDEOEDITOR_DEPTH } from './relief.js';

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
        varying float vH; varying vec2 vXZ; varying float vFogDepth; varying float vQuarry;
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
          // S4 quarry slice: around the relief station the worked land is flat basalt, no ranges
          float quarry = 1.0 - smoothstep(0.55, 1.0, length((xz - vec2(60.0, -386.0)) / vec2(2100.0, 1500.0)));
          h *= 1.0 - quarry * 0.96;
          h -= quarry * 1.5; // shallow worked depression
          h *= uBuild;
          pos.z += h;
          vH = h; vXZ = xz; vQuarry = quarry;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vFogDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: NOISE + /* glsl */`
        uniform float uTime; uniform float uVeins; uniform float uSun;
        uniform vec3 uFogColor; uniform float uFogDensity;
        varying float vH; varying vec2 vXZ; varying float vFogDepth; varying float vQuarry;
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
          vec3 col = base + ember * (v * uVeins * pulse * 1.9 * (1.0 - vQuarry) + uVeins * 0.05 * (1.0 - vQuarry));
          // quarry floor: worked dark basalt with faint ash variation, matte
          col = mix(col, vec3(0.050, 0.044, 0.038) * (0.8 + 0.4 * fbm(vXZ * 0.05)), vQuarry * 0.92);
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
    uGlow: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2350, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uSunDir; uniform float uSun; uniform float uGlow; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.08, 1.0);
          vec3 zen = vec3(0.030, 0.024, 0.020);
          vec3 hor = vec3(0.105, 0.075, 0.048);
          vec3 col = mix(hor, zen, pow(max(h, 0.0), 0.55));
          float sunward = pow(max(dot(normalize(vDir), uSunDir), 0.0), 5.0);
          col += vec3(0.85, 0.46, 0.16) * sunward * (0.12 + uGlow * 0.85);
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

  /* ---------- the gate (S7): basalt portal with an ember seam - no flat panels ---------- */
  const gate = new THREE.Group();
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x201812, roughness: 0.92, metalness: 0.05, transparent: true, opacity: 0 });
  gateMat.depthWrite = false;
  const jag = (geo, s0) => {
    const pa = geo.attributes.position; let s = s0;
    const rn = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let v = 0; v < pa.count; v++) {
      pa.setX(v, pa.getX(v) + (rn() - 0.5) * 3.4);
      pa.setY(v, pa.getY(v) + (rn() - 0.5) * 2.6);
      pa.setZ(v, pa.getZ(v) + (rn() - 0.5) * 3.4);
    }
    geo.computeVertexNormals();
    return geo;
  };
  for (const sx of [-24, 24]) {
    const m = new THREE.Mesh(jag(new THREE.BoxGeometry(13, 150, 13, 3, 12, 3), sx * 7 + 5), gateMat);
    m.position.set(sx, 75, 0);
    gate.add(m);
  }
  const lintel = new THREE.Mesh(jag(new THREE.BoxGeometry(64, 13, 13, 6, 2, 2), 99), gateMat);
  lintel.position.set(0, 147, 0);
  gate.add(lintel);
  // the threshold: a narrow ember seam of light between the pillars, waking as you arrive
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xF4C56B, fog: false, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 128), seamMat);
  seam.position.set(0, 66, 0);
  gate.add(seam);
  const threshold = new THREE.Mesh(new THREE.CircleGeometry(16, 28),
    new THREE.MeshBasicMaterial({ color: 0xE8862E, transparent: true, opacity: 0, fog: false, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
  threshold.rotation.x = -Math.PI / 2; threshold.position.set(0, 0.5, 10);
  gate.add(threshold);
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  }));
  doorGlow.scale.set(120, 200, 1); doorGlow.position.set(0, 70, 6);
  gate.add(doorGlow);
  const gateLight = new THREE.PointLight(0xE8862E, 0, 220, 2);
  gateLight.position.set(0, 40, 26);
  gate.add(gateLight);
  gate.position.set(0, 0, -2380);
  scene.add(gate);


  /* ---------- authored props (builder factories, re-materialized into the landscape) ---------- */
  // scene has no global lights by design (shader world); each prop carries its own case-light.
  const propsUpdaters = [];
  const basalt2 = () => new THREE.MeshStandardMaterial({ color: 0x1c1510, roughness: 0.95, metalness: 0.04 });
  const texLoader = new THREE.TextureLoader();

  // S2 seep removed: the flat glowing pool read as an artifact ellipse on the ground

  // S4: three lit niches set into the canyon wall, each holding a finished piece
  const reliefStations = []; // fired-relief stations: {pos, side, gc} gc = gaze center in pq
  const RELIEF_CONF = {
    0: { map: 'assets/work-soshimi.jpg', spec: SOSHIMI_DEPTH, seed: 977,  impact: [0.38, 0.58], nt: 0.615, gc: 0.58  }, // relief #1: soshimi
    1: { map: 'assets/work-verdant.jpg', spec: VERDANT_DEPTH, seed: 1409, impact: [0.50, 0.70], nt: 0.720, gc: 0.685 }, // relief #2: The Sound Room
    2: { map: 'assets/work-videoeditor.jpg', spec: VIDEOEDITOR_DEPTH, seed: 2711, impact: [0.75, 0.24], heat: 1.5, nt: 0.901, gc: 0.880, offD: 40, offM: 62, leadM: 8 }, // relief #3: NIR video editor (gallery map, closer dwell)
  };
  const nicheShots = ['assets/work-soshimi.jpg', 'assets/work-verdant.jpg', 'assets/work-videoeditor.jpg'];
  nicheShots.forEach((src, i) => {
    const rc = RELIEF_CONF[i];
    const isRelief = !!rc; // S4 works as fired basalt reliefs (v3.1 decision 1), one station per work
    const niche = isRelief ? makeRelief({ map: texLoader.load(rc.map), depthSpec: rc.spec, seed: rc.seed, impact: rc.impact, heat: rc.heat ?? 1.0 }) : makeNiche(1.6, 1.05);
    const nt = (isRelief ? rc.nt : 0.58 + i * 0.09);
    const np = curve.getPointAt(nt);
    const side = i % 2 === 0 ? 1 : -1;
    niche.scale.setScalar(isRelief ? 1.15 : 13);
    niche.position.set(np.x + side * (isRelief ? (innerWidth < 720 ? (rc.offM ?? 52) : (rc.offD ?? 52)) : 44), np.y + 13, np.z); // per-station lateral offset, mobile gets more room
    if (isRelief) { reliefStations.push({ pos: niche.position.clone(), side, gc: rc.gc, nt: rc.nt, lead: innerWidth < 720 ? (rc.leadM ?? 3.2) : 3.2 }); niche.rotation.y = -side * 0.35; niche.userData.isReliefRoot = true; if (i === 0) window.__egRelief = niche; else window.__egRelief2 = niche; }
    /* unrotated: plane fronts face +z, toward the approaching camera */
    scene.add(niche);
    texLoader.load(src, (tex) => { if (niche.userData.setImage) niche.userData.setImage(tex); });
    const backGeo = new THREE.BoxGeometry(54, 32, 10, 6, 4, 2);
    {
      const ba = backGeo.attributes.position; let bs = 211 + i * 53;
      const brn = () => { bs = (bs * 16807) % 2147483647; return bs / 2147483647; };
      for (let v = 0; v < ba.count; v++) {
        ba.setX(v, ba.getX(v) + (brn() - 0.5) * 5.2);
        ba.setY(v, ba.getY(v) + (brn() - 0.5) * 3.6);
        if (ba.getZ(v) < 0) ba.setZ(v, ba.getZ(v) + (brn() - 0.5) * 3.0);
      }
      backGeo.computeVertexNormals();
    }
    const back = new THREE.Mesh(backGeo, basalt2());
    back.position.copy(niche.position); back.position.y -= 3; back.position.z -= 9; back.rotation.y = side * 0.06;
    if (!isRelief) scene.add(back);
    const caseLight = new THREE.PointLight(0xFFD28A, 500, isRelief ? 70 : 100, 2);
    caseLight.position.set(np.x + side * 20, np.y + 22, np.z + 24);
    scene.add(caseLight);
    niche.traverse(o => { if (o.material) { o.material.transparent = true; } });
    const backMats = back.material;
    backMats.transparent = true;
    propsUpdaters.push((t, pr, pq) => {
      let ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - nt) / (isRelief ? 0.075 : 0.12))); // plain niches glow in earlier on approach
      if (isRelief) {
        // relief arc unfolds during the approach and completes at the dwell (gaze center gc)
        const a = Math.min(1, Math.max(0, (pq - (rc.gc - 0.085)) / 0.085));
        ph = window.__egArcOverride != null ? window.__egArcOverride : a * a * (3 - 2 * a);
      }
      const ease = ph * ph * (3 - 2 * ph);
      if (isRelief) {
        const mLift = innerWidth < 720 ? 4.2 : 0;
        niche.position.y = np.y + 13 + mLift * (1 - ph); // mobile: slab invites the stop during approach
      }
      niche.userData.update(t, ph);
      if (isRelief) {
        const tt = Math.min(1, Math.max(0, (ph - 0.6) / 0.4));
        const ts = tt * tt * (3 - 2 * tt);
        niche.rotation.y = -side * (0.55 + ts * 0.2);
      }
      niche.children.forEach((ch, ci) => {
        if (!ch.material) return;
        const isBar = !isRelief && ci < 4; // frame bars hidden: the lit opening is the alcove
        ch.material.opacity = isBar ? 0.0 : (isRelief ? Math.min(1, Math.max(0, (ph - 0.45) / 0.55) * 2.2) : ease); // relief slabs stay hidden until the source image starts resolving - no distant neon-web/sign phase
      });
      backMats.opacity = ease * 0.92;
      niche.visible = ph > (isRelief ? 0.45 : 0.005); if (!isRelief) back.visible = ease > 0.01; // ahead slabs never ghost into earlier acts: the carved shader face ignores material.opacity, so hard-gate visibility on the arc
      caseLight.intensity = (150 + ph * 450) * (0.15 + 0.85 * ease);
    });
  });

  // S7: the commission book + maker's seal on a sculpted basalt plinth before the doorway
  const basalt = new THREE.MeshStandardMaterial({ color: 0x201812, roughness: 0.92, metalness: 0.05 });
  const plinthGeo = new THREE.BoxGeometry(9.5, 11, 6, 4, 6, 3);
  {
    const pa = plinthGeo.attributes.position;
    let s2 = 31;
    const rn = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
    for (let v = 0; v < pa.count; v++) {
      pa.setX(v, pa.getX(v) + (rn() - 0.5) * 1.1);
      pa.setZ(v, pa.getZ(v) + (rn() - 0.5) * 1.1);
      pa.setY(v, pa.getY(v) + (rn() - 0.5) * 0.6);
    }
    plinthGeo.computeVertexNormals();
  }
  const plinth = new THREE.Mesh(plinthGeo, basalt);
  plinth.position.set(10, 5.2, -2344);
  plinth.rotation.y = -0.28;
  const plinthGroup = new THREE.Group();
  plinthGroup.add(plinth);
  const book = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.95, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.6, emissive: 0x3a2410, emissiveIntensity: 1.0 }));
  book.position.set(9.0, 11.4, -2344.2); book.rotation.y = -0.12;
  plinthGroup.add(book);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.65, 24),
    new THREE.MeshStandardMaterial({ color: 0xE8862E, emissive: 0xE8862E, emissiveIntensity: 0.55, roughness: 0.4 }));
  seal.position.set(12.8, 11.9, -2342.6);
  seal.rotation.x = -0.5;
  plinthGroup.add(seal);
  scene.add(plinthGroup);
  {
    const plinthLight = new THREE.PointLight(0xFFD28A, 1100, 120, 2);
    plinthLight.position.set(5, 19, -2333);
    scene.add(plinthLight);
    const bookLight = new THREE.PointLight(0xE8862E, 500, 45, 2);
    bookLight.position.set(10.5, 15.5, -2339);
    scene.add(bookLight);
    propsUpdaters.push((t, pr) => {
      const ph = Math.min(1, Math.max(0, (pr - 0.88) / 0.10));
      seal.material.emissiveIntensity = 0.45 + ph * 0.8 + Math.sin(t * 1.7) * 0.1 * ph;
      plinthGroup.visible = pr > 0.80; // the plinth belongs to the door act: no distant dark square on the horizon during the works acts
    });
  }


  /* S3 monument removed: without content it read as a pale placeholder block on the horizon */

    /* ---------- S5: the projection rock — the film plays on the land ---------- */
  const rockGp = curve.getPointAt(0.84);
  const rockGeo = new THREE.BoxGeometry(84, 46, 6, 7, 5, 1);
  {
    const pa = rockGeo.attributes.position;
    let s4 = 53;
    const rn = () => { s4 = (s4 * 16807) % 2147483647; return s4 / 2147483647; };
    for (let v = 0; v < pa.count; v++) {
      if (pa.getZ(v) > 2) continue; // screen face stays flat
      pa.setX(v, pa.getX(v) + (rn() - 0.5) * 2.2);
      pa.setY(v, pa.getY(v) + (rn() - 0.5) * 1.6);
    }
    rockGeo.computeVertexNormals();
  }
  const rockMat = basalt.clone(); rockMat.fog = false; rockMat.color.set(0x181008); rockMat.transparent = true; rockMat.opacity = 0; rockMat.depthWrite = false;
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.set(rockGp.x - 2, 34, rockGp.z - 12);
  rock.rotation.y = 0.12;
  scene.add(rock);
  const filmC = document.createElement('canvas'); filmC.width = 512; filmC.height = 288;
  const filmX = filmC.getContext('2d');
  let filmG = 13;
  function drawFilm(t) {
    // ember veins waking across the rock face - no imagery, no frames: light in stone
    filmX.fillStyle = '#000000'; filmX.fillRect(0, 0, 512, 288); // additive: black bg vanishes, only the veins read
    filmX.lineCap = 'round';
    for (let v = 0; v < 5; v++) {
      let vx = 30 + ((v * 197) % 450), vy = 20 + ((v * 131) % 240);
      filmX.beginPath(); filmX.moveTo(vx, vy);
      for (let s = 0; s < 9; s++) {
        vx += Math.sin(v * 7.3 + s * 1.9 + 0.6) * 52 + 18;
        vy += Math.cos(v * 3.1 + s * 2.3) * 34;
        filmX.lineTo(vx, vy);
      }
      const breathe = 0.5 + 0.5 * Math.sin(t * 1.7 + v * 2.2);
      filmX.strokeStyle = `rgba(232,134,46,${(0.10 + breathe * 0.30).toFixed(3)})`;
      filmX.lineWidth = 1.4 + breathe * 1.8;
      filmX.stroke();
      filmX.strokeStyle = `rgba(244,197,107,${(breathe * 0.20).toFixed(3)})`;
      filmX.lineWidth = 0.7;
      filmX.stroke();
    }
    for (let g = 0; g < 60; g++) { filmG = (filmG * 16807) % 2147483647; const r = filmG / 2147483647; filmX.fillStyle = `rgba(255,220,170,${0.05 + r * 0.1})`; filmX.fillRect(r * 512, ((filmG >> 3) % 288), 2, 1); }
    const sy = (t * 97) % 288;
    filmX.fillStyle = 'rgba(255,230,190,0.05)'; filmX.fillRect(0, sy, 512, 3);
  }
  drawFilm(0);
  const filmTex = new THREE.CanvasTexture(filmC);
  filmTex.colorSpace = THREE.SRGBColorSpace;
  const projMat = new THREE.MeshBasicMaterial({ map: filmTex, transparent: true, opacity: 0, toneMapped: false, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const proj = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), projMat);
  proj.position.set(0, 2, 4.6);
  rock.add(proj);
  const projLight = new THREE.PointLight(0xE8862E, 0, 160, 2);
  projLight.position.set(rockGp.x - 2, 40, rockGp.z + 10);
  scene.add(projLight);
  propsUpdaters.push((t, pr, pq) => {
    const ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - 0.835) / 0.03)); // rock beat compressed ahead of relief #3 dwell
    const flick = 0.85 + 0.15 * Math.sin(t * 13.0) * Math.sin(t * 7.3);
    projMat.opacity = ph * 0.95 * flick;
    projLight.intensity = ph * 1500 * flick;
    if (ph > 0.03 && (!frame._filmT || t - frame._filmT > 0.16)) { frame._filmT = t; drawFilm(t); filmTex.needsUpdate = true; }
  });

  /* spires removed: cone silhouettes read as prototype language - the mountains carry the horizon */

  /* ---------- drive ---------- */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // station remap (camera-path spec v1.0 windows): dwell at stations, travel between
  const REMAP = [[0,0],[0.04,0.012],[0.20,1/6],[0.40,2/6],[0.46,0.54],[0.56,4/6],[0.66,0.830],[0.72,0.848],[0.82,0.930],[1,1]]; // travel compressed + relief #1 dwell enters as the slab fires: no dead beat // 0.56-0.66: relief #2 dwell; 0.66-0.72: rock beat; 0.72-0.82: relief #3 dwell; 0.82-1: door approach
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
    tUni.uSun.value = smooth(0.52, 0.80, prS) * (1 - 0.55 * smooth(0.705, 0.74, prS) * (1 - smooth(0.79, 0.825, prS))); // same dwell dip as sunRise
    skyUni.uSun.value = tUni.uSun.value;
    skyUni.uGlow.value = tUni.uSun.value * (1 - 0.88 * smooth(0.80, 0.92, prS)); // tight sun lobe retires into the door act: no geometric sun disc behind the gate
    sky.position.copy(camera.position);
    pathUni.uReveal.value = prS * 1.02;

    const sunRise = smooth(0.52, 0.86, prS) * (1 - 0.55 * smooth(0.705, 0.74, prS) * (1 - smooth(0.79, 0.825, prS))); // dip the wash while relief #3 holds the dwell
    sun.position.y = -220 + sunRise * 330;
    sun.material.opacity = smooth(0.50, 0.72, prS) * (1 - smooth(0.78, 0.88, prS)); // the hard disc retires before the door act: geometric sun = rejected language
    sunGlow.material.opacity = smooth(0.55, 0.85, prS) * 0.5;
    sunGlow.position.copy(sun.position);
    scene.fog.density = 0.0018 - sunRise * 0.0006;
    tUni.uFogDensity.value = scene.fog.density;
    pathUni.uFogDensity.value = scene.fog.density;

    const rockIn = smooth(0.66, 0.72, prS); // S5 projection rock exists only in its own act
  rockMat.opacity = rockIn; rock.visible = rockIn > 0.01;
  const gateIn = smooth(0.84, 0.97, prS);
    gateMat.opacity = 0.96 * smooth(0.815, 0.90, prS); // gate exists only in the door act - no ghost during any works station
    gate.visible = gateMat.opacity > 0.01;
    seamMat.opacity = gateIn * 0.9;
    threshold.material.opacity = gateIn * 0.5;
    doorGlow.material.opacity = gateIn * 0.35;
    gateLight.intensity = gateIn * 2600;

    const warm = smooth(0.45, 0.85, prS) * (1 - 0.4 * smooth(0.705, 0.74, prS) * (1 - smooth(0.79, 0.825, prS)));
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
    // fired-relief dwells: gaze eases from the road to each monolith and back,
    // crossfading between stations while traveling between dwells
    let gx = 0, gy = 0, gz = 0, gw = 0;
    for (const rs of reliefStations) {
      const rPh = Math.min(1, Math.max(0, 1 - Math.abs(pq - rs.gc) / 0.075));
      const w = rPh * rPh * (3 - 2 * rPh);
      if (w <= 0) continue;
      gx += (rs.pos.x + rs.side * rs.lead) * w; gy += (rs.pos.y + 1) * w; gz += rs.pos.z * w; gw += w; // gaze past face center: no edge crop at full dwell
    }
    const lx = ahead.x * 0.6 + ((gw > 0 ? gx / gw : 0) - ahead.x * 0.6) * gw;
    const ly = (ahead.y - 8) + ((gw > 0 ? gy / gw : 0) - (ahead.y - 8)) * gw;
    const lz = ahead.z + ((gw > 0 ? gz / gw : 0) - ahead.z) * gw;
    camera.lookAt(lx, ly, lz);
    window.__egScene = scene; window.__egTHREE = THREE; window.__egCam = camera;
    window.__egDbg = () => ({ pq, cam: camera.position.toArray().map(v=>+v.toFixed(1)), ahead: ahead.toArray().map(v=>+v.toFixed(1)), reliefs: reliefStations.map(rs => rs.pos.toArray().map(v=>+v.toFixed(1))), rock: rock.position.toArray().map(v=>+v.toFixed(1)), projO: +projMat.opacity.toFixed(2), projI: Math.round(projLight.intensity), fov: +camera.fov.toFixed(1) });
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
  window.__world = { tUni, pathUni, sun, seamMat, camera };
  return { frame, resize };
}
