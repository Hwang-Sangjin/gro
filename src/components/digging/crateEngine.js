/* Digging "Crate" 3D 보기 — 레코드 상자에서 판을 앞으로 넘겨 보듯, 커버가 곡선을 따라 줄지어 섬.
   - 맨 앞 한 장은 정면으로 크게, 나머지는 오른쪽 위로 휘며 옆으로 돌아 멀어짐(멀수록 배경색 안개)
   - 무한: 위치(pos)를 계속 쌓고 앨범 수로 나눈 나머지로 자리 결정. 카드는 SLOTS장만 재사용
   - 그리드 ↔ 크레이트: 그리드 이미지 자리(화면 사각형)에 3D 카드를 픽셀 단위로 겹친 뒤 날아감
   R3F 대신 Three.js를 직접 씀(Home 엔진과 같은 방식) */
import * as THREE from 'three';

// ───── 조정값 ─────
export const CRATE = {
  slots: 18,            // 동시에 그리는 카드 수
  fov: 32, camZ: 10,
  cardMax: 3.2,         // 맨 앞 카드 한 변(월드 단위) 상한. 화면에 맞춰 줄어듦
  flight: 0.95,         // 그리드 ↔ 크레이트 카드 하나가 날아가는 시간(초)
  stagger: 0.045,       // 카드 사이 출발 간격(초)
  lift: 1.1,            // 날아가는 동안 카메라 쪽으로 들리는 정도
  wheel: 0.0028,        // 휠 감도 (px당 판 수)
  drag: 0.006,          // 드래그 감도
  follow: 0.14,         // 위치가 목표를 따라가는 시간감(초)
  snapAfter: 140,       // 입력이 멈추고 이만큼(ms) 지나면 가장 가까운 판으로 스냅
  tint: 0.16,           // 배경을 맨 앞 앨범 색으로 물들이는 비율
  paper: '#f3e7cd',
};

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'o', 'c'];

