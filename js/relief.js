// relief.js — fired basalt relief: the works as carved relics (v3.1 decision 1).
// One project = one basalt slab, the demo carved into it (art-directed depth map),
// ember ignition -> molten veins in the carved channels -> cooling -> grade break
// to neutral light, faithful color, 1:1 flat. Arc is one scrub channel: uArc 0..1.
import * as THREE from 'three';

const RELIEF_VERT = /* glsl */`
  uniform sampler2D uDepth;
  uniform float uArc;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    float settle = smoothstep(0.88, 1.0, uArc);
    vec3 p = position;
    p.z -= (d - 0.40) * 3.2 * (1.0 - settle); // carved deep; depth survives cooling, flattens only at the final settle
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RELIEF_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uMap, uDepth;
  uniform float uArc, uTime;
  uniform vec2 uImp;
  uniform vec2 uTexel;
  varying vec2 vUv;
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float e = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    return mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
  }
  vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  void main() {
    float d = texture2D(uDepth, vUv).r;
    float read = smoothstep(0.55, 0.85, uArc);
    float settle = smoothstep(0.88, 1.0, uArc);
    float ignite = smoothstep(0.02, 0.22, uArc);
    float veinsPh = smoothstep(0.20, 0.35, uArc) * (1.0 - smoothstep(0.55, 0.80, uArc));
    vec3 raw = texture2D(uMap, vUv).rgb;
    // carved shading: normal from depth gradient, raking light
    float dx = texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r;
    float dy = texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r;
    vec3 n = normalize(vec3(-dx * 16.0, dy * 16.0, 1.0));
    float rake = max(dot(n, normalize(vec3(-0.55, 0.75, 0.6))), 0.0);
    // graded (world) color: desaturated, ember-charcoal cast, sunken
    float lum = dot(raw, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(raw, vec3(lum), 0.55) * vec3(0.95, 0.72, 0.5) * 0.5;
    graded *= 0.30 + 1.05 * rake;
    graded *= 0.62 + 0.38 * smoothstep(0.30, 0.62, d); // channel AO: the carving sits dark
    vec3 page = raw * (0.70 + 0.30 * rake); // page colors arrive still shaped by the carving
    vec3 col = mix(graded, page, read);
    col = mix(col, raw, settle); // only the final settle is the true flat page
    // heat-driven fracture: ember impact point, heat front sweeps outward,
    // glow runs along the carved walls and along wandering radial cracks
    float channels = smoothstep(0.44, 0.78, d); // heat lives in the carving
    float edge = clamp(length(vec2(dx, dy)) * 26.0, 0.0, 1.0); // the cut walls themselves
    vec2 imp = uImp; // ember impact, authored inside the deepest carved region
    vec2 dir = vUv - imp; dir.x *= 1.6; // aspect-true radius
    float rad = length(dir);
    float ang = atan(dir.y, dir.x);
    float wander = vnoise(vec2(ang * 1.8 + 3.0, rad * 9.0 - uTime * 0.35));
    float crack = abs(fract(ang * 2.149 + wander * 1.15 + 0.5) - 0.5) * rad; // bent spokes, wide apart
    crack = 1.0 - smoothstep(0.0, 0.016 + rad * 0.012, crack);
    float front = smoothstep(0.10, 0.60, uArc) * 1.35; // heat front position
    float lit = smoothstep(front, front - 0.22, rad);  // glow where the front has passed
    float flick = 0.82 + 0.18 * sin(uTime * 11.0) * sin(uTime * 6.7);
    float heat = (edge * 0.85 + crack * 1.5) * channels * veinsPh * lit * flick;
    col += vec3(1.0, 0.55, 0.18) * heat * 3.2 * (1.0 - read);
    col += vec3(1.0, 0.62, 0.25) * ignite * (1.0 - read) * 0.10 * channels;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Art-directed depth map: authored regions over the screenshot composition
// (x, y, w, h in 0..1 of the image, y from top). Never auto-luminance.
function buildDepthTexture(spec) {
  const W = 450, H = 281;
  // two-canvas blur: drawing a canvas onto itself with a filter is unreliable
  const c1 = document.createElement('canvas'); c1.width = W; c1.height = H;
  const g1 = c1.getContext('2d');
  g1.fillStyle = `rgb(${Math.round(spec.base * 255)},0,0)`; g1.fillRect(0, 0, W, H);
  for (const [x, y, w, h, d] of spec.regions) {
    g1.fillStyle = `rgb(${Math.round(d * 255)},0,0)`;
    g1.fillRect(x * W, y * H, w * W, h * H);
  }
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
  const g2 = c2.getContext('2d');
  g2.filter = 'blur(10px)';
  g2.drawImage(c1, 0, 0);
  g2.filter = 'blur(3px)';
  g2.drawImage(c2, 0, 0); // same-size self composite of already-blurred content
  const tex = new THREE.CanvasTexture(c2);
  return tex;
}

// Soshimi (900x562): sushi hero deepest, headline carved, chrome shallow.
const SOSHIMI_DEPTH = {
  base: 0.42,
  regions: [
    [0.00, 0.09, 0.78, 0.78, 0.85],  // the rolls - hero element, carved deepest
    [0.64, 0.42, 0.30, 0.22, 0.72],  // סושימי headline
    [0.68, 0.63, 0.30, 0.15, 0.55],  // subtext lines
    [0.78, 0.79, 0.17, 0.10, 0.62],  // CTA button
    [0.55, 0.00, 0.45, 0.42, 0.28],  // bokeh background - far, shallow
    [0.00, 0.00, 1.00, 0.08, 0.34],  // nav strip - chrome, shallow
  ],
};


// The Sound Room (900x562): typographic headline carved deepest, product
// grid close behind, chrome shallow. Light page - the carving carries it.
const VERDANT_DEPTH = {
  base: 0.42,
  regions: [
    [0.26, 0.14, 0.48, 0.30, 0.85],  // the headline - hero element, carved deepest
    [0.05, 0.84, 0.90, 0.16, 0.78],  // instrument photo grid - deep, textured
    [0.42, 0.51, 0.16, 0.09, 0.62],  // gold CTA button
    [0.34, 0.44, 0.32, 0.06, 0.55],  // subtext line
    [0.30, 0.71, 0.40, 0.07, 0.45],  // filter chips row
    [0.00, 0.00, 1.00, 0.07, 0.34],  // nav strip - chrome, shallow
  ],
};

export function makeRelief({ map, depthSpec, seed = 977, impact = [0.38, 0.58] }) {
  const group = new THREE.Group();
  const depthTex = buildDepthTexture(depthSpec);
  const mat = new THREE.ShaderMaterial({
    vertexShader: RELIEF_VERT, fragmentShader: RELIEF_FRAG,
    uniforms: {
      uMap: { value: map }, uDepth: { value: depthTex },
      uArc: { value: 0 }, uTime: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / 450, 1 / 281) },
      uImp: { value: new THREE.Vector2(impact[0], impact[1]) },
    },
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(33.8, 21.2, 130, 84), mat);
  face.position.z = 3.0;
  group.add(face);
  // basalt slab body
  const slabGeo = new THREE.BoxGeometry(39, 27, 7.5, 11, 9, 3);
  const sa = slabGeo.attributes.position; let ss = seed;
  const srn = () => { ss = (ss * 16807) % 2147483647; return ss / 2147483647; };
  for (let v = 0; v < sa.count; v++) {
    let x = sa.getX(v), y = sa.getY(v), z = sa.getZ(v);
    const ex = Math.abs(x) / 19.5, ey = Math.abs(y) / 13.5; // 1 at the silhouette edges
    const edge = Math.max(ex, ey);
    // chip: noise grows toward edges and corners; corners get real bites
    const bite = Math.max(0, edge - 0.62);
    // asymmetric weathering: the upper-right took the hit, lower edge slumped
    const asym = (x > 0 && y > 0 ? 1.9 : (y < 0 ? 1.25 : 0.85));
    x += (srn() - 0.5) * (Math.abs(x) > 17.0 ? 2.1 + bite * 4.4 : 0.5 + bite * 3.2) * asym; // side walls eroded
    y += (srn() - 0.5) * (0.5 + bite * 3.4) * asym;
    if (z < 1.0) z += (srn() - 0.5) * (0.5 + bite * 2.2); // back + sides eroded
    if (edge > 0.97 && z > 1.0) { x -= Math.sign(x) * srn() * 2.4 * asym; y -= Math.sign(y) * srn() * 1.7 * asym; } // corner bites
    if (x > 16.0 && y > -5 && y < 3 && z > 1.0) x -= srn() * 2.2; // long gouge out of the right flank
    sa.setX(v, x); sa.setY(v, y); sa.setZ(v, z);
  }
  slabGeo.computeVertexNormals();
  const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({
    color: 0x4a3526, roughness: 0.88, metalness: 0.06, emissive: 0x2a160c, emissiveIntensity: 1.15,
  }));
  slab.position.z = -2.55; // front face at 1.2, thicker sculptural body; carved face stays clear
  group.add(slab);
  group.userData.update = (t, arc) => { mat.uniforms.uTime.value = t; mat.uniforms.uArc.value = arc; };
  return group;
}
export { SOSHIMI_DEPTH, VERDANT_DEPTH };
