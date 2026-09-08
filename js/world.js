// world.js — v5.0 «המסע» (the journey). ONE continuous world, not vignettes:
// the camera travels a single path through a landscape that builds itself as
// you scroll — void → terrain rises → molten veins → canyon walls → kiln sun
// on the horizon → the gate. Chapters are stretches of the road, not scenes.
// Content stays in DOM; the world is WebGL. Built on the vendored three.js.

import * as THREE from 'three';

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
}`;

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14100c);
  scene.fog = new THREE.FogExp2(0x14100c, 0.0018);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 2600);

  /* ---------- the road the camera travels ---------- */
  const WAY = [
    [0, 15, 80], [34, 14, -140], [-44, 16, -380], [30, 13, -640],
    [-34, 15, -900], [30, 14, -1180], [-18, 16, -1480], [12, 18, -1780], [0, 22, -2060],
  ];
  const curve = new THREE.CatmullRomCurve3(WAY.map(p => new THREE.Vector3(...p)), false, 'centripetal', 0.6);

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
          float ridge = fbm(xz * 0.0035);
          float detail = fbm(xz * 0.021 + 7.3);
          float h = ridge * 64.0 + detail * 7.0;
          // keep a travelling corridor lower: the road bed
          float corridor = smoothstep(14.0, 150.0, abs(xz.x));
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
          float hn = clamp(vH / 60.0, 0.0, 1.0);
          vec3 base = mix(vec3(0.07,0.058,0.048), vec3(0.27,0.235,0.20), hn);   // charcoal → ash
          base *= 0.55 + 0.45 * hn;                                             // valley shade
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

  /* ---------- kiln sun on the horizon ---------- */
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(130, 40, 40),
    new THREE.MeshBasicMaterial({ color: 0xE8862E, fog: false, transparent: true, opacity: 0 })
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
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunGlow.scale.set(560, 560, 1);
  sunGlow.position.copy(sun.position);
  scene.add(sunGlow);

  /* ---------- the gate (S7) ---------- */
  const gate = new THREE.Group();
  const monoMat = new THREE.MeshBasicMaterial({ color: 0x241d16, fog: true });
  for (const sx of [-26, 26]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(14, 110, 14), monoMat);
    m.position.set(sx, 55, 0);
    gate.add(m);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(66, 12, 14), monoMat);
  lintel.position.set(0, 104, 0);
  gate.add(lintel);
  const doorMat = new THREE.MeshBasicMaterial({ color: 0xF4C56B, fog: false, transparent: true, opacity: 0 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(30, 76), doorMat);
  door.position.set(0, 40, 0);
  gate.add(door);
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  doorGlow.scale.set(230, 230, 1); doorGlow.position.set(0, 42, 6);
  gate.add(doorGlow);
  gate.position.set(0, 0, -2380);
  scene.add(gate);

  /* ---------- drive ---------- */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  let prS = 0;
  function frame(tms, pr) {
    const t = tms * 0.001;
    if (window.__egSnapWorld) { prS = pr; window.__egSnapWorld = false; }
    prS += (pr - prS) * 0.12;
    tUni.uTime.value = t; pathUni.uTime.value = t;
    tUni.uBuild.value = smooth(0.0, 0.30, prS);
    tUni.uVeins.value = smooth(0.10, 0.26, prS) * (1.0 - smooth(0.58, 0.78, prS) * 0.8);
    tUni.uSun.value = smooth(0.52, 0.80, prS);
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

    const pq = Math.min(0.999, prS * 0.985);
    const pos = curve.getPointAt(pq);
    const ahead = curve.getPointAt(Math.min(1, pq + 0.045));
    camera.position.set(
      pos.x + Math.sin(t * 0.5) * 0.7,
      pos.y + 6 + Math.sin(t * 0.8) * 0.45,
      pos.z
    );
    camera.lookAt(ahead.x * 0.6, ahead.y - 8, ahead.z);
    camera.rotation.z += Math.sin(t * 0.32) * 0.006;

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
