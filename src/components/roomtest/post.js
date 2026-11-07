// 화면 후처리: 램프 빛 번짐(bloom) · 미니어처 흐림(틸트시프트) · 가장자리 어둡게(비네트)
//  구운 재질은 이미 톤매핑된 그림(toneMapped false)이고 실시간 재질은 렌더러 톤매핑을 받음 → 장면은 지금처럼 화면에 바로 그림
//  그 화면을 텍스처로 복사(copyFramebufferToTexture)해서 표시용 sRGB 값 그대로 후처리 → 다시 화면에 (색 변환 없음)
//  흐림 · 번짐은 1/2 → 1/16 해상도 피라미드에서 (작은 판 몇 장이라 가벼움)
import * as THREE from "three";

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 4 탭 평균으로 반으로 줄임 (텍셀 모서리에서 읽어 2×2 씩 섞임 → 4×4 상자 흐림)
const DOWN = /* glsl */ `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)) + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0))
         + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)) + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0));
  gl_FragColor = c * 0.25;
}`;

// 9 탭 텐트로 키움 (+ 같은 크기 판을 더하거나, 밝은 부분만 골라 더함)
const UP = /* glsl */ `uniform sampler2D tSrc; uniform sampler2D tAdd; uniform vec2 uTexel; uniform float uAddMode; uniform vec2 uThresh; varying vec2 vUv;
vec3 tent(vec2 uv) {
  vec3 c = texture2D(tSrc, uv).rgb * 4.0;
  c += (texture2D(tSrc, uv + vec2(uTexel.x, 0.0)).rgb + texture2D(tSrc, uv - vec2(uTexel.x, 0.0)).rgb
      + texture2D(tSrc, uv + vec2(0.0, uTexel.y)).rgb + texture2D(tSrc, uv - vec2(0.0, uTexel.y)).rgb) * 2.0;
  c += texture2D(tSrc, uv + uTexel).rgb + texture2D(tSrc, uv - uTexel).rgb
     + texture2D(tSrc, uv + vec2(uTexel.x, -uTexel.y)).rgb + texture2D(tSrc, uv + vec2(-uTexel.x, uTexel.y)).rgb;
  return c / 16.0;
}
vec3 bright(vec3 c) {                      // 밝은 곳만 (부드러운 문턱, 밝기 기준 → 크림 벽 · 주황 소파는 빼고 램프 · 전구만)
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThresh.x, uThresh.x + uThresh.y, l);
  return c * k;
}
void main() {
  vec3 c = tent(vUv);
  if (uAddMode > 1.5) c += bright(texture2D(tAdd, vUv).rgb);   // 번짐: 아래 판 + 이 크기의 밝은 부분
  else if (uAddMode > 0.5) c = bright(c);                       // 번짐 시작 (가장 작은 판)
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = /* glsl */ `uniform sampler2D tBase; uniform sampler2D tSoft; uniform sampler2D tBlur; uniform sampler2D tBloom;
uniform float uBloom; uniform float uTilt; uniform float uFocusY; uniform float uFocusHalf; uniform float uFocusRamp;
uniform float uVignette; uniform float uAspect; varying vec2 vUv;
void main() {
  vec3 base = texture2D(tBase, vUv).rgb;
  // 틸트시프트: 초점 띠(가로)에서 위아래로 멀어질수록 흐림 → 장난감 방(미니어처) 느낌
  float d = abs(vUv.y - uFocusY);
  float t = smoothstep(uFocusHalf, uFocusHalf + uFocusRamp, d) * uTilt;
  vec3 c = mix(base, texture2D(tSoft, vUv).rgb, smoothstep(0.0, 0.5, t));
  c = mix(c, texture2D(tBlur, vUv).rgb, smoothstep(0.35, 1.0, t));
  // 빛 번짐: 화면 더하기 (밝은 곳이 하얗게 타지 않게)
  vec3 b = texture2D(tBloom, vUv).rgb * uBloom;
  c = 1.0 - (1.0 - c) * (1.0 - b);
  // 비네트: 가장자리를 살짝 어둡게
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
  // 디더: 어두운 바탕의 비네트 · 흐림 그라데이션이 8bit 계단(링)으로 보이지 않게
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createPost(renderer) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(quad);
  const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const down = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = mk(UP, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uAddMode: { value: 0 }, uThresh: { value: new THREE.Vector2(0.86, 0.1) } });
  const comp = mk(COMPOSITE, {
    tBase: { value: null }, tSoft: { value: null }, tBlur: { value: null }, tBloom: { value: null },
    uBloom: { value: 0.45 }, uTilt: { value: 1 }, uFocusY: { value: 0.47 }, uFocusHalf: { value: 0.16 }, uFocusRamp: { value: 0.34 },
    uVignette: { value: 0.28 }, uAspect: { value: 1 },
  });
  const params = { enabled: true, bloom: 0.45, threshold: 0.86, knee: 0.1, tilt: 1, focusY: 0.47, focusHalf: 0.16, focusRamp: 0.34, vignette: 0.28 };

  let base = null, D = [], U = [], B = [], W = 0, H = 0;
  const rt = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const LEVELS = 4;
  function setSize(w, h) {
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    if (w === W && h === H) return;
    W = w; H = h;
    base?.dispose(); [...D, ...U, ...B].forEach((t) => t.dispose());
    base = new THREE.FramebufferTexture(w, h);
    base.minFilter = base.magFilter = THREE.LinearFilter;
    D = []; U = []; B = [];
    for (let i = 1; i <= LEVELS; i++) {
      const lw = Math.max(1, w >> i), lh = Math.max(1, h >> i);
      D.push(rt(lw, lh)); U.push(rt(lw, lh)); B.push(rt(lw, lh));
    }
  }
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); };

  // 장면을 화면에 그린 바로 뒤에 부름
  function run() {
    if (!params.enabled || !base) return;
    renderer.copyFramebufferToTexture(base);
    const prevAuto = renderer.autoClear; renderer.autoClear = false;
    // 줄이기: base → D1 → … → D4
    let src = base, sw = W, sh = H;
    for (let i = 0; i < LEVELS; i++) {
      down.uniforms.tSrc.value = src; down.uniforms.uTexel.value.set(0.5 / sw, 0.5 / sh);
      pass(down, D[i]); src = D[i].texture; sw = D[i].width; sh = D[i].height;
    }
    // 흐림: D4 → U3 → U2 → U1 (매끈하게 키우기만)
    up.uniforms.uAddMode.value = 0;
    src = D[LEVELS - 1].texture;
    for (let i = LEVELS - 2; i >= 0; i--) {
      up.uniforms.tSrc.value = src; up.uniforms.uTexel.value.set(1 / D[i + 1].width, 1 / D[i + 1].height);
      pass(up, U[i]); src = U[i].texture;
    }
    // 번짐: 가장 작은 판의 밝은 부분 → 키우며 각 크기의 밝은 부분을 더함
    up.uniforms.uThresh.value.set(params.threshold, params.knee);
    up.uniforms.uAddMode.value = 1; up.uniforms.tSrc.value = D[LEVELS - 1].texture;
    up.uniforms.uTexel.value.set(1 / D[LEVELS - 1].width, 1 / D[LEVELS - 1].height);
    pass(up, B[LEVELS - 1]);
    up.uniforms.uAddMode.value = 2;
    for (let i = LEVELS - 2; i >= 0; i--) {
      up.uniforms.tSrc.value = B[i + 1].texture; up.uniforms.tAdd.value = D[i].texture;
      up.uniforms.uTexel.value.set(1 / B[i + 1].width, 1 / B[i + 1].height);
      pass(up, B[i]);
    }
    // 합치기 → 화면
    const u = comp.uniforms;
    u.tBase.value = base; u.tSoft.value = D[0].texture; u.tBlur.value = U[0].texture; u.tBloom.value = B[0].texture;
    u.uBloom.value = params.bloom; u.uTilt.value = params.tilt; u.uFocusY.value = params.focusY;
    u.uFocusHalf.value = params.focusHalf; u.uFocusRamp.value = params.focusRamp; u.uVignette.value = params.vignette; u.uAspect.value = W / H;
    pass(comp, null);
    renderer.autoClear = prevAuto;
  }
  // 셰이더를 미리 컴파일 (처음 3D 로 넘어가는 프레임에서 멈칫하지 않게)
  function prewarm() {
    for (const m of [down, up, comp]) { quad.material = m; renderer.compileAsync(sc, cam).catch(() => {}); }
  }
  function dispose() {
    base?.dispose(); [...D, ...U, ...B].forEach((t) => t.dispose());
    quad.geometry.dispose(); down.dispose(); up.dispose(); comp.dispose();
  }
  return { params, setSize, run, prewarm, dispose };
}
