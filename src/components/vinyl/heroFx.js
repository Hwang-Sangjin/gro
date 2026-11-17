// Hero 판 주변 효과 (Home 엔진 homeEngine.js 의 Hero 와 같은 그림 · 같은 값)
//  - 헤일로: 판 둘레를 따라 도는 손그림 붓 획. 빨라질수록 길고 많아짐 (기본 회전에선 아주 옅게 몇 개)
//  - 타이포 링 + 스트로보 점: 판 바로 바깥. 판 위에 올리거나 누르는 동안 서서히 나타남
//  - 빛줄기 속 먼지: 판 위 공기에 떠 있는 잉크 점. 빛줄기 축 근처에서만 보이고 판 속도에 끌려 맴돎
//  모두 "판 반지름 = 1, 판 두께 가운데 = y 0" 인 틀(group) 안에 있음 → 판의 기울기 틀(comp)에 붙여 씀
//  판 회전(spin)과는 따로: 링 · 그림자 · 먼지는 판이 돌아도 제자리 (헤일로 획만 속도로 끌려 돎)
import * as THREE from "three";
import { NOISE } from "./inkShaders";

export const HERO_SPIN = { rpm: 10 };
export const HERO_HOLD = { accel: 1.5, maxRpm: 45 };   // 누르는 동안 각가속도(rad/s²) · 최고 속도
const FX_IDLE = 0.07;        // 기본 회전 때 이펙트 강도
const STROKES = 48;          // 잉크 붓 획 개수
const HALO_INNER = 1.26;     // 헤일로 안쪽 경계 = 링 바로 바깥
const IDLE_STROKES = 5;      // 기본 회전 때 보이는 작은 획 수
const HALO_COLORS = ["#5b8fd1", "#4a7cc4", "#6f9edb", "#3f6fb3", "#8fbbe8", "#9fc6ee", "#7fb0e3", "#a8cbea"];
const DUST = { count: 420, rMin: 0.15, rMax: 1.75, yMin: 0.01, yMax: 0.55, drift: 0.035, beamPow: 4 };
const RPM2W = (Math.PI * 2) / 60;
const STROBE_N = 120, STROBE_S = (Math.PI * 2) / STROBE_N;
const hex3 = (hex) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };   // sRGB 값 그대로 (ShaderMaterial 은 색 변환 없음)

