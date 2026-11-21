import * as THREE from 'three';
import { createSleeveFx, isNewIn, PEEL, STICKER } from '../albums/sleeveFx';

/* Collection 의 Shelf 보기 3D 엔진 (ShelfView.jsx 가 씀) — 화면을 덮는 무대
   - 화면 가운데에 나무 칸막이장(칸마다 LP 가 얇게 꽂힘)과, 그 옆(좁은 화면은 위)에 "지금 꺼낸 판" 자리
   - 휠 · 화살표 키 · 드래그로 한 장씩: 고른 판이 칸에서 앞으로 미끄러져 나와 자리로 가며 앞면을 보여 줌 (천천히 · 스프링)
     책등이 얇아 마우스로 한 장을 짚기 어려워서, 짚는 대신 차례로 꺼내 보는 방식 (2026-11-22 사용자 요청)
   - 판이 많으면 칸이 늘어남 (가로 · 세로로). 전체가 화면에 들어오게 재킷 크기를 맞춤 → 잘리지 않음
   단위 = 화면 px: 카메라 거리를 맞춰서 z=0 평면(책등이 놓인 면)의 1 = 화면의 1px, 원점 = 캔버스 가운데 */

export const SHELF = {
  THICK: 0.02,                      // 재킷 두께 (재킷 한 변 대비). 4.5~9px 로 자름
  THICK_MUL: [1, 1, 1, 1.2, 1.45],  // 대부분 얇고 가끔 두꺼운 판 (게이트폴드 · 2LP)
  GAP: 1.2,                         // 재킷 사이 틈(px)
  DIST: 5.2,                        // 카메라 거리 (재킷 한 변의 배수). 클수록 원근이 약해짐
  OUT: 1.06,                        // 뽑혀 나오는 거리 (재킷 한 변의 배수) — 다 빠져나와야 옆 판을 뚫지 않고 돌 수 있음
  FACE: 0.06,                       // 다 나왔을 때 남는 기울기(rad) — 완전히 정면이면 납작해 보임
  SPRING: 4.6,                      // 나오고 들어가는 빠르기 (클수록 빠름). 4.6 ≈ 1.3초
  MAX: 440,                         // 재킷 한 변의 최대(px)
  WHEEL: { step: 36, cooldown: 240, idle: 180 },   // 휠: 이만큼 쌓이면 한 장 · 넘긴 뒤 쉬는 시간 · 입력이 끊겼다고 보는 간격 (트랙패드 관성으로 여러 장 넘어가지 않게)
  DRAG: 30,                         // 드래그: 이만큼(px) 끌 때마다 한 장
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const clampN = (lo, x, hi) => Math.min(hi, Math.max(lo, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

const WOOD = { top: '#d2a872', front: '#c0915a', side: '#a67b4a', inner: '#9a7044', back: '#4f3520', under: '#86613a' };
const PAPER = '#efe6d2';

/**
 * host: 캔버스가 들어갈 요소 (화면을 덮는 무대)
 * items: [{ divider: slug } | { album: { slug, title, artist_names, cover_color, image } }] — 꽂는 순서
 * onLayout({ spot: { left, top, size }, narrow }): 꺼낸 판 자리 (캔버스 px) — 그 아래에 글을 놓으려고
 * onSelect({ index, total, album, marker: { left, top } }): 고른 판 · 그 판이 꽂혀 있던 자리
 * onOpen(album, rect): 꺼낸 판을 누름 (rect = 화면 기준 재킷 자리)
 * start: 처음에 꺼내 둘 판의 slug (앨범 상세에서 돌아왔을 때 — 없으면 첫 판)
 */
export function createShelfEngine({ host, items, onLayout, onSelect, onOpen, start = null }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;touch-action:none;outline:none';
  host.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 10, 50000);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1);
  const flat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  // 재킷 디테일 (sleeveFx.js): 꺼낸 판 앞면의 광택 · 종이 모서리 + 새로 들어온 판(created_at 이 최근)의 떼어지는 스티커
  const fx = createSleeveFx({ aniso });
  // 꺼낸 재킷 뒤에 깔리는 부드러운 그림자 (가장자리가 흐린 검은 사각형 한 장을 모든 재킷이 같이 씀)
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 22; g.fillStyle = '#000'; g.fillRect(30, 30, 68, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // 나뭇결: 밝은 바탕에 가는 결을 그은 그림 한 장 (색은 재질 색이 곱해짐). 위쪽은 밝게 · 아래쪽은 어둡게 → 널빤지 모서리가 깎인 듯 보임
  const woodTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, 512, 64);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 110; i++) {
      const y = rnd() * 64, amp = rnd() * 1.8, ph = rnd() * 6.283, k = (Math.PI * 2 * (1 + Math.floor(rnd() * 3))) / 512;   // 가로로 이어 붙여도 끊기지 않는 물결
      g.strokeStyle = `rgba(70,40,12,${(0.04 + rnd() * 0.11).toFixed(3)})`; g.lineWidth = 0.5 + rnd() * 1.5;
      g.beginPath();
      for (let x = 0; x <= 512; x += 8) { const yy = y + Math.sin(x * k + ph) * amp; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); }
      g.stroke();
    }
    const bevel = g.createLinearGradient(0, 0, 0, 64);
    bevel.addColorStop(0, 'rgba(255,255,255,0.55)'); bevel.addColorStop(0.16, 'rgba(255,255,255,0)');
    bevel.addColorStop(0.82, 'rgba(0,0,0,0)'); bevel.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = bevel; g.fillRect(0, 0, 512, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return t;
  })();
  // 칸 안의 그늘: 천장 아래 · 왼쪽 벽 옆이 어두운 그림 (뒤판 앞에 한 장 덧댐)
  const shadeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const a = g.createLinearGradient(0, 0, 0, 64); a.addColorStop(0, 'rgba(0,0,0,0.6)'); a.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.fillStyle = a; g.fillRect(0, 0, 64, 64);
    const b = g.createLinearGradient(0, 0, 64, 0); b.addColorStop(0, 'rgba(0,0,0,0.45)'); b.addColorStop(0.3, 'rgba(0,0,0,0)'); b.addColorStop(0.8, 'rgba(0,0,0,0)'); b.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = b; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  // 널빤지용 상자: 뒤쪽 꼭짓점을 어둡게 칠해 둠 → 윗면 · 옆면이 안쪽으로 갈수록 어두워짐 (빛 계산 없이 깊이감)
  const boardGeo = (() => {
    const geo = new THREE.BoxGeometry(1, 1, 1), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) col.fill(pos.getZ(i) > 0 ? 1 : 0.5, i * 3, i * 3 + 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  })();
  let grains = [];   // 널빤지마다 길이에 맞춰 복사한 나뭇결 (다시 지을 때 버림)
  const grain = (len, vertical) => {
    const t = woodTex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (vertical) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
    t.repeat.set(Math.max(1, len / 340), 1); t.needsUpdate = true;
    grains.push(t);
    return t;
  };

  const mag = SHELF.DIST / (SHELF.DIST - SHELF.OUT);   // 다 나온 재킷이 화면에서 커지는 비율 (원근)
  let disposed = false, W = 1, H = 1, S = 300, D = 1500, raf = 0, prev = 0, narrow = false;
  let slots = [], cubes = [], built = [], sel = -1;
  // 보기 전환(useViewSwitch): 커버가 날아오는 · 날아가는 동안 그 판들은 선반에서 숨겨 둠 (held) — 그동안은 첫 판도 꺼내지 않음
  let held = false, later = 0; const hidden = new Set();
  const spot = { x: 0, y: 0 };   // 꺼낸 판의 화면 자리 (가운데, 캔버스 가운데 기준 px · 위가 +)
  const pointer = { x: 0, y: 0, on: false, tx: 0, ty: 0, cx: 0, cy: 0, mouse: false };

  /* ---- 커버 그림: 받기 전에는 대표 색 ---- */
  const textures = new Map();
  const loader = new THREE.ImageLoader();
  loader.setCrossOrigin('anonymous');
  function loadCover(slot) {
    const a = slot.album;
    if (!a.image) return;
    const hit = textures.get(a.slug);
    if (hit) { slot.front.map = hit; slot.front.color.set(0xffffff); slot.front.needsUpdate = true; return; }
    loader.load(a.image, (img) => {
      if (disposed) return;
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true;
      textures.set(a.slug, t);
      for (const s of slots) if (s.album.slug === a.slug) { s.front.map = t; s.front.color.set(0xffffff); s.front.needsUpdate = true; }
      run();
    }, undefined, () => {});
  }

  /* ---- 자리 잡기 ---- */
  // 칸에 차례로 꽂기: 칸이 차면 다음 칸. x = 칸 안쪽 왼쪽 벽부터의 거리
  function placeAt(size, k) {
    const t0 = clampN(4.5, size * SHELF.THICK, 9) * k, inner = size * 1.04, padIn = Math.max(6, size * 0.035);
    const out = []; let cube = 0, x = padIn;
    for (const it of items) {
      const t = it.divider ? Math.max(3.5, t0 * 0.8) : t0 * SHELF.THICK_MUL[hash(it.album.slug) % SHELF.THICK_MUL.length];
      const lead = it.divider && x > padIn ? size * 0.022 * k : 0;   // 칸막이 앞은 조금 띄움 (장르 사이)
      if (x + lead + t > inner - padIn) { cube++; x = padIn; } else x += lead;
      out.push({ it, cube, x: x + t / 2, t });
      x += t + SHELF.GAP * k;
    }
    return { out, n: cube + 1, fill: (x - padIn) / (inner - 2 * padIn) };   // fill: 마지막 칸이 찬 정도
  }
  // 마지막 칸에 몇 장만 넘어가면(3분의 1 미만) 조금씩 좁혀 꽂아 한 칸을 줄임 — 거의 빈 칸 하나 때문에 전체가 작아지지 않게
  function place(size) {
    const base = placeAt(size, 1);
    if (base.n > 1 && base.fill < 0.34) for (const k of [0.94, 0.88, 0.82, 0.76]) { const tight = placeAt(size, k); if (tight.n < base.n) return tight; }
    return base;
  }
  // 칸 수 → 가로 · 세로 칸 수 (가로로 조금 더 넓게)
  const gridOf = (n) => { const cols = narrow ? Math.min(n, 2) : n <= 2 ? n : Math.ceil(Math.sqrt(n * 1.5)); return { cols, rows: Math.ceil(n / cols) }; };

  const add = (mesh) => { scene.add(mesh); built.push(mesh); return mesh; };
  // faces: [+x, -x, +y, -y, +z, -z] 색 · wood: 'h' 가로로 긴 널빤지 / 'v' 세로로 긴 널빤지 (나뭇결 방향) / 없으면 단색
  function board(w, h, d, x, y, z, faces, wood = null) {
    const lit = wood === 'h' ? [2, 3, 4] : wood === 'v' ? [0, 1, 4] : [];   // 나뭇결을 입힐 면
    const map = wood ? grain(wood === 'h' ? w : h, wood === 'v') : null;
    const m = new THREE.Mesh(boardGeo, faces.map((hex, i) => new THREE.MeshBasicMaterial({ color: hex, vertexColors: true, map: lit.includes(i) ? map : null })));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    return add(m);
  }

  function build() {
    // 재킷은 축(pivot) 안에 들어 있으므로 축째로 뺌
    for (const m of built) { scene.remove(m.parent && m.parent !== scene ? m.parent : m); for (const mat of [m.material].flat()) mat.dispose(); }
    for (const t of grains) t.dispose();
    built = []; slots = []; cubes = []; grains = [];
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight); narrow = W < 820;
    renderer.setSize(W, H, false);

    // 1) 무대: 헤더 아래 ~ 아래 안내 줄 위. 그 안에 [칸막이장 + 꺼낸 판 + 글]이 다 들어오는 가장 큰 재킷 크기를 고름
    const head = parseFloat(getComputedStyle(host).getPropertyValue('--ct-header-h')) || (narrow ? 72 : 106);
    const top = head + (narrow ? 50 : 58), bottom = H - (narrow ? 62 : 80), info = narrow ? 126 : 138;
    const availW = W - 2 * clampN(16, W * 0.04, 56), availH = bottom - top;
    const bk = 0.05;   // 널빤지 두께 (재킷 한 변 대비)
    let size = Math.min(SHELF.MAX, availH * 0.5), placed, grid;
    for (let i = 0; i < 3; i++) {
      placed = place(size); grid = gridOf(placed.n);
      const cabWu = grid.cols * (1.04 + bk) + bk, cabHu = grid.rows * (1.1 + bk) + bk;
      const fitW = narrow ? availW / Math.max(cabWu, mag) : availW / (cabWu + 0.24 + mag);
      const fitH = narrow ? (availH - info) / (mag + 0.1 + cabHu) : (availH - info) / Math.max(cabHu, mag);
      const next = Math.floor(Math.max(120, Math.min(SHELF.MAX, fitW, fitH)));
      if (Math.abs(next - size) < 1) break;
      size = next;
    }
    S = size; placed = place(S); grid = gridOf(placed.n);
    const B = clampN(8, S * bk, 22), cubeW = S * 1.04 + B, cubeH = S * 1.1 + B, depth = S * 1.06;
    const cabW = grid.cols * cubeW + B, cabH = grid.rows * cubeH + B, cover = S * mag;

    D = S * SHELF.DIST;
    camera.aspect = W / H; camera.fov = (2 * Math.atan(H / 2 / D) * 180) / Math.PI;
    camera.position.set(0, 0, D); camera.near = D * 0.15; camera.far = D + depth * 4;
    camera.updateProjectionMatrix();

    // 2) 배치: 넓은 화면 = [칸막이장][꺼낸 판] 을 가로로 나란히, 좁은 화면 = 꺼낸 판 위 · 칸막이장 아래. 둘 다 무대 가운데
    let cabX, cabY;   // 칸막이장 가운데
    if (narrow) {
      const total = cover + info + cabH, y0 = H / 2 - (top + (availH - total) / 2);   // 묶음의 위 끝 (y)
      spot.x = 0; spot.y = y0 - cover / 2;
      cabX = 0; cabY = y0 - cover - info - cabH / 2;
    } else {
      const total = cabW + S * 0.24 + cover, left = -total / 2, block = Math.max(cabH, cover);
      const cy = H / 2 - (top + (availH - info - block) / 2 + block / 2);
      cabX = left + cabW / 2; cabY = cy;
      spot.x = left + cabW + S * 0.24 + cover / 2; spot.y = cy;
    }
    onLayout?.({ narrow, spot: { left: W / 2 + spot.x - cover / 2, top: H / 2 - spot.y - cover / 2, size: cover } });

    // 3) 칸막이장: 가로 판(칸 줄마다) · 세로 판(칸마다) · 뒤판
    const cabLeft = cabX - cabW / 2, cabTop = cabY + cabH / 2, zc = -depth / 2 + B * 0.3, dz = depth + B * 0.6;
    // 선반 뒤 그림자: 종이(벽)에 드리운 듯 조금 아래 · 오른쪽으로
    const soft = (w, h, x, y, z, opacity, tex = shadowTex) => {
      const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }));
      m.scale.set(w, h, 1); m.position.set(x, y, z);
      return add(m);
    };
    soft(cabW * 1.92, cabH * 1.92, cabX + S * 0.035, cabY - S * 0.075, -depth - 8, 0.42);
    for (let r = 0; r <= grid.rows; r++) board(cabW, B, dz, cabX, cabTop - B / 2 - r * cubeH, zc, [WOOD.side, WOOD.side, WOOD.top, WOOD.under, WOOD.front, WOOD.back], 'h');
    for (let c = 0; c <= grid.cols; c++) board(B, cabH, dz, cabLeft + B / 2 + c * cubeW, cabY, zc, [WOOD.inner, WOOD.inner, WOOD.top, WOOD.under, WOOD.front, WOOD.back], 'v');
    board(cabW - 2 * B, cabH - 2 * B, 2, cabX, cabY, -depth, Array(6).fill(WOOD.back));
    for (let i = 0; i < grid.cols * grid.rows; i++) {
      const c = i % grid.cols, r = Math.floor(i / grid.cols);
      cubes.push({ left: cabLeft + B + c * cubeW, floor: cabTop - (r + 1) * cubeH, slots: [] });
      // 칸 안의 그늘 (뒤판 바로 앞): 천장 아래와 벽 옆이 어두움
      soft(S * 1.04, S * 1.1, cabLeft + B + c * cubeW + S * 0.52, cabTop - (r + 1) * cubeH + S * 0.55, -depth + 3, 0.9, shadeTex);
    }

    // 4) 재킷 · 칸막이
    const lastInCube = new Map(), firstInCube = new Map();
    for (const p of placed.out) {
      const cube = cubes[p.cube], x = cube.left + p.x, yb = cube.floor;
      lastInCube.set(p.cube, x + p.t / 2);
      if (!firstInCube.has(p.cube)) firstInCube.set(p.cube, x - p.t / 2);
      if (p.it.divider) {
        const h = S * 1.045, kraft = '#c9a679', edge = '#a9865a';
        board(p.t, h, S * 0.98, x, yb + h / 2, -S * 0.49, [kraft, kraft, edge, edge, '#d6b58a', edge]);
        continue;
      }
      const a = p.it.album, c = new THREE.Color(a.cover_color || '#bbcbda');
      const jit = 0.9 + ((hash(a.slug) >>> 8) % 100) / 1000;   // 책등마다 밝기가 조금 달라 한 장씩 구분됨
      const spine = flat(c.clone().multiplyScalar(jit)), edge = flat(c.clone().multiplyScalar(0.72)), back = flat(c.clone().multiplyScalar(0.86));
      const front = flat(c.clone()), open = flat(PAPER);
      // 상자: x = 책등(−x) → 여는 쪽(+x), y = 높이, z = 두께. 앞면 = +z
      const mesh = new THREE.Mesh(box, [open, spine, edge, edge, front, back]);
      mesh.scale.set(S, S, p.t); mesh.position.x = S / 2;
      const pivot = new THREE.Group();   // 축 = 책등
      pivot.add(mesh); scene.add(pivot); built.push(mesh);
      // 그림자: 재킷 바로 뒤 · 조금 아래 (재킷과 같이 돎). 꽂혀 있을 때는 안 보임
      const shadow = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false }));
      shadow.scale.set(S * 1.9, S * 1.9, 1); shadow.position.set(S / 2 + S * 0.03, -S * 0.07, -p.t / 2 - 3); shadow.visible = false;
      pivot.add(shadow); built.push(shadow);
      pivot.visible = !hidden.has(a.slug);
      // 앞면 위의 마감 판 · 스티커: 축(pivot)에 붙임 — 재킷 상자는 두께만 얇게 늘린 것이라 그 자식으로 두면 말림이 납작해짐
      const finish = fx.finish();
      finish.mesh.scale.set(S, S, 1); finish.mesh.position.set(S / 2, 0, p.t / 2 + 0.4); finish.mesh.visible = false;
      pivot.add(finish.mesh); built.push(finish.mesh);
      let sticker = null;
      if (isNewIn(a.created_at)) {
        sticker = fx.sticker();
        sticker.mesh.scale.setScalar(S * STICKER.size); sticker.mesh.position.set(S / 2 + S * STICKER.at, S * STICKER.at, p.t / 2 + 1); sticker.mesh.rotation.z = STICKER.tilt;
        sticker.mesh.visible = false;
        pivot.add(sticker.mesh); built.push(sticker.mesh);
      }
      const slot = { i: slots.length, album: a, cube: p.cube, x, yb, yc: yb + S / 2, t: p.t, pivot, mesh, front, shadow, finish, sticker, peel: PEEL.rest, p: 0, v: 0 };
      slots.push(slot); cube.slots.push(slot);
      loadCover(slot);
    }
    // 판들이 바닥에 드리우는 그림자: 칸 바닥에 눕힌 부드러운 검은 조각 (판이 꽂힌 폭만큼)
    for (const [ci, right] of lastInCube) {
      const cube = cubes[ci], left = firstInCube.get(ci), w = right - left + S * 0.14;
      const m = soft(w * 1.6, depth * 1.7, (left + right) / 2 + S * 0.03, cube.floor + 0.8, -depth * 0.46, 0.5);
      m.rotation.x = -Math.PI / 2;
    }
    // 덜 찬 칸마다 마지막 판 옆에 북엔드
    for (const [ci, right] of lastInCube) {
      const cube = cubes[ci];
      if (right + 14 < cube.left + S * 1.04 - 4) board(4, S * 0.52, S * 0.46, right + 5, cube.floor + S * 0.26, -S * 0.23, ['#3d3439', '#2c2529', '#4a4046', '#2c2529', '#4a4046', '#2c2529']);
    }
    for (const s of slots) { if (s.i === sel) s.p = 1; pose(s); }
    if (sel >= 0) report();
    run();
  }

  /* ---- 자세: p = 0 꽂혀 있음 → 1 자리에 나와 앞면을 보임 ---- */
  // 앞으로 미끄러져 나오고(0~0.42) → 자리로 가며 책등을 축으로 돌아 앞면이 보임(0.38~1). 들어갈 때는 거꾸로
  function pose(s) {
    const p = clamp01(s.p), out = ss(0, 0.42, p), go = ss(0.38, 1, p), turn = ss(0.42, 1, p);
    const k = ss(0.75, 1, p);   // 다 나온 뒤에만 마우스를 따라 살짝 기욺
    // 자리의 화면 좌표 → 그 깊이(z)에서의 좌표: 원근 때문에 mag 로 나눔. 축은 책등이므로 재킷 반 폭만큼 왼쪽
    const fx = spot.x / mag - (S / 2) * Math.cos(SHELF.FACE), fy = spot.y / mag;
    s.pivot.position.set(lerp(s.x, fx, go), lerp(s.yc, fy, go) + Math.sin(go * Math.PI) * S * 0.03, S * SHELF.OUT * out);
    s.pivot.rotation.set(-pointer.ty * 0.05 * k, lerp(Math.PI / 2, SHELF.FACE, turn) + pointer.tx * 0.07 * k, 0);
    s.shadow.visible = turn > 0.02; s.shadow.material.opacity = 0.4 * ss(0.3, 1, turn);
    // 디테일: 앞면이 보일 때만. 광택 띠는 판이 돌아 나오는 동안 쓸고 지나가고, 다 나온 뒤에는 마우스(기울기)를 따라 움직임
    s.finish.mesh.visible = turn > 0.05; s.finish.u.uOpacity.value = ss(0.15, 0.9, turn);
    s.finish.u.uLight.value.set(pointer.tx * 0.7 + (1 - turn) * 1.3, -pointer.ty * 0.4);
    if (s.sticker) { s.sticker.mesh.visible = turn > 0.3; s.sticker.u.uOpacity.value = ss(0.3, 0.8, turn); s.sticker.u.uPeel.value = s.peel; }
  }

  /* ---- 그리기: 움직이는 동안만 ---- */
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    let busy = false;
    const w = SHELF.SPRING;
    for (const s of slots) {
      const to = s.i === sel ? 1 : 0;
      if (reduced) { s.p = to; s.v = 0; }
      else if (s.p !== to || s.v !== 0) {
        s.v += (w * w * (to - s.p) - 2 * w * s.v) * dt;   // 임계 감쇠 스프링: 부드럽게 출발해 넘치지 않고 멈춤
        s.p += s.v * dt;
        if (Math.abs(to - s.p) < 0.0008 && Math.abs(s.v) < 0.004) { s.p = to; s.v = 0; } else busy = true;
      }
    }
    const gx = pointer.on ? pointer.x : 0, gy = pointer.on ? pointer.y : 0, f = reduced ? 1 : 1 - Math.exp(-dt / 0.2);
    pointer.tx += (gx - pointer.tx) * f; pointer.ty += (gy - pointer.ty) * f;
    if (Math.abs(gx - pointer.tx) > 0.002 || Math.abs(gy - pointer.ty) > 0.002) busy = true;
    // 스티커: 꺼낸 판 위에 마우스가 있으면 더 말려 올라감
    const out = slots[sel], over = pointer.on && pointer.mouse && out?.sticker && out.p > 0.6 && inside(rectOf(out), pointer.cx, pointer.cy);
    for (const s of slots) {
      if (!s.sticker) continue;
      const to = s === out && over ? PEEL.hover : PEEL.rest;
      if (reduced || Math.abs(to - s.peel) < 0.001) s.peel = to; else { s.peel += (to - s.peel) * (1 - Math.exp(-dt / 0.16)); busy = true; }
    }
    for (const s of slots) pose(s);
    renderer.render(scene, camera);
    if (busy && !disposed) raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && !disposed) { prev = performance.now(); raf = requestAnimationFrame(frame); } }

  /* ---- 고르기 ---- */
  function report() {
    const s = slots[sel];
    if (!s) { onSelect?.(null); return; }
    // 표시: 그 판이 꽂혀 있던 자리의 바로 위 — 재킷 윗변 (z=0 평면이라 화면 px 그대로). 칸 천장까지 재킷 한 변의 10% 가 비어 있어 그 사이에 들어감
    onSelect?.({ index: sel, total: slots.length, album: s.album, marker: { left: W / 2 + s.x, top: H / 2 - (s.yb + S), room: S * 0.1 } });
  }
  function select(i) {
    const n = clampN(0, Math.round(i), slots.length - 1);
    if (!slots.length || n === sel) return;
    sel = n; report(); run();
  }

  const corner = new THREE.Vector3();
  // 재킷이 지금 화면에서 차지하는 사각형 (캔버스 px)
  function rectOf(s) {
    s.pivot.updateWorldMatrix(true, true);
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      corner.set(x, y, 0.5).applyMatrix4(s.mesh.matrixWorld).project(camera);
      const px = (corner.x * 0.5 + 0.5) * W, py = (-corner.y * 0.5 + 0.5) * H;
      l = Math.min(l, px); r = Math.max(r, px); t = Math.min(t, py); b = Math.max(b, py);
    }
    return { left: l, top: t, width: r - l, height: b - t };
  }
  const inside = (r, cx, cy) => cx >= r.left && cx <= r.left + r.width && cy >= r.top && cy <= r.top + r.height;
  // 캔버스 px → 그 칸에서 가장 가까운 책등
  function slotAt(cx, cy) {
    const x = cx - W / 2, y = H / 2 - cy;
    const cube = cubes.find((c) => c.slots.length && x >= c.left - 4 && x <= c.left + S * 1.04 + 4 && y >= c.floor - 4 && y <= c.floor + S * 1.1);
    if (!cube) return null;
    let best = null, bd = Infinity;
    for (const s of cube.slots) { const d = Math.abs(x - s.x); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
  // 보기 전환용: 판마다 지금 화면에서의 자리 (꽂혀 있으면 책등 — 얇음(thin), 꺼낸 판은 앞면)
  function spots() {
    const out = new Map(), r = canvas.getBoundingClientRect();
    for (const s of slots) {
      const face = s.i === sel && s.p > 0.6;
      const q = face ? rectOf(s) : { left: W / 2 + s.x - s.t / 2, top: H / 2 - (s.yb + S), width: s.t, height: S };
      out.set(s.album.slug, { rect: { left: r.left + q.left, top: r.top + q.top, width: q.width, height: q.height }, thin: !face, image: s.album.image || null, color: s.album.cover_color || '#bbcbda' });
    }
    return out;
  }
  const startIndex = () => Math.max(0, slots.findIndex((s) => s.album.slug === start));
  function hold(slugs) {
    held = true; hidden.clear();
    for (const slug of slugs) hidden.add(slug);
    for (const s of slots) s.pivot.visible = !hidden.has(s.album.slug);
    run();
  }
  function release() {
    held = false; hidden.clear();
    for (const s of slots) s.pivot.visible = true;
    run();
    if (sel < 0) later = setTimeout(() => { if (!disposed && sel < 0) select(startIndex()); }, reduced ? 0 : 140);
  }
  function openSelected() {
    const s = slots[sel];
    if (!s || s.p < 0.6) return;
    const r = canvas.getBoundingClientRect(), q = rectOf(s);
    onOpen?.(s.album, { left: r.left + q.left, top: r.top + q.top, width: q.width, height: q.height });
  }

  /* ---- 입력 ---- */
  const wheel = { acc: 0, last: 0, until: 0 };
  const onWheel = (e) => {
    e.preventDefault();
    const now = performance.now(), Wh = SHELF.WHEEL;
    if (now - wheel.last > Wh.idle) wheel.acc = 0;
    wheel.last = now;
    if (now < wheel.until) return;
    wheel.acc += (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 32 : 1);
    if (Math.abs(wheel.acc) < Wh.step) return;
    select(sel + Math.sign(wheel.acc));
    wheel.acc = 0; wheel.until = now + Wh.cooldown;
  };
  let drag = null;
  const onDown = (e) => {
    if (e.button !== 0) return;
    const [cx, cy] = local(e);
    drag = { id: e.pointerId, x: cx, y: cy, from: sel, moved: false };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const [cx, cy] = local(e);
    pointer.x = (cx / W) * 2 - 1; pointer.y = (cy / H) * 2 - 1; pointer.on = true;
    pointer.cx = cx; pointer.cy = cy; pointer.mouse = e.pointerType === 'mouse';
    const s = slots[sel];
    canvas.style.cursor = drag?.moved ? 'grabbing' : (s && s.p > 0.6 && inside(rectOf(s), cx, cy)) || slotAt(cx, cy) ? 'pointer' : 'grab';
    if (drag && e.pointerId === drag.id) {
      const dx = cx - drag.x, dy = cy - drag.y;
      if (Math.hypot(dx, dy) > 10) drag.moved = true;
      // 왼쪽(또는 위)으로 끌면 다음 판
      if (drag.moved) select(drag.from - Math.trunc((Math.abs(dx) >= Math.abs(dy) ? dx : dy) / SHELF.DRAG));
    }
    run();
  };
  const onUp = (e) => {
    const d = drag; drag = null;
    if (!d || e.pointerId !== d.id || d.moved) return;
    const [cx, cy] = local(e), s = slots[sel];
    if (s && s.p > 0.6 && inside(rectOf(s), cx, cy)) { openSelected(); return; }   // 꺼낸 판을 누르면 열기
    const hit = slotAt(cx, cy);                                                   // 칸의 책등을 누르면 그 판을 꺼냄
    if (hit) select(hit.i);
  };
  const onLeave = () => { pointer.on = false; run(); };
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof Element && e.target.closest('input, textarea, select, button, a, [contenteditable="true"]'))) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) select(sel + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) select(sel - 1);
    else if (e.key === 'Home') select(0);
    else if (e.key === 'End') select(slots.length - 1);
    else if (e.key === 'Enter') openSelected();
    else return;
    e.preventDefault();
  };
  const onCancel = () => { drag = null; };
  host.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);
  window.addEventListener('keydown', onKey);

  const ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - W) > 1 || Math.abs(host.clientHeight - H) > 1) build(); });
  ro.observe(host);
  build();
  // 들어오면 잠깐 뒤 첫 판이 나옴 (선반이 먼저 보이고 → 한 장이 나오는 순서)
  const first = setTimeout(() => { if (!disposed && sel < 0 && !held) select(startIndex()); }, reduced ? 0 : 450);

  return {
    step(d) { select(sel + d); },
    select,
    openSelected,
    rects: spots, hold, release,
    dispose() {
      disposed = true;
      clearTimeout(first); clearTimeout(later); cancelAnimationFrame(raf); ro.disconnect();
      host.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey);
      for (const m of built) for (const mat of [m.material].flat()) mat.dispose();
      for (const t of textures.values()) t.dispose();
      for (const t of grains) t.dispose();
      fx.dispose(); box.dispose(); boardGeo.dispose(); plane.dispose(); shadowTex.dispose(); woodTex.dispose(); shadeTex.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
