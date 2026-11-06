"use client";
// 거실 GLB 테스트 — Home 리디자인 시나리오 v2
//  Hero(크림 + 잉크 판) → 검은 바탕, 판이 1/3로 → 가운데 아래 턴테이블 등장, 판이 내려앉음
//  → 턴테이블을 기점으로 방이 만들어짐 · 램프가 하나씩 켜짐 · 창밖 서울 야경 → 33⅓
//  → 카메라가 왼쪽으로 옮겨 방이 가운데 → New Vinyls(선반 커버 핸드오프) → News
// 방이 만들어지는 부분은 Blender reveal 클립을 순서·타이밍 그대로 재생 (STORY.build 구간에 선형으로)
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createClient } from "@/utils/supabase/client";
import { fetchRecentVinyls } from "@/lib/recent-vinyls";
import { coverUrl } from "@/lib/albums";
import { MONOTON } from "@/lib/fonts";
import { discFrag, discVert, inkDefaults } from "@/components/vinyl/inkShaders";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import StoryCover from "@/content/news/Covers";
import { STORIES, CATEGORIES, categoryName } from "@/content/news";
import HomeStage from "@/components/home/stage/HomeStage";
import LAYER_CFG from "@/components/envtest/env-layers.json";
import { D2R, ASPECT, computeRig, makeBase, createEnv } from "@/components/envtest/envCore";
import { attachFlipClock } from "./flipClock";
import { addShelfTestProps, applyNowPlaying } from "./shelfTestProps";

const MODEL_URL = "/models/room/grooves_room_blockout_reveal.glb";
const VINYL_URL = "/models/vinyl.glb";
// 램프가 아닌 불빛: 이름으로 pivot 을 못 찾으니 따로 지정 (캔들은 Lv3 소품 pivot, 이웃 옥상은 전구 줄 · 랜턴 pivot 이 다 놓인 뒤 켜짐)
const LIGHT_PIVOT = {
  light_candle: "pivot_prop_ct_candle",
  light_nb_left_string: "pivot_nb_left_lights", light_nb_left_lantern: "pivot_nb_left_table",
  light_nb_right_string: "pivot_nb_right_lights", light_nb_right_lantern: "pivot_nb_right_lantern",
};

// 이야기 진행도 P (0~1). [시작, 길이]
const STORY = {
  heroEnd: 0.06,
  dark: [0.06, 0.12],             // 바탕이 검게, 판이 1/3 크기로 (카메라가 멀어짐)
  ttRise: [0.15, 0.10],           // 가운데 아래 턴테이블이 어둠 속에서 올라옴
  land: [0.24, 0.10],             // 판이 플래터 위로 내려앉음
  build: [0.34, 0.34],            // Blender reveal 클립 전체를 이 구간에 선형으로 = Blender 순서·타이밍 그대로
  lampDelay: 0.01, lampDur: 0.07,  // 램프는 놓인 뒤 천천히 켜짐
  nightDur: 0.12,                 // 창문 벽이 다 선 뒤 창밖 야경이 밝아지는 길이
  room: [0.34, 0.20],             // 방 주변광
  lidAt: 0.20,                    // 턴테이블이 다 올라온 뒤·판이 내려앉기 전에 먼지 덮개가 열림
  spinAt: 0.70, armDur: 0.05,
  camFinal: 0.68,
  roomHold: 0.76,                 // 방 전체 구도는 여기까지 (= 3칸)
  // [열림, 닫힘] 진행도 (되돌아갈 때 덜컹이지 않게 간격). New Vinyls 는 카메라가 커버 앞에 거의 다 왔을 때 넘김
  nv: [0.85, 0.84], news: [0.93, 0.90],
};
// 칸: 0 Hero(Home 엔진 그대로) · 1 검은 바탕·판 1/3 · 2 턴테이블·착지 · 3 방 완성(33⅓) · 4 New Vinyls · 5 News
//  - 착지까지(0~2): 스크롤이 칸 사이 위치 s 를 직접 움직이고 화면은 부드럽게 따라감. 손을 떼면 가까운 칸으로 미끄러져 붙음
//  - 3D 방부터(2~5): 휠·스와이프·키 한 번에 한 칸, 그 칸의 장면을 시간으로 재생 (방 생성은 Blender 시간 그대로, 재생 중엔 입력 무시)
const STAGE_P = [0, 0.18, 0.34, 0.76, 0.86, 0.96];
const STAGE_DUR = [1.6, 2.2, null, 1.2, 1.0];   // [i]↔[i+1] 한 칸을 지나는 시간(초). null = 방 생성: Blender 클립 길이 그대로
const STEP_FROM = 2;                            // 이 칸부터는 한 번에 한 칸
const STEP = { threshold: 24, touch: 40, cooldown: 0.45 };   // Home 엔진 SECTION 과 같은 값
// 해상도: 4K 화면에서 픽셀 비율 2 면 한 장에 수백만 픽셀 × 조명 수십 개 → 1.5 로 묶고, 그래도 느리면 1 까지 자동으로 낮춤
const DPR_MAX = 1.5, DPR_MIN = 1, DPR_SLOW_FPS = 45;
const HERO_HOLD = 0.4;   // Hero 를 이어 받은 판이 제자리에 머무는 시간(초). Hero 레이어가 걷히는 0.5초와 거의 같게
const NV_BACK_WAIT = 1.0;                       // New Vinyls → 방: 커버가 선반으로 돌아가는 시간(핸드오프 1초)만큼 카메라가 기다림
const SCROLL = {
  speed: 0.8,       // 착지까지: 스크롤·붙는 속도 배율 (1 보다 작으면 더 천천히)
  perStage: 420,    // 휠 이만큼(px)이면 한 칸 (speed 1 기준, 마우스 휠 약 4노치)
  maxStep: 0.35,    // 휠 이벤트 하나로 움직이는 최대 칸 (큰 휠 튐 방지)
  touch: 0.45,      // 터치: 화면 높이의 이만큼 끌면 한 칸
  follow: 7,        // 화면이 스크롤 위치를 따라가는 빠르기 (클수록 바로 붙음)
  idle: 0.16,       // 입력이 이만큼(초) 멈추면 칸에 붙기 시작
  bias: 0.22,       // 진행 방향으로 이만큼 넘었으면 다음 칸, 아니면 원래 칸으로
};
const sToP = (s) => { const i = Math.min(Math.floor(s), STAGE_P.length - 2); return STAGE_P[i] + (STAGE_P[i + 1] - STAGE_P[i]) * (s - i); };
const pToS = (p) => { let i = 0; while (i < STAGE_P.length - 2 && p > STAGE_P[i + 1]) i++; return i + clamp01((p - STAGE_P[i]) / (STAGE_P[i + 1] - STAGE_P[i])); };
// 진행 막대·디버그 패널에 쓰는 칸 이름 (칸 자리 = STAGE_P)
const STAGES = ["Hero", "검은 바탕 · 판 1/3", "턴테이블 · 판 착지", "방 · 불 · 야경 · 33⅓", "New Vinyls", "News"].map((label, i) => [STAGE_P[i], label]);
const RPM = (r) => (r * Math.PI * 2) / 60;
const CREAM = new THREE.Color("#f3e7cd"), NIGHT = new THREE.Color("#0e0c11");
const INK_ON_CREAM = new THREE.Color("#4c404a"), INK_ON_NIGHT = new THREE.Color("#efe3c8");
const LABEL_ON_CREAM = new THREE.Color("#2d6a6a"), LABEL_ON_NIGHT = new THREE.Color("#7fc1bd");
const DISC_R = 0.15;              // LP 반지름 (m)
const ARM_SWING = -0.42;          // 톤암이 판 위로 들어가는 각도 (rad, 톤암 기둥 기준)
const FOV0 = 30;                  // 이야기 카메라 시야. 방 완성 칸에서는 GLB 카메라 시야(약 17°)로 바뀜
const ENV_IN = [0.58, 0.10];      // 바깥 배경(하늘·도시·한강)이 서서히 나타나는 구간 (방 완성 구도로 다가갈 때)
const HEMI_SKY = new THREE.Color("#9fb0d8"), HEMI_GROUND = new THREE.Color("#2a2230"), MOON = new THREE.Color("#8fa6d8");
const DUSK = {
  hemiSky: new THREE.Color(LAYER_CFG.light.hemiSky), hemiGround: new THREE.Color(LAYER_CFG.light.hemiGround),
  hemiIntensity: LAYER_CFG.light.hemiIntensity, sunColor: new THREE.Color(LAYER_CFG.light.sunColor), sunIntensity: LAYER_CFG.light.sunIntensity,
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, [a, d]) => clamp01((p - a) / d);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// News 카드: 카테고리마다 최신 글 1편 (Home 과 같은 기준)
const POSTS = CATEGORIES
  .map((c) => STORIES.filter((s) => s.category === c.key).sort((a, b) => b.date.localeCompare(a.date))[0])
  .filter(Boolean)
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((s) => ({ slug: s.slug, title: s.title, cover: s.cover, category: categoryName(s.category) }));

