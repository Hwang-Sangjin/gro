// Grooves Home stage engine — 프로토타입(grooves-ink-vinyl.html)의 Three.js 코드를 그대로 옮긴 것.
// React(HomeStage.jsx)가 마크업을 그리고, 이 엔진이 3D·섹션 전환·입력·DOM 연출을 맡는다.
//
//  섹션: 0 Hero → 1 New Vinyls → 2 Genre dial → 3 News (휠·터치·키보드로 한 칸씩)
//  페이지 사이 이동(Crate Flip)과 앨범 커버 이동 전환은 기존 시스템이 그대로 담당.
//  튜닝 값은 각 블록 위의 대문자 상수(SPIN, HOLD, RING, DIAL, WAVE, BEAT ...)와 homeGenres.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

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
  // 스크롤하면 판이 따라 내려오며 한 바퀴 돌고, 거의 눕혀진 상태로 착륙
  const LANDED_COMPOSITION = {
    tilt: (19 * Math.PI) / 180,   // 단축/장축 ≈ 0.33 → 넓게 누운 타원
    roll: 0,
    widthFraction: 0.46,          // 판(반지름 1) 지름이 화면 폭 기준 비율
    heightFraction: 0.4,
    centerY: -0.1,               // 화면 높이 대비 중심 위치 (+ = 위). 앨범이 주인공이라 판은 아래로
  };
  function getLandedRecordScale(width, height) {
    const { tilt, widthFraction, heightFraction } = LANDED_COMPOSITION;
    const ringR = 1.24;           // 링 바깥까지 화면에 들어오게
    const projectedWidth = 2 * ringR;
    const projectedHeight = 2 * ringR * Math.sin(tilt) + 0.06;
    return Math.min((width * widthFraction * ringR) / projectedWidth, (height * heightFraction) / projectedHeight);
  }
  // 전환 타임라인 (진행도 0 = Hero, 1 = New Vinyls). 진행도는 '섹션 전환' 트윈이 시간에 따라 움직임
  const SCROLL = {
    heroEnd: 0.03,                         // 이 지점까지는 Hero 기능(링·헤일로·누르기·뒤집기) 그대로
    fxOutEnd: 0.12,                        // 링·헤일로가 사라지는 시점
    tumbleStart: 0.06, tumbleEnd: 0.8,     // 이 구간에서 한 바퀴
    settleEnd: 0.92,                       // 이때까지 착륙 자세로
    albumTrigger: 0.9,                     // 착륙하면 앨범 등장 시작 (이후는 시간으로 자동 재생)
    lift: 0.07,                            // 도는 동안 살짝 떠오르는 높이(화면 높이 대비)
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
  canvas.setAttribute('aria-label', '잉크 드로잉 스타일 바이닐 3D. 판을 누르고 있으면 빨라지고, 누른 채 끌면 뒤집혀요');
  (q('hs-canvas') ?? host).prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
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

  /* ================= New Vinyls: 판 위 360° 앨범 링 ================= */
  // 배치 규칙
  //  - 바퀴 살처럼 방사형으로 세움 (앨범 아래 모서리의 연장선 = 디스크 중심), 360° 균등
  //  - 앞면은 모두 원주를 따라 같은 방향(반시계) → 화면 왼쪽은 뒷면, 오른쪽은 앞면이 보임
  //  - 판(spin) 밖, comp 그룹의 albumGroup에 붙임 → 판은 계속 돌고, 앨범 링은 드래그로 돌림
  // 커버 디자인(실제 이미지가 없거나 불러오는 동안 쓰는 임시 커버)
  const LOOKS = ['sun', 'sunset', 'mono', 'circle', 'stripes', 'wave', 'type', 'stars', 'grid', 'dots'];
  let ALBUM_LIST = [];
  const ALBUM = {
    size: 0.46,          // 정사각 앨범 한 변 (판 반지름 = 1)
    inner: 0.46,         // 아래 모서리 안쪽 끝의 반지름 → 바깥 끝 = 0.92
    depth: 0.0075,       // 두께 (얇은 종이 재킷)
    dropHeight: 1.6,     // 떨어지기 시작하는 높이
    hoverLift: 0.06,
  };
  let ALBUM_STEP = Math.PI * 2;   // 앨범 사이 각도 (앨범 수에 따라: 10장 → 36°, 7장 → 51°)

  // --- 임시 커버 (실제 이미지로 교체 예정) ---
  function coverCanvas(a, side) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const W = 512;
    const font = (w, px, fam = '"Grooves Bodoni", Georgia, serif') => `${w} ${px}px ${fam}`;
    if (side === 'back') {
      // 뒷면: 트랙리스트 + 바코드
      const dark = ['stars', 'mono', 'grid', 'wave', 'sunset'].includes(a.look);
      g.fillStyle = dark ? '#1d1b22' : '#efe4cf'; g.fillRect(0, 0, W, W);
      const ink = dark ? '#e9e1d3' : '#2a2430';
      g.fillStyle = ink;
      g.font = font('700', 26); g.fillText(a.artist.toUpperCase(), 36, 62);
      g.font = font('400', 20); g.fillText(a.title, 36, 92);
      g.font = "500 15px \"PP Neue Montreal\", Arial, sans-serif";
      for (let i = 0; i < 10; i++) {
        g.globalAlpha = 0.85;
        g.fillText(`${i < 5 ? 'A' : 'B'}${(i % 5) + 1}`, 36, 140 + i * 26);
        g.fillRect(76, 134 + i * 26, 120 + ((i * 53) % 140), 3);
      }
      g.globalAlpha = 1;
      // 바코드
      g.fillStyle = '#fff'; g.fillRect(360, 400, 120, 72);
      g.fillStyle = '#111';
      for (let x = 368, i = 0; x < 472; i++) { const w = 1 + ((i * 7) % 4); g.fillRect(x, 408, w, 50); x += w + 1 + (i % 3); }
      return c;
    }
    // 앞면
    const rnd = (n) => (Math.sin(n * 91.7 + a.title.length * 13.1) * 43758.5453) % 1;
    switch (a.look) {
      case 'stars': {
        g.fillStyle = '#121218'; g.fillRect(0, 0, W, W);
        for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.abs(rnd(i)) * 0.7})`; g.fillRect(Math.abs(rnd(i * 2)) * W, Math.abs(rnd(i * 3)) * W * 0.6, 2, 2); }
        g.fillStyle = '#0a0a0e'; g.beginPath(); g.moveTo(0, W);
        for (let x = 0; x <= W; x += 16) g.lineTo(x, 330 + Math.sin(x * 0.04) * 26 + Math.abs(rnd(x)) * 40);
        g.lineTo(W, W); g.fill();
        g.fillStyle = '#f3ead8'; g.font = font('400', 40); g.fillText(a.title, 36, 470);
        break;
      }
      case 'grid': {
        g.fillStyle = '#2b2440'; g.fillRect(0, 0, W, W);
        const cols = ['#e2725b', '#f2c14e', '#4f6d93', '#bbcbda', '#8f5f8a', '#f4e7cd'];
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = cols[(x * 3 + y * 5) % cols.length]; g.fillRect(40 + x * 54, 40 + y * 54, 46, 46); }
        g.fillStyle = '#f4e7cd'; g.fillRect(40, 452, 432, 44);
        g.fillStyle = '#2b2440'; g.font = font('700', 28); g.fillText(a.title.toUpperCase(), 52, 484);
        break;
      }
      case 'dots': {
        g.fillStyle = '#1f4b9a'; g.fillRect(0, 0, W, W);
        g.fillStyle = '#f2c94c';
        for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(Math.abs(rnd(i)) * W, Math.abs(rnd(i + 40)) * W, 6 + Math.abs(rnd(i + 80)) * 18, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#f4e7cd'; g.font = font('900', 46); g.fillText(a.title, 32, 80);
        break;
      }
      case 'sun': {
        const gr = g.createLinearGradient(0, 0, 0, W); gr.addColorStop(0, '#f08a24'); gr.addColorStop(1, '#c2361b');
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
        g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(256, 300, 120, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7a1c12'; for (let i = 0; i < 6; i++) g.fillRect(0, 330 + i * 26, W, 10 + i * 2);
        g.fillStyle = '#fff3dc'; g.font = font('900', 44); g.fillText(a.title.toUpperCase(), 32, 80);
        break;
      }
      case 'sunset': {
        g.fillStyle = '#b3121b'; g.fillRect(0, 0, W, W);
        const gr = g.createRadialGradient(330, 330, 20, 330, 330, 260); gr.addColorStop(0, '#ff7a3d'); gr.addColorStop(1, 'rgba(179,18,27,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, W);
        g.fillStyle = '#3a0508'; g.beginPath(); g.ellipse(200, 420, 120, 70, -0.3, 0, Math.PI * 2); g.fill();
        g.save(); g.translate(40, 60); g.rotate(0.12); g.fillStyle = '#ffe9d6'; g.font = font('900', 64); g.fillText(a.title.toUpperCase(), 0, 40); g.restore();
        break;
      }
      case 'circle': {
        g.fillStyle = '#e9dcc4'; g.fillRect(0, 0, W, W);
        g.fillStyle = '#c4473a'; g.beginPath(); g.arc(256, 250, 150, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#2a2430'; g.lineWidth = 6; g.beginPath(); g.arc(256, 250, 190, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#2a2430'; g.font = font('900', 40); g.fillText(a.title.toUpperCase(), 36, 470);
        break;
      }
      case 'stripes': {
        const cols = ['#f2c14e', '#e2725b', '#4f6d93', '#3a5240', '#f4e7cd'];
        for (let i = 0; i < 10; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, i * 52, W, 52); }
        g.fillStyle = '#1d1b22'; g.fillRect(36, 36, 300, 70);
        g.fillStyle = '#f4e7cd'; g.font = font('900', 34); g.fillText(a.title.toUpperCase(), 50, 84);
        break;
      }
      case 'wave': {
        g.fillStyle = '#0f3d4a'; g.fillRect(0, 0, W, W);
        g.strokeStyle = '#9fd3c7'; g.lineWidth = 4;
        for (let k = 0; k < 14; k++) { g.beginPath(); for (let x = 0; x <= W; x += 8) g.lineTo(x, 140 + k * 24 + Math.sin(x * 0.02 + k * 0.6) * 18); g.stroke(); }
        g.fillStyle = '#f4e7cd'; g.font = font('400', 40); g.fillText(a.title, 36, 80);
        break;
      }
      case 'type': {
        g.fillStyle = '#f4e7cd'; g.fillRect(0, 0, W, W);
        g.fillStyle = '#2a2430'; g.font = font('900', 120);
        g.fillText('SIDE', 30, 170); g.fillStyle = '#e0602e'; g.fillText('STR', 30, 300); g.fillStyle = '#2a2430'; g.fillText('EETS', 30, 430);
        break;
      }
      default: {
        g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, W, W);
        g.strokeStyle = '#e8e8e8'; g.lineWidth = 3;
        for (let i = 0; i < 40; i++) { g.globalAlpha = 0.15 + i / 60; g.beginPath(); g.moveTo(140 + i * 4, W); g.bezierCurveTo(200 + i * 3, 300, 330 - i * 2, 260, 300 + i * 2, 120 + i * 2); g.stroke(); }
        g.globalAlpha = 1; g.fillStyle = '#f0f0f0'; g.font = font('400', 32); g.fillText(a.title.toUpperCase(), 36, 70);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = "600 16px \"PP Neue Montreal\", Arial, sans-serif";
    g.fillText(a.artist.toUpperCase(), 36, a.look === 'stars' ? 500 : 500);
    return c;
  }
  function texFrom(canvasEl) {
    const t = new THREE.CanvasTexture(canvasEl);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  // 뒷면: 박스 -z 면은 바깥에서 볼 때 그대로 바로 보임
  const backTex = (a) => texFrom(coverCanvas(a, 'back'));
  const albumGroup = new THREE.Group();
  comp.add(albumGroup);
  const albumGeo = new THREE.BoxGeometry(ALBUM.size, ALBUM.size, ALBUM.depth);
  let albums = [], dropRank = [], albumMeshes = [];
  const texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin('anonymous');
  function disposeRing() {
    for (const al of albums) {
      albumGroup.remove(al.mesh);
      for (const m of new Set(al.mats)) { m.map?.dispose(); m.dispose(); }
    }
    albums = []; dropRank = []; albumMeshes = [];
  }
  // New Vinyls 링을 (다시) 만듦. list = [{ slug, title, artist, image, color }]
  function buildRing(list) {
    disposeRing();
    ALBUM_LIST = list.map((a, i) => ({ ...a, look: LOOKS[i % LOOKS.length] }));
    ALBUM_STEP = (Math.PI * 2) / Math.max(1, ALBUM_LIST.length);
    RING_OFFSET = ALBUM_STEP / 2;
    ringAngle = RING_OFFSET; ringVel = 0; ringTurn = null;
    focusIndex = -1; focusWant = false; focusT = 0; hoverAlbum = -1; featured = 0;
    albums = ALBUM_LIST.map((a, i) => {
      // 앨범마다 재질을 따로 둠 (포커스 때 나머지 앨범만 흐리게 하려고)
      const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color('#d9b98a'), toneMapped: false });   // 종이 재킷 윗면
      const edgeDark = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8a6a45'), toneMapped: false });
      const mats = [
        edgeDark, edgeDark,                // +x(바깥 모서리), -x(안쪽 모서리)
        edge, edgeDark,                    // +y(위), -y(아래)
        new THREE.MeshBasicMaterial({ map: texFrom(coverCanvas(a, 'front')), toneMapped: false }),   // +z 앞면 (실제 커버는 아래에서 불러와 교체)
        new THREE.MeshBasicMaterial({ map: backTex(a), toneMapped: false }),                         // -z 뒷면
      ];
      const mesh = new THREE.Mesh(albumGeo, mats);
      mesh.renderOrder = 2;
      // 방사형 각도: i = 0이 정면(+z, 90°), i가 늘수록 화면 오른쪽(시계 방향)으로
      const phi = Math.PI / 2 - i * ALBUM_STEP;
      const radial = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
      const tangent = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi));   // 반시계 진행 방향 = 앞면 방향
      const basis = new THREE.Matrix4().makeBasis(radial, new THREE.Vector3(0, 1, 0), tangent);
      const restQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
      mesh.quaternion.copy(restQuat);
      const rMid = ALBUM.inner + ALBUM.size / 2;
      const rest = new THREE.Vector3(radial.x * rMid, ALBUM.size / 2 + 0.002, radial.z * rMid);
      mesh.position.copy(rest);
      mesh.visible = false;
      albumGroup.add(mesh);
      return { mesh, mats, rest, restQuat, phi, base: mats.map((m) => m.color.clone()), data: a, t: 0, lift: 0, opacity: 1 };
    });
    // 등장 순서: 정면부터 양옆으로 번갈아 퍼지며 떨어짐
    dropRank = albums.map((_, i) => i)
      .sort((a, b) => Math.min(a, albums.length - a) - Math.min(b, albums.length - b) || a - b)
      .reduce((rank, idx, order) => { rank[idx] = order; return rank; }, []);
    albumMeshes = albums.map((a) => a.mesh);
    // 실제 커버 이미지: 불러오면 임시 커버를 교체
    albums.forEach((al) => {
      if (!al.data.image) return;
      texLoader.load(al.data.image, (tex) => {
        if (disposed || !albums.includes(al)) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const front = al.mats[4];
        front.map?.dispose();
        front.map = tex; front.needsUpdate = true;
      }, undefined, () => {});
    });
    if (albums.length) setCaption(0);
    else { q('nv-artist').textContent = ''; q('nv-album').textContent = ''; }
  }

  let hoverAlbum = -1;
  let featured = 0;          // 캡션에 보여줄 앨범 (정면에 온 앨범)
  function setCaption(i) {
    if (!albums[i]) return;
    q('nv-artist').textContent = albums[i].data.artist;
    q('nv-album').textContent = albums[i].data.title;
  }

  /* ---- 링 회전 (드래그 · 관성 · 스냅) ---- */
  const RING = {
    dragK: 2.6,          // 화면 폭만큼 끌면 몇 라디안 도는지
    friction: 0.35,      // 관성 감쇠 시간(초)
    snapTau: 0.2,        // 가장 가까운 앨범으로 붙는 속도
    focusTurn: 0.75,     // 클릭한 앨범을 정면으로 돌리는 시간(초)
  };
  // 기본 자세: 앨범 사이(반 칸)가 정면 → 정면 양옆 두 장이 비스듬히 서서 커버가 살짝 보임
  let RING_OFFSET = ALBUM_STEP / 2;
  let ringAngle = RING_OFFSET, ringVel = 0;
  let ringDragging = false, ringPointer = null, ringLastX = 0, ringDownX = 0, ringDownY = 0, ringDownT = 0, ringMoved = false;
  let ringTurn = null;   // { from, to, start } 클릭 포커스 회전 트윈

  /* ---- 포커스 (클릭한 앨범이 정면으로 와서 들려 올라오며 확대) ---- */
  const FOCUS = {
    pos: new THREE.Vector3(0, 0.3, 0.62),    // comp 좌표: 판 앞쪽 위 (앞 앨범들보다 카메라 쪽)
    scale: 1.6,
    dur: 0.8,
    dim: 0.72,           // 나머지 앨범 흐림 정도
  };
  let focusIndex = -1;
  let focusT = 0;        // 0 = 링에 서 있음, 1 = 들려서 정면
  let focusWant = false; // 회전이 끝나면 들어 올림
  const focusQuatComp = (() => {
    // 착륙 구도에서 카메라를 정면으로 보는 자세 (앞면 +z가 시선 쪽)
    const v = new THREE.Vector3(0, Math.sin(LANDED_COMPOSITION.tilt), Math.cos(LANDED_COMPOSITION.tilt));
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(v, -v.y).normalize();
    const x = new THREE.Vector3().crossVectors(up, v);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, v));
  })();
  const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3();

  const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const frontIndex = () => {
    // 정면 바로 오른쪽(앞면이 보이는 쪽) 앨범
    const k = Math.round(-(ringAngle - RING_OFFSET) / ALBUM_STEP);
    return albums.length ? ((k % albums.length) + albums.length) % albums.length : 0;
  };
  function focusAlbum(i) {
    focusIndex = i;
    focusWant = true;
    const target = -i * ALBUM_STEP;
    const to = ringAngle + wrapPi(target - ringAngle);   // 가장 짧은 방향으로
    ringTurn = { from: ringAngle, to, start: performance.now() / 1000 };
    ringVel = 0;
    featured = i; setCaption(i);
  }
  function unfocus() {
    focusWant = false;
  }
  const ringReady = () => section === 1 && !tweening && !catTweening && albumClock >= AUTO.captionAt;

  on(canvas, 'pointerdown', (e) => {
    if (!ringReady() || e.button !== 0) return;
    ringDragging = true; ringMoved = false;
    ringPointer = e.pointerId;
    ringLastX = ringDownX = e.clientX; ringDownY = e.clientY; ringDownT = performance.now();
    ringVel = 0; ringTurn = null;
    canvas.setPointerCapture(e.pointerId);
  });
  on(canvas, 'pointermove', (e) => {
    if (!ringDragging || e.pointerId !== ringPointer) return;
    if (!ringMoved && Math.hypot(e.clientX - ringDownX, e.clientY - ringDownY) > 6) {
      ringMoved = true;
      if (focusWant) unfocus();          // 끌기 시작하면 포커스 해제
    }
    if (!ringMoved) return;
    const dx = e.clientX - ringLastX;
    ringLastX = e.clientX;
    const dAng = (dx / innerWidth) * RING.dragK;     // 오른쪽으로 끌면 앞쪽 앨범이 오른쪽으로
    ringAngle += dAng;
    const dt = Math.max(1 / 240, e.timeStamp ? 1 / 60 : 1 / 60);
    ringVel += ((dAng / dt) - ringVel) * 0.35;        // 손 속도 (관성용)
  });
  const endRing = (e) => {
    if (!ringDragging || e.pointerId !== ringPointer) return;
    ringDragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (ringMoved) return;
    // 클릭: 앨범을 맞췄는지
    setNdc(e);
    const hit = raycaster.intersectObjects(albumMeshes, false)[0];
    const i = hit ? albumMeshes.indexOf(hit.object) : -1;
    if (i >= 0 && i === focusIndex && focusWant && focusT > 0.95) openAlbumDetail(i);
    else if (i >= 0) focusAlbum(i);
    else if (focusWant) unfocus();
  };
  on(canvas, 'pointerup', endRing);
  on(canvas, 'pointercancel', endRing);
  on(window, 'keydown', (e) => { if (e.key === 'Escape' && focusWant) unfocus(); });
  // 트랙패드 가로 스와이프로도 링 회전
  on(layer, 'wheel', (e) => {
    if (!ringReady() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (focusWant) unfocus();
    ringAngle -= (e.deltaX / innerWidth) * RING.dragK;
    ringVel = 0;
  }, { passive: false });

  // 확대된 앨범을 한 번 더 누르면 → 앨범 상세로 (기존 커버 이동 전환에 화면 위치를 넘김)
  const corner = new THREE.Vector3();
  function albumScreenRect(i) {
    const mesh = albums[i].mesh, h = ALBUM.size / 2, z = ALBUM.depth / 2;
    mesh.updateWorldMatrix(true, false);
    const rect = canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
      corner.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
      const px = rect.left + (corner.x * 0.5 + 0.5) * rect.width, py = rect.top + (-corner.y * 0.5 + 0.5) * rect.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  function openAlbumDetail(i) {
    const a = albums[i]?.data;
    if (!a) return;
    opts.onOpenAlbum?.({ slug: a.slug, color: a.color, imageUrl: a.image, rect: albumScreenRect(i) });
  }

  function updateRing(dt) {
    if (ringTurn) {
      const t = clamp01((performance.now() / 1000 - ringTurn.start) / RING.focusTurn);
      ringAngle = ringTurn.from + (ringTurn.to - ringTurn.from) * easeInOutSine(t);
      if (t >= 1) ringTurn = null;
    } else if (!ringDragging) {
      // 관성 → 느려지면 가장 가까운 앨범 자리로 스냅
      ringAngle += ringVel * dt;
      ringVel *= Math.exp(-dt / RING.friction);
      if (Math.abs(ringVel) < 0.8) {
        const snap = Math.round((ringAngle - RING_OFFSET) / ALBUM_STEP) * ALBUM_STEP + RING_OFFSET;
        ringAngle += (snap - ringAngle) * (1 - Math.exp(-dt / RING.snapTau));
      }
    }
    albumGroup.rotation.y = ringAngle;
    // 정면 앨범 → 캡션 (포커스 중엔 포커스 앨범 유지)
    if (!focusWant && focusT < 0.01) {
      const f = frontIndex();
      if (f !== featured) { featured = f; setCaption(f); }
    }
  }

  // 앨범·타이틀·캡션은 스크롤이 아니라 '착륙 후 시간'으로 자동 재생
  // 다시 위로 올라가면 거꾸로 사라짐
  const AUTO = {
    stagger: 0.09,      // 앨범 사이 간격(초)
    each: 0.7,          // 앨범 하나가 떨어져 서는 시간(초)
    titleAt: 0.6, titleDur: 0.7,
    captionAt: 1.1, captionDur: 0.6,
    total: 1.9,
  };
  let albumClock = 0;   // 착륙 후 흐른 시간(초)
  function updateAlbums(dt, p) {
    const on = p >= SCROLL.albumTrigger && section === 1 && catP < 0.02;
    albumClock = THREE.MathUtils.clamp(albumClock + (on ? dt : -dt * 1.8), 0, AUTO.total);
    if (!on && focusWant) unfocus();
    updateRing(dt);

    // 포커스: 링 회전이 끝난 뒤 들어 올림 / 해제는 바로 내려놓음
    const lifting = focusWant && !ringTurn;
    focusT = clamp01(focusT + (lifting ? dt : -dt * 1.3) / FOCUS.dur);
    if (!focusWant && focusT === 0) focusIndex = -1;
    const fe = easeInOutSine(focusT);

    // 포커스 자세를 albumGroup 로컬로 (링이 돌아가 있으니 역회전)
    tmpQ.setFromAxisAngle(tmpV.set(0, 1, 0), -ringAngle);
    albums.forEach((al, i) => {
      // 정면부터 양옆으로: 위에서 곧게 떨어져 판 위에 세워짐 (반동 없음 → 판을 뚫지 않음)
      const t = clamp01((albumClock - dropRank[i] * AUTO.stagger) / AUTO.each);
      al.t = t;
      al.mesh.visible = t > 0 && catP < 0.1;   // 다이얼로 넘어가면 확실히 숨김
      if (t <= 0) return;
      const drop = 1 - easeOut(t);
      const liftTarget = hoverAlbum === i && focusIndex !== i ? ALBUM.hoverLift : 0;
      al.lift += (liftTarget - al.lift) * (1 - Math.exp(-dt / 0.12));
      al.mesh.position.set(al.rest.x, al.rest.y + drop * ALBUM.dropHeight + al.lift, al.rest.z);
      al.mesh.quaternion.copy(al.restQuat);
      al.mesh.scale.setScalar(1);

      if (i === focusIndex && fe > 0) {
        // 링 자리 → 판 앞쪽 위로 들려 올라와 카메라를 정면으로 보며 확대
        tmpV.copy(FOCUS.pos).applyQuaternion(tmpQ);
        al.mesh.position.lerp(tmpV, fe);
        al.mesh.position.y += Math.sin(Math.PI * fe) * 0.08;      // 살짝 호를 그리며
        tmpQ2.multiplyQuaternions(tmpQ, focusQuatComp);
        al.mesh.quaternion.slerp(tmpQ2, fe);
        al.mesh.scale.setScalar(1 + (FOCUS.scale - 1) * fe);
      }
      // 포커스된 앨범은 맨 마지막에, 다른 앨범·판에 가리지 않게 그림
      const onTop = i === focusIndex && fe > 0.15;
      al.mesh.renderOrder = onTop ? 10 : 2;
      for (const m of al.mats) {
        if (m.depthTest === onTop) { m.depthTest = !onTop; }
        if (onTop && !m.transparent) { m.transparent = true; m.needsUpdate = true; }
      }
      // 거리감: 링 뒤쪽 앨범일수록 어둡게 (포커스된 앨범은 원래 밝기로)
      const depth = Math.sin(al.phi - ringAngle);            // 1 = 정면 앞, -1 = 맨 뒤
      let shade = 0.38 + 0.62 * Math.pow((depth + 1) / 2, 1.3);
      if (i === focusIndex) shade += (1 - shade) * fe;
      al.mats.forEach((m, k) => m.color.copy(al.base[k]).multiplyScalar(shade));
      // 포커스 중 나머지 앨범은 흐리게
      const targetOpacity = focusIndex >= 0 && i !== focusIndex ? 1 - FOCUS.dim * fe : 1;
      if (Math.abs(targetOpacity - al.opacity) > 0.001) {
        al.opacity = targetOpacity;
        for (const m of al.mats) {
          const tr = al.opacity < 0.999 || i === focusIndex;
          if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }   // 투명 전환은 재질 갱신 필요
          m.opacity = al.opacity;
          m.depthWrite = al.opacity > 0.5;
        }
      }
    });

    // 타이틀·캡션·안내
    const nvIn = easeOut(clamp01((albumClock - AUTO.titleAt) / AUTO.titleDur));
    $nvHead.style.opacity = String(nvIn * (1 - 0.6 * fe));
    $nvHead.style.visibility = nvIn > 0.01 ? 'visible' : 'hidden';
    $nvLines.forEach((el, i) => {
      const t = easeOut(clamp01((albumClock - AUTO.titleAt - i * 0.1) / AUTO.titleDur));
      el.style.transform = `translateY(${((1 - t) * 110).toFixed(2)}%)`;   // 아래에서 스르륵 (부모가 잘라 줌)
    });
    $nvCaption.style.opacity = String(easeOut(clamp01((albumClock - AUTO.captionAt) / AUTO.captionDur)));
    q('nv-hint').style.opacity = String(fe);
  }
  // 앨범 호버 → 살짝 들림 (New Vinyls에서만)
  on(window, 'pointermove', (e) => {
    if (!ringReady() || ringDragging || e.pointerType !== 'mouse') { hoverAlbum = -1; return; }
    setNdc(e);
    const hit = raycaster.intersectObjects(albumMeshes, false)[0];
    hoverAlbum = hit ? albumMeshes.indexOf(hit.object) : -1;
  });

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
  let pickTargets = [];   // 드래그 판정용 레이캐스트 대상(디스크 메시)

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
    if (el) { el.textContent = '모델을 불러오지 못했어요: ' + e.message; el.classList.remove('hidden'); }
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
  let themeT = -1;
  function applyTheme(t) {
    if (Math.abs(t - themeT) < 0.002) return;
    themeT = t;
    const rs = host.style;
    // 기존 사이트 테마(--wire-t: 0 = 크림, 1 = 잉크)도 함께 → 내비게이션 색이 따라옴
    host.closest('.ct-page')?.style.setProperty('--wire-t', t.toFixed(3));
    for (const key of Object.keys(THEME.hero)) {
      const a = THEME_RGBA.hero[key], b = THEME_RGBA.nv[key];
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
      if (!cursorVisible) { ringPos.copy(mouse); cursorVisible = true; }
      const el = e.target instanceof Element ? e.target : null;
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
      : (ringDragging && ringMoved) || (dialDragging && dialMoved) ? 'ringdrag'
      : hoverAlbum >= 0 && hoverAlbum === focusIndex && focusT > 0.95 ? 'open'
      : hoverAlbum >= 0 ? 'album'
      : ringReady() ? 'ring'
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
  let heroScale = 1, landedScale = 1, viewH = 10;
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
    placeStage();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    dustMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
    // R3F viewport와 같은 값: 화면 크기 / zoom (월드 단위)
    heroScale = getHeroRecordScale(w / ZOOM, h / ZOOM, h);
    landedScale = getLandedRecordScale(w / ZOOM, h / ZOOM);
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
  const baseInk = hexToVec3(THEME.nv.ink3d), baseLabel = hexToVec3(THEME.nv.label3d);
  const heroInk3 = hexToVec3(THEME.hero.ink3d), heroLabel3 = hexToVec3(THEME.hero.label3d);
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
  function showGenre(i) {
    if (i === shownGenre) return;
    shownGenre = i;
    const g = GENRES[i];
    q('gd-count-idx').textContent = `${String(i + 1).padStart(2, '0')} / ${GENRES.length}`;
    q('gd-name-text').textContent = g.name;
    q('gd-desc').textContent = g.desc;
    const link = q('gd-link');
    link.textContent = `Dig into ${g.name.toUpperCase()} ↗`;
    link.setAttribute('href', `/digging?genre=${encodeURIComponent(g.slug)}`);
    renderGenreCovers(i, null);
    // 장르별 대표 커버 3장: 불러오는 동안은 장르 색 슬리브, 불러오면 실제 커버
    opts.getGenreCovers?.(g.slug).then((list) => { if (!disposed && shownGenre === i) renderGenreCovers(i, list); }, () => {});
    if (!reduceMotion) {
      // 장르 이름은 다른 제목처럼 아래에서 스르륵 올라옴 (h2가 잘라 줌)
      q('gd-name-text').animate(
        [{ transform: 'translateY(110%)' }, { transform: 'none' }],
        { duration: 700, easing: 'cubic-bezier(0.22,1,0.36,1)' });
      for (const id of ['gd-desc', 'gd-covers']) {
        q(id).animate(
          [{ opacity: 0, transform: 'translateY(0.35em)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, easing: 'cubic-bezier(0.22,1,0.36,1)', delay: id === 'gd-covers' ? 120 : 60 });
      }
    }
  }
  // 다이얼은 끝없이 돎: 각도(dialTarget)는 제한 없이 누적하고, 장르 번호만 12로 나눈 나머지로 씀
  //  → etc. 다음은 다시 k-indie, k-indie 이전은 etc.
  const wrapIndex = (k) => ((k % GENRES.length) + GENRES.length) % GENRES.length;
  function setDial(k) {        // k = 누적 칸 번호 (12를 넘거나 음수여도 됨)
    dialTarget = k * DIAL.step;
    dialIndex = wrapIndex(k);
    showGenre(dialIndex);
  }
  function dialStep(dir) {
    if (nowSec() < dialLockUntil) return;
    dialLockUntil = nowSec() + DIAL.stepLock;
    setDial(Math.round(dialTarget / DIAL.step) + dir);
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
    uniforms.uInk.value.copy(heroInk3).lerp(baseInk, themeT).lerp(tintInk, catEase);
    uniforms.uLabel.value.copy(heroLabel3).lerp(baseLabel, themeT).lerp(tintLabel, catEase);
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
    duration: 1.8,       // Hero ↔ New Vinyls 전환 시간(초)
    catDuration: 1.5,    // New Vinyls ↔ Genre 전환 시간(초)
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
    } else if (prev === 1 && next === 2) {
      // 앨범이 먼저 걷힌 뒤 판이 다이얼 자리로
      const wait = reduceMotion ? 0 : albumClock / 1.8 + 0.05;   // 앨범이 걷히는 시간(속도 1.8배)만큼
      catFrom = catP; catTo = 1;
      catDur = reduceMotion ? 0 : SECTION.catDuration * Math.abs(catTo - catFrom);
      catStart = nowSec() + wait;
      catTweening = catDur > 0; if (!catTweening) catP = 1;
      lockUntil = catStart + catDur + SECTION.cooldown;
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
      // 위로 돌아갈 땐 앨범이 먼저 걷힌 뒤 판이 떠오르도록 잠깐 기다림
      const wait = next === 0 && !reduceMotion ? (albumClock / AUTO.total) * 0.85 : 0;
      tweenStart = nowSec() + wait;
      tweening = tweenDur > 0; if (!tweening) scrollP = tweenTo;
      lockUntil = tweenStart + tweenDur + SECTION.cooldown;
    }
    opts.onSectionChange?.(next);
  }
  function updateSectionTween() {
    if (tweening) {
      const t = clamp01((nowSec() - tweenStart) / tweenDur);
      scrollP = tweenFrom + (tweenTo - tweenFrom) * easeInOutSine(t);
      if (t >= 1) { scrollP = tweenTo; tweening = false; }
    }
    if (catTweening) {
      const t = clamp01((nowSec() - catStart) / catDur);
      catP = catFrom + (catTo - catFrom) * easeInOutSine(t);
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
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;   // 가로 스와이프는 앨범 링 회전에 사용
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
  let touchY0 = null;
  let touchOnDial = false;
  let touchInNews = false, touchNewsTop = 0;
  on(layer, 'touchstart', (e) => {
    touchY0 = e.touches[0]?.clientY ?? null;
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
    touchY0 = null;
    if (pressed || dialDragging || touchOnDial || inputLocked()) return;
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
  const $nvCaption = q('nv-caption');

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
    const settle = easeInOut(seg(p, 0.0, SCROLL.settleEnd));      // 구도 보간
    const tumbleT = easeInOut(seg(p, SCROLL.tumbleStart, SCROLL.tumbleEnd));
    root.rotation.z = THREE.MathUtils.lerp(HERO_COMPOSITION.roll, LANDED_COMPOSITION.roll, settle);
    comp.rotation.x = THREE.MathUtils.lerp(HERO_COMPOSITION.tilt, LANDED_COMPOSITION.tilt, settle);
    root.scale.setScalar(THREE.MathUtils.lerp(heroScale, landedScale, settle));
    //  화면 가로축 기준으로 한 바퀴(360°) — 끝나면 원래 자세와 같아서 그대로 착륙
    tumble.rotation.x = tumbleT * Math.PI * 2;
    //  도는 동안 살짝 떠올랐다가 내려앉음
    const landY = LANDED_COMPOSITION.centerY * viewH;
    const lift = Math.sin(Math.PI * seg(p, SCROLL.tumbleStart, SCROLL.settleEnd)) * SCROLL.lift * viewH;
    root.position.y = THREE.MathUtils.lerp(0, landY, settle) + lift;
    heroActive = p < SCROLL.heroEnd;
    //  New Vinyls → Genre dial: 판이 다이얼 가운데로 미끄러져 와서 정면을 보고 섬
    const catEase = easeInOut(catP);
    if (catEase > 0) {
      const dialScale = (geo.R * 0.5) / ZOOM;                 // 판 반지름 = 다이얼 반지름의 절반
      // geo는 스테이지(헤더 아래) 좌표 → 캔버스(화면 전체) 좌표로
      const dx = (geo.cx - canvas.clientWidth / 2) / ZOOM, dy = (canvas.clientHeight / 2 - (geo.cy + headerTop)) / ZOOM;
      comp.rotation.x = THREE.MathUtils.lerp(comp.rotation.x, Math.PI / 2, catEase);
      root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, catEase);
      root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x, dialScale, catEase));
      root.position.x = THREE.MathUtils.lerp(0, dx, catEase);
      root.position.y = THREE.MathUtils.lerp(root.position.y, dy, catEase);
    } else {
      root.position.x = 0;
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
    //  떠 있는 판의 바닥 그림자는 착륙하면서 사라짐 (판이 지면에 닿음)
    shadowUniforms.uShadow.value = 0.45 * (1 - settle);
    shadow.visible = settle < 0.99;

    //  Hero 타이틀은 위로 사라지고, New Vinyls 타이틀은 착륙 뒤 나타남
    const heroOut = seg(p, 0.0, 0.14);
    fxSceneFade = 1 - seg(p, 0.0, SCROLL.fxOutEnd);   // 링·헤일로는 Hero 전용
    applyIntroPose();
    title.style.opacity = String(1 - heroOut);
    //  배경·글자·잉크 색: 판이 내려오는 동안 크림 → 플럼으로 자연스럽게
    applyTheme(easeInOut(seg(p, 0.15, 0.85)) * (1 - newsEase));   // News에서는 다시 크림
    updateAlbums(dt, p);
    updateDial(dt, dialVis);
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
    renderer.render(scene, camera);
  });

  /* ================= 시작 상태 · 외부 API ================= */
  if (opts.albums) buildRing(opts.albums);
  ready = true;
  resize(); layoutDial();   // 불러오는 동안 창 크기가 바뀌었을 수 있음

  return {
    /** New Vinyls 앨범 목록 (Supabase에서 받은 뒤) */
    setAlbums(list, { frontSlug } = {}) {
      if (disposed) return;
      buildRing(list);
      // 앨범 상세에서 돌아왔으면 그 앨범이 정면에 오게
      const i = frontSlug ? albums.findIndex((a) => a.data.slug === frontSlug) : -1;
      if (i > 0) { ringAngle = RING_OFFSET - i * ALBUM_STEP; featured = i; setCaption(i); }
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
    get section() { return section; },
    get dialIndex() { return dialIndex; },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      cleanups.forEach((fn) => fn());
      disposeRing();
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
    },
  };
}
