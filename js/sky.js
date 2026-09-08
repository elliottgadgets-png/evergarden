// sky.js — living WebGL shader background. Hand-rolled, no libraries.
const VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;   // in pixels, y flipped
uniform float u_scroll; // 0..1 page progress

float hash(vec2 p){
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash(i), b = hash(i+vec2(1.,0.));
  float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, amp = 0.55;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for(int i=0;i<5;i++){
    v += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*u_res) / min(u_res.x, u_res.y);
  vec2 m = (u_mouse - 0.5*u_res) / min(u_res.x, u_res.y);

  float t = u_time * 0.05;

  // domain-warped flow
  vec2 p = uv * 1.6;
  p.y += u_scroll * 1.2;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0*q + vec2(1.7, 9.2) + 0.3*t),
                fbm(p + 3.0*q + vec2(8.3, 2.8) - 0.2*t));
  float f = fbm(p + 2.5*r);

  // palette: deep ink -> moss -> glow
  vec3 ink  = vec3(0.023, 0.039, 0.027);
  vec3 moss = vec3(0.070, 0.141, 0.102);
  vec3 fern = vec3(0.180, 0.360, 0.220);
  vec3 glow = vec3(0.624, 0.961, 0.784);
  vec3 acid = vec3(0.831, 1.000, 0.416);

  vec3 col = mix(ink, moss, smoothstep(0.15, 0.75, f));
  col = mix(col, fern, smoothstep(0.45, 0.95, f * length(q)));
  col = mix(col, glow, smoothstep(0.68, 1.0, f*f*f) * 0.5);

  // bioluminescent veins
  float vein = smoothstep(0.48, 0.5, f) * smoothstep(0.52, 0.5, f);
  col += acid * vein * 0.35;

  // mouse aura
  float d = length(uv - m);
  col += glow * exp(-d*d*6.0) * 0.16;
  col += acid * exp(-d*d*22.0) * 0.10;

  // breathing
  col *= 0.92 + 0.08 * sin(u_time * 0.4 + f * 4.0);

  // vignette
  float vig = smoothstep(1.25, 0.35, length(uv));
  col *= mix(0.55, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) { canvas.style.background = 'radial-gradient(circle at 50% 40%, #12241a, #060a07)'; return null; }

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uScroll = gl.getUniformLocation(prog, 'u_scroll');

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    canvas.width = Math.floor(innerWidth * DPR * 0.66);   // render at reduced res for perf
    canvas.height = Math.floor(innerHeight * DPR * 0.66);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  const mouse = { x: innerWidth/2, y: innerHeight/2, tx: innerWidth/2, ty: innerHeight/2 };
  window.addEventListener('pointermove', e => { mouse.tx = e.clientX; mouse.ty = e.clientY; });

  let scrollProgress = 0;

  function frame(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t * 0.001);
    gl.uniform2f(uMouse, mouse.x * DPR * 0.66, canvas.height - mouse.y * DPR * 0.66);
    gl.uniform1f(uScroll, scrollProgress);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return {
    frame,
    setScroll(p) { scrollProgress = p; }
  };
}
