// Grooves Home stage engine — 프로토타입(grooves-ink-vinyl.html)의 Three.js 코드를 그대로 옮긴 것.
// React(HomeStage.jsx)가 마크업을 그리고, 이 엔진이 3D·섹션 전환·입력·DOM 연출을 맡는다.
//
//  섹션: 0 Hero → 1 New Vinyls → 2 Genre dial → 3 News (휠·터치·키보드로 한 칸씩)
//  페이지 사이 이동(Crate Flip)과 앨범 커버 이동 전환은 기존 시스템이 그대로 담당.
//  튜닝 값은 각 블록 위의 대문자 상수(SPIN, HOLD, RING, DIAL, WAVE, BEAT ...)와 homeGenres.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createNvReel, REEL_LAYOUT } from './nvReel';

/**
 * @param {object} opts
 * @param {HTMLElement} opts.root            HomeStage 루트 (이 안의 #id만 찾음)
 * @param {string} opts.modelUrl             vinyl.glb
 * @param {string} [opts.dracoPath]
 * @param {Array} opts.genres                [{ slug, name, ink, label, desc }]
 * @param {object} [opts.genreWave]          slug → 파동 성격
 * @param {(slug: string) => Promise<Array<{url?: string, color?: string}>>} [opts.getGenreCovers]
 * @param {Array} [opts.albums]              [{ slug, title, artist, image, color }]
 * @param {boolean} [opts.introDone]
 * @param {number} [opts.initialSection]
 * @param {number} [opts.initialDial]
 * @param {(n: number) => void} [opts.onSectionChange]
 * @param {(a: {slug, color, imageUrl, rect}) => void} [opts.onOpenAlbum]
 */
