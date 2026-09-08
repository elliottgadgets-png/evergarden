// world.js — v5.0 «המסע» (the journey). ONE continuous world, not vignettes:
// the camera travels a single path through a landscape that builds itself as
// you scroll — void → terrain rises → molten veins → canyon walls → kiln sun
// on the horizon → the gate. Chapters are stretches of the road, not scenes.
// Content stays in DOM; the world is WebGL. Built on the vendored three.js.

import * as THREE from 'three';
import { makeCrucible, makeNiche, makeBookSealStand } from './props.js';
import { makeRelief, SOSHIMI_DEPTH } from './relief.js';

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
          float quarry = 1.0 - smoothstep(0.55, 1.0, length((xz - vec2(60.0, -386.0)) / vec2(950.0, 720.0)));
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
  const monoMat = new THREE.MeshBasicMaterial({ color: 0x241d16, fog: true, transparent: true, opacity: 0.05 });
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
  const basalt2 = () => new THREE.MeshStandardMaterial({ color: 0x1c1510, roughness: 0.95, metalness: 0.04 });
  const texLoader = new THREE.TextureLoader();

  // S2 close: the crucible mid-pour beside the road — where the molten veins come from
  const crucible = makeCrucible();
  {
    const cp = curve.getPointAt(0.285);
    crucible.scale.setScalar(12);
    crucible.position.set(cp.x + 12, 0, cp.z - 4);
    crucible.rotation.y = 0.5;
    scene.add(crucible);
    // grounding: molten pool where the pour lands + a glowing stream from the lip
    const pool = new THREE.Mesh(new THREE.CircleGeometry(7, 28),
      new THREE.MeshBasicMaterial({ color: 0xE8862E, transparent: true, opacity: 0, fog: false, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(cp.x + 20, 0.4, cp.z - 2);
    scene.add(pool);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xF4C56B, transparent: true, opacity: 0, fog: false, toneMapped: false }));
    stream.position.set(cp.x + 17.5, 8, cp.z - 3);
    stream.rotation.z = 0.35;
    scene.add(stream);
    const pourLight = new THREE.PointLight(0xE8862E, 900, 90, 2);
    pourLight.position.set(cp.x + 12, 16, cp.z);
    scene.add(pourLight);
    propsUpdaters.push((t, pr, pq) => {
      const ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - 0.268) / 0.06));
      crucible.userData.update(t, ph);
      pourLight.intensity = 400 + ph * 1200;
      pool.material.opacity = ph * 0.75;
      stream.material.opacity = Math.max(0, ph - 0.45) * 1.6;
      stream.scale.y = 0.4 + ph * 0.6;
    });
  }

  // S4: three lit niches set into the canyon wall, each holding a finished piece
  const reliefStation = { pos: new THREE.Vector3() };
  const nicheShots = ['assets/work-videoeditor.jpg', 'assets/work-verdant.jpg', 'assets/work-soshimi.jpg'];
  nicheShots.forEach((src, i) => {
    const isRelief = i === 0; // S4 lead work: fired basalt relief (v3.1) - soshimi, facing the road
    const niche = isRelief ? makeRelief({ map: texLoader.load('assets/work-soshimi.jpg'), depthSpec: SOSHIMI_DEPTH }) : makeNiche(1.6, 1.05);
    const nt = (isRelief ? 0.615 : 0.58 + i * 0.09);
    const np = curve.getPointAt(nt);
    const side = i % 2 === 0 ? 1 : -1;
    niche.scale.setScalar(isRelief ? 1.15 : 13);
    niche.position.set(np.x + side * (isRelief ? 52 : 44), np.y + 13, np.z);
    if (isRelief) { reliefStation.pos.copy(niche.position); niche.rotation.y = -side * 0.35; niche.userData.isReliefRoot = true; window.__egRelief = niche; }
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
    const caseLight = new THREE.PointLight(0xFFD28A, 500, 70, 2);
    caseLight.position.set(np.x + side * 20, np.y + 22, np.z + 24);
    scene.add(caseLight);
    niche.traverse(o => { if (o.material) { o.material.transparent = true; } });
    const backMats = back.material;
    backMats.transparent = true;
    propsUpdaters.push((t, pr, pq) => {
      let ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - nt) / 0.075));
      if (isRelief) {
        // relief arc unfolds during the approach and completes at the dwell (pq 0.58)
        const a = Math.min(1, Math.max(0, (pq - 0.495) / 0.085));
        ph = window.__egArcOverride != null ? window.__egArcOverride : a * a * (3 - 2 * a);
      }
      const ease = ph * ph * (3 - 2 * ph);
      niche.userData.update(t, ph);
      if (isRelief) {
        const tt = Math.min(1, Math.max(0, (ph - 0.6) / 0.4));
        const ts = tt * tt * (3 - 2 * tt);
        niche.rotation.y = -side * (0.55 + ts * 0.2);
      }
      niche.children.forEach((ch, ci) => {
        if (!ch.material) return;
        const isBar = !isRelief && ci < 4; // frame bars hidden: the lit opening is the alcove
        ch.material.opacity = isBar ? 0.0 : (isRelief ? Math.min(1, ph * 2.2) : ease);
      });
      backMats.opacity = ease * 0.92;
      if (!isRelief) { niche.visible = ph > 0.005; back.visible = ease > 0.01; } // far niches never show as black boxes
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
  scene.add(plinth);
  const book = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.95, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.6, emissive: 0x3a2410, emissiveIntensity: 1.0 }));
  book.position.set(9.0, 11.4, -2344.2); book.rotation.y = -0.12;
  scene.add(book);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.65, 24),
    new THREE.MeshStandardMaterial({ color: 0xE8862E, emissive: 0xE8862E, emissiveIntensity: 0.55, roughness: 0.4 }));
  seal.position.set(12.8, 11.9, -2342.6);
  seal.rotation.x = -0.5;
  scene.add(seal);
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
    });
  }


  /* ---------- S3 monument: basalt slab with a living site-screen ---------- */
  const monGp = curve.getPointAt(0.475);
  const monGeo = new THREE.BoxGeometry(26, 38, 5, 5, 7, 2);
  {
    const pa = monGeo.attributes.position;
    let s3 = 11;
    const rn = () => { s3 = (s3 * 16807) % 2147483647; return s3 / 2147483647; };
    for (let v = 0; v < pa.count; v++) {
      if (Math.abs(pa.getZ(v)) < 2) continue; // keep the screen face flat
      const taper = 1 - Math.max(0, pa.getY(v)) / 38 * 0.24;
      pa.setX(v, pa.getX(v) * taper + (rn() - 0.5) * 2.6);
      pa.setY(v, pa.getY(v) + (rn() - 0.5) * 1.8);
    }
    monGeo.computeVertexNormals();
  }
  const monument = new THREE.Mesh(monGeo, basalt);
  monument.position.set(monGp.x - 24, 10.5, monGp.z - 6);
  monument.rotation.y = 0.42;
  monument.rotation.z = 0.055;
  scene.add(monument);
  // flanking base rocks so the slab grows out of the ground
  [[-13, 2.5, 3, 7, 11, 5], [11, 1.8, 5, 5.5, 8, 4.5], [2, 1.4, 7.5, 4, 6, 4]].forEach(([ox, oy, oz, w, h, d], ri) => {
    const fr = new THREE.BoxGeometry(w, h, d, 3, 3, 2);
    const fa = fr.attributes.position; let fs = 91 + ri * 37;
    const frn = () => { fs = (fs * 16807) % 2147483647; return fs / 2147483647; };
    for (let v = 0; v < fa.count; v++) {
      fa.setX(v, fa.getX(v) + (frn() - 0.5) * 1.8);
      fa.setY(v, fa.getY(v) + (frn() - 0.5) * 1.4);
      fa.setZ(v, fa.getZ(v) + (frn() - 0.5) * 1.2);
    }
    fr.computeVertexNormals();
    const fm = new THREE.Mesh(fr, basalt);
    fm.position.set(monGp.x - 24 + ox, oy, monGp.z - 6 + oz);
    fm.rotation.y = frn() * 1.2;
    scene.add(fm);
  });
  // living mini-site on the screen face
  const scrC = document.createElement('canvas'); scrC.width = 512; scrC.height = 320;
  const scrX = scrC.getContext('2d');
  function drawMiniSite(gl) {
    scrX.fillStyle = '#0c0e11'; scrX.fillRect(0, 0, 512, 320);
    scrX.fillStyle = '#171a1f'; scrX.fillRect(0, 0, 512, 44);
    scrX.fillStyle = '#e86a5e'; scrX.beginPath(); scrX.arc(496, 22, 6, 0, 7); scrX.fill();
    scrX.fillStyle = '#e8b95e'; scrX.beginPath(); scrX.arc(476, 22, 6, 0, 7); scrX.fill();
    scrX.fillStyle = '#7ec97e'; scrX.beginPath(); scrX.arc(456, 22, 6, 0, 7); scrX.fill();
    scrX.fillStyle = '#23272e'; scrX.fillRect(30, 12, 380, 22);
    scrX.fillStyle = '#8a877e'; scrX.font = '13px sans-serif'; scrX.textAlign = 'left';
    scrX.fillText('your-site.co.il', 42, 28);
    scrX.strokeStyle = `rgba(232,134,46,${0.5 + gl * 0.5})`; scrX.lineWidth = 3;
    scrX.beginPath(); scrX.arc(256, 108, 22, 0, 7); scrX.stroke();
    scrX.fillStyle = `rgba(232,134,46,${0.6 + gl * 0.4})`; scrX.beginPath(); scrX.arc(256, 108, 7, 0, 7); scrX.fill();
    scrX.fillStyle = '#d8d2c4';
    [0, 1].forEach(r => { scrX.globalAlpha = 0.85 - r * 0.25; scrX.fillRect(156, 152 + r * 22, 200 - r * 60, 9); });
    scrX.globalAlpha = 0.5;
    [0, 1, 2].forEach(r => scrX.fillRect(176, 210 + r * 16, 160 - r * 24, 5));
    scrX.globalAlpha = 1;
    scrX.fillStyle = '#E8862E'; scrX.fillRect(206, 268, 100, 26);
    scrX.fillStyle = '#0b0b0d'; scrX.font = 'bold 13px sans-serif'; scrX.textAlign = 'center';
    scrX.fillText('דברו איתי', 256, 286);
  }
  drawMiniSite(0.5);
  const scrTex = new THREE.CanvasTexture(scrC);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(19, 12),
    new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  screen.position.set(0, 3, 2.62);
  monument.add(screen);
  const monLight = new THREE.PointLight(0xE8862E, 350, 80, 2);
  monLight.position.set(monGp.x - 16, 18, monGp.z + 14);
  scene.add(monLight);
  propsUpdaters.push((t, pr, pq) => {
    const ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - 0.44) / 0.10));
    monLight.intensity = 120 + ph * 500;
    if (ph > 0.05 && (!frame._miniT || t - frame._miniT > 0.5)) {
      frame._miniT = t;
      drawMiniSite(0.4 + 0.6 * Math.abs(Math.sin(t * 0.8)));
      scrTex.needsUpdate = true;
    }
  });


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
  const rockMat = basalt.clone(); rockMat.fog = false; rockMat.color.set(0x181008);
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.set(rockGp.x - 2, 34, rockGp.z - 12);
  rock.rotation.y = 0.12;
  scene.add(rock);
  const filmC = document.createElement('canvas'); filmC.width = 512; filmC.height = 288;
  const filmX = filmC.getContext('2d');
  const filmImgs = [];
  ['assets/work-videoeditor.jpg', 'assets/work-verdant.jpg', 'assets/work-soshimi.jpg'].forEach(src => { const im = new Image(); im.src = src; filmImgs.push(im); });
  let filmG = 13;
  function drawFilm(t) {
    filmX.fillStyle = '#160d05'; filmX.fillRect(0, 0, 512, 288);
    const off = (t * 42) % 440;
    const base = Math.floor((t * 42) / 440);
    for (let k = -1; k <= 1; k++) {
      const im = filmImgs[(((base + k) % 3) + 3) % 3];
      const x = 36 + k * 440 - off;
      filmX.strokeStyle = 'rgba(255,210,138,0.5)'; filmX.lineWidth = 3;
      filmX.strokeRect(x - 6, 24, 412, 240);
      if (im.complete && im.naturalWidth) {
        filmX.globalAlpha = 0.92; filmX.drawImage(im, x, 30, 400, 228); filmX.globalAlpha = 1;
        filmX.fillStyle = 'rgba(232,134,46,0.14)'; filmX.fillRect(x, 30, 400, 228);
      } else { filmX.fillStyle = '#241608'; filmX.fillRect(x, 30, 400, 228); }
    }
    filmX.fillStyle = 'rgba(10,6,3,0.85)'; filmX.fillRect(0, 0, 512, 18); filmX.fillRect(0, 270, 512, 18);
    filmX.fillStyle = 'rgba(255,210,138,0.55)';
    for (let hx = 12; hx < 512; hx += 32) { filmX.fillRect(hx, 5, 12, 8); filmX.fillRect(hx, 275, 12, 8); }
    for (let g = 0; g < 60; g++) { filmG = (filmG * 16807) % 2147483647; const r = filmG / 2147483647; filmX.fillStyle = `rgba(255,220,170,${0.05 + r * 0.1})`; filmX.fillRect(r * 512, ((filmG >> 3) % 288), 2, 1); }
    const sy = (t * 97) % 288;
    filmX.fillStyle = 'rgba(255,230,190,0.07)'; filmX.fillRect(0, sy, 512, 3);
  }
  drawFilm(0);
  const filmTex = new THREE.CanvasTexture(filmC);
  filmTex.colorSpace = THREE.SRGBColorSpace;
  const projMat = new THREE.MeshBasicMaterial({ map: filmTex, transparent: true, opacity: 0, toneMapped: false, fog: false });
  const proj = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), projMat);
  proj.position.set(0, 2, 4.6);
  rock.add(proj);
  const projLight = new THREE.PointLight(0xE8862E, 0, 160, 2);
  projLight.position.set(rockGp.x - 2, 40, rockGp.z + 10);
  scene.add(projLight);
  propsUpdaters.push((t, pr, pq) => {
    const ph = Math.min(1, Math.max(0, 1 - Math.abs(pq - 0.835) / 0.13));
    const flick = 0.85 + 0.15 * Math.sin(t * 13.0) * Math.sin(t * 7.3);
    projMat.opacity = ph * 0.95 * flick;
    projLight.intensity = ph * 1500 * flick;
    if (ph > 0.03 && (!frame._filmT || t - frame._filmT > 0.16)) { frame._filmT = t; drawFilm(t); filmTex.needsUpdate = true; }
  });

  /* ---------- authored silhouettes: spires that thicken into the canyon ---------- */
  const spireMat = new THREE.MeshBasicMaterial({ color: 0x0e0a07, fog: true, transparent: true, opacity: 0 });
  propsUpdaters.push((t, pr) => { spireMat.opacity = Math.min(1, Math.max(0, (pr - 0.05) / 0.06)); });
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 22; i++) {
    const st = 0.16 + (i / 22) * 0.78 + rnd() * 0.02; // clear of the hero opening
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
    if (st > 0.52 && st < 0.64) continue; // quarry slice: no spire silhouettes near the relief
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
    monoMat.opacity = 0.05 + 0.95 * smooth(0.70, 0.86, prS);
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
    // fired-relief dwell: gaze eases from the road to the monolith and back
    const rPh = Math.min(1, Math.max(0, 1 - Math.abs(pq - 0.58) / 0.075));
    const rEase = rPh * rPh * (3 - 2 * rPh);
    const lx = ahead.x * 0.6 + (reliefStation.pos.x - ahead.x * 0.6) * rEase;
    const ly = (ahead.y - 8) + (reliefStation.pos.y + 1 - (ahead.y - 8)) * rEase;
    const lz = ahead.z + (reliefStation.pos.z - ahead.z) * rEase;
    camera.lookAt(lx, ly, lz);
    window.__egScene = scene;
    window.__egDbg = () => ({ pq, cam: camera.position.toArray().map(v=>+v.toFixed(1)), ahead: ahead.toArray().map(v=>+v.toFixed(1)), relief: reliefStation.pos.toArray().map(v=>+v.toFixed(1)), rock: rock.position.toArray().map(v=>+v.toFixed(1)), projO: +projMat.opacity.toFixed(2), projI: Math.round(projLight.intensity), fov: +camera.fov.toFixed(1) });
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
