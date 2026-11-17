"use client";
// /lab/room-test — 레코드판 → 방 (한 캔버스)
//  처음: 크림 바탕에 커다란 레코드판 한 장이 기울어 돎 (Hero)
//  스크롤을 내리는 만큼: 판이 멀어지며 작아지고, 크림 바탕이 걷히며 방이 드러나고, 판은 턴테이블 위(Turntable_DiscSeat)에 내려앉음
//   · 판은 처음부터 끝까지 방 장면 속 한 장 (같은 캔버스 · 같은 카메라 = Blender 의 cam_room_final) → 갈아 끼우는 순간이 없음
//   · 판 크기는 실제 LP 크기 그대로 두고 카메라 앞 가까운 자리 → 턴테이블로 옮김 → 멀어지며 자연스럽게 작아짐
//  순서 (2026-11-15 사용자 요청):
//   1) 판이 내려오며 먼저 수평으로 눕고(턴테이블에 들어가기 좋게), 방은 reveal 0 프레임 = 턴테이블 하나만 있는 모습
//   2) 판이 턴테이블 바로 위에 오면 먼지 덮개가 열림(cover_open, Blender 시간 그대로) → 다 열려야 판이 내려앉음
//   3) 판이 앉으면 reveal 클립을 처음부터 끝까지 Blender 시간 그대로 재생 (턴테이블이 장식장 위로 올라갈 때 판도 같이)
//   스크롤을 되돌리면 거꾸로: 방이 시간 그대로 역재생 → 판이 들림 → 덮개 닫힘(cover_open 역재생) → 판이 일어서며 Hero 로
//  스크롤: 사이트 공통 방식 (.page + usePageLenis). Lenis 는 이 페이지 그리기 루프 맨 앞에서 같이 돌림 → 스크롤과 판이 한 프레임에
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { markHomeReady } from "@/lib/homeReady";
import usePageLenis from "@/components/layout/usePageLenis";
import { useIntro } from "@/components/intro/intro-context";
import { applyLightmaps, setLightmapState } from "./lightmaps";
import { discVert, discFrag, inkDefaults } from "@/components/vinyl/inkShaders";
import { createHeroFx, HERO_SPIN, HERO_HOLD } from "@/components/vinyl/heroFx";
import { MONOTON } from "@/lib/fonts";