// 클립에서 한 노드가 실제로 움직이는 시간 구간 [s, e] (램프가 켜질 때·야경 시작 등을 맞추는 데만 씀)
function nodeRange(clip, name) {
  let s = Infinity, e = -Infinity;
  for (const tr of clip.tracks) {
    if (THREE.PropertyBinding.parseTrackName(tr.name).nodeName !== name) continue;
    const r = activeRange(tr);
    if (r) { s = Math.min(s, r[0]); e = Math.max(e, r[1]); }
  }
  return isFinite(s) ? [s, e] : null;
}
// 값이 처음으로 바뀌는 키 ~ 마지막으로 바뀌는 키 (전 구간 베이크된 트랙도 처리)
function activeRange({ times, values }) {
  const n = times.length, w = values.length / n;
  const same = (i, j) => { for (let k = 0; k < w; k++) if (Math.abs(values[i * w + k] - values[j * w + k]) > 1e-4) return false; return true; };
  if (same(0, n - 1)) { let moved = false; for (let i = 1; i < n && !moved; i++) moved = !same(i, 0); if (!moved) return null; }
  let a = 0; while (a < n - 1 && same(a + 1, 0)) a++;
  let b = n - 1; while (b > 0 && same(b - 1, n - 1)) b--;
  return [times[a], times[Math.max(a, b)]];
}