export function createCrateEngine({ container, onFront, onBg, onOpen, onNeedMore }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  container.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CRATE.fov, 1, 0.1, 100);
  camera.position.set(0, 0, CRATE.camZ);
  scene.fog = new THREE.Fog(CRATE.paper, CRATE.camZ + 1, CRATE.camZ + 16);

  let W = 1, H = 1, CARD = CRATE.cardMax, narrow = false;
  const visH = 2 * CRATE.camZ * Math.tan((CRATE.fov * Math.PI) / 360);

  // ───── 앨범 · 텍스처 ─────
  let albums = [];
  const textures = new Map();
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  function placeholder(a) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = a.color; g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '900 120px "Grooves Bodoni", Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('G', 128, 136);
    return c;
  }
  function texOf(a) {
    let rec = textures.get(a.key);
    if (rec) return rec;
    const t = new THREE.CanvasTexture(placeholder(a));
    t.colorSpace = THREE.SRGBColorSpace;
    rec = { tex: t, ready: !a.image, promise: Promise.resolve() };
    if (a.image) {
      rec.promise = new Promise((resolve) => {
        loader.load(a.image, (img) => {
          img.colorSpace = THREE.SRGBColorSpace;
          img.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          rec.tex = img; rec.ready = true;
          slots.forEach((s) => { if (s.key === a.key) { s.front.map = img; s.front.needsUpdate = true; } });
          resolve();
        }, undefined, () => { rec.ready = true; resolve(); });
      });
    }
    textures.set(a.key, rec);
    return rec;
  }

  // ───── 카드(슬롯) ─────
  const geo = new THREE.BoxGeometry(1, 1, 0.022);
  const slots = Array.from({ length: CRATE.slots }, () => {
    const edge = new THREE.MeshBasicMaterial({ transparent: true });
    const front = new THREE.MeshBasicMaterial({ transparent: true });
    const back = new THREE.MeshBasicMaterial({ transparent: true, color: 0xd9ccb2 });
    const mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, front, back]);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, edge, front, back, album: -1, key: null, edgeBase: new THREE.Color() };
  });
  function setAlbum(slot, idx) {
    const a = albums[idx];
    if (!a) { slot.album = -1; slot.key = null; return; }
    if (slot.key === a.key) { slot.album = idx; return; }
    slot.album = idx; slot.key = a.key;
    slot.front.map = texOf(a).tex; slot.front.needsUpdate = true;
    slot.edgeBase.set(a.color).multiplyScalar(0.62);
  }

  // ───── 자세 ─────
  // d = 맨 앞에서 몇 번째(소수). 0 = 맨 앞, 음수 = 앞으로 넘겨진 판
  function cratePose(d, o = {}) {
    const u = CARD / CRATE.cardMax;
    const fx = (narrow ? -0.25 : -1.25) * u, fy = (narrow ? 0.35 : 0.1) * u;
    if (d < 0) {                               // 앞으로 젖혀지며 아래로 빠짐
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
    o.s = 1; o.o = 1 - ss(CRATE.slots - 5, CRATE.slots - 2, d); o.c = 1 - Math.min(0.42, 0.05 * d);
    return o;
  }
  // 화면 사각형 → z=0 평면에서 화면에 정확히 같은 크기·위치로 보이는 자세
  function rectPose(r, o = {}) {
    const box = canvas.getBoundingClientRect();
    const wpp = visH / box.height;
    o.x = (r.left + r.width / 2 - (box.left + box.width / 2)) * wpp;
    o.y = -(r.top + r.height / 2 - (box.top + box.height / 2)) * wpp;
    o.z = 0; o.rx = o.ry = o.rz = 0; o.s = (r.width * wpp) / CARD; o.o = 1; o.c = 1;
    return o;
  }
  function applyPose(slot, p) {
    const m = slot.mesh;
    m.position.set(p.x, p.y, p.z);
    m.rotation.set(p.rx, p.ry, p.rz);
    m.scale.setScalar(CARD * p.s);
    slot.front.opacity = slot.back.opacity = slot.edge.opacity = p.o;
    slot.front.color.setScalar(p.c);
    slot.edge.color.copy(slot.edgeBase).multiplyScalar(p.c);
    m.visible = slot.key != null && p.o > 0.003;
  }
  const lerpPose = (a, b, t, o = {}) => { for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

  // ───── 스크롤 상태 ─────
  let pos = 0, target = 0, lastInput = 0, active = false, flight = null, front = -1;
  const wrap = (i) => (albums.length ? ((i % albums.length) + albums.length) % albums.length : 0);
  function layout() {
    const base = Math.floor(pos), frac = pos - base;
    slots.forEach((slot, j) => {
      const d = j - 1 - frac;
      // 앨범이 적으면(슬롯보다 적게) 같은 판이 두 번 보이지 않게 남는 슬롯은 숨김
      if (j - 1 >= albums.length || j - 1 < -1 || (albums.length < 2 && j !== 1)) { slot.mesh.visible = false; return; }
      setAlbum(slot, wrap(base + j - 1));
      applyPose(slot, cratePose(d));
    });
  }

  // ───── 배경 물들이기 ─────
  const PAPER = new THREE.Color(CRATE.paper), bgCur = PAPER.clone(), bgGoal = PAPER.clone();
  let bgHex = '';
  function setFront(i) {
    if (i === front || !albums[i]) return;
    front = i;
    onFront?.(i);
    bgGoal.copy(PAPER).lerp(new THREE.Color(albums[i].color), CRATE.tint);
    if (albums.length - i < 8) onNeedMore?.();
  }

  // ───── 전환 비행 ─────
  // 움직임 줄이기 설정: 화면 구조가 바뀐다는 건 보여 주되, 짧게·한꺼번에·들림/흔들림 없이
  function fly(items, done) {
    if (reduced) items.forEach((it) => { it.delay = 0; });
    flight = { t0: performance.now() / 1000, items, done };
  }
  const tmp = {};
  function stepFlight(now) {
    const t = now - flight.t0;
    let finished = true;
    for (const it of flight.items) {
      const k = Math.min(1, Math.max(0, (t - it.delay) / (reduced ? 0.45 : CRATE.flight)));
      if (k < 1) finished = false;
      const e = easeIO(k);
      lerpPose(it.from, it.to, e, tmp);
      if (!reduced) {
        tmp.z += Math.sin(Math.PI * e) * CRATE.lift * (CARD / CRATE.cardMax);
        tmp.rz += Math.sin(Math.PI * e) * 0.06 * (it.slot.mesh.id % 2 ? 1 : -1);
      }
      applyPose(it.slot, tmp);
    }
    if (finished) { const d = flight.done; flight = null; d(); }
  }
  const waitTextures = (from, n, ms) => Promise.race([
    Promise.all(Array.from({ length: Math.min(n, albums.length) }, (_, k) => texOf(albums[wrap(from + k)]).promise)),
    new Promise((r) => setTimeout(r, ms)),
  ]);

  /** 그리드 → 크레이트. rectOf(앨범 index) = 그 앨범 그리드 이미지의 화면 사각형(안 보이면 null) */
  async function enterFromRects(start, rectOf, onPlaced) {
    resize();
    pos = target = start; front = -1;
    await waitTextures(start, CRATE.slots, 700);
    return new Promise((resolve) => {
      let order = 0;
      const items = [];
      slots.forEach((slot, j) => {
        if (j - 1 >= albums.length || j < 1) { slot.mesh.visible = false; return; }
        const idx = wrap(start + j - 1); setAlbum(slot, idx);
        const to = cratePose(j - 1);
        const r = rectOf(idx);
        const from = r ? rectPose(r) : { ...to, o: 0 };
        applyPose(slot, from);
        items.push({ slot, from, to, delay: 0.12 + (r ? order++ * CRATE.stagger : 0.25 + j * 0.02) });
      });
      // 같은 프레임에 그리드 이미지를 숨기고 3D를 그림 → 눈에는 변화 없음
      onPlaced?.();
      renderer.render(scene, camera);
      active = true;
      setFront(wrap(start));
      fly(items, () => { layout(); resolve(); });
    });
  }
  /** 바로 크레이트로 (장르를 바꿨거나, 크레이트 보기로 들어왔을 때): 판들이 아래에서 차례로 올라와 섬 */
  async function enterDirect(start = 0) {
    resize();
    pos = target = start; front = -1;
    await waitTextures(start, 6, 500);
    return new Promise((resolve) => {
      const items = [];
      slots.forEach((slot, j) => {
        if (j - 1 >= albums.length || j < 1) { slot.mesh.visible = false; return; }
        setAlbum(slot, wrap(start + j - 1));
        const to = cratePose(j - 1);
        const from = { ...to, y: to.y - 2.2 * (CARD / CRATE.cardMax), o: 0 };
        applyPose(slot, from);
        items.push({ slot, from, to, delay: (j - 1) * 0.035 });
      });
      active = true;
      setFront(wrap(start));
      fly(items, () => { layout(); resolve(); });
    });
  }
  /** 크레이트 → 그리드. 먼저 맨 앞 판에 딱 맞춘 뒤, rectOf로 그리드 칸 위치를 받아 날아가 내려앉음 */
  function exitToRects(rectOf) {
    pos = target = Math.round(pos);
    layout();
    const base = Math.round(pos), f = wrap(base);
    return new Promise((resolve) => {
      let order = 0;
      const items = [];
      slots.forEach((slot, j) => {
        if (!slot.mesh.visible || slot.key == null) return;
        const idx = slot.album;
        const from = cratePose(j - 1);
        const r = j >= 1 && idx >= f ? rectOf(idx) : null;
        const to = r ? rectPose(r) : { ...from, o: 0 };
        items.push({ slot, from, to, delay: r ? order++ * CRATE.stagger : 0 });
      });
      bgGoal.copy(PAPER);
      fly(items, () => { active = false; slots.forEach((s) => (s.mesh.visible = false)); resolve(); });
    });
  }

  // ───── 입력 ─────
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const listeners = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); listeners.push(() => el.removeEventListener(ev, fn, opt)); };
  on(canvas, 'wheel', (e) => {
    if (!active || flight) return;
    e.preventDefault();
    target += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * CRATE.wheel;
    lastInput = performance.now();
  }, { passive: false });
  let drag = null;
  on(canvas, 'pointerdown', (e) => {
    if (!active || flight) return;
    drag = { x: e.clientX, y: e.clientY, start: target, moved: false };
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
  });
  on(canvas, 'pointermove', (e) => {
    if (!drag) { canvas.style.cursor = active && hitFront(e) ? 'pointer' : 'grab'; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    target = drag.start - (dx + dy) * CRATE.drag;
    lastInput = performance.now();
  });
  function pick(e) {
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(slots.filter((s) => s.mesh.visible).map((s) => s.mesh))[0];
    return hit ? slots.find((s) => s.mesh === hit.object) : null;
  }
  function hitFront(e) {
    const s = pick(e);
    return s && Math.round(slots.indexOf(s) - 1 - (pos - Math.floor(pos))) === 0;
  }
  const endDrag = (e) => {
    if (!drag) return;
    canvas.style.cursor = 'grab';
    const click = !drag.moved; drag = null;
    if (!click || flight) return;
    const slot = pick(e);
    if (!slot) return;
    const d = Math.round(slots.indexOf(slot) - 1 - (pos - Math.floor(pos)));
    if (d === 0) onOpen?.(slot.album, screenRect(slot));
    else { target = Math.round(target) + d; lastInput = performance.now(); }   // 뒤쪽 판을 누르면 앞으로 넘겨 꺼냄
  };
  on(canvas, 'pointerup', endDrag);
  on(canvas, 'pointercancel', () => { drag = null; });
  function step(n) { if (active && !flight) { target = Math.round(target) + n; lastInput = performance.now(); } }

  // 맨 앞 카드의 화면 사각형 (앨범 상세로 날아가는 전환의 출발점)
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) => new THREE.Vector3(x, y, 0.011));
  function screenRect(slot) {
    const box = canvas.getBoundingClientRect(); const v = new THREE.Vector3();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    slot.mesh.updateMatrixWorld();
    for (const c of corners) {
      v.copy(c).applyMatrix4(slot.mesh.matrixWorld).project(camera);
      const x = box.left + ((v.x + 1) / 2) * box.width, y = box.top + ((1 - v.y) / 2) * box.height;
      l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    return { left: l, top: t, width: r - l, height: b - t };
  }
  function hideFront(hidden) {
    const s = slots.find((x) => x.album === wrap(Math.round(pos)) && x.mesh.visible);
    if (s) s.mesh.visible = !hidden;
  }

  // ───── 크기 · 루프 ─────
  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    narrow = W < 820;
    CARD = Math.min(CRATE.cardMax, visH * camera.aspect * 0.66, visH * 0.6);
  }
  const ro = new ResizeObserver(() => { resize(); if (active && !flight) layout(); });
  ro.observe(container);

  let raf = 0, prev = performance.now() / 1000;
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000, dt = Math.min(0.05, now - prev); prev = now;
    if (flight) stepFlight(now);
    else if (active && albums.length) {
      if (!drag && performance.now() - lastInput > CRATE.snapAfter) target += (Math.round(target) - target) * (1 - Math.exp(-dt / 0.12));
      pos += (target - pos) * (1 - Math.exp(-dt / CRATE.follow));
      layout();
      setFront(wrap(Math.round(pos)));
    }
    bgCur.lerp(bgGoal, 1 - Math.exp(-dt / 0.6));
    const hex = '#' + bgCur.getHexString();
    if (hex !== bgHex) { bgHex = hex; scene.fog.color.copy(bgCur); onBg?.(hex); }
    if (active || flight) renderer.render(scene, camera);
  }
  resize();
  frame();

  return {
    setAlbums(list) {
      const prevKey = albums[wrap(Math.round(pos))]?.key;
      albums = list;
      // 더 불러온 경우(목록 뒤에 붙음): 지금 맨 앞 판 유지
      const keep = prevKey ? albums.findIndex((a) => a.key === prevKey) : -1;
      if (keep >= 0) { const shift = keep - wrap(Math.round(pos)); pos += shift; target += shift; }
      slots.forEach((s) => { s.key = null; });
      front = -1;
      if (active && !flight) layout();
    },
    enterFromRects, enterDirect, exitToRects, step, hideFront,
    frontIndex: () => wrap(Math.round(pos)),
    isActive: () => active,
    resize,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect();
      listeners.forEach((off) => off());
      textures.forEach((r) => r.tex.dispose());
      slots.forEach((s) => { s.front.dispose(); s.back.dispose(); s.edge.dispose(); });
      geo.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
