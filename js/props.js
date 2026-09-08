/**
 * landscape-props — v5.0 landscape journey: authored station props.
 * Each factory returns a THREE.Group ready to mount in the world scene.
 * No network, no external assets; all procedural.
 *
 *   import { makeCrucible, makeKilnGate, makeNiche, makeBookSealStand } from './landscape-props.js';
 *
 * Every prop exposes a small update(t, phase) on group.userData for its
 * scroll-driven beat (pour tilt, door open, niche glow, ember breathing).
 * phase is 0..1 within the prop's beat window; the world driver owns mapping.
 */
import * as THREE from 'three';

/* shared procedural texture helpers */
function grain(base, speck, n = 2000) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${speck},${Math.random() * 0.07})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* molten surface shader (caustics DNA: F2-F1 voronoi filaments, molten palette) */
const MOLTEN_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uGlow;
  vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  void main(){
    vec2 uv = vUv*6.0;
    float t = uTime*0.15;
    vec2 i = floor(uv), f = fract(uv);
    float f1=8.0, f2=8.0;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
      vec2 g=vec2(float(x),float(y));
      vec2 o=hash2(i+g); o=0.5+0.5*sin(t+6.2831*o);
      float d=length(g+o-f);
      if(d<f1){f2=f1;f1=d;} else if(d<f2){f2=d;}
    }
    float web = smoothstep(0.0, 0.28, f2-f1);
    vec3 deep = vec3(0.10,0.055,0.03);
    vec3 base = vec3(0.24,0.12,0.05);
    vec3 glow = vec3(1.0,0.60,0.24);
    vec3 col = mix(deep, base, f1*1.4);
    col += glow * (1.0-web) * (0.55 + 0.45*sin(uTime*0.8 + f1*9.0)) * uGlow;
    float edge = smoothstep(0.5, 0.42, length(vUv-0.5)); // circular falloff
    gl_FragColor = vec4(col*edge, 1.0);
    #include <colorspace_fragment>
  }
`;
const PROP_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

export function makeMoltenDisc(radius = 0.5) {
  const uniforms = { uTime: { value: 0 }, uGlow: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ vertexShader: PROP_VERT, fragmentShader: MOLTEN_FRAG, uniforms });
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat);
  m.rotation.x = -Math.PI / 2;
  m.userData.update = (t) => { uniforms.uTime.value = t; };
  m.userData.uniforms = uniforms;
  return m;
}

export function makeCrucible() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ map: grain('#211a14', '255,200,150'), roughness: 0.55, metalness: 0.25, emissive: 0x33180a, emissiveIntensity: 0.5 });
  // lathe pot
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = i / 12;
    pts.push(new THREE.Vector2(0.12 + Math.sin(a * 1.35) * 0.55, a * 1.1));
  }
  const pot = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), iron);
  g.add(pot);
  // rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 10, 28), iron);
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.1; g.add(rim);
  // molten contents
  const melt = makeMoltenDisc(0.55);
  melt.position.y = 1.05; g.add(melt);
  // tripod stand
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.6), iron);
    const a = i / 3 * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.55, 0.4, Math.sin(a) * 0.55);
    leg.rotation.z = Math.cos(a) * 0.35; leg.rotation.x = -Math.sin(a) * 0.35;
    g.add(leg);
  }
  // pour pivot: the beat rotates the whole pot around the lip
  const pivot = new THREE.Group();
  pivot.position.set(0.6, 1.1, 0);
  g.position.set(-0.6, -1.1, 0); // recenters geometry so pivot sits at lip
  pivot.add(g);
  const wrapper = new THREE.Group();
  wrapper.add(pivot);
  wrapper.userData.update = (t, phase = 0) => {
    melt.userData.update(t);
    // pour tilt across phase 0.3..0.8, eased
    const k = Math.min(Math.max((phase - 0.3) / 0.5, 0), 1);
    pivot.rotation.z = -k * k * (3 - 2 * k) * 1.9;
  };
  return wrapper;
}

export function makeKilnGate() {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: grain('#2b2119', '230,200,160', 3200), roughness: 0.95 });
  // arch: two pillars + lintel arc
  [-1.1, 1.1].forEach(x => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.6), stone);
    pillar.position.set(x, 1.3, 0); g.add(pillar);
  });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.26, 10, 24, Math.PI), stone);
  arc.position.y = 2.6; g.add(arc);
  // glowing interior
  const innerUniforms = { uTime: { value: 0 }, uGlow: { value: 0 } };
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.5), new THREE.ShaderMaterial({
    vertexShader: PROP_VERT, fragmentShader: MOLTEN_FRAG, uniforms: innerUniforms,
  }));
  inner.position.set(0, 1.25, -0.15); g.add(inner);
  // door (rotates open on beat)
  const doorMat = new THREE.MeshStandardMaterial({ map: grain('#1c1510', '200,170,140'), roughness: 0.7, metalness: 0.4 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 0.12), doorMat);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.85, 1.25, 0.1);
  door.position.set(0.85, 0, 0);
  doorPivot.add(door); g.add(doorPivot);
  g.userData.update = (t, phase = 0) => {
    innerUniforms.uTime.value = t;
    innerUniforms.uGlow.value = 0.25 + phase * 1.4;   // banked glow -> blinding
    const k = Math.min(Math.max(phase, 0), 1);
    doorPivot.rotation.y = -k * k * (3 - 2 * k) * 1.85; // swings open
  };
  return g;
}

export function makeNiche(frameW = 1.6, frameH = 1.1) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ map: grain('#332619', '255,220,170', 1200), roughness: 0.55, emissive: 0x1f160c, emissiveIntensity: 0.6 });
  const fw = 0.07;
  [[0, frameH / 2 + fw / 2, frameW + 2 * fw, fw], [0, -frameH / 2 - fw / 2, frameW + 2 * fw, fw],
   [-frameW / 2 - fw / 2, 0, fw, frameH], [frameW / 2 + fw / 2, 0, fw, frameH]].forEach(([x, y, w, h]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), frameMat);
    bar.position.set(x, y, 0); g.add(bar);
  });
  const imgUniforms = { uGlow: { value: 0.3 } };
  const imgMat = new THREE.MeshStandardMaterial({ color: 0x101418, emissive: 0xffd28a, emissiveIntensity: 0.0 });
  const img = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), imgMat);
  img.position.z = -0.03; g.add(img);
  // glass sheen
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.1, metalness: 0.9 }));
  glass.position.z = 0.045; g.add(glass);
  g.userData.setImage = (tex) => { tex.colorSpace = THREE.SRGBColorSpace; imgMat.map = tex; imgMat.color.set(0xffffff); imgMat.needsUpdate = true; };
  g.userData.update = (t, phase = 0) => { imgMat.emissiveIntensity = 0.28 + phase * 0.32; };
  return g;
}

export function makeBookSealStand() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ map: grain('#2e2115', '220,180,130', 1500), roughness: 0.8 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 1.1), woodMat);
  top.position.y = 0.85; g.add(top);
  [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), woodMat);
    leg.position.set(x, 0.42, z); g.add(leg);
  });
  // anchor points for the particle morph targets (book + seal resolve above the stand)
  g.userData.bookAnchor = new THREE.Vector3(-0.5, 1.05, 0);
  g.userData.sealAnchor = new THREE.Vector3(0.55, 1.0, 0);
  g.userData.update = () => {};
  return g;
}
