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
import { getRecentVinyls } from "@/lib/recent-vinyls";
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
import { addShelfTestProps, applyNowPlaying, predecode } from "./shelfTestProps";
import { applyLightmaps, setLightmapState } from "./lightmaps";
import { createPost } from "./post";
import { createRoomSound } from "./roomSound";
import { markHomeReady } from "@/lib/homeReady";
import { isPageSettled } from "@/lib/motion";
import HomeSections from "./HomeSections";
import CursorWeight, { CW_FONT } from "@/components/motion/CursorWeight";
import { createInkWipe, WIPE, WIPE_BAND, SLEEVE } from "./inkWipe";
import usePageLenis from "@/components/layout/usePageLenis";
import { useIntro } from "@/components/intro/intro-context";
import { createInkHero, INK_HERO, HERO_HOLD, HS } from "./inkHero";
import { createSleeveHero, makeSleeveDisc, SLEEVE_HERO } from "./sleeveHero";
import { applyTurntableLook } from "./turntableLook";
import { createRoomMusic } from "./roomMusic";
import { setupRoomProps } from "./roomProps";
import { useRouter } from "next/navigation";
import { makeEnvironment, drawLabel } from "./sleeveParts";

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
  // 가운데 아래 턴테이블이 올라옴. 바탕이 어두워지는 동안 같이 (예전 [0.15, 0.10]: 화면이 다 검어진 뒤에야 나와서
  //  "어두워짐 → 다른 장면" 으로 끊겨 보였음. 지금은 카메라가 물러나며 판 아래 턴테이블이 드러나는 한 장면)
  ttRise: [0.09, 0.12],
  land: [0.24, 0.10],             // 판이 플래터 위로 내려앉음
  build: [0.34, 0.34],            // Blender reveal 클립 전체를 이 구간에 선형으로 = Blender 순서·타이밍 그대로
  lampDelay: 0.01, lampDur: 0.07,  // 램프는 놓인 뒤 천천히 켜짐
  nightDur: 0.12,                 // 창문 벽이 다 선 뒤 창밖 야경이 밝아지는 길이
  room: [0.34, 0.20],             // 방 주변광
  lidAt: 0.215,                  // 턴테이블이 다 올라온 뒤·판이 내려앉기 전에 먼지 덮개가 열림
  spinAt: 0.70, armDur: 0.05,
  camFinal: 0.54,                 // reveal v2(64프레임): 큰 가구가 놓일 무렵 완성 구도에 도착 → 소품이 튀어나오는 건 고정된 구도에서
  roomHold: 0.76,                 // 방 전체 구도는 여기까지 (= 3칸)
  // [열림, 닫힘] 진행도 (되돌아갈 때 덜컹이지 않게 간격). New Vinyls 는 카메라가 커버 앞에 거의 다 왔을 때 넘김
  nv: [0.85, 0.84], news: [0.93, 0.90],
};
// 칸: 0 Hero(Home 엔진 그대로) · 1 검은 바탕·판 1/3 · 2 턴테이블·착지 · 3 방 완성(33⅓) · 4 New Vinyls · 5 News
//  - 착지까지(0~2): 스크롤이 칸 사이 위치 s 를 직접 움직이고 화면은 부드럽게 따라감. 손을 떼면 가까운 칸으로 미끄러져 붙음
//  - 3D 방부터(2~5): 휠·스와이프·키 한 번에 한 칸, 그 칸의 장면을 시간으로 재생 (방 생성은 Blender 시간 그대로, 재생 중엔 입력 무시)
const STAGE_P = [0, 0.18, 0.34, 0.76, 0.86, 0.96];
const STAGE_DUR = [1.0, 1.4, null, 1.2, 1.0];   // [i]↔[i+1] 한 칸을 지나는 시간(초). null = 방 생성: Blender 클립 길이 그대로
const STEP_FROM = 2;                            // 이 칸부터는 한 번에 한 칸
const STEP = { threshold: 24, touch: 40, cooldown: 0.45 };   // Home 엔진 SECTION 과 같은 값
// 해상도: 4K 화면에서 픽셀 비율 2 면 한 장에 수백만 픽셀 × 조명 수십 개 → 1.5 로 묶고, 그래도 느리면 1 까지 자동으로 낮춤
const DPR_MAX = 1.5, DPR_MIN = 1, DPR_SLOW_FPS = 45;
// 구운 그림을 쓰는 동안 Blender 램프 조명을 끌지 (위 '라이트' 설명). ?bake=0(실시간 조명 비교) · ?lamps=1 이면 켬
const LAMPS_OFF = typeof location !== "undefined" && (() => { const q = new URLSearchParams(location.search); return q.get("bake") !== "0" && q.get("lamps") !== "1"; })();
// Hero 판의 빛줄기 (homeEngine STREAK.spread) · 직교 카메라처럼 보이게 둘 눈의 거리(판 반지름 배)
const HERO_STREAK_SPREAD = 0.45, HERO_EYE_FAR = 300;
// Hero 렌즈: 넘어오는 순간의 화각 배율(tan 비, 작을수록 직교에 가까움) · 원래 렌즈로 돌아오는 진행도 구간 [시작, 길이]
const HERO_LENS = 0.2, HERO_LENS_P = [0, 0.12];
// Hero 를 떠나게 한 휠 한 번에 판이 바로 움직이는 몫 (칸 단위, 착지까지 2칸)
const HERO_LEAVE_NUDGE = 0.12;
const HERO_FADE_MS = 400;   // Hero 층(제목·글자)이 옅어지는 시간
// 구운 빛: 빈 방 → 가구 있는 방 으로 바뀌는 reveal 클립 프레임 (Lv1 큰 가구 시작 44 ~ Lv3 소품 끝 108, docs: 방 reveal 단계 구조)
const LM_BUILD = [22, 58];   // reveal v2: 큰 가구 시작 22 ~ 소품 끝 무렵 58 (예전 클립은 44 ~ 108)   //   // Hero 를 이어 받은 판이 제자리에 머무는 시간(초). Hero 레이어가 걷히는 0.5초와 거의 같게
const POST_TILT = [0.56, 0.10];   // 틸트시프트가 켜지는 진행도 구간 (방 완성 무렵)
const BUILD_SLOW = 1;             // 방 짓는 재생 속도: 클립 길이 그대로 = Blender 타이밍 (1 보다 크면 그 배만큼 천천히)
// 불 켜짐: 램프가 놓일 때마다 그 램프 몫만큼 차례로 밝아짐 (램프 pivot → 전체 밝기에서 차지하는 몫). 한 번 켜지는 길이 = LAMP_ON_DUR
const LAMP_SHARE = { pivot_lamp_floor: 0.4, pivot_lamp_circle: 0.2, pivot_lamp_window: 0.15, pivot_lamp_table: 0.25 };
const LAMP_ON_DUR = 0.035, LAMP_ON_LEAD = 0.03;   // LEAD: 램프가 다 자리 잡기 조금 전(튀어나와 출렁일 때)부터 켜지기 시작
const LIT_P = [0.655, 0.10];   // 불 켜짐 [시작, 길이] 진행도: 소품이 다 놓일 무렵 시작해 방 완성 칸까지 약 1.4초에 걸쳐 천천히 밝아짐 (예전엔 클립 끝 0.3초)
// 램프 갓 발광 색 (선형, 톤매핑 없이 화면에 그대로): Blender 렌더에서 잰 갓 평균색 ÷ 갓 텍스처 평균색 (텍스처 없는 재질은 그 색 그대로)
const LAMP_GLOW = {
  mat_lamp_shade_pattern: [1.31, 1.32, 2.8],   // 스탠드 갓 → 렌더 sRGB (246,163,113)
  mat_lamp_globe: [1.7, 1.55, 2.0],            // 창가 구 → (217,136,63). 텍스처가 위아래로 어두운 그라데이션이라 Blender(AgX 가 밝은 쪽을 눌러 고르게)처럼 보이게 더 밝게
  mat_lamp_table_shade: [0.56, 0.42, 1.0],     // 테이블 램프 갓 → (174,56,38)
  mat_lamp_circle_shade: [0.965, 0.708, 0.558], // 콘솔 원형 램프 → (251,219,197)
};
// 늦은 밤의 방 (2026-11-16, B + D): 화면 가운데에서 고리가 열림 → 스크롤을 따라 카메라가 턴테이블로 다가감 → "drop the needle" 에서 바늘이 내려감
//  NIGHT_PUSH: 창 섹션 윗변 높이 T [시작, 끝] 동안 방 전체 구도 → 턴테이블 가까이 · fill: 다가간 뒤 턴테이블 폭이 화면 짧은 변에서 차지하는 비율
//  NIGHT_NEEDLE: "drop the needle" 문구가 화면 위에서 [내려감, 다시 들림] 비율 높이를 지날 때 (사이를 두어 경계에서 덜컹이지 않게)
const NIGHT_PUSH = { at: [1.65, 2.45], fill: 0.5, size: 0.45, lift: 0.18 };
const NIGHT_NEEDLE = [0.62, 0.74];
// 늦은 밤의 방이 열리는 모양 (2026-11-19 사용자 결정, 예전: 사진 한 장이 커짐): News 화면 전체가 LP 재킷이 되어 위로 밀려 올라가고 그 밑의 방이 드러남
//  재킷 아랫변 = 창 섹션 윗변 + lead (News 끝의 빈 여백 안이라 글과 겹치지 않음) · tilt: 다 들렸을 때 기울기(rad, 한쪽이 먼저 들림)
//  ride: 방은 재킷보다 느리게 따라 올라옴 (처음에 화면 높이의 이만큼 아래) → 판이 재킷에서 빠져나오는 깊이감
//  near: 창 섹션 윗변이 이 높이를 넘으면 늦은 밤 (방 화면 틀을 풀고 방 안을 다시 누를 수 있게)
const NIGHT_LIFT = { lead: 0.12, tilt: 0.022, ride: 0.16, near: -0.2 };
// News → 늦은 밤: 재킷(News 바탕)이 들리는 동안 밤색으로 천천히 바뀜 (T 구간). 색 = 방의 밤하늘 · 건물 그늘에 가까운 짙은 남보라
const NIGHT_TINT = { at: [0.25, 1.05], color: "#17131f" };
const NV_BACK_WAIT = 1.0;                       // New Vinyls → 방: 커버가 선반으로 돌아가는 시간(핸드오프 1초)만큼 카메라가 기다림
const SCROLL = {
  speed: 1,         // 착지까지: 스크롤·붙는 속도 배율 (1 보다 작으면 더 천천히)
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
// 방 완성 칸 재생 중 이 진행도를 넘으면 페이지 스크롤을 풀고 문구를 올림 (소품이 다 놓이는 무렵 ≈ reveal 58/64 프레임 → 0.65)
//  예전엔 재생이 끝난 0.76 + 0.45초 뒤 → 약 1.5초 늦었음. 더 일찍 = 값을 낮춤
const FREE_P = 0.65;
// flow="scroll" (Home): 칸을 넘기는 대신 페이지 스크롤에 이어진 한 장면 (/lab/room-test 의 흐름)
//  - 앞부분(Hero → 바탕이 어두워짐 → 턴테이블 · 덮개 → 착지, P 0~0.34): 페이지 스크롤에 그대로 묶임 (굴린 만큼)
//  - 방 짓기(P 0.34~0.76): 판이 앉고 스크롤이 그 너머면 Blender 시간 그대로 재생, 되돌리면 같은 속도로 역재생
//    (방이 다 되감긴 뒤에야 판이 들림 = 거꾸로도 같은 순서)
//  - 판은 앞쪽에서 먼저 수평으로 누움 (턴테이블에 들어가기 좋게)
const FLOW = {
  travel: 1.0,       // 판이 턴테이블에 앉기까지의 스크롤 길이 (화면 높이 배)
  hold: 0.8,         // 앉은 뒤 방이 지어지는 걸 보는 길이 (그 뒤 섹션이 올라옴)
  flat: [0.0, 0.12], // 판이 수평으로 눕는 진행도 구간 [시작, 길이]
  follow: 8,         // 앞부분이 (방 역재생을 기다렸다가) 스크롤 자리를 따라붙는 빠르기
};
const NV_WHEEL = 2, NV_WHEEL_EASE = 0.3;   // 방 → New Vinyls 구간의 휠 배수 · 끝에서 1 로 돌아오는 구간(비율)
const INDEX = ["Grooves", "The Room", "New Vinyls", "News", "After Hours"];   // 오른쪽 목차 01–05
const RPM = (r) => (r * Math.PI * 2) / 60;
const CREAM = new THREE.Color("#f3e7cd"), NIGHT = new THREE.Color("#0e0c11");
// 나중에 채워지는 약속 (방 렌더러가 만들어지면 Hero 엔진에 넘김)
// CSS 색 (color-mix · oklab 등 무엇이든) → THREE.Color: 1px 2D 캔버스에 칠해 읽음 (THREE.Color 는 rgb·hex 만 읽음)
let colorCtx = null;
const cssColor = (css) => {
  if (!css || css === "transparent" || /rgba\(.*,\s*0\)$/.test(css)) return null;
  colorCtx ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  colorCtx.clearRect(0, 0, 1, 1); colorCtx.fillStyle = "#000"; colorCtx.fillStyle = css; colorCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = colorCtx.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
};
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const INK_ON_CREAM = new THREE.Color("#4c404a"), INK_ON_NIGHT = new THREE.Color("#efe3c8");
const LABEL_ON_CREAM = new THREE.Color("#2d6a6a"), LABEL_ON_NIGHT = new THREE.Color("#7fc1bd");
const DISC_R = 0.15;              // LP 반지름 (m)
const ARM_SWING = -0.42;          // 톤암이 판 위로 들어가는 각도 (rad, 톤암 기둥 기준)
const ROOM_ZOOM = 1.2;             // 방 완성 구도를 기준 카메라보다 이만큼 당김 (시야각만 좁힘 → 배경 레이어 원근 · 정렬은 그대로, 방이 화면을 더 채움)
const FOV0 = 30;                  // 이야기 카메라 시야. 방 완성 칸에서는 GLB 카메라 시야(약 17°)로 바뀜
const ENV_IN = [0.46, 0.10];
// 배경 레이어 등장: 인형극 무대 배경처럼 가까운 레이어부터 아래에서 위로 스르륵 (레이어마다 STAGGER 만큼 늦게, DUR 동안)
//  떨어진 깊이 = 레이어까지 거리 × DROP (화면에서 대략 같은 높이만큼 내려가 있다 올라옴)
// 실시간으로 빛나는 재질(구운 그림 대신 발광 그대로 쓰는 것) 중 화면에서 너무 튀는 것의 세기 배율
//  아래 건물 창 두 칸이 화면에서 가장 밝아 시선을 뺏고, 이웃 옥상 랜턴은 하얗게 날아감 (2026-11-11)
const EMIT_SCALE = { mat_building_glass_lit: 0.4, mat_building_glass_dim: 0.45, mat_nb_lantern_glow: 0.3, mat_nb_window_lit: 0.6 };
const LAYER_RISE = { start: 0.46, stagger: 0.014, dur: 0.075, drop: 0.11 };      // 바깥 배경(하늘·도시·한강)이 서서히 나타나는 구간 (방 완성 구도로 다가갈 때)
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
  // 재킷 메시의 실제 앞면에 딱 맞춰 붙임: 가장 넓은 면(방 쪽을 보는 쪽)의 방향 · 가운데 · 크기를 삼각형에서 직접 구함
  //  (예전: 메시의 축 맞춤 상자 기준 → 재킷이 벽에 기대어 기울어 있으면 그림만 꼿꼿이 서서 재킷과 각도가 어긋나 보였음)
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const tri = idx ? idx.count / 3 : pos.count / 3, at = (i) => (idx ? idx.getX(i) : i);
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  const buckets = new Map();
  for (let t = 0; t < tri; t++) {
    A.fromBufferAttribute(pos, at(t * 3)); B.fromBufferAttribute(pos, at(t * 3 + 1)); C.fromBufferAttribute(pos, at(t * 3 + 2));
    n.crossVectors(e1.subVectors(B, A), e2.subVectors(C, A));
    const area = n.length() / 2;
    if (area < 1e-10) continue;
    n.normalize();
    const key = `${Math.round(n.x * 20)},${Math.round(n.y * 20)},${Math.round(n.z * 20)}`;
    let k = buckets.get(key);
    if (!k) buckets.set(key, k = { area: 0, n: new THREE.Vector3(), pts: [] });
    k.area += area; k.n.addScaledVector(n, area); k.pts.push(A.clone(), B.clone(), C.clone());
  }
  const toRoom = roomCenter.clone().sub(mesh.getWorldPosition(new THREE.Vector3()));
  const faces = (k) => k.n.clone().normalize().transformDirection(mesh.matrixWorld).dot(toRoom) >= 0;
  const sorted = [...buckets.values()].sort((a, b) => b.area - a.area);
  const front = sorted.slice(0, 2).find(faces) ?? sorted[0];
  const N = front.n.clone().normalize();
  // 면 안의 '위': 면의 모서리 중 월드 위쪽에 가장 가까운 것 (재킷이 뒤로 기대어 있어도 그 기울기 그대로)
  const up = new THREE.Vector3(0, 1, 0).transformDirection(mesh.matrixWorld.clone().invert());
  const Y = new THREE.Vector3(); let bestUp = -1;
  for (let i = 0; i < front.pts.length; i += 3) for (let j = 0; j < 3; j++) {
    e1.subVectors(front.pts[i + (j + 1) % 3], front.pts[i + j]).normalize();
    const d = Math.abs(e1.dot(up));
    if (d > bestUp) { bestUp = d; Y.copy(e1).multiplyScalar(Math.sign(e1.dot(up)) || 1); }
  }
  Y.addScaledVector(N, -Y.dot(N)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, N);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d = 0;
  for (const v of front.pts) { const x = v.dot(X), y = v.dot(Y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); d += v.dot(N); }
  d /= front.pts.length;
  const side = Math.min(x1 - x0, y1 - y0) * 0.96;
  const mat = new THREE.MeshStandardMaterial({ color: "#bbcbda", roughness: 0.7, emissive: "#ffffff", emissiveIntensity: 0 });
  // 재킷 앞면에서 2mm 만 떠 있음 → 멀리서도 재킷과 번갈아 보이지 않게 깊이를 카메라 쪽으로 당김
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -8;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(side, side), mat);
  face.position.set(0, 0, 0).addScaledVector(X, (x0 + x1) / 2).addScaledVector(Y, (y0 + y1) / 2).addScaledVector(N, d + 0.002);
  face.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, N));
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

// 꾸밈 없는 판 (heroMode="raw"): vinyl.glb 의 재질 그대로 (빨간 라벨 · 검은 비닐). 셰이더 · Home 엔진 없음
//  잉크 판과 같은 크기 · 같은 아랫면 기준이라 플래터에 똑같이 내려앉음
function makeRawDisc(scene) {
  const model = scene;
  let ref = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    ref ??= o; o.renderOrder = 1;
    // 판 면(Material.002)은 색이 비어 있는 흰 재질 (잉크 셰이더가 그 위에 그려 왔음) → 실제 판처럼 검은 비닐, 살짝 윤이 남
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.color && m.color.r > 0.9 && m.color.g > 0.9 && m.color.b > 0.9) { m.color.set("#141216"); m.roughness = 0.32; }
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const holder = new THREE.Group();
  holder.scale.setScalar(DISC_R);
  holder.position.y = -box.min.y * DISC_R;   // 판 아랫면이 플래터에 닿게
  holder.add(model);
  const root = new THREE.Group();
  root.add(holder);
  return { root, uniforms: null, inkMat: null, baseMat: null, ref };
}

/** heroMode: "engine" = Home 엔진의 Hero (잉크 판 · 링 · 인트로) · "raw" = 방 장면의 꾸밈 없는 판 한 장
 *  · "ink" = 방 장면 속 잉크 판 + 주변 효과 · 누르기 · 뒤집기 · 제목 · 커서 (inkHero.js, /lab/room-test 에서 맞춘 그림)
 *  · "sleeve" = 실제 같은 LP 재킷 줄 → 열면 판이 나오고 → 그 판이 턴테이블로 (sleeveHero.js, /lab/sleeve-room) */
