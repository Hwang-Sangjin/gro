import * as THREE from 'three';
import { drawDividerFace, drawDividerTab } from './crateDivider';
import { createSleeveFx, PEEL, STICKER } from '../sleeveFx';
import { isPeeled, markPeeled } from '../peeled';

/* Crate 보기 3D 엔진 (Digging · Collection 공용, DOM 그리드 위에 덮는 캔버스)
   - 크레이트: 맨 앞 판은 정면, 뒤의 판들은 오른쪽으로 비스듬히 줄지어 꽂힘. 스크롤·드래그·키로 끝없이 넘어감
   - Grid → Crate / Crate → Grid: 화면의 그리드 칸 ↔︎ 크레이트 자리 사이를 판이 차례로 날아감 (m: 0 = 크레이트, 1 = 그리드)
   카드 목록은 그리드 DOM에서 읽음: [{ slug, color, image, title, artist, art(커버 요소) }] */

export const CRATE = {
  SLOTS: 18,          // 동시에 그리는 판 수 (끝없이 넘길 때 이 수만 재사용)
  DUR: 1.5,           // 전환 시간(초)
  WHEEL: 0.0045,      // 휠 1px 당 넘어가는 판 수
  DRAG: 0.008,        // 드래그 1px 당
};
const { SLOTS } = CRATE;
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
const KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'o', 'c'];
const lerpPose = (a, b, t, o) => { for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

// onPeel(): 스티커를 떼어 냄 (소리용)
export function createCrateEngine({ host, onFront, onOpen, onSettled, onPeel }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
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
  const PEEL_DIR = new THREE.Vector2(Math.cos((PEEL.dir * Math.PI) / 180), Math.sin((PEEL.dir * Math.PI) / 180));   // 평소에 들려 있는 쪽 (오른쪽 위)
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
  const slots = Array.from({ length: SLOTS }, () => {
    const edge = new THREE.MeshBasicMaterial({ transparent: true });
    const front = new THREE.MeshBasicMaterial({ transparent: true });
    const back = new THREE.MeshBasicMaterial({ transparent: true, color: 0xd9ccb2 });
    const open = new THREE.MeshBasicMaterial({ transparent: true, map: openTex });
    const mesh = new THREE.Mesh(geo, [open, edge, edge, edge, front, back]);
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
    return { mesh, edge, front, back, tab, tabFront, tabEdge, tabBack, open, finish, sticker, peel: PEEL.rest, dir, fly: 0, d: 0, card: null, edgeBase: new THREE.Color() };
  });

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
      for (const s of slots) if (s.front.map === t) { s.front.map = nt; s.front.needsUpdate = true; }
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

  let cards = [];
  const N = () => cards.length;
  const wrap = (i) => (N() ? ((i % N()) + N()) % N() : 0);
  function setSlot(slot, idx) {
    const card = cards[idx];
    if (slot.card === card) return;
    // 떼어져 날아가던 스티커는 판이 바뀌면 그대로 떼어진 것으로 · 잡고 있던 것은 놓음
    if (slot.fly > 0 && slot.card) markPeeled(slot.card.slug);
    if (peel?.slot === slot) peel = null;
    slot.card = card; slot.peel = PEEL.rest; slot.fly = 0; slot.dir.copy(PEEL_DIR);
    if (!card) return;
    slot.mesh.material[0] = card.divider ? slot.edge : slot.open;   // 칸막이(판지 한 장)에는 입구가 없음
    fx.wrapFor(slot.finish, hashOf(card.slug || ''));   // 판마다 다른 비닐 주름
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
      o.rx = -k * 1.25; o.ry = 0; o.rz = 0; o.s = 1; o.o = 1 - ss(0, 1, k); o.c = 1;
      return o;
    }
    const near = ss(0, 1, d), far = Math.max(0, d - 1);
    o.x = fx + ((narrow ? 1.6 : 2.05) * near + (narrow ? 0.22 : 0.34) * far) * u;
    o.y = fy + (0.08 * d + 0.012 * far * far) * u;
    o.z = (-0.9 * near - 0.62 * far) * u;
    o.rx = 0; o.ry = -1.12 * near - 0.02 * far; o.rz = 0.025 * far;
    o.s = 1; o.o = 1 - ss(SLOTS - 5, SLOTS - 2, d); o.c = 1 - Math.min(0.42, 0.05 * d);
    return o;
  }
  // 화면 사각형(그리드 칸) → z=0 평면 위 같은 크기·위치 (캔버스 기준)
  let hostRect = { left: 0, top: 0, width: 1, height: 1 };
  function rectPose(r, o) {
    const visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360), wpp = visH / hostRect.height;
    o.x = (r.left + r.width / 2 - (hostRect.left + hostRect.width / 2)) * wpp;
    o.y = -(r.top + r.height / 2 - (hostRect.top + hostRect.height / 2)) * wpp;
    o.z = 0; o.rx = o.ry = o.rz = 0; o.s = (r.width * wpp) / CARD; o.o = 1; o.c = 1;
    return o;
  }
  function applyPose(slot, p, fly) {
    const m = slot.mesh;
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(p.rx, p.ry, p.rz);
    m.scale.set(CARD * p.s, CARD * p.s, CARD * p.s);
    for (const mat of [slot.front, slot.back, slot.edge, slot.open, slot.tabFront, slot.tabEdge, slot.tabBack]) mat.opacity = p.o;
    slot.open.color.setScalar(p.c);
    slot.front.color.setScalar(p.c);
    slot.tabFront.color.setScalar(p.c);
    slot.edge.color.copy(slot.edgeBase).multiplyScalar(p.c);
    m.visible = p.o > 0.003 && !!slot.card;
    slot.tab.visible = !!slot.card?.divider;
    m.renderOrder = Math.round(p.z * 100) + (fly ? 5000 : 0);
    // 디테일: 칸막이(판지)에는 없음. 광택은 맨 앞 판에서 가장 세고, 판이 앞으로 넘어오는 동안 띠가 쓸고 지나감 (+ 마우스를 따라 조금)
    const plain = !!slot.card && !slot.card.divider, near = Math.abs(slot.d);
    const f = slot.finish, st = slot.sticker;
    f.mesh.visible = plain; f.mesh.renderOrder = m.renderOrder + 1;
    f.u.uOpacity.value = p.o; f.u.uGloss.value = 1 - ss(0.3, 1.8, near);
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
  const live = () => mode === 'crate' && !anim;
  const onWheel = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!live()) return;
    const d = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1);
    target += d * CRATE.WHEEL; lastInput = performance.now();
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
    if (!live() || e.button !== 0) return;
    syncRect();
    if (e.target instanceof Element && e.target.closest('button, a')) return;
    // 스티커를 잡았으면 판을 넘기는 대신 스티커를 뗌. 잡은 곳에서 가장 가까운 가장자리가 들림 (가운데를 잡으면 평소 들려 있는 쪽)
    const hit = stickerAt(e.clientX, e.clientY, e.pointerType === 'touch' ? 0.7 : 0.56);
    if (hit) {
      const r = Math.hypot(hit.x, hit.y);
      const G = r > 0.12 ? new THREE.Vector2(hit.x, hit.y).multiplyScalar(0.5 / r) : PEEL_DIR.clone().multiplyScalar(0.5);
      peel = { slot: hit.slot, G, id: e.pointerId, moved: false, x: e.clientX, y: e.clientY, to: PEEL.grab, dir: G.clone().normalize() };
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
    if (drag.moved) { target = drag.start + (drag.touch && Math.abs(dy) > Math.abs(dx) ? dy : dx) * CRATE.DRAG; lastInput = performance.now(); }
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
    if (was.moved || !live()) return;
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
  const onKey = (e) => {
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
  host.addEventListener('touchmove', (e) => { if (mode === 'crate' && e.cancelable) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', onKey);

  // 맨 앞 판의 화면 위치 (앨범 상세로 날아가는 커버 전환의 출발점)
  const corner = new THREE.Vector3();
  // 지금 정면에 선 판 (넘기는 도중이면 반 넘게 들어온 쪽)
  const frontSlot = () => slots[1 + Math.round(pos - Math.floor(pos))];
  function frontRect() {
    syncRect();
    const slot = frontSlot(), h = 0.5;
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
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  /* ---- 루프 ---- */
  const from = {}, to = {}, out = {}, toHide = [];
  let prev = performance.now() / 1000, shownFront = -1, raf = 0;
  function frame() {
    raf = 0;
    const now = performance.now() / 1000, dt = Math.min(0.05, now - prev); prev = now;
    if (anim) {
      const k = clamp01((now - anim.t0) / anim.dur);
      m = anim.from + (anim.to - anim.from) * k;
      if (k >= 1) {
        m = anim.to; anim = null;
        if (mode === 'grid') showAllArt();
        onSettled?.(mode);
      }
    }
    if (!drag && !touch && performance.now() - lastInput > 140) target += (Math.round(target) - target) * (1 - Math.exp(-dt / 0.12));
    pos += (target - pos) * (1 - Math.exp(-dt / 0.14));
    if (Math.abs(target - pos) < 0.0005) pos = target;
    const front = wrap(Math.round(pos));
    if (front !== shownFront && N()) {
      shownFront = front; onFront?.(front, cards[front]);
      // 새 판이 맨 앞에 오면 스티커 가장자리가 한 번 팔랑임 (터치 기기에서도 떼어지는 물건으로 보이게)
      if (!anim) { const fs = frontSlot(); if (fs.fly === 0) fs.peel = Math.max(fs.peel, 0.22); }
    }
    // 마우스: 부드럽게 따라감 · 맨 앞 판 위에 있는지 (지난 프레임의 자리로 잼)
    const hk = 1 - Math.exp(-dt / 0.18);
    hover.x += ((hover.on ? hover.nx : 0) - hover.x) * hk; hover.y += ((hover.on ? hover.ny : 0) - hover.y) * hk;
    // 스티커: 재킷에 올리면 조금, 스티커에 올리면 더 들림 (잡을 수 있다는 표시). 잡고 끌면 손가락을 따라 떼어짐
    let over = null, lift = PEEL.hover;
    if (hover.on && live() && !drag && !peel) {
      const fs = frontSlot();
      ndc.set(hover.nx, hover.ny); raycaster.setFromCamera(ndc, camera);
      if (fs.mesh.visible && raycaster.intersectObject(fs.mesh, false).length) { over = fs; if (stickerAt(hover.cx, hover.cy)) lift = PEEL.grab; }
    }
    for (const s of slots) {
      if (s.fly > 0) {
        // 떨어져 나가는 중: 끝까지 말리며 날아가고, 다 가면 떼어 낸 것으로 기록
        s.fly = Math.min(1, s.fly + dt / 0.6); s.peel += (1.1 - s.peel) * (1 - Math.exp(-dt / 0.1));
        if (s.fly >= 1) { if (s.card) markPeeled(s.card.slug); s.fly = 0; s.peel = PEEL.rest; s.dir.copy(PEEL_DIR); }
      } else if (peel?.slot === s) {
        const f = 1 - Math.exp(-dt / 0.045);
        s.peel += (peel.to - s.peel) * f; s.dir.lerp(peel.dir, f).normalize();
      } else {
        s.peel += ((s === over ? lift : PEEL.rest) - s.peel) * (1 - Math.exp(-dt / 0.16));
        s.dir.lerp(PEEL_DIR, 1 - Math.exp(-dt / 0.2)).normalize();
      }
    }

    // 그리드 칸과 짝: cardOff(맨 앞과 짝인 칸)부터 화면 안에 보이는 칸들
    if (m > 0) syncRect();
    const base = Math.floor(pos), frac = pos - base;
    let K = 0;
    if (m > 0) {
      for (let k = 0; k < SLOTS - 1 && cardOff + k < N(); k++) {
        const r = cards[cardOff + k].art?.getBoundingClientRect();
        if (!r || r.top > hostRect.top + hostRect.height) break;
        K++;
      }
    }
    const ST = Math.min(0.06, 0.45 / Math.max(1, K - 1)), SPAN = 1 - ST * Math.max(0, K - 1);
    slots.forEach((slot, j) => {
      const idx = wrap(base + j - 1);
      setSlot(slot, idx);
      slot.d = j - 1 - frac;
      cratePose(j - 1 - frac, from);
      // 판이 적으면 같은 판이 뒤에 또 보이지 않게 (끝없이 넘기는 건 그대로)
      if (j - 1 >= N()) from.o *= 1 - ss(N() - 1, N(), j - 1 - frac);
      const k = j - 1;
      if (m > 0 && k >= 0 && k < K && cardOff + k === idx && cards[idx]?.art) {
        const e = easeIO(clamp01((m - k * ST) / SPAN));
        rectPose(cards[idx].art.getBoundingClientRect(), to);
        lerpPose(from, to, e, out);
        out.z += Math.sin(Math.PI * e) * 1.2;
        out.rz += Math.sin(Math.PI * e) * 0.07 * (k % 2 ? 1 : -1);
        if (m < 1) toHide.push(cards[idx].art);
        applyPose(slot, out, e > 0 && e < 1);
      } else {
        from.o *= 1 - ss(0, 0.3, m);
        applyPose(slot, from, false);
      }
    });
    renderer.render(scene, camera);
    // 3D 판이 그 자리에 그려진 뒤에 그리드 커버를 숨김 (한 프레임도 비지 않게)
    for (const el of toHide) hideArt(el, true);
    toHide.length = 0;
    host.style.setProperty('--crate-m', m.toFixed(3));
    if (mode === 'crate' || anim) raf = requestAnimationFrame(frame);
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
      if (mode !== 'crate' || anim) return;
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
      if (mode !== 'crate' || anim || list.length <= N()) return false;
      const r = Math.round(pos), f = wrap(r);
      cards = list; pos += f - r; target += f - r; shownFront = -1;
      run();
      return true;
    },
    /** 맨 앞 판 열기 (정보 패널의 "Open record" 버튼 — 판을 누른 것과 같음) */
    openFront() { if (live() && N()) onOpen?.(wrap(Math.round(pos)), frontRect()); },
    get front() { return wrap(Math.round(pos)); },
    get busy() { return !!anim; },
    setFog(hex) { scene.fog.color.set(hex); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect(); showAllArt();
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      textures.forEach((t) => t.dispose()); geo.dispose();
      slots.forEach((s) => { s.edge.dispose(); s.front.dispose(); s.back.dispose(); s.tabEdge.dispose(); s.tabFront.dispose(); s.tabBack.dispose(); s.open.dispose(); s.finish.mesh.material.dispose(); s.sticker.mesh.material.dispose(); });
      fx.dispose(); openTex.dispose();
      renderer.dispose(); canvas.remove();
    },
  };
}
