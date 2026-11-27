import * as THREE from 'three';
import { drawDividerFace, drawDividerTab } from './crateDivider';
import { createSleeveFx, PEEL, STICKER } from '../sleeveFx';
import { isPeeled, markPeeled } from '../peeled';

/* Crate 보기 3D 엔진 (Digging · Collection 공용, DOM 그리드 위에 덮는 캔버스)
   - 크레이트: 맨 앞 판은 정면, 뒤의 판들은 오른쪽으로 비스듬히 줄지어 꽂힘. 스크롤·드래그·키로 끝없이 넘어감
   - Grid → Crate / Crate → Grid: 화면의 그리드 칸 ↔︎ 크레이트 자리 사이를 판이 차례로 날아감 (m: 0 = 크레이트, 1 = 그리드)
   카드 목록은 그리드 DOM에서 읽음: [{ slug, color, image, title, artist, art(커버 요소) }] */

export const CRATE = {
  SLOTS: 64,          // 만들어 두는 판 수 (Listening 선반은 화면 폭만큼 책등이 필요함)
  VIS: 18,            // Crate 에서 동시에 그리는 판 수 (끝없이 넘길 때 이 수만 재사용)
  LISTEN_DUR: 1.25,   // Crate ↔ Listening 전환 시간(초)
  DUR: 1.5,           // 전환 시간(초)
  WHEEL: 0.0045,      // 휠 1px 당 넘어가는 판 수
  DRAG: 0.008,        // 드래그 1px 당
};
const { SLOTS, VIS } = CRATE;
// Listening 선반: 책등 두께(재킷 두께의 배) — 실제 두께(1%)로는 제목을 읽을 수 없어서 책처럼 두껍게
const SPINE = { thick: 4.4, gapPx: 2 };   // (2026-11-27 6.5 → 4.4: 너무 두껍다고 함)
const FOV = 32, CAM_Z = 10;
const clampN = (lo, x, hi) => Math.min(hi, Math.max(lo, x));
// 넓은 화면(820px 이상)의 자리 나눔 — CrateView 의 CSS 변수(--crate-gut · --crate-panel · --crate-gap)와 같은 식
//  왼쪽: 여백 + 정보 패널 + 틈 → 그 오른쪽부터 맨 앞 판. 판 더미는 화면 오른쪽 밖으로 이어짐
export const crateLayout = (W) => {
  const gut = clampN(16, W * 0.04, 56), panel = clampN(260, W * 0.28, 380), gap = clampN(24, W * 0.03, 56);
  return { gut, panel, gap, left: gut + panel + gap };
};

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'o', 'c', 't'];   // t = 두께 배율 (Listening 선반에서만 1 이 아님)
const lerpPose = (a, b, t, o) => { for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

// onPeel(): 스티커를 떼어 냄 (소리용)
// onToggle(): Listening 에서 턴테이블을 누름 (재생 · 멈춤)
export function createCrateEngine({ host, onFront, onOpen, onSettled, onPeel, onToggle }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;   // Listening 의 턴테이블을 같은 캔버스에 먼저 그림 → 프레임마다 직접 지움
  const canvas = renderer.domElement;
  canvas.className = 'absolute inset-0 block h-full w-full';
  host.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  scene.fog = new THREE.Fog(0xf3e7cd, 11, 26);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  let CARD = 3.2, W = 1, H = 1, narrow = false, FX = 0, FY = 0;
  const geo = new THREE.BoxGeometry(1, 1, 0.022);
  // 재킷 디테일 (sleeveFx.js): 앞면의 광택 · 종이 모서리 + 새로 들어온 판의 떼어지는 스티커 (NEW IN)
  const fx = createSleeveFx({ aniso });
  const PEEL_DIR = new THREE.Vector2(Math.cos((PEEL.dir * Math.PI) / 180), Math.sin((PEEL.dir * Math.PI) / 180));   // 스티커 가운데를 잡았을 때 들리는 쪽 (오른쪽 위)
  const tone = new THREE.Color();
  const hashOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  // 재킷의 입구(오른쪽 옆면): 판지 두 겹 사이의 어두운 틈과 그 안의 흰 속지 — 뒤에 비스듬히 선 판들은 이 면이 보임
  const openTex = (() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 4;
    const g = c.getContext('2d');
    g.fillStyle = '#d9cfbb'; g.fillRect(0, 0, 32, 4);        // 판지
    g.fillStyle = '#2b2422'; g.fillRect(9, 0, 14, 4);        // 틈
    g.fillStyle = '#f6f1e6'; g.fillRect(13, 0, 6, 4);        // 속지
    g.fillStyle = '#17120f'; g.fillRect(15.5, 0, 1.5, 4);    // 속지 안의 판
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  // 장르 칸막이(card.divider)일 때만 보이는 탭: 판 위로 솟은 크래프트 조각 + 다이모 라벨 (판의 자식 → 같이 움직임)
  const TAB = { w: 0.46, h: 0.12, x: -0.18 };
  const KRAFT = new THREE.Color('#c9a679'), KRAFT_EDGE = new THREE.Color('#a9865a');
  const makeSlot = () => {
    const edge = new THREE.MeshBasicMaterial({ transparent: true });
    const spine = new THREE.MeshBasicMaterial({ transparent: true });   // 책등(-x 면): Listening 선반에서 제목이 보이는 면
    const front = new THREE.MeshBasicMaterial({ transparent: true });
    const back = new THREE.MeshBasicMaterial({ transparent: true, color: 0xd9ccb2 });
    const open = new THREE.MeshBasicMaterial({ transparent: true, map: openTex });
    const mesh = new THREE.Mesh(geo, [open, spine, edge, edge, front, back]);
    const tabFront = new THREE.MeshBasicMaterial({ transparent: true });
    const tabEdge = new THREE.MeshBasicMaterial({ transparent: true, color: KRAFT_EDGE });
    const tabBack = new THREE.MeshBasicMaterial({ transparent: true, color: KRAFT });
    const tab = new THREE.Mesh(geo, [tabEdge, tabEdge, tabEdge, tabEdge, tabFront, tabBack]);
    tab.scale.set(TAB.w, TAB.h, 1); tab.position.set(TAB.x, 0.5 + TAB.h / 2, 0); tab.visible = false;
    mesh.add(tab);
    const finish = fx.finish(); finish.mesh.position.z = 0.0114; mesh.add(finish.mesh);
    const sticker = fx.sticker();
    const dir = PEEL_DIR.clone(); sticker.u.uDir.value = dir;
    sticker.mesh.scale.setScalar(STICKER.size); sticker.mesh.position.set(STICKER.at, STICKER.at, 0.0126); sticker.mesh.rotation.z = STICKER.tilt;
    mesh.add(sticker.mesh);
    scene.add(mesh);
    return { mesh, edge, spine, front, back, tab, tabFront, tabEdge, tabBack, open, finish, sticker, peel: PEEL.rest, dir, fly: 0, d: 0, lift: 0, card: null, edgeBase: new THREE.Color() };
  };
  const slots = Array.from({ length: SLOTS }, makeSlot);
  const hero = makeSlot();   // Listening 무대의 재킷 (고른 판) — 선반의 그 판 대신 이 한 장이 무대와 선반 사이를 오감

  /* ---- 커버 텍스처: 불러오는 동안은 대표 색 ---- */
  const textures = new Map();
  let disposed = false;
  const loader = new THREE.ImageLoader();
  loader.setCrossOrigin('anonymous');
  function texOf(card) {
    let t = textures.get(card.slug);
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const g = c.getContext('2d'); g.fillStyle = card.color || '#bbcbda'; g.fillRect(0, 0, 4, 4);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    textures.set(card.slug, t);
    // 불러오면 새 텍스처로 바꿔 끼움 (크기가 다른 이미지를 같은 텍스처에 넣으면 GPU 메모리를 다시 잡지 못함)
    if (card.image) loader.load(card.image, (img) => {
      if (disposed || textures.get(card.slug) !== t) return;
      const nt = new THREE.Texture(img);
      nt.colorSpace = THREE.SRGBColorSpace; nt.anisotropy = aniso; nt.needsUpdate = true;
      textures.set(card.slug, nt);
      for (const s of [...slots, hero]) if (s.front.map === t) { s.front.map = nt; s.front.needsUpdate = true; }
      t.dispose();
    }, undefined, () => {});
    return t;
  }

  // 칸막이 그림 (앞면 · 탭): 손글씨 글꼴이 늦게 오면 한 번 더 그림
  function dividerTex(card) {
    const key = `divider:${card.head}|${card.count}|${card.tab}|${card.dot}`;
    let t = textures.get(key);
    if (t) return t;
    const make = () => ({ face: drawDividerFace(card), tab: drawDividerTab(card) });
    const d = make();
    const face = new THREE.CanvasTexture(d.face), tab = new THREE.CanvasTexture(d.tab);
    for (const x of [face, tab]) { x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = aniso; }
    t = { face, tab, dispose() { face.dispose(); tab.dispose(); } };
    textures.set(key, t);
    document.fonts?.load?.('400 40px "Permanent Marker"').then(() => {
      if (disposed) return;
      const n = make(); face.image = n.face; tab.image = n.tab; face.needsUpdate = tab.needsUpdate = true;
    }).catch(() => {});
    return t;
  }

  // 책등 그림 (Listening): 커버 대표색 바탕에 제목 · 아티스트를 아래에서 위로
  const spines = new Map();
  function spineTex(card) {
    let t = spines.get(card.slug);
    if (t) return t;
    // 그림의 비율 = 책등의 비율 (폭 = 높이 × 0.022 × 두께 배율) → 글자가 찌그러지지 않음
    const CW = 52, CH = Math.round(CW / (0.022 * SPINE.thick));
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const g = c.getContext('2d');
    tone.set(card.color || '#bbcbda');
    const light = 0.299 * tone.r + 0.587 * tone.g + 0.114 * tone.b > 0.36;   // 선형 값 기준
    g.fillStyle = card.color || '#bbcbda'; g.fillRect(0, 0, CW, CH);
    const sh = g.createLinearGradient(0, 0, CW, 0);
    sh.addColorStop(0, 'rgba(0,0,0,.22)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.62, 'rgba(255,255,255,.1)'); sh.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = sh; g.fillRect(0, 0, CW, CH);
    // 위에서 아래로 읽음 (2026-11-27 사용자 요청 — 처음엔 아래에서 위로였음)
    const LEN = CH - 36;
    g.save(); g.translate(CW / 2, 18); g.rotate(Math.PI / 2);
    g.fillStyle = light ? '#2a2228' : '#f4e7cd'; g.textBaseline = 'middle';
    try { g.letterSpacing = '1.5px'; } catch {}
    const fit = (text, max) => { let s = text; while (s.length > 2 && g.measureText(s).width > max) s = s.slice(0, -2); return s === text ? s : s.trim() + '…'; };
    g.font = '700 27px "Hahmlet", Georgia, serif';
    const title = fit((card.title || '').toUpperCase(), LEN), tw = g.measureText(title).width;
    g.fillText(title, 0, -1);
    if (tw < LEN - 110 && card.artist) { g.globalAlpha = 0.72; g.font = '400 22px "Hahmlet", Georgia, serif'; g.fillText(fit(card.artist.toUpperCase(), LEN - tw - 24), tw + 24, -1); }
    g.restore();
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    spines.set(card.slug, t);
    return t;
  }

  let cards = [];
  const N = () => cards.length;
  const wrap = (i) => (N() ? ((i % N()) + N()) % N() : 0);
  function setSlot(slot, idx) {
    const card = cards[idx];
    if (slot.card === card && slot.spined === useSpines) return;
    slot.spined = useSpines;
    // 떼어져 날아가던 스티커는 판이 바뀌면 그대로 떼어진 것으로 · 잡고 있던 것은 놓음
    if (slot.fly > 0 && slot.card) markPeeled(slot.card.slug);
    if (peel?.slot === slot) peel = null;
    slot.card = card; slot.peel = PEEL.rest; slot.fly = 0; slot.dir.copy(PEEL_DIR);
    if (!card) return;
    slot.mesh.material[0] = card.divider ? slot.edge : slot.open;   // 칸막이(판지 한 장)에는 입구가 없음
    // 판마다 다른 비닐 주름 · 커버의 밝기 (어두운 커버에서는 빛 띠를 줄임)
    tone.set(card.color || '#bbcbda');
    fx.wrapFor(slot.finish, hashOf(card.slug || ''), 0.2126 * tone.r + 0.7152 * tone.g + 0.0722 * tone.b);
    const sp = useSpines && !card.divider ? spineTex(card) : null;
    if (slot.spine.map !== sp) { slot.spine.map = sp; slot.spine.needsUpdate = true; }
    if (card.divider) {
      const t = dividerTex(card);
      slot.front.map = t.face; slot.tabFront.map = t.tab;
      slot.front.needsUpdate = slot.tabFront.needsUpdate = true;
      slot.edgeBase.copy(KRAFT_EDGE); slot.back.color.copy(KRAFT);
      return;
    }
    slot.front.map = texOf(card); slot.front.needsUpdate = true;
    slot.edgeBase.set(card.color || '#bbcbda').multiplyScalar(0.62);
    slot.back.color.set(0xd9ccb2);
  }

  /* ---- 자세 ---- */
  // d = 맨 앞에서 몇 번째(소수). 0 = 맨 앞, 음수 = 앞으로 넘긴 판
  function cratePose(d, o) {
    const u = CARD / 3.2;
    const fx = FX, fy = FY;   // 맨 앞 판의 자리 (resize 에서 정함)
    if (d < 0) {
      const k = Math.min(1, -d);
      o.x = fx - k * 0.2 * u; o.y = fy - k * 2.4 * u; o.z = k * 2.2 * u;
      o.rx = -k * 1.25; o.ry = 0; o.rz = 0; o.s = 1; o.o = 1 - ss(0, 1, k); o.c = 1; o.t = 1;
      return o;
    }
    const near = ss(0, 1, d), far = Math.max(0, d - 1);
    o.x = fx + ((narrow ? 1.6 : 2.05) * near + (narrow ? 0.22 : 0.34) * far) * u;
    o.y = fy + (0.08 * d + 0.012 * far * far) * u;
    o.z = (-0.9 * near - 0.62 * far) * u;
    o.rx = 0; o.ry = -1.12 * near - 0.02 * far; o.rz = 0.025 * far;
    o.s = 1; o.o = 1 - ss(VIS - 5, VIS - 2, d); o.c = 1 - Math.min(0.42, 0.05 * d); o.t = 1;
    return o;
  }
  // 화면 사각형(그리드 칸) → z=0 평면 위 같은 크기·위치 (캔버스 기준)
  let hostRect = { left: 0, top: 0, width: 1, height: 1 };
  function rectPose(r, o) {
    const visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360), wpp = visH / hostRect.height;
    o.x = (r.left + r.width / 2 - (hostRect.left + hostRect.width / 2)) * wpp;
    o.y = -(r.top + r.height / 2 - (hostRect.top + hostRect.height / 2)) * wpp;
    o.z = 0; o.rx = o.ry = o.rz = 0; o.s = (r.width * wpp) / CARD; o.o = 1; o.c = 1; o.t = 1;
    return o;
  }
  function applyPose(slot, p, fly) {
    const m = slot.mesh;
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(p.rx, p.ry, p.rz);
    m.scale.set(CARD * p.s, CARD * p.s, CARD * p.s * (p.t ?? 1));
    for (const mat of [slot.front, slot.back, slot.edge, slot.spine, slot.open, slot.tabFront, slot.tabEdge, slot.tabBack]) mat.opacity = p.o;
    slot.open.color.setScalar(p.c);
    slot.front.color.setScalar(p.c);
    slot.tabFront.color.setScalar(p.c);
    slot.edge.color.copy(slot.edgeBase).multiplyScalar(p.c);
    if (slot.spine.map) slot.spine.color.setScalar(p.c); else slot.spine.color.copy(slot.edge.color);
    m.visible = p.o > 0.003 && !!slot.card;
    slot.tab.visible = !!slot.card?.divider;
    m.renderOrder = Math.round(p.z * 100) + (fly ? 5000 : 0);
    // 디테일: 칸막이(판지)에는 없음. 광택은 맨 앞 판에서 가장 세고, 판이 앞으로 넘어오는 동안 띠가 쓸고 지나감 (+ 마우스를 따라 조금)
    const plain = !!slot.card && !slot.card.divider, near = Math.abs(slot.d);
    const f = slot.finish, st = slot.sticker;
    f.mesh.visible = plain; f.mesh.renderOrder = m.renderOrder + 1;
    // (2026-11-23) 그리드 카드에는 비닐 · 마감이 없음 → 카드 자리에 가까울수록 옅게 (Grid ↔ Crate 전환에서 비닐이 툭 생기거나 사라지지 않게)
    //  + 주름 지도가 늦게 준비되면 그때부터 서서히
    f.u.uOpacity.value = p.o * (1 - (slot.gridK || 0)); f.u.uWrap.value = fx.wrapReady(f); f.u.uGloss.value = 1 - ss(0.3, 1.8, near);
    f.u.uLight.value.set(hover.x * 0.55 + slot.d * 0.9, hover.y * 0.3);
    st.mesh.visible = plain && !!slot.card.isNew && !isPeeled(slot.card.slug); st.mesh.renderOrder = m.renderOrder + 2;
    // 떼어져 떨어지는 동안(fly 0→1): 당긴 쪽으로 밀려나며 아래로 떨어지고 · 돌고 · 옅어짐
    const fl = slot.fly;
    st.mesh.position.set(STICKER.at - slot.dir.x * 0.26 * fl, STICKER.at - slot.dir.y * 0.26 * fl - 0.5 * fl * fl, 0.0126 + 0.12 * fl);
    st.mesh.rotation.z = STICKER.tilt + fl * 0.9;
    st.u.uOpacity.value = p.o * (1 - ss(0.45, 1, fl)); st.u.uShade.value = p.c; st.u.uPeel.value = slot.peel;
  }

  /* ---- 상태 ---- */
  let mode = 'grid', m = 1, anim = null, cardOff = 0, running = false;
  // Listening: L = 0 Crate … 1 Listening · sel = 무대에 올라간 판 · selK = 그 재킷이 선반(0) ↔ 무대(1) · swap = 판을 바꾸는 중
  let L = 0, animL = null, useSpines = false, sel = 0, selK = 1, swap = null, playing = false, hoverIdx = -1, picked = false;
  let stage = null, stageLoading = false, LS = null, cardSpace = false;
  hero.mesh.visible = false;
  let pos = 0, target = 0, lastInput = 0, drag = null, touch = null;
  // 마우스 자리 (-1~1, 부드럽게 따라감): 광택이 따라 움직이고, 맨 앞 판 위에 있으면 스티커가 더 말려 올라감
  const hover = { on: false, nx: 0, ny: 0, x: 0, y: 0 };
  // 스티커를 잡고 끄는 중: { slot, G(잡은 가장자리, 스티커 기준 · 지름 1), id, moved, x, y, to(들림), dir }
  let peel = null;
  const hidden = new Set();   // 3D가 대신하는 동안 숨긴 그리드 커버
  function hideArt(el, on) {
    if (!el) return;
    if (on && !hidden.has(el)) { el.style.visibility = 'hidden'; hidden.add(el); }
    if (!on && hidden.has(el)) { el.style.visibility = ''; hidden.delete(el); }
  }
  function showAllArt() { for (const el of hidden) el.style.visibility = ''; hidden.clear(); }

  /* ---- 입력 (크레이트일 때만) ---- */
  const live = () => mode === 'crate' && !anim && !animL;
  const liveL = () => mode === 'listen' && !anim && !animL;
  const onWheel = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!live() && !liveL()) return;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1);
    target += d * (liveL() ? 0.7 / LS.pitchPx : CRATE.WHEEL); lastInput = performance.now();
  };
  // 화면 위치는 매번 새로 잼: 페이지 넘김 중(페이지가 기울고 작아진 상태)에 열려도 클릭 위치가 어긋나지 않게
  const syncRect = () => { hostRect = host.getBoundingClientRect(); };
  // 화면의 점 → 맨 앞 판 스티커 위의 점 (스티커 기준: 가운데 0 · 지름 1). 스티커 밖이면 null
  const plane = new THREE.Plane(), v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
  const aim = (cx, cy) => { ndc.set(((cx - hostRect.left) / hostRect.width) * 2 - 1, -((cy - hostRect.top) / hostRect.height) * 2 + 1); raycaster.setFromCamera(ndc, camera); };
  function stickerAt(cx, cy, reach = 0.56) {
    const fs = frontSlot(), st = fs.sticker.mesh;
    if (!live() || !fs.mesh.visible || !st.visible || fs.fly > 0) return null;
    aim(cx, cy);
    const hit = raycaster.intersectObject(fs.mesh, false)[0];
    if (!hit) return null;
    const p = st.worldToLocal(hit.point.clone());
    return Math.hypot(p.x, p.y) <= reach ? { slot: fs, x: p.x, y: p.y } : null;
  }
  // 끄는 중에는 판 밖으로 나가도 따라와야 하므로, 스티커가 놓인 평면과 만나는 점으로 잼
  function onStickerPlane(slot, cx, cy) {
    const st = slot.sticker.mesh;
    aim(cx, cy);
    plane.setFromNormalAndCoplanarPoint(n3.set(0, 0, 1).transformDirection(slot.mesh.matrixWorld), st.getWorldPosition(v3));
    return raycaster.ray.intersectPlane(plane, v3) ? st.worldToLocal(v3) : null;
  }
  const onDown = (e) => {
    if (!(live() || liveL()) || e.button !== 0) return;
    syncRect();
    if (e.target instanceof Element && e.target.closest('button, a')) return;
    // 스티커를 잡았으면 판을 넘기는 대신 스티커를 뗌. 잡은 곳에서 가장 가까운 가장자리가 들림 (가운데를 잡으면 평소 들려 있는 쪽)
    const hit = stickerAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 0.7 : 0.56);
    if (hit) {
      const r = Math.hypot(hit.x, hit.y);
      const G = r > 0.12 ? new THREE.Vector2(hit.x, hit.y).multiplyScalar(0.5 / r) : PEEL_DIR.clone().multiplyScalar(0.5);
      peel = { slot: hit.slot, G, id: e.pointerId, moved: false, x: e.clientX, y: e.clientY, to: PEEL.rest, dir: G.clone().normalize() };
      canvas.setPointerCapture?.(e.pointerId);
      return;
    }
    drag = { x: e.clientX, y: e.clientY, start: target, moved: false, id: e.pointerId, touch: e.pointerType === 'touch' };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (e.pointerType === 'mouse') { hover.on = true; hover.nx = ((e.clientX - hostRect.left) / hostRect.width) * 2 - 1; hover.ny = -((e.clientY - hostRect.top) / hostRect.height) * 2 + 1; hover.cx = e.clientX; hover.cy = e.clientY; }
    if (peel && e.pointerId === peel.id) {
      if (Math.hypot(e.clientX - peel.x, e.clientY - peel.y) > 6) peel.moved = true;
      // 잡은 가장자리 G 가 손가락 P 까지 접혀 오려면: 접힌 선 = G 와 P 의 수직이등분선. 떼어지는 방향 = P → G, 접힌 선의 자리 = 가운데 점
      const P = onStickerPlane(peel.slot, e.clientX, e.clientY);
      if (P) {
        const vx = peel.G.x - P.x, vy = peel.G.y - P.y, len = Math.hypot(vx, vy);
        // 바깥으로 끌면(가장자리에서 멀어지는 쪽) 떼어지지 않음
        if (len < 0.02 || (vx * peel.G.x + vy * peel.G.y) * 2 < 0.02) peel.to = PEEL.rest;
        else {
          peel.dir.set(vx / len, vy / len);
          peel.to = clampN(PEEL.rest, 0.5 - ((peel.G.x + P.x) / 2 * peel.dir.x + (peel.G.y + P.y) / 2 * peel.dir.y), 1.08);
        }
      }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = drag.x - e.clientX, dy = drag.y - e.clientY;
    if (Math.hypot(dx, dy) > 10) drag.moved = true;   // 클릭하며 손이 조금 움직여도 클릭으로
    if (drag.moved) { target = drag.start + (liveL() ? dx / LS.pitchPx : (drag.touch && Math.abs(dy) > Math.abs(dx) ? dy : dx) * CRATE.DRAG); lastInput = performance.now(); }
  };
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const onUp = (e) => {
    if (peel && e.pointerId === peel.id) {
      const pd = peel; peel = null;
      if (pd.moved) {
        // 반 넘게 떼고 놓으면 떨어져 나감 (그 판의 스티커는 그리드에서도 사라짐). 덜 뗐으면 도로 붙음
        //  (화면의 들림은 손가락을 조금 늦게 따라가므로, 빠르게 휙 떼어도 되게 손가락이 간 곳(to)으로 판단)
        if (pd.to > PEEL.off && pd.slot.card) { pd.slot.dir.copy(pd.dir); pd.slot.fly = 0.001; onPeel?.(); }
        return;
      }
      // 움직이지 않고 눌렀다 뗀 것은 판을 누른 것으로 → 아래에서 앨범을 엶
      drag = { moved: false, id: e.pointerId };
    }
    if (!drag || e.pointerId !== drag.id) return;
    const was = drag; drag = null;
    if (was.moved) return;
    if (liveL()) { listenClick(e.clientX, e.clientY); return; }
    if (!live()) return;
    syncRect();
    ndc.set(((e.clientX - hostRect.left) / hostRect.width) * 2 - 1, -((e.clientY - hostRect.top) / hostRect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    // 1) 정면 판 위면 무조건 열기 — 앞으로 넘어가며 흐려지는 판·옆 판이 광선을 먼저 가로채도 정면 판이 이김
    const fs = frontSlot();
    if (fs.mesh.visible && raycaster.intersectObject(fs.mesh, false).length) { onOpen?.(wrap(Math.round(pos)), frontRect()); return; }
    // 2) 뒤에 선 판을 누르면 그 판까지 넘김 (이미 넘어간 판은 무시)
    const frac = pos - Math.floor(pos);
    const back = slots.filter((s, j) => s.mesh.visible && j - 1 - frac > 0.5);
    const hit = raycaster.intersectObjects(back.map((s) => s.mesh), false)[0];
    if (!hit) return;
    const j = slots.findIndex((s) => s.mesh === hit.object);
    const d = Math.round(j - 1 - frac);
    if (d > 0) { target = Math.round(pos) + d; lastInput = performance.now(); }
  };
  // Listening: 무대의 재킷 = 앨범 열기 · 책등 = 그 판을 올림 · 턴테이블 = 재생 / 멈춤
  const shelfMeshes = () => slots.filter((s) => s.mesh.visible).map((s) => s.mesh);
  function listenClick(cx, cy) {
    syncRect(); aim(cx, cy);
    if (hero.mesh.visible && raycaster.intersectObject(hero.mesh, false).length) { onOpen?.(sel, rectOf(hero)); return; }
    const hit = raycaster.intersectObjects(shelfMeshes(), false)[0];
    if (hit) { select(cards.indexOf(slots.find((s) => s.mesh === hit.object)?.card)); return; }
    const x = cx - hostRect.left, y = cy - hostRect.top, t = LS.tt;
    if (x > t.left && x < t.left + t.width && y > t.top && y < t.top + t.height) onToggle?.();
  }
  function select(i) {
    if (!liveL() || swap || i < 0 || i >= N() || i === sel || cards[i].divider) return;
    swap = { to: i, t: 0, phase: 0, T: stage ? [0.5, 0.42, 0.75, 0.7] : [0.01, 0.42, 0.75, 0.01] };
    lastInput = performance.now();
  }
  const step = (dir) => { let i = sel + dir; while (cards[i]?.divider) i += dir; select(i); };
  const onKey = (e) => {
    if (liveL() && !(e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]'))) {
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) { step(1); e.preventDefault(); }
      else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { step(-1); e.preventDefault(); }
      else if (e.key === 'Enter' && document.activeElement === host) onOpen?.(sel, rectOf(hero));
      else if (e.key === ' ' && !(e.target instanceof Element && e.target.closest('button, a'))) { onToggle?.(); e.preventDefault(); }
      return;
    }
    if (!live() || (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { target = Math.round(target) + 1; e.preventDefault(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { target = Math.round(target) - 1; e.preventDefault(); }
    else if (e.key === 'Enter' && document.activeElement === host) onOpen?.(wrap(Math.round(pos)), frontRect());
    else return;
    lastInput = performance.now();
  };
  host.addEventListener('wheel', onWheel, { passive: false });
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', () => { drag = null; peel = null; });
  host.addEventListener('pointerleave', () => { hover.on = false; });
  host.addEventListener('touchmove', (e) => { if (mode !== 'grid' && e.cancelable) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', onKey);

  // 맨 앞 판의 화면 위치 (앨범 상세로 날아가는 커버 전환의 출발점)
  const corner = new THREE.Vector3();
  // 지금 정면에 선 판 (넘기는 도중이면 반 넘게 들어온 쪽)
  const frontSlot = () => slots[1 + Math.round(pos - Math.floor(pos))];
  const frontRect = () => rectOf(frontSlot());
  function rectOf(slot) {
    syncRect();
    const h = 0.5;
    slot.mesh.updateWorldMatrix(true, false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
      corner.set(x, y, 0.011).applyMatrix4(slot.mesh.matrixWorld).project(camera);
      const px = hostRect.left + (corner.x * 0.5 + 0.5) * hostRect.width, py = hostRect.top + (-corner.y * 0.5 + 0.5) * hostRect.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }

  /* ---- 크기 ---- */
  function resize() {
    // 크기는 레이아웃 기준(변형 전), 화면 위치는 syncRect 로 따로
    hostRect = host.getBoundingClientRect(); W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    narrow = W < 820;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360), wpp = visH / H;
    // 맨 앞 판의 크기 · 자리 (화면 px 로 정한 뒤 z=0 평면의 크기로)
    //  넓은 화면: 정보 패널 오른쪽에, 화면 높이의 68%까지 (예전 52% · 화면 가운데 왼쪽 → 왼쪽 3분의 1이 비어 있었음)
    //  좁은 화면: 위쪽에 두고 정보는 그 아래
    let cardPx, cx, cy;
    if (narrow) {
      const top = Math.max(H * 0.19, 150)   // 칸막이 탭이 위 글자(어디의 상자인지)와 겹치지 않게 — CratePanel 의 좁은 화면 자리와 같은 식;
      cardPx = Math.min(W * 0.7, H * 0.34);
      cx = W / 2 - 0.078 * cardPx; cy = top + cardPx / 2;
    } else {
      const { left } = crateLayout(W), top = Math.max(H * 0.14, 110), bottom = Math.max(H * 0.1, 72);
      cardPx = Math.max(160, Math.min(H * 0.68, H - top - bottom, W - left - W * 0.16));
      cx = left + cardPx / 2; cy = top + (H - top - bottom) / 2;
    }
    CARD = cardPx * wpp; FX = (cx - W / 2) * wpp; FY = -(cy - H / 2) * wpp;
    // Listening 자리 (화면 px 로 정한 뒤 z=0 평면의 크기로): 위 = 무대(재킷 + 턴테이블), 아래 = 책등 선반
    {
      const gut = clampN(16, W * 0.04, 56), lay = crateLayout(W);
      const shelfPx = clampN(narrow ? 110 : 150, H * 0.22, 230), boardPx = clampN(16, H * 0.035, 32);
      const pitchPx = shelfPx * 0.022 * SPINE.thick + SPINE.gapPx;
      let top, left, right, bottom = H - boardPx - shelfPx * 1.14 - 14;
      if (narrow) { top = Math.max(H * 0.17, 140); bottom = Math.min(bottom, top + Math.min(W * 0.6, H * 0.28)); left = gut; right = W - gut; }
      else { top = Math.max(H * 0.14, 110) + 36; left = lay.left; right = W - gut; }
      // Now spinning 카드는 선반 오른쪽 끝에 놓임 → 그만큼 선반을 줄임 (2026-11-27: 무대 오른쪽을 비워 두었더니 창이 좁을 때 재킷 · 판이 너무 작았음)
      const shelfRight = W - gut - (cardSpace && !narrow ? 216 : 0);
      const sw = right - left, sh = Math.max(60, bottom - top);
      // 재킷 오른쪽으로 판이 반쯤 나오고 그 오른쪽 위에 톤암 → 재킷 폭의 약 1.85배 자리
      const jPx = Math.max(80, Math.min(sh * (narrow ? 0.9 : 0.86), sw / 1.9));
      LS = {
        sh: shelfPx * wpp, pitch: pitchPx * wpp, pitchPx, count: Math.max(1, Math.floor((shelfRight - gut) / pitchPx)),
        x0: (gut - W / 2) * wpp, x1: (shelfRight - W / 2) * wpp, y0: -(H / 2 - boardPx) * wpp,
        jx: (left + jPx / 2 - W / 2) * wpp, jy: -((top + bottom) / 2 - H / 2) * wpp, js: jPx * wpp,
        // 판: 재킷 가운데(cx0, 재킷 안)에서 오른쪽(cx1)으로 나옴 · d = 판 지름(px) · tt = 눌러서 재생 / 멈춤하는 구역 (판 + 톤암)
        disc: { cx0: left + jPx * 0.5, cx1: left + jPx * 1.04, cy: (top + bottom) / 2, d: jPx * 0.94 },
        tt: { left: left + jPx, top: (top + bottom) / 2 - jPx / 2, width: jPx * 0.9, height: jPx },
      };
      host.style.setProperty('--listen-board', `${boardPx}px`);
      host.style.setProperty('--listen-shelf', `${(shelfPx * 1.14 + boardPx).toFixed(0)}px`);
      host.style.setProperty('--listen-stage-bottom', `${bottom.toFixed(0)}px`);
    }
  }
  // 선반의 자리: d = 왼쪽 끝에서 몇 번째(소수) · raw = 판 번호(감지 않은 것 — 선반은 끝없이 돌지 않음)
  function shelfPose(d, raw, slot, o) {
    const hv = slot.card ? 0.93 + 0.07 * (((hashOf(slot.card.slug || '') >>> 5) % 8) / 7) : 1;   // 판마다 키가 조금씩 다름
    const s = (LS.sh / CARD) * hv;
    o.x = LS.x0 + Math.max(0, LS.count - N()) * LS.pitch / 2 + (d + 0.5) * LS.pitch;   // 판이 적으면 가운데로
    o.y = LS.y0 + (LS.sh * hv) / 2 + LS.sh * 0.07 * (slot.lift || 0);
    o.z = -(CARD * s) / 2;   // 책등 면이 z=0 에 오게 (화면 px 크기 그대로)
    o.rx = 0; o.ry = Math.PI / 2; o.rz = 0; o.s = s; o.t = SPINE.thick; o.c = 1;
    o.o = raw < 0 || raw >= N() ? 0 : (1 - ss(0, 1, -d)) * (1 - ss(LS.x1 - LS.pitch * 0.5, LS.x1 + LS.pitch * 0.5, o.x));
    return o;
  }
  function stagePose(o) {
    o.x = LS.jx; o.y = LS.jy; o.z = 0.05; o.rx = 0; o.ry = 0.05; o.rz = 0; o.s = LS.js / CARD; o.o = 1; o.c = 1; o.t = 1;
    return o;
  }
  function loadStage() {
    if (stage || stageLoading) return;
    stageLoading = true;
    import('./listenStage').then((mod) => mod.createListenStage({ renderer })).then((s) => {
      if (disposed) { s.dispose(); return; }
      stage = s; stage.setAlbum(cards[sel]); run();
    }).catch(() => { stageLoading = false; });
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  /* ---- 루프 ---- */
  const from = {}, to = {}, out = {}, sp = {}, hc = {}, stp = {}, toHide = [];
  let prev = performance.now() / 1000, shownFront = -1, raf = 0;
  function frame() {
    raf = 0;
    const now = performance.now() / 1000, dt = Math.min(0.05, now - prev); prev = now;
    if (anim) {
      const k = clamp01((now - anim.t0) / anim.dur);
      m = anim.from + (anim.to - anim.from) * k;
      if (k >= 1) {
        m = anim.to; anim = null;
        if (mode === 'grid') { showAllArt(); L = 0; swap = null; selK = 1; }
        onSettled?.(mode);
      }
    }
    if (animL) {
      const k = clamp01((now - animL.t0) / animL.dur);
      L = animL.from + (animL.to - animL.from) * k;
      if (k >= 1) { L = animL.to; animL = null; onSettled?.(mode); }
    }
    // 판 바꾸기 (2026-11-27 사용자 요청): ① 판이 재킷 안으로 다 들어가 사라짐 → ② 재킷이 선반 제자리로 → 새 재킷이 선반에서 무대로 → ③ 새 판이 재킷에서 오른쪽으로 나옴
    //  (처음엔 재킷이 오가는 동안 판이 옆으로만 움직이며 라벨이 바뀌었음)
    let swapLift = 0, discHidden = false;
    if (swap) {
      swap.t += dt;
      const T = swap.T;
      if (swap.phase === 0) {
        selK = 1; swapLift = clamp01(swap.t / T[0]);
        if (swap.t >= T[0]) { swap.phase = 1; swap.t = 0; }
      } else if (swap.phase === 1) {
        swapLift = 1; discHidden = true; selK = 1 - easeIO(clamp01(swap.t / T[1]));
        if (swap.t >= T[1]) { sel = swap.to; swap.phase = 2; swap.t = 0; selK = 0; picked = true; shownFront = -1; stage?.setAlbum(cards[sel]); }
      } else if (swap.phase === 2) {
        swapLift = 1; discHidden = true; selK = easeIO(clamp01(swap.t / T[2]));
        if (swap.t >= T[2]) { swap.phase = 3; swap.t = 0; selK = 1; }
      } else {
        selK = 1; swapLift = 1 - clamp01(swap.t / T[3]);
        if (swap.t >= T[3]) swap = null;
      }
    }
    if (mode === 'listen' && LS) target = clampN(0, target, Math.max(0, N() - LS.count));
    if (!drag && !touch && performance.now() - lastInput > 140) target += (Math.round(target) - target) * (1 - Math.exp(-dt / 0.12));
    pos += (target - pos) * (1 - Math.exp(-dt / 0.14));
    if (Math.abs(target - pos) < 0.0005) pos = target;
    const front = L > 0.5 ? sel : wrap(Math.round(pos));
    if (front !== shownFront && N()) { shownFront = front; onFront?.(front, cards[front], picked); picked = false; }
    // 마우스: 부드럽게 따라감 · 맨 앞 판 위에 있는지 (지난 프레임의 자리로 잼)
    const hk = 1 - Math.exp(-dt / 0.18);
    hover.x += ((hover.on ? hover.nx : 0) - hover.x) * hk; hover.y += ((hover.on ? hover.ny : 0) - hover.y) * hk;
    // 스티커: 평소에는 완전히 붙어 있음. 직접 잡고 끌 때만 손가락을 따라 떼어짐 (놓으면 도로 붙거나, 반 넘게 뗐으면 떨어짐)
    for (const s of slots) {
      if (s.fly > 0) {
        // 떨어져 나가는 중: 끝까지 말리며 날아가고, 다 가면 떼어 낸 것으로 기록
        s.fly = Math.min(1, s.fly + dt / 0.6); s.peel += (1.1 - s.peel) * (1 - Math.exp(-dt / 0.1));
        if (s.fly >= 1) { if (s.card) markPeeled(s.card.slug); s.fly = 0; s.peel = PEEL.rest; s.dir.copy(PEEL_DIR); }
      } else if (peel?.slot === s) {
        const f = 1 - Math.exp(-dt / 0.045);
        s.peel += (peel.to - s.peel) * f; s.dir.lerp(peel.dir, f).normalize();
      } else {
        s.peel += (PEEL.rest - s.peel) * (1 - Math.exp(-dt / 0.16));
        if (s.peel < 0.002) s.peel = PEEL.rest;
        s.dir.lerp(PEEL_DIR, 1 - Math.exp(-dt / 0.2)).normalize();
      }
    }

    // 그리드 칸과 짝: cardOff(맨 앞과 짝인 칸)부터 화면 안에 보이는 칸들
    if (m > 0) syncRect();
    const base = Math.floor(pos), frac = pos - base;
    const lim = L > 0 ? SLOTS : VIS;
    let K = 0;
    if (m > 0) {
      for (let k = 0; k < lim - 1 && cardOff + k < N(); k++) {
        const r = cards[cardOff + k].art?.getBoundingClientRect();
        if (!r || r.top > hostRect.top + hostRect.height) break;
        K++;
      }
    }
    const ST = Math.min(0.06, 0.45 / Math.max(1, K - 1)), SPAN = 1 - ST * Math.max(0, K - 1);
    // Listening: 마우스가 가리키는 책등 (조금 솟음)
    if (liveL() && hover.on && !drag && hover.cx != null) { aim(hover.cx, hover.cy); const hit = raycaster.intersectObjects(shelfMeshes(), false)[0]; hoverIdx = hit ? cards.indexOf(slots.find((s) => s.mesh === hit.object)?.card) : -1; }
    else if (!liveL() || !hover.on) hoverIdx = -1;
    const Le = easeIO(L), heroOn = L > 0 && !!cards[sel] && !cards[sel].divider;
    slots.forEach((slot, j) => {
      if (j >= lim) { slot.mesh.visible = false; return; }   // Crate 만 쓸 때는 앞의 VIS 장만
      const raw = base + j - 1, idx = wrap(raw);
      setSlot(slot, idx);
      slot.d = j - 1 - frac;
      cratePose(j - 1 - frac, from);
      // 판이 적으면 같은 판이 뒤에 또 보이지 않게 (끝없이 넘기는 건 그대로)
      if (j - 1 >= N()) from.o *= 1 - ss(N() - 1, N(), j - 1 - frac);
      if (L > 0) {
        slot.lift += ((idx === hoverIdx ? 1 : 0) - slot.lift) * (1 - Math.exp(-dt / 0.09));
        lerpPose(from, shelfPose(slot.d, raw, slot, sp), Le, from);
        // 고른 판은 무대의 재킷(hero)이 대신 그림 → 선반에는 빈자리
        if (heroOn && idx === sel) { from.o = 0; slot.gridK = 0; applyPose(slot, from, false); return; }
      }
      const k = j - 1;
      if (m > 0 && k >= 0 && k < K && cardOff + k === idx && cards[idx]?.art) {
        const e = easeIO(clamp01((m - k * ST) / SPAN));
        rectPose(cards[idx].art.getBoundingClientRect(), to);
        lerpPose(from, to, e, out);
        slot.gridK = e;   // 그리드 카드 자리에 가까운 정도 → 비닐 · 마감이 그만큼 옅어짐 (applyPose)
        out.z += Math.sin(Math.PI * e) * 1.2;
        out.rz += Math.sin(Math.PI * e) * 0.07 * (k % 2 ? 1 : -1);
        if (m < 1) toHide.push(cards[idx].art);
        applyPose(slot, out, e > 0 && e < 1);
      } else {
        slot.gridK = 0;
        from.o *= 1 - ss(0, 0.3, m);
        applyPose(slot, from, false);
      }
    });
    // 무대의 재킷: Crate 자리 ↔ (선반 자리 ↔ 무대) · 그리드로 오갈 때는 제 칸과 무대 사이를 날아감
    if (heroOn) {
      setSlot(hero, sel);
      hero.d = 0; hero.lift = 0;
      const dSel = sel - pos;
      cratePose(dSel, hc);
      lerpPose(shelfPose(dSel, sel, hero, sp), stagePose(stp), selK, sp);
      lerpPose(hc, sp, Le, hc);
      const art = m > 0 ? cards[sel].art : null, r = art?.getBoundingClientRect();
      if (r && r.width > 0 && r.bottom > hostRect.top && r.top < hostRect.top + hostRect.height) {
        const e = easeIO(clamp01(m));
        lerpPose(hc, rectPose(r, to), e, out);
        hero.gridK = e;
        out.z += Math.sin(Math.PI * e) * 1.2;
        if (m < 1) toHide.push(art);
        applyPose(hero, out, e > 0 && e < 1);
      } else {
        hero.gridK = 0;
        hc.o *= 1 - ss(0, 0.3, m);
        applyPose(hero, hc, selK > 0 && selK < 1);
      }
    } else hero.mesh.visible = false;
    renderer.setViewport(0, 0, W, H);
    renderer.clear();
    // 판 + 톤암: 제 장면 · 제 카메라로 먼저 그리고, 그 위에 재킷 · 책등들 (판이 재킷 뒤에서 나옴)
    const sk = Le * (1 - clamp01(m * 1.5));
    if (stage && sk > 0.001 && LS) {
      stage.render(LS.disc, W, H, sk, dt, { playing: playing && !swap, lift: swapLift, hideDisc: discHidden, hover });
      renderer.clearDepth();
      renderer.setViewport(0, 0, W, H);
    }
    renderer.render(scene, camera);
    host.style.setProperty('--crate-l', L.toFixed(3));
    // 3D 판이 그 자리에 그려진 뒤에 그리드 커버를 숨김 (한 프레임도 비지 않게)
    for (const el of toHide) hideArt(el, true);
    toHide.length = 0;
    host.style.setProperty('--crate-m', m.toFixed(3));
    if (mode !== 'grid' || anim || animL) raf = requestAnimationFrame(frame);
    else running = false;
  }
  function run() { if (!running) { running = true; prev = performance.now() / 1000; raf = requestAnimationFrame(frame); } }

  return {
    /** 그리드 → 크레이트. start = 맨 앞이 될 카드 번호 (그 칸부터 화면의 판들이 날아옴) */
    toCrate(list, start, { instant = false } = {}) {
      cards = list; showAllArt();
      cardOff = Math.max(0, Math.min(start, N() - 1));
      pos = target = cardOff; shownFront = -1;
      slots.forEach((s) => { s.card = null; });
      mode = 'crate';
      resize();
      if (instant || reduced) { m = 0; anim = null; onSettled?.('crate'); }
      else anim = { from: 1, to: 0, t0: performance.now() / 1000, dur: CRATE.DUR };
      run();
    },
    /** 크레이트 → 그리드. 부르기 전에 맨 앞 판의 칸이 화면에 보이게 스크롤해 둘 것 */
    toGrid() {
      if (mode === 'grid' || anim || animL) return;
      target = pos = Math.round(pos);
      cardOff = wrap(pos);
      mode = 'grid';
      showAllArt();   // 크레이트로 올 때 숨긴 커버들을 돌려놓음 (덮개가 아직 불투명해서 안 보임). 날아갈 판들은 다음 프레임에 다시 숨김
      resize();
      anim = { from: m, to: 1, t0: performance.now() / 1000, dur: reduced ? 0.01 : CRATE.DUR };
      run();
    },
    /** 크레이트에 있는 동안 판이 더 들어옴 (다음 묶음을 받아 옴). list = 지금까지의 판 + 뒤에 붙은 새 판 (앞쪽 순서는 그대로여야 함)
     *  맨 앞 판은 그대로 두고 뒤에만 이어 붙임. 돌려 넘기던 자리(pos)는 새 장수 기준으로 다시 맞춤 */
    extend(list) {
      if (mode === 'grid' || anim || animL || list.length <= N()) return false;
      const r = Math.round(pos), f = mode === 'listen' ? r : wrap(r);
      cards = list; pos += f - r; target += f - r; shownFront = -1;
      run();
      return true;
    },
    /** 맨 앞 판 열기 (정보 패널의 "Open record" 버튼 — 판을 누른 것과 같음) */
    openFront() { if (liveL() && N()) onOpen?.(sel, rectOf(hero)); else if (live() && N()) onOpen?.(wrap(Math.round(pos)), frontRect()); },
    /** 그리드 → Listening. start = 선반 왼쪽 끝이 될 카드 번호 · slug = 무대에 올릴 판 (없으면 start) */
    toListen(list, start, { instant = false, slug = null } = {}) {
      cards = list; showAllArt(); useSpines = true;
      cardOff = Math.max(0, Math.min(start, N() - 1));
      pos = target = cardOff; shownFront = -1;
      const want = slug ? cards.findIndex((c) => c.slug === slug) : -1;
      sel = want >= 0 ? want : cardOff;
      if (cards[sel]?.divider) sel = Math.min(N() - 1, sel + 1);
      selK = 1; swap = null; L = 1; animL = null;
      slots.forEach((s) => { s.card = null; }); hero.card = null;
      mode = 'listen';
      resize(); loadStage(); stage?.setAlbum(cards[sel]);
      if (instant || reduced) { m = 0; anim = null; onSettled?.('listen'); }
      else anim = { from: 1, to: 0, t0: performance.now() / 1000, dur: CRATE.DUR };
      run();
    },
    /** Crate → Listening: 맨 앞 판이 무대로, 뒤의 판들은 돌아서며 선반에 꽂힘 */
    crateToListen() {
      if (mode !== 'crate' || anim || animL) return false;
      const r = Math.round(pos), f = wrap(r);
      pos += f - r; target = f;
      sel = cards[f]?.divider ? Math.min(N() - 1, f + 1) : f;
      selK = 1; swap = null; useSpines = true; shownFront = -1;
      mode = 'listen';
      loadStage(); stage?.setAlbum(cards[sel]);
      animL = { from: L, to: 1, t0: performance.now() / 1000, dur: reduced ? 0.01 : CRATE.LISTEN_DUR };
      run();
      return true;
    },
    /** Listening → Crate: 무대의 판이 상자 맨 앞으로 */
    listenToCrate() {
      if (mode !== 'listen' || anim || animL) return false;
      target = sel; swap = null; selK = 1; shownFront = -1;
      mode = 'crate';
      animL = { from: L, to: 0, t0: performance.now() / 1000, dur: reduced ? 0.01 : CRATE.LISTEN_DUR };
      run();
      return true;
    },
    /** Listening: 판이 돌고 바늘이 내려가 있음 */
    setPlaying(v) { playing = !!v; if (mode === 'listen') run(); },
    /** Now spinning 카드가 떠 있음 → 선반 오른쪽 끝을 그만큼 비움 */
    setCardSpace(v) { if (cardSpace === !!v) return; cardSpace = !!v; resize(); if (mode !== 'grid') run(); },
    get front() { return L > 0.5 ? sel : wrap(Math.round(pos)); },
    /** 그리드로 돌아갈 때 화면에 보이게 해 둘 칸: Crate = 맨 앞 판 · Listening = 선반 왼쪽 끝 판 */
    get anchor() { return wrap(Math.round(pos)); },
    get busy() { return !!anim || !!animL; },
    setFog(hex) { scene.fog.color.set(hex); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect(); showAllArt();
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      textures.forEach((t) => t.dispose()); spines.forEach((t) => t.dispose()); geo.dispose(); stage?.dispose();
      [...slots, hero].forEach((s) => { s.spine.dispose(); s.edge.dispose(); s.front.dispose(); s.back.dispose(); s.tabEdge.dispose(); s.tabFront.dispose(); s.tabBack.dispose(); s.open.dispose(); s.finish.mesh.material.dispose(); s.sticker.mesh.material.dispose(); });
      fx.dispose(); openTex.dispose();
      renderer.dispose(); canvas.remove();
    },
  };
}