export default function RoomTest({ heroMode = "engine", flow = "steps" } = {}) {
  const rawHero = heroMode === "raw";
  const inkHero = heroMode === "ink";
  const sleeveHero = heroMode === "sleeve";
  const ownHero = rawHero || inkHero || sleeveHero;   // Home 엔진 없이 이 캔버스가 Hero 를 그림
  // sleeve Hero: 가운데 앨범 · 열림 (아래 글자 · 버튼)
  const [sleeveAt, setSleeveAt] = useState(0);
  const [sleeveOpen, setSleeveOpen] = useState(false);
  const scrollFlow = flow === "scroll";
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
  const [soundOn, setSoundOn] = useState(false);   // 효과음은 사용자가 켤 때만 (브라우저 자동 재생 규칙)
  const tipRef = useRef(null);                      // 방 안 물체 위에 뜨는 이름표
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const musicHostRef = useRef(null);                // 턴테이블 음악: YouTube 플레이어가 들어가는 자리 ("Now spinning" 카드)
  const [propMenu, setPropMenu] = useState(null);   // 소품 메뉴 카드 (레코드 상자 · 책 · 지금 듣는 판): { x, y, kicker, title, sub, actions }
  const [music, setMusic] = useState({ album: null, active: false, playing: false, buffering: false, blocked: false, error: false });
  const [heroOn, setHeroOn] = useState(true);   // Hero = Home 엔진 레이어가 보이는 동안
  // 모션 줄이기: 칸 이동은 바로, 회전·떠 있는 흔들림·커버 날아가기 없음 (프로젝트 공통 규칙)
  const [reduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const wrapRef = useRef(null);
  // 페이지 스크롤 (방 완성 뒤): .page 가 스크롤 영역, Lenis 로 부드럽게. 방이 완성되기 전에는 잠가 둠
  const pageRef = useRef(null);
  const contentRef = useRef(null);
  const stageRef = useRef(null);
  const wipeRef = useRef(null);   // 섹션 바탕색 · 전환 경계를 그리는 캔버스 (inkWipe)
  const [free, setFree] = useState(false);
  const [where, setWhere] = useState(0);   // 목차: 지금 보이는 뒤 섹션 (0 = 아직 방 스테이지, 1 New Vinyls · 2 News · 3 늦은 밤)
  const [debug, setDebug] = useState(false);   // ?debug=1 이면 디버그 패널
  const { done } = useIntro();
  // ink Hero: 제목 · 커스텀 커서 DOM, 제목이 올라오기 시작하는 기준 시각(= 첫 로딩 화면이 걷힌 때)
  const titleRef = useRef(null);
  const curRefs = { ring: useRef(null), dot: useRef(null), shape: useRef(null), label: useRef(null), tick: useRef(null) };
  const heroStartRef = useRef(null);
  useEffect(() => { if (done && heroStartRef.current == null) heroStartRef.current = performance.now() / 1000; }, [done]);
  // 방 완성 → New Vinyls 가 화면 위에 닿을 때까지만 휠 한 칸이 NV_WHEEL 배 (닿기 직전 마지막 NV_WHEEL_EASE 구간에서 1 로 부드럽게)
  //  New Vinyls 는 한 화면(+슬리브 여백)을 올라와야 해서 휠을 많이 굴려야 했음. 그 뒤(갤러리 · News)는 휠 1:1
  const wheelScale = useRef((y) => {
    // sleeve Hero: 판이 턴테이블로 내려가는 구간(맨 위 ~ 착지 자리)은 휠을 느리게 → 판을 눌렀을 때처럼 천천히 내려감
    //  (예전: 휠 몇 칸에 이 구간이 휙 지나가서, 판이 가운데로 와서 내려앉는 과정이 거의 안 보였음)
    if (apiRef.current?.sleeve) {
      const land = FLOW.travel * (pageRef.current?.clientHeight || 1);
      if (y < land) return SLEEVE_HERO.wheel.land + (1 - SLEEVE_HERO.wheel.land) * THREE.MathUtils.smoothstep(y / land, 0.9, 1);
    }
    const end = apiRef.current?.nvTop;
    if (!end || y >= end) return 1;
    const k = 1 - THREE.MathUtils.smoothstep(y / end, 1 - NV_WHEEL_EASE, 1);
    return 1 + (NV_WHEEL - 1) * k;
  }).current;
  usePageLenis({ wrapperRef: pageRef, contentRef, enabled: done, syncTouch: true, scrollbar: true, wheelScale });
  // sleeve Hero: 재킷을 열기 전(Hero 맨 위)에는 페이지 스크롤을 잠금 → 휠은 앨범 넘기기 (sleeveHero.js). 재킷을 눌러 판이 나오면 풀림 → 스크롤하면 다음 섹션으로
  const sleeveLock = sleeveHero && heroOn && !sleeveOpen;
  useEffect(() => {
    const page = pageRef.current; if (!page) return;
    if (sleeveLock) page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: 0 } }));     // 맨 위에 딱 붙임 (몇 px 내려가 있으면 '스크롤로 열림'이 됨)
    page.dispatchEvent(new Event((free || scrollFlow) && !sleeveLock ? "page:unlock" : "page:lock"));
  }, [free, done, scrollFlow, sleeveLock]);
  const homeRef = useRef(null);   // Home 엔진 (heroPose)
  // 한 캔버스: Hero(Home 엔진)는 자기 WebGL 을 만들지 않고 이 방의 렌더러를 빌려 같은 캔버스에 그림
  //  → Hero 판 → 방의 판이 같은 픽셀에서 바로 이어짐 (두 캔버스를 겹쳐 바꾸던 때의 끊김·이중 그리기 없음)
  //  렌더러는 아래 effect 에서 만들어지므로 약속으로 넘김 (개발 모드에서 effect 가 다시 돌면 새 약속)
  // 첫 로딩 화면이 기다리는 것: 3D 방(모델·빛 그림·배경·GPU·셰이더) + Hero 엔진(판·셰이더) + 선반 앨범 재킷(받아서 GPU 까지)
  //  셋 다 끝나면 markHomeReady → 로딩이 걷힘 (아주 느린 망은 useAppReady 가 12초에서 끊음)
  const gateRef = useRef(null);
  if (!gateRef.current) gateRef.current = { room: deferred(), hero: deferred(), covers: deferred() };
  if (ownHero) gateRef.current.hero.resolve();   // raw · ink Hero: Home 엔진이 없으니 기다릴 것 없음
  useEffect(() => {
    const g = gateRef.current;
    // 각 조건이 끝난 시각을 performance 에 남김 (개발 도구 Performance 탭 · performance.getEntriesByName("home:room") 로 확인)
    for (const k of ["room", "hero", "covers"]) g[k].promise.then(() => performance.mark(`home:${k}`));
    Promise.all([g.room.promise, g.hero.promise, g.covers.promise]).then(markHomeReady);
  }, []);
  const sharedRef = useRef(null);
  if (!sharedRef.current) sharedRef.current = deferred();
  const getShared = useRef(() => sharedRef.current.promise).current;

  // 3D 를 만들기 시작해도 되는가: 다른 페이지에서 넘어오는 중(크레이트 전환)이면 착지할 때까지 미룸
  //  렌더러 · 재킷 줄 · 방을 만드는 일이 전환 애니메이션과 겹치면 넘어오는 동안 화면이 끊김 (긴 작업 5번, 합 0.5초 — 2026-11-17 Digging → Home 에서 확인)
  //  사이트의 다른 등장과 같은 규칙: 페이지 안의 일은 착지한 순간부터 (lib/motion.js)
  const [boot, setBoot] = useState(() => typeof document === "undefined" || isPageSettled() || !document.documentElement.dataset.crateTransition);
  useEffect(() => {
    if (boot) return;
    const d = document.documentElement.dataset;
    if (d.crateTransition !== "true" || d.crateLanded === "true") { setBoot(true); return; }
    const go = () => setBoot(true);
    window.addEventListener("crate:land", go); window.addEventListener("crate:end", go);
    const t = setTimeout(go, 2500);
    return () => { window.removeEventListener("crate:land", go); window.removeEventListener("crate:end", go); clearTimeout(t); };
  }, [boot]);

  useEffect(() => {
    if (!boot) return;
    const host = hostRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.localClippingEnabled = true;   // 남산 레이어를 창문 위 테두리에서 잘라 냄 (벽 위로 타워가 삐져나오지 않게)
    host.appendChild(renderer.domElement);
    sharedRef.current.resolve(renderer);   // Hero 엔진이 기다리던 렌더러
    // 화면 후처리 (빛 번짐 · 틸트시프트 · 비네트). ?post=0 이면 끔
    const post = createPost(renderer);
    post.params.enabled = new URLSearchParams(location.search).get("post") !== "0";

    // Hero 의 링·그림자·먼지를 그리는 겹침 타깃 · 화면 사각형 (renderHeroRT · compositeHeroRT)
    const heroRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
    heroRT.texture.colorSpace = THREE.SRGBColorSpace;
    const overlayMat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: heroRT.texture }, uK: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      // 미리 곱한 알파를 풀고 → 화면 색 공간으로 → 다시 곱함 (Hero 를 화면에 바로 그릴 때와 같은 색으로 섞이게)
      fragmentShader: "uniform sampler2D tMap; uniform float uK; varying vec2 vUv;\nvoid main(){ vec4 t = texture2D(tMap, vUv);\ngl_FragColor = vec4(t.a > 1e-4 ? t.rgb / t.a : vec3(0.0), t.a);\n#include <colorspace_fragment>\ngl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, gl_FragColor.a) * uK;\n}",
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const overlayScene = new THREE.Scene();
    overlayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlayMat));
    const overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

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
    // raw Hero 의 판 조명 (apply 에서 바탕이 어두워지는 만큼 꺼짐)
    const heroLight = rawHero || sleeveHero ? { hemi: new THREE.HemisphereLight("#fff6e8", "#b9a88f", 0), sun: new THREE.DirectionalLight("#ffffff", 0) } : null;
    if (heroLight) scene.add(heroLight.hemi, heroLight.sun, heroLight.sun.target);
    if (sleeveHero) {
      // 재킷이 판에 드리우는 부드러운 그림자 (Hero 의 재킷 줄 둘레만 덮는 작은 그림자 범위). 세기 0 일 때도 켜 둠: 껐다 켜면 셰이더를 다시 만들어 끊김
      const sh = heroLight.sun.shadow;
      heroLight.sun.castShadow = true;
      sh.mapSize.set(1024, 1024); sh.radius = 7; sh.blurSamples = 12; sh.bias = -0.0005; sh.normalBias = 0.003;
      Object.assign(sh.camera, { left: -0.8, right: 0.8, top: 0.6, bottom: -0.6, near: 0.2, far: 5 });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    const _hlOff = new THREE.Vector3();

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
    };    st.reduced = reduced;
    st.themeCream = scene.background.clone();
    st.heroBg = st.themeCream.clone();
    apiRef.current = st;

    // 헤더: 투명(globals.css, data-header-see-through)이라 장면 바탕이 비침 → 글자·펼친 메뉴 패널 색만 지금 바탕에 맞춤
    //       New Vinyls·News 가 열려 있으면 그 종이색 기준
    const ctPage = wrapRef.current?.closest(".ct-page");
    const FG_ON_LIGHT = new THREE.Color("#4c404a"), FG_ON_DARK = new THREE.Color("#f4e7cd");
    const _hb = new THREE.Color(), _hf = new THREE.Color();
    // 색 변수는 페이지(.ct-page)가 아니라 그 색을 쓰는 요소(헤더 · data-header-fg)에 직접 넣음
    //  .ct-page 에 넣으면 값이 바뀔 때마다 페이지 전체(New Vinyls · News 의 모든 요소)의 스타일을 다시 계산함
    //  → 바탕색이 바뀌는 착지 구간(p 0.10~0.17)에서 매 프레임 일어나 프레임이 빠졌음 (2026-11-17)
    let headKey = "", headEls = [], headTick = 0, headFg = "", headBg = "";
    const paintHead = () => { for (const el of headEls) { el.style.setProperty("--ct-header-fg", headFg); el.style.setProperty("--ct-drop-bg", headBg); } };
    const syncHeader = () => {
      if (!ctPage) return;
      // 색을 받을 요소: 늦게 생기는 것도 있어 0.5초쯤마다 다시 찾음
      if (headTick++ % 30 === 0) {
        const els = [...ctPage.querySelectorAll(":scope > .ct-navbar, [data-header-fg]")];
        if (els.length !== headEls.length || els.some((e, i) => e !== headEls[i])) { headEls = els; if (headFg) paintHead(); }
      }
      _hb.copy(st.overBg ?? (st.section >= 1 ? st.themeCream : scene.background));
      const lum = 0.2126 * _hb.r + 0.7152 * _hb.g + 0.0722 * _hb.b;   // 선형 밝기: 크림 ≈ 0.8, 잉크 ≈ 0.06, 밤 ≈ 0.005
      _hf.copy(FG_ON_DARK).lerp(FG_ON_LIGHT, THREE.MathUtils.smoothstep(lum, 0.1, 0.35));
      const key = _hb.getHexString() + _hf.getHexString();
      if (key === headKey) return;
      headKey = key;
      headFg = `#${_hf.getHexString()}`; headBg = `#${_hb.getHexString()}`;
      paintHead();
    };
    st.clearHeader = () => { for (const el of headEls) { el.style.removeProperty("--ct-header-fg"); el.style.removeProperty("--ct-drop-bg"); } headEls = []; };
    st.post = post;
    window.__room = st; // 콘솔 디버깅용
    st.holdRender = true;   // 방 · 재킷 줄의 셰이더가 준비되면 prewarm 이 false 로 (아래 frame 의 설명)
    // 그리지 않는 동안 캔버스는 비어 있어 검게 보임 → 그동안은 숨겨서 뒤의 페이지 바탕(종이)이 보이게 하고, 그리기 시작하면 부드럽게 나타남
    //  (다른 페이지에서 Home 으로 오면 검은 화면이 깔렸다가 갑자기 바뀌었음, 2026-11-17)
    renderer.domElement.style.opacity = "0";
    st.release = () => {
      if (!st.holdRender) return;
      st.holdRender = false;
      const c = renderer.domElement;
      // 첫 프레임이 실제로 그려진 뒤에 보이게 (두 프레임 뒤)
      requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = st.reduced ? "" : "opacity .5s ease-out"; c.style.opacity = "1"; }));
      setTimeout(() => { c.style.opacity = "1"; }, 400);   // 탭이 뒤에 있어 프레임이 안 돌 때
    };
    // "지금 듣는 판" 커버: 재질 · 그림이 바뀌면 바로 셰이더를 (화면을 막지 않고) 컴파일하고 그림을 GPU 에 올려 둠
    //  안 하면 방이 지어지다 이 재킷이 처음 보이는 프레임(p≈0.47)에 컴파일 + 올리기가 몰려 한 번 끊김 (58ms, 2026-11-17)
    st.warmNowPlaying = (np) => {
      if (st.disposed) return;
      try {
        if (np.material.map) renderer.initTexture(np.material.map);
        renderer.compileAsync(np, storyCam, scene).catch(() => {});
      } catch {}
    };

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      const pr = renderer.getPixelRatio();
      post.setSize(w * pr, h * pr);
      heroRT.setSize(Math.max(1, Math.round(w * pr)), Math.max(1, Math.round(h * pr)));
      st.canvasRect = null;
      if (st.hero) { st.hero.dirty = true; st.hero.fx?.setPixelRatio?.(pr); }
      if (st.sleeve) st.sleeve.dirty = true;
      for (const c of [storyCam, orbitCam, ...Object.values(st.gltfCams)]) { c.aspect = w / h; c.updateProjectionMatrix(); }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ── 스크롤 위치 s(칸 단위): 입력이 sTarget 을 움직이고, s 는 그걸 부드럽게 따라감
    const now = () => performance.now() / 1000;
    const LAST = 3;   // 방 완성까지가 스테이지. 그 뒤(New Vinyls · News · 늦은 밤의 방)는 페이지 스크롤 (HomeSections)
    // 방이 완성되어 멈춰 있으면 페이지 스크롤을 풀어 줌(free). 맨 위에서 위로 굴리면 다시 스테이지가 받아 한 칸 되돌아감
    st.free = false; st.scrollAt = 0; st.covered = false; st.overBg = null;
    const pageTop = () => pageRef.current?.scrollTop ?? 0;
    // 페이지 스크롤에 맡길 입력인가 (dir: +1 아래로 · -1 위로)
    const toPage = (dir) => st.free && (dir > 0 || pageTop() > 1 || now() - st.scrollAt < 0.5);
    st.s = 0; st.sTarget = 0; st.goal = null; st.stage = 0; st.dir = 1; st.inputAt = 0; st.touching = false; st.inHero = !scrollFlow;
    st.scrollFlow = scrollFlow; st.tr = 0; st.ts = 0; st.pPre = 0; st.k = 0; st.atTop = true;
    st.tween = null; st.lockUntil = 0;
    const segDur = (i) => STAGE_DUR[i] ?? (st.clip.duration * BUILD_SLOW * (STAGE_P[i + 1] - STAGE_P[i])) / STORY.build[1];
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
    //  같은 캔버스라 넘어가는 프레임부터 이 판만 그려짐 (Home 엔진은 더 그리지 않음). 판은 그 뒤 스크롤을 따라 움직임
    st.leaveHero = (pose) => {
      if (!st.ready || !st.inHero) return false;
      if (pose) takeHero(pose);
      readHeroBg();
      st.bobT0 = null;
      st.inHero = false;
      st.heroFadeAt = performance.now();   // Hero 의 링·그림자·먼지를 방 위에서 옅어지게 (heroK)
      st.s = st.sTarget = 0;
      st.onHero?.(false);
      // 판은 스크롤을 따라감: 저절로 내려가지 않고, 굴린 만큼 작아지며 턴테이블 위(Turntable_DiscSeat)로 (착지 = STEP_FROM 칸)
      //  Hero 를 떠나게 한 그 휠만큼은 바로 조금 움직여서, 내린 것에 판이 곧장 반응하게
      st.auto = false; st.goal = null;
      st.sTarget = st.reduced ? 0 : HERO_LEAVE_NUDGE;
      st.dir = 1; st.inputAt = now();
      return true;
    };

    // ── 입력 (Hero 에서는 Home 엔진이 받음)
    let wheelAcc = 0, wheelAt = 0;
    // raw Hero: Home 엔진이 없으니 여기서 Hero 를 떠남 (아래로 한 번 = 방 이야기 시작, 엔진과 같은 문턱)
    const heroInput = (dir) => {
      if (!st.ready || dir <= 0 || now() < st.lockUntil) return;
      st.leaveHero(null);
    };
    // 한 장면 흐름: 방이 지어지는 동안은 착지 지점 아래로 못 내려감 (위로는 그대로 → 역재생). 다 지어지면(FREE_P) 풀림
    //  예전 칸 방식은 방이 다 지어질 때까지 페이지 스크롤 자체를 잠갔음 → 같은 느낌
    const landY = () => FLOW.travel * (pageRef.current?.clientHeight || innerHeight);
    const holdDown = () => st.scrollFlow && st.ready && !st.free && st.k >= 1 - 1e-3 && pageTop() >= landY() - 2;
    const blockDown = (e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); };
    const onWheel = (e) => {
      if (st.scrollFlow) {   // 휠은 페이지가 그대로 (장면은 스크롤 위치를 읽음)
        if (e.deltaY > 0 && holdDown()) blockDown(e);
        return;
      }
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      if (st.inHero) {
        if (!ownHero) return;   // Hero 는 Home 엔진이 받음
        e.preventDefault();
        const t = now();
        if (t - wheelAt > 0.25) wheelAcc = 0;
        wheelAt = t; wheelAcc += px;
        if (wheelAcc > STEP.threshold) { wheelAcc = 0; heroInput(1); }
        return;
      }
      // 방 완성 뒤: 페이지(Lenis)가 그대로 스크롤 — 휠을 가로채거나 배수를 곱하지 않음 (Route 66 처럼 휠 1 : 스크롤 1, lerp 0.1)
      if (toPage(Math.sign(px))) return;
      e.preventDefault();
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
    const onTouchStart = (e) => {
      if (st.scrollFlow) { flowTouchY = e.touches[0].clientY; return; }
      if (st.inHero) { if (ownHero) { touchY0 = e.touches[0].clientY; touchY = null; st.heroTouch = true; } return; }
      touchY = touchY0 = e.touches[0].clientY; touchStep = false; st.touching = true;
    };
    let flowTouchY = null;
    const onTouchMove = (e) => {
      if (st.scrollFlow) {   // 손가락을 위로 쓸면(= 아래로 스크롤) 방이 지어지는 동안 막음
        const y = e.touches[0].clientY;
        if (flowTouchY != null && y < flowTouchY && holdDown()) blockDown(e);
        flowTouchY = y;
        return;
      }
      if (touchY == null) return;
      const y = e.touches[0].clientY;
      if (toPage(Math.sign(touchY - y) || 1)) { touchY = touchY0 = y; return; }   // 페이지가 스크롤 (캔버스는 touch-action: pan-y)
      if (e.cancelable) e.preventDefault();
      if (touchStep || inStep(Math.sign(touchY - y)) || st.tween) touchStep = true;
      else moveBy((touchY - y) / (innerHeight * SCROLL.touch));
      touchY = y;
    };
    const onTouchEnd = (e) => {
      if (st.scrollFlow) return;
      if (st.heroTouch) {   // raw Hero: 위로 쓸어 올리면 떠남
        st.heroTouch = false;
        const y = e.changedTouches?.[0]?.clientY ?? touchY0;
        if (touchY0 - y > STEP.touch) heroInput(1);
        return;
      }
      const dy = touchY0 - (touchY ?? touchY0);
      if (touchStep && Math.abs(dy) > STEP.touch && !busy()) { st.auto = false; stepTo(Math.round(st.sTarget) + Math.sign(dy)); }
      touchY = null; touchStep = false; st.touching = false; st.inputAt = now();
    };
    const onKey = (e) => {
      if (st.scrollFlow) {
        if ({ ArrowDown: 1, PageDown: 1, " ": 1, End: 1 }[e.key] && holdDown()) e.preventDefault();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const dir = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (!dir) return;
      if (st.inHero) { if (ownHero) { e.preventDefault(); heroInput(dir); } return; }
      if (toPage(dir)) return;
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
    const warmed = new WeakSet();
    const seekClip = (t) => {
      st.action.paused = false; st.action.enabled = true;
      st.action.time = Math.min(Math.max(t, 0), st.clip.duration);
      st.mixer.update(0);
      // reveal 전의 조각은 0.001 배로 눌려 있을 뿐 그려지긴 함 → 어두운 바탕에서 바닥이 턴테이블 아래 가는 막대기로 보였음. 그만큼 작을 땐 숨김
      //  빛은 건드리지 않고 메시만 숨김: 빛이 든 조각(램프)을 통째로 숨기면 장면의 빛 개수가 바뀌어, 조각이 나타날 때마다 재질 셰이더를 전부 다시 만들어 버벅였음
      //  숨겨 둔 동안 그 조각의 그림(구운 4K 그림 등)은 미리 올려 둠 — 안 그러면 방이 지어지는 도중에 처음 올라가 끊김
      for (const e of st.tiny ?? []) {
        const o = e.node, tiny = Math.min(o.scale.x, o.scale.y, o.scale.z) < 0.004;
        if (tiny && !e.warm) {
          e.warm = true;
          for (const m of e.meshes) for (const mat of [m.material].flat()) for (const k of ["map", "lightMap", "emissiveMap", "normalMap", "roughnessMap", "aoMap"]) {
            const tex = mat?.[k];
            if (!tex) continue;
            if (!tex.image) { e.warm = false; continue; }
            if (!warmed.has(tex)) { warmed.add(tex); renderer.initTexture(tex); }
          }
        }
        if (tiny === e.hid) continue;
        e.hid = tiny;
        for (const m of e.meshes) m.visible = !tiny;
      }
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
      // reveal 클립이 크기를 움직이는 조각들 (seekClip 에서 아주 작을 때 숨김)
      st.tiny = st.clip.tracks.filter((t) => t.name.endsWith(".scale")).map((t) => THREE.PropertyBinding.findNode(root, THREE.PropertyBinding.parseTrackName(t.name).nodeName)).filter(Boolean)
        .map((node) => { const meshes = []; node.traverse((m) => { if (m.isMesh && m.visible) meshes.push(m); }); return { node, meshes, hid: false }; });
      // 먼지 덮개: Blender 의 cover_open / cover_close 를 그대로, 실제 시간으로 (한 번에 하나만 켬)
      const lidOpen = clipNamed("cover_open"), lidClose = clipNamed("cover_close");
      if (lidOpen && lidClose) {
        st.lid = { open: once(lidOpen), close: once(lidClose), isOpen: false, t: lidClose.duration };
        // sleeve Hero: 덮개가 처음 닫힌 자세에 닿는 순간에서 끝 (그 뒤 스프링처럼 다시 튀어 오르는 부분은 안 씀 — 사용자 요청)
        const tk = lidClose.tracks.find((t) => t.name.endsWith(".quaternion"));
        st.lid.closeEnd = lidClose.duration;
        if (tk) {
          const n = tk.times.length, v = tk.values, e = (n - 1) * 4;
          for (let i = 0; i < n; i++) {
            const d = Math.abs(v[i * 4] * v[e] + v[i * 4 + 1] * v[e + 1] + v[i * 4 + 2] * v[e + 2] + v[i * 4 + 3] * v[e + 3]);
            if (d > 0.9999) { st.lid.closeEnd = tk.times[i]; break; }
          }
        }
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
      //  갓(LAMP_GLOW)은 빛 계산 없는 재질로 바꿔 Blender 렌더(AgX)에서 잰 색 그대로 (톤매핑 끔)
      //   실시간 재질이면 갓 바로 안의 점광원 반사로 하얗게 타고, 웹 톤매핑이 강한 주황 발광을 흰색으로 날림
      //  스탠드 갓은 기둥(lamp_floor)과 따로인 오브젝트(lamp_floor_shade) → 같은 램프(pivot_lamp_floor)로 묶음
      const lampGroups = new Map();
      for (const [name, pivot] of [["lamp_floor"], ["lamp_floor_shade", "lamp_floor"], ["lamp_table"], ["lamp_window"], ["lamp_circle"]]) {
        const lamp = root.getObjectByName(name);
        if (!lamp) continue;
        const key = "pivot_" + (pivot ?? name);
        const g = lampGroups.get(key) ?? { mats: [], authored: [] };
        lamp.traverse((o) => {
          if (!o.isMesh) return;
          const src = o.material, glow = LAMP_GLOW[src.name.replace(/\.\d+$/, "")];
          if (glow) {
            const m = new THREE.MeshBasicMaterial({ name: src.name + "_glow", map: src.emissiveMap ?? null, side: src.side, toneMapped: false });
            m.userData.glow = new THREE.Color(...glow);
            m.userData.off = src.color.clone().multiplyScalar(0.12);   // 꺼짐: 보조 조명만 있는 dim 방의 갓 (바탕색을 어둡게)
            o.material = m; g.authored.push({ m, k: 1 });
            return;
          }
          o.material = src.clone(); g.mats.push(o.material);
          if (o.material.emissive.getHex() !== 0) g.authored.push({ m: o.material, k: o.material.emissiveIntensity });
        });
        lampGroups.set(key, g);
      }
      // 발광 재질이 하나도 없는 램프만 갓 전체에 웜톤
      for (const [key, g] of lampGroups) st.lampMats.set(key, g.authored.length
        ? g.authored
        : g.mats.map((m) => { m.emissive = new THREE.Color("#ffc988"); return { m, k: 1.6 }; }));
      // 방 바깥 2.5D 배경: /lab/env-test 에서 확정한 Hybrid 레이어 · 하늘 · 창문 안 남산 (env-layers.json)
      //  레이어 높이는 기준 카메라(B 18°) 화면 기준이라, 방 완성 칸의 카메라도 그 기준 카메라 그대로
      st.rig = computeRig(root, gltf.cameras[0]);
      st.base = makeBase(st.rig, { A: null, B: 18, C: 12 }[LAYER_CFG.camera.preset]);
      st.env = createEnv(st.rig, st.base, LAYER_CFG, root);   // 유리 창·남산·바깥 면 색 포함 (방이 다 지어진 자세에서)
      // 하늘은 화면에 붙은 그림 → 당긴 만큼 같이 키워 스카이라인 뒤 노을 줄이 그대로 맞게
      { const u = st.env.sky.material.uniforms; u.uOff.value += 0.5 * u.uScale.value * (1 - 1 / ROOM_ZOOM); u.uScale.value /= ROOM_ZOOM; }
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

      // 다른 면 바로 앞에 붙은 얇은 판(재킷 0.4mm · VU 창 0.17mm · 시계 숫자판 1mm): 방 전체 구도(카메라 약 15m)에선 깊이 값이 뒤 면과 겹쳐
      //  점무늬로 가려짐 → 깊이를 카메라 쪽으로 살짝 당김 (재질을 복제해도 따라감)
      for (const n of ["prop_cs_np_cover", "prop_cs_vinyl_box_cover", "Amp_VU_Faces", "Amp_VU_Needle_L", "Amp_VU_Needle_R",
        ...["hour", "min"].flatMap((k) => ["top", "bot", "flap"].map((s) => `prop_cs_clock_${k}_${s}`))]) {
        root.getObjectByName(n)?.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -8; }
        });
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
          // 방은 구운 그림이라 Blender 에서 온 램프 조명(점 9 · 스폿 1)은 빛을 받는 몇 재질(턴테이블 · 재킷 · 판 · 시계)에만 닿음
          //  그런데 조명 하나마다 그 재질들의 셰이더가 길어져서, 셰이더 하나를 처음 쓸 때 0.35~0.75초씩 화면이 멈췄음 (합 약 9초 — 로딩 · 페이지 전환의 버벅임, 2026-11-17)
          //  → 구운 그림을 쓸 때는 이 조명들을 처음부터 끔 (도중에 켜고 끄면 셰이더가 다시 만들어지므로 늘 꺼 둠). ?lamps=1 이면 예전처럼 켬 (비교용)
          if (LAMPS_OFF) o.visible = false;
          const hp = new THREE.PointLightHelper(o, 0.08); hp.visible = false; scene.add(hp); st.helpers.push(hp);
        }
      });

      // 처음 상태: 턴테이블이 화면 가운데 (pivot_root 가 방을 옮겨 둔 자리)
      seekClip(0);
      st.seat0 = st.seat.getWorldPosition(new THREE.Vector3());
      {
        // 플래터(매트 포함)의 윗면이 판 자리보다 얼마나 높은지 → 얇은 판을 그만큼 올려 놓음 (+0.4mm 띄움)
        const top = new THREE.Box3();
        st.platter?.traverse((o) => { if (o.isMesh && /rubber/.test(o.material?.name ?? "")) top.expandByObject(o); });     // 고무 매트만 (가운데 축 핀은 빼고)
        st.seatLift = top.isEmpty() ? 0 : Math.max(0, top.max.y - st.seat0.y) + 0.0004;
      }
      st.seatNow = st.seat0.clone();
      st.hover = st.seat0.clone().add(new THREE.Vector3(0, 0.42, 0));
      key.position.copy(st.seat0).add(new THREE.Vector3(0.35, 1.3, 0.9));
      key.target.position.copy(st.seat0);
      moon.position.copy(st.roomCenter).add(new THREE.Vector3(-6, 4, 1));
      moon.target.position.copy(st.roomCenter);

      st.disc = sleeveHero ? makeSleeveDisc(renderer) : rawHero ? makeRawDisc(vinyl.scene) : makeInkDisc(vinyl.scene);
      if (sleeveHero) {
        st.sleeve = createSleeveHero({
          st, renderer, scene, camera: storyCam, disc: st.disc, stage: stageRef.current, reduced: st.reduced,
          camAtHero: () => placeStoryCam(0),
          title: titleRef.current,
          cursor: curRefs.ring.current ? { ring: curRefs.ring.current, dot: curRefs.dot.current, shape: curRefs.shape.current, label: curRefs.label.current, tick: curRefs.tick.current } : null,
          onIndex: (i) => st.onSleeveIndex?.(i), onOpen: (o) => st.onSleeveOpen?.(o), onRecord: (i) => st.onSleeveRecord?.(i),
          // 고른 앨범의 커버를 창가 선반 "지금 듣는 판" 재킷에
          onPlay: (i) => { const a = st.sleeveFilled?.[i]; if (a && st.root) st.nowPlaying = applyNowPlaying(st.root, [a], 0, st.warmNowPlaying) ?? st.nowPlaying; st.setWall?.(st.nowPlaying); },
        });
        st.onSleeveReady?.();
      }
      // raw Hero: 판이 크림 바탕 한가운데 크게, 살짝 기울어 앞을 봄 (Home Hero 구도처럼: 기울기 40° · 화면에서 33° 돌아감)
      if (rawHero) {
        const camDir = new THREE.Vector3(0, 0.3, 1).normalize();   // P=0 카메라 쪽 (camKeys 의 heroDir)
        const face = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3().copy(UP).lerp(camDir, 0.62).normalize());
        st.heroQuat = new THREE.Quaternion().setFromAxisAngle(camDir, THREE.MathUtils.degToRad(-33)).multiply(face);
        st.heroPos = st.hover.clone();
      }
      scene.add(st.disc.root);
      if (inkHero) {
        const c = curRefs;
        st.hero = createInkHero({
          st, renderer, camera: storyCam, disc: st.disc, radius: DISC_R, reduced: st.reduced, stage: stageRef.current, title: titleRef.current,
          cursor: c.ring.current ? { ring: c.ring.current, dot: c.dot.current, shape: c.shape.current, label: c.label.current, tick: c.tick.current } : null,
          startAt: () => heroStartRef.current,
        });
        scene.add(st.hero.fxFrame);
      }

      st.ready = true;
      resize();
      // 미리 데우기: 처음 보이는 순간의 셰이더 컴파일·텍스처 업로드가 스크롤 중 끊김이 되지 않게 Hero 동안 끝내 둠
      //  (숨겨 둔 것도 잠깐 보이게 해서 같이 컴파일. 배경 이미지는 늦게 붙어 재질이 바뀌니 다 붙은 뒤 한 번 더)
      //  - 큰 그림(구운 빛 4K 등)을 GPU 에 올리는 일은 한 프레임에 몰면 길게 멈춤 → 프레임마다 두 장씩 나눠 올림
      //  - 끝나는 Promise: 다 데운 뒤 첫 로딩 화면이 걷히게 (markHomeReady)
      const uploaded = new WeakSet();
      // 다음 프레임 (탭이 뒤에 있어 화면을 그리지 않으면 requestAnimationFrame 이 멈추므로 시간으로도 넘어감)
      const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); });
      // 장면 전체를 잠깐 보이게 하고 fn 을 부른 뒤 되돌림 (숨겨 둔 것 · 화면 밖의 것까지 전부. 화면에는 아무것도 안 바뀜)
      //  빛은 켜고 끄지 않음: 빛 개수가 바뀌면 실제로는 안 쓰는 셰이더가 만들어짐
      const allShown = (fn) => {
        const shownNow = (o) => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
        const lightsOff = [], forced = [], unculled = [];
        scene.traverse((o) => { if (o.isLight && !shownNow(o)) lightsOff.push(o); });
        scene.traverse((o) => {
          if (o.isLight) return;
          if (!o.visible) { o.visible = true; forced.push(o); }
          if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine)) { o.frustumCulled = false; unculled.push(o); }
        });
        const lightWas = lightsOff.map((o) => o.visible);
        for (const o of lightsOff) o.visible = false;
        let out;
        try { out = fn(); } catch {}
        lightsOff.forEach((o, i) => { o.visible = lightWas[i]; });
        for (const o of forced) o.visible = false;
        for (const o of unculled) o.frustumCulled = true;
        return out;
      };
      // 다른 페이지에서 넘어오는 중(크레이트 전환)이면 착지할 때까지 기다림: 넘어오는 동안 무거운 일을 하면 전환이 끊김
      const landed = () => new Promise((r) => {
        const d = document.documentElement.dataset;
        if (d.crateTransition !== "true" || d.crateLanded === "true") return r();
        const done = () => { window.removeEventListener("crate:land", done); window.removeEventListener("crate:end", done); r(); };
        window.addEventListener("crate:land", done); window.addEventListener("crate:end", done);
        setTimeout(done, 2500);
      });
      const prewarm = async () => {
        if (st.disposed) return;
        await landed();
        if (st.disposed) return;
        // 한 번 적용해 둠: 남산 레이어의 잘라 내기 평면(clippingPlanes)이 처음 apply 에서 붙음 → 그 전에 컴파일하면 방이 지어지는 중에 다시 컴파일했음
        apply(0, 0, 0);
        const texs = new Set();
        scene.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const k of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "alphaMap", "lightMap"]) if (m?.[k] && !uploaded.has(m[k])) texs.add(m[k]);
            for (const t of m?.userData?.bakeTex ?? []) if (t && !uploaded.has(t)) texs.add(t);   // 구운 그림의 다른 상태(꺼짐 · 빈 방): 셰이더 안에서만 씀
          }
        });
        // 셰이더: 장면 전체를 맡기고 기다림 — 브라우저가 뒤에서 컴파일하므로 화면이 멈추지 않음 (숨겨 둔 것도 같은 빛 조건으로)
        //  화면에 그릴 때와 같은 조건(렌더 타깃 없음 = sRGB 출력 + 톤매핑)으로 맡겨야 실제로 쓰는 셰이더가 만들어짐
        const rt0 = renderer.getRenderTarget();
        renderer.setRenderTarget(null);
        const compiled = allShown(() => renderer.compileAsync(scene, storyCam))?.catch(() => {});   // 그릴 목록은 부르는 순간 모음 → 바로 되돌려도 됨
        renderer.setRenderTarget(rt0);
        // 다 되면(길어도 8초) 그리기 시작
        const compiledOrLate = Promise.race([compiled, new Promise((r) => setTimeout(r, 8000))]);
        compiledOrLate.then(() => st.release());
        post.prewarm();
        st.warmHero?.();   // Hero ↔ 방 겹침 셰이더 (Home 엔진이 아직이면 엔진이 준비될 때 onEngine 에서)
        // 그림: 첫 로딩 화면 뒤에서는 프레임마다 두 장, 화면이 이미 보이는 중(페이지 전환으로 들어옴)이면 두 프레임에 한 장 (4K 한 장에 20~40ms)
        let n = 0;
        for (const t of texs) {
          if (st.disposed) return;
          renderer.initTexture(t); uploaded.add(t);
          if (document.querySelector(".preloader")) { if (++n % 2 === 0) await nextFrame(); }
          else { await nextFrame(); await nextFrame(); }
        }
        await compiledOrLate;
        // 장면 전체를 미리 한 번씩 그림: 메시 · 그림 · 그림자 셰이더가 스크롤 도중(판이 나올 때 · 턴테이블이 올라올 때 · 방이 지어질 때)이 아니라 지금 GPU 에 올라가게
        //  화면의 왼쪽 아래 1px 에만 그림 (scissor). 작은 렌더 타깃에 그리면 안 됨: 출력 조건이 달라 화면용과 다른 셰이더가 한 벌 더 만들어지고,
        //   그 컴파일이 화면을 막았음 — 빛 받는 재질 하나에 0.15~0.75초, 합 6~9초 (로딩 · 페이지 전환 버벅임의 원인, 2026-11-17)
        //  한 번에 다 그리지도 않음: 준비된 셰이더도 처음 쓰는 순간 몇 ms 가 들어서, 새 재질 몇 개씩 프레임마다 나눔
        //   (첫 로딩 화면 뒤에서는 크게 = 빨리, 화면이 이미 보이는 중이면 작게 = 안 끊기게)
        if (!st.disposed) {
          const meshes = [];
          scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) meshes.push(o); });
          const seen = new Set();
          let i = 0;
          while (i < meshes.length && !st.disposed) {
            const per = document.querySelector(".preloader") ? 8 : 1;
            const batch = new Set();
            let fresh = 0;
            for (; i < meshes.length && batch.size < 60; i++) {
              const ms = [meshes[i].material].flat().filter((m) => m && !seen.has(m));
              if (fresh && fresh + ms.length > per) break;
              for (const m of ms) seen.add(m);
              fresh += ms.length;
              batch.add(meshes[i]);
            }
            allShown(() => {
              const off = meshes.filter((o) => !batch.has(o));
              for (const o of off) o.visible = false;
              const prev = renderer.getRenderTarget();
              renderer.setRenderTarget(null);
              renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
              try { renderer.render(scene, storyCam); } catch {}
              renderer.setScissorTest(false);
              renderer.setRenderTarget(prev);
              for (const o of off) o.visible = true;   // (allShown 이 원래대로 되돌림)
            });
            await nextFrame();
          }
        }
        // Hero 가 덮고 있는 동안(캔버스는 Hero 뒤라 안 보임) 시작 자세로 한 번 그림: 판·후처리 패스까지 실제로 한 바퀴
        if (st.inHero && !st.disposed) {
          const shown = st.disc?.root ? st.disc.root.visible : null;
          if (st.disc?.root) st.disc.root.visible = true;
          apply(0, 0, 0); placeStoryCam(0); storyCam.updateMatrixWorld();
          // 잘라 내기 평면이 붙은 재질(남산)은 compile 로는 맞는 셰이더가 안 나옴 → 화면 밖이어도 실제로 한 번 그림
          const env = st.env.group, envShown = env.visible, culled = [];
          env.visible = true;
          env.traverse((o) => { if (o.isMesh && o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
          renderer.render(scene, storyCam); post.run();
          env.visible = envShown;
          for (const o of culled) o.frustumCulled = true;
          if (shown != null) st.disc.root.visible = shown;
        }
      };
      // 턴테이블만은 구운 그림 대신 실시간 재질 + 움직이는 빛 (turntableLook.js). 구운 그림을 입힌 뒤에 바꿈. ?ttlive=0 이면 예전 그대로 (비교용)
      const liveTurntable = () => {
        if (st.disposed || st.ttLook || new URLSearchParams(location.search).get("ttlive") === "0") return;
        st.ttEnv = st.sleeve?.envMap ?? makeEnvironment(renderer);
        st.ttLook = applyTurntableLook({ root: st.ttRise, envMap: st.ttEnv, key, renderer, casters: [st.disc.root] });
      };
      // 같은 면에 겹쳐 있는 판재: 이웃 옥상 벤치의 널(등받이 · 앉는 판)이 기둥과 같은 깊이라 조각조각 번갈아 보였음(z-fighting)
      //  → 널을 카메라 쪽으로 살짝 당겨 늘 기둥 앞에 보이게. 재질은 다른 물체와 같이 쓰므로 복제해서 이 메시에만 (구운 재질의 셰이더 훅도 같이 넘김)
      const frontFaces = () => {
        for (const name of ["nb_left_bench_1"]) {
          const o = root.getObjectByName(name);
          if (!o?.isMesh || Array.isArray(o.material) || o.material.userData.frontFace) continue;
          const src = o.material, c = src.clone();
          c.onBeforeCompile = src.onBeforeCompile; c.customProgramCacheKey = src.customProgramCacheKey;
          c.polygonOffset = true; c.polygonOffsetFactor = -2; c.polygonOffsetUnits = -8; c.userData.frontFace = true;
          o.material = c;
        }
        // 건물 창: 유리 · 불 켜진 창 · 창틀이 벽에서 3~10mm 만 떠 있음 → 멀리서 보는 구도(특히 휴대폰)에서 벽과 번갈아 보였음(z-fighting)
        //  → 창을 카메라 쪽으로 당기고, 창틀은 조금 더 (재질은 창들끼리만 쓰므로 그대로 바꿈)
        const pull = (names, f) => {
          for (const name of names) for (const m of [root.getObjectByName(name)?.material].flat()) {
            if (m) { m.polygonOffset = true; m.polygonOffsetFactor = -f; m.polygonOffsetUnits = -4 * f; }
          }
        };
        pull(["nb_left_windows_1", "nb_left_windows_2", "nb_right_windows_1", "nb_right_windows_2", "building001_1", "building001_2", "building001_3"], 2);
        pull(["nb_left_windows_3", "nb_left_windows_4", "nb_right_windows_3", "building001_4"], 3);
      };
      // 구운 빛 (?bake=0 이면 끄고 실시간 조명으로 비교). 재질이 바뀌니 다 입힌 뒤 한 번 더 미리 데움
      const lit = new URLSearchParams(location.search).get("bake") !== "0"
        ? applyLightmaps(root, renderer).then((n) => { liveTurntable(); frontFaces(); st.baked = n; st.setupInteract(); }).catch(() => { liveTurntable(); frontFaces(); st.setupInteract(); })
        : Promise.resolve().then(() => { liveTurntable(); frontFaces(); st.setupInteract(); });
      // 방 · 바깥 배경 · 구운 빛이 다 붙은 뒤 한 번에 데우고 → 준비 끝
      Promise.all([lit, st.env.ready.catch(() => {})]).then(prewarm).finally(() => { st.release(); st.warmAt = performance.now(); gateRef.current.room.resolve(); });
      setInfo({
        loadMs: Math.round(performance.now() - t0),
        size: roomBox.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(" × "),
        clip: `${st.clip.name} · ${st.clip.duration.toFixed(2)}s`,
        cams: Object.keys(st.gltfCams),
      });
    }).catch((e) => { setError(String(e?.message || e)); st.release(); gateRef.current.room.resolve(); });

    // ── 카메라: 진행도 구간별 키 (목표점 · 방향 · 거리)
    const fit = (r, fov = FOV0) => {
      const vf = THREE.MathUtils.degToRad(fov);
      const hf = 2 * Math.atan(Math.tan(vf / 2) * storyCam.aspect);
      return r / Math.sin(Math.min(vf, hf) / 2);
    };
    // 방 완성 구도 = 배경 기준 카메라. 화면이 16:9 보다 좁으면 방이 잘리지 않게 그만큼 물러남
    const roomFov = () => 2 * Math.atan(Math.tan((st.rig.fov / 2) * D2R) / ROOM_ZOOM) / D2R;
    const roomKey = (p) => ({ p, t: st.rig.target, d: new THREE.Vector3().setFromSpherical(st.base.sph).normalize(),
      r: st.base.sph.radius * Math.max(1, ASPECT / storyCam.aspect), f: roomFov() });
    const heroDir = new THREE.Vector3(0, 0.3, 1).normalize();
    const darkDir = new THREE.Vector3(0.05, 0.42, 1).normalize();
    const landDir = new THREE.Vector3(0.15, 0.6, 1).normalize();
    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const camKeys = () => [
      { p: 0, t: st.hover, d: heroDir, r: fit(0.2) },
      { p: STORY.heroEnd, t: st.hover, d: heroDir, r: fit(0.2) },
      { p: STORY.dark[0] + STORY.dark[1], t: st.hover, d: darkDir, r: fit(0.6) },
      { p: 0.27, t: st.seat0.clone().add(v3(0, 0.2, 0)), d: darkDir, r: fit(0.55) },
      // 착지 뒤에는 지금 판 자리를 따라감 (콘솔이 턴테이블을 들어 올리고, 방이 옆으로 옮겨 감)
      { p: STORY.land[0] + STORY.land[1], t: st.seatNow.clone().add(v3(0, 0.05, 0)), d: landDir, r: fit(0.42) },
      // 착지 뒤에는 중간 경유 없이 방 완성 구도로 곧장 (중간 키가 있으면 위로 솟았다 멀어지는 느낌이 남)
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
      // Hero 렌즈: Hero(직교 카메라)에서 막 넘어온 동안은 화각을 좁히고 그만큼 뒤로 물러남(dolly zoom)
      //  → 판 크기·자리는 그대로, 원근 왜곡만 줄어 Hero 판과 같은 납작한 모양. 이야기가 나아가며(HERO_LENS_P) 원래 렌즈로
      let fov = out[7];
      const lens = st.lensRef ? 1 - easeInOut(seg(p, HERO_LENS_P)) : 0;
      if (lens > 0) {
        const tanF = Math.tan((fov / 2) * D2R), tanN = tanF * THREE.MathUtils.lerp(1, HERO_LENS, lens);
        storyCam.position.addScaledVector(_d, st.lensRef * (tanF / tanN - 1));   // 판 거리(lensRef)에 있는 것은 같은 크기
        fov = (2 * Math.atan(tanN)) / D2R;
      }
      if (Math.abs(storyCam.fov - fov) > 1e-4) { storyCam.fov = fov; storyCam.updateProjectionMatrix(); }
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
    // 늦은 밤: 스크롤을 따라 방 전체 구도 → 턴테이블 가까이 (보는 방향은 거의 그대로, 살짝 내려다보게). 되돌리면 물러남
    const _pc = new THREE.Vector3(), _pd = new THREE.Vector3(), _pq = new THREE.Quaternion(), _pm = new THREE.Matrix4();
    const pushToTurntable = () => {
      const e = st.reduced ? 0 : easeInOut(st.nightPush ?? 0);
      if (e <= 0 || !st.seatNow) return;
      storyCam.getWorldDirection(_pd);
      _pd.y -= NIGHT_PUSH.lift; _pd.normalize();
      const tanH = Math.tan((storyCam.fov / 2) * D2R);
      const d = NIGHT_PUSH.size / (NIGHT_PUSH.fill * 2 * tanH * Math.min(1, storyCam.aspect));
      _pc.copy(st.seatNow).addScaledVector(_pd, -d);
      storyCam.position.lerp(_pc, e);
      _pm.lookAt(storyCam.position, st.seatNow, storyCam.up);
      _pq.setFromRotationMatrix(_pm);
      storyCam.quaternion.slerp(_pq, e);
    };
    // ── 방 안 상호작용 (방 완성 칸에서만): 턴테이블 = 재생 · 멈춤, 램프 = 끄고 켬. 올리면 커서 · 이름표 · 살짝 들림
    const sound = createRoomSound();
    st.sound = sound;
    st.music = createRoomMusic(musicHostRef.current, (m) => { st.musicPlaying = m.playing; setMusic(m); });   // 턴테이블 음악 (YouTube) · 카드 상태는 setMusic 으로
    st.playing = true;                  // 판: 33⅓ 이 되면 돌고 있음 (누르면 멈춤)
    st.armK = 1;
    st.lampUser = {}; st.lampK = {};    // 램프 pivot → 켬(1) · 끔(0), 부드럽게 따라가는 값
    st.targets = [];
    st.hoverTarget = null;
    // 늦은 밤(페이지 끝에서 방이 다시 나올 때) 표시. 방 안 물체를 다시 눌러 볼 수 있게 하는 데만 씀
    st.lateNight = false;
    st.setNight = (on) => {
      if (on === st.lateNight) return;
      st.lateNight = on;
      // 2026-11-15 사용자 결정: 끝에서 다시 나오는 방도 불을 다 켠 채로 (예전: 탁상 램프 하나만 남김)
    };
    const LAMP_NODES = { pivot_lamp_floor: ["lamp_floor", "lamp_floor_shade"], pivot_lamp_table: ["lamp_table"], pivot_lamp_window: ["lamp_window"], pivot_lamp_circle: ["lamp_circle"] };
    st.setupInteract = () => {
      const root = st.root;
      st.targets = [{ key: "turntable", objs: [st.ttRise, st.disc?.root].filter(Boolean), liftK: 0 }];
      for (const [pivot, names] of Object.entries(LAMP_NODES)) {
        const objs = names.map((n) => root.getObjectByName(n)).filter(Boolean);
        if (!objs.length) continue;
        st.lampUser[pivot] = 1; st.lampK[pivot] = 1;
        // 구운 재질은 램프끼리 같이 씀 → 램프마다 복제해서 끈 램프의 갓만 어둡게
        const mats = [];
        if (st.baked) for (const o of objs) o.traverse((m) => {
          if (!m.isMesh || Array.isArray(m.material)) return;
          const src = m.material, c = src.clone();
          c.onBeforeCompile = src.onBeforeCompile;
          c.customProgramCacheKey = src.customProgramCacheKey;
          m.material = c; mats.push(c);
        });
        st.targets.push({ key: pivot, lamp: true, objs, mats, base: objs.map((o) => o.position.y), liftK: 0 });
      }
      // 벽 선반 커버: 누르면 그 판으로 바꿔 틂 (판 바꾸기)
      for (const c of st.covers) {
        const mesh = c.face.parent;
        if (mesh) st.targets.push({ key: c.pivot, cover: c, objs: [mesh], base: [mesh.position.y], liftK: 0 });
      }
      // 그 밖의 소품 (레코드 상자 · 지금 듣는 판 · 책 · 스피커 · 앰프 · 커튼 · 창문 · 벽 그림 · 컵): roomProps.js
      const props = setupRoomProps({ st, root, makeCoverFace, sound, camera: storyCam });
      st.targets.push(...props.targets);
      st.propsTick = props.tick;
    };

    // ── 판 바꾸기 (벽 선반 커버를 누르면, 2026-11-19)
    //  재킷은 날아가지 않음 (선반은 방 오른쪽 벽, 지금 듣는 판은 창가 콘솔이라 2.6m 를 가로질러 어색했음): 제자리에서 카드처럼 돌며 그림이 바뀜
    //   선반 커버 → 이전 앨범, 이어서 지금 듣는 판 재킷 → 새 앨범. 판은 덮개가 열리면 떠올라 한 바퀴 돌며 라벨이 바뀜
    //  바늘 들림 → 덮개 열림 · 선반 커버 돎 → 거치대 재킷 돎 · 판 떠오름 → 라벨 바뀜 → 판 앉음 · 덮개 닫힘 → 바늘 내려감 (겹쳐서 약 3초)
    //  도중에 다시 누르면 빠르게 끝냄 · 동작 줄이기면 바로 바뀜. 바뀐 앨범은 st.onRecordChange(album) 으로 알림 (음악 재생 D 에서 씀)
    const SWAP = {
      wall: [0.1, 0.7], np: [0.45, 0.7],   // 카드 돌기 [시작, 길이]: 선반 커버 · 지금 듣는 판 재킷
      lidAt: 0.12,                         // 덮개가 열리기 시작
      lift: 0.04, liftDur: 0.45, hold: 0.2,   // 판이 떠오르는 높이 (m) · 오르내리는 시간 · 떠 있는 시간
      tail: 0.6,                           // 바늘이 내려간 뒤 끝나기까지
      fast: 3,                             // 도중에 다시 누르면 이 배속으로
    };
    const _fm = new THREE.Matrix4(), _fm2 = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fv = new THREE.Vector3();
    // 지금 듣는 판 재킷: prop_cs_np 는 three 에서 그룹 = 나무 거치대(prop_cs_np_1) + 재킷(prop_cs_np_2, sleeve 재질) + 그림(prop_cs_np_cover)
    //  거치대는 그대로 두고 재킷 + 그림만 돌림. 앞면 기준 판은 재킷에 붙임 (보이지 않음)
    const npParts = () => {
      if (st.npParts) return st.npParts;
      const np = st.root?.getObjectByName("prop_cs_np");
      if (!np) return null;
      let sleeve = null, best = -1;
      np.traverse((o) => {
        if (!o.isMesh || o.userData.swapRef || o.name.startsWith("prop_cs_np_cover")) return;
        const nm = [o.material].flat().map((m) => m?.name ?? "").join(" ");
        o.geometry.computeBoundingBox();
        const s = o.geometry.boundingBox.getSize(new THREE.Vector3()), a = s.x * s.y + s.y * s.z + s.z * s.x;
        const score = (/sleeve/i.test(nm) ? 1e6 : 0) + a;   // 재질 이름에 sleeve 가 있으면 그것, 없으면 겉넓이가 큰 것
        if (score > best) { best = score; sleeve = o; }
      });
      if (!sleeve) return null;
      const cover = st.root.getObjectByName("prop_cs_np_cover");
      const { face } = makeCoverFace(sleeve, st.roomCenter);
      face.visible = false; face.userData.swapRef = true;
      return (st.npParts = { objs: [sleeve, cover].filter(Boolean), face, cover });
    };
    // 카드 돌기: 재킷을 앞면 가운데 · 앞면의 '위' 축으로, 카메라에서 정확히 옆면이 보이는 각도(θ)까지 돌렸다가 되돌아옴
    //  그 순간(옆면)에 그림을 바꿈 → 바뀌는 순간이 보이지 않고, 앞면은 늘 카메라 쪽 (예전: 90° 를 돌아 비스듬한 카메라에서는 검은 뒷면이 보였음)
    //  돌 때 반대쪽 절반이 벽 · 선반 속으로 들어가지 않게 그만큼 앞으로 꺼냄
    //  돌기는 월드에서 (부모 pivot 에 크기가 있어도 찌그러지지 않게): 새 지역 = P⁻¹ × T(c + n·pop) × R(axis, θ) × T(-c) × P × 원래
    const makeFlip = (objs, face, [at, dur], onEdge) => {
      face.updateMatrixWorld(true);
      const fw = face.matrixWorld;
      const c = new THREE.Vector3().setFromMatrixPosition(fw);
      const axis = new THREE.Vector3().setFromMatrixColumn(fw, 1).normalize();
      const n = new THREE.Vector3().setFromMatrixColumn(fw, 2).normalize();
      const half = (face.geometry.parameters.width * new THREE.Vector3().setFromMatrixColumn(fw, 0).length()) / 2;
      // 옆면이 되는 각: n(θ) = n cosθ + (a×n) sinθ 가 카메라 방향 v 와 수직 → tanθ = -(n·v) / ((a×n)·v), 작은 쪽
      const v = storyCam.position.clone().sub(c).normalize(), b = new THREE.Vector3().crossVectors(axis, n);
      const bv = b.dot(v);
      let theta = Math.abs(bv) < 1e-4 ? Math.PI / 2 : Math.atan(-n.dot(v) / bv);
      if (Math.abs(theta) < 0.2) theta = Math.sign(theta || 1) * (Math.PI / 2);   // 거의 옆에서 보는 경우: 그냥 90°
      const pop = half * Math.abs(Math.sin(theta)) * 1.1 + 0.01;
      const parts = objs.map((obj) => { obj.updateMatrixWorld(true); const P = obj.parent.matrixWorld.clone(); return { obj, base: obj.matrix.clone(), P, Pinv: P.clone().invert() }; });
      return { parts, at, dur, onEdge, edged: false, c, axis, n, theta, pop };
    };
    const flipAt = (f, t) => {
      const k = clamp01((t - f.at) / f.dur);
      if (k >= 0.5 && !f.edged) { f.edged = true; f.onEdge(); }
      const e = f.theta * easeInOut(k < 0.5 ? k * 2 : 2 - k * 2);   // 0 → θ(옆면) → 0
      const pop = f.pop * Math.sin(Math.PI * k);
      for (const p of f.parts) {
        _fm.copy(p.Pinv)
          .multiply(_fm2.makeTranslation(_fv.copy(f.c).addScaledVector(f.n, pop)))
          .multiply(_fm2.makeRotationFromQuaternion(_fq.setFromAxisAngle(f.axis, e)))
          .multiply(_fm2.makeTranslation(_fv.copy(f.c).negate()))
          .multiply(p.P).multiply(p.base);
        _fm.decompose(p.obj.position, p.obj.quaternion, p.obj.scale);
      }
    };
    const endFlip = (f) => { for (const p of f.parts) p.base.decompose(p.obj.position, p.obj.quaternion, p.obj.scale); if (!f.edged) { f.edged = true; f.onEdge(); } };
    // 그림 바꾸기. glTF 재킷은 flipY=false, 선반 판은 기본(true) → 같은 그림을 뒤집기만 다르게 복제
    //  그림은 미리 ImageBitmap 으로 풀어 둠(predecode): 선반용은 위아래를 뒤집어서, 거치대(glTF UV)용은 그대로 → 그 뒤로는 flipY 가 듣지 않음
    //  (예전: flipY 만 바꿔 옮겨서 옮긴 그림이 거꾸로 나왔음) → 그림마다 풀린 방향(userData.orient)을 적어 두고, 다른 자리로 가면 UV 를 위아래로 뒤집음
    const reTex = (tex, slot) => {
      if (!tex) return null;
      const t = tex.clone();
      t.userData = { ...tex.userData };
      const flip = (t.userData.orient ?? slot) !== slot;
      t.repeat.set(1, flip ? -1 : 1); t.offset.set(0, flip ? 1 : 0);
      t.needsUpdate = true;
      return t;
    };
    const wallArt = (s) => {
      const c = s.cover, tex = reTex(s.npTex, "wall");
      if (tex) { c.mat.map = tex; c.mat.emissiveMap = tex; c.mat.color.set("#ffffff"); c.mat.needsUpdate = true; }
      else if (s.old) { c.mat.map = null; c.mat.emissiveMap = null; c.mat.color.set(s.old.color || "#8a7f86"); c.mat.needsUpdate = true; }
      c.album = s.old?.slug; c.albumObj = s.old;
    };
    const npArt = (s) => {
      const np = s.npCover, tex = reTex(s.wallTex, "np");
      if (np?.material && tex) { np.material.map = tex; np.material.needsUpdate = true; }
      st.nowPlaying = s.next;
      st.onRecordChange?.(s.next);
    };
    const setRecordLabel = (a) => { if (a) st.disc?.record?.setLabel(drawLabel({ title: a.title, artist_names: a.artist }, a.color || "#8a7f86")); };
    const startSwap = (c) => {
      const next = c.albumObj, mesh = c.face.parent, np = npParts();
      if (!next || !mesh || !np) return;
      const npCover = np.cover;
      // 바꾸기 전 그림 (원래 그림은 버리지 않고 끝날 때 정리)
      const s = { t: 0, cover: c, next, old: st.nowPlaying, npCover, wallTex: c.mat.map, npTex: npCover?.material?.map, labelDone: false };
      // 처음 받은 그림이면 풀린 방향을 적어 둠 (선반 = 뒤집어 풂, 거치대 = 그대로). 옮겨 간 그림은 이미 적혀 있음
      if (s.wallTex && !s.wallTex.userData.orient) s.wallTex.userData.orient = "wall";
      if (s.npTex && !s.npTex.userData.orient) s.npTex.userData.orient = "np";
      const cleanup = () => { if (s.wallTex && s.wallTex !== c.mat.map) s.wallTex.dispose(); if (s.npTex && s.npTex !== npCover?.material?.map) s.npTex.dispose(); };
      if (st.reduced) {
        wallArt(s); npArt(s); setRecordLabel(next); cleanup(); st.playing = true;
        return;
      }
      const L = st.lid ? st.lid.open.getClip().duration : 0;
      s.liftAt = Math.max(SWAP.np[0] + SWAP.np[1] * 0.5, SWAP.lidAt + L * 0.6);
      s.liftEnd = s.liftAt + SWAP.liftDur * 2 + SWAP.hold;
      s.dropAt = s.liftEnd + (st.lid ? st.lid.closeEnd : 0) * 0.75;
      s.flips = [makeFlip([mesh], c.face, SWAP.wall, () => wallArt(s)), makeFlip(np.objs, np.face, SWAP.np, () => npArt(s))];
      s.flipEnd = Math.max(SWAP.wall[0] + SWAP.wall[1], SWAP.np[0] + SWAP.np[1]);
      s.end = Math.max(s.dropAt + SWAP.tail, s.flipEnd);
      s.cleanup = cleanup;
      if (st.playing) sound.needleUp();
      st.playing = false;       // 바늘이 들리고 판이 느려짐
      st.swap = s;
    };
    st.startSwap = startSwap;   // 콘솔 확인용 (window.__room.startSwap(window.__room.covers[0]))
    // 매 프레임 (apply 의 호버 처리 뒤): 시간을 흘리고 재킷을 돌림. 덮개 · 바늘 · 판 높이는 apply 의 각 자리에서 st.swap 을 읽음
    const updateSwap = (dt) => {
      const s = st.swap;
      if (!s) return;
      s.t += dt * (s.fast ? SWAP.fast : 1);
      const t = s.t;
      if (!s.flipsDone) {
        if (t < s.flipEnd) for (const f of s.flips) flipAt(f, t);
        else { s.flipsDone = true; s.flips.forEach(endFlip); s.cleanup(); }
      }
      s.lidOpen = t >= SWAP.lidAt && t < s.liftEnd;
      const up = easeInOut(clamp01((t - s.liftAt) / SWAP.liftDur)) * (1 - easeInOut(clamp01((t - s.liftAt - SWAP.liftDur - SWAP.hold) / SWAP.liftDur)));
      s.lift = SWAP.lift * up;
      s.spin = Math.PI * 2 * easeInOut(clamp01((t - s.liftAt) / (s.liftEnd - s.liftAt)));
      if (!s.labelDone && t >= s.liftAt + SWAP.liftDur + SWAP.hold * 0.5) { s.labelDone = true; setRecordLabel(s.next); }
      if (!s.dropped && t >= s.dropAt) { s.dropped = true; st.playing = true; sound.needleDown(); }
      if (t >= s.end) st.swap = null;
    };
    const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
    const canInteract = () => st.ready && !st.inHero && st.camMode === "story" && !st.tween && st.targets.length > 0
      && st.p >= STORY.camFinal && st.p <= STORY.roomHold + 0.005 && (st.lateNight || pageTop() < roomScrollEnd());
    // 방 완성 화면이 보이는 스크롤 끝: 한 장면 흐름(Home)은 판 · 방 구간(travel + hold) 뒤부터 섹션이 올라오므로 그 뒤 0.25화면까지
    //  (예전엔 늘 0.25화면 → Home 에서는 방이 완성될 때 이미 한 화면 넘게 내려와 있어 턴테이블 · 램프 클릭이 전혀 안 됐음, 2026-11-19)
    const roomScrollEnd = () => ((st.scrollFlow ? FLOW.travel + FLOW.hold : 0) + 0.25) * innerHeight;
    const pick = (e) => {
      if (!canInteract() || e.target !== renderer.domElement) return null;
      const r = renderer.domElement.getBoundingClientRect();
      _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
      ray.setFromCamera(_ndc, storyCam);
      let best = null, bestD = Infinity;
      for (const t of st.targets) for (const o of t.objs) {
        const h = ray.intersectObject(o, true)[0];
        if (h && h.distance < bestD) { bestD = h.distance; best = t; }
      }
      return best;
    };
    const tipText = (t) => (t.key === "turntable" ? (st.playing ? "Stop ■" : "Play ▸")
      : t.cover ? `Play ▸ ${t.cover.albumObj?.title ?? ""}`.trim()
      : t.tip ? t.tip()
      : st.lampUser[t.key] ? "Light off" : "Light on");
    const showTip = (t, e) => {
      const el = tipRef.current;
      if (!el) return;
      if (!t) { el.style.opacity = "0"; return; }
      el.textContent = tipText(t);
      el.style.opacity = "1";
      if (e) el.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 16}px)`;
    };
    const setHover = (t, e) => {
      st.hoverTarget = t;
      renderer.domElement.style.cursor = t ? "pointer" : "";
      showTip(t, e);
    };
    const onPointer = (e) => {
      st.ptr.set((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
      setHover(pick(e), e);
    };
    // 재생 · 멈춤 (턴테이블 클릭 · 음악 카드 버튼): 바늘이 들리거나 내려가고, 음악도 따라감. 누르면 닫았던 음악도 다시 켬
    st.togglePlay = () => {
      if (st.swap) { st.swap.fast = true; return; }
      if (st.playing && st.musicOff) { st.musicOff = false; return; }   // 판은 도는데 음악 카드를 닫았던 경우: 음악만 다시 켬
      st.playing = !st.playing;
      if (st.playing) { st.musicOff = false; sound.needleDown(); } else sound.needleUp();
    };
    st.closeMusic = () => { st.musicOff = true; st.music?.stop(); };
    // 소품 메뉴 카드: 물체 윗면 가운데의 화면 자리에 띄움 (카메라는 방 완성 구도에서 거의 움직이지 않으므로 열 때 한 번만 잼)
    const _mb = new THREE.Box3(), _mv = new THREE.Vector3();
    st.openMenu = (m) => {
      _mb.setFromObject(m.obj);
      _mv.set((_mb.min.x + _mb.max.x) / 2, _mb.max.y, (_mb.min.z + _mb.max.z) / 2).project(storyCam);
      const r = renderer.domElement.getBoundingClientRect();
      st.menuOpen = true;
      setHover(null);
      setPropMenu({ ...m, obj: undefined, x: r.left + (_mv.x + 1) / 2 * r.width, y: r.top + (1 - _mv.y) / 2 * r.height });
    };
    st.closeMenu = () => { if (!st.menuOpen) return; st.menuOpen = false; setPropMenu(null); };
    const onMenuKey = (e) => { if (e.key === "Escape") st.closeMenu(); };
    window.addEventListener("keydown", onMenuKey);
    const onClick = (e) => {
      if (e.target?.closest?.("[data-prop-menu]")) return;   // 카드 안을 누른 것
      st.closeMenu();
      const t = pick(e);
      if (!t) return;
      if (st.swap) { st.swap.fast = true; return; }   // 판을 바꾸는 중: 남은 동작을 빠르게 끝냄
      if (t.cover) { setHover(null); startSwap(t.cover); return; }
      if (t.click) { t.click(t); showTip(t, e); return; }
      if (t.key === "turntable") st.togglePlay();
      else {
        st.lampUser[t.key] = st.lampUser[t.key] ? 0 : 1;
        sound.click();
      }
      showTip(t, e);
    };
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("click", onClick);

    // Home 엔진의 판(직교 카메라 화면 위 자세)을 이 장면의 P=0 카메라 앞 같은 화면 자리·크기·기울기로
    //  Hero 동안은 매 프레임 (Home 엔진이 판 자세 · 인트로 · 누르기 반응을 정하고, 그리는 건 이 판 한 장)
    //  회전각은 이 판이 스스로 이어 감(ownSpin): 기울기 틀(tiltQuat)만 받고 속도(omega)를 따라 돎 → 넘어가거나 돌아올 때 무늬가 튀지 않음
    const takeHero = (pose) => {
      st.lensRef = null;   // 자리는 원래 렌즈 기준으로 잡고, 렌즈 기준 거리(lensRef)는 아래에서
      placeStoryCam(0);
      storyCam.updateMatrixWorld();
      const r = st.canvasRect ??= renderer.domElement.getBoundingClientRect();   // 크기가 바뀌면 resize 가 지움
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
      st.heroQuat = q.clone().multiply(pose.tiltQuat ?? pose.quat);
      st.lensRef = D;
      // 판 루트는 아랫면 기준, Home 은 가운데 기준 → 판 축 방향으로 그만큼 내림
      st.heroPos.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(st.heroQuat), inkDefaults.botY * 1.8 * DISC_R);
      (st.heroInk ??= new THREE.Color()).setRGB(pose.ink.x, pose.ink.y, pose.ink.z);
      (st.heroLabel ??= new THREE.Color()).setRGB(pose.label.x, pose.label.y, pose.label.z);
      st.heroOmega = pose.omega ?? -RPM(10);   // Hero 동안 이 속도로 돎 (Home 은 +omega, 이 판은 -ownVel 방향)
      if (!pose.tiltQuat) st.ownSpin = 0;      // (예전 엔진: 회전각이 quat 에 들어 있음)
    };
    // 바탕: Home 과 같은 테마 값 (다크 모드면 크림 ↔ 잉크가 바뀌어 있음). 테마가 바뀔 때만 다시 읽으면 되지만 가벼워서 Hero 로 들어올 때마다
    const readHeroBg = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--cream").trim();
      st.heroBg = bg ? new THREE.Color(bg) : CREAM.clone();
      st.themeCream = st.heroBg.clone();
    };
    st.takeHero = takeHero;

    // ── 진행도 → 장면
    const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _yaw = new THREE.Quaternion(), _p = new THREE.Vector3();
    const _qComp = new THREE.Quaternion(), _qInvC = new THREE.Quaternion(), _fwd = new THREE.Vector3(), _hv = new THREE.Vector3(), _hflat = new THREE.Vector3(), _hm = new THREE.Vector3(), _hl = new THREE.Vector3(), _eye = new THREE.Vector3();
    const _inv = new THREE.Matrix4(), _view = new THREE.Vector3(), _flat = new THREE.Vector3(), _major = new THREE.Vector3(), _half = new THREE.Vector3(), _light = new THREE.Vector3();
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.0);
    const _zero2 = new THREE.Vector2();
    const _dc = new THREE.Vector3(), _dc2 = new THREE.Vector3(), DISC_C = -inkDefaults.botY * 1.8 * DISC_R;
    const UP = new THREE.Vector3(0, 1, 0);
    const apply = (p, dt, time) => {
      // 방: Blender reveal 클립을 그대로 (진행도 → 클립 시간, 선형)
      // 턴테이블: 어둠 아래에서 올라옴 (클립 시작 전, 웹 연출)
      const rise = easeInOut(seg(p, STORY.ttRise));
      // 방 안 상호작용: 방 완성 칸을 벗어나면 이름표를 숨기고, 이야기 앞쪽으로 돌아가면 처음 상태(판 재생 · 램프 켬)로
      if (st.hoverTarget && !canInteract()) setHover(null);
      if (st.menuOpen && !canInteract()) st.closeMenu();   // 스크롤해서 방을 벗어나면 메뉴 카드도 닫음
      if (p < STORY.camFinal - 0.05) { st.playing = true; for (const k in st.lampUser) st.lampUser[k] = 1; }
      for (const t of st.targets) {
        t.liftK += ((st.hoverTarget === t ? 1 : 0) - t.liftK) * (1 - Math.exp(-dt * 12));
        if (t.lamp) t.objs.forEach((o, i) => { o.position.y = t.base[i] + 0.03 * t.liftK; });
        if (t.cover) t.objs.forEach((o, i) => { o.position.y = t.base[i] + 0.012 * t.liftK; });
        if (t.lift) t.objs.forEach((o, i) => { o.position.y = t.base[i] + t.lift * t.liftK + (t.hop || 0); });
      }
      updateSwap(dt);
      st.propsTick?.(dt, time);
      for (const k in st.lampK) st.lampK[k] += (st.lampUser[k] - st.lampK[k]) * (1 - Math.exp(-dt * 9));
      // 늦은 밤: 바늘은 들려 있다가 "drop the needle" 에서 내려감 (판은 계속 돎). 소리를 켰으면 바늘 소리
      const needleWant = (!st.lateNight || st.nightDrop) && !(st.swap && !st.swap.dropped);
      if (st.lateNight && needleWant !== st.needleWas && st.playing && !st.covered) { if (needleWant) st.sound.needleDown(); else st.sound.needleUp(); }
      st.needleWas = needleWant;
      st.armK += ((st.playing && needleWant ? 1 : 0) - st.armK) * (1 - Math.exp(-dt * (st.reduced ? 60 : 5)));
      // sleeve Hero: 판이 앉으면 거의 바로 바늘이 올라가고 판이 돌기 시작 (사용자 요청). 그 밖: 방이 거의 다 지어진 뒤(0.70)
      // sleeve Hero: 판이 앉은 뒤 시간(st.ts)으로 톤암이 천천히 올라가고, 다 올라갈 무렵부터 판이 돎. 그 밖: 방이 거의 다 지어진 뒤(0.70)
      const needleK = st.sleeve ? easeInOut(clamp01(st.ts / SLEEVE_HERO.needle)) : easeInOut(seg(p, [STORY.spinAt, STORY.armDur]));
      const playingNow = (st.sleeve ? st.ts >= SLEEVE_HERO.needle * 0.8 : p >= STORY.spinAt) && st.playing;
      st.sound.setPlaying(playingNow && needleWant && p <= STORY.roomHold + 0.05 && !st.reduced && !st.covered);
      // 음악 (YouTube): 판이 돌고 바늘이 내려가 있는 동안만. 아래 섹션으로 내려가도 계속 (늦은 밤에서는 "drop the needle" 에서 다시)
      //  카드를 닫았으면(musicOff) 턴테이블을 다시 누를 때까지 틀지 않음
      const musicOn = playingNow && needleWant && !st.musicOff && !st.inHero;
      if (musicOn !== st.musicWas || st.nowPlaying !== st.musicAlbum) {
        st.musicWas = musicOn; st.musicAlbum = st.nowPlaying;
        st.music?.set(st.nowPlaying, musicOn);
      }
      st.ttRise.position.y = -(1 - rise) * 0.35 + 0.025 * (st.targets[0]?.liftK ?? 0);
      st.ttRise.visible = rise > 0;
      // 먼지 덮개: 판이 내려앉기 전에 열림(cover_open), 되돌아가며 지나면 닫힘(cover_close) — 지나는 순간 실제 시간으로 재생
      const lid = st.lid;
      if (lid) {
        // sleeve Hero: 덮개는 턴테이블이 올라올 때 이미 열려 있고, 판이 앉은 뒤에 닫힘 (사용자 요청). 그 밖: 판이 오기 직전에 열림
        const wantOpen = st.swap ? !!st.swap.lidOpen : st.sleeve ? st.ts < SLEEVE_HERO.needle + SLEEVE_HERO.lidGap : p >= STORY.lidAt;
        if (wantOpen !== lid.isOpen) { lid.isOpen = wantOpen; lid.t = 0; }
        const cur = lid.isOpen ? lid.open : lid.close, other = lid.isOpen ? lid.close : lid.open;
        lid.t = st.reduced ? cur.getClip().duration : lid.t + dt;
        other.enabled = false;
        cur.enabled = true; cur.paused = false;
        cur.time = Math.min(lid.t, cur.getClip().duration);
        if (st.sleeve && !lid.isOpen && lid.t >= lid.closeEnd) cur.time = cur.getClip().duration;
      }
      // VU 바늘: 33⅓ 이 돌기 시작하면 재생, 되돌아가면 제자리 (모션 줄이기면 멈춤)
      if (st.vu) {
        const on = playingNow && !st.reduced;
        st.vu.enabled = on;
        if (on) { st.vu.paused = false; st.vuT = (st.vuT + dt) % st.vu.getClip().duration; st.vu.time = st.vuT; }
      }
      seekClip(seg(p, STORY.build) * st.clip.duration);   // mixer.update(0) 이 덮개·VU action 도 같이 적용

      // 플래터 33⅓ · 톤암
      const spinning = playingNow;
      st.platterVel += ((spinning && !st.reduced ? RPM(100 / 3) : 0) - st.platterVel) * (1 - Math.exp(-dt * 1.2));
      if (st.platter) st.platter.rotation.y -= st.platterVel * dt;
      if (st.arm) st.arm.rotation.y = st.armBase + ARM_SWING * needleK * st.armK;
      st.root.updateMatrixWorld(true);

      // 판: 떠서 돌다가(10 RPM) 멈추며 플래터에 앉음 → 이후 플래터와 같이 돎
      // sleeve Hero: 가운데로 오는 구간(center)과 내려앉는 구간(land)을 겹쳐 둠 → 턴테이블 위에서 멈추지 않고 한 흐름으로 휘어 내려앉음
      const lk = easeInOut(seg(p, st.sleeve ? SLEEVE_HERO.land : STORY.land));
      // sleeve Hero: 재킷 줄을 움직이고, 판이 있을 자리(재킷 안 · 빠져나온 자리)를 heroPos · heroQuat 로 받음
      st.sleeve?.update(dt, p);
      // ink Hero: 누르는 동안 45 RPM 까지 가속 (떼면 아래 줄이 관성으로 10 RPM 으로 되돌림)
      if (st.hero?.holding && p < INK_HERO.heroP) st.ownVel = Math.min(st.ownVel + HERO_HOLD.accel * dt, RPM(HERO_HOLD.maxRpm));
      else st.ownVel += ((st.reduced ? 0 : RPM(10) * (1 - lk) * (st.sleeve ? easeInOut(seg(p, [SLEEVE_HERO.spinUp[0], SLEEVE_HERO.spinUp[1] - SLEEVE_HERO.spinUp[0]])) : 1)) - st.ownVel) * (1 - Math.exp(-dt * (st.sleeve && p < SLEEVE_HERO.spinUp[0] ? 6 : 1.5)));   // Hero 에서 빨리 돌던 판도 1초 남짓에 걸쳐 10 RPM 으로
      st.ownSpin -= st.ownVel * dt;
      st.seat.getWorldPosition(_p);
      st.seat.getWorldQuaternion(_q2);
      st.seatNow.copy(_p);
      // 실제 두께(1.9mm)의 판은 판 자리(Turntable_DiscSeat)에 그대로 놓으면 고무 매트 속에 묻힘 (자리는 두꺼운 예전 판 기준) → 매트 윗면까지 올림
      if (st.sleeve && st.seatLift) _p.addScaledVector(_hlOff.set(0, 1, 0).applyQuaternion(_q2), st.seatLift);
      const { root: dr, uniforms, baseMat, ref } = st.disc;
      if (st.sleeve && st.heroPos) {
        // 재킷 옆(화면 오른쪽) → 먼저 화면 가운데 = 턴테이블 바로 위(st.hover) → 거기서 아래로 내려앉음
        _dc2.copy(st.heroPos).lerp(st.hover, easeInOut(seg(p, SLEEVE_HERO.center)));
        dr.position.lerpVectors(_dc2, _p, lk);
      } else dr.position.lerpVectors(st.heroPos ?? st.hover, _p, lk);
      if (st.sleeve) {
        // 재킷 안에 다 들어가 있는 동안은 그리지 않음 · 재킷 크기에 맞춘 판 크기는 내려가며 실제 크기로
        dr.visible = !st.heroDiscHidden;
        const near = p > 0.2;     // 턴테이블 근처에서만 깊이를 당김 (Hero 에서는 재킷을 뚫고 보이므로 끔)
        if (near !== st.discNear) { st.discNear = near; st.disc.setNearMat?.(near); }
        dr.scale.setScalar(1 + ((st.heroScale ?? 1) - 1) * (1 - easeInOut(seg(p, [0.05, 0.14]))));
      }
      // 둥실 떠 있음: Hero 에서 넘어온 순간을 0 으로 (sin 이 0 에서 시작 → 넘어오는 프레임에 판이 튀지 않음)
      st.bobT0 ??= time;
      //  Hero(p=0)에서는 0 → 이야기가 시작되며 서서히 (Hero 자세는 Home 엔진이 정하므로, 돌아올 때도 p→0 으로 줄어 튀지 않음)
      const bob = (1 - lk) * easeInOut(seg(p, [0, 0.04]));
      if (bob > 0 && !st.reduced) dr.position.y += Math.sin((time - st.bobT0) * 1.1) * 0.008 * bob;
      _yaw.setFromAxisAngle(UP, st.ownSpin);
      const lq = st.scrollFlow ? Math.max(lk, easeInOut(seg(p, st.sleeve ? SLEEVE_HERO.flat : FLOW.flat))) : lk;   // 한 장면 흐름: 앞쪽에서 먼저 수평으로
      _q.copy(st.heroQuat ?? tilt).slerp(_q2, lq);   // 기울기 틀 (회전 · 뒤집기 뺀 것)
      // 판 가운데 (판 루트는 아랫면 기준). ink Hero 의 뒤집기는 가운데를 축으로
      _dc.set(0, DISC_C, 0).applyQuaternion(_q).add(dr.position);
      dr.quaternion.copy(_q);
      if (st.hero) { dr.quaternion.multiply(st.hero.flipQ); dr.position.copy(_dc).sub(_dc2.set(0, DISC_C, 0).applyQuaternion(dr.quaternion)); }
      dr.quaternion.multiply(_yaw);
      // 판 바꾸기: 덮개가 열린 동안 판이 제자리에서 떠올라 한 바퀴 돌고(그 사이 라벨이 바뀜) 다시 앉음
      if (st.swap?.lift || st.swap?.spin) {
        dr.position.addScaledVector(_hlOff.set(0, 1, 0).applyQuaternion(_q2), st.swap.lift ?? 0);
        dr.quaternion.multiply(_yaw.setFromAxisAngle(UP, st.swap.spin ?? 0));
      }
      dr.updateMatrixWorld(true);

      // 바탕이 검게 → 잉크 선은 크림색으로
      const dk = easeInOut(seg(p, STORY.dark));
      scene.background.copy(st.heroBg ?? CREAM).lerp(NIGHT, dk);
      st.sleeve?.backdrop(scene.background, 1 - dk);     // 종이 결은 장면 맨 뒤에 (재킷 · 판 위에 덮이지 않게)
      // 후처리(번짐·틸트·비네트)는 바탕이 어두워지는 만큼만: 크림 바탕의 Hero 판 구간은 Home 과 같은 그림 그대로
      post.params.mix = dk;
      // 꾸밈 없는 판(raw): 판만 비추는 빛. 크림 바탕의 Hero 에서 또렷하게, 바탕이 어두워지는 만큼 꺼짐 (그 뒤는 턴테이블 핀 조명 · 방 조명)
      if (heroLight) {
        const hk = 1 - dk;
        heroLight.hemi.intensity = (sleeveHero ? 1.0 : 1.6) * hk;     // sleeve: 실험 페이지에서 맞춘 밝기 (커버가 떠 보여 조금 낮춤)
        heroLight.sun.intensity = (sleeveHero ? 1.5 : 2.4) * hk;
        if (st.sleeve) {
          // 재킷 줄 기준 왼쪽 위 앞에서 비춤 (lab 과 같은 방향) → 재킷 가장자리 그림자가 오른쪽으로 나온 판 위에 떨어짐
          const f = st.sleeve.frame;
          heroLight.sun.position.copy(f.position).add(_hlOff.set(-0.45, 0.8, 1.6).applyQuaternion(f.quaternion));
          heroLight.sun.target.position.copy(f.position);
        } else {
          heroLight.sun.position.copy(storyCam.position).add(_hlOff.set(0.6, 1.2, 0.4));
          heroLight.sun.target.position.copy(dr.position);
        }
      }
      if (uniforms) {   // 잉크 판만 (raw 판은 vinyl.glb 재질 그대로)
      // 잉크 셰이더는 sRGB 값을 그대로 받음 (Home 엔진 hexToVec3 와 같게) → THREE.Color(선형)를 sRGB 로 바꿔 넘김
      //  (예전: 선형 값을 그대로 넘겨 배포된 Home 보다 판이 어둡고 진했음)
      uniforms.uInk.value.set(...new THREE.Color().copy(st.heroInk ?? INK_ON_CREAM).lerp(st.nightInk ?? INK_ON_NIGHT, dk).convertLinearToSRGB().toArray());
      uniforms.uLabel.value.set(...new THREE.Color().copy(st.heroLabel ?? LABEL_ON_CREAM).lerp(st.nightLabel ?? LABEL_ON_NIGHT, dk).convertLinearToSRGB().toArray());
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
      // Hero 에서 막 넘어온 동안은 Home 엔진(updateLight)과 똑같이: 회전 전 판 틀에서 화면 방향(직교 카메라처럼)으로 시선·빛을 정해
      //  판 로컬로 옮김 + 눈은 아주 멀리 → Hero 판과 같은 빛줄기. 판이 턴테이블로 내려앉는 만큼(lk) 위의 방 계산으로
      if (lk < 1) {
        _qComp.copy(_q);   // 판 회전(spin) · 뒤집기를 뺀 기울기 틀 = Home 의 comp
        _qInvC.copy(_qComp).invert();
        cam.getWorldDirection(_fwd);
        _hv.copy(_fwd).negate().applyQuaternion(_qInvC);
        _hflat.set(_hv.x, 0, _hv.z); if (_hflat.lengthSq() < 1e-6) _hflat.set(0, 0, 1); _hflat.normalize();
        _hm.set(-_hflat.z, 0, _hflat.x).multiplyScalar(HERO_STREAK_SPREAD); _hm.y = 1; _hm.normalize();
        _hl.copy(_hm).multiplyScalar(2 * _hm.dot(_hv)).sub(_hv).normalize();
        if (_hl.y < 0.3) { _hl.y = 0.3; _hl.normalize(); }
        _hl.applyQuaternion(_qComp).transformDirection(_inv);                            // 세계 → 판 로컬 (판 모델의 세로 1.8배까지)
        _light.lerp(_hl, 1 - lk).normalize();
        _eye.copy(dr.position).addScaledVector(_fwd, -DISC_R * HERO_EYE_FAR).applyMatrix4(_inv);
        camL.lerp(_eye, 1 - lk);
      }
      uniforms.uCamLocal.value.copy(camL);
      uniforms.uLightLocal.value.copy(_light);
      }
      st.hero?.update(dt, { p, compQuat: _q, centerPos: _dc, omega: -st.ownVel, angle: st.ownSpin });

      // Bake v17: keep the room unlit through furniture placement (frame 108).
      const frame = seg(p, STORY.build) * st.clip.duration * 24;
      const frameK = ([a, b]) => easeInOut(THREE.MathUtils.clamp((frame - a) / (b - a), 0, 1));
      // 램프가 놓이는 순간마다 한 단계씩 (구운 그림은 켜짐 · 꺼짐 두 장뿐이라 램프별로 따로 켜진 않고, 전체 밝기를 램프 몫만큼씩 올림)
      //  클립에 램프 시간이 없으면 예전처럼 끝에서 한 번에
      //  사용자가 끈 램프(lampK)는 그 몫만큼 다시 어두워짐
      let bakeLightProgress = 0, shareSum = 0;
      const lampOn = {};
      for (const [pivot, share] of Object.entries(LAMP_SHARE)) {
        const at = st.lampAt.get(pivot);
        if (at == null) continue;
        shareSum += share;
        lampOn[pivot] = easeInOut(seg(p, [at - LAMP_ON_LEAD, LAMP_ON_DUR])) * (st.lampK[pivot] ?? 1);
        bakeLightProgress += share * lampOn[pivot];
      }
      for (const t of st.targets) if (t.lamp) for (const m of t.mats) m.color.setScalar(THREE.MathUtils.lerp(0.32, 1, st.lampK[t.key]));
      bakeLightProgress = shareSum > 0 ? bakeLightProgress / shareSum : easeInOut(seg(p, LIT_P));
      // 빛: 턴테이블 Hero → 어두운 방·가구 배치 → 실제 램프와 베이크 동시 점등
      key.intensity = (st.ttLook ? 4.2 : 3.2) * rise * (1 - (st.ttLook ? 0.9 : 0.8) * easeInOut(seg(p, [0.38, 0.12])));     // 실시간 재질 턴테이블은 조명을 직접 받으므로 더 세게 (구운 그림일 때는 그림을 밝혔음)
      // 구운 턴테이블은 조명을 안 받음 → 어둠 속에서 혼자 보일 때는 구운 그림을 밝게 (핀 조명 대신), 방이 서면 원래 밝기로
      if (st.baked && !st.ttMats) {
        const own = new Set(), other = new Set();
        st.root.traverse((o) => {
          if (!o.isMesh) return;
          let a = o; while (a && a !== st.ttRise) a = a.parent;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) (a ? own : other).add(m);
        });
        st.ttMats = [...own].filter((m) => m.isMeshBasicMaterial && m.name.endsWith("_bakedColor") && !other.has(m));
      }
      const spot = 1 + 1.6 * rise * (1 - easeInOut(seg(p, [0.39, 0.10])));
      // 꺼짐(dim) 그림이 푸른 저녁이라 그대로 밝히면 턴테이블이 파랗게 보임 → 밝히는 만큼 따뜻한 쪽으로 (방이 서면 원래 색)
      const warm = (spot - 1) / 1.6;
      for (const m of st.ttMats ?? []) m.color.setRGB(spot, spot * (1 - 0.12 * warm), spot * (1 - 0.32 * warm));
      const rk = easeInOut(seg(p, STORY.room));
      // 턴테이블: 조명이 판 자리를 따라가고, 마우스를 따라 반사 · 조명이 조금 움직임. 방이 지어지면 반사를 낮춤
      st.ttLook?.update(st.seatNow, rk, st.reduced ? _zero2 : st.ptrS);
      const nk = easeInOut(seg(p, st.night));
      const ek = easeInOut(seg(p, ENV_IN));
      st.env.night(nk * (st.cityMul ?? 1));               // 창문 안 남산: 창문 벽이 다 선 뒤 밝아짐 (창문을 누르면 cityMul 로 어둡게, roomProps)
      st.env.fade(ek);                                    // 바깥 배경: 방 완성 구도로 다가가며
      if ((st.cityMul ?? 1) < 1 && st.env.sky?.material?.uniforms?.uOpacity) st.env.sky.material.uniforms.uOpacity.value *= 0.35 + 0.65 * st.cityMul;
      // 레이어가 가까운 것부터 아래에서 올라옴 (fade 가 정한 투명도에 레이어별 등장 정도를 곱함)
      if (!st.layerRise) {
        const byId = Object.fromEntries(LAYER_CFG.layers.map((L) => [L.id, L]));
        const roomCam = st.rig.target.clone().addScaledVector(new THREE.Vector3().setFromSpherical(st.base.sph).normalize(), st.base.sph.radius);   // 방 완성 칸 카메라 자리
        st.layerRise = st.env.group.children.filter((g) => g.name.startsWith("env_") && byId[g.name.slice(4)])
          .map((g) => {
            const mats = [];
            g.traverse((o) => { if (o.isMesh) mats.push(o.material); });
            return { g, D: byId[g.name.slice(4)].D, baseY: g.position.y, mats, dist: g.getWorldPosition(new THREE.Vector3()).distanceTo(roomCam) };
          })
          .sort((a, b) => a.D - b.D);
      }
      st.env.group.visible = p >= LAYER_RISE.start;
      st.layerRise.forEach((L, i) => {
        const k = st.reduced ? ek : easeInOut(seg(p, [LAYER_RISE.start + i * LAYER_RISE.stagger, LAYER_RISE.dur]));
        L.g.position.y = L.baseY - (1 - k) * L.dist * LAYER_RISE.drop;
        const op = Math.min(1, k * 2.5);   // 올라오기 시작하면 금방 또렷하게 (전체 fade 와 따로 → 올라오는 움직임이 보이게)
        for (const m of L.mats) { m.opacity = op; m.transparent = m.alphaTest > 0 || op < 1; m.depthWrite = op >= 1; }
      });
      // 남산은 창문 너머로만: 카메라와 창문 위 테두리를 지나는 평면 위쪽은 잘라 냄 (마우스 시차로 카메라가 움직여도 매 프레임 다시)
      if (st.env.glass) {
        if (!st.namsanClip) {
          st.namsanClip = new THREE.Plane();
          st.env.group.getObjectByName("env_h_namsan")?.traverse((o) => { if (o.isMesh && o.material.map) o.material.clippingPlanes = [st.namsanClip]; });
        }
        const gl = st.env.glass, gp = gl.geometry.parameters;
        gl.updateWorldMatrix(true, false);
        const a = new THREE.Vector3(-gp.width / 2, gp.height / 2, 0).applyMatrix4(gl.matrixWorld);
        const b = new THREE.Vector3(gp.width / 2, gp.height / 2, 0).applyMatrix4(gl.matrixWorld);
        st.namsanClip.setFromCoplanarPoints(storyCam.position, a, b);
        // 창문 아래쪽(창 가운데)이 남는 쪽이 되게 방향을 맞춤
        const mid = new THREE.Vector3(0, -gp.height / 2, 0).applyMatrix4(gl.matrixWorld);
        if (st.namsanClip.distanceToPoint(mid) < 0) st.namsanClip.negate();
      }
      // 밤 주변광·창 쪽 달빛 → 바깥 배경이 나타나며 노을 조명으로 (env-layers.json 의 light)
      hemi.color.copy(HEMI_SKY).lerp(DUSK.hemiSky, ek);
      hemi.groundColor.copy(HEMI_GROUND).lerp(DUSK.hemiGround, ek);
      hemi.intensity = rk * THREE.MathUtils.lerp(1.0, DUSK.hemiIntensity, ek) * THREE.MathUtils.lerp(0.55, 1.0, bakeLightProgress);   // v18 dim 베이크(보조 조명만)와 맞춤
      moon.color.copy(MOON).lerp(DUSK.sunColor, ek);
      moon.intensity = nk * THREE.MathUtils.lerp(0.7, DUSK.sunIntensity, ek) * THREE.MathUtils.lerp(0.4, 1.0, bakeLightProgress);
      for (const l of st.lights) {
        const pivot = LIGHT_PIVOT[l.name] ?? "pivot_" + l.name.replace(/^light_/, "");
        const on = lampOn[pivot] ?? bakeLightProgress;
        l.intensity = st.baseIntensity.get(l) * st.lightMul * on;
        for (const { m, k } of st.lampMats.get(pivot) ?? []) {
          if (m.userData.glow) m.color.copy(m.userData.off).lerp(m.userData.glow, on);
          else m.emissiveIntensity = on * k;
        }
      }
      // Same blend as the real lamps: empty→off during construction, off→on only after it.
      setLightmapState(frameK(LM_BUILD), bakeLightProgress);
      // Do not leave original building/window/clock emitters glowing before lights-on.
      const lampControlled = new Set([...st.lampMats.values()].flat().map(({ m }) => m));
      st.bakeEmitters ??= new Map();
      st.root?.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
          if (!m?.emissive || m.isMeshBasicMaterial || lampControlled.has(m)) continue;
          if (!st.bakeEmitters.has(m)) st.bakeEmitters.set(m, (m.emissiveIntensity ?? 1) * (EMIT_SCALE[m.name.replace(/\.\d+$/, "")] ?? 1));
          m.emissiveIntensity = st.bakeEmitters.get(m) * bakeLightProgress;
        }
      });
      // 미니어처 흐림(틸트시프트)은 방이 다 지어진 뒤에 (짓는 동안엔 카메라가 움직이며 아래쪽 턴테이블 · 가구가 흐려 보이지 않게)
      post.params.tilt = easeInOut(seg(p, POST_TILT));

      // 선반 커버: 핸드오프 중이면 마지막 커버는 DOM 이 대신 보여 줌
      st.covers.forEach((c, i) => {
        c.face.visible = !(st.hideLastCover && i === st.covers.length - 1);
        c.mat.emissiveIntensity = c.mat.map ? 0.35 * bakeLightProgress : 0;
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
        if (st.scrollFlow) flowStep(dt);
        else if (!st.inHero && st.tween) {
          // 3D 방: 한 칸을 시간으로 재생 (화면이 바로 따라감)
          const tw = st.tween;
          const k = clamp01((now() - tw.start) / tw.dur);
          st.s = st.sTarget = tw.from + (tw.to - tw.from) * (tw.linear ? k : easeInOut(k));
          st.p = sToP(st.s);
          st.stage = Math.round(st.s);
          if (k >= 1) {
            st.tween = null;
            // 관성 스크롤 흡수. 방 완성 칸은 이미 페이지 스크롤이 풀려 있으니(FREE_P) 잠그지 않음 — 잠그면 풀렸던 스크롤이 0.45초 다시 잠김
            st.lockUntil = tw.to === LAST && tw.to > tw.from ? 0 : now() + STEP.cooldown;
            if (st.auto && st.sTarget < LAST) advance(1); else st.auto = false;
          }
        } else if (!st.inHero) {
          // 입력이 멈추면 가까운 칸 (진행 방향으로 bias 넘게 갔으면 다음 칸)
          const t = now();
          //  (착지까지 0~STEP_FROM 은 붙지 않음: 판이 스크롤한 그 자리에 머묾 — 스크롤을 따라 작아지며 내려앉는 구간)
          if (st.goal == null && !st.touching && t - st.inputAt > SCROLL.idle && st.sTarget >= STEP_FROM) {
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
            st.lockUntil = now() + STEP.cooldown;   // 되돌아온 관성 스크롤로 바로 다시 떠나지 않게 (raw Hero 입력)
            st.heroFadeAt = performance.now();   // 방의 판 위로 Hero 의 링·그림자·먼지가 서서히 나타난 뒤 Hero 화면으로 (되돌아갈 때도 끊기지 않게)
            st.onHero?.(true);
          }
        }
        // 페이지 스크롤이 풀리는 때 (= "Put a record on." 문구가 올라오는 때): 방 칸 재생이 끝까지 가기 전, 소품이 다 놓인 FREE_P 에서
        //  그 뒤 램프가 마저 켜지는 꼬리는 스크롤하면서 봐도 됨 (재생은 그대로 이어짐)
        const tw = st.tween;
        const free = st.scrollFlow ? st.p >= FREE_P : !st.inHero && (tw
          ? tw.to === LAST && tw.to > tw.from && st.p >= FREE_P
          : st.goal == null && st.sTarget === LAST && now() >= st.lockUntil);
        if (free !== st.free) { st.free = free; st.onFree?.(free); }
        st.clock?.update(dt);
        // Hero ↔ 방: Home 엔진을 먼저 한 프레임 진행 (판의 잉크는 끄고 링·그림자·먼지만 겹침 타깃에) → Hero 동안은 그 판 자세를 이 판이 그대로 따름
        //  판은 처음부터 끝까지 이 장면의 한 장 → 넘어가는 순간 바뀌는 것이 없음. 링·그림자·먼지만 HERO_FADE_MS 동안 옅어지거나 짙어짐
        const fade = st.heroFadeAt == null || st.reduced ? 1 : clamp01((performance.now() - st.heroFadeAt) / HERO_FADE_MS);
        st.heroK = st.inHero ? easeInOut(fade) : 1 - easeInOut(fade);
        st.heroDrew = st.heroK > 0.001 && renderHeroRT();
        if (st.hero?.dirty) st.hero.place();   // ink Hero 처음 자세 (화면 크기가 바뀌면 다시)
        const home = homeRef.current;
        if (st.inHero && home?.heroPose) { takeHero(home.heroPose()); st.ownVel = -st.heroOmega; }
        apply(st.p, dt, time);   // 판 빛줄기는 직전 프레임 카메라 기준 (한 프레임 차이라 보이지 않음)
        placeStoryCam(st.p);
        orbitByPointer(st.p, dt);
        pushToTurntable();
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
      // Hero 도 이 장면(p=0: 크림 바탕에 판 한 장)을 그리고, 그 위에 Hero 의 링·그림자·먼지(heroK). 섹션이 방을 다 덮은 동안은 쉼
      // holdRender: 셰이더가 뒤에서 컴파일되는 동안은 그리지 않음 — 준비 안 된 셰이더로 그리면 그 자리에서 컴파일하느라 화면이 멈춤 (prewarm 이 풂)
      if ((st.inHero || !st.covered) && !st.holdRender) {
        renderer.render(scene, cam); post.run();
        if (st.heroDrew) compositeHeroRT(st.heroK);
      }
      acc += dt; frames++;
      if (acc > 0.5) {
        const fps = frames / acc;
        if (st.debug) setStats({ fps: Math.round(fps), calls: renderer.info.render.calls, tris: renderer.info.render.triangles });   // 디버그 패널이 열려 있을 때만 (다시 렌더가 화면을 끊음)
        // 느린 구간이 두 번 이어지면 해상도를 한 단계 낮춤 (한 번 끊긴 건 무시, 다시 올리지는 않음 = 오르내림 반복 방지)
        //  로딩 · 미리 데우는 동안의 느림도 3D 탓이 아님: 그때 낮추면 페이지를 열 때마다 흐릿한 화면으로 시작함 → 데우기가 끝나고 3초 뒤부터 셈
        st.slow = st.ready && st.inHero === false && st.warmAt && performance.now() - st.warmAt > 3000 && fps < DPR_SLOW_FPS ? (st.slow ?? 0) + 1 : 0;   // 인트로·Hero 동안의 느림은 3D 탓이 아님
        const pr = renderer.getPixelRatio();
        if (st.slow >= 2 && pr > DPR_MIN) { renderer.setPixelRatio(Math.max(DPR_MIN, pr - 0.25)); resize(); st.slow = 0; }
        acc = 0; frames = 0;
      }
      syncHeader();
      if (st.debug && time - hudAt > 0.08) {
        hudAt = time;
        const stage = [...STAGES].reverse().find(([a]) => st.p >= a)?.[1];
        setHud((h) => (Math.abs(h.p - st.p) < 0.001 && h.stage === stage ? h : { p: st.p, stage }));
      }
    };
    // Hero 의 링·그림자·먼지: Home 엔진 한 프레임 (판 잉크는 끔, 깊이는 남아 판 뒤는 가려짐)을 투명한 타깃에 → 방 화면 위에 k 만큼 (미리 곱한 알파)
    //  타깃은 sRGB 라 Home 재질 색이 화면에 바로 그릴 때와 같음. 셰이더는 로딩 중 미리 컴파일(warmHero). 그렸으면 true
    const _cc = new THREE.Color();
    const renderHeroRT = () => {
      const home = homeRef.current;
      if (!home?.drawShared) return false;
      home.setDiscMask?.(true);
      renderer.getClearColor(_cc);
      const ca = renderer.getClearAlpha(), ac = renderer.autoClear, tm = renderer.toneMapping;
      renderer.setRenderTarget(heroRT);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.autoClear = false; renderer.toneMapping = THREE.NoToneMapping;
      const drew = home.drawShared();
      renderer.setRenderTarget(null);
      renderer.toneMapping = tm; renderer.autoClear = ac;
      renderer.setClearColor(_cc, ca);
      return drew;
    };
    const compositeHeroRT = (k) => {
      const ac = renderer.autoClear;
      renderer.autoClear = false;
      overlayMat.uniforms.uK.value = k;
      renderer.render(overlayScene, overlayCam);
      renderer.autoClear = ac;
    };
    st.warmHero = () => {
      const home = homeRef.current;
      if (st.heroWarm || !home?.compileFor) return;
      st.heroWarm = true;
      home.compileFor(heroRT);
      const prev = renderer.getRenderTarget();
      renderer.compile(overlayScene, overlayCam);
      renderer.setRenderTarget(prev);
    };
    // 한 장면 흐름 (flow="scroll"): 페이지 스크롤 → 진행도 P
    function flowStep(dt) {
      const page = pageRef.current, vh = page?.clientHeight || 1;
      const k = clamp01((page?.scrollTop ?? 0) / (FLOW.travel * vh));
      st.k = k;
      const b0 = STAGE_P[STEP_FROM], b1 = STAGE_P[LAST], T = segDur(STEP_FROM);   // 방 짓기 = Blender 클립 시간 그대로
      // 방: 판이 앉아 있고 스크롤이 끝까지면 앞으로, 아니면 거꾸로 (같은 속도)
      // sleeve Hero: 판이 거의 다 앉았으면(landNear 안) 앉은 것으로 봄 → 톤암이 바로 움직이기 시작
      //  (천천히 따라붙는 마지막 꼬리까지 기다리면 판이 멈춘 것처럼 보이는 채로 1~2초가 더 지나갔음. 판은 그동안 마저 내려앉음)
      // sleeve Hero: 판이 내려앉기 시작하면(진행도 landAuto) 스크롤을 착지 자리까지 대신 내려 줌 → 한 번에 끊기지 않고 앉음
      //  (판은 스크롤 자리를 따라가므로, 휠 칸 사이마다 공중에서 멈췄다 다시 내려갔음). 그동안 휠 입력은 받지 않음. 위로 올리는 건 그대로 스크롤대로
      if (st.sleeve && !st.reduced && !st.free && page) {
        const a0 = SLEEVE_HERO.landAuto / b0, down = k > (st.kWas ?? k) + 1e-5;
        if (k < a0 || k >= 1) st.autoLand = false;
        else if (down && !st.autoLand && st.tr === 0 && st.ts === 0) {
          st.autoLand = true;
          const left = (1 - k) / (1 - a0);
          page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: FLOW.travel * vh + 4, smooth: true, lock: true, duration: Math.max(0.7, SLEEVE_HERO.landAutoSec * left), easing: (t) => 1 - Math.pow(1 - t, 1.7) } }));
        }
        st.kWas = k;
      }
      const landed = st.pPre >= b0 - (st.sleeve ? SLEEVE_HERO.landNear : 1e-4);
      const fwd = k >= 1 && landed;
      if (st.sleeve) {
        // sleeve Hero: 판이 앉으면 먼저 '앉은 뒤 시간'(ts: 톤암 → 덮개)이 흐르고, 그게 끝난 뒤에 방이 buildSpeed 배속으로 지어짐. 되돌리면 거꾸로
        const H = SLEEVE_HERO, lidDur = st.lid ? st.lid.closeEnd : 0;
        const S = H.needle + H.lidGap + lidDur;
        st.settleDur = S;
        if (st.reduced) { st.ts = fwd ? S : 0; st.tr = fwd ? T : 0; }
        else if (fwd) { if (st.ts < S) st.ts = Math.min(S, st.ts + dt); else st.tr = Math.min(T, st.tr + dt * H.buildSpeed); }
        else if (st.tr > 0) st.tr = Math.max(0, st.tr - dt * H.buildSpeed);
        else st.ts = Math.max(0, st.ts - dt);
      } else st.tr = st.reduced ? (fwd ? T : 0) : Math.min(T, Math.max(0, st.tr + (fwd ? dt : -dt)));
      // 앞부분: 방이 다 되감긴 뒤(그리고 톤암 · 덮개가 다 돌아간 뒤)에만 스크롤 자리를 따라감 (그동안은 앉은 자세)
      const preT = st.tr > 0 || st.ts > 0 ? b0 : k * b0;
      // sleeve Hero: 착지 구간에서는 천천히 따라붙음 → 휠을 빨리 굴려도 판은 아주 천천히 내려앉음
      const follow = st.sleeve && Math.max(preT, st.pPre) > SLEEVE_HERO.landFrom ? SLEEVE_HERO.landFollow : FLOW.follow;
      st.pPre = st.reduced ? preT : st.pPre + (preT - st.pPre) * (1 - Math.exp(-dt * follow));
      if (Math.abs(preT - st.pPre) < 1e-4) st.pPre = preT;
      st.p = st.tr > 0 ? b0 + (b1 - b0) * (st.tr / T) : st.pPre;
      st.s = st.sTarget = pToS(st.p);
      st.stage = Math.round(st.s);
      // 방이 지어지는 동안 착지 지점보다 아래로 가 있으면(휠을 빠르게 굴려 넘친 관성) 착지 지점으로 부드럽게 되돌림
      const building = !st.free && (st.tr > 0 || st.ts > 0 || k >= 1);
      const over = building && page && page.scrollTop > FLOW.travel * vh + 2;
      if (over && !st.pulling) { st.pulling = true; page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: FLOW.travel * vh, smooth: !st.reduced, duration: 0.6 } })); }
      else if (!over) st.pulling = false;
      // 맨 위(Hero)인지: 종이 결 · 목차 01
      const atTop = k < 0.04 && st.tr === 0 && st.ts === 0;
      if (atTop !== st.atTop) { st.atTop = atTop; st.onHero?.(atTop); }
    }
    st.frame = frame;
    tick();

    return () => {
      st.disposed = true;
      st.hero?.dispose();
      st.ttLook?.dispose();
      if (st.ttEnv && st.ttEnv !== st.sleeve?.envMap) st.ttEnv.dispose();
      st.sleeve?.dispose();
      st.dropShelfTest?.();
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      layer.removeEventListener("wheel", onWheel);
      layer.removeEventListener("touchstart", onTouchStart);
      layer.removeEventListener("touchmove", onTouchMove);
      layer.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onMenuKey);
      sound.dispose();
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
      post.dispose();
      heroRT.dispose(); overlayMat.dispose();
      sharedRef.current = deferred();   // 다음 마운트의 Hero 엔진은 새 렌더러를 기다림
      renderer.dispose();
      renderer.domElement.remove();
      st.music?.dispose();
      if (window.__room === st) delete window.__room;
      st.clearHeader?.();
    };
  }, [boot]);

  // 신보 7장 (선반에는 오래된 것부터 놓여서 마지막 커버 = 가장 최신)
  useEffect(() => {
    let cancelled = false;
    getRecentVinyls(createClient()).then((rows) => {
      if (cancelled) return;
      setAlbums(rows.map((a) => ({ slug: a.slug, title: a.title, artist: a.artist_names || "", image: coverUrl(a.cover_path || a.thumb_path), color: a.cover_color || "#bbcbda", playlist: a.youtube_playlist_id || null })));
      if (!rows.length) gateRef.current.covers.resolve();
    }).catch((e) => { console.error("New vinyls could not load", e); gateRef.current.covers.resolve(); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const st = apiRef.current;
    if (!st || !info || !albums.length) return;
    const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
    // 재킷마다 받기 → GPU 에 올리기까지 끝나면(실패해도) 로딩 조건 하나를 풂
    // 벽 선반: 최신 순으로, '지금 듣는 판'(창가 선반에 놓인 앨범)은 빼고 그다음 앨범으로 채움 — 같은 판이 두 군데 놓이지 않게
    //  이미 그 자리에 놓인 앨범은 다시 받지 않음
    const setWall = (playing) => {
      const n = st.covers.length, wall = albums.slice(0, n);
      const k = playing ? wall.findIndex((a) => a.slug === playing.slug) : -1;
      if (k >= 0) wall[k] = albums.find((a, i) => i >= n && a.slug !== playing.slug) ?? wall[k];
      return st.covers.map((c, i) => {
        const a = wall[n - 1 - i], { mat } = c;
        if (!a || c.album === a.slug) return null;
        c.album = a.slug; c.albumObj = a;
        if (!mat.map) mat.color.set(a.color);
        return new Promise((done) => loader.load(a.image, async (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          await predecode(tex, true);   // 그림 풀기를 미리 (올릴 때 프레임이 빠지지 않게)
          if (c.album !== a.slug) { tex.dispose(); return done(); }
          mat.map?.dispose();
          mat.map = tex; mat.emissiveMap = tex; mat.color.set("#ffffff"); mat.needsUpdate = true;
          try { st.renderer.initTexture(tex); } catch { /* 첫 그리기에서 올라감 */ }
          done();
        }, undefined, () => done()));
      }).filter(Boolean);
    };
    st.setWall = setWall;
    const loads = setWall(sleeveHero ? null : st.nowPlaying);
    Promise.all(loads).then(() => gateRef.current.covers.resolve());
    // sleeve Hero: 같은 앨범으로 재킷 줄을 만들고, 가운데에서 가까운 커버부터 받아 입힘 (앞 3장이 준비되면 Hero 준비 끝)
    const sleeveOff = { v: false };
    const fillSleeves = () => {
      const sl = st.sleeve; if (!sl || !albums.length || sleeveOff.v) return;
      sl.setAlbums(albums);
      let n = 0;
      const order = albums.map((_, i) => i).sort((a, b) => Math.abs(a - sl.s.target) - Math.abs(b - sl.s.target));
      (async () => {
        for (const i of order) {
          const img = await new Promise((done) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => done(im); im.onerror = () => done(null); im.src = albums[i].image; });
          if (sleeveOff.v || st.sleeve !== sl) return;
          sl.setCover(i, img);
          n++;
        }
      })();
    };
    // (이 effect 는 선반 소품이 얹힐 때도 다시 돎 → 같은 앨범 목록이면 줄을 다시 만들지 않음)
    if (sleeveHero && st.sleeveFilled !== albums) {
      if (st.sleeve) { st.sleeveFilled = albums; fillSleeves(); }
      else st.onSleeveReady = () => { st.sleeveFilled = albums; fillSleeves(); };
    }
    // 창가 선반 "지금 듣는 판" 재킷: 벽 선반에 없는 앨범 중 무작위 (페이지를 열 때마다 바뀜)
    if (st.root) st.nowPlaying = applyNowPlaying(st.root, albums, st.covers.length, st.warmNowPlaying);   // 다시 마운트(개발 중 새로 고침) 직후엔 방이 아직 없을 수 있음
  }, [albums, info, shelfReady]);

  // 섹션 전환 · 핸드오프 (3D 마지막 커버 자리 ↔ New Vinyls 첫 칸)
  useEffect(() => {
    const st = apiRef.current; if (!st || !boot) return;
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
  },[boot]);
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
    const st = apiRef.current; if (!st || !boot) return;
    st.onHero = (on) => setHeroOn(on);
    // sleeve Hero: 가운데 앨범 · 열림 → 아래 글자. 열린 판을 누르면 착지 자리까지 스크롤을 대신 내려 줌 (판이 턴테이블로 내려가 앉고 방이 지어짐)
    st.onSleeveIndex = (i) => setSleeveAt(i);
    st.onSleeveOpen = (o) => setSleeveOpen(o);
    st.onSleeveRecord = () => {
      const page = pageRef.current; if (!page) return;
      st.autoLand = true;     // (flowStep 의 '끝까지 내려앉기'가 중간에 다시 시작하지 않게)
      page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: FLOW.travel * page.clientHeight + 4, smooth: !st.reduced, duration: SLEEVE_HERO.landMs / 1000, easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) } }));
    };
    st.onFree = (on) => setFree(on);
    st.onShelfReady = () => setShelfReady((n) => n + 1);
  }, [boot]);
  // 페이지 스크롤 → 방 화면이 액자처럼 작아짐 · 섹션 바탕색과 노이즈 경계(inkWipe 캔버스) · New Vinyls 커버 줄이 옆으로 지나감
  //                 · 헤더 글자색 · 섹션 색이 방을 다 덮으면 그리기 멈춤 · 끝의 창이 가까워지면 늦은 밤으로
  useEffect(() => {
    const page = pageRef.current, stage = stageRef.current, st = apiRef.current, canvas = wipeRef.current;
    if (!page || !stage || !st || !canvas) return;
    const wipe = createInkWipe(canvas);
    // 섹션 바탕색 = 사이트 테마 값 (다크 모드면 크림 ↔ 잉크가 바뀜). none = 뚫림 (방이 비침)
    const _c = new THREE.Color();
    const palette = { none: { rgba: [0, 0, 0, 0], color: null } };
    const readTheme = () => {
      const css = getComputedStyle(document.documentElement);
      for (const name of ["cream", "ink"]) {
        _c.set(css.getPropertyValue(`--${name}`).trim() || (name === "cream" ? "#f4e7cd" : "#4c404a"));
        const hex = _c.getHex(THREE.SRGBColorSpace);
        palette[name] = { rgba: [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255, 1], color: _c.clone() };
      }
    };
    readTheme();
    _c.set(NIGHT_TINT.color);
    const nightHex = _c.getHex(THREE.SRGBColorSpace);
    const nightPal = { rgba: [(nightHex >> 16 & 255) / 255, (nightHex >> 8 & 255) / 255, (nightHex & 255) / 255, 1], color: _c.clone() };
    let raf = 0;
    const measure = () => {
      raf = 0;
      const y = page.scrollTop, vh = page.clientHeight, asp = page.clientWidth / vh;
      // 경계: 섹션마다 하나 (단위: 화면 높이 = 1, 왼쪽 아래가 0,0). T = 섹션 윗변 높이
      //  보통 섹션: 화면 아래 멀리 중심을 둔 큰 원 = 큰 판의 홈이 아래에서 밀려 올라옴 (섹션마다 중심이 좌우로 번갈아 치우침)
      //   · 꽉 찬 반지름 R 은 섹션 윗변 아래를 다 덮는 크기 → 섹션 안은 늘 제 색
      //   · 다음 색은 섹션보다 최대 sag + band(≤ lead) 만큼 먼저 올라옴 (그 자리는 앞 섹션 끝의 빈 여백)
      //  늦은 밤 창: 턴테이블 자리를 중심으로 잉크가 고리 모양으로 걷힘 (섹션 앞부분은 비어 있어서 글과 겹치지 않음)
      const list = [];
      let over = null, covered = false, nearNight = false, n = 0, at = 0, k2 = 0, nightT = -1, night = null;
      const pageY = page.getBoundingClientRect().top;
      // News 바탕 → 밤색: 늦은 밤 창 섹션이 올라오는 만큼 (그 앞 섹션의 색만 바뀜)
      const nightSec = page.querySelector("[data-hs-night]");
      const nT = nightSec ? 1 - (nightSec.getBoundingClientRect().top - pageY) / vh : -1;
      const tint = st.reduced ? (nT > NIGHT_TINT.at[1] ? 1 : 0) : THREE.MathUtils.smoothstep(nT, NIGHT_TINT.at[0], NIGHT_TINT.at[1]);
      for (const sec of page.querySelectorAll("[data-hs-section]")) {
        const top = sec.getBoundingClientRect().top - pageY;
        if (!list.length) st.nvTop = y + top;   // New Vinyls 가 화면 위에 닿는 scrollTop (휠 배수 구간의 끝)
        const T = 1 - top / vh;
        let c = palette[sec.dataset.bg] ?? palette.none;
        if (tint > 0 && nightSec && sec.nextElementSibling === nightSec && c.color) {
          c = { rgba: c.rgba.map((x, k) => (k < 3 ? x + (nightPal.rgba[k] - x) * tint : x)), color: c.color.clone().lerp(nightPal.color, tint) };
        }
        let shape = null;
        if (sec.hasAttribute("data-hs-night")) {
          nightT = T;
          // 재킷 들기: 앞(News)까지 칠한 화면이 재킷. 아랫변이 섹션 윗변(+lead)을 따라 올라가고, 그 아래로 방이 보임
          //  방 화면(host)은 재킷보다 느리게 따라 올라옴 (ride) · 거의 다 들리면 한쪽이 살짝 먼저 들림
          const L = NIGHT_LIFT, edge = T + L.lead;
          if (st.reduced) { if (edge >= 0.5) shape = { kind: 4, edge: 2, angle: 0 }; }
          else if (edge > -0.05) {
            const e = Math.min(1, Math.max(0, edge));
            night = { ty: (1 - e) * L.ride * vh };
            shape = { kind: 4, edge, angle: L.tilt * e * e };
          }
          if (T > L.near) nearNight = true;
        } else {
          // 슬리브: 다음 섹션이 종이 재킷처럼 아래에서 밀려 올라옴 (처음엔 좁고 기울어 있다가 올라오며 펴짐, 섹션마다 기울기 방향을 번갈아)
          const side = n++ % 2 ? -1 : 1;
          const top = T + SLEEVE.lift;
          if (top > -0.12) {
            const k = THREE.MathUtils.smoothstep(top, 0, SLEEVE.settle);
            shape = { kind: 2, top, inset: SLEEVE.inset * (1 - k), angle: side * SLEEVE.tilt * (1 - k), dim: SLEEVE.dim * THREE.MathUtils.clamp(top, 0, 1) };
          }
        }
        list.push(shape && { ...shape, rgba: c.rgba });
        if (T >= 0.94) over = c.color;                              // 헤더 자리까지 덮은 마지막 색
        k2++;
        if (T >= 0.5 && sec.dataset.bg !== undefined && k2 <= 3) at = k2;   // 화면 가운데를 넘은 마지막 섹션 (Footer 는 늦은 밤에 포함)
        if (T >= 1) covered = c.rgba[3] === 1;                       // 화면을 다 지나간 경계: 그 색이 불투명하면 방이 안 보임
        else if (shape && c.rgba[3] < 1) covered = false;            // 뚫린 색이 열리는 중 = 방이 다시 보임
      }
      wipe?.set(list);
      setWhere((w) => (w === at ? w : at));
      // 방 화면: 첫 화면 높이를 내려가는 동안 조금 작아지고 모서리가 둥글어짐 (끝에서 다시 나올 땐 꽉 찬 화면)
      const y0 = st.scrollFlow ? (FLOW.travel + FLOW.hold) * vh : 0;   // 한 장면 흐름: 판·방 구간이 끝난 뒤부터
      const k = st.reduced || nearNight ? 0 : Math.min(1, Math.max(0, y - y0) / (vh * 0.9));
      stage.style.setProperty("--frame", k.toFixed(4));
      // 늦은 밤 재킷 들기: 방 화면을 내려 둔 거리 (평소엔 0)
      stage.style.setProperty("--nty", night ? `${night.ty.toFixed(1)}px` : "0px");
      // 붙어 있는 구역의 커버 줄: 구역을 지나는 동안 왼쪽으로
      for (const pin of page.querySelectorAll("[data-hs-pin]")) {
        const rail = pin.querySelector("[data-hs-rail]"); if (!rail) continue;
        const r = pin.getBoundingClientRect();
        const q = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
        const more = Math.max(0, rail.scrollWidth - page.clientWidth);
        rail.style.transform = `translate3d(${(-q * more).toFixed(1)}px,0,0)`;
      }
      st.overBg = over;
      st.covered = covered;
      st.setNight?.(nearNight);
      // 늦은 밤: 카메라가 턴테이블로 다가가는 정도 · "drop the needle" 이 화면 가운데쯤 오면 바늘이 내려감
      st.nightPush = nearNight ? THREE.MathUtils.smoothstep(nightT, NIGHT_PUSH.at[0], NIGHT_PUSH.at[1]) : 0;
      const mark = page.querySelector("[data-hs-needle]");
      if (mark && nearNight) {
        const ty = (mark.getBoundingClientRect().top - pageY) / vh;
        if (ty < NIGHT_NEEDLE[0]) st.nightDrop = true; else if (ty > NIGHT_NEEDLE[1]) st.nightDrop = false;
      } else st.nightDrop = false;
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(measure); };
    // Lenis 가 스크롤을 옮긴 바로 그 순간에 계산 → 섹션 글자(DOM)와 바탕(WebGL)이 같은 프레임에 움직임 (Route 66 처럼)
    //  브라우저 scroll 이벤트는 그 뒤에 와서, Lenis 가 움직인 스크롤이면 시간만 기록 (Lenis 가 없을 때·직접 옮길 때는 다음 프레임에 계산)
    let lenisAt = -1;
    const onLenis = () => { lenisAt = performance.now(); st.scrollAt = lenisAt / 1000; if (raf) { cancelAnimationFrame(raf); raf = 0; } measure(); };
    const onScroll = () => { st.scrollAt = performance.now() / 1000; if (performance.now() - lenisAt > 40) queue(); };
    page.addEventListener("page:lenis-scroll", onLenis);
    page.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => { wipe?.resize(); queue(); });
    ro.observe(page);
    const mo = new MutationObserver(() => { readTheme(); queue(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    wipe?.resize();
    measure();
    return () => { page.removeEventListener("page:lenis-scroll", onLenis); page.removeEventListener("scroll", onScroll); ro.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); wipe?.dispose(); };
  }, [info, albums]);
  // Footer 의 "맨 위로": 페이지를 맨 위로 올리고 이야기를 Hero 로
  // 맨 위로 (HomeSections 에는 늘 같은 함수를 넘겨서, 이 컴포넌트가 다시 그려져도 섹션들은 그대로 둠)
  // sleeve Hero: 첫 로딩 화면이 걷히고 방 · 앨범이 준비되면 재킷들이 나타남
  useEffect(() => { if (sleeveHero && done && info && albums.length) apiRef.current?.sleeve?.reveal(); }, [sleeveHero, done, info, albums]);
  const toTopRef = useRef(null);
  const onTop = useRef(() => toTopRef.current?.()).current;
  const toTop = () => {
    if (scrollFlow) { pageRef.current?.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: 0, smooth: !reduced } })); return; }
    pageRef.current?.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: 0 } }));
    if (pageRef.current) pageRef.current.scrollTop = 0;
    setP(0);
  };
  toTopRef.current = toTop;
  // 목차 01–05: 0 Grooves(Hero) · 1 The Room · 2 New Vinyls · 3 News · 4 After Hours
  const goIndex = (i) => {
    const page = pageRef.current, st = apiRef.current;
    if (!page || !st) return;
    const scroll = (top) => page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top, smooth: !reduced } }));
    if (i === 0) { toTop(); return; }
    if (scrollFlow && i === 1) { scroll(FLOW.travel * page.clientHeight); return; }   // 판이 앉는 자리 → 방이 지어짐
    if (i === 1) {
      scroll(0);
      if (st.inHero) leaveHero();   // Hero 에서는 방이 지어지는 장면을 그대로 재생
      return;
    }
    if (!st.free && !scrollFlow) setP(STAGE_P[3]);   // 방이 아직 완성 전이면 완성된 방에서 출발 (한 장면 흐름은 지나가며 지어짐)
    const sec = page.querySelectorAll("[data-hs-section]")[i - 2];
    if (!sec) return;
    const r = sec.getBoundingClientRect(), vh = page.clientHeight;
    // 늦은 밤: 문구가 화면 가운데쯤 오는 자리 (섹션 앞부분은 비어 있음)
    scroll(page.scrollTop + r.top + (sec.hasAttribute("data-hs-night") ? r.height - vh * 1.35 : 0));
  };
  const leaveHero = () => {
    const home = homeRef.current;
    // Hero 판은 숨기지 않음: 방의 판이 같은 자리·같은 회전으로 아래에 깔리고, Hero 레이어(판 포함)가 옅어지며 겹쳐 넘어감
    //  (두 판은 서로 다른 WebGL 캔버스라 한 판을 그대로 옮겨 쓸 수는 없음 → 겹쳐서 이어지게)
    apiRef.current?.leaveHero(home?.heroPose?.());   // Home 판의 지금 자세를 넘겨 방의 판이 같은 자리에서 이어 받음
  };
  // Hero 가 가려진 동안 Home 엔진은 그리지 않음 (레이어가 다 사라진 뒤 멈추고, 돌아올 땐 바로 다시)
  useEffect(() => {
    const engine = homeRef.current;
    if (!engine?.setPaused) return;
    if (heroOn) { engine.setPaused(false); engine.setDiscHidden?.(false); return; }
    // 판을 숨긴 프레임이 한두 번 그려지면 바로 멈춤 (예전 550ms: 그동안 Hero 엔진과 방이 같이 그려져 GPU 를 나눠 씀).
    // Hero 글자 레이어는 멈춘 마지막 화면 그대로 0.5초 동안 옅어짐
    const t = setTimeout(() => engine.setPaused(true), reduced ? 0 : HERO_FADE_MS + 60);   // Hero 층이 다 옅어진 뒤 엔진 멈춤 (그리기는 이미 방이 맡음)
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
    setDebug(q.get("debug") === "1");
    if (apiRef.current) apiRef.current.debug = q.get("debug") === "1";
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

  return (
    // .page = 스크롤 영역. 방 스테이지는 맨 위에 붙어 있고(sticky), 뒤 섹션들이 그 위로 올라옴. 끝의 투명한 창에서 방이 다시 비침
    <div ref={pageRef} className="page home" data-lenis-prevent style={{ overflowY: (free || scrollFlow) && !sleeveLock ? "auto" : "hidden" }}>
    <div ref={contentRef} className="page-content">
    {/* 바탕: Hero 동안은 종이색(--cream, 다크 모드면 테마 값) — 셰이더가 준비될 때까지 캔버스를 숨겨 두는 동안(holdRender) 이 색이 보임.
        예전엔 늘 #15111a 라 다른 페이지에서 Home 으로 오면 검은 화면이 깔렸다가 종이로 바뀌었음 (2026-11-19) */}
    <div ref={wrapRef} data-header-see-through className="relative w-full bg-[#15111a]" style={heroOn ? { backgroundColor: "var(--cream)" } : undefined}>
    <div ref={stageRef} className="sticky top-0 z-0 h-svh w-full overflow-hidden [--frame:0]">
      {/* 페이지를 내리면 방 화면이 액자처럼 조금 작아짐 (--frame 0 → 1, 스크롤 처리에서 넣음) */}
      <div ref={hostRef} className="absolute inset-0 origin-[50%_42%] overflow-hidden will-change-transform"
        style={{ touchAction: free || scrollFlow ? "pan-y" : "none", scale: "calc(1 - var(--frame) * 0.12)", translate: "0 var(--nty, 0px)", borderRadius: "calc(var(--frame) * 28px)" }} />

      {/* 방 안 물체 이름표 (턴테이블 Play/Stop · 램프 Light on/off) — 위치는 효과에서 직접 */}
      <div ref={tipRef} aria-hidden className="pointer-events-none fixed left-0 top-0 z-30 rounded-full bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white opacity-0 backdrop-blur-sm transition-opacity duration-150" />
      {/* 효과음 켜기 · 끄기 (처음엔 꺼짐) */}
      <button type="button" aria-pressed={soundOn}
        onClick={() => { const on = !soundOn; setSoundOn(on); apiRef.current?.sound?.setEnabled(on); }}
        className="absolute bottom-5 right-12 z-20 text-[11px] uppercase tracking-[0.22em] text-white mix-blend-difference transition-opacity duration-500"
        style={{ opacity: heroOn ? 0 : 0.8, pointerEvents: heroOn ? "none" : "auto" }}>
        Sound {soundOn ? "on" : "off"}
      </button>

      {/* 소품 메뉴 카드 (레코드 상자 · 책 · 지금 듣는 판): 누른 물체 위에 뜸 → 버튼을 눌러야 페이지로. 밖을 누르거나 Esc · 스크롤하면 닫힘 */}
      {propMenu && (
        <div data-prop-menu role="dialog" aria-label={propMenu.title}
          className="fixed z-40 w-[min(15rem,80vw)] -translate-x-1/2 -translate-y-full animate-[menu-in_.35s_cubic-bezier(.22,1,.36,1)] rounded-xl bg-[#15111a]/90 p-4 text-[#f4e7cd] shadow-[0_24px_48px_-20px_rgba(0,0,0,.7)] ring-1 ring-white/10 backdrop-blur-md motion-reduce:animate-none"
          style={{ left: `clamp(8.5rem, ${propMenu.x}px, calc(100vw - 8.5rem))`, top: `max(${propMenu.y - 14}px, 15rem)` }}>
          <p className="text-[9px] font-medium uppercase tracking-[0.24em] opacity-60">{propMenu.kicker}</p>
          <p className="mt-1 text-[15px] leading-snug [word-break:keep-all]">{propMenu.title}</p>
          {propMenu.sub && <p className="truncate text-[11px] opacity-60">{propMenu.sub}</p>}
          <div className="mt-3 flex flex-col gap-1.5">
            {propMenu.actions.map((a, i) => {
              const cls = `group/act flex min-h-10 items-center justify-between rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.18em] transition-[background-color,color,scale] duration-300 active:scale-[.97] ${i === 0 ? "bg-[#f4e7cd] text-[#15111a] hover:bg-[#7fc1bd]" : "ring-1 ring-[#f4e7cd]/30 hover:bg-[#f4e7cd]/10"}`;
              const arrow = <span aria-hidden="true" className="transition-transform duration-300 group-hover/act:-translate-y-0.5 group-hover/act:translate-x-0.5">↗︎</span>;
              return a.external
                ? <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => apiRef.current?.closeMenu?.()}>{a.label}{arrow}</a>
                : <button key={a.href} type="button" className={cls} onClick={() => { apiRef.current?.closeMenu?.(); router.push(a.href); }}>{a.label}{arrow}</button>;
            })}
          </div>
          {/* 아래 꼬리: 누른 물체를 가리킴 */}
          <span aria-hidden="true" className="absolute left-1/2 top-full size-3 -translate-x-1/2 -translate-y-1.5 rotate-45 bg-[#15111a]/90" />
        </div>
      )}

      {/* 턴테이블 음악 카드 ("Now spinning", D): 판을 틀면 오른쪽 아래에 나타남. 페이지를 내려도 남음 (Hero 에서는 숨김)
          YouTube 플레이어는 약관상 숨길 수 없고 200×200 이상 → 카드 위쪽이 플레이어. 버튼: 재생 · 멈춤(= 턴테이블 클릭), 닫기 */}
      <div role="region" aria-label="Now spinning" inert={!(music.active && !heroOn)}
        className={`fixed bottom-[4.5rem] right-[var(--gutter)] z-40 w-[200px] overflow-hidden rounded-xl bg-[#15111a]/90 text-[#f4e7cd] shadow-[0_24px_48px_-20px_rgba(0,0,0,.7)] ring-1 ring-white/10 backdrop-blur-md transition-[opacity,translate] duration-500 ease-groove motion-reduce:transition-none ${music.active && !heroOn ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
        <div ref={musicHostRef} className="size-[200px] bg-black [&_iframe]:block [&_iframe]:size-full" />
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-medium uppercase tracking-[0.24em] opacity-60" aria-live="polite">
              {music.error ? "Couldn’t load" : music.blocked ? "Press play" : music.buffering ? "Loading…" : music.playing ? "Now spinning" : "Paused"}
            </p>
            <p className="truncate text-[13px] leading-snug">{music.album?.title}</p>
            <p className="truncate text-[11px] opacity-60">{music.album?.artist}</p>
          </div>
          <button type="button" aria-label={music.playing ? "Pause" : "Play"}
            onClick={() => { const st = apiRef.current; if (!st) return; if (music.blocked || (st.playing && !music.playing)) st.music?.resume(); else st.togglePlay?.(); }}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f4e7cd] text-[#15111a] transition-[background-color,scale] duration-300 hover:bg-[#7fc1bd] active:scale-95">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">{music.playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M4.5 2.5v11l9-5.5z" />}</svg>
          </button>
          <button type="button" aria-label="Close player" onClick={() => apiRef.current?.closeMusic?.()}
            className="grid size-9 shrink-0 place-items-center rounded-full text-[#f4e7cd]/70 transition-colors hover:text-[#f4e7cd]">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
          </button>
        </div>
      </div>

      {/* 종이 결 (Hero 동안만): 캔버스 위에 soft-light 로 섞임. Hero 층 밖에 두고 자기 투명도로 옅어짐
          (예전엔 Hero 층 안에 있어서, 층이 옅어지는 0.4초 동안 층이 따로 그려지며 섞일 바탕을 잃고 회색 결 막이 화면을 한 번 덮었음) */}
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 mix-blend-soft-light ${reduced ? "" : "transition-opacity"}`}
        style={{ opacity: heroOn && !sleeveHero ? "var(--paper-texture-opacity)" : 0, transitionDuration: `${HERO_FADE_MS}ms`, backgroundImage: "var(--paper-texture-image)", backgroundSize: "var(--paper-texture-size) var(--paper-texture-size)" }} />
      {/* Hero: 실제 Home 스테이지 (제목·커서·누르기 입력 · 판 자세). 판은 방 장면의 한 장이 그 자세로, 링·그림자·먼지는 Home 엔진이 방 캔버스 위에 (renderHeroRT) → 이 층은 바탕이 투명
          종이 결은 캔버스 위에 soft-light 로 덮음 (예전 .paper-textured 와 같은 그림·세기) */}
      <div className={`page home absolute! inset-0 bg-transparent! ${reduced ? "" : "transition-opacity"}`} inert={!heroOn}
        style={{ overflow: "hidden", opacity: heroOn ? 1 : 0, pointerEvents: heroOn ? "auto" : "none", transitionDuration: `${HERO_FADE_MS}ms` }}>
        {/* raw Hero(/lab/room-test): Home 엔진 없이 방 장면의 판 한 장만 → 이 층에는 종이 결만 */}
        {!ownHero && (
          <div className="page-content">
            <HomeStage onHeroLeave={leaveHero} sharedRenderer={getShared} onEngine={(e) => { homeRef.current = e; if (apiRef.current) { apiRef.current.home = e; if (apiRef.current.ready) apiRef.current.warmHero?.(); } gateRef.current.hero.resolve(); }} />
          </div>
        )}
      </div>

      {/* ink Hero: "Grooves" 제목 (Home Hero 와 같은 글꼴 · 크기 · 자리) + 커스텀 커서 (마우스에서만). 움직임은 inkHero.js */}
      {/* sleeve Hero: 가운데 앨범의 아티스트 · 제목 + 넘기기 · 열기 버튼 (Hero 에 있는 동안만) */}
      {sleeveHero && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-6 px-[var(--gutter)] pb-[clamp(1.25rem,4vh,2.75rem)] text-[var(--ct-header-fg,#4c404a)] transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${heroOn && done && albums.length ? "opacity-100" : "translate-y-2 opacity-0"}`} data-header-fg=""
          inert={!heroOn}>
          {[-1, 1].map((d) => (
            <button key={d} type="button" aria-label={d < 0 ? "Previous album" : "Next album"} onClick={() => apiRef.current?.sleeve?.step(d)}
              disabled={d < 0 ? sleeveAt <= 0 : sleeveAt >= albums.length - 1}
              className={`${d > 0 ? "order-3" : ""} ${sleeveOpen ? "invisible" : ""} pointer-events-auto rounded-full border border-current/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-25`}>
              {d < 0 ? "←" : "→"}
            </button>
          ))}
          <div className="order-2 min-w-0 text-center" aria-live="polite">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.3em] opacity-70">{albums[sleeveAt]?.artist || " "}</p>
            <p className="mt-1 truncate font-['Grooves_Display','Hahmlet',Georgia,serif] text-[clamp(1.4rem,2.6vw,2.4rem)] leading-tight">{albums[sleeveAt]?.title || " "}</p>
            <button type="button" onClick={() => apiRef.current?.sleeve?.setOpen(!sleeveOpen)}
              className="pointer-events-auto mt-3 rounded-full border border-current/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-70">
              {sleeveOpen ? "Close" : "Open"}
            </button>
            <p className="mt-2 text-[11px] tracking-[0.06em] opacity-60">{sleeveOpen ? "Click the record or scroll to play it" : "Scroll or drag to browse · click a sleeve to open"}</p>
          </div>
        </div>
      )}
      {(inkHero || sleeveHero) && (
        <>
          {/* sleeve Hero 는 재킷 줄이 화면 가운데를 차지하므로 제목을 그 위(헤더와 재킷 사이)에 조금 작게 */}
          <h1 ref={titleRef} aria-label="Grooves"
            className={`pointer-events-none absolute inset-x-0 z-10 select-none overflow-y-clip py-[0.06em] text-center ${MONOTON} leading-none ${sleeveHero ? "top-[15svh] text-[min(8.5vw,12svh)]" : "top-1/2 text-[11vw]"}`}
            style={{ color: HS.text, translate: "0 -50%" }}>
            {"Grooves".split("").map((ch, i) => <span key={i} aria-hidden="true" className="inline-block origin-bottom translate-y-[110%]">{ch}</span>)}
          </h1>
          <div ref={curRefs.ring} className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-300" aria-hidden="true">
            <div className="-translate-x-1/2 -translate-y-1/2">
              <div ref={curRefs.shape} style={{ transform: "scale(0.32)", borderColor: HS.ink3d }} className="relative h-[88px] w-[88px] rounded-full border transition-[transform,background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                <svg ref={curRefs.tick} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300" viewBox="0 0 88 88" fill="none">
                  <circle cx="44" cy="44" r="40" stroke={HS.ink3d} strokeWidth="0.8" strokeDasharray="1.5 5" />
                  <line x1="44" y1="2" x2="44" y2="11" stroke={HS.ink3d} strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <span ref={curRefs.label} style={{ color: HS.text }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-pre text-center text-[11px] font-medium uppercase leading-[1.35] tracking-[0.14em] tabular-nums opacity-0 transition-opacity duration-300" />
            </div>
          </div>
          <div ref={curRefs.dot} className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-200" aria-hidden="true">
            <div className="h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: HS.text, boxShadow: `0 0 0 1px ${HS.paper}` }} />
          </div>
        </>
      )}

      {/* 방 완성 화면: 문구 · Start digging · 스크롤 안내. 방이 완성돼 페이지 스크롤이 풀리면 올라오고, 내리기 시작하면 사라짐
          (끝에서 방이 다시 나올 때는 그 섹션의 문구가 따로 있으므로 숨김: where > 0) */}
      <div data-on={free && where === 0} className="group/done pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-8 px-[var(--gutter)] pb-[clamp(1.5rem,5vh,3.5rem)] text-[#f4e7cd]"
        style={{ opacity: "calc(1 - var(--frame) * 4)" }}>
        <div>
          <p className="overflow-y-clip text-[11px] font-medium uppercase tracking-[0.3em]">
            <span className="block translate-y-[110%] opacity-70 transition-[translate] duration-(--dur-enter) ease-groove group-data-[on=true]/done:translate-y-0 motion-reduce:transition-none">Now spinning · 33⅓ RPM</span>
          </p>
          {/* 문구: 가늘게 있다가 커서가 가까이 오는 글자만 굵어짐 (보일 때만) */}
          <p className={`${CW_FONT} mt-3 text-[clamp(1.9rem,4.2vw,4.6rem)] leading-[1.05] tracking-[-0.02em]`}>
            {["Put a record on.", "Stay a while."].map((line, k) => (
              <span key={line} className="block overflow-y-clip pb-[0.06em]">
                <span className="block translate-y-[110%] transition-[translate] duration-(--dur-enter-title) ease-groove group-data-[on=true]/done:translate-y-0 motion-reduce:transition-none" style={{ transitionDelay: free ? `${120 + k * 110}ms` : "0ms" }}>
                  <CursorWeight text={line} active={free && where === 0} />
                </span>
              </span>
            ))}
          </p>
          <Link href="/digging" tabIndex={free && where === 0 ? 0 : -1}
            className="group/dig mt-[clamp(1rem,2.5vh,2rem)] inline-flex translate-y-3 items-center gap-2 rounded-full bg-[#f4e7cd] px-[clamp(1.5rem,1.8vw,2.5rem)] py-[clamp(0.75rem,1vw,1.25rem)] text-[clamp(11px,0.8vw,14px)] font-semibold uppercase tracking-[0.2em] text-[#4c404a] opacity-0 transition-[opacity,translate,background-color,scale] delay-[420ms] duration-(--dur-enter) ease-groove hover:bg-[#7fc1bd] active:scale-95 group-data-[on=true]/done:pointer-events-auto group-data-[on=true]/done:translate-y-0 group-data-[on=true]/done:opacity-100 motion-reduce:transition-none">
            Start digging <span className="transition-transform duration-300 group-hover/dig:-translate-y-0.5 group-hover/dig:translate-x-0.5">↗︎</span>
          </Link>
        </div>
        <p className="mb-1 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] opacity-0 transition-opacity delay-[700ms] duration-700 group-data-[on=true]/done:opacity-70 max-md:hidden">
          Scroll <span aria-hidden="true" className="relative block h-10 w-px overflow-hidden bg-current/30"><span className="absolute inset-0 animate-[scroll-cue_2.2s_ease-in-out_infinite] bg-current motion-reduce:animate-none" /></span>
        </p>
      </div>

      {/* 디버그 패널 (?debug=1) */}
      <div hidden={!debug} className="absolute left-4 top-20 z-20 w-72 rounded-lg bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-white">
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
    {/* 한 장면 흐름: 판이 앉기까지 + 방이 지어지는 걸 보는 스크롤 길이 (그동안 방 스테이지가 화면에 붙어 있음) */}
    {scrollFlow && <div aria-hidden="true" style={{ height: `${(FLOW.travel + FLOW.hold) * 100}svh` }} />}
    {/* 섹션 바탕: 방 스테이지 위 · 섹션 글과 그림 아래에 붙어 있는 캔버스 (흐름에서 자리를 차지하지 않게 한 화면만큼 끌어올림) */}
    <canvas ref={wipeRef} aria-hidden="true" className="pointer-events-none sticky top-0 z-[5] -mt-[100svh] block h-svh w-full" />
    {/* 섹션 목차 01–05: 화면 오른쪽에 붙어 있음. 색은 헤더 글자색(지금 바탕에 맞춰 바뀜)을 따름. New Vinyls · News 에서는 번호만 */}
    <nav aria-label="Home sections" data-header-fg="" className={`pointer-events-none sticky top-0 z-20 -mt-[100svh] flex h-svh items-center justify-end pr-[var(--gutter)] text-[var(--ct-header-fg,#4c404a)] transition-opacity duration-700 max-md:hidden ${done ? "opacity-100" : "opacity-0"}`}>
      <ol className="flex flex-col items-end gap-[clamp(10px,1.6vh,18px)]">
        {INDEX.map((name, i) => {
          const cur = where > 0 ? where + 1 : heroOn ? 0 : 1;
          const compact = cur === 2 || cur === 3;   // New Vinyls(갤러리가 화면 끝까지)·News 에서는 커버·카드와 겹치지 않게 번호만
          const open = cur === i && !compact;
          return (
            <li key={name}>
              <button type="button" onClick={() => goIndex(i)} aria-current={cur === i ? "step" : undefined}
                className={`group/sec pointer-events-auto flex items-center gap-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] tabular-nums transition-opacity duration-500 hover:opacity-100 ${cur === i ? "opacity-100" : "opacity-45"}`}>
                <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-500 ease-groove motion-reduce:transition-none ${open ? "max-w-[10rem] opacity-100" : "max-w-0 opacity-0"} ${compact ? "" : "group-hover/sec:max-w-[10rem] group-hover/sec:opacity-100"}`}>{name}</span>
                <span aria-hidden="true" className={`h-px bg-current transition-[width] duration-500 ease-groove motion-reduce:transition-none ${open ? "w-8" : "w-3"}`} />
                <span>{String(i + 1).padStart(2, "0")}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
    <HomeSections albums={albums} posts={POSTS} onTop={onTop} />
    </div>
    </div>
    </div>
  );
}
