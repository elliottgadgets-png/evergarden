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
    float read = smoothstep(0.55, 0.85, uArc);
    vec3 p = position;
    p.z -= (d - 0.42) * 2.4 * (1.0 - read); // carved in; flattens to the true page at read
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RELIEF_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uMap, uDepth;
  uniform float uArc, uTime;
  uniform vec2 uTexel;
  varying vec2 vUv;
  vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  void main() {
    float d = texture2D(uDepth, vUv).r;
    float read = smoothstep(0.55, 0.85, uArc);
    float ignite = smoothstep(0.02, 0.22, uArc);
    float veinsPh = smoothstep(0.20, 0.35, uArc) * (1.0 - smoothstep(0.55, 0.80, uArc));
    vec3 raw = texture2D(uMap, vUv).rgb;
    // carved shading: normal from depth gradient, raking light
    float dx = texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r - texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r;
    float dy = texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r - texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r;
    vec3 n = normalize(vec3(-dx * 9.0, dy * 9.0, 1.0));
    float rake = max(dot(n, normalize(vec3(-0.55, 0.75, 0.6))), 0.0);
    // graded (world) color: desaturated, ember-charcoal cast, sunken
    float lum = dot(raw, vec3(0.299, 0.587, 0.114));
    vec3 graded = mix(raw, vec3(lum), 0.55) * vec3(0.95, 0.72, 0.5) * 0.5;
    graded *= 0.45 + 0.75 * rake;
    vec3 col = mix(graded, raw, read);
    // molten veins racing the carved channels
    vec2 uv = vUv * 7.0; float t = uTime * 0.25;
    vec2 i = floor(uv), f = fract(uv);
    float f1 = 8.0, f2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash2(i + g); o = 0.5 + 0.5 * sin(t + 6.2831 * o);
      float dd = length(g + o - f);
      if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
    }
    float web = smoothstep(0.0, 0.22, f2 - f1);
    float channels = smoothstep(0.52, 0.85, d); // veins live in the carving
    float flick = 0.8 + 0.2 * sin(uTime * 11.0) * sin(uTime * 6.7);
    col += vec3(1.0, 0.55, 0.18) * web * channels * veinsPh * flick * 2.4 * (1.0 - read);
    col += vec3(1.0, 0.62, 0.25) * ignite * (1.0 - read) * 0.10 * channels;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Art-directed depth map: authored regions over the screenshot composition
// (x, y, w, h in 0..1 of the image, y from top). Never auto-luminance.
function buildDepthTexture(spec) {
  const W = 450, H = 281;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = `rgb(${Math.round(spec.base * 255)},0,0)`; g.fillRect(0, 0, W, H);
  for (const [x, y, w, h, d] of spec.regions) {
    g.fillStyle = `rgb(${Math.round(d * 255)},0,0)`;
    g.fillRect(x * W, y * H, w * W, h * H);
  }
  g.filter = 'blur(9px)';
  g.drawImage(c, 0, 0);
  g.filter = 'blur(4px)';
  g.drawImage(c, 0, 0);
  g.filter = 'none';
  const tex = new THREE.CanvasTexture(c);
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

export function makeRelief({ map, depthSpec }) {
  const group = new THREE.Group();
  const depthTex = buildDepthTexture(depthSpec);
  const mat = new THREE.ShaderMaterial({
    vertexShader: RELIEF_VERT, fragmentShader: RELIEF_FRAG,
    uniforms: {
      uMap: { value: map }, uDepth: { value: depthTex },
      uArc: { value: 0 }, uTime: { value: 0 },
      uTexel: { value: new THREE.Vector2(1 / 450, 1 / 281) },
    },
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(26, 16.25, 110, 70), mat);
  face.position.z = 3.15;
  group.add(face);
  // basalt slab body
  const slabGeo = new THREE.BoxGeometry(35, 24, 5.5, 6, 5, 1);
  const sa = slabGeo.attributes.position; let ss = 977;
  const srn = () => { ss = (ss * 16807) % 2147483647; return ss / 2147483647; };
  for (let v = 0; v < sa.count; v++) {
    if (sa.getZ(v) > 1.0) continue; // face stays true for the carving
    sa.setX(v, sa.getX(v) + (srn() - 0.5) * 1.8);
    sa.setY(v, sa.getY(v) + (srn() - 0.5) * 1.3);
  }
  slabGeo.computeVertexNormals();
  const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({
    color: 0x211812, roughness: 0.94, metalness: 0.04, emissive: 0x120b06, emissiveIntensity: 0.7,
  }));
  group.add(slab);
  group.userData.update = (t, arc) => { mat.uniforms.uTime.value = t; mat.uniforms.uArc.value = arc; };
  return group;
}
export { SOSHIMI_DEPTH };
