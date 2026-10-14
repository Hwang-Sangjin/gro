import * as THREE from 'three';

/* Crate 보기 3D 엔진 (Digging · Collection 공용, DOM 그리드 위에 덮는 캔버스)
   - 크레이트: 맨 앞 판은 정면, 뒤의 판들은 오른쪽으로 비스듬히 줄지어 꽂힘. 스크롤·드래그·키로 끝없이 넘어감
   - Grid → Crate / Crate → Grid: 화면의 그리드 칸 ↔ 크레이트 자리 사이를 판이 차례로 날아감 (m: 0 = 크레이트, 1 = 그리드)
   카드 목록은 그리드 DOM에서 읽음: [{ slug, color, image, title, artist, art(커버 요소) }] */

export const CRATE = {
  SLOTS: 18,          // 동시에 그리는 판 수 (끝없이 넘길 때 이 수만 재사용)
  DUR: 1.5,           // 전환 시간(초)
  WHEEL: 0.0045,      // 휠 1px 당 넘어가는 판 수
  DRAG: 0.008,        // 드래그 1px 당
};
const { SLOTS } = CRATE;
const FOV = 32, CAM_Z = 10;

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 's', 'o', 'c'];
const lerpPose = (a, b, t, o) => { for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

export function createCrateEngine({ host, onFront, onOpen, onSettled }) {
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

  let CARD = 3.2, W = 1, H = 1, narrow = false;
  const geo = new THREE.BoxGeometry(1, 1, 0.022);
  const slots = Array.from({ length: SLOTS }, () => {
    const edge = new THREE.MeshBasicMaterial({ transparent: true });
    const front = new THREE.MeshBasicMaterial({ transparent: true });
    const back = new THREE.MeshBasicMaterial({ transparent: true, color: 0xd9ccb2 });
    const mesh = new THREE.Mesh(geo, [edge, edge, edge, edge, front, back]);
    scene.add(mesh);
    return { mesh, edge, front, back, card: null, edgeBase: new THREE.Color() };
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

  let cards = [];
  const N = () => cards.length;
  const wrap = (i) => (N() ? ((i % N()) + N()) % N() : 0);
  function setSlot(slot, idx) {
    const card = cards[idx];
    if (slot.card === card) return;
    slot.card = card;
    if (!card) return;
    slot.front.map = texOf(card); slot.front.needsUpdate = true;
    slot.edgeBase.set(card.color || '#bbcbda').multiplyScalar(0.62);
  }

  /* ---- 자세 ---- */
  // d = 맨 앞에서 몇 번째(소수). 0 = 맨 앞, 음수 = 앞으로 넘긴 판
  function cratePose(d, o) {
    const u = CARD / 3.2;
    const fx = (narrow ? -0.25 : -1.25) * u, fy = (narrow ? 0.25 : 0.0) * u;
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
    for (const mat of [slot.front, slot.back, slot.edge]) mat.opacity = p.o;
    slot.front.color.setScalar(p.c);
    slot.edge.color.copy(slot.edgeBase).multiplyScalar(p.c);
    m.visible = p.o > 0.003 && !!slot.card;
    m.renderOrder = Math.round(p.z * 100) + (fly ? 5000 : 0);
  }

  /* ---- 상태 ---- */
  let mode = 'grid', m = 1, anim = null, cardOff = 0, running = false;
  let pos = 0, target = 0, lastInput = 0, drag = null, touch = null;
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
  const onDown = (e) => {
    if (!live() || e.button !== 0) return;
    syncRect();
    if (e.target instanceof Element && e.target.closest('button, a')) return;
    drag = { x: e.clientX, y: e.clientY, start: target, moved: false, id: e.pointerId, touch: e.pointerType === 'touch' };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = drag.x - e.clientX, dy = drag.y - e.clientY;
    if (Math.hypot(dx, dy) > 10) drag.moved = true;   // 클릭하며 손이 조금 움직여도 클릭으로
    if (drag.moved) { target = drag.start + (drag.touch && Math.abs(dy) > Math.abs(dx) ? dy : dx) * CRATE.DRAG; lastInput = performance.now(); }
  };
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const onUp = (e) => {
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
  host.addEventListener('pointercancel', () => { drag = null; });
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
    const visH = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360);
    CARD = Math.min(3.2, visH * camera.aspect * 0.62, visH * 0.52);
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
    if (front !== shownFront && N()) { shownFront = front; onFront?.(front, cards[front]); }

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
      slots.forEach((s) => { s.edge.dispose(); s.front.dispose(); s.back.dispose(); });
      renderer.dispose(); canvas.remove();
    },
  };
}