export async function createHomeEngine(opts) {
  const host = opts.root;   // DOM 루트 (아래 root는 Three.js 그룹)
  const q = (id) => host.querySelector(`#${id}`);
  let disposed = false;
  // 모델을 불러오는 동안(await) 이미 등록된 이벤트가 아직 선언 전인 상태(section 등)를 건드리지 않도록,
  // 준비가 끝날 때까지 모든 이벤트를 무시
  let ready = false;
  let introDone = !!opts.introDone;
  const cleanups = [];
  // 사이트 다크 모드(헤더 테마 버튼): 크림 ↔ 브라운을 맞바꿈 → Hero 는 브라운, New Vinyls 는 크림에서 시작
  let siteDark = document.documentElement.dataset.theme === 'dark';
  // 페이지 전환·앨범 전환 중이거나 인트로 전이면 입력을 받지 않음
  const inputOn = () => !disposed && introDone
    && document.documentElement.dataset.crateTransition !== 'true'
    && document.documentElement.dataset.albumTransition !== 'true'
    && !host.closest('[inert]');
  const GUARDED = new Set(['keydown', 'wheel', 'touchstart', 'touchmove', 'touchend', 'pointerdown']);
  function on(target, type, fn, o) {
    const wrapped = (e) => {
      if (disposed || !ready) return;
      if (GUARDED.has(type) && !inputOn()) return;
      fn(e);
    };
    target.addEventListener(type, wrapped, o);
    cleanups.push(() => target.removeEventListener(type, wrapped, o));
  }
  const dracoLoader = new DRACOLoader().setDecoderPath(opts.dracoPath ?? '/draco/');
  // 휠·터치는 이 페이지 레이어 전체(상단 내비게이션 포함)에서 받음
  const layer = host.closest('.ct-page') ?? host;
  const loadGLTF = (url) => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    return loader.loadAsync(url);
  };

  const NOISE = /* glsl */`
  float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise3(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
                   mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                   mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  // 화면 픽셀 기준 두께의 링(선)
  float ring(float v, float c, float px){
    float d = abs(v - c) / max(fwidth(v), 1e-6);
    return 1.0 - smoothstep(px - 0.6, px + 0.6, d);
  }
  // 주기 패턴 위 선: 밀도(0..1)만큼 굵어지고, 너무 촘촘하면 평균 톤으로 페이드(모아레 방지)
  float hatch(float coord, float density){
    float fw = fwidth(coord);
    float d = abs(fract(coord) - 0.5);
    float halfW = 0.5 * density;
    float line = 1.0 - smoothstep(halfW - fw, halfW + fw, d);
    line *= step(0.001, density);
    return mix(line, density * 0.8, smoothstep(0.38, 0.8, fw));
  }
  `;
  const discVert = /* glsl */`
  varying vec3 vLocal;
  varying vec3 vLocalN;
  void main(){
    vLocal = position;
    vLocalN = normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }`;
  const discFrag = /* glsl */`
  precision highp float;
  varying vec3 vLocal;
  varying vec3 vLocalN;
  uniform vec3 uInk, uLabel;
  uniform vec3 uCamLocal, uLightLocal;
  uniform float uLineFreq, uStreak, uSharp, uRough, uWobble, uBase;
  uniform float uTrackCount, uGapWidth, uInnerR, uOuterR, uLabelR, uHoleR, uTopY, uBotY;
  ${NOISE}

  vec4 over(vec4 top, vec4 bottom){ // premultiplied over
    return top + bottom * (1.0 - top.a);
  }

  void main(){
    vec3 p = vLocal;
    float r = length(p.xz);
    vec2 cs = p.xz / max(r, 1e-5);
    float isSide = 1.0 - smoothstep(0.3, 0.7, abs(vLocalN.y));

    // 손떨림: 반지름을 θ 방향 노이즈로 살짝 흔듦
    float rr = r + (noise3(vec3(cs * 3.0, r * 4.0)) - 0.5) * uWobble;

    // ---- 조명: Kajiya-Kay (홈 방향 = 원주 방향) ----
    vec3 V = normalize(uCamLocal - p);
    // 보이는 면이 항상 카메라를 향하도록 (모델 노멀 방향과 무관)
    vec3 N = isSide > 0.5 ? faceforward(normalize(vLocalN), -V, normalize(vLocalN)) : vec3(0.0, V.y >= 0.0 ? 1.0 : -1.0, 0.0);
    vec3 L = normalize(uLightLocal);
    vec3 T = vec3(-cs.y, 0.0, cs.x);
    vec3 H = normalize(L + V);
    float th = dot(T, H);
    float kk = sqrt(max(0.0, 1.0 - th * th));
    float spec = pow(kk, uSharp) + 0.35 * pow(kk, uSharp * 0.12);
    spec *= smoothstep(0.0, 0.15, dot(N, V)) * smoothstep(-0.1, 0.25, dot(N, L));

    vec4 col = vec4(0.0);

    if (isSide > 0.5) {
      // ---- 옆면: 세로 해칭 + 위/아래 모서리 선 ----
      float a = atan(p.z, p.x) / 6.2831853;
      float shade = 0.35 + 0.45 * (1.0 - max(dot(N, L), 0.0));
      float n = noise3(vec3(cs * 6.0, p.y * 40.0));
      float v = hatch(a * 720.0, clamp(shade + (n - 0.5) * 0.3, 0.0, 1.0) * 0.55);
      float edge = max(ring(p.y, uTopY, 1.1), ring(p.y, uBotY, 1.3));
      float ink = max(v, edge);
      // 홈 영역 경계의 작은 턱은 그냥 선 한 줄처럼
      if (r < uOuterR + 0.01) ink = max(ink, 0.85);
      col = vec4(uInk * ink, ink);
    } else {
      float ink = 0.0;
      vec4 fill = vec4(0.0);

      if (r < uLabelR) {
        // ---- 라벨: 옅은 블루 면 + 동심원 몇 줄 + 테두리 ----
        fill = vec4(uLabel, 1.0) * 0.9;
        float rings = max(ring(rr, uLabelR * 0.91, 0.6), ring(rr, uLabelR * 0.84, 0.5));
        rings = max(rings, ring(rr, uLabelR * 0.42, 0.5));
        rings = max(rings, ring(rr, uLabelR * 0.30, 0.5));
        ink = max(rings * 0.75, ring(r, uLabelR, 1.2));
        ink = max(ink, ring(r, uHoleR, 1.2));
        ink = max(ink, spec * uStreak * 0.12 * hatch(rr * uLineFreq * 0.6, 0.3));
      } else if (r < uInnerR) {
        // ---- 런아웃: 아주 성긴 선 ----
        float n = noise3(vec3(cs * 2.5, r * 70.0));
        float d = clamp(uBase * 0.6 + spec * uStreak * 0.5 + (n - 0.5) * 0.4 * uRough, 0.0, 1.0);
        ink = hatch(rr * uLineFreq * 0.35, d * 0.5) * 0.8;
        ink = max(ink, ring(r, uInnerR, 0.8));
      } else if (r < uOuterR) {
        // ---- grooves: 빛줄기 = 잉크 밀도 ----
        float n = noise3(vec3(cs * 2.2, r * 85.0));          // r로 빠르게, θ로 느리게 → 불꽃 모양 스트로크
        float n2 = noise3(vec3(cs * 9.0, r * 300.0));
        float d = uBase + spec * uStreak;
        d += (n - 0.5) * 0.9 * uRough + (n2 - 0.5) * 0.25 * uRough;
        d = smoothstep(0.08, 0.95, d);

        // 트랙 사이 gap: 해칭 없음 + 경계선
        float span = (uOuterR - uInnerR) / uTrackCount;
        float t = (r - uInnerR) / span;
        float dist = abs(fract(t + 0.5) - 0.5) * span;
        float interior = step(0.5, t) * step(t, uTrackCount - 0.5);
        float gap = interior * (1.0 - smoothstep(uGapWidth * 0.5, uGapWidth * 0.5 + 0.002, dist));
        ink = hatch(rr * uLineFreq, d) * (1.0 - gap);
        float k = floor(t + 0.5);
        if (interior > 0.5) ink = max(ink, ring(r, uInnerR + k * span, 0.7) * 0.9);
      } else {
        // ---- 바깥 테두리 ----
        ink = max(ring(r, uOuterR, 0.7) * 0.8, ring(r, 0.997, 1.4));
      }
      col = over(vec4(uInk * ink, ink), fill);
    }

    gl_FragColor = col;   // premultiplied, 종이 부분은 투명
  }`;
  const shadowVert = /* glsl */`
  varying vec2 vXZ;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vXZ = wp.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
  const shadowFrag = /* glsl */`
  precision highp float;
  varying vec2 vXZ;
  uniform vec3 uInk;
  uniform vec2 uCenter;
  uniform vec2 uRadius;
  uniform float uShadow, uRough;
  ${NOISE}
  void main(){
    vec2 q = (vXZ - uCenter) / uRadius;
    float len = length(q);
    vec2 cs = q / max(len, 1e-5);
    float n = noise3(vec3(cs * 2.0, len * 14.0));
    float n2 = noise3(vec3(q * 9.0, 3.0));
    float body = 1.0 - smoothstep(0.35, 1.05 + (n - 0.5) * 0.25, len);
    float d = clamp(body * uShadow * 0.75 + (n2 - 0.5) * 0.35 * uRough * body, 0.0, 1.0);
    float scrib = hatch(dot(q, vec2(0.8, 0.6)) * 34.0 + (n2 - 0.5) * 1.6, d * 0.55);
    float lines = max(hatch(len * 16.0 + (n - 0.5) * 1.2, d * 0.4), scrib * smoothstep(0.55, 0.75, n) * body);
    // 바깥으로 퍼지는 몇 줄의 스케치 링
    float halo = 0.0;
    for (int i = 0; i < 3; i++) {
      float R = 1.05 + float(i) * 0.09 + (noise3(vec3(cs * 1.5, float(i))) - 0.5) * 0.06;
      halo = max(halo, ring(len, R, 0.5) * (0.55 - float(i) * 0.15));
    }
    float ink = max(lines, halo * uShadow);
    ink *= 1.0 - smoothstep(1.2, 1.45, len);
    gl_FragColor = vec4(uInk * ink, ink) * 0.45;
  }`;

  /* ================= 구도 (heroComposition과 동일) ================= */
  const HERO_COMPOSITION = {
    tilt: (40 * Math.PI) / 180,
    roll: (33 * Math.PI) / 180,
    // 판 지름이 스테이지에서 차지하는 비율. 바깥 타이포 링(판의 약 1.3배)까지 화면 안에 들어오게
    widthFraction: 0.58, compactWidthFraction: 0.74, heightFraction: 0.68,
    reservePx: 24,                // 아래 여백
  };
  function getHeroRecordScale(width, height, pixelHeight) {
    const { tilt, roll, widthFraction, compactWidthFraction, heightFraction } = HERO_COMPOSITION;
    const shortAxis = Math.sin(tilt), c = Math.cos(roll), s = Math.sin(roll);
    const thickness = 0.021497 * Math.cos(tilt);
    const projectedWidth = 2 * Math.hypot(c, shortAxis * s) + thickness * Math.abs(s);
    const projectedHeight = 2 * Math.hypot(s, shortAxis * c) + thickness * Math.abs(c);
    const portraitBlend = Math.min(1, Math.max(0, (1.25 - width / height) / 0.5));
    const targetWidth = widthFraction + (compactWidthFraction - widthFraction) * portraitBlend;
    const safeHeightFraction = Math.min(heightFraction, Math.max(0.1, 1 - HERO_COMPOSITION.reservePx / pixelHeight));
    return Math.min((width * targetWidth) / projectedWidth, (height * safeHeightFraction) / projectedHeight);
  }

  /* ================= 착륙 구도 (New Vinyls 섹션) ================= */
  // 스크롤하면 판이 따라 내려오며 한 바퀴 돌고, 릴 맨 앞 슬리브 위에 정면을 보고 섬 → 릴이 들어오면 슬리브에 꽂힘
  // 자리·크기는 매 프레임 릴(nvReel)의 맨 앞 슬리브에서 계산 (nvDiscTarget)
  const LANDED_COMPOSITION = {
    tilt: Math.PI / 2,            // 판이 정면을 봄
    roll: -0.07,                  // 릴 기울기와 같게 (nvReel REEL_LAYOUT.ROLL)
  };
  // 전환 타임라인 (진행도 0 = Hero, 1 = New Vinyls). 진행도는 '섹션 전환' 트윈이 시간에 따라 움직임
  const SCROLL = {
    heroEnd: 0.03,                         // 이 지점까지는 Hero 기능(링·헤일로·누르기·뒤집기) 그대로
    fxOutEnd: 0.12,                        // 링·헤일로가 사라지는 시점
    // 구간끼리 조금씩 겹쳐서 멈췄다 가는 느낌 없이 이어지게 (진행도 자체는 시간에 대해 일정 속도)
    standEnd: 0.26,                        // 이때까지 판이 일어서서 정면(원)을 보며 앨범 위 기다리는 자리로
    spinStart: 0.12, spinEnd: 0.47,        // 이 구간에서 세로축으로 한 바퀴 (원 → 세로 1자 → 원)
    riseStart: 0.0, riseEnd: 0.46,         // 앨범 하나가 화면 아래에서 올라옴 (반시계 90° 누운 채: 열린 쪽이 위)
    insertStart: 0.42, insertEnd: 0.7,     // 판이 위에서 앨범 안으로 스르륵
    turnStart: 0.62, turnEnd: 0.92,        // 판이 든 앨범이 원래 방향으로 돌아서며 제자리로 올라감 (열린 쪽이 오른쪽)
    albumTrigger: 0.84,                    // 그 뒤 나머지 앨범이 차례로 나타남 (이후는 시간으로 자동 재생)
  };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp01((p - a) / (b - a));

  /* ================= 회전 (InkVinyl과 동일) ================= */
  const SPIN = { rpm: 10, startDelay: 1.2, spinEase: 4 };

  /* ================= 패럴랙스 설정 ================= */
  const PARALLAX = {
    yaw: 6,        // 마우스 좌우 끝에서 카메라가 도는 각도(도)
    pitch: 2.5,    // 마우스 상하 끝에서 카메라가 도는 각도(도)
    damping: 3,    // 반응 속도 (클수록 빠르게 따라감)
    typo: 14,      // 타이포가 반대로 움직이는 최대 거리(px)
    inertia: 2.5,  // 손을 놓은 뒤 원래 속도로 돌아오는 시간감(초)
    fx: 1,         // 회전 이펙트 전체 강도
  };
  /* ================= 누르기 가속 설정 ================= */
  const HOLD = {
    accel: 1.5,      // 누르는 동안 각가속도(rad/s²). 10 → 45 rpm까지 약 2.4초
    maxRpm: 45,      // 최고 속도 = 실제 LP의 45 RPM (싱글)
  };
  const FX_IDLE = 0.07;   // 기본 회전 때 이펙트 강도
  const ORTHO_EYE_DISTANCE = 1000;
  const MIN_LIGHT_Y = 0.3;
  // 직교 카메라라 거리는 크기에 영향이 없음. 큰 화면에서 판·앨범이 커져도 카메라 앞면(near)에 잘리지 않게 충분히 뒤로
  const CAM_DISTANCE = 100;
  const ZOOM = 80;
  let currentSideB = false;   // 지금 보이는 면이 B면인지 (판 뒤집기)

  /* ================= 렌더러·카메라 ================= */
  // 캔버스는 엔진마다 새로 만듦: 개발 모드(StrictMode)에서 엔진이 두 번 만들어졌다 정리돼도
  // 같은 WebGL 컨텍스트를 나눠 쓰다 잃어버리지 않게
  const canvas = document.createElement('canvas');
  canvas.className = 'absolute inset-0 block h-full w-full touch-pan-y';
  canvas.setAttribute('aria-label', 'A 3D vinyl record drawn in ink. Press and hold to spin it faster; drag to flip it');
  (q('hs-canvas') ?? host).prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;     // 루프에서 직접 지우고 여러 번 그림 (New Vinyls 릴)
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.zoom = ZOOM;
  camera.position.set(0, 0, CAM_DISTANCE);

  const hexToVec3 = (hex) => {
    const h = hex.trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };

  const uniforms = {
    uInk: { value: new THREE.Vector3() }, uLabel: { value: new THREE.Vector3() },
    uCamLocal: { value: new THREE.Vector3(0, 3, 3) }, uLightLocal: { value: new THREE.Vector3(0, 1, 0) },
    uLineFreq: { value: 75 }, uStreak: { value: 1.1 }, uSharp: { value: 60 },
    uRough: { value: 0.85 }, uWobble: { value: 0.0012 }, uBase: { value: 0.1 },
    uTrackCount: { value: 5 }, uGapWidth: { value: 0.006 },
    uInnerR: { value: 0.46 }, uOuterR: { value: 0.965 },
    uLabelR: { value: 0.3303 }, uHoleR: { value: 0.0254 },
    uTopY: { value: 0.0 }, uBotY: { value: -0.0215 },
  };
  const inkMat = new THREE.ShaderMaterial({
    vertexShader: discVert, fragmentShader: discFrag, uniforms,
    transparent: true, premultipliedAlpha: true, side: THREE.DoubleSide, depthWrite: false,
  });
  const depthMat = new THREE.MeshBasicMaterial({
    colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const shadowUniforms = {
    uInk: uniforms.uInk, uRough: uniforms.uRough,
    uCenter: { value: new THREE.Vector2(0.12, 0.1) }, uRadius: { value: new THREE.Vector2(1.12, 0.92) },
    uShadow: { value: 0.45 },
  };
  const shadowMat = new THREE.ShaderMaterial({
    vertexShader: shadowVert, fragmentShader: shadowFrag, uniforms: shadowUniforms,
    transparent: true, premultipliedAlpha: true, depthWrite: false,
  });

  // hero-vinyl-root (roll + scale) → comp (tilt) → spin → model
  const root = new THREE.Group();
  root.rotation.z = HERO_COMPOSITION.roll;
  scene.add(root);
  const comp = new THREE.Group();
  comp.rotation.x = HERO_COMPOSITION.tilt;
  // root(roll·scale·위치) → tumble(스크롤 중 한 바퀴) → comp(tilt)
  const tumble = new THREE.Group();
  root.add(tumble);
  // tumble → gflipG(장르 바뀔 때 반 바퀴 뒤집기) → comp
  const gflipG = new THREE.Group();
  tumble.add(gflipG);
  gflipG.add(comp);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), shadowMat);
  shadow.position.y = -0.42; shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1;
  comp.add(shadow);

  /* ================= 회전 이펙트 (판 주변 잉크 헤일로) ================= */
  // 레코드 평면 위에 놓인 큰 판(반지름 ~1.9). 판 안쪽(r<1)은 비우고 바깥에만 그림
  //  1) 모션 아크: 판 둘레를 따라 도는 손그림 호(弧). 빠를수록 길어지고 바깥 레인까지 생김
  //  2) 사운드 리플: 테두리에서 바깥으로 퍼지는 잉크 동심원. 빠를수록 자주·멀리
  //  3) 잉크 튐: 아주 빠를 때만 바깥으로 흩어지는 작은 점
  const LANES = 10;          // (레거시) 레인 각도 — 루프 호환용
  const STROKES = 48;        // 잉크 붓 획 개수
  const haloUniforms = {
    uInk: uniforms.uInk,
    uFx: { value: 0 },                                    // 0..1 이펙트 강도(속도 기반, 스무딩됨)
    uDir: { value: -1 },                                  // 회전 방향 부호
    uLane: { value: new Array(LANES).fill(0) },
    uRipple: { value: 0 },
    uTime: { value: 0 },
    uMajor: { value: 0 },
    uSA: { value: Array.from({ length: STROKES }, () => new THREE.Vector4()) },   // 반지름, 굵기, 길이, 현재 각도
    uSB: { value: Array.from({ length: STROKES }, () => new THREE.Vector4()) },   // 끊김 여부, 끊김 개수, 등장 속도, 시드
    uSC: { value: Array.from({ length: STROKES }, () => new THREE.Vector3()) },   // 획 색 (파랑·하늘색 계열에서 무작위)
    uInner: { value: 1.26 },
  };

  /* ---- 붓 획 랜덤 생성 ----
     획마다 반지름·굵기·길이·끊김·등장 시점·끌려가는 속도를 무작위로.
     안 보이는 동안 가끔 다시 뽑아서, 누를 때마다 조금씩 다른 모양이 나옴 */
  const HALO_INNER = 1.26;
  const IDLE_STROKES = 5;     // 기본 회전 때 보이는 작은 획 수   // 헤일로 안쪽 경계 = 링(바깥선 1.232) 바로 바깥
  const strokeMeta = Array.from({ length: STROKES }, () => ({ angle: 0, lag: 1 }));
  // 헤일로 획 색: #bbcbda보다 조금 더 파란 쪽으로, 파랑 계열과 하늘색 계열을 섞어서
  const HALO_COLORS = ['#5b8fd1', '#4a7cc4', '#6f9edb', '#3f6fb3', '#8fbbe8', '#9fc6ee', '#7fb0e3', '#a8cbea'];
  function rollStroke(i) {
    const rnd = Math.random;
    const far = rnd() ** 1.5;                                  // 0 = 판 가까이, 1 = 바깥
    const A = haloUniforms.uSA.value[i], B = haloUniforms.uSB.value[i];
    const R = HALO_INNER + 0.012 + far * 0.55;               // 링(타이포·스트로보) 바깥에서만
    const W = (0.0035 + rnd() ** 1.6 * 0.035) * (1 - far * 0.5); // 판 가까이일수록 굵은 붓 (반지름 단위 반폭)
    const L = 0.18 + rnd() ** 1.1 * 1.7;                        // 호 길이(라디안)
    const dashed = rnd() < 0.1 + far * 0.35 ? 1 : 0;             // 바깥 획일수록 끊긴 눈금 획
    const dashN = 70 + rnd() * 120;
    // 앞의 몇 획은 기본 회전에서도 아주 작게 보이도록, 나머지는 속도가 오를수록 하나씩
    const appearAt = i < IDLE_STROKES ? rnd() * 0.03 : 0.08 + rnd() ** 1.25 * 0.72;
    A.set(R, W, L, strokeMeta[i].angle);
    B.set(dashed, dashN, appearAt, rnd() * 100);
    haloUniforms.uSC.value[i].copy(hexToVec3(HALO_COLORS[Math.floor(rnd() * HALO_COLORS.length)]));
    strokeMeta[i].lag = 0.5 + rnd() * 0.5 * (1 - far * 0.4);   // 바깥일수록 공기에 덜 끌려감
    if (strokeMeta[i].angle === 0) strokeMeta[i].angle = rnd() * Math.PI * 2;
  }
  for (let i = 0; i < STROKES; i++) rollStroke(i);

  const haloFrag = /* glsl */`
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
    // 빛줄기 축 쪽이 더 진하게 (그 사이도 완전히 비우진 않음)
    float axisW = mix(0.5, 1.0, pow(abs(cos(th - uMajor)), 1.2));
    float ink = 0.0;

    for (int i = 0; i < ${STROKES}; i++) {
      vec4 A = uSA[i];
      vec4 B = uSB[i];
      float on = smoothstep(B.z, B.z + 0.06, uFx);
      if (on <= 0.0) continue;

      // 기본 회전(아주 낮은 uFx)에선 아주 가늘고 짧게만 → 누를수록 굵고 길어짐
      float grow = smoothstep(0.0, 0.65, uFx);
      float W = A.y * mix(0.28, 1.0, grow);
      float d = r - A.x;
      if (abs(d) > W + aa * 2.0) continue;

      float L = A.z * mix(0.16, 1.0, grow);
      float phi = mod(th + A.w, TAU);
      if (phi > L) continue;
      float s = phi / L;
      float head = uDir < 0.0 ? s : 1.0 - s;          // 0 = 꼬리, 1 = 머리(진행 방향)

      // 붓 획 실루엣: 머리는 뭉툭하고 두껍게, 꼬리는 가늘게 빠짐
      float prof = pow(sin(PI * clamp(head * 0.88 + 0.08, 0.0, 1.0)), 0.5) * mix(0.3, 1.0, head);
      float w = W * prof;
      float body = 1.0 - smoothstep(w - aa, w + aa, abs(d));
      if (body <= 0.0) continue;

      // 마른 붓 결: 획 방향으로 흐르는 털 자국. 꼬리로 갈수록 더 갈라짐
      float across = d / max(W, 1e-4);
      float n = noise3(vec3(across * 9.0, phi * 1.6, B.w));
      float n2 = noise3(vec3(across * 26.0, phi * 0.7, B.w + 7.0));
      float dry = mix(0.5, 0.06, head);
      float strand = smoothstep(dry - 0.06, dry + 0.06, n * 0.7 + n2 * 0.3);

      // 끊긴 눈금 획 (바깥쪽 바코드 같은 고리)
      float seg = 1.0;
      if (B.x > 0.5) {
        float t = phi * B.y / TAU;
        float ft = dTh * B.y / TAU;
        seg = 1.0 - smoothstep(0.58 - ft, 0.58 + ft, fract(t));
        seg = mix(seg, 0.58, smoothstep(0.35, 0.7, ft));
        strand = max(strand, 0.75);                    // 눈금 획은 결보다 블록감 위주
      }

      // 링 쪽 안쪽 경계는 부드럽게 페이드
      float innerFade = smoothstep(uInner, uInner + 0.03, r);
      float a = body * strand * seg * on * axisW * innerFade * (0.8 + 0.2 * fract(B.w));
      if (a > ink) { ink = a; inkCol = uSC[i]; }   // 가장 진한 획의 색
    }

    ink = clamp(ink, 0.0, 1.0);
    gl_FragColor = vec4(inkCol * ink, ink);
  }`;
  const haloVert = /* glsl */`
  varying vec2 vP;
  void main(){
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: haloVert, fragmentShader: haloFrag, uniforms: haloUniforms,
      transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  halo.position.y = -0.019;      // 판 두께의 가운데
  halo.renderOrder = 1;          // 디스크 depth 프리패스 뒤 → 판 뒤로 가려지는 부분은 자동으로 숨음
  comp.add(halo);
  halo.visible = true;

  /* ================= 원형 타이포 링 + 스트로보 점 ================= */
  // 둘 다 레코드 평면 위(판 바로 바깥)에 그려서 판과 함께 기울고 패럴랙스를 따라감
  //  - 타이포 링: 판과 함께 도는 글자. 빨라질수록 원주 방향으로 번져(모션 블러) 고리처럼 보임
  //  - 스트로보 점: 턴테이블 플래터 테두리의 점. 33⅓/45 RPM에 정확히 맞으면 멈춰 보임
  const rimText = () => `GROOVES  ·  VINYL CULTURE HUB  ·  NOW SPINNING  ·  SIDE ${currentSideB ? 'B' : 'A'}  ·  33⅓ / 45 RPM  ·  `;
  const textCanvas = document.createElement('canvas');
  textCanvas.width = 8192; textCanvas.height = 256;
  const textTex = new THREE.CanvasTexture(textCanvas);
  textTex.wrapS = THREE.RepeatWrapping;
  textTex.wrapT = THREE.ClampToEdgeWrapping;
  textTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  textTex.colorSpace = THREE.NoColorSpace;
  function drawRimText() {
    const ctx = textCanvas.getContext('2d');
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.font = "600 150px 'PP Neue Montreal', 'Helvetica Neue', Arial, sans-serif";
    if ('letterSpacing' in ctx) ctx.letterSpacing = '22px';
    // 한 바퀴에 문구가 정확히 n번 들어가도록 가로로 맞춤 (이음매 없음)
    const RIM_TEXT = rimText();
    const w = ctx.measureText(RIM_TEXT).width;
    const n = Math.max(1, Math.round(textCanvas.width / w));
    ctx.save();
    ctx.scale(textCanvas.width / (w * n), 1);
    for (let i = 0; i < n; i++) ctx.fillText(RIM_TEXT, i * w, textCanvas.height / 2 + 6);
    ctx.restore();
    textTex.needsUpdate = true;
  }
  drawRimText();
  document.fonts?.ready.then(drawRimText);

  const rimUniforms = {
    uInk: uniforms.uInk,
    uText: { value: textTex },
    uAngle: { value: 0 },      // 판 회전각 (글자가 판과 함께 돎)
    uBlur: { value: 0 },       // 글자 모션 블러 폭 (바퀴 단위)
    uP33: { value: 0 },        // 스트로보 33⅓ 줄의 겉보기 위상
    uP45: { value: 0 },        // 스트로보 45 줄의 겉보기 위상
    uShowText: { value: 1 },
    uShowStrobe: { value: 1 },
    uLock33: { value: 0 },     // 해당 속도에 맞았을 때 강조 (0..1)
    uLock45: { value: 0 },
    uReveal: { value: 0 },     // 0 = 숨김, 1 = 표시 (호버 시 서서히)
    uTextCol: { value: hexToVec3('#4c404a') },   // 링 글자 색 (Hero 글자색)
  };
  const rimFrag = /* glsl */`
  precision highp float;
  varying vec2 vP;
  uniform sampler2D uText;
  uniform vec3 uInk;
  uniform vec3 uTextCol;
  uniform float uAngle, uBlur, uP33, uP45, uShowText, uShowStrobe, uLock33, uLock45, uReveal;
  const float TAU = 6.2831853;
  float ringPx(float r, float R, float px){
    float d = abs(r - R) / max(fwidth(r), 1e-6);
    return 1.0 - smoothstep(px - 0.6, px + 0.6, d);
  }
  float band(float r, float a, float b){
    float fw = fwidth(r);
    return smoothstep(a - fw, a + fw, r) * (1.0 - smoothstep(b - fw, b + fw, r));
  }
  // 원주 방향 점 줄무늬 (atan 이음매 없이 AA)
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
    // 나타날 때 판 테두리 쪽에서 바깥으로 살짝 밀려 나오듯 (반지름을 안쪽으로 당겼다가 풀어줌)
    float rev = uReveal * uReveal * (3.0 - 2.0 * uReveal);
    float r = rTrue + (1.0 - rev) * 0.05;
    if (rTrue < 1.0 || r > 1.26) discard;
    float th = atan(vP.y, vP.x);
    float dTh = length(fwidth(vP)) / rTrue;
    float ink = 0.0;     // 스트로보 점·가이드 선 (잉크색)
    float textA = 0.0;   // 링 글자 (글자색)

    if (uShowStrobe > 0.5) {
      // 안쪽 줄 = 33⅓, 바깥 줄 = 45. 맞는 속도일 때 그 줄이 진해짐
      float a33 = 0.55 + 0.45 * uLock33;
      float a45 = 0.55 + 0.45 * uLock45;
      ink = max(ink, band(r, 1.028, 1.047) * dots(th, uP33, 120.0, dTh, 0.42) * a33);
      ink = max(ink, band(r, 1.057, 1.076) * dots(th, uP45, 120.0, dTh, 0.42) * a45);
      ink = max(ink, ringPx(r, 1.017, 0.5) * 0.55);
      ink = max(ink, ringPx(r, 1.087, 0.5) * 0.55);
    }

    if (uShowText > 0.5) {
      float r0 = 1.108, r1 = 1.212;
      if (r > r0 && r < r1) {
        // 글자 좌표: u = 판에 붙은 각도, v = 링 안 높이 (바깥쪽이 글자 위)
        float u = -(th + uAngle) / TAU;   // 위에서 봤을 때 글자가 바르게 읽히는 방향
        float v = (r1 - r) / (r1 - r0);
        // 텍스처 미분을 직접 계산 (atan 이음매에서 밉맵이 튀지 않게)
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
        // 번질수록 옅어지지 않게 살짝 보정
        textA = clamp(a * (1.0 + uBlur * 18.0), 0.0, 1.0) * 0.92;
      }
      ink = max(ink, ringPx(r, 1.232, 0.5) * 0.45);
    }

    // 글자를 위에, 그 아래 스트로보·선 (premultiplied over)
    vec4 cT = vec4(uTextCol * textA, textA);
    vec4 cS = vec4(uInk * ink, ink);
    gl_FragColor = (cT + cS * (1.0 - cT.a)) * rev;
  }`;
  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: haloVert, fragmentShader: rimFrag, uniforms: rimUniforms,
      transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  rim.position.y = -0.019;
  rim.renderOrder = 1;
  comp.add(rim);

  // 스트로보: 플래시 주파수 f에서 점 간격 s만큼 돌면 멈춰 보임 → 줄마다 기준 속도에 맞춘 f
  const STROBE_N = 120;
  const STROBE_S = (Math.PI * 2) / STROBE_N;
  const RPM2W = (Math.PI * 2) / 60;
  const strobeRows = [
    { key: 'uP33', lock: 'uLock33', f: (33.333 * RPM2W) / STROBE_S },
    { key: 'uP45', lock: 'uLock45', f: (45 * RPM2W) / STROBE_S },
  ];
  function updateStrobe(dt) {
    const w = Math.abs(omega);
    for (const row of strobeRows) {
      // 플래시 한 번 사이에 도는 양을 점 간격으로 나눈 나머지 → 겉보기 이동(앞뒤로 엘리어싱)
      let k = (w / row.f) / STROBE_S;
      k -= Math.round(k);
      const apparent = k * STROBE_S * row.f;              // rad/s
      rimUniforms[row.key].value = (rimUniforms[row.key].value - Math.sign(omega || -1) * apparent * dt) % (Math.PI * 2);
      // 거의 멈췄을 때 강조
      const lock = 1 - THREE.MathUtils.smoothstep(Math.abs(k), 0.0, 0.06);
      rimUniforms[row.lock].value += (lock - rimUniforms[row.lock].value) * (1 - Math.exp(-dt / 0.15));
    }
  }

  /* ================= 빛줄기 속 먼지 ================= */
  // 레코드 위 공기에 떠 있는 작은 잉크 점. 빛줄기(장축) 근처에서만 진하게 보이고,
  // 판이 빨라지면 공기에 끌려 판 주위를 맴돌다가, 느려지면 다시 천천히 흩어짐
  const DUST = {
    count: 420,
    rMin: 0.15, rMax: 1.75,     // 판 반지름 = 1 기준 분포 범위
    yMin: 0.01, yMax: 0.55,     // 레코드 평면 위 높이
    drift: 0.035,               // 평소 부유 속도
    beamPow: 4,                 // 빛줄기 집중도 (클수록 축 근처에만 보임)
  };
  const dustState = Array.from({ length: DUST.count }, () => spawnDust({}, true));
  function spawnDust(d, initial) {
    const u = Math.random();
    d.r = Math.sqrt(DUST.rMin ** 2 + u * (DUST.rMax ** 2 - DUST.rMin ** 2));   // 면적 균일
    d.th = Math.random() * Math.PI * 2;
    d.y = DUST.yMin + Math.random() ** 1.6 * (DUST.yMax - DUST.yMin);          // 낮은 곳에 더 많이
    d.vth = 0;                                 // 각속도 (공기에 끌려가는 속도)
    d.seed = Math.random() * 1000;
    d.size = 2.2 + Math.random() ** 3 * 3.6;   // 대부분 작고, 가끔 큰 티끌 (px)
    d.life = initial ? 1 : 0;                  // 새로 생기면 서서히 나타남
    d.tw = 0.6 + Math.random() * 0.4;
    return d;
  }
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST.count * 3);
  const dustAlpha = new Float32Array(DUST.count);
  const dustSize = new Float32Array(DUST.count);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
  dustGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dustAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1).setUsage(THREE.DynamicDrawUsage));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uInk: uniforms.uInk, uPaper: { value: new THREE.Vector3(0.957, 0.906, 0.804) }, uPixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */`
      attribute float aAlpha;
      attribute float aSize;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main(){
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;   // 직교 카메라라 거리 감쇠 없음
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uInk;
      uniform vec3 uPaper;
      varying float vAlpha;
      void main(){
        if (vAlpha <= 0.002) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c * vec2(1.0, 1.12));      // 살짝 찌그러진 점
        // 빛을 받은 먼지: 밝은(종이색) 속 + 얇은 잉크 테두리 → 진한 판 위에서도, 종이 위에서도 보임
        float shape = 1.0 - smoothstep(0.38, 0.5, d);
        float core = 1.0 - smoothstep(0.18, 0.3, d);
        vec3 col = mix(uInk, uPaper, core);
        float a = shape * vAlpha;
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, premultipliedAlpha: true, depthWrite: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.renderOrder = 3;            // 판 잉크 위 (판보다 위에 떠 있는 먼지는 판 앞에 보임)
  dust.frustumCulled = false;
  comp.add(dust);

  const cursorLocal = new THREE.Vector2(99, 99);   // 레코드 평면 위 커서 위치 (먼지를 살짝 밀어냄)
  let airOmega = 0;                                 // 판에 끌려가는 공기의 각속도 (판보다 늦게 따라감)
  function updateDust(dt, t) {
    if (!dust.visible) return;
    airOmega += (omega - airOmega) * (1 - Math.exp(-dt / 0.6));
    const major = haloUniforms.uMajor.value;
    const speedN = Math.min(1, Math.abs(airOmega) / ((HOLD.maxRpm / 60) * Math.PI * 2));
    const drift = reduceMotion ? 0 : DUST.drift;
    for (let i = 0; i < DUST.count; i++) {
      const d = dustState[i];
      // 1) 공기 회전: 판 가까이·낮은 곳일수록 판 속도에 가깝게 끌려감
      const near = d.r < 1 ? 1 : Math.exp(-(d.r - 1) / 0.45);
      const low = Math.exp(-d.y / 0.35);
      const target = airOmega * near * low;
      d.vth += (target - d.vth) * (1 - Math.exp(-dt / 0.5));
      d.th += d.vth * dt;
      // 2) 평소 부유: 느린 노이즈 같은 흔들림
      const n1 = Math.sin(t * 0.31 + d.seed) + Math.sin(t * 0.17 + d.seed * 1.7);
      const n2 = Math.cos(t * 0.23 + d.seed * 0.7) + Math.sin(t * 0.11 + d.seed * 2.3);
      d.th += (n1 * drift * 0.5 / Math.max(d.r, 0.3)) * dt;
      d.r += n2 * drift * 0.35 * dt;
      d.y += Math.sin(t * 0.4 + d.seed * 3.1) * drift * 0.2 * dt;
      // 3) 빨라질수록 원심력으로 바깥으로 밀려남
      d.r += d.vth * d.vth * d.r * 0.004 * dt;
      // 4) 커서 근처 먼지는 살짝 비켜감 (공기가 흔들리는 느낌)
      const x = Math.cos(d.th) * d.r, z = Math.sin(d.th) * d.r;
      const dx = x - cursorLocal.x, dz = z - cursorLocal.y;
      const dist2 = dx * dx + dz * dz;
      if (dist2 < 0.09 && !reduceMotion) {
        const push = (1 - dist2 / 0.09) * 0.25 * dt;
        const len = Math.sqrt(dist2) || 1;
        const nx = x + (dx / len) * push, nz = z + (dz / len) * push;
        d.r = Math.hypot(nx, nz); d.th = Math.atan2(nz, nx);
      }
      d.y = THREE.MathUtils.clamp(d.y, DUST.yMin, DUST.yMax);
      // 범위를 벗어나면 다시 태어남
      if (d.r > DUST.rMax || d.r < DUST.rMin * 0.5) spawnDust(d, false);
      d.life = Math.min(1, d.life + dt / 1.2);

      // 빛줄기 축 근처에서만 보임 (양쪽 대칭) + 반짝임
      const beam = Math.pow(Math.abs(Math.cos(d.th - major)), DUST.beamPow);
      const edgeFade = 1 - THREE.MathUtils.smoothstep(d.r, DUST.rMax * 0.8, DUST.rMax);
      const twinkle = d.tw + (1 - d.tw) * Math.sin(t * 1.3 + d.seed * 5.0);
      const alpha = (0.03 + 0.97 * beam) * (0.6 + 0.4 * speedN) * twinkle * edgeFade * d.life * dustFade;
      const j = i * 3;
      dustPos[j] = Math.cos(d.th) * d.r;
      dustPos[j + 1] = d.y;
      dustPos[j + 2] = Math.sin(d.th) * d.r;
      dustAlpha[i] = Math.max(0, alpha);
      dustSize[i] = d.size * (0.85 + 0.35 * beam);
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.aAlpha.needsUpdate = true;
    dustGeo.attributes.aSize.needsUpdate = true;
  }

  /* ================= New Vinyls: 끝없는 앨범 릴 ================= */
  // 릴(슬리브들)은 nvReel.js, 여기서는 입력·자동 넘김·색·글자
  //  - 휠/끌기/화살표로 릴을 돌림. 한 바퀴(앨범 수)의 끝에서 더 굴리면 Genre로, 처음에서 위로 굴리면 Hero로
  //  - 가만히 두면(REEL.idle초) REEL.every초마다 다음 앨범으로 저절로 넘어감. 마우스를 올리거나 끌면 멈춤
  //  - 배경 = 맨 앞 앨범의 대표 색, 글자는 배경 밝기에 따라 크림/브라운
  const nvReel = createNvReel({ renderer });
  const REEL = {
    wheel: 260,          // 휠 이만큼(px)에 한 장
    ease: 0.18,          // 목표 자리로 따라가는 시간감(초)
    idle: 3,             // 입력이 없으면 이만큼 뒤부터 자동 넘김(초)
    every: 3.5,          // 자동 넘김 간격(초)
    edge: 0.3,           // 한 바퀴 끝에서 더 밀리는 여유(장)
    handoff: 0.7,        // 끝에서 이만큼 더 굴리면 다음/이전 섹션으로
    swipe: 40,           // 터치 스와이프 거리(px)
  };
  let reelPos = 0, reelTarget = 0, reelOver = 0, reelSnapTimer = 0;
  let reelHover = false, reelHoverFront = 0, reelHoverEase = 0, reelHoverLock = false;
  let reelDrag = null;                 // { x, y, start, moved, id, mouse }
  let reelLastInput = 0, reelLastAuto = 0, reelAutoMoved = false;
  cleanups.push(() => clearTimeout(reelSnapTimer));
  const reelN = () => nvReel.count;
  const reelTouch = () => { reelLastInput = nowSec(); reelAutoMoved = false; };
  function reelLap() { const k = Math.round(reelTarget); const lo = k - nvReel.wrap(k); return [lo, lo + reelN() - 1]; }
  const reelReady = () => section === 1 && !tweening && !catTweening && albumClock >= AUTO.total * 0.8 && reelN() > 0;
  function reelFlip(d) { reelTouch(); reelTarget = Math.round(reelTarget) + d; reelOver = 0; }
  const frontK = () => Math.round(reelPos);
  function openAlbumDetail(k) {
    const a = nvReel.album(k);
    if (!a) return;
    opts.onOpenAlbum?.({ slug: a.slug, color: a.color, imageUrl: a.image, rect: nvReel.coverRect(k, canvas.getBoundingClientRect()) });
  }
  // 한 바퀴 끝에서는 조금만 더 밀리고, 더 굴리면 다음/이전 섹션으로
  function reelWheel(d) {
    reelTouch();
    const [lo, hi] = reelLap();
    reelTarget += d / REEL.wheel;
    if (reelTarget > hi + REEL.edge) {
      reelOver += reelTarget - (hi + REEL.edge); reelTarget = hi + REEL.edge;
      if (reelOver > REEL.handoff) { reelOver = 0; reelTarget = hi; goSection(2); return; }
    } else if (reelTarget < lo - REEL.edge) {
      reelOver += (lo - REEL.edge) - reelTarget; reelTarget = lo - REEL.edge;
      if (reelOver > REEL.handoff) { reelOver = 0; reelTarget = lo; goSection(0); return; }
    } else reelOver = Math.max(0, reelOver - 0.05);
    clearTimeout(reelSnapTimer);
    reelSnapTimer = setTimeout(() => {
      const [a, b] = reelLap();
      reelTarget = Math.min(b, Math.max(a, Math.round(reelTarget))); reelOver = 0;
    }, 180);
  }
  // 아래(다음)로: 한 바퀴의 마지막이면 Genre로 / 위(이전)로: 처음이면 Hero로
  function reelStepOrLeave(dir) {
    const i = nvReel.wrap(Math.round(reelTarget));
    if (dir > 0 && i >= reelN() - 1) goSection(2);
    else if (dir < 0 && i <= 0) goSection(0);
    else reelFlip(dir);
  }

  // 끌기(마우스) · 누르기(맨 앞 슬리브/판 = 앨범 열기, 다른 슬리브 = 그 앨범으로)
  on(canvas, 'pointerdown', (e) => {
    if (!reelReady() || e.button !== 0) return;
    reelTouch();
    reelDrag = { x: e.clientX, y: e.clientY, start: reelTarget, moved: false, id: e.pointerId, mouse: e.pointerType !== 'touch' };
    if (reelDrag.mouse) canvas.setPointerCapture(e.pointerId);
  });
  on(canvas, 'pointermove', (e) => {
    if (!reelDrag || e.pointerId !== reelDrag.id) return;
    const dx = reelDrag.x - e.clientX, dy = reelDrag.y - e.clientY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) reelDrag.moved = true;
    // 터치는 끝난 뒤 스와이프로 처리 (touchend)
    if (reelDrag.mouse && reelDrag.moved && reelReady()) { reelTouch(); reelTarget = reelDrag.start + (dx + dy) / 150; }
  });
  const endReelDrag = (e) => {
    if (!reelDrag || e.pointerId !== reelDrag.id) return;
    const d = reelDrag;
    reelDrag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (e.type === 'pointercancel') return;
    if (d.moved) { if (d.mouse) { const [a, b] = reelLap(); reelTarget = Math.min(b, Math.max(a, Math.round(reelTarget))); } return; }
    if (!reelReady()) return;
    const k = nvReel.pick(e.clientX, e.clientY, canvas.getBoundingClientRect());
    if (k === null ? hitsDisc(e) : k === frontK()) openAlbumDetail(frontK());
    else if (k !== null) { reelTouch(); reelTarget = k; }
  };
  on(canvas, 'pointerup', endReelDrag);
  on(canvas, 'pointercancel', endReelDrag);
  // 마우스를 올리면 자동 넘김을 멈추고, 맨 앞 앨범 위면 판이 조금 더 빠져나옴
  on(window, 'pointermove', (e) => {
    if (!reelReady() || reelDrag || e.pointerType !== 'mouse' || e.target !== canvas) { reelHover = false; reelHoverFront = 0; return; }
    const k = nvReel.pick(e.clientX, e.clientY, canvas.getBoundingClientRect());
    const onDisc = k === null && hitsDisc(e);
    reelHover = k !== null || onDisc;
    reelHoverFront = onDisc || (k !== null && k === frontK()) ? 1 : 0;
    if (reelHoverLock && Math.abs(reelTarget - reelPos) <= 0.01) reelHoverLock = false;   // 넘어간 뒤 다시 올리면 나옴
    if (reelHover) reelTouch();
  });
  // 화면의 버튼들
  on(q('nv-prev'), 'click', () => reelFlip(-1));
  on(q('nv-next'), 'click', () => reelFlip(1));
  on(q('nv-open'), 'click', () => { if (section === 1) openAlbumDetail(frontK()); });
  on(q('nv-skip'), 'click', (e) => { e.preventDefault(); if (section === 1) goSection(2); });
  on(q('new-vinyls'), 'pointerover', (e) => { if (e.target instanceof Element && e.target.closest('a, button')) reelTouch(); });

  /* ---- 글자: 앨범이 바뀌면 이전 제목은 넘기는 방향으로 빠지고 새 제목이 들어옴 ---- */
  function cleanTitle(t) { return (t || '').replace(/\s*[([].*[)\]]\s*$/, '').trim() || t || ''; }
  const hasKo = (s) => /[가-힣]/.test(s || '');
  function fitTitle(el) {
    const box = q('nv-ttl');
    if (!box || !el) return;
    el.style.fontSize = '';
    const max = box.clientWidth;
    if (max > 0 && el.scrollWidth > max) el.style.fontSize = `${Math.max(50, (max / el.scrollWidth) * 100).toFixed(1)}%`;
  }
  function swapTitle(text, dir) {
    const box = q('nv-ttl');
    if (!box) return;
    const slide = reduceMotion ? '' : 'transition-transform duration-[800ms] ease-[cubic-bezier(.22,1,.36,1)]';
    [...box.children].forEach((old) => {
      old.style.transform = `translateY(${dir > 0 ? -110 : 110}%)`;
      setTimeout(() => old.remove(), 850);
    });
    const el = document.createElement('span');
    el.className = `absolute inset-x-0 bottom-0 block whitespace-nowrap ${slide} ${hasKo(text) ? "font-['Gowun_Batang',serif]" : ''}`;
    el.textContent = text;
    el.style.transform = box.children.length ? `translateY(${dir > 0 ? 110 : -110}%)` : 'none';
    box.appendChild(el);
    fitTitle(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'none'; }));
  }
  let shownK = null;
  function updateReelText() {
    if (!reelN()) return;
    const k = frontK(), i = nvReel.wrap(k);
    if (k !== shownK) {
      const a = nvReel.album(k), dir = shownK === null || k >= shownK ? 1 : -1;
      shownK = k;
      swapTitle(cleanTitle(a.title), dir);
      q('nv-artist').textContent = a.artist || '';
      q('nv-album').textContent = `${a.title} — ${a.artist || ''}`;
      q('nv-idx').textContent = String(i + 1).padStart(2, '0');
      q('nv-tot').textContent = String(reelN()).padStart(2, '0');
      const $meta = q('nv-meta');
      $meta.textContent = a.arrived ? `Arrived ${a.arrived}` : '';
    }
    q('nv-caught').dataset.on = String(section === 1 && reelReady() && i === reelN() - 1 && !reelAutoMoved);
  }

  /* ---- 배경 = 맨 앞 앨범의 대표 색 · 글자는 밝기에 따라 ---- */
  const NV_TINT = {
    tau: 0.35,          // 색이 따라가는 시간감(초)
  };
  const C_INK = '#4c404a', C_CREAM = '#f4e7cd';
  const nvBase = new THREE.Color(), nvBgCur = new THREE.Color(), nvBgGoal = new THREE.Color(), nvAlbumC = new THREE.Color();
  const blackC = new THREE.Color('#000000'), whiteC = new THREE.Color('#ffffff');
  let nvBaseHex = '';
  const setNvBase = () => { nvBaseHex = siteDark ? C_CREAM : C_INK; nvBase.set(nvBaseHex); nvBgCur.copy(nvBase); };
  setNvBase();
  const lumHex = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  // 너무 밝거나 어두운 색은 살짝 눌러 줌
  function albumBg(hex, out) {
    const h = /^#[0-9a-f]{6}/i.test(hex || '') ? hex : '#4c404a';
    const l = lumHex(h);
    out.set(h);
    if (l > 0.7) out.lerp(blackC, 0.12); else if (l < 0.15) out.lerp(whiteC, 0.08);
    return out;
  }
  const textOn = (c) => (0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.58 ? C_INK : C_CREAM);
  let nvTouched = false, nvBgHex = '', nvFgHex = '';
  function updateNvTint(dt, catEase) {
    const vis = clamp01(albumClock / AUTO.total) * (1 - catEase);
    const fa = reelN() ? nvReel.album(frontK()) : null;
    nvBgGoal.copy(nvBase);
    if (fa && vis > 0) nvBgGoal.lerp(albumBg(fa.color, nvAlbumC), vis);
    nvBgCur.lerp(nvBgGoal, reduceMotion ? 1 : 1 - Math.exp(-dt / NV_TINT.tau));
    const page = host.closest('.ct-page');
    const settled = vis <= 0.001 && Math.abs(nvBgCur.r - nvBase.r) + Math.abs(nvBgCur.g - nvBase.g) + Math.abs(nvBgCur.b - nvBase.b) < 0.004;
    if (!settled) {
      nvTouched = true;
      const bg = '#' + nvBgCur.getHexString(), fg = textOn(nvBgCur);
      if (bg !== nvBgHex || fg !== nvFgHex) {
        nvBgHex = bg; nvFgHex = fg;
        // 페이지 바탕(= --ink, 내비게이션 글자 = --cream)과 스테이지 글자색
        page?.style.setProperty('--ink', bg);
        page?.style.setProperty('--cream', fg);
        host.style.setProperty('--hs-paper', bg);
        host.style.setProperty('--hs-text', fg);
        host.style.setProperty('--hs-muted', `color-mix(in srgb, ${fg} 64%, ${bg})`);
        host.style.setProperty('--hs-line', `color-mix(in srgb, ${fg} 30%, transparent)`);
      }
    } else if (nvTouched) {
      nvTouched = false; nvBgHex = nvFgHex = ''; nvBgCur.copy(nvBase);
      page?.style.removeProperty('--ink'); page?.style.removeProperty('--cream');
      const t = Math.max(0, themeT); themeT = -1; applyTheme(t);    // 섹션 테마 색으로 되돌림
    }
    // 판: Hero에서는 크림 종이 위 블루 잉크 → 앨범에 들어가면서 그 앨범의 대표 색 잉크로 (라벨은 대표 색을 연하게)
    //  다이얼에서는 이 색에서 장르 색으로 넘어감 (updateDial)
    if (catEase < 0.01) {
      if (fa) {
        nvAlbumVec.copy(hexToVec3(/^#[0-9a-f]{6}/i.test(fa.color || '') ? fa.color : '#4f6d93'));
        // 너무 밝은 색은 크림 종이 위에서 안 보이니 잉크 쪽으로 눌러 줌
        const l = 0.2126 * nvAlbumVec.x + 0.7152 * nvAlbumVec.y + 0.0722 * nvAlbumVec.z;
        if (l > 0.55) nvAlbumVec.lerp(inkVec, Math.min(0.6, (l - 0.55) * 1.6));
        if (!nvDiscInit) { nvAlbumInk.copy(nvAlbumVec); nvDiscInit = true; }
        nvAlbumInk.lerp(nvAlbumVec, 1 - Math.exp(-dt / NV_TINT.tau));
        nvAlbumLabel.copy(nvAlbumInk).lerp(creamVec, 0.55);
      }
      const k = fa ? easeInOutSine(seg(scrollP, SCROLL.insertStart, SCROLL.insertEnd)) : 0;
      nvDiscInk.copy(heroInk3).lerp(nvAlbumInk, k);
      nvDiscLabel.copy(heroLabel3).lerp(nvAlbumLabel, k);
      uniforms.uInk.value.copy(nvDiscInk);
      uniforms.uLabel.value.copy(nvDiscLabel);
    }
  }
  const nvDiscInk = new THREE.Vector3(), nvDiscLabel = new THREE.Vector3(), nvAlbumInk = new THREE.Vector3(), nvAlbumLabel = new THREE.Vector3();
  const nvAlbumVec = new THREE.Vector3(), inkVec = hexToVec3('#4c404a'), creamVec = hexToVec3('#f4e7cd');
  let nvDiscInit = false;

  // 릴 등장·퇴장은 스크롤이 아니라 '착륙 후 시간'으로 자동 재생. 다시 위/아래로 떠나면 거꾸로 감기며 빠짐
  const AUTO = {
    total: 1.6,         // 나머지 앨범이 다 나타나는 시간(초) (nvReel REVEAL과 맞춤)
    titleAt: 0.5, titleDur: 0.7,
    infoAt: 0.8, infoDur: 0.6,
  };
  let albumClock = 0;   // 착륙 후 흐른 시간(초)
  // 판 자리(엔진 좌표). 맨 앞 앨범 기준:
  //  - Hero에서 올 때: 앨범 열린 쪽(위, 앨범이 반시계 90° 누워 있음) 바깥에서 기다리다가 → 안으로 (insert)
  //  - New Vinyls: 앨범 안 (마우스를 올리면 오른쪽으로 조금 빠져나옴)
  //  - Genre로 갈 때: 오른쪽으로 완전히 빠져나옴 (catOut) → 그다음 다이얼로
  const nvTarget = { x: 0, y: 0, s: 1 };
  const nvWait = { x: 0, y: 0, r: 1 }, nvIn = { x: 0, y: 0, r: 1 };
  const CAT_OUT = 0.34;  // catP 중 판이 오른쪽으로 빠져나오는 앞부분 (다이얼로 가는 움직임은 CAT_OVERLAP만큼 먼저 시작)
  const CAT_OVERLAP = 0.1;
  const nvFrontLow = (p) => REEL_LAYOUT.LOW * (1 - easeInOutSine(seg(p, SCROLL.turnStart, SCROLL.turnEnd)));
  function nvDiscTarget(p, catOut) {
    const ins = easeInOutSine(seg(p, SCROLL.insertStart, SCROLL.insertEnd));
    // 앨범은 판을 받는 동안 조금 내려와 있다가(LOW) 돌아서며 제자리로 올라감 → 판도 같이
    const low = nvFrontLow(p);
    nvReel.discScreen(0, REEL_LAYOUT.OUT_EXIT - low, nvWait);
    nvWait.y = Math.max(nvWait.y, headerTop + nvWait.r + 8);     // 그래도 화면이 낮으면 헤더 아래로
    nvReel.discScreen(REEL_LAYOUT.OUT_HOVER * reelHoverEase + REEL_LAYOUT.OUT_EXIT * catOut, -low, nvIn);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const px = nvWait.x + (nvIn.x - nvWait.x) * ins, py = nvWait.y + (nvIn.y - nvWait.y) * ins, r = nvWait.r + (nvIn.r - nvWait.r) * ins;
    nvTarget.x = (px - w / 2) / ZOOM;
    nvTarget.y = (h / 2 - py) / ZOOM;
    nvTarget.s = Math.max(0.05, r / ZOOM);
    return nvTarget;
  }
  const reelBg = new THREE.Color();
  const nvFront = { rise: 0, low: 0, turn: 1, alpha: 1 };
  let reelOutSpeed = 2.7;    // 나머지 앨범이 사라지는 속도(배)
  let nvVis = 0;        // 릴이 보이는 정도 (판 자리·검은 판 정도에 씀)
  function updateReel(dt, p) {
    const on = p >= SCROLL.albumTrigger && section === 1 && catP < 0.02 && reelN() > 0;
    const before = albumClock;
    albumClock = THREE.MathUtils.clamp(albumClock + (on ? dt : -dt * reelOutSpeed), 0, AUTO.total);
    if (on && before < AUTO.total && albumClock >= AUTO.total) reelTouch();   // 다 들어오면 그때부터 대기
    const enter = easeInOut(albumClock / AUTO.total);
    nvVis = enter;
    // 맨 앞 앨범: 화면 아래에서 반시계 90° 누운 채 올라와, 판이 들어간 뒤 돌아섬. Genre로 갈 땐 판이 빠져나온 뒤 사라짐
    nvFront.rise = easeInOutSine(seg(p, SCROLL.riseStart, SCROLL.riseEnd));
    nvFront.turn = 1 - easeInOutSine(seg(p, SCROLL.turnStart, SCROLL.turnEnd));
    nvFront.low = nvFrontLow(p);
    nvFront.alpha = 1 - easeInOutSine(seg(catP, CAT_OUT - 0.04, CAT_OUT + 0.3));

    // 가만히 있으면 다음 앨범으로
    const now = nowSec();
    if (reelReady() && !reduceMotion && !reelHover && !reelDrag && now - reelLastInput > REEL.idle && now - reelLastAuto > REEL.every && !document.hidden) {
      reelTarget = Math.round(reelTarget) + 1; reelLastAuto = now; reelAutoMoved = true;
    }
    // 앨범이 바뀔 때: 빠져나와 있던 판이 먼저 들어간 뒤 넘어감. 넘어간 뒤엔 마우스를 다시 움직여야 판이 나옴
    const switching = Math.abs(reelTarget - reelPos) > 0.01;
    if (switching) reelHoverLock = true;
    const hoverWant = reelHoverLock ? 0 : reelHoverFront;
    reelHoverEase += (hoverWant - reelHoverEase) * (1 - Math.exp(-dt / (hoverWant < reelHoverEase ? 0.1 : 0.2)));
    if (!(switching && reelHoverEase > 0.04)) {
      reelPos += (reelTarget - reelPos) * (reduceMotion ? 1 : 1 - Math.exp(-dt / REEL.ease));
    }
    reelBg.copy(nvBgCur);
    nvReel.update({
      pos: reelPos,
      clock: reduceMotion ? (albumClock > 0 ? 99 : 0) : albumClock,
      front: nvFront,
      bg: reelBg,
      show: p > 0.001 && catP < 0.999,
    });

    // 타이틀·정보·버튼
    const headIn = easeOut(clamp01((albumClock - AUTO.titleAt) / AUTO.titleDur));
    $nvHead.style.opacity = String(headIn);
    $nvHead.style.visibility = headIn > 0.01 ? 'visible' : 'hidden';
    $nvLines.forEach((el, i) => {
      const t = easeOut(clamp01((albumClock - AUTO.titleAt - i * 0.1) / AUTO.titleDur));
      el.style.transform = `translateY(${((1 - t) * 110).toFixed(2)}%)`;   // 아래에서 스르륵 (부모가 잘라 줌)
    });
    const infoIn = easeOut(clamp01((albumClock - AUTO.infoAt) / AUTO.infoDur));
    for (const el of $nvInfo) {
      el.style.opacity = String(infoIn);
      el.style.visibility = infoIn > 0.01 ? 'visible' : 'hidden';
      el.style.translate = `0 ${((1 - infoIn) * 18).toFixed(1)}px`;
    }
    if ($nvVig) $nvVig.style.opacity = String(enter * 0.9);
    updateReelText();
  }

  /* ================= 타이틀 속도 반응 ================= */
  // 빨라질수록 글자가 회전 방향으로 기울고 살짝 벌어짐. 글자마다 조금씩 늦게 따라와 물결처럼 번짐
  const titleLetters = [...host.querySelectorAll('#title > span')];
  const letterVel = titleLetters.map(() => 0);
  // 인트로가 끝나면 'Grooves' 글자가 아래에서 하나씩 스르륵 올라옴 (h1이 잘라 줌)
  const TITLE_RISE = { delay: 0.15, stagger: 0.06, dur: 0.9 };
  /* ---- 로딩 → Hero 인트로 (B안: 라벨로 들어갔다 나오기) ----
     Preloader가 파란 라벨(#bbcbda)로 파고들어 화면을 덮으면, 같은 색인 3D 판의 라벨이 화면을 덮은 상태에서 시작해
     판이 뒤로 빠지며(로그 공간 줌) Hero 자세로 기울어짐. 그동안 헤일로·링·먼지는 숨겼다가 끝나면 나타남 */
  const INTRO = {
    pull: 2.0,          // 빠져나오는 시간(초)
    handoffRpm: 20,     // 로딩 판(감속 중)에서 이어받는 회전 속도
    cover: 1.15,        // 시작 때 라벨이 화면 대각선을 덮는 여유배율
    titleAt: 1.55,      // 'Grooves' 글자가 올라오기 시작하는 시점(초)
  };
  const intro = { t0: -1, k: opts.introDone ? 1 : 0 };
  function applyIntroPose() {
    if (intro.k >= 1 && intro.t0 < 0) return;
    if (intro.t0 >= 0) {
      intro.k = easeInOutSine(clamp01((performance.now() / 1000 - intro.t0) / INTRO.pull));
      if (intro.k >= 1) intro.t0 = -1;
    }
    const k = intro.k;
    comp.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, comp.rotation.x, k);
    root.rotation.z = THREE.MathUtils.lerp(0, root.rotation.z, k);
    const hero = root.scale.x;
    const s0 = (Math.hypot(canvas.clientWidth, canvas.clientHeight) / 2) / (uniforms.uLabelR.value * ZOOM) * INTRO.cover;
    root.scale.setScalar(Math.exp(Math.log(s0) + (Math.log(hero) - Math.log(s0)) * k));
    root.position.y *= k;
    fxSceneFade *= k;
    dustFade *= k;
  }
  function updateTitleRise() {
    const t = performance.now() / 1000 - startedAt - TITLE_RISE.delay;
    titleLetters.forEach((el, i) => {
      const k = reduceMotion ? 1 : easeOut(clamp01((t - i * TITLE_RISE.stagger) / TITLE_RISE.dur));
      el.style.translate = `0 ${((1 - k) * 110).toFixed(2)}%`;
    });
  }
  function updateTitle(dt, amount) {
    const on = fxTitle.checked && !reduceMotion;
    titleLetters.forEach((el, i) => {
      const target = on ? amount : 0;
      const tau = 0.12 + i * 0.07;                          // 뒤 글자일수록 늦게
      letterVel[i] += (target - letterVel[i]) * (1 - Math.exp(-dt / tau));
      const v = letterVel[i];
      const spread = (i - (titleLetters.length - 1) / 2) * v * 0.09;   // em 단위로 벌어짐
      el.style.transform = `translateX(${spread.toFixed(3)}em) skewX(${(-v * 28).toFixed(2)}deg)`;
    });
  }
  // comp(기울기) → flip(뒤집기) → spin(회전) → model
  // 링·먼지·그림자는 comp에 있어서 판을 뒤집어도 그대로 남음
  const flip = new THREE.Group();
  comp.add(flip);
  const spin = new THREE.Group();
  flip.add(spin);
  let disc = null;
  let pickTargets = [];
  // Hero를 떠나면: 잉크 선 아래 크림 종이 면 (종이 부분이 투명한 판이 앨범 색 배경 위에서도 Hero 판처럼 보이게)
  const vinylBack = new THREE.Mesh(
    new THREE.CircleGeometry(0.995, 128),
    new THREE.MeshBasicMaterial({ color: '#f4e7cd', transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
  );
  vinylBack.rotation.x = -Math.PI / 2;
  vinylBack.position.y = -0.019;
  vinylBack.renderOrder = 1;          // 깊이 패스(0) 뒤, 잉크(2) 앞
  vinylBack.visible = false;
  spin.add(vinylBack);   // 드래그 판정용 레이캐스트 대상(디스크 메시)

  try {
    const gltf = await loadGLTF(opts.modelUrl);
    const model = gltf.scene;
    model.scale.set(1, 1.8, 1);
    const meshes = [];
    model.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      const pre = new THREE.Mesh(m.geometry, depthMat);
      pre.position.copy(m.position); pre.quaternion.copy(m.quaternion); pre.scale.copy(m.scale);
      pre.renderOrder = 0;
      m.parent.add(pre);
      m.material = inkMat; m.renderOrder = 2;
    }
    disc = meshes[0];
    pickTargets = meshes;
    spin.add(model);
  } catch (e) {
    const el = q('hs-err');
    if (el) { el.textContent = 'Couldn’t load the 3D model: ' + e.message; el.classList.remove('hidden'); }
  }

  /* ================= 섹션별 테마 (Hero 크림 → New Vinyls 플럼) ================= */
  const THEME = {
    hero: { paper: '#f4e7cd', text: '#4c404a', muted: '#8a7f86', line: '#4c404a2e', panel: '#f4e7cde0', ink3d: '#4f6d93', label3d: '#bbcbda' },
    nv:   { paper: '#4c404a', text: '#f4e7cd', muted: '#c9bdb4', line: '#f4e7cd29', panel: '#4c404ae0', ink3d: '#a9c1db', label3d: '#4d5f74' },
  };
  const hexToRgba = (h) => {
    h = h.replace('#', '');
    const n = (k) => parseInt(h.slice(k, k + 2), 16);
    return [n(0), n(2), n(4), h.length >= 8 ? n(6) / 255 : 1];
  };
  const THEME_RGBA = Object.fromEntries(Object.entries(THEME).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([n, c]) => [n, hexToRgba(c)]))]));
  const sectionPalette = () => (siteDark ? [THEME.nv, THEME.hero] : [THEME.hero, THEME.nv]);
  let themeT = -1;
  function applyTheme(t) {
    if (Math.abs(t - themeT) < 0.002) return;
    themeT = t;
    const rs = host.style;
    // 기존 사이트 테마(--wire-t: 0 = 크림, 1 = 잉크)도 함께 → 내비게이션 색이 따라옴
    host.closest('.ct-page')?.style.setProperty('--wire-t', t.toFixed(3));
    for (const key of Object.keys(THEME.hero)) {
      const a = (siteDark ? THEME_RGBA.nv : THEME_RGBA.hero)[key], b = (siteDark ? THEME_RGBA.hero : THEME_RGBA.nv)[key];
      const c = a.map((v, k) => v + (b[k] - v) * t);
      const hex = '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      rs.setProperty(`--hs-${key}`, c[3] < 1 ? `rgba(${c.slice(0, 3).map(Math.round).join(',')},${c[3].toFixed(3)})` : hex);
    }
    applyColors();
  }
  const applyColors = () => {
    const cs = getComputedStyle(host);
    uniforms.uInk.value.copy(hexToVec3(cs.getPropertyValue('--hs-ink3d')));
    uniforms.uLabel.value.copy(hexToVec3(cs.getPropertyValue('--hs-label3d')));
    dustMat.uniforms.uPaper.value.copy(hexToVec3(cs.getPropertyValue('--hs-paper')));
    rimUniforms.uTextCol.value.copy(hexToVec3(cs.getPropertyValue('--hs-text')));   // 링 글자 = 지금 섹션 글자색
  };
  applyTheme(0);

  /* ================= 마우스 패럴랙스 입력 ================= */
  // 화면 중앙 = 0, 좌우/상하 끝 = ±1. 드래그가 아니라 '위치'만 사용
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallaxOn = finePointer && !reduceMotion;
  const target = new THREE.Vector2(0, 0);
  const current = new THREE.Vector2(0, 0);
  if (parallaxOn) {
    on(window, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      target.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    // 창 밖으로 나가거나 포커스를 잃으면 천천히 정면으로 복귀
    on(host, 'pointerleave', () => target.set(0, 0));
    on(window, 'blur', () => target.set(0, 0));
  }

  /* ================= 연출 스위치 (프로토타입의 조정 패널 기본값) ================= */
  const typoToggle = { checked: true };   // 타이포 반대 이동
  const fxTitle = { checked: true };      // 타이틀 속도 반응
  const title = q('title');


  /* ================= 누르고 있으면 빨라지기 ================= */
  // 판 위를 누르고 있는 동안 회전 방향으로 점점 가속 → 손을 떼면 관성으로 원래 속도로 복귀
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let holding = false;
  let holdPointerId = null;
  let holdTime = 0;               // 누르고 있은 시간(초) — 커서 연출용
  let omega = 0;                  // 현재 각속도(rad/s). 음수 = 시계 방향(위에서 볼 때)

  function setNdc(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }
  const hitsDisc = (e) => {
    setNdc(e);
    return pickTargets.length > 0 && raycaster.intersectObjects(pickTargets, false).length > 0;
  };

  // 링 표시용: 포인터가 레코드 평면에서 판 중심으로부터 얼마나 떨어졌는지 (판 반지름 = 1)
  const yPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const localRay = new THREE.Ray();
  const hitLocal = new THREE.Vector3();
  function pointerRecordRadius(e) {
    setNdc(e);
    comp.updateWorldMatrix(true, false);
    compInv.copy(comp.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(compInv);
    if (!localRay.intersectPlane(yPlane, hitLocal)) return Infinity;
    return Math.hypot(hitLocal.x, hitLocal.z);
  }
  // 링은 판 '중앙 쪽'에 올렸을 때 나타나고, 한 번 나타나면 링 영역(바깥)까지는 유지 (읽는 중에 사라지지 않게)
  const RING_SHOW_R = 0.55;    // 이 반지름 안쪽(라벨 + 안쪽 홈)에 들어오면 나타남
  const RING_HOVER_R = 1.28;   // 이 반지름 밖으로 나가야 사라짐
  let overRing = false;
  on(window, 'pointermove', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const onScene = el === canvas || el?.id === 'title' || el?.parentElement?.id === 'title';
    const rr = onScene ? pointerRecordRadius(e) : Infinity;
    if (rr < RING_SHOW_R) overRing = true;
    else if (rr > RING_HOVER_R) overRing = false;
    if (Number.isFinite(rr)) cursorLocal.set(hitLocal.x, hitLocal.z); else cursorLocal.set(99, 99);
  });
  on(host, 'pointerleave', () => { overRing = false; cursorLocal.set(99, 99); });
  on(window, 'blur', () => { overRing = false; });

  /* ================= 누르기 vs 드래그 → 가속 vs 뒤집기 ================= */
  // 누르는 순간엔 '가속'으로 시작하고, 8px 이상 끌면 '뒤집기'로 전환
  // 뒤집기: 끈 방향과 수직인 (레코드 평면 위) 축을 중심으로 판이 손을 따라 넘어가고,
  //         놓으면 가까운 면(A/B)으로 스프링처럼 안착
  const FLIP = {
    dragStart: 8,        // 이 거리(px) 이상 움직이면 드래그로 판정
    dragPerTurn: 1.6,    // 레코드 평면에서 이만큼(판 반지름 단위) 끌면 180°
    stiffness: 70,       // 안착 스프링 강도
    damping: 0.82,       // 1 = 튕김 없음, 작을수록 살짝 튕김
  };
  let pressed = false;
  let pressId = null;
  const pressScreen = new THREE.Vector2();
  let flipping = false;                       // 드래그로 뒤집는 중
  let settling = false;                       // 놓은 뒤 안착 중
  const flipAxis = new THREE.Vector3(1, 0, 0);
  const flipDir = new THREE.Vector2();
  const flipStartPlane = new THREE.Vector2();
  const flipBaseQuat = new THREE.Quaternion();
  const flipDeltaQuat = new THREE.Quaternion();
  let flipRel = 0;         // 이번 드래그로 넘긴 각도
  let flipVel = 0;         // 각속도 (놓을 때 던진 세기 반영)
  let flipTarget = 0;
  let lastRel = 0;

  function planePoint(e, out) {
    return Number.isFinite(pointerRecordRadius(e)) ? out.set(hitLocal.x, hitLocal.z) : null;
  }
  const tmpPlane = new THREE.Vector2();

  on(canvas, 'pointerdown', (e) => {
    if (!heroActive || pressed || e.button !== 0 || !hitsDisc(e)) return;
    pressed = true;
    pressId = e.pointerId;
    pressScreen.set(e.clientX, e.clientY);
    planePoint(e, flipStartPlane);
    holding = true;                            // 일단 가속부터
    holdTime = 0;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  on(canvas, 'pointermove', (e) => {
    if (!pressed || e.pointerId !== pressId) return;
    if (!flipping) {
      if (Math.hypot(e.clientX - pressScreen.x, e.clientY - pressScreen.y) < FLIP.dragStart) return;
      // 드래그 시작: 가속을 멈추고 뒤집기 축을 끈 방향으로 고정
      if (!planePoint(e, tmpPlane)) return;
      flipDir.copy(tmpPlane).sub(flipStartPlane);
      if (flipDir.lengthSq() < 1e-8) flipDir.set(1, 0);
      flipDir.normalize();
      flipAxis.set(flipDir.y, 0, -flipDir.x);  // 위쪽(0,1,0) × 끈 방향 → 그 방향으로 넘어감
      holding = false;
      flipping = true;
      settling = false;
      flipBaseQuat.copy(flip.quaternion);
      flipRel = 0; lastRel = 0; flipVel = 0;
    }
    if (!planePoint(e, tmpPlane)) return;
    const proj = tmpPlane.sub(flipStartPlane).dot(flipDir);
    flipRel = (proj / FLIP.dragPerTurn) * Math.PI;
  });
  const endPress = (e) => {
    if (!pressed || e.pointerId !== pressId) return;
    pressed = false;
    pressId = null;
    holding = false;
    if (flipping) {
      flipping = false;
      // 던진 속도까지 고려해 가까운 면으로 (반 바퀴 단위)
      flipTarget = Math.round((flipRel + flipVel * 0.18) / Math.PI) * Math.PI;
      settling = true;
    }
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  on(canvas, 'pointerup', endPress);
  on(canvas, 'pointercancel', endPress);
  on(canvas, 'lostpointercapture', endPress);

  function updateFlip(dt) {
    if (flipping) {
      // 손 속도 측정
      const v = dt > 0 ? (flipRel - lastRel) / dt : 0;
      flipVel += (v - flipVel) * (1 - Math.exp(-dt / 0.06));
      lastRel = flipRel;
    } else if (settling) {
      // 감쇠 스프링으로 안착
      const k = FLIP.stiffness, c = 2 * Math.sqrt(k) * FLIP.damping;
      flipVel += (k * (flipTarget - flipRel) - c * flipVel) * dt;
      flipRel += flipVel * dt;
      if (Math.abs(flipTarget - flipRel) < 0.0015 && Math.abs(flipVel) < 0.02) {
        flipRel = flipTarget;
        settling = false;
      }
    }
    if (flipping || settling || flipRel !== 0) {
      flipDeltaQuat.setFromAxisAngle(flipAxis, flipRel);
      flip.quaternion.multiplyQuaternions(flipDeltaQuat, flipBaseQuat);
      if (!flipping && !settling) {
        // 안착 완료: 현재 자세를 기준으로 굳힘
        flipBaseQuat.copy(flip.quaternion);
        flipRel = 0;
      }
    }
    // 지금 보이는 면: 판의 원래 윗면이 아래를 향하면 B면
    tmpUp.set(0, 1, 0).applyQuaternion(flip.quaternion);
    const sideB = tmpUp.y < 0;
    if (sideB !== currentSideB) {
      currentSideB = sideB;
      drawRimText();   // 링 문구만 SIDE A ↔ SIDE B
    }
  }
  const tmpUp = new THREE.Vector3();

  // 모바일 길게 누르기 시 메뉴·선택이 뜨지 않게
  on(canvas, 'contextmenu', (e) => e.preventDefault());

  /* ================= 커스텀 커서 ================= */
  // 상태: idle(작은 링) · disc(판 위: "Hold") · drag(누르는 중: 현재 rpm + 판과 함께 도는 눈금)
  //       link(버튼·링크 위: 링 확대, 점 숨김) · native(조정 패널: 기본 커서) · hidden(창 밖)
  const CURSOR = {
    ringLag: 0.12,  // 링이 따라오는 지연(초). 점은 즉시
    scale: { idle: 0.32, disc: 1, drag: 0.78, flip: 0.7, album: 0.8, open: 0.9, ring: 0.62, ringdrag: 0.5, link: 0.55, read: 0.72, native: 0.32 },
  };
  const cursorOn = finePointer;   // 마우스 환경에서만
  const $ring = q('cursor-ring');
  const $dot = q('cursor-dot');
  const $shape = q('cursor-shape');
  const $label = q('cursor-label');
  const $tick = q('cursor-tick');
  const mouse = new THREE.Vector2(-100, -100);
  const ringPos = new THREE.Vector2(-100, -100);
  let cursorVisible = false;
  let overDisc = false;
  let overLink = false;
  let overPanel = false;
  let overRead = false;   // News 기사 카드 위
  let cursorState = '';

  if (cursorOn) {
    host.classList.add('custom-cursor');
    on(window, 'pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouse.set(e.clientX, e.clientY);
      const el = e.target instanceof Element ? e.target : null;
      // 스테이지 밖(사이트 헤더 등)에서는 숨김 — 원래 커서가 보이는 곳
      if (!el || !host.contains(el)) { cursorVisible = false; overDisc = overLink = overPanel = overRead = false; return; }
      if (!cursorVisible) { ringPos.copy(mouse); cursorVisible = true; }
      overPanel = !!el?.closest('#panel');
      overLink = !overPanel && !!el?.closest('a, button, summary, [role="button"]');
      overRead = !overPanel && !!el?.closest('[data-cursor="read"]');
      // 캔버스 위(다른 UI에 가려지지 않은 곳)에서만 디스크 판정
      overDisc = heroActive && !overPanel && !overLink && (el === canvas || el?.id === 'title' || el?.closest('#hero, #new-vinyls') !== null) && hitsDisc(e);
    });
    on(host, 'pointerleave', () => { cursorVisible = false; });
    on(window, 'blur', () => { cursorVisible = false; });
  }

  function setCursorState(state) {
    if (state === cursorState) return;
    cursorState = state;
    $shape.style.transform = `scale(${CURSOR.scale[state] ?? CURSOR.scale.idle})`;
    const filled = ['disc', 'drag', 'flip', 'album', 'open', 'ring', 'ringdrag', 'read'].includes(state);
    $shape.style.backgroundColor = filled ? 'color-mix(in srgb, var(--hs-paper) 72%, transparent)' : 'transparent';
    $shape.style.backdropFilter = filled ? 'blur(6px)' : 'none';
    $shape.style.borderColor = state === 'link' ? 'var(--hs-text)' : 'var(--hs-ink3d)';
    $label.style.opacity = filled ? '1' : '0';
    $tick.style.opacity = state === 'drag' ? '1' : '0';
    $dot.firstElementChild.style.opacity = state === 'idle' ? '1' : '0';  // 링이 커지는 상태에선 점을 숨겨 라벨과 겹치지 않게
    if (state === 'disc') $label.textContent = 'Hold\nDrag';
    if (state === 'flip') $label.textContent = 'Flip';
    if (state === 'album') $label.textContent = 'View';
    if (state === 'open') $label.textContent = 'Open';
    if (state === 'read') $label.textContent = 'Read';
    if (state === 'ring' || state === 'ringdrag') $label.textContent = 'Drag';
  }

  function updateCursor(dt) {
    if (!cursorOn) return;
    const state = !cursorVisible ? 'hidden'
      : overPanel ? 'native'
      : flipping ? 'flip'
      : holding ? 'drag'
      : overDisc && heroActive ? 'disc'
      : (reelDrag?.moved && reelDrag.mouse) || (dialDragging && dialMoved) ? 'ringdrag'
      : reelReady() && reelHoverFront ? 'open'
      : reelReady() && reelHover ? 'album'
      : reelReady() ? 'ring'
      : section === 2 && hoverGenre >= 0 && hoverGenre !== dialIndex && !catTweening ? 'link'
      : section === 2 && overDialArea && !overLink && !catTweening ? 'ring'
      : section === 3 && overRead ? 'read'
      : overLink ? 'link' : 'idle';
    setCursorState(state);

    const show = state !== 'hidden' && state !== 'native';
    $ring.style.opacity = show ? '1' : '0';
    $dot.style.opacity = show ? '1' : '0';

    // 점은 즉시, 링은 살짝 늦게 (모션 줄이기 설정이면 지연 없음)
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt / CURSOR.ringLag);
    ringPos.lerp(mouse, k);
    $dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
    $ring.style.transform = `translate3d(${ringPos.x.toFixed(2)}px, ${ringPos.y.toFixed(2)}px, 0)`;

    if (state === 'drag') {
      // 누를수록 링이 살짝 조여짐 (가속되는 느낌)
      const charge = Math.min(1, Math.abs(omega) / ((HOLD.maxRpm / 60) * Math.PI * 2));
      $shape.style.transform = `scale(${(CURSOR.scale.drag - 0.14 * charge).toFixed(3)})`;
      // 현재 회전 속도(rpm)와, 판과 함께 도는 눈금
      const rpmNow = Math.abs(omega) * 60 / (Math.PI * 2);
      $label.textContent = `${rpmNow < 0.5 ? 0 : Math.round(rpmNow)} rpm`;
      $tick.style.transform = `rotate(${(-spin.rotation.y * 180 / Math.PI).toFixed(1)}deg)`;
    }
  }

  /* ================= 리사이즈 ================= */
  let heroScale = 1, viewH = 10;
  // 스테이지는 사이트 헤더 아래에서 시작 (헤더가 장면을 가리지 않게)
  const navbar = layer.querySelector?.('.ct-navbar');
  // 섹션 내용은 헤더 아래에서 시작하지만, 3D 캔버스는 헤더 뒤까지 화면 전체를 덮음 (헤더는 투명)
  let headerTop = 0;
  const placeStage = () => {
    headerTop = navbar ? Math.round(navbar.offsetTop + navbar.offsetHeight) : 0;
    host.style.top = `${headerTop}px`;
    host.style.setProperty('--hs-top', `${headerTop}px`);
    canvas.style.top = `${-headerTop}px`;
    canvas.style.height = `calc(100% + ${headerTop}px)`;
  };
  const resize = () => {
    fitTitle(q('nv-ttl')?.lastElementChild);
    placeStage();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    dustMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    // R3F viewport와 같은 값: 화면 크기 / zoom (월드 단위)
    heroScale = getHeroRecordScale(w / ZOOM, h / ZOOM, h);
    nvReel.resize(w, h);
    viewH = h / ZOOM;
  };
  on(window, 'resize', resize); resize();
  // 헤더 높이가 바뀌어도(폰트 로딩·반응형) 다시 맞춤
  const headerObserver = navbar ? new ResizeObserver(() => { if (ready) { resize(); layoutDial(); } }) : null;
  headerObserver?.observe(navbar);
  cleanups.push(() => headerObserver?.disconnect());

  /* ================= 회전 출발 ================= */
  // 인트로(로딩)가 끝난 뒤부터 대기·출발
  let startedAt = introDone ? performance.now() / 1000 : Infinity;

  /* ================= 빛줄기 계산 (InkVinyl useFrame과 동일) ================= */
  const inv = new THREE.Matrix4(), compInv = new THREE.Matrix4();
  const tmp = new THREE.Vector3(), camLocal = new THREE.Vector3(), camFwd = new THREE.Vector3(), eyeWorld = new THREE.Vector3();
  const viewDir = new THREE.Vector3(), viewFlat = new THREE.Vector3(), major = new THREE.Vector3();
  const half = new THREE.Vector3(), lightDir = new THREE.Vector3();
  const STREAK = { angle: 0, spread: 0.45 };

  function updateLight() {
    if (!disc) return;
    comp.updateWorldMatrix(true, false);
    disc.updateWorldMatrix(true, false);
    if (Math.abs(comp.matrixWorld.determinant()) < 1e-10) return;
    compInv.copy(comp.matrixWorld).invert();

    camera.getWorldDirection(camFwd);
    camera.getWorldPosition(eyeWorld);
    eyeWorld.addScaledVector(camFwd, -ORTHO_EYE_DISTANCE);       // 직교 카메라
    viewDir.copy(camFwd).negate().transformDirection(compInv);

    viewFlat.set(viewDir.x, 0, viewDir.z);
    if (viewFlat.lengthSq() < 1e-6) viewFlat.set(0, 0, 1);
    viewFlat.normalize();
    major.set(-viewFlat.z, 0, viewFlat.x);
    // 헤일로도 같은 축을 쓰도록 (comp 로컬 각도; 헤일로 평면 좌표 vP = (x, z))
    haloUniforms.uMajor.value = Math.atan2(major.z, major.x) + THREE.MathUtils.degToRad(STREAK.angle);

    const a = THREE.MathUtils.degToRad(STREAK.angle);
    const ca = Math.cos(a), sa = Math.sin(a);
    half.set(major.x * ca + viewFlat.x * sa, 0, major.z * ca + viewFlat.z * sa).multiplyScalar(STREAK.spread);
    half.y = 1; half.normalize();

    lightDir.copy(half).multiplyScalar(2 * half.dot(viewDir)).sub(viewDir).normalize();
    if (lightDir.y < MIN_LIGHT_Y) { lightDir.y = MIN_LIGHT_Y; lightDir.normalize(); }

    lightDir.transformDirection(comp.matrixWorld);
    inv.copy(disc.matrixWorld).invert();
    camLocal.copy(eyeWorld).applyMatrix4(inv);
    tmp.copy(lightDir).transformDirection(inv);
    uniforms.uCamLocal.value.copy(camLocal);
    uniforms.uLightLocal.value.copy(tmp);
  }



  /* ================= Genre dial ================= */
  // 12개 장르가 큰 원 둘레에 놓인 다이얼. 바늘(가로 화면: 오른쪽 3시 / 세로 화면: 위 12시)에 온 장르가 선택됨
  //  - 장르는 끌기 또는 장르 글자 클릭으로 바꿈 (스크롤·스와이프는 섹션 이동 전용). 키보드는 ←/→
  //  - 장르가 바뀌면 판이 동전처럼 한 바퀴 뒤집히며 그 장르 색으로 바뀜
  //  - New Vinyls의 판이 그대로 다이얼 가운데로 와서 정면을 보고 누움 → 다이얼을 돌리면 판도 같이 돎
  // 장르 목록·설명·개수는 프로토타입용 임시 값 (실제 서비스에서는 DB의 장르별 앨범 수 사용)
  // ink = 판의 잉크(홈·빛줄기) 색, label = 라벨 면 색. 플럼 배경(#4c404a) 위에서 읽히도록 ink는 밝게, label은 어둡게
  const GENRES = opts.genres;   // [{ slug, name, ink, label, desc }] — homeGenres.js
  const genreInk = GENRES.map((g) => hexToVec3(g.ink));
  const genreLabel = GENRES.map((g) => hexToVec3(g.label));
  const tintInk = genreInk[0].clone(), tintLabel = genreLabel[0].clone();   // 지금 판에 칠해진 장르 색 (뒤집을 때 바뀜)
  const baseInk = new THREE.Vector3(), baseLabel = new THREE.Vector3();
  const heroInk3 = new THREE.Vector3(), heroLabel3 = new THREE.Vector3();
  const setDiscPalette = () => {
    const [first, second] = sectionPalette();
    heroInk3.copy(hexToVec3(first.ink3d)); heroLabel3.copy(hexToVec3(first.label3d));
    baseInk.copy(hexToVec3(second.ink3d)); baseLabel.copy(hexToVec3(second.label3d));
  };
  setDiscPalette();
  nvDiscInk.copy(heroInk3); nvDiscLabel.copy(heroLabel3);   // 다이얼에서 바로 시작할 때(뒤로 가기)의 판 색
  // 헤더 테마 버튼을 누르면 바로 다시 칠함 (스크롤 위치는 그대로)
  const themeObserver = new MutationObserver(() => {
    const next = document.documentElement.dataset.theme === 'dark';
    if (next === siteDark) return;
    siteDark = next;
    setDiscPalette();
    setNvBase();
    nvTouched = false; nvBgHex = nvFgHex = '';
    host.closest('.ct-page')?.style.removeProperty('--cream');
    host.closest('.ct-page')?.style.removeProperty('--ink');
    const t = Math.max(0, themeT); themeT = -1; applyTheme(t);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  cleanups.push(() => themeObserver.disconnect());
  let genreTinted = false;

  /* ---- 장르가 바뀌면 판을 한 번(반 바퀴) 뒤집으며 색을 바꿈 ----
     뒤집는 축은 매번 무작위 (화면 위의 아무 방향 + 앞/뒤 방향도 무작위).
     판이 옆으로 선(모서리가 보이는) 순간 새 장르 색으로 바뀌어서, 뒷면이 나올 때 이미 새 색.
     뒤집힌 자세는 그대로 유지 (판은 앞뒤가 같아 보임). 다이얼을 떠날 땐 원래 자세로 부드럽게 돌아감 */
  const GFLIP = {
    dur: 0.8,           // 한 번 뒤집는 시간(초)
    squash: 0.06,       // 뒤집는 동안 살짝 작아졌다 돌아옴 (깊이감)
  };
  let colorIndex = 0;   // 지금 판에 칠해진 장르
  let gFlipT = -1;      // 진행도 0..1, -1 = 쉬는 중
  let gFlipSwitched = false;
  const gFlipAxis = new THREE.Vector3(0, 1, 0);
  let gFlipSign = 1;
  const gFlipFrom = new THREE.Quaternion();   // 이번 뒤집기 시작 자세
  const gFlipRest = new THREE.Quaternion();   // 쌓인 자세 (뒤집기가 끝날 때마다 갱신)
  const gFlipQ = new THREE.Quaternion(), gIdentity = new THREE.Quaternion();
  function applyGenreColor(i) {
    colorIndex = i;
    tintInk.copy(genreInk[i]);
    tintLabel.copy(genreLabel[i]);
    spawnWave(true);                // 새 색의 파동이 바로 퍼져 나감
  }
  function updateGenreFlip(dt, catEase) {
    if (gFlipT < 0) {
      // 다이얼에 완전히 들어와 있고, 끌고 있지 않을 때 장르가 바뀌었으면 시작 (끄는 동안 연달아 뒤집히지 않게)
      const want = section === 2 && catP > 0.98 && !dialDragging && colorIndex !== dialIndex;
      if (want && reduceMotion) applyGenreColor(dialIndex);
      else if (want) {
        // 무작위 축: 화면 평면 위 아무 방향 (가로·세로·대각선), 넘어가는 쪽도 무작위
        const phi = Math.random() * Math.PI;
        gFlipAxis.set(Math.cos(phi), Math.sin(phi), 0);
        gFlipSign = Math.random() < 0.5 ? -1 : 1;
        gFlipFrom.copy(gFlipRest);
        gFlipT = 0; gFlipSwitched = false;
      }
    }
    if (gFlipT >= 0) {
      gFlipT = Math.min(1, gFlipT + dt / GFLIP.dur);
      const e = easeInOut(gFlipT);
      // 반 바퀴의 절반(90°) = 모서리가 보이는 순간에 색 교체. 그 사이 장르가 또 바뀌었으면 최신 장르로
      if (!gFlipSwitched && e >= 0.5) { applyGenreColor(dialIndex); gFlipSwitched = true; }
      gFlipQ.setFromAxisAngle(gFlipAxis, Math.PI * e * gFlipSign).multiply(gFlipFrom);
      root.scale.multiplyScalar(1 - GFLIP.squash * Math.sin(Math.PI * gFlipT));
      if (gFlipT >= 1) { gFlipT = -1; gFlipRest.copy(gFlipQ); }   // 끝나고도 다른 장르가 남아 있으면 다음 프레임에 또 한 번
    } else {
      gFlipQ.copy(gFlipRest);
    }
    // 박동: 파동이 나올 때 판이 살짝 커졌다 돌아옴
    root.scale.multiplyScalar(1 + beatEnv * catEase);
    // 다이얼 밖(New Vinyls 쪽)으로 갈수록 원래 자세로
    gflipG.quaternion.copy(gIdentity).slerp(gFlipQ, catEase);
    if (catEase <= 0.001 && gFlipT < 0) gFlipRest.identity();
  }

  /* ---- 파동: 판에서 오른쪽(세로 화면은 위쪽)으로 퍼져 나가는 짧은 원호 ----
     판을 중심으로 한 동심원 물결을 짧게 잘라낸 조각. 길이·굵기·방향·속도·연속 개수가 매번 무작위. 조각마다 방향이 조금씩 달라서
     부채꼴 안에 흩어져 퍼짐. 조각은 태어날 때의 장르 색을 가짐 → 장르를 바꾸면 새 조각부터 새 색 */
  const DEG2RAD = Math.PI / 180;
  // 모든 값은 [최소, 최대] 범위에서 조각(또는 묶음)마다 무작위로 뽑음
  const WAVE = {
    every: [0.35, 1.1],          // 다음 묶음까지 간격(초)
    train: [1, 4],               // 한 번에 연달아 나오는 파동 수 (같은 방향으로 겹겹이)
    trainGap: [9, 24],           // 연속 파동 사이 간격(px)
    arc: [40, 54],               // 원호 길이(도). 최소 40°
    thick: [6, 26],              // 붓 획의 굵기(px, 퍼지는 방향 = 좌우). 머리 쪽이 가장 두꺼움
    speed: [140, 220],           // 퍼지는 속도(px/s)
    arcMin: 40,                  // 원호 길이 하한(도)
    overshoot: 14,               // 원호 끝이 위·아래 장르를 넘어갈 수 있는 각도(도)
    // 퍼지는 방향: 선택된 장르 바로 위·아래 장르 사이(바늘 ±1칸) 근처. 원호 끝은 overshoot만큼 넘어갈 수 있음
    max: 40,
  };
  const rand = ([a, b]) => a + Math.random() * (b - a);
  const randInt = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
  /* ---- 장르별 파동 성격 ----
     기본값(WAVE)을 장르마다 덮어씀. 장르를 바꾸면 '새로 나오는 파동'부터 새 성격
     - rhythm: 파동이 나오는 박자(초)를 순서대로 반복 (±8% 흔들림). 없으면 every 범위에서 무작위
     - dash:   가닥이 끊기는(마른 붓) 확률
     - pulse:  파동이 나올 때 판이 뛰는 세기 (판 크기 대비 비율) */
  const GENRE_WAVE = opts.genreWave ?? {};   // 장르별 파동 성격 — homeGenres.js
  const waveProfile = () => ({ dash: 0.55, pulse: 0.03, ...WAVE, ...(GENRE_WAVE[GENRES[colorIndex].slug] || {}) });
  let rhythmStep = 0;
  function nextInterval(P) {
    if (!P.rhythm) return rand(P.every);
    const v = P.rhythm[rhythmStep % P.rhythm.length];
    rhythmStep++;
    return v * (0.92 + Math.random() * 0.16);
  }

  /* ---- 박동: 파동이 나올 때 판이 살짝 커졌다 돌아오고 장르 글자가 밝아짐 ----
     빠르게 차오르고(attack) 천천히 빠지는(decay) 한 번의 쿵 */
  const BEAT = { attack: 0.05, decay: 0.22, strong: 1.8 };   // strong = 장르 바뀔 때 배수
  let beatAmp = 0, beatT = 1, beatEnv = 0;
  function hitBeat(amp) {
    // 아직 남아 있는 박동보다 셀 때만 새로 침
    if (amp >= beatEnv) { beatAmp = amp; beatT = 0; }
  }
  function updateBeat(dt) {
    beatT += dt;
    beatEnv = beatT < BEAT.attack
      ? beatAmp * easeOut(beatT / BEAT.attack)
      : beatAmp * Math.exp(-(beatT - BEAT.attack) / BEAT.decay);
  }
  let nextWaveIn = 0.4;
  const waves = [];
  let waveClock = 0;
  /* ---- 파동 렌더러: Hero 헤일로와 같은 잉크 붓 획 셰이더 ----
     파동 하나 = 붓 획 하나. 머리는 뭉툭하고 두껍게, 꼬리는 가늘게 빠지고, 결 방향으로 마른 붓 털 자국.
     일부는 바깥 헤일로처럼 끊긴 눈금(바코드) 획. 색은 장르 잉크 색에서 밝기·톤을 흔든 팔레트에서 무작위
     태어날 때 꼬리 쪽에서 머리 쪽으로 붓을 긋듯 그려짐 */
  const WAVE_GL_MAX = 40;
  const $waveCanvas = document.createElement('canvas');
  $waveCanvas.className = 'pointer-events-none absolute inset-0 h-full w-full';
  $waveCanvas.setAttribute('aria-hidden', 'true');
  const waveRenderer = new THREE.WebGLRenderer({ canvas: $waveCanvas, alpha: true, premultipliedAlpha: true, antialias: false });
  waveRenderer.setClearColor(0x000000, 0);
  const waveUniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },      // CSS px
    uDpr: { value: 1 },
    uCenter: { value: new THREE.Vector2() },       // 판 중심 (CSS px, 위가 0)
    uCount: { value: 0 },
    uWA: { value: Array.from({ length: WAVE_GL_MAX }, () => new THREE.Vector4()) },   // 반지름, 반폭, 시작 각도, 보이는 길이
    uWB: { value: Array.from({ length: WAVE_GL_MAX }, () => new THREE.Vector4()) },   // 머리 방향(±1), 끊김 여부, 끊김 개수, 시드
    uWC: { value: Array.from({ length: WAVE_GL_MAX }, () => new THREE.Vector4()) },   // 색 rgb, 진하기
  };
  const waveScene = new THREE.Scene();
  const waveCam = new THREE.Camera();
  const waveQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: waveUniforms, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
  precision highp float;
  uniform vec2 uRes, uCenter;
  uniform float uDpr;
  uniform int uCount;
  uniform vec4 uWA[${WAVE_GL_MAX}];
  uniform vec4 uWB[${WAVE_GL_MAX}];
  uniform vec4 uWC[${WAVE_GL_MAX}];
  ${NOISE}
  const float TAU = 6.2831853;
  const float PI = 3.14159265;
  void main(){
    vec2 p = gl_FragCoord.xy / uDpr;
    p.y = uRes.y - p.y;                              // 화면 좌표(위가 0)로 → 캔버스 2D와 같은 각도 기준
    vec2 d0 = p - uCenter;
    float r = length(d0);
    float th = atan(d0.y, d0.x);
    float aa = 0.75;
    float dTh = 1.0 / max(r, 1.0);
    vec3 col = vec3(0.0);
    float alpha = 0.0;
    for (int i = 0; i < ${WAVE_GL_MAX}; i++) {
      if (i >= uCount) break;
      vec4 A = uWA[i]; vec4 B = uWB[i]; vec4 C = uWC[i];
      float W = A.y;
      float d = r - A.x;
      if (abs(d) > W + 2.0) continue;
      float L = A.w;
      if (L <= 0.0) continue;
      float phi = mod(th - A.z, TAU);
      if (phi > L) continue;
      float s = phi / L;
      float head = B.x > 0.0 ? s : 1.0 - s;           // 0 = 꼬리, 1 = 머리

      // 붓 획 실루엣: 머리는 뭉툭하고 두껍게, 꼬리는 가늘게 빠짐 (헤일로와 같은 모양)
      float prof = pow(sin(PI * clamp(head * 0.88 + 0.08, 0.0, 1.0)), 0.5) * mix(0.3, 1.0, head);
      float w = W * prof;
      float body = 1.0 - smoothstep(w - aa, w + aa, abs(d));
      if (body <= 0.0) continue;

      // 마른 붓 결: 획 방향으로 흐르는 털 자국. 꼬리로 갈수록 더 갈라짐
      float across = d / max(W, 1e-4);
      float n = noise3(vec3(across * 9.0, phi * 3.2, B.w));
      float n2 = noise3(vec3(across * 26.0, phi * 1.4, B.w + 7.0));
      float dry = mix(0.5, 0.06, head);
      float strand = smoothstep(dry - 0.06, dry + 0.06, n * 0.7 + n2 * 0.3);

      // 끊긴 눈금 획
      float seg = 1.0;
      if (B.y > 0.5) {
        float t = phi * B.z / TAU;
        float ft = dTh * B.z / TAU;
        seg = 1.0 - smoothstep(0.58 - ft, 0.58 + ft, fract(t));
        seg = mix(seg, 0.58, smoothstep(0.35, 0.7, ft));
        strand = max(strand, 0.75);
      }
      float a = clamp(body * strand * seg * C.w * (0.8 + 0.2 * fract(B.w)), 0.0, 1.0);
      // 겹치는 획은 위에 덮어 칠함 (여러 장르 색이 함께 보일 수 있게)
      col = C.rgb * a + col * (1.0 - a);
      alpha = a + alpha * (1.0 - a);
    }
    gl_FragColor = vec4(col, alpha);
  }`,
    }),
  );
  waveQuad.frustumCulled = false;
  waveScene.add(waveQuad);
  function sizeWaveCanvas(W, H) {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    waveRenderer.setPixelRatio(dpr);
    waveRenderer.setSize(W, H, false);
    waveUniforms.uRes.value.set(W, H);
    waveUniforms.uDpr.value = dpr;
  }
  // 장르 잉크 색에서 만든 팔레트: 밝게(종이 쪽) ~ 진하게(라벨 쪽). 헤일로의 파랑·하늘색 섞임처럼
  const WHITE3 = new THREE.Vector3(1, 1, 1);
  function waveColor() {
    const k = Math.random();
    const c = tintInk.clone();
    if (k < 0.3) c.lerp(tintLabel, 0.15 + Math.random() * 0.2);         // 진한 톤
    else if (k < 0.7) c.lerp(WHITE3, Math.random() * 0.12);              // 잉크 그대로에 가깝게
    else c.lerp(WHITE3, 0.18 + Math.random() * 0.22);                    // 밝은 톤
    return c;
  }
  // 한 묶음 = 같은 방향으로 연달아 퍼지는 파동 1~4개. 묶음 안에서도 길이·굵기가 조금씩 달라짐
  function spawnTrain(strong, dir) {
    const rnd = Math.random;
    const P = waveProfile();                                   // 지금 장르의 파동 성격
    const n = strong ? Math.max(2, randInt(P.train)) : randInt(P.train);
    const baseArc = rand(P.arc) * DEG2RAD;
    const u = dir ?? rnd() * 2 - 1;                           // -1 = 위 장르 쪽 끝, 0 = 바늘, 1 = 아래 장르 쪽 끝
    const baseThick = rand(P.thick) * (strong ? 1.3 : 1);
    const speed = rand(P.speed);
    const gap = rand(P.trainGap);
    let back = 0;
    for (let i = 0; i < n; i++) {
      waves.push({
        r: -back,                                              // 뒤 파동은 조금 늦게 출발
        color: waveColor(),
        head: rnd() < 0.5 ? 1 : -1,                            // 붓을 긋는 방향 (머리 쪽)
        half: Math.max(2, baseThick * (1 - i * 0.2) * (0.75 + rnd() * 0.5)) * 0.42,  // 붓 반폭(px). 뒤로 갈수록 얇게
        dashed: rnd() < (P.dash ?? 0.55) * 0.45 ? 1 : 0,       // 일부는 끊긴 눈금 획
        dashN: 180 + rnd() * 220,
        seed: rnd() * 100,
        age: 0,
        dir: 0, u: clamp(u + (rnd() - 0.5) * 0.15, -1, 1),     // 묶음 안에서도 살짝 어긋남
        arc: clamp(baseArc * (0.85 + rnd() * 0.3), P.arcMin * DEG2RAD, DIAL.step * 2),   // 40° ~ 위·아래 장르 사이(60°)
        speed,
      });
      const w = waves[waves.length - 1];
      // 원호 끝이 위·아래 장르를 overshoot만큼 넘는 것까지 허용 → 바늘 ±1칸 근처에서 방향이 흩어짐
      w.dir = w.u * Math.max(0, DIAL.step - w.arc / 2 + WAVE.overshoot * DEG2RAD);
      back += gap * (0.7 + rnd() * 0.6);
    }
    while (waves.length > WAVE.max) waves.shift();
  }
  function spawnWave(strong) {
    if (reduceMotion) return;
    const P = waveProfile();
    hitBeat(P.pulse * (strong ? BEAT.strong : 1));
    if (strong) {
      rhythmStep = 0; waveClock = 0; nextWaveIn = nextInterval(P);   // 새 장르의 박자로 다시 시작
      // 장르가 바뀌는 순간: 바늘 방향과 그 위아래로 세 묶음이 함께
      [-1, 0, 1].forEach((d) => spawnTrain(true, d * 0.9));
    } else spawnTrain(false);
  }
  function updateWaves(dt, show) {
    const W = host.clientWidth, H = host.clientHeight;
    updateBeat(dt);
    if (reduceMotion) { waveRenderer.clear(); return; }
    if (section === 2 && catP > 0.9) {
      waveClock += dt;
      if (waveClock >= nextWaveIn) { waveClock = 0; nextWaveIn = nextInterval(waveProfile()); spawnWave(false); }
    }
    const { cx, cy, R, needle } = geo;
    const r0 = R * 0.5 * 1.05;                    // 판 테두리 바로 바깥에서 시작
    const rMax = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 40;
    const DRAW = 0.32;                             // 붓을 긋는 시간(초)
    let n = 0;
    for (let k = waves.length - 1; k >= 0; k--) {
      const w = waves[k];
      w.r += w.speed * dt;
      if (w.r < 0) continue;                       // 아직 출발 전 (묶음의 뒤 파동)
      w.age += dt;
      const rr = r0 + w.r;
      const life = 1 - w.r / (rMax - r0);
      if (life <= 0) { waves.splice(k, 1); continue; }
      // 장르 글자 띠(다이얼 안)에서는 옅게 → 글자가 묻히지 않게. 판 테두리에서 막 나올 땐 스며 나오듯
      const band = 0.3 + 0.7 * Math.min(1, Math.max(0, (rr - R * 0.95) / (R * 0.2)));
      const emerge = Math.min(1, w.r / 24);
      const alpha = Math.pow(life, 2.2) * band * emerge * show;   // 멀어질수록 빨리 옅어짐 (오른쪽 글을 가리지 않게)
      if (alpha < 0.01 || n >= WAVE_GL_MAX) continue;
      const reveal = easeOut(Math.min(1, w.age / DRAW));
      const vis = w.arc * reveal;
      const a0 = needle + w.dir - w.arc / 2;       // 원호 시작(각도가 작은 쪽)
      // 꼬리는 제자리, 머리가 앞으로 나가며 그려짐
      const start = w.head > 0 ? a0 : a0 + w.arc - vis;
      // 퍼질수록 붓이 조금 넓어짐 (헤일로의 바깥 획처럼)
      const half = w.half * (w.dashed ? 0.55 : 1) * (1 + 0.15 * (1 - life));   // 눈금 획은 가늘게
      waveUniforms.uWA.value[n].set(rr, half, start, vis);
      waveUniforms.uWB.value[n].set(w.head, w.dashed, w.dashN, w.seed);
      waveUniforms.uWC.value[n].set(w.color.x, w.color.y, w.color.z, Math.min(0.85, alpha * 0.9));
      n++;
    }
    waveUniforms.uCount.value = n;
    waveUniforms.uCenter.value.set(cx, cy);
    waveRenderer.render(waveScene, waveCam);
  }
  const beatWhite = new THREE.Vector3(1, 1, 1);
  const DIAL = {
    step: (Math.PI * 2) / GENRES.length,   // 30°
    follow: 0.22,       // 각도가 목표를 따라가는 시간(초)
    stepLock: 0.25,     // 방향키로 한 칸 넘긴 뒤 다음 칸까지 최소 간격(초)
    colorTau: 0.45,     // 판 색이 새 장르 색으로 바뀌는 시간감(초)
    discSpin: 1.2,      // 다이얼이 돈 만큼 판도 함께 돎 (배수)
  };
  let dialIndex = 0;
  let dialAngle = 0, dialTarget = 0;     // 라디안. index * step
  let dialLockUntil = 0;
  let dialDragging = false, dialPointer = null, dialLastY = 0, dialLastX = 0, dialMoved = false;
  let overDialArea = false;
  let dialDownX = 0, dialDownY = 0;
  let hoverGenre = -1;            // 마우스가 올라간 장르 글자
  const labelHit = [];            // 장르 글자별 클릭 판정 정보
  const geo = { cx: 0, cy: 0, R: 300, needle: 0, portrait: false };

  const $gd = q('gd');
  const $gdSvg = q('gd-svg');
  const $gdLabels = q('gd-labels');
  const $gdPanel = q('gd-panel');
  const $gdHit = q('gd-hit');
  $gd.insertBefore($waveCanvas, $gd.firstChild);

  // 장르 이름(버튼)
  // 장르 이름 (글자만. 바꾸기는 끌기로만 → 클릭 없음, 끌기는 아래 투명 원이 받음)
  const genreButtons = GENRES.map((g) => {
    const b = document.createElement('span');
    b.textContent = g.name;
    b.setAttribute('aria-hidden', 'true');
    b.className = "pointer-events-none absolute left-0 top-0 select-none whitespace-nowrap font-['Grooves_Bodoni',Georgia,serif] font-black uppercase leading-none tracking-[0.04em] transition-[color,opacity] duration-300";
    $gdLabels.appendChild(b);
    return b;
  });

  function layoutDial() {
    const W = host.clientWidth, H = host.clientHeight;
    geo.portrait = W / H < 0.9;
    if (geo.portrait) {
      // 세로 화면: 아래쪽에 반쯤 걸치고 바늘은 위(12시)
      geo.R = Math.min(W * 0.62, H * 0.42);
      geo.cx = W / 2; geo.cy = H + geo.R * 0.18;
      geo.needle = -Math.PI / 2;
    } else {
      // 가로 화면: 왼쪽에 반쯤 걸치고 바늘은 오른쪽(3시)
      geo.R = Math.min(H * 0.64, W * 0.33);
      geo.cx = W * 0.05; geo.cy = H * 0.52;
      geo.needle = 0;
    }
    const { cx, cy, R, needle } = geo;
    $gdSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sizeWaveCanvas(W, H);
    const hit = q('gd-hit');
    hit.setAttribute('cx', cx); hit.setAttribute('cy', cy); hit.setAttribute('r', R * 1.15);
    void needle;
    // 정보 패널 위치
    if (geo.portrait) {
      Object.assign($gdPanel.style, { left: '1.5rem', top: '1rem', bottom: '', transform: '' });
    } else {
      const left = Math.max(cx + R * 1.22, W * 0.46);
      Object.assign($gdPanel.style, { left: `${left}px`, top: '50%', transform: 'translateY(-50%)' });
    }
    const fs = Math.max(15, Math.min(44, R * 0.075));
    genreButtons.forEach((b) => { b.style.fontSize = `${fs}px`; });
  }

  let shownGenre = -1;
  let dialRevealed = false;
  const coverTilt = (n) => `transform: rotate(${(n - 1) * 5}deg) translateY(${n === 1 ? -6 : 0}px)`;
  function renderGenreCovers(i, list) {
    const g = GENRES[i];
    const covers = q('gd-covers');
    covers.replaceChildren(...[0, 1, 2].map((n) => {
      const c = list?.[n];
      const el = document.createElement(c?.url ? 'img' : 'span');
      el.className = `block aspect-square h-full w-auto shrink-0 rounded-[2px] object-cover shadow-[0_14px_32px_rgba(0,0,0,0.3)] ${n ? '-ml-[clamp(1.5rem,2.6vw,3.5rem)]' : ''}`;
      el.style.cssText = coverTilt(n) + `;background-color:${c?.color || (n === 1 ? g.label : g.ink)}`;
      if (c?.url) { el.src = c.url; el.alt = ''; el.loading = 'lazy'; el.onerror = () => { el.removeAttribute('src'); el.style.visibility = 'hidden'; }; }
      return el;
    }));
  }
  /* ---- 장르가 바뀌면: 지금 글자·커버가 위로 빠져 사라진 뒤(GENRE_EXIT) 새 장르가 아래에서 올라옴 ----
     끄는 중처럼 빠르게 연달아 바뀌면 사라지는 동안 들어온 마지막 장르만 보여 줌 */
  const GENRE_EXIT = { dur: 320, ease: 'cubic-bezier(0.55,0,0.75,0.4)' };
  let genreExiting = false, pendingGenre = -1, genreExitTimer = 0;
  cleanups.push(() => clearTimeout(genreExitTimer));
  const genreParts = () => [q('gd-name-text'), q('gd-desc-text'), q('gd-link'), ...q('gd-covers').children];
  function showGenre(i) {
    pendingGenre = i;
    if (genreExiting) return;
    if (i === shownGenre) return;
    // 처음이거나 다이얼이 안 보이면 바로 바꿈
    if (shownGenre < 0 || reduceMotion || !dialRevealed) { applyGenre(i); return; }
    genreExiting = true;
    const out = { duration: GENRE_EXIT.dur, easing: GENRE_EXIT.ease, fill: 'forwards' };
    q('gd-name-text').animate([{ transform: 'none' }, { transform: 'translateY(-110%)' }], out);
    q('gd-desc-text').animate([{ transform: 'none' }, { transform: 'translateY(-105%)' }], { ...out, delay: 40 });
    q('gd-link').animate([{ opacity: 1 }, { opacity: 0, translate: '0 -0.4em' }], out);
    [...q('gd-covers').children].forEach((el, n) => {
      el.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -30%' }], { ...out, delay: n * 40 });
    });
    genreExitTimer = setTimeout(() => {
      genreExiting = false;
      genreParts().forEach((el) => el.getAnimations().forEach((an) => an.cancel()));
      applyGenre(pendingGenre, true);
    }, GENRE_EXIT.dur + 80);
  }
  function applyGenre(i, force = false) {
    if (i === shownGenre && !force) return;
    shownGenre = i;
    const g = GENRES[i];
    q('gd-count-idx').textContent = `${String(i + 1).padStart(2, '0')} / ${GENRES.length}`;
    q('gd-name-text').textContent = g.name;
    q('gd-desc-text').textContent = g.desc;
    const link = q('gd-link');
    link.textContent = `Dig into ${g.name.toUpperCase()} ↗`;
    link.setAttribute('href', `/digging?genre=${encodeURIComponent(g.slug)}`);
    renderGenreCovers(i, null);
    // 장르별 대표 커버 3장: 불러오는 동안은 장르 색 슬리브, 불러오면 실제 커버
    opts.getGenreCovers?.(g.slug).then((list) => {
      if (disposed || shownGenre !== i) return;
      renderGenreCovers(i, list);
      // 실제 커버로 바뀔 때: 등장 중이면 남은 차례에 맞춰, 끝났으면 살짝 페이드
      revealCovers(Math.max(0, revealAt + REVEAL.coversAt - performance.now()));
    }, () => {});
    revealGenre();
  }
  /* ---- 장르 정보 차례대로 등장: 제목 → 설명 → 커버 3장 → 링크 ----
     제목·설명은 아래에서 스르륵 올라오고(부모가 잘라 줌), 커버는 한 장씩 떠오름 */
  const REVEAL = {
    ease: 'cubic-bezier(0.22,1,0.36,1)',
    title: 750, descAt: 160, desc: 800, coversAt: 330, coverStagger: 110, cover: 750, linkAt: 640,
  };
  let revealAt = 0;
  function revealCovers(delay) {
    if (reduceMotion) return;
    [...q('gd-covers').children].forEach((el, n) => {
      el.animate(
        [{ opacity: 0, translate: '0 40%' }, { opacity: 1, translate: '0 0' }],
        { duration: REVEAL.cover, easing: REVEAL.ease, delay: delay + n * REVEAL.coverStagger, fill: 'backwards' });
    });
  }
  function revealGenre() {
    revealAt = performance.now();
    if (reduceMotion) return;
    const opt = (delay, duration) => ({ duration, delay, easing: REVEAL.ease, fill: 'backwards' });
    q('gd-name-text').animate([{ transform: 'translateY(110%)' }, { transform: 'none' }], opt(0, REVEAL.title));
    q('gd-desc-text').animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], opt(REVEAL.descAt, REVEAL.desc));
    revealCovers(REVEAL.coversAt);
    q('gd-link').animate([{ opacity: 0, translate: '0 0.4em' }, { opacity: 1, translate: '0 0' }], opt(REVEAL.linkAt, 600));
  }
  // 다이얼은 끝없이 돎: 각도(dialTarget)는 제한 없이 누적하고, 장르 번호만 12로 나눈 나머지로 씀
  //  → etc. 다음은 다시 k-indie, k-indie 이전은 etc.
  const wrapIndex = (k) => ((k % GENRES.length) + GENRES.length) % GENRES.length;
  function setDial(k) {        // k = 누적 칸 번호 (12를 넘거나 음수여도 됨)
    dialTarget = k * DIAL.step;
    dialIndex = wrapIndex(k);
    showGenre(dialIndex);
  }
  function dialStep(dir, auto = false) {
    if (!auto) dialTouch();
    if (nowSec() < dialLockUntil) return;
    dialLockUntil = nowSec() + DIAL.stepLock;
    setDial(Math.round(dialTarget / DIAL.step) + dir);
  }

  /* ---- 장르 자동 넘김: 가만히 두면 New Vinyls처럼 다음 장르로 ----
     장르 글자·설명 칸에 마우스를 올리거나 다이얼을 끄는 동안은 멈춤. 모션 줄이기 설정이면 쓰지 않음 */
  const GAUTO = {
    idle: 2,            // 마지막 입력(또는 도착) 뒤 이만큼 지나면 시작(초)
    every: 2,           // 넘기는 간격(초)
  };
  let dialIdleAt = 0, dialAutoAt = 0, gdPanelHover = false;
  function dialTouch(at = nowSec()) { dialIdleAt = Math.max(dialIdleAt, at); }
  on($gdPanel, 'pointerenter', () => { gdPanelHover = true; dialTouch(); });
  on($gdPanel, 'pointerleave', () => { gdPanelHover = false; dialTouch(); });
  on($gdPanel, 'focusin', () => dialTouch());
  function updateDialAuto() {
    if (section !== 2 || catP < 0.98 || catTweening || newsP > 0.01 || reduceMotion || document.hidden) return;
    const now = nowSec();
    if (dialDragging || gdPanelHover || hoverGenre >= 0) { dialTouch(now); return; }
    if (now - dialIdleAt > GAUTO.idle && now - dialAutoAt > GAUTO.every) { dialAutoAt = now; dialStep(1, true); }
  }

  // 다이얼 끌기: 가로 화면은 위아래, 세로 화면은 좌우로
  on($gdHit, 'pointerenter', () => { overDialArea = true; });
  on($gdHit, 'pointerleave', () => { overDialArea = false; });
  on($gdHit, 'pointerdown', (e) => {
    if (section !== 2 || catTweening) return;
    dialDragging = true; dialMoved = false; dialPointer = e.pointerId;
    dialLastY = dialDownY = e.clientY; dialLastX = dialDownX = e.clientX;
    $gdHit.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  on($gdHit, 'pointermove', (e) => {
    if (!dialDragging || e.pointerId !== dialPointer) return;
    // 손을 따라 글자가 움직이도록: 위로 끌면 아래 장르가 바늘 쪽으로 올라옴 (세로 화면은 왼쪽으로 끌 때)
    const d = geo.portrait ? -(e.clientX - dialLastX) : -(e.clientY - dialLastY);
    dialLastY = e.clientY; dialLastX = e.clientX;
    if (!dialMoved && Math.hypot(e.clientX - dialDownX, e.clientY - dialDownY) > 6) dialMoved = true;
    if (!dialMoved) return;
    // 바늘 쪽 둘레를 손으로 미는 느낌: 이동 거리 / 반지름 = 회전각
    dialTarget += d / geo.R;
    dialAngle = dialTarget;
    const near = Math.round(dialTarget / DIAL.step);
    dialIndex = wrapIndex(near);
    showGenre(dialIndex);
  });
  const endDial = (e) => {
    if (!dialDragging || e.pointerId !== dialPointer) return;
    dialDragging = false;
    dialTouch();
    if ($gdHit.hasPointerCapture(e.pointerId)) $gdHit.releasePointerCapture(e.pointerId);
    // 끌지 않고 눌렀다 뗐으면 = 클릭 → 누른 장르로 바로 (가까운 방향으로 돌아감)
    const hr = host.getBoundingClientRect();
    const tap = dialMoved ? -1 : genreAt(e.clientX - hr.left, e.clientY - hr.top);
    if (tap >= 0) selectGenre(tap);
    else setDial(Math.round(dialTarget / DIAL.step));   // 가장 가까운 장르로 스냅
  };
  // 화면 좌표 → 그 위치의 장르 글자 (없으면 -1). 회전된 글자를 글자 축 기준으로 판정
  function genreAt(x, y) {
    let best = -1, bestD = Infinity;
    labelHit.forEach((h, i) => {
      if (!h) return;
      const dx = x - h.x, dy = y - h.y;
      const along = dx * Math.cos(h.a) + dy * Math.sin(h.a);       // 글자 방향
      const across = -dx * Math.sin(h.a) + dy * Math.cos(h.a);     // 글자 높이 방향
      const fs = parseFloat(genreButtons[i].style.fontSize) || 20;
      if (Math.abs(along) <= h.half + 10 && Math.abs(across) <= fs * 0.75) {
        const dd = Math.abs(along) + Math.abs(across);
        if (dd < bestD) { bestD = dd; best = i; }
      }
    });
    return best;
  }
  // 장르 i로 이동: 지금 각도에서 가장 짧은 방향으로 (무한 회전이라 ±6칸 이내)
  function selectGenre(i) {
    dialTouch();
    const cur = Math.round(dialTarget / DIAL.step);
    let delta = wrapIndex(i - cur);
    if (delta > GENRES.length / 2) delta -= GENRES.length;
    setDial(cur + delta);
  }
  on($gdHit, 'pointermove', (e) => {
    if (dialDragging || e.pointerType !== 'mouse') return;
    const hr = host.getBoundingClientRect();
    hoverGenre = genreAt(e.clientX - hr.left, e.clientY - hr.top);
  });
  on($gdHit, 'pointerleave', () => { hoverGenre = -1; });
  on($gdHit, 'pointerup', endDial);
  on($gdHit, 'pointercancel', endDial);

  function updateDial(dt, catEase) {
    const visible = catEase > 0.01;
    $gd.style.visibility = visible ? 'visible' : 'hidden';
    if (!visible) {
      if (genreTinted) { genreTinted = false; applyColors(); }   // 다이얼을 떠나면 원래 테마 색으로
      return;
    }
    // 다이얼은 판이 거의 자리 잡은 뒤 나타남
    const show = easeOut(seg(catEase, 0.45, 1));
    // 다이얼 섹션에 들어올 때마다 지금 장르 정보도 차례대로 등장
    if (show > 0.35 && !dialRevealed) { dialRevealed = true; revealGenre(); }
    else if (show < 0.05) dialRevealed = false;
    updateWaves(dt, show);
    $gd.style.opacity = String(show);
    $gdPanel.style.translate = geo.portrait ? `0 ${((1 - show) * -16).toFixed(1)}px` : `${((1 - show) * 24).toFixed(1)}px 0`;

    const prev = dialAngle;
    if (!dialDragging) dialAngle += (dialTarget - dialAngle) * (1 - Math.exp(-dt / DIAL.follow));
    // 판도 다이얼과 함께 돎
    spin.rotation.y -= (dialAngle - prev) * DIAL.discSpin;

    // 다이얼 회전: 장르 i의 각도 = needle + i*step - dialAngle  → 선택된 장르가 바늘 위
    const { cx, cy, R, needle } = geo;
    const rText = R * 0.66;
    genreButtons.forEach((b, i) => {
      const a = needle + i * DIAL.step - dialAngle;
      // 클릭 판정용: 글자 가운데 위치와 반폭 (반지름 방향으로 놓인 글자)
      const mid = rText + b.offsetWidth / 2;
      labelHit[i] = { x: cx + Math.cos(a) * mid, y: cy + Math.sin(a) * mid, half: b.offsetWidth / 2, a };
      const off = Math.abs(Math.atan2(Math.sin(a - needle), Math.cos(a - needle)));   // 바늘에서 떨어진 각도
      const x = cx + Math.cos(a) * rText, y = cy + Math.sin(a) * rText;
      // 글자는 반지름 방향으로 바깥을 향해 읽힘. 왼쪽 반원은 뒤집어서 바로 읽히게
      let deg = (a * 180) / Math.PI;
      const flip = Math.cos(a) < 0;
      if (flip) deg += 180;
      b.style.transformOrigin = flip ? 'right center' : 'left center';
      b.style.transform = `translate(${(flip ? x - b.offsetWidth : x).toFixed(1)}px, ${(y - b.offsetHeight / 2).toFixed(1)}px) rotate(${deg.toFixed(2)}deg)`;
      const sel = i === dialIndex;
      b.style.color = sel ? GENRES[i].ink : 'var(--hs-muted)';
      // 박동 때 글자가 밝아짐 (바늘 근처일수록 더). 선택된 글자는 장르 색으로 번짐
      const glow = Math.min(1, beatEnv * 14);
      const base = Math.max(i === hoverGenre ? 0.75 : 0.1, 1 - off / 1.5);
      b.style.opacity = String(Math.min(1, base + glow * 0.45 * (1 - off / Math.PI)));
      b.style.textShadow = sel && glow > 0.02 ? `0 0 ${(4 + glow * 14).toFixed(1)}px rgba(${tintInk.toArray().map((v) => Math.round(v * 255)).join(',')},${(glow * 0.8).toFixed(2)})` : '';
    });

    // 판 색: 뒤집기(updateGenreFlip)가 정한 장르 색. 다이얼에 들어오는 동안은 기본 색에서 섞어 들어감
    // 기본 색은 지금 테마(플럼 ↔ 크림)의 잉크 → 장르 색으로
    // 시작 색 = New Vinyls에서의 판 색 (News로 가면 다시 Hero 색)
    const newsK = easeInOut(newsP);
    uniforms.uInk.value.copy(nvDiscInk).lerp(heroInk3, newsK).lerp(tintInk, catEase);
    uniforms.uLabel.value.copy(nvDiscLabel).lerp(heroLabel3, newsK).lerp(tintLabel, catEase);
    // 박동 때 판의 잉크가 잠깐 밝게 번쩍
    uniforms.uInk.value.lerp(beatWhite, Math.min(0.35, beatEnv * 5) * catEase);
    $gd.style.setProperty('--hs-genre', `rgb(${tintInk.toArray().map((v) => Math.round(v * 255)).join(',')})`);
    genreTinted = true;
  }
  layoutDial();
  setDial(opts.initialDial ?? 0);
  if (opts.initialDial) {
    // 다이얼에 머물던 장르 색 그대로 (돌아왔을 때 다시 뒤집지 않게)
    colorIndex = dialIndex;
    tintInk.copy(genreInk[dialIndex]); tintLabel.copy(genreLabel[dialIndex]);
  }
  on(window, 'resize', layoutDial);


  /* ================= News & Stories (마지막 섹션) ================= */
  // 마크업·기사는 HomeStage.jsx. 여기서는 등장 상태와 판 자리(news-disc)만 다룸
  const $news = q('news');
  const $newsDisc = q('news-disc');
  // 판이 놓일 자리: 턴테이블 위처럼 비스듬히
  const NEWS_COMPOSITION = {
    tilt: (36 * Math.PI) / 180,
    roll: (22 * Math.PI) / 180,
    fill: 0.47,          // 판 반지름 = 자리 폭 × fill
  };

  /* ================= 섹션 전환 (스크롤 의도 감지 + 자동 재생) ================= */
  // 조금만 스크롤해도 '다음/이전 섹션으로 가려는 의도'로 보고, 전환 애니메이션을 정해진 시간 동안 끝까지 재생
  //  - 섹션: 0 = Hero, 1 = New Vinyls, 2 = Genre dial (항상 이웃한 섹션으로 한 칸씩)
  //  - 0 ↔ 1: 진행도 scrollP (판이 한 바퀴 돌며 착륙) / 1 ↔ 2: 진행도 catP (판이 다이얼 가운데로 와서 정면을 봄)
  //  - 재생 중 추가 입력은 무시 (트랙패드 관성 스크롤이 다음 전환을 또 일으키지 않게)
  //  - Genre dial에서 스크롤은 장르를 바꾸지 않음: 위로 스크롤하면 New Vinyls로 돌아감
  const SECTION = {
    duration: 3.7,       // Hero ↔ New Vinyls 전환 시간(초) — 판이 앨범에 들어가는 장면
    catDuration: 1.75,   // New Vinyls ↔ Genre 전환 시간(초) — 앞부분(CAT_OUT)은 판이 오른쪽으로 빠져나오는 시간
    newsDuration: 1.6,   // Genre ↔ News 전환 시간(초)
    wheelThreshold: 24,  // 이만큼 휠이 쌓이면 전환 (트랙패드 살짝 쓸기 수준)
    touchThreshold: 40,  // 터치 스와이프 거리(px)
    cooldown: 0.45,      // 전환이 끝난 뒤 입력을 더 무시하는 시간(초) — 관성 스크롤 흡수
  };
  let section = 0;
  let scrollP = 0;                 // 0 = Hero, 1 = New Vinyls (판 착륙 진행도)
  let tweenFrom = 0, tweenTo = 0, tweenStart = 0, tweenDur = 0;
  let tweening = false;
  let catP = 0, catFrom = 0, catTo = 0, catStart = 0, catDur = 0, catTweening = false;
  let newsP = 0, newsFrom = 0, newsTo = 0, newsStart = 0, newsDur = 0, newsTweening = false;   // 0 = Genre dial, 1 = News
  let lockUntil = 0;               // 이 시각 전까지 입력 무시
  let wheelAcc = 0, wheelAccAt = 0;
  function nowSec() { return performance.now() / 1000; }
  const easeInOutSine = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

  function goSection(next) {
    if (intro.t0 >= 0) return;   // 인트로 중에는 섹션 이동 안 함
    next = Math.max(0, Math.min(3, next));
    if (next === section) return;
    const prev = section;
    section = next;
    wheelAcc = 0;
    if ((prev === 2 && next === 3) || (prev === 3 && next === 2)) {
      // Genre dial ↔ News: 판이 오른쪽 칸으로 옮겨 가 턴테이블처럼 눕고, 배경은 다시 크림으로
      newsFrom = newsP; newsTo = next === 3 ? 1 : 0;
      newsDur = reduceMotion ? 0 : SECTION.newsDuration * Math.abs(newsTo - newsFrom);
      newsStart = nowSec();
      newsTweening = newsDur > 0; if (!newsTweening) newsP = newsTo;
      if (next === 3) $news.scrollTop = 0;
      lockUntil = newsStart + newsDur + SECTION.cooldown;
      if (next === 2) dialIdleAt = newsStart + newsDur;
    } else if (prev === 1 && next === 2) {
      // 판이 먼저 슬리브에서 오른쪽으로 빠져나온 뒤 왼쪽 다이얼 자리로 (릴은 그동안 오른쪽으로 빠짐)
      // 나머지 앨범이 먼저 사라지고 → 판이 맨 앞 앨범에서 오른쪽으로 빠져나와 → 왼쪽 다이얼 자리로
      reelOutSpeed = 2.7;
      const wait = reduceMotion ? 0 : albumClock / reelOutSpeed + 0.04;
      catFrom = catP; catTo = 1;
      catDur = reduceMotion ? 0 : SECTION.catDuration * Math.abs(catTo - catFrom);
      catStart = nowSec() + wait;
      catTweening = catDur > 0; if (!catTweening) catP = 1;
      lockUntil = catStart + catDur + SECTION.cooldown;
      dialIdleAt = catStart + catDur;      // 도착한 뒤부터 자동 넘김 대기
    } else if (prev === 2 && next === 1) {
      catFrom = catP; catTo = 0;
      catDur = reduceMotion ? 0 : SECTION.catDuration * Math.abs(catTo - catFrom);
      catStart = nowSec();
      catTweening = catDur > 0; if (!catTweening) catP = 0;
      lockUntil = catStart + catDur + SECTION.cooldown;
    } else {
      // 0 ↔ 1
      tweenFrom = scrollP; tweenTo = next;
      tweenDur = reduceMotion ? 0 : SECTION.duration * Math.abs(tweenTo - tweenFrom);
      // 위로 돌아갈 땐 나머지 앨범이 먼저 사라진 뒤 거꾸로 (앨범이 눕고 → 판이 빠져나와 → 앨범은 아래로)
      reelOutSpeed = 2.7;
      const wait = next === 0 && !reduceMotion ? albumClock / reelOutSpeed + 0.04 : 0;
      tweenStart = nowSec() + wait;
      tweening = tweenDur > 0; if (!tweening) scrollP = tweenTo;
      lockUntil = tweenStart + tweenDur + SECTION.cooldown;
    }
    opts.onSectionChange?.(next);
  }
  function updateSectionTween() {
    if (tweening) {
      const t = clamp01((nowSec() - tweenStart) / tweenDur);
      scrollP = tweenFrom + (tweenTo - tweenFrom) * t;      // 일정 속도 (구간마다 따로 이징)
      if (t >= 1) { scrollP = tweenTo; tweening = false; }
    }
    if (catTweening) {
      const t = clamp01((nowSec() - catStart) / catDur);
      catP = catFrom + (catTo - catFrom) * t;
      if (t >= 1) { catP = catTo; catTweening = false; }
    }
    if (newsTweening) {
      const t = clamp01((nowSec() - newsStart) / newsDur);
      newsP = newsFrom + (newsTo - newsFrom) * easeInOutSine(t);
      if (t >= 1) { newsP = newsTo; newsTweening = false; }
    }
  }
  // News 안쪽 스크롤: 내용이 화면보다 길 때는 섹션 이동 대신 그 안에서 스크롤
  const newsCanScroll = (dir) => dir > 0
    ? $news.scrollTop + $news.clientHeight < $news.scrollHeight - 1
    : $news.scrollTop > 0;
  const inputLocked = () => nowSec() < lockUntil;

  // 휠: 기본 스크롤을 막고 의도만 읽음
  on(layer, 'wheel', (e) => {
    if (e.ctrlKey) return;                          // 핀치 줌은 그대로
    // New Vinyls: 휠(세로·가로 모두)로 릴을 돌림. 한 바퀴 끝에서 더 굴리면 다음/이전 섹션 (reelWheel)
    if (section === 1 && reelN() > 0 && !tweening && !catTweening) {
      e.preventDefault();
      if (inputLocked() || !reelReady()) { wheelAcc = 0; return; }   // 릴이 들어오는 동안은 기다림
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      reelWheel(d * (e.deltaMode === 1 ? 16 : 1));
      return;
    }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;   // 가로 스와이프는 섹션 이동에 쓰지 않음
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    if (section === 3 && !newsTweening && e.target instanceof Node && $news.contains(e.target) && newsCanScroll(Math.sign(dy))) {
      wheelAcc = 0;               // News 안에서 그냥 스크롤 (브라우저 기본 동작)
      return;
    }
    e.preventDefault();
    if (inputLocked()) { wheelAcc = 0; return; }
    const t = nowSec();
    if (t - wheelAccAt > 0.25) wheelAcc = 0;        // 멈췄다 다시 굴리면 새로 셈
    wheelAccAt = t;
    wheelAcc += dy;
    // Genre dial에서도 스크롤은 장르를 바꾸지 않고 섹션만 이동. News가 마지막
    if (wheelAcc > SECTION.wheelThreshold) goSection(section + 1);
    else if (wheelAcc < -SECTION.wheelThreshold) goSection(section - 1);
  }, { passive: false });

  // 터치: 세로 스와이프 의도 (Hero에서 판을 누르고 있을 땐 무시)
  let touchY0 = null, touchX0 = 0;
  let touchOnDial = false;
  let touchInNews = false, touchNewsTop = 0;
  on(layer, 'touchstart', (e) => {
    touchY0 = e.touches[0]?.clientY ?? null;
    touchX0 = e.touches[0]?.clientX ?? 0;
    touchInNews = section === 3 && e.target instanceof Node && $news.contains(e.target);
    touchNewsTop = $news.scrollTop;
    touchOnDial = e.target === $gdHit;   // 다이얼을 끄는 손가락은 섹션 이동으로 보지 않음
  }, { passive: true });
  on(layer, 'touchmove', (e) => {
    if (touchY0 === null) return;
    if (touchInNews) return;     // News 안쪽은 손가락으로 그냥 스크롤
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  on(layer, 'touchend', (e) => {
    if (touchY0 === null) return;
    const dy = touchY0 - (e.changedTouches[0]?.clientY ?? touchY0);
    const dx = touchX0 - (e.changedTouches[0]?.clientX ?? touchX0);
    touchY0 = null;
    if (pressed || dialDragging || touchOnDial || inputLocked()) return;
    // New Vinyls: 위/왼쪽으로 쓸면 다음 앨범, 아래/오른쪽은 이전 (한 바퀴 끝이면 섹션 이동)
    if (section === 1 && reelN() > 0) {
      if (!reelReady()) return;
      const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(d) > REEL.swipe) reelStepOrLeave(Math.sign(d));
      return;
    }
    if (section === 3) {
      // 맨 위에서 아래로 끌어내리면 Genre dial로
      if (dy < -SECTION.touchThreshold && touchNewsTop <= 0) goSection(2);
      return;
    }
    if (dy > SECTION.touchThreshold) goSection(section + 1);
    else if (dy < -SECTION.touchThreshold) goSection(section - 1);
  }, { passive: true });

  // 키보드: 아래로 가는 키 → 다음, 위로 가는 키 → 이전 (Genre dial에서는 한 칸씩)
  on(window, 'keydown', (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"], .navbar, [data-crate-handle], [role="dialog"]')) return;
    // Genre dial: ←/→는 키보드 사용자를 위한 장르 이동 (스크롤 키와는 분리)
    if (section === 2 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      dialStep(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    const down = ['ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(e.key) && !e.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    // New Vinyls: ←/→는 앨범 한 장씩, ↓/↑는 한 장씩 넘기다 끝이면 섹션 이동
    if (section === 1 && reelN() > 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || down || up)) {
      if (e.target instanceof HTMLElement && e.target.closest('a, button') && e.key === ' ') return;
      e.preventDefault();
      if (inputLocked() || !reelReady()) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') reelFlip(e.key === 'ArrowRight' ? 1 : -1);
      else reelStepOrLeave(down ? 1 : -1);
      return;
    }
    if (!down && !up) return;
    e.preventDefault();
    if (inputLocked()) return;
    if (section === 3 && newsCanScroll(down ? 1 : -1)) {
      $news.scrollBy({ top: (down ? 1 : -1) * innerHeight * 0.75, behavior: reduceMotion ? 'instant' : 'smooth' });
      return;
    }
    goSection(section + (down ? 1 : -1));
  });

  // 다른 페이지에 다녀오면(앨범 상세 → 뒤로) 떠날 때의 섹션으로 바로
  {
    const s0 = opts.initialSection ?? 0;
    if (s0 >= 1) { section = 1; scrollP = 1; albumClock = AUTO.total; }
    if (s0 >= 2) { section = 2; catP = 1; }
    if (s0 >= 3) { section = 3; newsP = 1; }
  }

  function updateNews(newsEase) {
    const show = easeOut(seg(newsEase, 0.35, 1));
    $news.style.visibility = newsEase > 0.01 ? 'visible' : 'hidden';
    $news.style.opacity = String(show);
    $news.classList.toggle('is-in', section === 3 && newsP > 0.45);
  }

  /* ================= 루프 ================= */
  const clock = new THREE.Clock();
  const DEG = Math.PI / 180;
  let fxSceneFade = 1;
  let dustFade = 1;       // Genre dial에서는 먼지를 거의 숨김     // 1 = Hero(링·헤일로 보임), 0 = New Vinyls
  let heroActive = true;   // Hero 구간에서만 누르기·뒤집기·링 호버 동작
  const $nvHead = q('nv-head');
  const $nvLines = [...host.querySelectorAll('#nv-title .nv-line')];
  const $nvInfo = [...host.querySelectorAll('[data-nv-info]')];
  const $nvVig = q('nv-vig');

  let dragWeight = 1;
  let fxLevel = 0;
  const parallaxTarget = new THREE.Vector2();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    // 인트로(프리로더)가 화면을 덮고 있는 동안은 그리지 않음 → 프리로더 애니메이션에 GPU를 양보
    if (!introDone) return;

    // 0) 스크롤 진행도: 0 = Hero, 1 = New Vinyls. 살짝 스무딩해서 휠 스크롤도 부드럽게
    //    스크롤 위치가 아니라 '섹션 전환 트윈'이 진행도를 시간에 따라 0 ↔ 1로 움직임
    updateSectionTween();
    const p = scrollP;
    //  Hero → New Vinyls: 기울어진 판이 일어서서 정면(원)을 보며 맨 앞 슬리브 위로 → 세로축으로 한 바퀴
    //  → 릴이 들어오면 슬리브 안으로 쏙 (nvDiscTarget). 되돌아갈 땐 거꾸로
    const catOut = easeInOutSine(seg(catP, 0, CAT_OUT));        // Genre로: 먼저 판이 오른쪽으로 빠져나옴
    const nvT = nvDiscTarget(p, catOut);
    const settle = easeInOutSine(seg(p, 0, SCROLL.standEnd));
    const spinT = easeInOutSine(seg(p, SCROLL.spinStart, SCROLL.spinEnd));
    root.rotation.z = THREE.MathUtils.lerp(HERO_COMPOSITION.roll, LANDED_COMPOSITION.roll, settle);
    comp.rotation.x = THREE.MathUtils.lerp(HERO_COMPOSITION.tilt, LANDED_COMPOSITION.tilt, settle);
    root.scale.setScalar(THREE.MathUtils.lerp(heroScale, nvT.s, settle));
    tumble.rotation.set(0, spinT * Math.PI * 2, 0);
    root.position.y = THREE.MathUtils.lerp(0, nvT.y, settle);
    heroActive = p < SCROLL.heroEnd;
    //  New Vinyls → Genre dial: 판이 다이얼 가운데로 미끄러져 와서 정면을 보고 섬
    const catEase = easeInOutSine(seg(catP, CAT_OUT - CAT_OVERLAP, 1));   // 이어서 다이얼 자리로 (다이얼 색·글자도 이 진행도)
    if (catEase > 0) {
      const dialScale = (geo.R * 0.5) / ZOOM;                 // 판 반지름 = 다이얼 반지름의 절반
      // geo는 스테이지(헤더 아래) 좌표 → 캔버스(화면 전체) 좌표로
      const dx = (geo.cx - canvas.clientWidth / 2) / ZOOM, dy = (canvas.clientHeight / 2 - (geo.cy + headerTop)) / ZOOM;
      comp.rotation.x = THREE.MathUtils.lerp(comp.rotation.x, Math.PI / 2, catEase);
      root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, catEase);
      root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x, dialScale, catEase));
      root.position.x = THREE.MathUtils.lerp(nvT.x * settle, dx, catEase);
      root.position.y = THREE.MathUtils.lerp(root.position.y, dy, catEase);
    } else {
      root.position.x = nvT.x * settle;
    }
    //  Genre dial → News: 판이 오른쪽 칸(news-disc)으로 옮겨 가 턴테이블 위처럼 비스듬히 눕고 돎
    const newsEase = easeInOut(newsP);
    if (newsEase > 0) {
      const r = $newsDisc.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
      const ncx = r.width > 0 ? r.left - cr.left + r.width / 2 : cr.width * 1.3;    // 자리가 없으면 화면 밖으로
      const ncy = r.width > 0 ? r.top - cr.top + r.height / 2 : cr.height / 2;
      const nScale = Math.max(r.width, 120) * NEWS_COMPOSITION.fill / ZOOM;
      comp.rotation.x = THREE.MathUtils.lerp(comp.rotation.x, NEWS_COMPOSITION.tilt, newsEase);
      root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, NEWS_COMPOSITION.roll, newsEase);
      root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x, nScale, newsEase));
      // 옮겨 가는 동안 살짝 떠올랐다 내려앉음
      const hop = Math.sin(Math.PI * newsEase) * 0.06 * viewH;
      root.position.x = THREE.MathUtils.lerp(root.position.x, (ncx - cr.width / 2) / ZOOM, newsEase);
      root.position.y = THREE.MathUtils.lerp(root.position.y, (cr.height / 2 - ncy) / ZOOM, newsEase) + hop;
      // 판이 바늘을 만나듯 옮겨 가는 동안 한 번 빠르게 돎
      if (newsTweening) spin.rotation.y -= Math.sin(Math.PI * newsP) * 5 * dt;
    }
    const dialVis = catEase * (1 - newsEase);       // 다이얼(장르 색·파동·글자)이 보이는 정도
    dustFade = 1 - 0.85 * dialVis;
    updateGenreFlip(dt, dialVis);
    //  바닥 그림자(판 아래 희미한 고리)는 쓰지 않음 — 다시 켜려면 아래 두 줄로
    //  shadowUniforms.uShadow.value = 0.45 * (1 - settle); shadow.visible = settle < 0.99;
    shadow.visible = false;

    //  Hero 타이틀은 위로 사라지고, New Vinyls 타이틀은 착륙 뒤 나타남
    const heroOut = seg(p, 0.0, 0.14);
    fxSceneFade = 1 - seg(p, 0.0, SCROLL.fxOutEnd);   // 링·헤일로는 Hero 전용
    applyIntroPose();
    title.style.opacity = String(1 - heroOut);
    //  배경·글자·잉크 색: 판이 내려오는 동안 크림 → 플럼으로 자연스럽게
    applyTheme(easeInOut(seg(p, 0.15, 0.85)) * (1 - newsEase));   // News에서는 다시 크림
    updateReel(dt, p);
    const vinylT = seg(p, 0, 0.04) * (1 - catEase);   // Hero의 크림 종이를 판에 붙여 어느 배경 위에서도 Hero 판 그대로
    vinylBack.material.opacity = vinylT;
    // 판이 앨범 안에 완전히 들어가 있으면 그리지 않음 (앨범이 넘어갈 때 반투명해지는 앨범 너머로 비치지 않게)
    spin.visible = !(p >= SCROLL.insertEnd && catP <= 0 && reelHoverEase < 0.02 && newsEase <= 0);
    vinylBack.material.color.set(sectionPalette()[0].paper);
    vinylBack.visible = vinylT > 0.005;
    updateNvTint(dt, catEase);
    updateDial(dt, dialVis);
    updateDialAuto();
    updateNews(newsEase);

    // 1) 패럴랙스: 현재값이 목표(마우스 위치)를 부드럽게 따라감
    // 드래그 중에는 패럴랙스를 약하게 (두 움직임이 싸우지 않도록)
    dragWeight += ((holding || flipping ? 0.3 : 1) - dragWeight) * (1 - Math.exp(-dt * 6));
    parallaxTarget.copy(target).multiplyScalar(dragWeight);
    current.lerp(parallaxTarget, 1 - Math.exp(-dt * PARALLAX.damping));
    // 카메라가 레코드 중심을 바라본 채 작은 궤도로 이동
    //  마우스 오른쪽 → 카메라가 오른쪽으로 → 판이 살짝 돌아 보임
    //  마우스 위쪽   → 카메라가 위로
    const yaw = current.x * PARALLAX.yaw * DEG;
    const pitch = -current.y * PARALLAX.pitch * DEG;
    camera.position.set(
      Math.sin(yaw) * Math.cos(pitch) * CAM_DISTANCE,
      Math.sin(pitch) * CAM_DISTANCE,
      Math.cos(yaw) * Math.cos(pitch) * CAM_DISTANCE,
    );
    camera.lookAt(0, 0, 0);

    // 타이포는 반대 방향으로 조금 → 레이어 사이 깊이감
    const tx = typoToggle.checked ? -current.x * PARALLAX.typo : 0;
    const ty = typoToggle.checked ? -current.y * PARALLAX.typo * 0.5 : 0;
    title.style.translate = `${tx.toFixed(2)}px calc(-50% + ${(ty - heroOut * innerHeight * 0.25).toFixed(2)}px)`;

    // 2) 회전
    //  모터 목표 속도: startDelay 정지 → spinEase 동안 ease-in-out 가속
    const t = performance.now() / 1000 - startedAt - SPIN.startDelay;
    const ramp = t <= 0 ? 0 : t >= SPIN.spinEase ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / SPIN.spinEase);
    const rpm = reduceMotion ? 0 : SPIN.rpm;
    const motorOmega = -((rpm * ramp) / 60) * Math.PI * 2;

    if (holding) {
      //  누르는 동안: 모터 방향으로 점점 가속 (최고 속도에서 멈춤)
      holdTime += dt;
      const dir = Math.sign(motorOmega) || -1;
      const maxOmega = (HOLD.maxRpm / 60) * Math.PI * 2;
      omega += dir * HOLD.accel * dt;
      omega = dir < 0 ? Math.max(omega, -maxOmega) : Math.min(omega, maxOmega);
    } else {
      //  뗀 뒤: 그 속도에서 시작해 모터 속도로 서서히 복귀 (관성)
      omega += (motorOmega - omega) * (1 - Math.exp(-dt / Math.max(PARALLAX.inertia / 3, 0.01)));
    }
    spin.rotation.y += omega * dt;
    updateFlip(dt);

    //  회전 이펙트: 속도 → 강도(올라갈 땐 빠르게, 내려갈 땐 천천히)
    //  기본 속도(10)에서 0, 최고 속도(45)에서 1. 기본 회전 중에도 아주 옅게 남김(FX_IDLE)
    const rpmNow = (Math.abs(omega) * 60) / (Math.PI * 2);
    const fxNorm = THREE.MathUtils.clamp((rpmNow - SPIN.rpm) / (HOLD.maxRpm - SPIN.rpm), 0, 1);
    const fxTarget = Math.max(fxNorm, FX_IDLE * Math.min(1, rpmNow / SPIN.rpm));
    const fxTau = fxTarget > fxLevel ? 0.12 : 0.7;
    fxLevel += (fxTarget - fxLevel) * (1 - Math.exp(-dt / fxTau));
    haloUniforms.uFx.value = Math.min(1, Math.pow(fxLevel, 0.8) * PARALLAX.fx) * fxSceneFade;
    if (Math.abs(omega) > 0.05) haloUniforms.uDir.value = Math.sign(omega);
    //  레인은 바깥일수록 판보다 느리게 따라감 → 공기가 끌려가는 느낌
    for (let i = 0; i < LANES; i++) {
      const lag = 1 - i * 0.06;
      haloUniforms.uLane.value[i] = (haloUniforms.uLane.value[i] - omega * lag * dt) % (Math.PI * 2);
    }
    haloUniforms.uRipple.value += dt * (0.25 + 3.2 * haloUniforms.uFx.value);
    //  붓 획: 각자 다른 속도로 판에 끌려 돎. 안 보이는 획은 가끔 새로 뽑아 매번 다른 모양
    for (let i = 0; i < STROKES; i++) {
      const m = strokeMeta[i];
      m.angle = (m.angle - omega * m.lag * dt) % (Math.PI * 2);
      haloUniforms.uSA.value[i].w = m.angle;
      const appearAt = haloUniforms.uSB.value[i].z;
      if (haloUniforms.uFx.value < appearAt - 0.05 && Math.random() < dt * 0.35) rollStroke(i);
    }
    haloUniforms.uTime.value += dt;
    //  판 위 빛줄기도 함께: 빠를수록 진하고 넓게 (잉크 잔상이 판까지 번진 느낌)
    const fxNow = haloUniforms.uFx.value;
    uniforms.uStreak.value = 1.1 + 0.5 * fxNow;
    uniforms.uSharp.value = 60 - 24 * fxNow;

    //  타이포 링: 판과 함께 돌고, 빠를수록 번짐
    const TAU = Math.PI * 2;
    rimUniforms.uAngle.value = ((spin.rotation.y % TAU) + TAU) % TAU;
    //  기본 속도(10 RPM)까지는 또렷하게, 그 이상부터 번지기 시작
    rimUniforms.uBlur.value = Math.min(0.045, Math.max(0, Math.abs(omega) - SPIN.rpm * RPM2W) * 0.012);
    updateStrobe(dt);
    updateTitle(dt, fxNorm);
    updateTitleRise();
    //  링 표시: 판(또는 링) 위에 올리거나 누르는 동안 서서히 나타나고, 벗어나면 천천히 사라짐
    const ringTarget = ((heroActive && overRing) || holding) && fxSceneFade > 0.5 ? 1 : 0;
    const ringTau = ringTarget > rimUniforms.uReveal.value ? 0.35 : 0.6;
    rimUniforms.uReveal.value += (ringTarget - rimUniforms.uReveal.value) * (1 - Math.exp(-dt / ringTau));
    rimUniforms.uReveal.value *= fxSceneFade > 0.99 ? 1 : fxSceneFade;
    rim.visible = rimUniforms.uReveal.value > 0.001;
    updateDust(dt, performance.now() / 1000);

    // 3) 커서
    updateCursor(dt);

    // 4) 빛줄기
    updateLight();
    // 릴 뒤쪽 슬리브 → 판 → 맨 앞 슬리브 (카메라가 달라 깊이를 나눠 그림)
    renderer.clear();
    const reelOn = nvReel.visible;
    if (reelOn) { nvReel.render('back'); renderer.clearDepth(); }
    renderer.render(scene, camera);
    if (reelOn) { renderer.clearDepth(); nvReel.render('front'); }
  });

  /* ================= 시작 상태 · 외부 API ================= */
  if (opts.albums) nvReel.setAlbums(opts.albums);
  ready = true;
  resize(); layoutDial();   // 불러오는 동안 창 크기가 바뀌었을 수 있음

  return {
    /** New Vinyls 앨범 목록 (Supabase에서 받은 뒤) */
    setAlbums(list, { frontSlug } = {}) {
      if (disposed) return;
      nvReel.setAlbums(list);
      shownK = null;
      // 앨범 상세에서 돌아왔으면 그 앨범이 정면에 오게
      const i2 = frontSlug ? list.findIndex((a) => a.slug === frontSlug) : -1;
      if (i2 > 0) { reelPos = reelTarget = i2; }
    },
    /** 인트로가 끝나면 회전 대기 시작 + 입력 허용 */
    setIntroDone(done) {
      if (!done || introDone) return;
      introDone = true;
      const now = performance.now() / 1000;
      if (section === 0 && !reduceMotion) {
        // 로딩 화면이 파란 라벨로 파고들어 화면을 덮은 상태 → 3D 판의 라벨 속에서 빠져나오며 Hero 자세로
        intro.t0 = now;
        startedAt = now - SPIN.startDelay - SPIN.spinEase;              // 모터는 이미 Hero 속도
        omega = -(INTRO.handoffRpm / 60) * Math.PI * 2;                 // 로딩 판의 회전을 이어받아 서서히 감속
        TITLE_RISE.delay = SPIN.startDelay + SPIN.spinEase + INTRO.titleAt;   // startedAt을 앞당겼으므로 그만큼 보정
      } else {
        intro.k = 1;
        startedAt = now;
      }
    },
    goSection(n) { if (!disposed && !inputLocked()) goSection(n); },
    /** 애니메이션 없이 그 섹션으로 바로 (Footer 의 Back to top: Hero 로) */
    jumpTo(n) {
      if (disposed) return;
      n = Math.max(0, Math.min(3, n));
      tweening = catTweening = newsTweening = false;
      section = n; wheelAcc = 0;
      scrollP = n >= 1 ? 1 : 0; albumClock = n >= 1 ? AUTO.total : 0;
      catP = n >= 2 ? 1 : 0; newsP = n >= 3 ? 1 : 0;
      $news.scrollTop = 0;
      lockUntil = nowSec() + SECTION.cooldown;
      opts.onSectionChange?.(n);
    },
    get section() { return section; },
    get dialIndex() { return dialIndex; },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      cleanups.forEach((fn) => fn());
      nvReel.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      });
      waveQuad.geometry.dispose(); waveQuad.material.dispose();
      waveRenderer.dispose(); waveRenderer.forceContextLoss();
      renderer.dispose(); renderer.forceContextLoss();
      dracoLoader.dispose();
      $waveCanvas.remove();
      canvas.remove();
      genreButtons.forEach((b) => b.remove());
      host.classList.remove('custom-cursor');
      host.closest('.ct-page')?.style.removeProperty('--wire-t');
      host.closest('.ct-page')?.style.removeProperty('--ink');
      host.closest('.ct-page')?.style.removeProperty('--cream');
    },
  };
}
