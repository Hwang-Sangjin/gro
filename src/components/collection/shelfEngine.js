import * as THREE from 'three';

/* Collection 의 Shelf 보기 3D 엔진 (ShelfView.jsx 가 씀)
   - 나무 선반에 LP 재킷이 책등을 앞으로 하고 얇게 꽂혀 있음 (재킷은 두께가 있는 3D 상자)
   - 책등 위에 마우스를 두면 그 판이 앞으로 미끄러져 나온 뒤, 책등을 축으로 돌아 앞면을 보여 줌 (천천히 · 스프링)
     옆으로 쓸면 판들이 잇달아 나왔다 들어감. 누르면 그 앨범을 엶
   단위 = 화면 px: 카메라 거리를 맞춰서 z=0 평면(책등이 놓인 면)의 1 = 화면의 1px, 원점 = 캔버스 가운데
   → 위에 얹는 HTML(장르 라벨)과 마우스 좌표를 변환 없이 맞출 수 있음 */

export const SHELF = {
  THICK: [5.5, 5.5, 5.5, 6.5, 8],   // 재킷 두께(px) — 대부분 얇고 가끔 두꺼운 판 (게이트폴드 · 2LP)
  GAP: 1.2,                         // 재킷 사이 틈
  BOARD: 18,                        // 선반 널빤지 두께
  DIST: 5.2,                        // 카메라 거리 (재킷 한 변의 배수). 클수록 원근이 약해짐
  OUT: 1.04,                        // 뽑혀 나오는 거리 (재킷 한 변의 배수) — 다 빠져나와야 옆 판을 뚫지 않고 돌 수 있음
  FACE: 0.07,                       // 다 나왔을 때 남는 기울기(rad) — 완전히 정면이면 납작해 보임
  SPRING: 4.6,                      // 나오고 들어가는 빠르기 (클수록 빠름). 4.6 ≈ 1.3초
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

const WOOD = { top: '#b98d5c', front: '#a47a4b', side: '#8d6740', inner: '#7a5735', back: '#5c4028', under: '#6b4b2d' };
const PAPER = '#efe6d2';

/**
 * host: 캔버스가 들어갈 요소 (폭은 host 를 따르고, 높이는 엔진이 정함)
 * items: [{ divider: slug, name } | { album: { slug, title, artist_names, cover_color, image } }] — 꽂는 순서
 * onActive(album | null): 지금 뽑힌 판 · onLabels([{ slug, name, left, top }]): 장르 라벨 자리 (캔버스 px)
 * onOpen(album, rect): 판을 누름 (rect = 화면 기준 재킷 자리)
 */
export function createShelfEngine({ host, items, onActive, onLabels, onOpen }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;touch-action:pan-y;outline:none';
  host.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 10, 50000);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const flat = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  // 나온 재킷 뒤에 깔리는 부드러운 그림자 (가장자리가 흐린 검은 사각형 한 장을 모든 재킷이 같이 씀)
  const shadowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    g.shadowColor = "rgba(0,0,0,1)"; g.shadowBlur = 22; g.fillStyle = "#000"; g.fillRect(30, 30, 68, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const plane = new THREE.PlaneGeometry(1, 1);

  let disposed = false, W = 1, H = 1, S = 300, D = 1500, raf = 0, prev = 0;
  let slots = [], rows = [], built = [], active = null, hoverBy = 'mouse';
  const pointer = { x: 0, y: 0, on: false, tx: 0, ty: 0 };

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

  /* ---- 짓기: 폭이 바뀌면 다시 ---- */
  const add = (mesh) => { scene.add(mesh); built.push(mesh); return mesh; };
  function board(w, h, d, x, y, z, faces) {
    // faces: [+x, -x, +y, -y, +z, -z] 색
    const m = new THREE.Mesh(box, faces.map(flat));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    return add(m);
  }
  function build() {
    // 재킷은 축(pivot) 안에 들어 있으므로 축째로 뺌
    for (const m of built) { scene.remove(m.parent && m.parent !== scene ? m.parent : m); for (const mat of [m.material].flat()) mat.dispose(); }
    built = []; slots = []; rows = [];
    W = Math.max(1, host.clientWidth);
    const narrow = W < 768, B = SHELF.BOARD;
    S = Math.round(narrow ? Math.min(240, Math.max(180, innerHeight * 0.3)) : Math.min(360, Math.max(220, innerHeight * 0.42)));
    const depth = S * 1.06, inH = S * 1.1, pitchY = inH + B;
    const side = B, pad = narrow ? 10 : 16;
    const x0 = -W / 2 + side + pad, x1 = W / 2 - side - pad;

    // 1) 자리 잡기: 왼쪽부터 꽂고, 줄이 차면 다음 칸으로
    const placed = []; let row = 0, x = x0;
    const labels = [];
    for (const it of items) {
      const t = it.divider ? 5 : SHELF.THICK[hash(it.album.slug) % SHELF.THICK.length];
      const lead = it.divider ? (x > x0 ? 12 : 0) : 0;   // 칸막이 앞은 조금 띄움 (장르 사이)
      if (x + lead + t > x1) { row++; x = x0; }
      else x += lead;
      placed.push({ it, row, x: x + t / 2, t });
      x += t + SHELF.GAP;
    }
    const nRows = row + 1;
    const padTop = Math.round(S * 0.2), padBottom = Math.round(S * 0.16);   // 앞으로 나온 재킷은 원근 때문에 조금 커짐 → 위아래 여유
    H = padTop + B + nRows * pitchY + padBottom;
    renderer.setSize(W, H, false);
    canvas.style.height = `${H}px`;
    D = S * SHELF.DIST;
    camera.aspect = W / H; camera.fov = (2 * Math.atan(H / 2 / D) * 180) / Math.PI;
    camera.position.set(0, 0, D); camera.near = D * 0.2; camera.far = D + depth * 4;
    camera.updateProjectionMatrix();

    // 선반 틀의 폭: 한 줄에 다 들어가면 판이 꽂힌 만큼 + 조금 (빈 선반이 화면 끝까지 이어지지 않게). 나온 재킷은 틀 밖 종이 위로 펼쳐짐
    const contentRight = Math.max(x0, ...placed.map((q) => q.x + q.t / 2));
    const cabW = nRows > 1 ? W : Math.min(W, Math.max(S * 1.5, contentRight + W / 2 + pad + side + S * 0.32));
    const cabX = -W / 2 + cabW / 2;
    // 2) 선반 틀: 위 판 · 칸마다 바닥 판 · 양 옆 판 · 뒤판
    const top = H / 2 - padTop;                       // 틀 맨 위 (y)
    const bottomOf = (r) => top - B - (r + 1) * pitchY + B;   // r 번째 칸의 바닥(재킷이 서는 면) y
    const unitH = B + nRows * pitchY, midY = top - unitH / 2, zc = -depth / 2 + 6;
    board(cabW, B, depth + 12, cabX, top - B / 2, zc, [WOOD.side, WOOD.side, WOOD.top, WOOD.under, WOOD.front, WOOD.back]);
    for (let r = 0; r < nRows; r++) {
      const yb = bottomOf(r);
      rows.push({ yb, slots: [] });
      board(cabW, B, depth + 12, cabX, yb - B / 2, zc, [WOOD.side, WOOD.side, WOOD.top, WOOD.under, WOOD.front, WOOD.back]);
    }
    for (const sx of [-1, 1]) board(side, unitH, depth + 12, cabX + sx * (cabW / 2 - side / 2), midY, zc, [WOOD.inner, WOOD.inner, WOOD.top, WOOD.under, WOOD.front, WOOD.back]);
    board(cabW - 2 * side, unitH - 2 * B, 2, cabX, midY, -depth, [WOOD.back, WOOD.back, WOOD.back, WOOD.back, WOOD.back, WOOD.back]);

    // 3) 재킷 · 칸막이
    for (const p of placed) {
      const yb = rows[p.row].yb;
      if (p.it.divider) {
        const h = S * 1.045, kraft = '#c9a679', edge = '#a9865a';
        const m = board(p.t, h, S * 0.98, p.x, yb + h / 2, -S * 0.49, [kraft, kraft, edge, edge, '#d6b58a', edge]);
        m.userData.divider = true;
        // 라벨: 선반 턱에 붙임. 판이 몇 장 없는 장르가 이어지면 라벨끼리 겹치므로, 겹치면 턱 아래로 한 단씩 내려 닮 (최대 두 단)
        const left = W / 2 + p.x, width = p.it.name.length * 6.4 + 16;
        let level = 0;
        while (level < 2 && labels.some((l) => l.row === p.row && l.level === level && left < l.left + l.width + 6 && l.left < left + width + 6)) level++;
        labels.push({ slug: p.it.divider, name: p.it.name, row: p.row, level, width, left, top: H / 2 - (yb - B / 2) + level * 14 });
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
      const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false });
      const shadow = new THREE.Mesh(plane, shadowMat);
      shadow.scale.set(S * 1.9, S * 1.9, 1); shadow.position.set(S / 2 + S * 0.03, -S * 0.07, -p.t / 2 - 3); shadow.visible = false;
      pivot.add(shadow); built.push(shadow);
      const slot = { album: a, row: p.row, x: p.x, yc: yb + S / 2, t: p.t, pivot, mesh, front, spine, shadow, base: spine.color.clone(), p: 0, v: 0 };
      slots.push(slot); rows[p.row].slots.push(slot);
      pose(slot);
      loadCover(slot);
    }
    // 마지막 판 옆 북엔드
    const last = slots[slots.length - 1];
    if (last && last.x + last.t / 2 + 14 < x1) {
      board(4, S * 0.52, S * 0.46, last.x + last.t / 2 + 4, rows[last.row].yb + S * 0.26, -S * 0.23, ['#3d3439', '#2c2529', '#4a4046', '#2c2529', '#4a4046', '#2c2529']);
    }
    onLabels?.(labels);
    if (active) active = slots.find((s) => s.album.slug === active.album.slug) ?? null;
    run();
  }

  /* ---- 자세: p = 0 꽂혀 있음 → 1 다 나와서 앞면을 보임 ---- */
  // 앞으로 미끄러져 나오고(0~0.6) → 책등을 축으로 돌아 앞면이 보임(0.42~1). 들어갈 때는 거꾸로
  function pose(s) {
    const p = clamp01(s.p), out = ss(0, 0.6, p), turn = ss(0.42, 1, p);
    const z = S * SHELF.OUT * out;
    const mag = D / (D - S * SHELF.OUT);   // 다 나왔을 때 화면에서 커지는 비율
    // 다 나왔을 때 재킷이 캔버스 밖으로 나가지 않게 자리를 조금 옮김 (오른쪽 끝의 판 · 맨 위/아래 칸)
    const fx = Math.min(s.x, (W / 2 - 10) / mag - S), fy = Math.min((H / 2 - 10) / mag - S / 2, Math.max((-H / 2 + 10) / mag + S / 2, s.yc));
    const k = ss(0.7, 1, p);   // 다 나온 뒤에만 마우스를 따라 살짝 기욺
    s.pivot.position.set(lerp(s.x, fx, turn), lerp(s.yc, fy, turn), z);
    s.pivot.rotation.set(-pointer.ty * 0.05 * k, lerp(Math.PI / 2, SHELF.FACE, turn) + pointer.tx * 0.07 * k, 0);
    s.shadow.visible = turn > 0.02; s.shadow.material.opacity = 0.42 * ss(0.3, 1, turn);
  }

  /* ---- 그리기: 움직이는 동안만 ---- */
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - prev) / 1000 || 0.016); prev = now;
    let busy = false, lift = 0;
    const w = SHELF.SPRING;
    for (const s of slots) {
      const to = s === active ? 1 : 0;
      if (reduced) { s.p = to; s.v = 0; }
      else if (s.p !== to || s.v !== 0) {
        s.v += (w * w * (to - s.p) - 2 * w * s.v) * dt;   // 임계 감쇠 스프링: 부드럽게 출발해 넘치지 않고 멈춤
        s.p += s.v * dt;
        if (Math.abs(to - s.p) < 0.0008 && Math.abs(s.v) < 0.004) { s.p = to; s.v = 0; } else busy = true;
      }
      lift = Math.max(lift, s.p);
    }
    // 마우스 기울기 (나온 재킷)
    const gx = pointer.on && active ? pointer.x : 0, gy = pointer.on && active ? pointer.y : 0;
    pointer.tx += (gx - pointer.tx) * (reduced ? 1 : 1 - Math.exp(-dt / 0.18));
    pointer.ty += (gy - pointer.ty) * (reduced ? 1 : 1 - Math.exp(-dt / 0.18));
    if (Math.abs(gx - pointer.tx) > 0.002 || Math.abs(gy - pointer.ty) > 0.002) busy = true;
    for (const s of slots) {
      pose(s);
      // 한 장이 나오면 나머지 책등은 살짝 물러남
      s.spine.color.copy(s.base).multiplyScalar(1 - 0.22 * lift * (1 - clamp01(s.p * 2)));
    }
    renderer.render(scene, camera);
    if (busy && !disposed) raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && !disposed) { prev = performance.now(); raf = requestAnimationFrame(frame); } }

  /* ---- 입력 ---- */
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
  // 캔버스 px → 그 자리의 책등 (z=0 평면이 곧 화면 px). reach: 얇은 책등도 잡히게 좌우로 넉넉히
  function slotAt(cx, cy, reach) {
    const x = cx - W / 2, y = H / 2 - cy;
    const row = rows.find((r) => y >= r.yb - 4 && y <= r.yb + S + 6);
    if (!row) return null;
    let best = null, bd = Infinity;
    for (const s of row.slots) { const d = Math.abs(x - s.x); if (d < bd) { bd = d; best = s; } }
    return best && bd <= Math.max(reach, best.t) ? best : null;
  }
  const inside = (r, cx, cy) => cx >= r.left && cx <= r.left + r.width && cy >= r.top && cy <= r.top + r.height;
  function setActive(s, by) {
    if (by) hoverBy = by;
    if (s === active) return;
    active = s;
    canvas.style.cursor = s ? 'pointer' : '';
    onActive?.(s ? s.album : null);
    run();
  }
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; };
  function pick(e, reach) {
    const [cx, cy] = local(e);
    pointer.x = (cx / W) * 2 - 1; pointer.y = (cy / H) * 2 - 1; pointer.on = true;
    const hit = slotAt(cx, cy, reach);
    if (hit) return hit;
    // 책등이 아닌 곳: 나와 있는 재킷 위면 그대로 둠 (재킷을 누르러 가는 동안 들어가 버리지 않게)
    return active && active.p > 0.5 && inside(rectOf(active), cx, cy) ? active : null;
  }
  const onMove = (e) => {
    if (e.pointerType === 'touch' && !touching) return;
    setActive(pick(e, e.pointerType === 'touch' ? 26 : 7), e.pointerType);
    run();
  };
  let touching = false, down = null;
  const onDown = (e) => {
    if (e.button !== 0) return;
    const [cx, cy] = local(e);
    down = { x: cx, y: cy, was: active };
    if (e.pointerType === 'touch') { touching = true; setActive(pick(e, 26), 'touch'); }
  };
  const onUp = (e) => {
    const d = down; down = null; touching = false;
    if (!d) return;
    const [cx, cy, r] = local(e);
    if (Math.hypot(cx - d.x, cy - d.y) > 10 || !active) return;   // 끌었으면 누르기가 아님
    // 터치: 처음 누르면 뽑기만, 이미 나와 있던 판을 다시 누르면 엶
    if (e.pointerType === 'touch' && d.was !== active) return;
    const q = rectOf(active);
    onOpen?.(active.album, { left: r.left + q.left, top: r.top + q.top, width: q.width, height: q.height });
  };
  const onLeave = (e) => { pointer.on = false; if (e.pointerType !== 'touch') setActive(null); run(); };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = null; touching = false; });
  canvas.addEventListener('pointerleave', onLeave);

  const ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - W) > 1) build(); });
  ro.observe(host);
  build();

  return {
    /** 키보드(목록의 링크에 초점) · 바깥에서 고르기 */
    setActive(slug) { setActive(slug ? slots.find((s) => s.album.slug === slug) ?? null : null, 'key'); },
    /** 지금 나와 있는 재킷의 화면 자리 (앨범 상세로 날아가는 전환의 출발점) */
    rectOf(slug) {
      const s = slots.find((x) => x.album.slug === slug);
      if (!s) return null;
      const r = canvas.getBoundingClientRect(), q = rectOf(s);
      return { left: r.left + q.left, top: r.top + q.top, width: q.width, height: q.height };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect();
      for (const m of built) for (const mat of [m.material].flat()) mat.dispose();
      for (const t of textures.values()) t.dispose();
      box.dispose(); plane.dispose(); shadowTex.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