// 기운 커버 메시 앞면에 붙이는 판 (가장 얇은 축의 방 쪽 면)
function makeCoverFace(mesh, roomCenter) {
  const g = mesh.geometry; g.computeBoundingBox();
  const b = g.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const axis = s.x <= s.y && s.x <= s.z ? "x" : s.y <= s.z ? "y" : "z";
  const n = new THREE.Vector3(); n[axis] = 1;
  const wn = n.clone().transformDirection(mesh.matrixWorld);
  const toRoom = roomCenter.clone().sub(mesh.getWorldPosition(new THREE.Vector3()));
  const sign = wn.dot(toRoom) >= 0 ? 1 : -1;
  const span = axis === "x" ? [s.z, s.y] : axis === "y" ? [s.x, s.z] : [s.x, s.y];
  const side = Math.min(...span) * 0.96;
  const mat = new THREE.MeshStandardMaterial({ color: "#bbcbda", roughness: 0.7, emissive: "#ffffff", emissiveIntensity: 0 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(side, side), mat);
  face.position.copy(c);
  face.position[axis] = sign > 0 ? b.max[axis] + 0.002 : b.min[axis] - 0.002;
  if (axis === "x") face.rotation.y = sign * Math.PI / 2;
  else if (axis === "y") face.rotation.x = -sign * Math.PI / 2;
  else if (sign < 0) face.rotation.y = Math.PI;
  mesh.add(face);
  return { face, mat };
}

// 잉크 판: Home·앨범 상세와 같은 셰이더 + 아래에 검은 판(착지 뒤 차오름)
function makeInkDisc(scene) {
  const uniforms = {
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
  const inkMat = new THREE.ShaderMaterial({ vertexShader: discVert, fragmentShader: discFrag, uniforms, transparent: true, premultipliedAlpha: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const baseMat = new THREE.MeshStandardMaterial({ color: "#16131a", roughness: 0.35, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const model = scene;
  model.scale.set(1, 1.8, 1);
  const meshes = [];
  model.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const ink = new THREE.Mesh(m.geometry, inkMat);
    ink.position.copy(m.position); ink.quaternion.copy(m.quaternion); ink.scale.copy(m.scale);
    ink.renderOrder = 2;
    m.parent.add(ink);
    m.material = baseMat; m.renderOrder = 1;   // 투명도 0 이어도 깊이는 씀 = 잉크 패스의 depth 프리패스
  }
  const holder = new THREE.Group();
  holder.scale.setScalar(DISC_R);
  holder.position.y = -inkDefaults.botY * 1.8 * DISC_R;   // 판 아랫면이 플래터에 닿게
  holder.add(model);
  const root = new THREE.Group();
  root.add(holder);
  return { root, uniforms, inkMat, baseMat, ref: meshes[0] };
}

export default function RoomTest() {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const slotRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [hud, setHud] = useState({ p: 0, stage: STAGES[0][1] });
  const [albums, setAlbums] = useState([]);
  const [shelfReady, setShelfReady] = useState(0);   // 창가 선반 확인용 소품이 얹히면 재킷 앨범을 다시 입힘
  const [camName, setCamName] = useState("story");
  const [lightScale, setLightScale] = useState(0); // log10 배율 (Unitless export 라 1배가 기본)
  const [exposure, setExposure] = useState(1);
  const [helpers, setHelpers] = useState(false);
  const [panel, setPanel] = useState(true);
  const [stats, setStats] = useState({ fps: 0, calls: 0, tris: 0 });
  const [section, setSection] = useState(0);   // 0 방 · 1 New Vinyls · 2 News
  const [flyer, setFlyer] = useState(null);   // { rect, animate, landed, closing }
  const [heroOn, setHeroOn] = useState(true);   // Hero = Home 엔진 레이어가 보이는 동안
  // 모션 줄이기: 칸 이동은 바로, 회전·떠 있는 흔들림·커버 날아가기 없음 (프로젝트 공통 규칙)
  const [reduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const wrapRef = useRef(null);
  const homeRef = useRef(null);   // Home 엔진 (heroPose)

  useEffect(() => {
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // 사이트 테마의 크림 (다크 모드면 크림 ↔ 잉크가 바뀌어 있음) = Hero 바탕 · New Vinyls·News 종이색
    const themeCream = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--cream").trim();
      return v ? new THREE.Color(v) : CREAM.clone();
    };
    scene.background = themeCream();
    const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, 0);
    const moon = new THREE.DirectionalLight(MOON, 0);          // 창 쪽에서 들어오는 밤빛 (방 완성 칸에선 노을빛)
    const key = new THREE.SpotLight("#ffe2b8", 0, 6, 0.55, 0.6, 1.2);  // 어둠 속 턴테이블만 비추는 빛
    scene.add(hemi, moon, moon.target, key, key.target);

    // 먼 배경 레이어가 카메라에서 약 400m → far 1000
    const storyCam = new THREE.PerspectiveCamera(FOV0, 1, 0.05, 1000);
    const orbitCam = new THREE.PerspectiveCamera(FOV0, 1, 0.05, 1000);
    const controls = new OrbitControls(orbitCam, renderer.domElement);
    controls.enableDamping = true;

    const st = {
      renderer, scene, storyCam, orbitCam, controls, gltfCams: {}, camMode: "story",
      mixer: null, parts: null, ready: false, disposed: false,
      lights: [], baseIntensity: new Map(), lampMats: new Map(), lampAt: new Map(), helpers: [], lightMul: 1,
      p: 0, target: 0, auto: false, ownSpin: 0, ownVel: RPM(10), platterVel: 0, section: 0, hideLastCover: false,
      covers: [], ptr: new THREE.Vector2(), ptrS: new THREE.Vector2(),
    };
    st.reduced = reduced;
    st.themeCream = scene.background.clone();
    st.heroBg = st.themeCream.clone();
    apiRef.current = st;

    // 헤더: 투명(globals.css, data-header-see-through)이라 장면 바탕이 비침 → 글자·펼친 메뉴 패널 색만 지금 바탕에 맞춤
    //       New Vinyls·News 가 열려 있으면 그 종이색 기준
    const ctPage = wrapRef.current?.closest(".ct-page");
    const FG_ON_LIGHT = new THREE.Color("#4c404a"), FG_ON_DARK = new THREE.Color("#f4e7cd");
    const _hb = new THREE.Color(), _hf = new THREE.Color();
    let headKey = "";
    const syncHeader = () => {
      if (!ctPage) return;
      _hb.copy(st.section >= 1 ? st.themeCream : scene.background);
      const lum = 0.2126 * _hb.r + 0.7152 * _hb.g + 0.0722 * _hb.b;   // 선형 밝기: 크림 ≈ 0.8, 잉크 ≈ 0.06, 밤 ≈ 0.005
      _hf.copy(FG_ON_DARK).lerp(FG_ON_LIGHT, THREE.MathUtils.smoothstep(lum, 0.1, 0.35));
      const key = _hb.getHexString() + _hf.getHexString();
      if (key === headKey) return;
      headKey = key;
      ctPage.style.setProperty("--ct-header-fg", `#${_hf.getHexString()}`);
      ctPage.style.setProperty("--ct-drop-bg", `#${_hb.getHexString()}`);
    };
    window.__room = st; // 콘솔 디버깅용

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      for (const c of [storyCam, orbitCam, ...Object.values(st.gltfCams)]) { c.aspect = w / h; c.updateProjectionMatrix(); }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ── 스크롤 위치 s(칸 단위): 입력이 sTarget 을 움직이고, s 는 그걸 부드럽게 따라감
    const now = () => performance.now() / 1000;
    const LAST = STAGE_P.length - 1;
    st.s = 0; st.sTarget = 0; st.goal = null; st.stage = 0; st.dir = 1; st.inputAt = 0; st.touching = false; st.inHero = true;
    st.tween = null; st.lockUntil = 0;
    const segDur = (i) => STAGE_DUR[i] ?? (st.clip.duration * (STAGE_P[i + 1] - STAGE_P[i])) / STORY.build[1];
    // 착지까지: 그 칸으로 미끄러져 붙음
    const goStage = (n) => { st.goal = Math.max(0, Math.min(STEP_FROM, n)); st.dir = Math.sign(st.goal - st.sTarget) || st.dir; };
    // 3D 방부터: 한 칸을 시간으로 재생 (방 생성은 선형 = Blender 타이밍 그대로, 나머지는 ease)
    const stepTo = (n) => {
      n = Math.max(STEP_FROM, Math.min(LAST, n));
      const from = st.sTarget;
      if (n === from) return;
      const i = Math.min(n, from);
      st.goal = null;
      // New Vinyls → 방: 커버가 먼저 선반으로 돌아간 뒤(핸드오프 0.9초) 카메라가 물러남 — 커버가 움직이는 카메라를 쫓지 않게
      const wait = from === 4 && n === 3 ? NV_BACK_WAIT : 0;
      st.tween = st.reduced
        ? { from, to: n, start: now(), dur: 1e-3, linear: true }
        : { from, to: n, start: now() + wait, dur: segDur(i), linear: STAGE_DUR[i] == null };
    };
    // 다음/이전 칸 (키·Auto): 경계에 따라 둘 중 하나
    const advance = (dir) => {
      const at = st.goal ?? st.sTarget;
      if (dir > 0 ? at >= STEP_FROM : at > STEP_FROM) stepTo(Math.round(at) + dir);
      else goStage((dir > 0 ? Math.floor(at) : Math.ceil(at)) + dir);
    };
    st.advance = advance;
    const inStep = (dir) => (dir > 0 ? st.sTarget >= STEP_FROM - 1e-6 : st.sTarget > STEP_FROM + 1e-6);
    const busy = () => !!st.tween || now() < st.lockUntil;
    const moveBy = (ds) => {
      if (!st.ready || st.inHero || st.camMode !== "story" || !ds) return;
      st.auto = false; st.goal = null;
      const next = st.sTarget + ds * SCROLL.speed;
      // 착지 칸에서 멈춤: 관성 스크롤이 그대로 방 재생으로 이어지지 않게 잠깐 잠금 (새로 굴려야 다음 칸)
      if (next >= STEP_FROM) st.lockUntil = now() + STEP.cooldown;
      st.sTarget = Math.max(0, Math.min(STEP_FROM, next));
      st.dir = Math.sign(ds);
      st.inputAt = now();
    };
    // Hero → 1: Home 엔진의 판 자리에서 이어 받고 1 칸으로 미끄러짐 (onHeroLeave)
    //  판은 한 장으로 보이게: Home 판은 바로 숨기고(부르는 쪽), 이 판은 Hero 레이어가 걷히는 동안 그 자리에 머문 뒤 움직임
    st.leaveHero = (pose) => {
      if (!st.ready || !st.inHero) return false;
      if (pose) takeHero(pose);
      st.inHero = false;
      st.s = st.sTarget = 0;
      st.onHero?.(false);
      goStage(1);
      st.goalAt = now() + (st.reduced ? 0 : HERO_HOLD);
      return true;
    };

    // ── 입력 (Hero 에서는 Home 엔진이 받음)
    let wheelAcc = 0, wheelAt = 0;
    const onWheel = (e) => {
      if (st.inHero || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (!px) return;
      if (!inStep(Math.sign(px)) && !st.tween) { wheelAcc = 0; moveBy(Math.max(-SCROLL.maxStep, Math.min(SCROLL.maxStep, px / SCROLL.perStage))); return; }
      // 3D 방: 한 번에 한 칸 (재생·쿨다운 중엔 무시)
      const t = now();
      if (busy()) {
        // 쉬지 않고 이어지는 휠(트랙패드 관성)은 잠금을 조금씩 늘림 → 손을 떼고 다시 굴려야 다음 칸
        if (!st.tween && t - wheelAt < 0.1) st.lockUntil = Math.max(st.lockUntil, t + 0.15);
        wheelAcc = 0; wheelAt = t;
        return;
      }
      if (t - wheelAt > 0.25) wheelAcc = 0;          // 멈췄다 다시 굴리면 새로 셈
      wheelAt = t;
      wheelAcc += px;
      if (Math.abs(wheelAcc) > STEP.threshold) { st.auto = false; stepTo(Math.round(st.sTarget) + Math.sign(wheelAcc)); wheelAcc = 0; }
    };
    let touchY = null, touchY0 = 0, touchStep = false;
    const onTouchStart = (e) => { if (st.inHero) return; touchY = touchY0 = e.touches[0].clientY; touchStep = false; st.touching = true; };
    const onTouchMove = (e) => {
      if (touchY == null) return;
      if (e.cancelable) e.preventDefault();
      const y = e.touches[0].clientY;
      if (touchStep || inStep(Math.sign(touchY - y)) || st.tween) touchStep = true;
      else moveBy((touchY - y) / (innerHeight * SCROLL.touch));
      touchY = y;
    };
    const onTouchEnd = () => {
      const dy = touchY0 - (touchY ?? touchY0);
      if (touchStep && Math.abs(dy) > STEP.touch && !busy()) { st.auto = false; stepTo(Math.round(st.sTarget) + Math.sign(dy)); }
      touchY = null; touchStep = false; st.touching = false; st.inputAt = now();
    };
    const onKey = (e) => {
      if (st.inHero || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const dir = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      if (st.tween || (inStep(dir) && busy())) return;
      st.auto = false; advance(dir);
    };
    // News 위에서도 받도록 페이지 전체(섹션 포함)에서
    const layer = wrapRef.current;
    layer.addEventListener("wheel", onWheel, { passive: false });
    layer.addEventListener("touchstart", onTouchStart, { passive: true });
    layer.addEventListener("touchmove", onTouchMove, { passive: false });
    layer.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);

    // reveal 클립을 시간 t 의 자세로 (LoopOnce 가 끝에서 action 을 멈춰 두므로 매번 깨움)
    const seekClip = (t) => {
      st.action.paused = false; st.action.enabled = true;
      st.action.time = Math.min(Math.max(t, 0), st.clip.duration);
      st.mixer.update(0);
      st.root.updateMatrixWorld(true);
    };
    const clipP = (t) => STORY.build[0] + (t / st.clip.duration) * STORY.build[1];   // 클립 시간 → 진행도

    // ── 로드
    const t0 = performance.now();
    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const loader = new GLTFLoader().setDRACOLoader(draco);
    Promise.all([loader.loadAsync(MODEL_URL), loader.loadAsync(VINYL_URL)]).then(([gltf, vinyl]) => {
      if (st.disposed) return;
      const root = gltf.scene;
      st.root = root;
      scene.add(root);
      const clipNamed = (name) => gltf.animations.find((a) => a.name === name);
      st.clip = clipNamed("reveal") ?? gltf.animations[0];
      st.mixer = new THREE.AnimationMixer(root);
      const once = (clip) => {
        const a = st.mixer.clipAction(clip);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.play();
        return a;
      };
      st.action = once(st.clip);
      // 먼지 덮개: Blender 의 cover_open / cover_close 를 그대로, 실제 시간으로 (한 번에 하나만 켬)
      const lidOpen = clipNamed("cover_open"), lidClose = clipNamed("cover_close");
      if (lidOpen && lidClose) {
        st.lid = { open: once(lidOpen), close: once(lidClose), isOpen: false, t: lidClose.duration };
        st.lid.open.enabled = false;
        st.lid.close.time = lidClose.duration;   // 처음엔 닫힌 자세
      }
      // 앰프 VU 바늘: Blender 의 vu_play 를 그대로, 음악이 도는 동안 실제 시간으로 반복
      const vu = clipNamed("vu_play");
      if (vu) { st.vu = once(vu); st.vu.enabled = false; st.vuT = 0; }
      // 턴테이블이 어둠 아래에서 올라오는 오프셋은 pivot 안쪽 래퍼에 (pivot 은 클립이 움직임)
      const ttPivot = root.getObjectByName("pivot_turntable");
      st.ttRise = new THREE.Object3D();
      for (const c of [...ttPivot.children]) st.ttRise.add(c);
      ttPivot.add(st.ttRise);
      st.seat = root.getObjectByName("Turntable_DiscSeat");
      st.platter = root.getObjectByName("Turntable_Platter");
      st.arm = root.getObjectByName("Turntable_Tonearm");
      st.armBase = st.arm?.rotation.y ?? 0;
      for (const c of gltf.cameras) if (c.isPerspectiveCamera) st.gltfCams[c.name] = c;
      const box = (o) => new THREE.Box3().setFromObject(o);

      // 완성 상태: 방 크기·가운데
      seekClip(st.clip.duration);
      const roomBox = new THREE.Box3();   // 러그는 말린 모양(모프) 때문에 경계가 실제보다 커서 뺌, 방 아래 건물(약 12m)은 구도 계산에서 뺌
      root.traverse((o) => { if (o.isMesh && o.name !== "rug" && !o.name.startsWith("building")) roomBox.union(box(o)); });
      st.roomCenter = roomBox.getCenter(new THREE.Vector3());
      st.roomCenter.y *= 0.8;
      st.roomR = roomBox.getSize(new THREE.Vector3()).length() / 2;
      // 램프 재질은 램프마다 따로 (켜짐 표현). 재질이 여러 개일 수 있음.
      // Blender 에 Emission 이 있으면 그 값을 켜짐 정도만큼, 없는 램프는 갓 전체에 웜톤
      for (const name of ["lamp_floor", "lamp_table", "lamp_window", "lamp_circle"]) {
        const lamp = root.getObjectByName(name);
        if (!lamp) continue;
        const mats = [];
        lamp.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); } });
        const authored = mats.filter((m) => m.emissive.getHex() !== 0);
        st.lampMats.set("pivot_" + name, authored.length
          ? authored.map((m) => ({ m, k: m.emissiveIntensity }))
          : mats.map((m) => { m.emissive = new THREE.Color("#ffc988"); return { m, k: 1.6 }; }));
      }
      // 방 바깥 2.5D 배경: /lab/env-test 에서 확정한 Hybrid 레이어 · 하늘 · 창문 안 남산 (env-layers.json)
      //  레이어 높이는 기준 카메라(B 18°) 화면 기준이라, 방 완성 칸의 카메라도 그 기준 카메라 그대로
      st.rig = computeRig(root, gltf.cameras[0]);
      st.base = makeBase(st.rig, { A: null, B: 18, C: 12 }[LAYER_CFG.camera.preset]);
      st.env = createEnv(st.rig, st.base, LAYER_CFG, root);   // 유리 창·남산·바깥 면 색 포함 (방이 다 지어진 자세에서)
      scene.add(st.env.group, st.env.sky);
      st.env.fade(0);
      // 창가 선반 새 소품(플립 시계 · 지금 듣는 판): 방 GLB 에 없으면 확인용 GLB 를 선반에 얹음
      //  시계는 현재 시각, 분이 바뀌면 판이 넘어감
      const shelfFinal = root.getObjectByName("pivot_bookshelf")?.matrixWorld.clone();
      st.dropShelfTest = addShelfTestProps(root, shelfFinal, () => {
        if (st.disposed) return;
        st.clock = attachFlipClock(root);
        st.onShelfReady?.();
      });

      // 선반 커버: 앞면에 신보 커버를 붙일 판
      for (const n of ["cover_shelf_01", "cover_shelf_02", "cover_shelf_03"]) {
        const mesh = root.getObjectByName(n);
        if (mesh) st.covers.push({ pivot: "pivot_" + n, ...makeCoverFace(mesh, st.roomCenter) });
      }

      // 클립 타이밍에 맞춘 웹 연출: 램프는 놓인 뒤 켜짐, 야경은 창문 벽이 다 선 뒤
      for (const lampPivot of [...st.lampMats.keys(), ...Object.values(LIGHT_PIVOT)]) { const r = nodeRange(st.clip, lampPivot); if (r) st.lampAt.set(lampPivot, clipP(r[1]) + STORY.lampDelay); }
      const win = nodeRange(st.clip, "pivot_wall_window");
      st.night = [win ? clipP(win[1]) : STORY.build[0] + STORY.build[1] * 0.5, STORY.nightDur];
      // 마지막에 놓이는 커버 = 가장 최신 신보 (핸드오프 대상)
      const coverAt = (c) => nodeRange(st.clip, c.pivot)?.[0] ?? 0;
      st.covers.sort((a, b) => coverAt(a) - coverAt(b));
      // New Vinyls 로 갈 때 카메라가 다가갈 커버 (= 핸드오프 대상, 완성된 방에서의 자리·앞면 방향)
      const lead = st.covers[st.covers.length - 1]?.face;
      if (lead) {
        lead.updateMatrixWorld(true);
        st.coverFocus = {
          t: lead.getWorldPosition(new THREE.Vector3()),
          d: new THREE.Vector3(0, 0, 1).transformDirection(lead.matrixWorld).add(new THREE.Vector3(0, 0.2, 0)).normalize(),
          r: lead.geometry.parameters.width * 0.75,
        };
      }

      // 라이트
      root.traverse((o) => {
        if (o.isLight) {
          st.lights.push(o);
          st.baseIntensity.set(o, o.intensity);
          const hp = new THREE.PointLightHelper(o, 0.08); hp.visible = false; scene.add(hp); st.helpers.push(hp);
        }
      });

      // 처음 상태: 턴테이블이 화면 가운데 (pivot_root 가 방을 옮겨 둔 자리)
      seekClip(0);
      st.seat0 = st.seat.getWorldPosition(new THREE.Vector3());
      st.seatNow = st.seat0.clone();
      st.hover = st.seat0.clone().add(new THREE.Vector3(0, 0.42, 0));
      key.position.copy(st.seat0).add(new THREE.Vector3(0.35, 1.3, 0.9));
      key.target.position.copy(st.seat0);
      moon.position.copy(st.roomCenter).add(new THREE.Vector3(-6, 4, 1));
      moon.target.position.copy(st.roomCenter);

      st.disc = makeInkDisc(vinyl.scene);
      scene.add(st.disc.root);

      st.ready = true;
      resize();
      // 미리 데우기: 처음 보이는 순간의 셰이더 컴파일·텍스처 업로드가 스크롤 중 끊김이 되지 않게 Hero 동안 끝내 둠
      //  (숨겨 둔 것도 잠깐 보이게 해서 같이 컴파일. 배경 이미지는 늦게 붙어 재질이 바뀌니 다 붙은 뒤 한 번 더)
      const prewarm = () => {
        if (st.disposed) return;
        const hidden = [st.env.group, st.env.sky, st.ttRise].filter((o) => o && !o.visible);
        for (const o of hidden) o.visible = true;
        scene.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            for (const k of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap"]) if (m?.[k]) renderer.initTexture(m[k]);
        });
        renderer.compileAsync(scene, storyCam).catch(() => {});   // 그릴 목록은 부르는 순간 모음 → 바로 되돌려도 됨
        for (const o of hidden) o.visible = false;                 // (apply 가 매 프레임 진행도대로 다시 정함)
      };
      prewarm();
      st.env.ready.then(prewarm);
      setInfo({
        loadMs: Math.round(performance.now() - t0),
        size: roomBox.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(" × "),
        clip: `${st.clip.name} · ${st.clip.duration.toFixed(2)}s`,
        cams: Object.keys(st.gltfCams),
      });
    }).catch((e) => setError(String(e?.message || e)));

    // ── 카메라: 진행도 구간별 키 (목표점 · 방향 · 거리)
    const fit = (r, fov = FOV0) => {
      const vf = THREE.MathUtils.degToRad(fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * storyCam.aspect);
      return r / Math.sin(Math.min(vf, hf) / 2);
    };
    // 방 완성 구도 = 배경 기준 카메라. 화면이 16:9 보다 좁으면 방이 잘리지 않게 그만큼 물러남
    const roomKey = (p) => ({ p, t: st.rig.target, d: new THREE.Vector3().setFromSpherical(st.base.sph).normalize(),
      r: st.base.sph.radius * Math.max(1, ASPECT / storyCam.aspect), f: st.rig.fov });
    const heroDir = new THREE.Vector3(0, 0.3, 1).normalize();
    const darkDir = new THREE.Vector3(0.05, 0.42, 1).normalize();
    const landDir = new THREE.Vector3(0.15, 0.6, 1).normalize();
    const midDir = new THREE.Vector3(0.35, 0.75, 1).normalize();
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const camKeys = () => [
      { p: 0, t: st.hover, d: heroDir, r: fit(0.2) },
      { p: STORY.heroEnd, t: st.hover, d: heroDir, r: fit(0.2) },
      { p: STORY.dark[0] + STORY.dark[1], t: st.hover, d: darkDir, r: fit(0.6) },
      { p: 0.27, t: st.seat0.clone().add(v3(0, 0.2, 0)), d: darkDir, r: fit(0.55) },
      // 착지 뒤에는 지금 판 자리를 따라감 (콘솔이 턴테이블을 들어 올리고, 방이 옆으로 옮겨 감)
      { p: STORY.land[0] + STORY.land[1], t: st.seatNow.clone().add(v3(0, 0.05, 0)), d: landDir, r: fit(0.42) },
      // 착지 직후부터 빠지기 시작: 바닥이 펼쳐지고 벽이 서는 걸 한눈에
      { p: 0.47, t: st.seatNow.clone().lerp(st.roomCenter, 0.35), d: midDir, r: fit(st.roomR * 0.6) },
      roomKey(STORY.camFinal),
      roomKey(STORY.roomHold),
      // New Vinyls: 선반의 가장 최신 커버 앞으로 다가감 → 화면에서 커진 커버가 그대로 New Vinyls 첫 칸으로
      ...(st.coverFocus ? [
        { p: STAGE_P[4], t: st.coverFocus.t, d: st.coverFocus.d, r: fit(st.coverFocus.r) },
        { p: 1, t: st.coverFocus.t, d: st.coverFocus.d, r: fit(st.coverFocus.r) },
      ] : [roomKey(1)]),
    ];
    // 키 사이를 단조 Hermite 곡선으로 (키마다 멈칫하지 않게 속도가 이어짐, 머무는 키에서는 넘치지 않음)
    const _t = new THREE.Vector3(), _d = new THREE.Vector3();
    const placeStoryCam = (p) => {
      const keys = camKeys();
      const V = keys.map((k) => [k.t.x, k.t.y, k.t.z, k.d.x, k.d.y, k.d.z, Math.log(k.r), k.f ?? FOV0]);
      const P = keys.map((k) => k.p), n = keys.length;
      let i = 0; while (i < n - 2 && p > P[i + 1]) i++;
      const h = P[i + 1] - P[i] || 1, u = clamp01((p - P[i]) / h);
      const tangent = (j, c) => {
        if (j <= 0 || j >= n - 1) return 0;
        const a = V[j][c] - V[j - 1][c], b = V[j + 1][c] - V[j][c];
        if (a * b <= 0) return 0;   // 머무는 키·꺾이는 키에서는 0 → 넘치지 않음
        return ((V[j + 1][c] - V[j - 1][c]) / (P[j + 1] - P[j - 1])) * h;
      };
      const u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      const out = V[i].map((v0, c) => h00 * v0 + h10 * tangent(i, c) + h01 * V[i + 1][c] + h11 * tangent(i + 1, c));
      _t.set(out[0], out[1], out[2]);
      _d.set(out[3], out[4], out[5]).normalize();
      storyCam.position.copy(_t).addScaledVector(_d, Math.exp(out[6]));
      storyCam.lookAt(_t);
      if (Math.abs(storyCam.fov - out[7]) > 1e-4) { storyCam.fov = out[7]; storyCam.updateProjectionMatrix(); }
    };
    // 방 완성 칸: 마우스를 따라 방 가운데를 조금 돎 (env-test 와 같은 궤도 시차, 세기는 env-layers.json) → 배경 레이어가 깊이대로 밀림
    const _sph = new THREE.Spherical(), _off = new THREE.Vector3();
    const { yawDeg, pitchDeg, amount } = LAYER_CFG.camera.parallax;
    const orbitByPointer = (p, dt) => {
      st.ptrS.lerp(st.ptr, 1 - Math.exp(-dt * 4));
      const k = easeInOut(seg(p, [STORY.camFinal - 0.04, 0.04])) * (1 - seg(p, [STORY.roomHold, 0.03]));
      if (!st.env || st.reduced || k <= 0) return;
      _sph.setFromVector3(_off.copy(storyCam.position).sub(_t));
      _sph.theta += st.ptrS.x * yawDeg * amount * k * D2R;
      _sph.phi -= st.ptrS.y * pitchDeg * amount * k * D2R;
      storyCam.position.setFromSpherical(_sph).add(_t);
      storyCam.lookAt(_t);
    };
    const onPointer = (e) => st.ptr.set((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
    window.addEventListener("pointermove", onPointer);

    // Home 엔진의 판(직교 카메라 화면 위 자세)을 이 장면의 P=0 카메라 앞 같은 화면 자리·크기·기울기로
    const takeHero = (pose) => {
      placeStoryCam(0);
      storyCam.updateMatrixWorld();
      const r = renderer.domElement.getBoundingClientRect();
      if (!r.height || !pose.radius) return;   // 캔버스가 아직 크기가 없으면 기본 Hero 자세로 (0/0 → 판 위치 NaN 방지)
      const tanH = Math.tan(THREE.MathUtils.degToRad(storyCam.fov / 2));
      const D = DISC_R * (r.height / 2) / (tanH * pose.radius);   // 반지름 px 이 같아지는 거리
      const unit = (D * tanH) / (r.height / 2);                   // 그 거리에서 1px = unit m
      const dx = pose.rect.left + pose.rect.width / 2 + pose.x - (r.left + r.width / 2);
      const dy = pose.rect.top + pose.rect.height / 2 - pose.y - (r.top + r.height / 2);
      const q = storyCam.quaternion;
      st.heroPos = storyCam.position.clone()
        .addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(q), D)
        .addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(q), dx * unit)
        .addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(q), -dy * unit);
      st.heroQuat = q.clone().multiply(pose.quat);
      // 판 루트는 아랫면 기준, Home 은 가운데 기준 → 판 축 방향으로 그만큼 내림
      st.heroPos.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(st.heroQuat), inkDefaults.botY * 1.8 * DISC_R);
      // 바탕: Home 과 같은 테마 값 (다크 모드면 크림 ↔ 잉크가 바뀌어 있음)
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--cream").trim();
      st.heroBg = bg ? new THREE.Color(bg) : CREAM.clone();
      st.themeCream = st.heroBg.clone();
      st.heroInk = new THREE.Color(pose.ink.x, pose.ink.y, pose.ink.z);
      st.heroLabel = new THREE.Color(pose.label.x, pose.label.y, pose.label.z);
      st.ownSpin = 0;   // Home 의 회전각은 heroQuat 에 들어 있음
      st.ownVel = pose.omega != null ? -pose.omega : RPM(10);   // Home 은 +omega 로, 이 판은 -ownVel 로 돎 → 같은 속도로 이어서
    };

    // ── 진행도 → 장면
    const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _yaw = new THREE.Quaternion(), _p = new THREE.Vector3();
    const _inv = new THREE.Matrix4(), _view = new THREE.Vector3(), _flat = new THREE.Vector3(), _major = new THREE.Vector3(), _half = new THREE.Vector3(), _light = new THREE.Vector3();
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.0);
    const UP = new THREE.Vector3(0, 1, 0);
    const apply = (p, dt, time) => {
      // 방: Blender reveal 클립을 그대로 (진행도 → 클립 시간, 선형)
      // 턴테이블: 어둠 아래에서 올라옴 (클립 시작 전, 웹 연출)
      const rise = easeInOut(seg(p, STORY.ttRise));
      st.ttRise.position.y = -(1 - rise) * 0.35;
      st.ttRise.visible = rise > 0;
      // 먼지 덮개: 판이 내려앉기 전에 열림(cover_open), 되돌아가며 지나면 닫힘(cover_close) — 지나는 순간 실제 시간으로 재생
      const lid = st.lid;
      if (lid) {
        const wantOpen = p >= STORY.lidAt;
        if (wantOpen !== lid.isOpen) { lid.isOpen = wantOpen; lid.t = 0; }
        const cur = lid.isOpen ? lid.open : lid.close, other = lid.isOpen ? lid.close : lid.open;
        lid.t = st.reduced ? cur.getClip().duration : lid.t + dt;
        other.enabled = false;
        cur.enabled = true; cur.paused = false;
        cur.time = Math.min(lid.t, cur.getClip().duration);
      }
      // VU 바늘: 33⅓ 이 돌기 시작하면 재생, 되돌아가면 제자리 (모션 줄이기면 멈춤)
      if (st.vu) {
        const on = p >= STORY.spinAt && !st.reduced;
        st.vu.enabled = on;
        if (on) { st.vu.paused = false; st.vuT = (st.vuT + dt) % st.vu.getClip().duration; st.vu.time = st.vuT; }
      }
      seekClip(seg(p, STORY.build) * st.clip.duration);   // mixer.update(0) 이 덮개·VU action 도 같이 적용

      // 플래터 33⅓ · 톤암
      const spinning = p >= STORY.spinAt;
      st.platterVel += ((spinning && !st.reduced ? RPM(100 / 3) : 0) - st.platterVel) * (1 - Math.exp(-dt * 1.2));
      if (st.platter) st.platter.rotation.y -= st.platterVel * dt;
      if (st.arm) st.arm.rotation.y = st.armBase + ARM_SWING * easeInOut(seg(p, [STORY.spinAt, STORY.armDur]));
      st.root.updateMatrixWorld(true);

      // 판: 떠서 돌다가(10 RPM) 멈추며 플래터에 앉음 → 이후 플래터와 같이 돎
      const lk = easeInOut(seg(p, STORY.land));
      st.ownVel += ((st.reduced ? 0 : RPM(10) * (1 - lk)) - st.ownVel) * (1 - Math.exp(-dt * 1.5));   // Hero 에서 빨리 돌던 판도 1초 남짓에 걸쳐 10 RPM 으로
      st.ownSpin -= st.ownVel * dt;
      st.seat.getWorldPosition(_p);
      st.seat.getWorldQuaternion(_q2);
      st.seatNow.copy(_p);
      const { root: dr, uniforms, baseMat, ref } = st.disc;
      dr.position.lerpVectors(st.heroPos ?? st.hover, _p, lk);
      if (lk < 1 && !st.reduced) dr.position.y += Math.sin(time * 1.1) * 0.008 * (1 - lk);
      _yaw.setFromAxisAngle(UP, st.ownSpin);
      dr.quaternion.copy(_q.copy(st.heroQuat ?? tilt).slerp(_q2, lk)).multiply(_yaw);
      dr.updateMatrixWorld(true);

      // 바탕이 검게 → 잉크 선은 크림색으로
      const dk = easeInOut(seg(p, STORY.dark));
      scene.background.copy(st.heroBg ?? CREAM).lerp(NIGHT, dk);
      uniforms.uInk.value.set(...new THREE.Color().copy(st.heroInk ?? INK_ON_CREAM).lerp(INK_ON_NIGHT, dk).toArray());
      uniforms.uLabel.value.set(...new THREE.Color().copy(st.heroLabel ?? LABEL_ON_CREAM).lerp(LABEL_ON_NIGHT, dk).toArray());
      baseMat.opacity = easeInOut(seg(p, [STORY.land[0] + 0.03, 0.08]));
      // 잉크 빛줄기: 카메라 쪽으로 비끼는 빛 (앨범 상세와 같은 계산을 판 로컬에서)
      const cam = st.camMode === "story" ? storyCam : st.camMode === "orbit" ? orbitCam : st.gltfCams[st.camMode] ?? storyCam;
      _inv.copy(ref.matrixWorld).invert();
      const camL = cam.position.clone().applyMatrix4(_inv);
      _view.copy(camL).normalize();
      _flat.set(_view.x, 0, _view.z); if (_flat.lengthSq() < 1e-6) _flat.set(0, 0, 1); _flat.normalize();
      _major.set(-_flat.z, 0, _flat.x);
      _half.copy(_major).multiplyScalar(0.45); _half.y = 1; _half.normalize();
      _light.copy(_half).multiplyScalar(2 * _half.dot(_view)).sub(_view).normalize();
      if (_light.y < 0.3) { _light.y = 0.3; _light.normalize(); }
      uniforms.uCamLocal.value.copy(camL);
      uniforms.uLightLocal.value.copy(_light);

      // 빛: 어둠 속 턴테이블만 → 방이 생기며 밤 주변광 → 램프 하나씩 → 창밖 야경
      key.intensity = 3.2 * rise * (1 - 0.8 * easeInOut(seg(p, [0.38, 0.12])));
      const rk = easeInOut(seg(p, STORY.room));
      const nk = easeInOut(seg(p, st.night));
      const ek = easeInOut(seg(p, ENV_IN));
      st.env.night(nk);                                   // 창문 안 남산: 창문 벽이 다 선 뒤 밝아짐
      st.env.fade(ek);                                    // 바깥 배경: 방 완성 구도로 다가가며
      // 밤 주변광·창 쪽 달빛 → 바깥 배경이 나타나며 노을 조명으로 (env-layers.json 의 light)
      hemi.color.copy(HEMI_SKY).lerp(DUSK.hemiSky, ek);
      hemi.groundColor.copy(HEMI_GROUND).lerp(DUSK.hemiGround, ek);
      hemi.intensity = rk * THREE.MathUtils.lerp(1.0, DUSK.hemiIntensity, ek);
      moon.color.copy(MOON).lerp(DUSK.sunColor, ek);
      moon.intensity = nk * THREE.MathUtils.lerp(0.7, DUSK.sunIntensity, ek);
      for (const l of st.lights) {
        const pivot = LIGHT_PIVOT[l.name] ?? "pivot_" + l.name.replace(/^light_/, "");
        const on = easeInOut(seg(p, [st.lampAt.get(pivot) ?? 2, STORY.lampDur]));
        l.intensity = st.baseIntensity.get(l) * st.lightMul * on;
        for (const { m, k } of st.lampMats.get(pivot) ?? []) m.emissiveIntensity = on * k;
      }

      // 선반 커버: 핸드오프 중이면 마지막 커버는 DOM 이 대신 보여 줌
      st.covers.forEach((c, i) => {
        c.face.visible = !(st.hideLastCover && i === st.covers.length - 1);
        c.mat.emissiveIntensity = c.mat.map ? 0.35 : 0;
      });
    };

    // 마지막 커버의 화면 사각형 (DOM 핸드오프용)
    st.coverRect = () => {
      const face = st.covers[st.covers.length - 1]?.face;
      if (!face) return null;
      const cam = st.camMode === "story" ? storyCam : st.camMode === "orbit" ? orbitCam : st.gltfCams[st.camMode];
      const half = face.geometry.parameters.width / 2;
      const r = renderer.domElement.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const v = new THREE.Vector3(sx * half, sy * half, 0).applyMatrix4(face.matrixWorld).project(cam);
        const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    };

    const clock = new THREE.Clock();
    let acc = 0, frames = 0, hudAt = 0;
    const tick = () => {
      st.raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1);
      frame(dt, clock.elapsedTime);
    };
    // 한 프레임 (콘솔에서 st.frame(0.016, t) 로 직접 그려 볼 수 있음 — 탭이 백그라운드일 때 확인용)
    const frame = (dt, time) => {
      if (st.ready) {
        if (!st.inHero && st.tween) {
          // 3D 방: 한 칸을 시간으로 재생 (화면이 바로 따라감)
          const tw = st.tween;
          const k = clamp01((now() - tw.start) / tw.dur);
          st.s = st.sTarget = tw.from + (tw.to - tw.from) * (tw.linear ? k : easeInOut(k));
          st.p = sToP(st.s);
          st.stage = Math.round(st.s);
          if (k >= 1) {
            st.tween = null;
            st.lockUntil = now() + STEP.cooldown;   // 관성 스크롤 흡수
            if (st.auto && st.sTarget < LAST) advance(1); else st.auto = false;
          }
        } else if (!st.inHero) {
          // 입력이 멈추면 가까운 칸 (진행 방향으로 bias 넘게 갔으면 다음 칸)
          const t = now();
          if (st.goal == null && !st.touching && t - st.inputAt > SCROLL.idle) {
            const base = Math.floor(st.sTarget), f = st.sTarget - base;
            if (f > 1e-4) st.goal = st.dir > 0 ? (f > SCROLL.bias ? base + 1 : base) : (f < 1 - SCROLL.bias ? base : base + 1);
          }
          // 칸으로 미끄러짐: 지나는 칸의 길이만큼의 속도 × speed (Hero 를 막 이어 받았으면 잠깐 그 자리에)
          if (st.goal != null && t >= (st.goalAt ?? 0)) {
            const d = st.goal - st.sTarget;
            const i = Math.max(0, Math.min(LAST - 1, d > 0 ? Math.floor(st.sTarget) : Math.ceil(st.sTarget) - 1));
            const stepS = st.reduced ? Infinity : (dt * SCROLL.speed) / segDur(i);
            if (Math.abs(d) <= stepS) {
              st.sTarget = st.goal; st.goal = null;
              if (st.sTarget === STEP_FROM) st.lockUntil = now() + STEP.cooldown;   // 착지에 붙은 직후 관성으로 방이 시작되지 않게
              if (st.auto && st.sTarget < LAST) advance(1); else st.auto = false;
            } else st.sTarget += Math.sign(d) * stepS;
          }
          st.s = st.reduced ? st.sTarget : st.s + (st.sTarget - st.s) * (1 - Math.exp(-dt * SCROLL.follow));
          if (Math.abs(st.sTarget - st.s) < 1e-4) st.s = st.sTarget;
          st.p = sToP(st.s);
          st.stage = Math.round(st.s);
          // 0 칸에 멈추면 Hero(Home 엔진)에 다시 넘김
          if (st.s === 0 && st.sTarget === 0 && st.goal == null && !st.touching && t - st.inputAt > SCROLL.idle) {
            st.inHero = true;
            st.onHero?.(true);
          }
        }
        st.clock?.update(dt);
        apply(st.p, dt, time);   // 판 빛줄기는 직전 프레임 카메라 기준 (한 프레임 차이라 보이지 않음)
        placeStoryCam(st.p);
        orbitByPointer(st.p, dt);
        storyCam.updateMatrixWorld();
        // 섹션: 열림/닫힘 문턱 사이에서는 지금 섹션 유지
        const s = st.section;
        let want;
        if (st.p >= STORY.news[0]) want = 2;
        else if (st.p >= STORY.nv[0]) want = s === 2 && st.p > STORY.news[1] ? 2 : 1;
        else if (st.p > STORY.nv[1]) want = s === 0 ? 0 : 1;
        else want = 0;
        // 되돌아가는 중에는 가는 칸 기준으로 바로 닫음 (화면이 아직 움직이기 전에 DOM 이 먼저 물러남)
        if (st.tween && st.tween.to < st.tween.from) want = Math.min(want, st.tween.to >= 5 ? 2 : st.tween.to === 4 ? 1 : 0);
        if (want !== st.section) { const prev = st.section; st.section = want; st.onSection?.(want, prev); }
      }
      controls.enabled = st.camMode === "orbit";
      if (controls.enabled) controls.update();
      const cam = st.camMode === "story" ? storyCam : st.camMode === "orbit" ? orbitCam : st.gltfCams[st.camMode] ?? storyCam;
      // Hero 동안은 Home 엔진 레이어가 이 캔버스를 다 덮음 → 그리지 않음 (GPU 를 Home 판에 양보)
      if (!st.inHero || !st.ready) renderer.render(scene, cam);
      acc += dt; frames++;
      if (acc > 0.5) {
        const fps = frames / acc;
        setStats({ fps: Math.round(fps), calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
        // 느린 구간이 두 번 이어지면 해상도를 한 단계 낮춤 (한 번 끊긴 건 무시, 다시 올리지는 않음 = 오르내림 반복 방지)
        st.slow = st.ready && st.inHero === false && fps < DPR_SLOW_FPS ? (st.slow ?? 0) + 1 : 0;   // 인트로·Hero 동안의 느림은 3D 탓이 아님
        const pr = renderer.getPixelRatio();
        if (st.slow >= 2 && pr > DPR_MIN) { renderer.setPixelRatio(Math.max(DPR_MIN, pr - 0.25)); resize(); st.slow = 0; }
        acc = 0; frames = 0;
      }
      syncHeader();
      if (time - hudAt > 0.08) {
        hudAt = time;
        const stage = [...STAGES].reverse().find(([a]) => st.p >= a)?.[1];
        setHud((h) => (Math.abs(h.p - st.p) < 0.001 && h.stage === stage ? h : { p: st.p, stage }));
      }
    };
    st.frame = frame;
    tick();

    return () => {
      st.disposed = true;
      st.dropShelfTest?.();
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      layer.removeEventListener("wheel", onWheel);
      layer.removeEventListener("touchstart", onTouchStart);
      layer.removeEventListener("touchmove", onTouchMove);
      layer.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      controls.dispose();
      draco.dispose();
      // 방·판·커버의 지오메트리·재질·텍스처 해제 (페이지를 오가도 GPU 메모리가 쌓이지 않게)
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          if (!m) continue;
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (window.__room === st) delete window.__room;
      ctPage?.style.removeProperty("--ct-header-fg");
      ctPage?.style.removeProperty("--ct-drop-bg");
    };
  }, []);

  // 신보 7장 (선반에는 오래된 것부터 놓여서 마지막 커버 = 가장 최신)
  useEffect(() => {
    let cancelled = false;
    fetchRecentVinyls(createClient()).then((rows) => {
      if (cancelled) return;
      setAlbums(rows.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist_names || "", image: coverUrl(a.cover_path || a.thumb_path), color: a.cover_color || "#bbcbda" })));
    }).catch((e) => console.error("New vinyls could not load", e));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const st = apiRef.current;
    if (!st || !info || !albums.length) return;
    const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
    st.covers.forEach(({ mat }, i) => {
      const a = albums[st.covers.length - 1 - i];
      if (!a) return;
      mat.color.set(a.color);
      loader.load(a.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex; mat.emissiveMap = tex; mat.color.set("#ffffff"); mat.needsUpdate = true;
      });
    });
    // 창가 선반 "지금 듣는 판" 재킷: 벽 선반에 없는 앨범 중 무작위 (페이지를 열 때마다 바뀜)
    st.nowPlaying = applyNowPlaying(st.root, albums, st.covers.length);
  }, [albums, info, shelfReady]);

  // 섹션 전환 · 핸드오프 (3D 마지막 커버 자리 ↔ New Vinyls 첫 칸)
  useEffect(() => {
    const st = apiRef.current; if (!st) return;
    const slotRect = () => {
      const r = slotRef.current?.getBoundingClientRect();
      return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    };
    // 시작 자리에 놓고 → 두 프레임 뒤 목적지로 (트랜지션이 걸리도록). 빠르게 오가면 지난 비행은 무시
    let flight = 0, landed = 0, timer = 0;
    const land = (closing) => {
      landed = flight;
      if (closing) { setFlyer(null); st.hideLastCover = false; }
      else setFlyer((f) => (f ? { ...f, landed: true } : f));
    };
    const fly = (from, to, closing) => {
      const id = ++flight;
      clearTimeout(timer);
      if (!from || !to || st.reduced) { if (closing) land(true); else setFlyer({ landed: true }); return; }
      setFlyer({ rect: from, animate: false, closing });
      requestAnimationFrame(() => requestAnimationFrame(() => { if (id === flight && landed !== id) setFlyer({ rect: to, animate: true, closing }); }));
      timer = setTimeout(() => { if (id === flight) land(closing); }, 1000);   // 트랜지션 0.9s
    };
    st.onSection = (next, prev) => {
      setSection(next);
      if (prev === 0 && next >= 1) { st.hideLastCover = true; fly(st.coverRect(), slotRect(), false); }
      else if (next === 0 && prev >= 1) fly(slotRect(), st.coverRect(), true);
    };
  }, []);
  useEffect(() => {
    const st = apiRef.current; if (!st) return;
    if (camName === "orbit" && st.camMode !== "orbit") {
      st.orbitCam.position.copy(st.storyCam.position);
      st.controls.target.copy(st.roomCenter ?? new THREE.Vector3());
    }
    st.camMode = camName;
  }, [camName]);
  useEffect(() => { const st = apiRef.current; if (st) st.lightMul = Math.pow(10, lightScale); }, [lightScale]);
  useEffect(() => { const st = apiRef.current; if (st) st.renderer.toneMappingExposure = exposure; }, [exposure]);
  useEffect(() => { const st = apiRef.current; if (st) for (const h of st.helpers) h.visible = helpers; }, [helpers, info]);

  // Hero(Home 엔진) ↔ 3D: 떠날 때 판 자세를 넘기고 레이어를 걷어 냄, 돌아오면 다시 덮음
  useEffect(() => {
    const st = apiRef.current; if (!st) return;
    st.onHero = (on) => setHeroOn(on);
    st.onShelfReady = () => setShelfReady((n) => n + 1);
  }, []);
  const leaveHero = () => {
    const home = homeRef.current;
    if (apiRef.current?.leaveHero(home?.heroPose?.())) home?.setDiscHidden?.(true);   // 이어 받았으면 Home 판은 바로 숨김 (두 장 겹쳐 보이지 않게)
  };
  // Hero 가 가려진 동안 Home 엔진은 그리지 않음 (레이어가 다 사라진 뒤 멈추고, 돌아올 땐 바로 다시)
  useEffect(() => {
    const engine = homeRef.current;
    if (!engine?.setPaused) return;
    if (heroOn) { engine.setPaused(false); engine.setDiscHidden?.(false); return; }
    const t = setTimeout(() => engine.setPaused(true), reduced ? 0 : 550);
    return () => clearTimeout(t);
  }, [heroOn, reduced]);

  // New Vinyls 커버 → 앨범 상세 (사이트의 커버 이동 전환, 없으면 일반 링크)
  const transition = useAlbumTransition();
  const openAlbum = (e, a) => {
    if (!transition || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    transition.openAlbum({ slug: a.slug, color: a.color, imageUrl: a.image, source: e.currentTarget.querySelector("img") });
  };

  // 디버그: 슬라이더는 진행도를 바로 (가장 가까운 아래 칸으로), Auto 는 끝까지 한 칸씩
  const setP = (p) => {
    const st = apiRef.current; if (!st) return;
    st.auto = false; st.goal = null; st.tween = null; st.p = p;
    st.s = st.sTarget = pToS(p);
    st.inHero = p === 0;
    setHeroOn(p === 0);
  };
  // 캡처·확인용 주소: ?p=0.76 이면 로드 뒤 그 진행도에서 시작, ?panel=0 이면 디버그 패널 접음
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("panel") === "0") setPanel(false);
    const p = Number(q.get("p"));
    if (info && p > 0) setP(p);
  }, [info]);   // eslint-disable-line react-hooks/exhaustive-deps
  const autoPlay = () => {
    const st = apiRef.current; if (!st) return;
    st.auto = true;
    if (st.inHero) leaveHero();
    else if (st.sTarget >= STAGE_P.length - 1) { setP(0); }
    else if (!st.tween) st.advance(1);
  };

  const lead = albums[0];
  const ease = "cubic-bezier(.22,1,.36,1)";
  return (
    <div ref={wrapRef} data-header-see-through className="relative h-svh w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0 touch-none" />

      {/* Hero: 실제 Home 스테이지 그대로 (판 효과·제목·커서 전부). 아래로 가면 3D 장면이 같은 자리에서 이어 받음 */}
      <div className={`page home paper-textured absolute! inset-0 ${reduced ? "" : "transition-opacity duration-500"}`} inert={!heroOn}
        style={{ overflow: "hidden", opacity: heroOn ? 1 : 0, pointerEvents: heroOn ? "auto" : "none" }}>
        <div className="page-content">
          <HomeStage onHeroLeave={leaveHero} onEngine={(e) => { homeRef.current = e; if (apiRef.current) apiRef.current.home = e; }} />
        </div>
      </div>

      {/* 진행 막대 */}
      <div className="pointer-events-none absolute right-5 top-1/2 h-[46svh] w-px -translate-y-1/2 bg-[#bbcbda]/60">
        <div className="absolute left-0 top-0 w-px bg-[var(--accent)]" style={{ height: `${hud.p * 100}%` }} />
        {STAGES.map(([a, label]) => (
          <div key={a} className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[10px] text-[#8c8590]" style={{ top: `${a * 100}%`, opacity: hud.stage === label ? 1 : 0.45 }}>{label}</div>
        ))}
      </div>

      {/* New Vinyls (핸드오프 목적지) */}
      <section className="absolute inset-0 flex flex-col justify-center bg-(--cream) px-[8vw] text-(--ink)"
        style={{ opacity: section >= 1 ? 1 : 0, transform: section === 2 ? "translateY(-100%)" : "none", pointerEvents: section === 1 ? "auto" : "none", transition: reduced ? "none" : `opacity .7s ${ease}, transform .9s ${ease}` }}>
        <h2 className={`${MONOTON} text-[clamp(2.5rem,7vw,6rem)]`}>New Vinyls</h2>
        <p className="mt-2 opacity-70">상자에 새로 들어온 판 일곱 장</p>
        <div className="mt-8 flex gap-4 overflow-x-auto pb-2">
          {albums.map((a, i) => (
            // 누르면 사이트의 커버 이동 전환으로 앨범 상세 (Digging·Collection 과 같은 방식)
            <a key={a.slug} href={`/album/${encodeURIComponent(a.slug)}`} onClick={(e) => openAlbum(e, a)}
              aria-label={`${a.title} — ${a.artist}`} className="group block w-[min(26vw,220px)] shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={i === 0 ? slotRef : undefined}
                src={a.image} alt="" className="h-[min(26vw,220px)] w-full object-cover shadow-[0_8px_24px_rgba(76,64,74,.18)] transition-[opacity,scale] duration-500 group-hover:scale-[1.03]"
                style={{ opacity: i === 0 ? (flyer?.landed ? 1 : 0) : section >= 1 ? 1 : 0, transitionDelay: i === 0 || reduced ? "0ms" : `${300 + i * 70}ms` }}
              />
              <span className="mt-2 block text-xs">
                <span className="block truncate">{a.title}</span>
                <span className="block truncate opacity-60">{a.artist}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* News */}
      <section className="absolute inset-0 flex flex-col justify-center bg-(--cream) px-[8vw] text-(--ink)"
        style={{ transform: section === 2 ? "none" : "translateY(100%)", pointerEvents: section === 2 ? "auto" : "none", transition: reduced ? "none" : `transform .9s ${ease}` }}>
        <h2 className={`${MONOTON} text-[clamp(2.5rem,7vw,6rem)]`}>News</h2>
        <p className="mt-2 opacity-70">판 밖의 이야기</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {POSTS.map((post, i) => (
            <Link key={post.slug} href={`/news/${post.slug}`} className="group block transition-[opacity,translate] duration-700"
              style={{ opacity: section === 2 ? 1 : 0, translate: section === 2 ? "0 0" : "0 24px", transitionDelay: reduced ? "0ms" : `${250 + i * 90}ms` }}>
              <StoryCover name={post.cover} className="aspect-square max-h-[38svh] rounded-sm" />
              <p className="mt-3 text-xs uppercase tracking-[0.16em] opacity-60">{post.category}</p>
              <h3 className="mt-1 text-lg leading-snug [word-break:keep-all]">{post.title}</h3>
            </Link>
          ))}
        </div>
      </section>

      {flyer?.rect && lead && !flyer.landed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lead.image} alt=""
          className="pointer-events-none fixed z-10 object-cover shadow-[0_8px_24px_rgba(76,64,74,.18)]"
          style={{ ...flyer.rect, transition: flyer.animate ? `left .9s ${ease}, top .9s ${ease}, width .9s ${ease}, height .9s ${ease}` : "none" }}
        />
      )}

      {/* 디버그 패널 */}
      <div className="absolute left-4 top-20 z-20 w-72 rounded-lg bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-white">
        <button className="text-xs font-bold" onClick={() => setPanel((v) => !v)}>Room Test {panel ? "▾" : "▸"}</button>
        {panel && (
          <div className="mt-2 max-h-[calc(100svh-10rem)] overflow-auto">
            {error && <div className="text-red-300">로드 실패: {error}</div>}
            {!info && !error && <div>불러오는 중…</div>}
            {info && (
              <>
                <div>load {info.loadMs}ms · {stats.fps} fps · calls {stats.calls} · tris {stats.tris.toLocaleString()}</div>
                <div>room {info.size} m</div>
                <div className="mt-1 opacity-70">clip {info.clip} → P {STORY.build[0] * 100}–{(STORY.build[0] + STORY.build[1]) * 100}% (Blender 그대로)</div>
              </>
            )}
            <div className="mt-3 border-t border-white/20 pt-2">
              <div>P {(hud.p * 100).toFixed(1)}% · {hud.stage}</div>
              <input type="range" min={0} max={1} step={0.001} value={hud.p} onChange={(e) => setP(+e.target.value)} className="w-full" />
              <div className="mt-1 flex gap-2">
                <button className="rounded bg-white/15 px-2 py-0.5" onClick={autoPlay}>Auto</button>
                <button className="rounded bg-white/15 px-2 py-0.5" onClick={() => setP(0)}>Reset</button>
              </div>
            </div>
            <div className="mt-3 border-t border-white/20 pt-2">
              <div className="mb-1">camera</div>
              <select value={camName} onChange={(e) => setCamName(e.target.value)} className="w-full rounded bg-white/15 px-1 py-0.5">
                <option value="story">story (스크롤)</option>
                <option value="orbit">orbit (마우스로 돌리기)</option>
                {info?.cams.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mt-3 border-t border-white/20 pt-2">
              <div>light ×{Math.pow(10, lightScale).toPrecision(2)}</div>
              <input type="range" min={-2} max={1} step={0.05} value={lightScale} onChange={(e) => setLightScale(+e.target.value)} className="w-full" />
              <div>exposure {exposure.toFixed(2)}</div>
              <input type="range" min={0.1} max={3} step={0.05} value={exposure} onChange={(e) => setExposure(+e.target.value)} className="w-full" />
              <label><input type="checkbox" checked={helpers} onChange={(e) => setHelpers(e.target.checked)} /> light helpers</label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