const VINYL_URL = "/models/vinyl.glb";
const ROOM_URL = "/models/room/grooves_room_blockout_reveal.glb";
// Hero 판: Home Hero 와 같은 그림 (잉크 셰이더 · 빛줄기 · 스케치 그림자 · 헤일로 · 타이포 링 · 먼지 · 누르기) · 같은 구도
const DISC = {
  tilt: 40,        // 처음: 카메라 쪽으로 세운 각도(°) — Home HERO_COMPOSITION.tilt
  roll: 33,        // 처음: 화면에서 돌린 각도(°) — Home HERO_COMPOSITION.roll
  rpm: HERO_SPIN.rpm,   // 도는 속도 (모션 줄이기면 0)
  radius: 0.15,    // 실제 LP 반지름 (m, 방 단위)
  thick: 1.8,      // 판 두께 배율 (작은 판도 옆면이 보이게)
  arc: 0.12,       // 내려앉는 길이 위로 살짝 부푸는 정도 (판 반지름 배가 아니라 m)
};
const SCROLL = {
  travel: 1.0,     // 판이 턴테이블까지 가는 스크롤 길이 (화면 높이 배). 예전 1.6 은 너무 많이 굴려야 했음
  hold: 0.8,       // 내려앉은 뒤 방을 보는 길이 (화면 높이 배)
  cream: [0.12, 0.55],   // 크림 바탕이 걷히는 구간 (진행도)
  lidAt: 0.6,      // 이 진행도를 넘으면 먼지 덮개 열림 (턴테이블이 다 올라온 뒤, 판이 오기 전에 다 열려 있게)
  ttRise: [0.2, 0.42],   // 턴테이블이 아래에서 올라오는 [시작, 길이] 진행도 (예전: 0 프레임부터 제자리 → 스크롤하자마자 보였음)
  ttDrop: 0.6,     // 올라오기 전 턴테이블이 내려가 있는 깊이 (m, 다가간 카메라 화면 아래 밖)
  approach: 0.82,  // 판이 턴테이블 바로 위에서 덮개가 다 열리길 기다리는 진행도 (그 뒤 내려앉음)
  flat: 0.35,      // 판이 수평으로 다 눕는 진행도 (처음 기울기 → 턴테이블 판 받침 방향)
  follow: 8,       // 판이 (덮개 · 방 역재생을 기다렸다가) 스크롤 자리를 따라붙는 빠르기
};
// 턴테이블 줌: 처음엔 카메라가 턴테이블 앞(같은 방향으로 다가감)에서 시작 → 방이 지어지는 동안(reveal 시간) Blender 카메라 자리로 물러남
//  거꾸로 재생하면 다시 다가감 (방 시간에 묶여 있음)
const ZOOM = {
  size: 0.45,     // 턴테이블 폭 (m)
  fill: 0.42,     // 다가갔을 때 턴테이블 폭이 화면 짧은 변에서 차지하는 비율
  delay: 0.0,     // 방 재생 몇 초 뒤부터 물러나기 시작
  dur: 1.8,       // 물러나는 시간 (초)
};
const ROOM = {
  fps: 24,            // Blender 클립 프레임
  build: [22, 58],    // 구운 빛: 빈 방 → 가구 다 놓임 (reveal v2 프레임, 큰 가구 시작 ~ 소품 끝 무렵)
  litAt: 56,          // 이 프레임부터 램프 빛이 켜지기 시작
  litDur: 1.2,        // 불이 다 켜지는 데 걸리는 시간(초)
  bg: "#15111a",
};
// 판 조명: 처음(크림 바탕 Hero) → 방에 앉았을 때. 구운 그림 재질은 조명을 안 받으므로 판·구운 그림 없는 재질만 영향
const LIGHT = { hemi: [1.6, 0.6], sun: [2.4, 0.35] };
// 잉크 색: 크림 바탕(Home Hero 테마 ink3d · label3d) → 어두운 방(크림 잉크 · 청록 라벨, Home 방의 판과 같은 값)
const INK = { cream: "#4f6d93", night: "#efe3c8" }, LABEL = { cream: "#bbcbda", night: "#7fc1bd" };
const FX_OUT = [0, 0.14];        // 링 · 헤일로 · 그림자 · 먼지가 사라지는 진행도 구간 (Home: 진행도 0 ~ 0.12)
const BODY_IN = [0.5, 0.95];     // 잉크 선 아래 검은 판 몸통이 차오르는 구간 (어두운 방에서 실제 판처럼)
const STREAK = { angle: 0, spread: 0.45, eyeFar: 300, minY: 0.3 };
// 누르기 vs 끌기 (Home 과 같은 값): 누르면 가속, 8px 넘게 끌면 끈 방향으로 판이 넘어감 → 놓으면 가까운 면(A/B)으로 스프링 안착
const FLIP = { dragStart: 8, dragPerTurn: 1.6, stiffness: 70, damping: 0.82 };
const RING = { show: 0.55, hide: 1.28 };   // 타이포 링: 판 가운데 쪽(라벨 · 안쪽 홈)에 오면 나타나고, 링 바깥으로 나가야 사라짐
// "Grooves" 제목: 회전이 시작되고 조금 뒤 글자가 하나씩 올라옴 · 빨라질수록 기울고 벌어짐 · 내려가면 위로 걷히며 옅어짐
const TITLE = { delay: 1.35, stagger: 0.06, dur: 0.9, out: [0, 0.12], lift: 0.25 };
// 커스텀 커서 (마우스에서만): 링 지연 · 상태별 크기
const CURSOR = { ringLag: 0.12, scale: { idle: 0.32, disc: 1, drag: 0.78, flip: 0.7, link: 0.55 } };
const HS = { paper: "#f4e7cd", text: "#4c404a", ink3d: "#4f6d93" };   // Home Hero 테마 색 (커서 · 제목)   // 빛줄기 (Home updateLight 와 같은 계산, 눈은 판 반지름의 eyeFar 배 뒤 = 직교처럼)
// Home Hero 구도: 판(지름)이 화면 폭의 58%(세로 화면 74%) · 높이의 68% 안에 들어오는 크기 (기울기 · 회전을 고려한 투영 크기)
const COMP = { widthFraction: 0.58, compactWidthFraction: 0.74, heightFraction: 0.68, reservePx: 24 };
function heroRadiusPx(width, height) {
  const tilt = THREE.MathUtils.degToRad(DISC.tilt), roll = THREE.MathUtils.degToRad(DISC.roll);
  const shortAxis = Math.sin(tilt), c = Math.cos(roll), s = Math.sin(roll);
  const thick = 0.021497 * Math.cos(tilt);
  const pw = 2 * Math.hypot(c, shortAxis * s) + thick * Math.abs(s);
  const ph = 2 * Math.hypot(s, shortAxis * c) + thick * Math.abs(c);
  const portrait = Math.min(1, Math.max(0, (1.25 - width / height) / 0.5));
  const tw = COMP.widthFraction + (COMP.compactWidthFraction - COMP.widthFraction) * portrait;
  const hf = Math.min(COMP.heightFraction, Math.max(0.1, 1 - COMP.reservePx / height));
  return Math.min((width * tw) / pw, (height * hf) / ph);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const disposeScene = (scene) => scene.traverse((o) => {
  o.geometry?.dispose();
  for (const m of [o.material].flat()) { if (!m) continue; for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
});

function Stage({ pageRef, driveRef, trackRef }) {
  const hostRef = useRef(null);
  const titleRef = useRef(null);
  const ringRef = useRef(null), dotRef = useRef(null), shapeRef = useRef(null), labelRef = useRef(null), tickRef = useRef(null);
  const cursorRef = useRef(null);
  // 제목이 올라오기 시작하는 기준 시각 = 첫 로딩 화면이 걷힌 때 (Home 과 같음)
  const startRef = useRef(null);
  const { done } = useIntro();
  useEffect(() => { if (done && startRef.current == null) startRef.current = performance.now() / 1000; }, [done]);
  useEffect(() => {
    const host = hostRef.current, page = pageRef.current, track = trackRef.current;
    cursorRef.current = { ring: ringRef.current, dot: dotRef.current, shape: shapeRef.current, label: labelRef.current, tick: tickRef.current };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROOM.bg);
    const hemi = new THREE.HemisphereLight("#fff6e8", "#b9a88f", LIGHT.hemi[0]);
    const sun = new THREE.DirectionalLight("#ffffff", LIGHT.sun[0]);
    scene.add(hemi, sun, sun.target);
    let camera = new THREE.PerspectiveCamera(22.8, 1, 0.05, 1000);   // 방이 붙기 전 임시 (Blender 카메라와 같은 화각)

    // 크림 바탕: 화면 전체를 덮는 막. 방을 그린 위에 덮고 → 깊이를 지우고 → 판만 그 위에 (판 진행도에 따라 옅어짐)
    //  (예전: 카메라 앞 3D 판으로 두었더니, 판이 턴테이블에 있을 때 그 판이 방 한가운데를 비스듬히 잘라 가렸음)
    const creamHex = getComputedStyle(document.documentElement).getPropertyValue("--cream").trim() || "#f4e7cd";
    const veilMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(creamHex), transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat);
    veil.frustumCulled = false;
    veil.position.z = -0.5;   // 직교 카메라 near(0)·far(1) 사이 (0 이면 near 면에 걸려 잘림)
    const veilScene = new THREE.Scene(); veilScene.add(veil);
    const veilCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    hemi.layers.enableAll(); sun.layers.enableAll();   // 판(1번 층)도 같은 빛을 받게

    // 판: disc(자리·자세 = Home 의 기울기 틀 comp) → spin(판 축 회전) → 모델(반지름 1 → LP 크기)
    //                                          → fxFrame(판 반지름 = 1 틀) → 그림자 · 헤일로 · 타이포 링 · 먼지 (판이 돌아도 제자리)
    //  disc → flip(끌어서 뒤집기) → spin. 링 · 그림자 · 먼지(fxFrame)는 disc 에 있어서 판을 뒤집어도 그대로 (Home 과 같음)
    const disc = new THREE.Group(), flip = new THREE.Group(), spin = new THREE.Group(), fxFrame = new THREE.Group();
    flip.add(spin); disc.add(flip, fxFrame); scene.add(disc);
    fxFrame.scale.setScalar(DISC.radius);
    let thickness = 0.0215;
    // 잉크 판 셰이더 (Home · 앨범 상세와 같은 inkShaders) + 깊이 프리패스 (판 뒤 링 · 그림자는 판에 가려짐)
    const inkU = {
      uInk: { value: new THREE.Vector3() }, uLabel: { value: new THREE.Vector3() },
      uCamLocal: { value: new THREE.Vector3(0, 3, 3) }, uLightLocal: { value: new THREE.Vector3(0, 1, 0) },
      uLineFreq: { value: inkDefaults.lineFreq }, uStreak: { value: inkDefaults.streak }, uSharp: { value: inkDefaults.sharp },
      uRough: { value: inkDefaults.rough }, uWobble: { value: inkDefaults.wobble }, uBase: { value: inkDefaults.base },
      uTrackCount: { value: inkDefaults.trackCount }, uGapWidth: { value: inkDefaults.gapWidth },
      uInnerR: { value: inkDefaults.innerR }, uOuterR: { value: inkDefaults.outerR },
      uLabelR: { value: inkDefaults.labelR }, uHoleR: { value: inkDefaults.holeR },
      uTopY: { value: inkDefaults.topY }, uBotY: { value: inkDefaults.botY },
      uPointLocal: { value: new THREE.Vector3(0, 1, 0) }, uAmbient: { value: 1 }, uPointOn: { value: 0 }, uPointR: { value: 0.5 }, uPointK: { value: 1 },
    };
    const inkMat = new THREE.ShaderMaterial({ vertexShader: discVert, fragmentShader: discFrag, uniforms: inkU, transparent: true, premultipliedAlpha: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // 어두운 방에서: 잉크 선 아래 검은 판 몸통이 차오름 (BODY_IN)
    const bodyMat = new THREE.MeshStandardMaterial({ color: "#16131a", roughness: 0.35, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    const fx = createHeroFx({ ink: inkU.uInk, renderer, reduced });
    fx.setPixelRatio(renderer.getPixelRatio());
    fxFrame.add(fx.group);
    const _inkA = new THREE.Color(), _inkB = new THREE.Color();
    let discRef = null;   // 판 메시 (빛줄기를 판 로컬로 옮길 때)

    const st = {
      ready: false, k: 0, t: 0, playing: false, dur: 0, mixer: null, action: null, lights: [],
      seat: null, lid: null, lidT: 0, kd: 0, spinA: 0,
      omega: 0, holding: false, pointer: null,   // 판 각속도(rad/s, 음수 = 시계) · 누르는 중 · 커서(화면 -1..1)
    };
    // 방 클립 시간 t 의 자세 + 그 프레임의 구운 빛 · 램프
    const pose = (t) => {
      if (!st.action) return;
      st.action.time = Math.min(t, st.dur);
      const frame = st.action.time * ROOM.fps;
      const build = easeInOut(clamp01((frame - ROOM.build[0]) / (ROOM.build[1] - ROOM.build[0])));
      const lit = easeInOut(clamp01((t - ROOM.litAt / ROOM.fps) / ROOM.litDur));
      setLightmapState(build, lit);
      for (const { l, base } of st.lights) l.intensity = base * lit;
    };

    const fit = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    // ── 카메라: 턴테이블 앞(가까이) ↔ Blender 카메라 자리. 방향은 Blender 카메라 그대로, 자리만 턴테이블 쪽으로 다가감
    const camPos0 = new THREE.Vector3(), camQ0 = new THREE.Quaternion(), seat0 = new THREE.Vector3(), _cf = new THREE.Vector3(), _close = new THREE.Vector3();
    const placeCamera = () => {
      if (!st.camReady) return;
      _cf.set(0, 0, -1).applyQuaternion(camQ0);
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const d = ZOOM.size / (ZOOM.fill * 2 * tanH * Math.min(1, camera.aspect));
      _close.copy(seat0).addScaledVector(_cf, -d);
      const z = reduced ? 1 : easeInOut(clamp01((st.t - ZOOM.delay) / ZOOM.dur));
      camera.position.lerpVectors(_close, camPos0, z);
      camera.quaternion.copy(camQ0);
      camera.updateMatrixWorld();
    };

    // ── 판 자리: 처음(카메라 앞) ↔ 턴테이블 위
    const _f = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3();
    const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qs = new THREE.Quaternion();
    const heroTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(DISC.tilt), 0, 0));
    const heroRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(DISC.roll));
    const Y = new THREE.Vector3(0, 1, 0);
    const placeDisc = (k, kCream = k) => {
      placeCamera();
      camera.updateMatrixWorld();
      // 처음: Home Hero 구도 크기(판 반지름 px = heroRadiusPx)가 되는 거리에, 화면 가운데, 카메라 기준 roll → tilt
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const W = host.clientWidth || 1, H = host.clientHeight || 1;
      const D = (DISC.radius * (H / 2)) / (tanH * heroRadiusPx(W, H));
      camera.getWorldDirection(_f);
      _a.copy(camera.position).addScaledVector(_f, D);
      _qa.copy(camera.quaternion).multiply(heroRoll).multiply(heroTilt);
      // 턴테이블: 판 아랫면이 자리에 닿게 (모델은 가운데 기준 → 두께 절반만큼 위로)
      let e = 0;
      if (st.seat) {
        st.seat.getWorldPosition(_b);
        st.seat.getWorldQuaternion(_qb);
        _up.copy(Y).applyQuaternion(_qb);
        _b.addScaledVector(_up, thickness * DISC.radius * DISC.thick * 0.5);
        e = easeInOut(clamp01(k));
      } else { _b.copy(_a); _qb.copy(_qa); }
      const o = easeInOut(clamp01(k / SCROLL.flat));   // 방향: 앞쪽에서 먼저 수평으로 (그 뒤엔 누운 채 내려감)
      disc.position.lerpVectors(_a, _b, e);
      disc.position.addScaledVector(Y, Math.sin(Math.PI * e) * DISC.arc);   // 내려가는 길이 위로 살짝 부풂
      disc.quaternion.slerpQuaternions(_qa, _qb, o);
      veilMat.opacity = 1 - smooth(kCream, SCROLL.cream[0], SCROLL.cream[1]);
      // 빛: 처음(크림 Hero) → 방 안 (판이 크림 위에서 보던 빛 그대로 시작)
      hemi.intensity = lerp(LIGHT.hemi[0], LIGHT.hemi[1], e);
      sun.intensity = lerp(LIGHT.sun[0], LIGHT.sun[1], e);
      sun.position.copy(camera.position).add(_up.set(1.5, 2.5, 3).applyQuaternion(camera.quaternion));
      sun.target.position.copy(disc.position);
    };

    // ── 스크롤 진행도 (판이 턴테이블까지 = 1)
    const progress = () => {
      const vh = page.clientHeight || 1;
      return clamp01((page.scrollTop - track.offsetTop) / (SCROLL.travel * vh));
    };

    let disposed = false, raf = 0;
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const gltf = new GLTFLoader().setDRACOLoader(draco);
    Promise.all([gltf.loadAsync(VINYL_URL), gltf.loadAsync(ROOM_URL)]).then(async ([v, g]) => {
      if (disposed) return;
      // 판
      const model = v.scene;
      // 판 메시마다: 깊이 프리패스(0) · 검은 몸통(1) · 잉크(2)
      const meshes = [];
      model.traverse((o) => { if (o.isMesh) meshes.push(o); });
      for (const m of meshes) {
        const add = (mat, order) => { const c = new THREE.Mesh(m.geometry, mat); c.position.copy(m.position); c.quaternion.copy(m.quaternion); c.scale.copy(m.scale); c.renderOrder = order; m.parent.add(c); return c; };
        add(depthMat, 0); add(bodyMat, 1);
        m.material = inkMat; m.renderOrder = 2;
      }
      discRef = meshes[0];
      st.pick = meshes;   // 누르기 · 커서 "Hold" 판정 대상
      const box = new THREE.Box3().setFromObject(model);
      model.position.sub(box.getCenter(new THREE.Vector3()));   // 판 가운데 = 회전 축
      const size = box.getSize(new THREE.Vector3());
      thickness = size.y / (Math.max(size.x, size.z) / 2);      // 반지름 1 기준 두께
      const r = Math.max(size.x, size.z) / 2;
      spin.scale.set(DISC.radius / r, (DISC.radius / r) * DISC.thick, DISC.radius / r);
      spin.add(model);
      disc.traverse((o) => o.layers.set(1));   // 판만 따로 그릴 수 있게 (크림 막 위에)

      // 방
      const root = g.scene;
      scene.add(root);
      const cam = g.cameras.find((c) => c.isPerspectiveCamera);
      if (cam) { scene.attach(cam); camera = cam; fit(); }   // Blender 의 방 완성 구도 카메라 (자리는 줌이 정함)
      camera.updateMatrixWorld();
      camPos0.copy(camera.position); camQ0.copy(camera.quaternion);
      root.traverse((o) => { if (o.isLight) st.lights.push({ l: o, base: o.intensity }); });
      st.seat = root.getObjectByName("Turntable_DiscSeat");
      st.mixer = new THREE.AnimationMixer(root);
      const clip = g.animations.find((a) => a.name === "reveal") ?? g.animations[0];
      st.action = st.mixer.clipAction(clip);
      st.action.setLoop(THREE.LoopOnce, 1);
      st.action.clampWhenFinished = true;
      st.action.play();
      st.dur = clip.duration;
      const once = (c) => { const a = st.mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); return a; };
      const lidOpen = g.animations.find((a) => a.name === "cover_open"), lidClose = g.animations.find((a) => a.name === "cover_close");
      // 덮개: cover_open 하나를 시간 그대로 앞으로(열림) · 거꾸로(닫힘). 0 초 = 닫힌 자세
      if (lidOpen) { st.lid = once(lidOpen); st.lid.time = 0; }
      void lidClose;
      // 구운 빛 (빈 방 · 가구 · 불 켜짐 그림)을 입힌 뒤 시작 자세로
      await applyLightmaps(root, renderer).catch(() => 0);
      if (disposed) return;
      pose(0);
      st.mixer.update(0);
      root.updateMatrixWorld(true);
      st.seat?.getWorldPosition(seat0);   // 0 프레임(턴테이블만 있을 때)의 판 자리 = 다가갈 곳 (다 올라온 자리)
      // 턴테이블이 아래에서 올라오는 몫은 pivot 안쪽 래퍼에 (pivot 은 클립이 움직임 → 클립 동작은 그대로)
      const ttPivot = root.getObjectByName("pivot_turntable");
      if (ttPivot) {
        st.ttRise = new THREE.Group();
        for (const c of [...ttPivot.children]) st.ttRise.add(c);
        ttPivot.add(st.ttRise);
      }
      st.camReady = !!st.seat;
      st.ready = true;
      placeDisc(0);
      camera.layers.enableAll();
      renderer.compile(scene, camera);
      renderer.compile(veilScene, veilCam);
      draw();
      markHomeReady();   // 첫 로딩 화면이 이걸 기다림 (판 · 방 · 구운 빛 · 셰이더까지)
    }).catch((e) => { console.error("vinyl/room load failed", e); markHomeReady(); });

    const clock = new THREE.Clock();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      driveRef.current?.(now);   // Lenis 먼저 → 이 프레임의 스크롤 위치로 그림
      frame(Math.min(clock.getDelta(), 0.1));
    };
    // 한 프레임 (탭이 가려져 requestAnimationFrame 이 멈췄을 때 콘솔에서 window.__roomLab.frame(0.016) 로 확인)
    const frame = (dt) => {
      if (!st.ready) return;
      const k = progress();
      st.k = k;
      const step = (cur, want, max) => (reduced ? max * (want ? 1 : 0) : Math.min(max, Math.max(0, cur + (want ? dt : -dt))));
      const end = st.dur + ROOM.litDur;
      // 덮개: 판이 턴테이블 가까이 오면 열림. 판이 덮개 안쪽(approach 넘어)에 있는 동안은 닫지 않음
      const lidDur = st.lid ? st.lid.getClip().duration : 0;
      const lidWant = k >= SCROLL.lidAt || st.kd > SCROLL.approach + 1e-3;
      st.lidT = step(st.lidT, lidWant && st.t <= 0, lidDur) ;
      if (st.t > 0) st.lidT = lidDur;   // 방이 지어지는 동안은 열린 채
      const lidFrac = lidDur ? st.lidT / lidDur : 1;
      // 판: 스크롤 자리를 따라가되, 덮개가 다 열려야 내려앉고 · 방이 다 거꾸로 돌아가야 들림
      let kdT = Math.min(k, SCROLL.approach + (1 - SCROLL.approach) * lidFrac);
      if (st.t > 0) kdT = 1;
      st.kd = reduced ? kdT : st.kd + (kdT - st.kd) * (1 - Math.exp(-dt * SCROLL.follow));
      if (Math.abs(kdT - st.kd) < 1e-4) st.kd = kdT;
      // 방: 판이 앉았고 스크롤이 그 너머면 앞으로, 아니면 거꾸로 (둘 다 Blender 시간 그대로)
      st.t = step(st.t, k >= 1 && st.kd >= 1, end);
      pose(st.t);
      if (st.lid) st.lid.time = st.lidT;
      st.mixer.update(0);
      // 턴테이블: 스크롤이 조금 내려간 뒤 아래에서 올라옴 (스크롤 자리 그대로, 되돌리면 다시 내려감)
      if (st.ttRise) {
        const rise = reduced ? 1 : easeInOut(clamp01((k - SCROLL.ttRise[0]) / SCROLL.ttRise[1]));
        st.ttRise.position.y = -(1 - rise) * SCROLL.ttDrop;
        st.ttRise.visible = rise > 0;
      }
      // 회전: 모터(10 RPM) · 누르는 동안 45 RPM 까지 가속 · 뗀 뒤 관성으로 복귀 (Home Hero 와 같은 값). Hero 를 떠나면 누르기 끝
      const motor = reduced ? 0 : -(DISC.rpm * Math.PI * 2) / 60;
      if (st.holding && st.kd < FX_OUT[1]) {
        st.omega = Math.max(st.omega - HERO_HOLD.accel * dt, -(HERO_HOLD.maxRpm * Math.PI * 2) / 60);
      } else {
        st.holding = false;
        st.omega += (motor - st.omega) * (1 - Math.exp(-dt / (2.5 / 3)));
      }
      st.spinA += st.omega * dt;
      spin.quaternion.setFromAxisAngle(Y, st.spinA);
      updateFlip(dt);
      placeDisc(st.kd, st.kd);
      heroLook(dt);
      updateTitle(dt);
      updateCursor(dt);
      draw();
    };
    // ── 끌어서 뒤집기 (Home updateFlip 과 같음): 끄는 동안 손을 따라 넘어가고, 놓으면 감쇠 스프링으로 가까운 면에 안착
    const fl = { pressed: false, id: null, flipping: false, settling: false, rel: 0, vel: 0, target: 0, last: 0,
      axis: new THREE.Vector3(1, 0, 0), dir: new THREE.Vector2(), start: new THREE.Vector2(), base: new THREE.Quaternion(), screen: new THREE.Vector2(), sideB: false };
    const _dq = new THREE.Quaternion(), _fup = new THREE.Vector3();
    const updateFlip = (dt) => {
      if (fl.flipping) {
        const v = dt > 0 ? (fl.rel - fl.last) / dt : 0;
        fl.vel += (v - fl.vel) * (1 - Math.exp(-dt / 0.06));
        fl.last = fl.rel;
      } else if (fl.settling) {
        const kk = FLIP.stiffness, c = 2 * Math.sqrt(kk) * FLIP.damping;
        fl.vel += (kk * (fl.target - fl.rel) - c * fl.vel) * dt;
        fl.rel += fl.vel * dt;
        if (Math.abs(fl.target - fl.rel) < 0.0015 && Math.abs(fl.vel) < 0.02) { fl.rel = fl.target; fl.settling = false; }
      }
      if (fl.flipping || fl.settling || fl.rel !== 0) {
        _dq.setFromAxisAngle(fl.axis, fl.rel);
        flip.quaternion.multiplyQuaternions(_dq, fl.base);
        if (!fl.flipping && !fl.settling) { fl.base.copy(flip.quaternion); fl.rel = 0; }
      }
      // 지금 보이는 면: 판의 원래 윗면이 아래를 향하면 B면 → 타이포 링 문구 SIDE A ↔ B
      _fup.set(0, 1, 0).applyQuaternion(flip.quaternion);
      const b = _fup.y < 0;
      if (b !== fl.sideB) { fl.sideB = b; fx.setSideB(b); }
    };
    // ── Hero 그림: 잉크 색 · 검은 몸통 · 빛줄기(판 로컬) · 주변 효과 (Home updateLight · 루프와 같은 계산)
    const _cf2 = new THREE.Vector3(), _eye = new THREE.Vector3(), _view = new THREE.Vector3(), _vflat = new THREE.Vector3(), _major = new THREE.Vector3();
    const _half = new THREE.Vector3(), _ld = new THREE.Vector3(), _tmp = new THREE.Vector3(), _inv = new THREE.Matrix4(), _compInv = new THREE.Matrix4();
    const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(), _hit = new THREE.Vector3(), _cursor = new THREE.Vector2(), _n = new THREE.Vector3();
    const heroLook = (dt) => {
      if (!discRef) return;
      const night = 1 - veilMat.opacity;   // 크림 바탕이 걷힌 만큼
      inkU.uInk.value.set(...(_inkA.set(INK.cream).lerp(_inkB.set(INK.night), night)).convertLinearToSRGB().toArray());   // 셰이더는 sRGB 값 그대로
      inkU.uLabel.value.set(...(_inkA.set(LABEL.cream).lerp(_inkB.set(LABEL.night), night)).convertLinearToSRGB().toArray());
      bodyMat.opacity = smooth(st.kd, BODY_IN[0], BODY_IN[1]);
      // 빛줄기: 기울기 틀(disc)에서 시선 → 장축 → 반사 빛. 눈은 판 반지름의 eyeFar 배 뒤 (Home 직교 카메라처럼 평행한 시선)
      disc.updateWorldMatrix(true, true);
      _compInv.copy(disc.matrixWorld).invert();
      camera.getWorldDirection(_cf2);
      _view.copy(_cf2).negate().transformDirection(_compInv);
      _vflat.set(_view.x, 0, _view.z); if (_vflat.lengthSq() < 1e-6) _vflat.set(0, 0, 1); _vflat.normalize();
      _major.set(-_vflat.z, 0, _vflat.x);
      const a = THREE.MathUtils.degToRad(STREAK.angle), ca = Math.cos(a), sa = Math.sin(a);
      _half.set(_major.x * ca + _vflat.x * sa, 0, _major.z * ca + _vflat.z * sa).multiplyScalar(STREAK.spread);
      _half.y = 1; _half.normalize();
      _ld.copy(_half).multiplyScalar(2 * _half.dot(_view)).sub(_view).normalize();
      if (_ld.y < STREAK.minY) { _ld.y = STREAK.minY; _ld.normalize(); }
      _ld.transformDirection(disc.matrixWorld);
      _inv.copy(discRef.matrixWorld).invert();
      _eye.copy(disc.position).addScaledVector(_cf2, -DISC.radius * STREAK.eyeFar).applyMatrix4(_inv);
      inkU.uCamLocal.value.copy(_eye);
      inkU.uLightLocal.value.copy(_tmp.copy(_ld).transformDirection(_inv));
      // 주변 효과: Hero 에서만 (판이 내려가기 시작하면 옅어짐)
      const fade = reduced ? 1 - smooth(st.kd, 0, 0.001) : 1 - smooth(st.kd, FX_OUT[0], FX_OUT[1]);
      // 커서: 판 평면 위 자리 (먼지가 비켜감) · 판 위인지 · 타이포 링 (가운데 쪽에 오면 나타나고, 링 밖으로 나가야 사라짐)
      let cursor = null;
      st.overDisc = false;
      if (st.pointer && fade > 0.001) {
        const p = planeAt(st.pointer, _cursor);
        if (p) {
          cursor = p;
          const rr = Math.hypot(p.x, p.y);
          if (rr < RING.show) st.overRing = true; else if (rr > RING.hide) st.overRing = false;
        }
        st.overDisc = hero() && hitsDisc(st.pointer);
      } else st.overRing = false;
      fx.update(dt, { omega: st.omega, angle: st.spinA, major: Math.atan2(_major.z, _major.x) + a, cursor, ring: (st.overRing || st.holding) && hero(), fade, time: performance.now() / 1000 });
      const sk = fx.streak();
      inkU.uStreak.value = sk.streak; inkU.uSharp.value = sk.sharp;
    };
    const hero = () => st.kd < 0.02;   // Hero 자리 (누르기 · 뒤집기 · 링은 여기서만)
    // 화면 좌표(-1..1) → 판 평면(기울기 틀) 위 자리 (판 반지름 = 1). 판과 평행하면 null
    const planeAt = (ndc, out) => {
      _ray.setFromCamera(ndc, camera);
      _n.set(0, 1, 0).applyQuaternion(disc.quaternion);
      _plane.setFromNormalAndCoplanarPoint(_n, disc.position);
      if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
      disc.updateWorldMatrix(true, false);
      _hit.applyMatrix4(_compInv.copy(disc.matrixWorld).invert()).divideScalar(DISC.radius);
      return out.set(_hit.x, _hit.z);
    };
    _ray.layers.enableAll();   // 판은 1번 층
    const hitsDisc = (ndc) => {
      if (!st.pick?.length) return false;
      _ray.setFromCamera(ndc, camera);
      return _ray.intersectObjects(st.pick, false).length > 0;
    };
    // 입력 (Home 과 같음): 판 위를 누르면 가속부터 → 8px 넘게 끌면 뒤집기로 바뀜
    const ndcOf = (e, out) => {
      const r = renderer.domElement.getBoundingClientRect();
      return out.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
    };
    const _pd = new THREE.Vector2(), _pp = new THREE.Vector2();
    const onMove = (e) => {
      ndcOf(e, st.pointer ??= new THREE.Vector2());
      if (e.pointerType === "mouse") { cur.mouse.set(e.clientX, e.clientY); if (!cur.visible) { cur.ring.copy(cur.mouse); cur.visible = true; } }
      cur.overLink = !!(e.target instanceof Element && e.target.closest("a, button, [role='button']"));
      if (!fl.pressed || e.pointerId !== fl.id) return;
      if (!fl.flipping) {
        if (Math.hypot(e.clientX - fl.screen.x, e.clientY - fl.screen.y) < FLIP.dragStart) return;
        if (!planeAt(ndcOf(e, _pd), _pp)) return;
        fl.dir.copy(_pp).sub(fl.start);
        if (fl.dir.lengthSq() < 1e-8) fl.dir.set(1, 0);
        fl.dir.normalize();
        fl.axis.set(fl.dir.y, 0, -fl.dir.x);   // 위쪽 × 끈 방향 → 그 방향으로 넘어감
        st.holding = false; fl.flipping = true; fl.settling = false;
        fl.base.copy(flip.quaternion); fl.rel = 0; fl.last = 0; fl.vel = 0;
      }
      if (!planeAt(ndcOf(e, _pd), _pp)) return;
      fl.rel = (_pp.sub(fl.start).dot(fl.dir) / FLIP.dragPerTurn) * Math.PI;
    };
    const onDown = (e) => {
      if (fl.pressed || e.button !== 0 || !hero() || !hitsDisc(ndcOf(e, _pd))) return;
      fl.pressed = true; fl.id = e.pointerId;
      fl.screen.set(e.clientX, e.clientY);
      planeAt(_pd, fl.start);
      st.holding = true;
      renderer.domElement.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const endPress = (e) => {
      if (!fl.pressed || e.pointerId !== fl.id) return;
      fl.pressed = false; fl.id = null; st.holding = false;
      if (fl.flipping) {   // 던진 속도까지 고려해 가까운 면(반 바퀴 단위)으로
        fl.flipping = false;
        fl.target = Math.round((fl.rel + fl.vel * 0.18) / Math.PI) * Math.PI;
        fl.settling = true;
      }
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
    };
    const onLeave = () => { st.pointer = null; cur.visible = false; };
    const noMenu = (e) => e.preventDefault();   // 길게 누를 때 메뉴가 뜨지 않게
    host.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) renderer.domElement.addEventListener(t, endPress);
    host.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("contextmenu", noMenu);
    renderer.domElement.style.touchAction = "pan-y";

    // ── "Grooves" 제목: 회전이 시작되고 조금 뒤 글자가 하나씩 올라옴 · 빨라질수록 기울고 벌어짐 · 내려가면 위로 걷히며 옅어짐
    const letters = [...(titleRef.current?.children ?? [])];
    const letterVel = letters.map(() => 0);
    const updateTitle = (dt) => {
      const h1 = titleRef.current;
      if (!h1) return;
      const startAt = startRef.current;
      const t = startAt == null ? -1 : performance.now() / 1000 - startAt - TITLE.delay;
      const rpmNow = (Math.abs(st.omega) * 60) / (Math.PI * 2);
      const amount = reduced ? 0 : clamp01((rpmNow - DISC.rpm) / (HERO_HOLD.maxRpm - DISC.rpm));
      letters.forEach((el, i) => {
        const rk = reduced ? (t >= 0 ? 1 : 0) : 1 - Math.pow(1 - clamp01((t - i * TITLE.stagger) / TITLE.dur), 3);
        el.style.translate = `0 ${((1 - rk) * 110).toFixed(2)}%`;
        letterVel[i] += (amount - letterVel[i]) * (1 - Math.exp(-dt / (0.12 + i * 0.07)));   // 뒤 글자일수록 늦게
        const v = letterVel[i], spread = (i - (letters.length - 1) / 2) * v * 0.09;
        el.style.transform = `translateX(${spread.toFixed(3)}em) skewX(${(-v * 28).toFixed(2)}deg)`;
      });
      const out = smooth(st.kd, TITLE.out[0], TITLE.out[1]);
      h1.style.opacity = String(1 - out);
      h1.style.translate = `0 calc(-50% - ${(out * TITLE.lift * host.clientHeight).toFixed(1)}px)`;
    };

    // ── 커스텀 커서 (마우스에서만): 점은 바로, 링은 살짝 늦게 · 판 위 "Hold / Drag" · 누르는 중 rpm + 판과 함께 도는 눈금 · 뒤집는 중 "Flip"
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cur = { mouse: new THREE.Vector2(-100, -100), ring: new THREE.Vector2(-100, -100), visible: false, overLink: false, state: "" };
    if (finePointer) host.style.cursor = "none";
    const setCursorState = (s) => {
      const c = cursorRef.current;
      if (!c || s === cur.state) return;
      cur.state = s;
      c.shape.style.transform = `scale(${CURSOR.scale[s] ?? CURSOR.scale.idle})`;
      const filled = s === "disc" || s === "drag" || s === "flip";
      c.shape.style.backgroundColor = filled ? `color-mix(in srgb, ${HS.paper} 72%, transparent)` : "transparent";
      c.shape.style.backdropFilter = filled ? "blur(6px)" : "none";
      c.shape.style.borderColor = s === "link" ? HS.text : HS.ink3d;
      c.label.style.opacity = filled ? "1" : "0";
      c.tick.style.opacity = s === "drag" ? "1" : "0";
      c.dot.firstElementChild.style.opacity = s === "idle" ? "1" : "0";
      if (s === "disc") c.label.textContent = "Hold\nDrag";
      if (s === "flip") c.label.textContent = "Flip";
    };
    const updateCursor = (dt) => {
      const c = cursorRef.current;
      if (!finePointer || !c) return;
      const s = !cur.visible ? "hidden" : fl.flipping ? "flip" : st.holding ? "drag" : st.overDisc ? "disc" : cur.overLink ? "link" : "idle";
      setCursorState(s);
      const show = s !== "hidden";
      c.ring.style.opacity = show ? "1" : "0";
      c.dot.style.opacity = show ? "1" : "0";
      cur.ring.lerp(cur.mouse, reduced ? 1 : 1 - Math.exp(-dt / CURSOR.ringLag));
      c.dot.style.transform = `translate3d(${cur.mouse.x}px, ${cur.mouse.y}px, 0)`;
      c.ring.style.transform = `translate3d(${cur.ring.x.toFixed(2)}px, ${cur.ring.y.toFixed(2)}px, 0)`;
      if (s === "drag") {
        const charge = Math.min(1, Math.abs(st.omega) / ((HERO_HOLD.maxRpm * Math.PI * 2) / 60));
        c.shape.style.transform = `scale(${(CURSOR.scale.drag - 0.14 * charge).toFixed(3)})`;
        const rpmNow = (Math.abs(st.omega) * 60) / (Math.PI * 2);
        c.label.textContent = `${rpmNow < 0.5 ? 0 : Math.round(rpmNow)} rpm`;
        c.tick.style.transform = `rotate(${(-st.spinA * 180 / Math.PI).toFixed(1)}deg)`;
      }
    };
    // 그리기: 크림 막이 있으면 방(0번 층) → 크림 막 → 깊이 지움 → 판(1번 층). 없으면 한 번에
    const draw = () => {
      const veilOn = veilMat.opacity > 0.001;
      camera.layers.set(0);
      if (!veilOn) camera.layers.enable(1);
      renderer.render(scene, camera);
      if (veilOn) {
        const ac = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(veilScene, veilCam);
        renderer.clearDepth();
        camera.layers.set(1);
        // 단색 바탕(scene.background)은 autoClear 와 상관없이 화면을 지움 → 판만 그리는 동안은 바탕을 비워 크림 막을 지키기
        const bg = scene.background;
        scene.background = null;
        renderer.render(scene, camera);
        scene.background = bg;
        renderer.autoClear = ac;
      }
      camera.layers.enableAll();
    };
    window.__roomLab = { st, pose, frame, renderer, canvas: renderer.domElement };   // 콘솔 확인용
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); draco.dispose();
      host.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) renderer.domElement.removeEventListener(t, endPress);
      host.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("contextmenu", noMenu);
      host.style.cursor = "";
      fx.dispose();
      disposeScene(scene); disposeScene(veilScene);
      renderer.dispose();
      renderer.domElement.remove();
      if (window.__roomLab?.st === st) delete window.__roomLab;
    };
  }, [pageRef, driveRef, trackRef]);

  return (
    <div ref={hostRef} className="sticky top-0 h-svh w-full overflow-hidden [&>canvas]:absolute [&>canvas]:inset-0 [&>canvas]:block">
      {/* "Grooves" 제목 (Home Hero 와 같은 글꼴 · 크기 · 자리). 글자는 처음에 아래에 숨어 있다가 하나씩 올라옴 (overflow-y-clip 이 잘라 줌) */}
      <h1 ref={titleRef} aria-label="Grooves"
        className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 select-none overflow-y-clip py-[0.06em] text-center ${MONOTON} text-[11vw] leading-none will-change-transform`}
        style={{ color: HS.text, translate: "0 -50%" }}>
        {"Grooves".split("").map((ch, i) => <span key={i} aria-hidden="true" className="inline-block origin-bottom translate-y-[110%]">{ch}</span>)}
      </h1>
      {/* 커스텀 커서 (마우스에서만): 바깥 래퍼는 위치(JS), 안쪽은 크기 · 모양(CSS transition) — Home 과 같은 마크업 */}
      <div ref={ringRef} className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-300" aria-hidden="true">
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div ref={shapeRef} style={{ transform: "scale(0.32)", borderColor: HS.ink3d }} className="relative h-[88px] w-[88px] rounded-full border transition-[transform,background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <svg ref={tickRef} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300" viewBox="0 0 88 88" fill="none">
              <circle cx="44" cy="44" r="40" stroke={HS.ink3d} strokeWidth="0.8" strokeDasharray="1.5 5" />
              <line x1="44" y1="2" x2="44" y2="11" stroke={HS.ink3d} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span ref={labelRef} style={{ color: HS.text }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-pre text-center text-[11px] font-medium uppercase leading-[1.35] tracking-[0.14em] tabular-nums opacity-0 transition-opacity duration-300" />
        </div>
      </div>
      <div ref={dotRef} className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-200" aria-hidden="true">
        <div className="h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: HS.text, boxShadow: `0 0 0 1px ${HS.paper}` }} />
      </div>
    </div>
  );
}

export default function VinylOnly() {
  const pageRef = useRef(null);
  const contentRef = useRef(null);
  const trackRef = useRef(null);
  const driveRef = useRef(null);
  const { done } = useIntro();
  usePageLenis({ wrapperRef: pageRef, contentRef, enabled: done, driveRef });
  return (
    <div ref={pageRef} className="page home" data-lenis-prevent>
      <div ref={contentRef} className="page-content">
        {/* 붙어 있는 캔버스 하나 + 스크롤 길이 (처음 화면 + 판이 내려가는 길이 + 방을 보는 길이) */}
        <section ref={trackRef} className="relative w-full" aria-label="Vinyl record and Grooves room"
          style={{ height: `${(1 + SCROLL.travel + SCROLL.hold) * 100}svh`, background: ROOM.bg }}>
          <Stage pageRef={pageRef} driveRef={driveRef} trackRef={trackRef} />
        </section>
      </div>
    </div>
  );
}