const PLANE_VERT = /* glsl */`
varying vec2 vP;
void main(){
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const HALO_FRAG = /* glsl */`
precision highp float;
varying vec2 vP;
uniform vec3 uInk;
uniform float uFx, uDir, uMajor, uInner;
uniform vec4 uSA[${STROKES}];
uniform vec4 uSB[${STROKES}];
uniform vec3 uSC[${STROKES}];
${NOISE}
const float TAU = 6.2831853;
const float PI = 3.14159265;
void main(){
  float r = length(vP);
  if (r < uInner || r > 1.9 || uFx <= 0.001) discard;
  float th = atan(vP.y, vP.x);
  float aa = fwidth(r);
  float dTh = length(fwidth(vP)) / r;
  vec3 inkCol = uInk;
  float axisW = mix(0.5, 1.0, pow(abs(cos(th - uMajor)), 1.2));
  float ink = 0.0;
  for (int i = 0; i < ${STROKES}; i++) {
    vec4 A = uSA[i];
    vec4 B = uSB[i];
    float on = smoothstep(B.z, B.z + 0.06, uFx);
    if (on <= 0.0) continue;
    float grow = smoothstep(0.0, 0.65, uFx);
    float W = A.y * mix(0.28, 1.0, grow);
    float d = r - A.x;
    if (abs(d) > W + aa * 2.0) continue;
    float L = A.z * mix(0.16, 1.0, grow);
    float phi = mod(th + A.w, TAU);
    if (phi > L) continue;
    float s = phi / L;
    float head = uDir < 0.0 ? s : 1.0 - s;
    float prof = pow(sin(PI * clamp(head * 0.88 + 0.08, 0.0, 1.0)), 0.5) * mix(0.3, 1.0, head);
    float w = W * prof;
    float body = 1.0 - smoothstep(w - aa, w + aa, abs(d));
    if (body <= 0.0) continue;
    float across = d / max(W, 1e-4);
    float n = noise3(vec3(across * 9.0, phi * 1.6, B.w));
    float n2 = noise3(vec3(across * 26.0, phi * 0.7, B.w + 7.0));
    float dry = mix(0.5, 0.06, head);
    float strand = smoothstep(dry - 0.06, dry + 0.06, n * 0.7 + n2 * 0.3);
    float seg = 1.0;
    if (B.x > 0.5) {
      float t = phi * B.y / TAU;
      float ft = dTh * B.y / TAU;
      seg = 1.0 - smoothstep(0.58 - ft, 0.58 + ft, fract(t));
      seg = mix(seg, 0.58, smoothstep(0.35, 0.7, ft));
      strand = max(strand, 0.75);
    }
    float innerFade = smoothstep(uInner, uInner + 0.03, r);
    float a = body * strand * seg * on * axisW * innerFade * (0.8 + 0.2 * fract(B.w));
    if (a > ink) { ink = a; inkCol = uSC[i]; }
  }
  ink = clamp(ink, 0.0, 1.0);
  gl_FragColor = vec4(inkCol * ink, ink);
}`;

const RIM_FRAG = /* glsl */`
precision highp float;
varying vec2 vP;
uniform sampler2D uText;
uniform vec3 uInk;
uniform vec3 uTextCol;
uniform float uAngle, uBlur, uP33, uP45, uLock33, uLock45, uReveal;
const float TAU = 6.2831853;
float ringPx(float r, float R, float px){
  float d = abs(r - R) / max(fwidth(r), 1e-6);
  return 1.0 - smoothstep(px - 0.6, px + 0.6, d);
}
float band(float r, float a, float b){
  float fw = fwidth(r);
  return smoothstep(a - fw, a + fw, r) * (1.0 - smoothstep(b - fw, b + fw, r));
}
float dots(float th, float phase, float N, float dTh, float duty){
  float t = (th + phase) * N / TAU;
  float ft = dTh * N / TAU;
  float d = abs(fract(t) - 0.5);
  float v = 1.0 - smoothstep(duty * 0.5 - ft, duty * 0.5 + ft, d);
  return mix(v, duty, smoothstep(0.35, 0.7, ft));
}
void main(){
  if (uReveal <= 0.001) discard;
  float rTrue = length(vP);
  float rev = uReveal * uReveal * (3.0 - 2.0 * uReveal);
  float r = rTrue + (1.0 - rev) * 0.05;
  if (rTrue < 1.0 || r > 1.26) discard;
  float th = atan(vP.y, vP.x);
  float dTh = length(fwidth(vP)) / rTrue;
  float ink = 0.0;
  float textA = 0.0;
  float a33 = 0.55 + 0.45 * uLock33;
  float a45 = 0.55 + 0.45 * uLock45;
  ink = max(ink, band(r, 1.028, 1.047) * dots(th, uP33, 120.0, dTh, 0.42) * a33);
  ink = max(ink, band(r, 1.057, 1.076) * dots(th, uP45, 120.0, dTh, 0.42) * a45);
  ink = max(ink, ringPx(r, 1.017, 0.5) * 0.55);
  ink = max(ink, ringPx(r, 1.087, 0.5) * 0.55);
  float r0 = 1.108, r1 = 1.212;
  if (r > r0 && r < r1) {
    float u = -(th + uAngle) / TAU;
    float v = (r1 - r) / (r1 - r0);
    vec2 px = dFdx(vP), py = dFdy(vP);
    float r2 = r * r;
    vec2 gx = vec2(-(vP.x * px.y - vP.y * px.x) / r2 / TAU, -dot(vP, px) / r / (r1 - r0));
    vec2 gy = vec2(-(vP.x * py.y - vP.y * py.x) / r2 / TAU, -dot(vP, py) / r / (r1 - r0));
    float a = 0.0;
    for (int i = 0; i < 9; i++) {
      float o = (float(i) / 8.0 - 0.5) * uBlur;
      a += textureGrad(uText, vec2(u + o, v), gx, gy).a;
    }
    a /= 9.0;
    textA = clamp(a * (1.0 + uBlur * 18.0), 0.0, 1.0) * 0.92;
  }
  ink = max(ink, ringPx(r, 1.232, 0.5) * 0.45);
  vec4 cT = vec4(uTextCol * textA, textA);
  vec4 cS = vec4(uInk * ink, ink);
  gl_FragColor = (cT + cS * (1.0 - cT.a)) * rev;
}`;

/**
 * @param {{ ink: {value: THREE.Vector3}, renderer: THREE.WebGLRenderer, reduced?: boolean, textColor?: string, paper?: string }} o
 *  ink: 판 잉크 색 uniform (판 셰이더와 같은 것을 넘기면 같이 바뀜)
 */
export function createHeroFx({ ink, renderer, reduced = false, textColor = "#4c404a", paper = "#f4e7cd" }) {
  const group = new THREE.Group();
  group.name = "heroFx";
  const common = { transparent: true, premultipliedAlpha: true, depthWrite: false };

  // (스케치 그림자는 뺌 — 2026-11-15 사용자 요청: 판 뒤 그림자 무늬 없이)

  // ── 헤일로 (붓 획)
  const haloUniforms = {
    uInk: ink, uFx: { value: 0 }, uDir: { value: -1 }, uMajor: { value: 0 }, uInner: { value: HALO_INNER },
    uSA: { value: Array.from({ length: STROKES }, () => new THREE.Vector4()) },   // 반지름, 굵기, 길이, 현재 각도
    uSB: { value: Array.from({ length: STROKES }, () => new THREE.Vector4()) },   // 끊김 여부, 끊김 개수, 등장 속도, 시드
    uSC: { value: Array.from({ length: STROKES }, () => new THREE.Vector3()) },   // 획 색
  };
  const strokeMeta = Array.from({ length: STROKES }, () => ({ angle: 0, lag: 1 }));
  const rollStroke = (i) => {
    const rnd = Math.random;
    const far = rnd() ** 1.5;
    const A = haloUniforms.uSA.value[i], B = haloUniforms.uSB.value[i];
    const R = HALO_INNER + 0.012 + far * 0.55;
    const W = (0.0035 + rnd() ** 1.6 * 0.035) * (1 - far * 0.5);
    const L = 0.18 + rnd() ** 1.1 * 1.7;
    const dashed = rnd() < 0.1 + far * 0.35 ? 1 : 0;
    const dashN = 70 + rnd() * 120;
    const appearAt = i < IDLE_STROKES ? rnd() * 0.03 : 0.08 + rnd() ** 1.25 * 0.72;
    A.set(R, W, L, strokeMeta[i].angle);
    B.set(dashed, dashN, appearAt, rnd() * 100);
    haloUniforms.uSC.value[i].copy(hex3(HALO_COLORS[Math.floor(rnd() * HALO_COLORS.length)]));
    strokeMeta[i].lag = 0.5 + rnd() * 0.5 * (1 - far * 0.4);
    if (strokeMeta[i].angle === 0) strokeMeta[i].angle = rnd() * Math.PI * 2;
  };
  for (let i = 0; i < STROKES; i++) rollStroke(i);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: HALO_FRAG, uniforms: haloUniforms, side: THREE.DoubleSide, ...common }));
  halo.renderOrder = 1;
  group.add(halo);

  // ── 타이포 링 + 스트로보
  let sideB = false;
  const rimText = () => `GROOVES  ·  VINYL CULTURE HUB  ·  NOW SPINNING  ·  SIDE ${sideB ? "B" : "A"}  ·  33⅓ / 45 RPM  ·  `;
  const textCanvas = document.createElement("canvas");
  textCanvas.width = 8192; textCanvas.height = 256;
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.wrapS = THREE.RepeatWrapping; textTex.wrapT = THREE.ClampToEdgeWrapping;
  textTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  textTex.colorSpace = THREE.NoColorSpace;
  const drawRimText = () => {
    const ctx = textCanvas.getContext("2d");
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.fillStyle = "#fff"; ctx.textBaseline = "middle";
    ctx.font = "600 150px 'Hahmlet', 'Helvetica Neue', Arial, sans-serif";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "22px";
    const text = rimText(), w = ctx.measureText(text).width, n = Math.max(1, Math.round(textCanvas.width / w));
    ctx.save(); ctx.scale(textCanvas.width / (w * n), 1);
    for (let i = 0; i < n; i++) ctx.fillText(text, i * w, textCanvas.height / 2 + 6);
    ctx.restore();
    textTex.needsUpdate = true;
  };
  drawRimText();
  document.fonts?.ready.then(drawRimText);
  const rimUniforms = {
    uInk: ink, uText: { value: textTex }, uAngle: { value: 0 }, uBlur: { value: 0 },
    uP33: { value: 0 }, uP45: { value: 0 }, uLock33: { value: 0 }, uLock45: { value: 0 },
    uReveal: { value: 0 }, uTextCol: { value: hex3(textColor) },
  };
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: RIM_FRAG, uniforms: rimUniforms, side: THREE.DoubleSide, ...common }));
  rim.renderOrder = 1; rim.visible = false;
  group.add(rim);
  const strobeRows = [
    { key: "uP33", lock: "uLock33", f: (33.333 * RPM2W) / STROBE_S },
    { key: "uP45", lock: "uLock45", f: (45 * RPM2W) / STROBE_S },
  ];

  // ── 먼지
  const spawnDust = (d, initial) => {
    const u = Math.random();
    d.r = Math.sqrt(DUST.rMin ** 2 + u * (DUST.rMax ** 2 - DUST.rMin ** 2));
    d.th = Math.random() * Math.PI * 2;
    d.y = DUST.yMin + Math.random() ** 1.6 * (DUST.yMax - DUST.yMin);
    d.vth = 0; d.seed = Math.random() * 1000;
    d.size = 2.2 + Math.random() ** 3 * 3.6;
    d.life = initial ? 1 : 0;
    d.tw = 0.6 + Math.random() * 0.4;
    return d;
  };
  const dustState = Array.from({ length: DUST.count }, () => spawnDust({}, true));
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST.count * 3), dustAlpha = new Float32Array(DUST.count), dustSize = new Float32Array(DUST.count);
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
  dustGeo.setAttribute("aAlpha", new THREE.BufferAttribute(dustAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  dustGeo.setAttribute("aSize", new THREE.BufferAttribute(dustSize, 1).setUsage(THREE.DynamicDrawUsage));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uInk: ink, uPaper: { value: hex3(paper) }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      attribute float aAlpha; attribute float aSize; uniform float uPixelRatio; varying float vAlpha;
      void main(){ vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPixelRatio; }`,
    fragmentShader: /* glsl */`
      precision highp float; uniform vec3 uInk; uniform vec3 uPaper; varying float vAlpha;
      void main(){
        if (vAlpha <= 0.002) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c * vec2(1.0, 1.12));
        float shape = 1.0 - smoothstep(0.38, 0.5, d);
        float core = 1.0 - smoothstep(0.18, 0.3, d);
        vec3 col = mix(uInk, uPaper, core);
        float a = shape * vAlpha;
        gl_FragColor = vec4(col * a, a);
      }`,
    ...common,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.renderOrder = 3; dust.frustumCulled = false;
  group.add(dust);

  let fxLevel = 0, airOmega = 0;
  /**
   * 한 프레임
   * @param {number} dt
   * @param {{ omega:number, angle:number, major:number, cursor?:THREE.Vector2|null, ring?:boolean, fade?:number, time:number }} s
   *  omega: 판 각속도(rad/s, 음수 = 시계) · angle: 판 회전각 · major: 빛줄기 축(이 틀의 xz 각도)
   *  cursor: 이 틀 xz 평면 위 커서 자리 (먼지가 비켜감, 없으면 null) · ring: 타이포 링을 보일지 · fade: 효과 전체 세기(0..1)
   */
  const update = (dt, { omega, angle, major, cursor = null, ring = false, fade = 1, time }) => {
    // 속도 → 이펙트 강도 (올라갈 땐 빠르게, 내려갈 땐 천천히)
    const rpmNow = (Math.abs(omega) * 60) / (Math.PI * 2);
    const fxNorm = THREE.MathUtils.clamp((rpmNow - HERO_SPIN.rpm) / (HERO_HOLD.maxRpm - HERO_SPIN.rpm), 0, 1);
    const fxTarget = Math.max(fxNorm, FX_IDLE * Math.min(1, rpmNow / HERO_SPIN.rpm));
    fxLevel += (fxTarget - fxLevel) * (1 - Math.exp(-dt / (fxTarget > fxLevel ? 0.12 : 0.7)));
    haloUniforms.uFx.value = Math.min(1, Math.pow(fxLevel, 0.8)) * fade;
    if (Math.abs(omega) > 0.05) haloUniforms.uDir.value = Math.sign(omega);
    haloUniforms.uMajor.value = major;
    for (let i = 0; i < STROKES; i++) {
      const m = strokeMeta[i];
      m.angle = (m.angle - omega * m.lag * dt) % (Math.PI * 2);
      haloUniforms.uSA.value[i].w = m.angle;
      if (haloUniforms.uFx.value < haloUniforms.uSB.value[i].z - 0.05 && Math.random() < dt * 0.35) rollStroke(i);
    }
    halo.visible = haloUniforms.uFx.value > 0.001;

    // 타이포 링: 판과 함께 돌고, 빠를수록 번짐 · 스트로보
    const TAU = Math.PI * 2;
    rimUniforms.uAngle.value = ((angle % TAU) + TAU) % TAU;
    rimUniforms.uBlur.value = Math.min(0.045, Math.max(0, Math.abs(omega) - HERO_SPIN.rpm * RPM2W) * 0.012);
    const w = Math.abs(omega);
    for (const row of strobeRows) {
      let k = (w / row.f) / STROBE_S;
      k -= Math.round(k);
      rimUniforms[row.key].value = (rimUniforms[row.key].value - Math.sign(omega || -1) * k * STROBE_S * row.f * dt) % TAU;
      const lock = 1 - THREE.MathUtils.smoothstep(Math.abs(k), 0.0, 0.06);
      rimUniforms[row.lock].value += (lock - rimUniforms[row.lock].value) * (1 - Math.exp(-dt / 0.15));
    }
    const ringTarget = ring && fade > 0.5 ? 1 : 0;
    rimUniforms.uReveal.value += (ringTarget - rimUniforms.uReveal.value) * (1 - Math.exp(-dt / (ringTarget > rimUniforms.uReveal.value ? 0.35 : 0.6)));
    rimUniforms.uReveal.value *= fade > 0.99 ? 1 : fade;
    rim.visible = rimUniforms.uReveal.value > 0.001;

    // 먼지
    dust.visible = fade > 0.001;
    if (!dust.visible) return;
    airOmega += (omega - airOmega) * (1 - Math.exp(-dt / 0.6));
    const speedN = Math.min(1, Math.abs(airOmega) / (HERO_HOLD.maxRpm * RPM2W));
    const drift = reduced ? 0 : DUST.drift;
    for (let i = 0; i < DUST.count; i++) {
      const d = dustState[i];
      const near = d.r < 1 ? 1 : Math.exp(-(d.r - 1) / 0.45);
      const low = Math.exp(-d.y / 0.35);
      d.vth += (airOmega * near * low - d.vth) * (1 - Math.exp(-dt / 0.5));
      d.th += d.vth * dt;
      const n1 = Math.sin(time * 0.31 + d.seed) + Math.sin(time * 0.17 + d.seed * 1.7);
      const n2 = Math.cos(time * 0.23 + d.seed * 0.7) + Math.sin(time * 0.11 + d.seed * 2.3);
      d.th += (n1 * drift * 0.5 / Math.max(d.r, 0.3)) * dt;
      d.r += n2 * drift * 0.35 * dt;
      d.y += Math.sin(time * 0.4 + d.seed * 3.1) * drift * 0.2 * dt;
      d.r += d.vth * d.vth * d.r * 0.004 * dt;
      if (cursor && !reduced) {
        const x = Math.cos(d.th) * d.r, z = Math.sin(d.th) * d.r;
        const dx = x - cursor.x, dz = z - cursor.y, dist2 = dx * dx + dz * dz;
        if (dist2 < 0.09) {
          const push = (1 - dist2 / 0.09) * 0.25 * dt, len = Math.sqrt(dist2) || 1;
          const nx = x + (dx / len) * push, nz = z + (dz / len) * push;
          d.r = Math.hypot(nx, nz); d.th = Math.atan2(nz, nx);
        }
      }
      d.y = THREE.MathUtils.clamp(d.y, DUST.yMin, DUST.yMax);
      if (d.r > DUST.rMax || d.r < DUST.rMin * 0.5) spawnDust(d, false);
      d.life = Math.min(1, d.life + dt / 1.2);
      const beam = Math.pow(Math.abs(Math.cos(d.th - major)), DUST.beamPow);
      const edgeFade = 1 - THREE.MathUtils.smoothstep(d.r, DUST.rMax * 0.8, DUST.rMax);
      const twinkle = d.tw + (1 - d.tw) * Math.sin(time * 1.3 + d.seed * 5.0);
      const alpha = (0.03 + 0.97 * beam) * (0.6 + 0.4 * speedN) * twinkle * edgeFade * d.life * fade;
      const j = i * 3;
      dustPos[j] = Math.cos(d.th) * d.r; dustPos[j + 1] = d.y; dustPos[j + 2] = Math.sin(d.th) * d.r;
      dustAlpha[i] = Math.max(0, alpha);
      dustSize[i] = d.size * (0.85 + 0.35 * beam);
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.aAlpha.needsUpdate = true;
    dustGeo.attributes.aSize.needsUpdate = true;
  };

  return {
    group, update,
    /** 스트릭(빛줄기) 세기: 판 셰이더의 uStreak · uSharp 를 이펙트 강도에 맞춤 */
    streak: () => ({ streak: 1.1 + 0.5 * haloUniforms.uFx.value, sharp: 60 - 24 * haloUniforms.uFx.value }),
    setPixelRatio: (pr) => { dustMat.uniforms.uPixelRatio.value = pr; },
    setSideB: (b) => { if (b !== sideB) { sideB = b; drawRimText(); } },
    // 테마(크림 ↔ 브라운)가 바뀔 때: 타이포 링 글자색 · 먼지 바탕색
    setTheme: ({ text, paper: bg }) => { rimUniforms.uTextCol.value.copy(hex3(text)); dustMat.uniforms.uPaper.value.copy(hex3(bg)); },
    dispose: () => { textTex.dispose(); group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); },
  };
}
