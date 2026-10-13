import * as THREE from 'three';

/* New Vinyls: 끝없는 앨범 릴
   - 큰 원통의 "안쪽 벽"에 슬리브가 꽂혀 있고, 원통이 돌며 한 장씩 앞으로 옴
   - 맨 앞 슬리브는 정면, 뒤의 판들은 오른쪽으로 감겨 돌아오며 카메라 쪽으로 다가옴
   - 홈 엔진의 3D 판(정사영 카메라)과 깊이가 섞이지 않으므로 두 번에 나눠 그림:
       뒤쪽 슬리브 → 판 → 맨 앞(과 지나간) 슬리브   (판이 맨 앞 슬리브에서 빠져나온 것처럼 보임)
   - 슬리브 자리는 14칸만 만들고 번호(k)만 바꿔 끼워 끝없이 이어지게 함 */

export const REEL_LAYOUT = {
  CW: 3.2,        // 슬리브 한 변
  RC: 9,          // 원통 반지름
  STEP: 0.125,    // 슬리브 사이 각도
  LIFT: 1.15,     // 맨 앞 슬리브가 앞으로 나오는 거리
  ROLL: -0.07,    // 릴 전체 기울기 (감김이 오른쪽 아래로 흐르게)
  SLOTS: 14,
  BEHIND: 2,      // 앞으로 지나간 슬리브 몇 장까지 그릴지
  OUT: 0.42,      // 판이 슬리브에서 오른쪽으로 빠져나온 정도 (슬리브 폭 대비)
  OUT_HOVER: 0.12,
  ABOVE: 0.95,    // 들어가기 전/나온 뒤 판이 떠 있는 높이 (슬리브 폭 대비)
};
const { CW, RC, STEP, LIFT, SLOTS, BEHIND } = REEL_LAYOUT;
const DISC_R = CW * 0.47;

const CREAM = '#f4e7cd', INK = '#4c404a', VINYL = '#1b1619';
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hasKo = (s) => /[가-힣]/.test(s || '');
const lumHex = (h) => { const n = parseInt((h || '#888888').slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

// 슬리브: 커버 + 크림 종이 테두리 + 잉크 선 (Grooves 인쇄물 느낌)
const SLEEVE_PX = 640, SLEEVE_M = 24;
export const COVER_INSET = SLEEVE_M / SLEEVE_PX;    // 테두리 비율 (커버 이동 전환 위치 계산용)
function paintSleeve(g, a, img) {
  const S = SLEEVE_PX, m = SLEEVE_M, w = S - m * 2;
  g.fillStyle = CREAM; g.fillRect(0, 0, S, S);
  if (img) {
    // 정사각이 아니면 가운데를 잘라 채움
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, m, m, w, w);
  } else {
    // 이미지를 불러오기 전/실패: 대표 색 + 제목
    const light = lumHex(a.color) > 0.55;
    g.fillStyle = a.color || '#bbcbda'; g.fillRect(m, m, w, w);
    g.fillStyle = light ? '#2a2228' : CREAM; g.textBaseline = 'top';
    g.font = `900 ${Math.round(w * 0.085)}px ${hasKo(a.title) ? '"Gowun Batang",' : ''}"Grooves Bodoni", Georgia, serif`;
    const words = (a.title || '').toUpperCase().split(' ');
    const lines = []; let line = '';
    for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (g.measureText(t).width > w * 0.84 && line) { lines.push(line); line = wd; } else line = t; }
    lines.push(line);
    lines.slice(0, 3).forEach((l, i) => g.fillText(l, m + w * 0.07, m + w * 0.07 + i * w * 0.1));
    g.font = `500 ${Math.round(w * 0.04)}px "PP Neue Montreal", Arial, sans-serif`;
    g.fillText((a.artist || '').toUpperCase(), m + w * 0.07, m + w * 0.88);
  }
  g.strokeStyle = INK; g.lineWidth = 3; g.strokeRect(m - 1.5, m - 1.5, w + 3, w + 3);
  g.lineWidth = 6; g.strokeRect(3, 3, S - 6, S - 6);
}
// 판의 홈 (흰 선 → 재질 색). 라벨 자리는 비움
function drawGrooves() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), m = 256;
  g.strokeStyle = '#fff';
  g.lineWidth = 3.5; g.beginPath(); g.arc(m, m, 253, 0, Math.PI * 2); g.stroke();
  for (let r = 98, k = 0; r < 247; r += 2.6, k++) {
    g.globalAlpha = 0.3 + ((k * 37) % 11) / 22;
    g.lineWidth = k % 9 === 0 ? 1.6 : 0.8;
    const start = (k * 1.7) % 6.28;
    g.beginPath(); g.arc(m, m, r, start, start + 6.28 - (0.15 + ((k * 13) % 7) * 0.05)); g.stroke();
  }
  g.globalAlpha = 1; g.lineWidth = 2.5; g.beginPath(); g.arc(m, m, 93, 0, Math.PI * 2); g.stroke();
  return c;
}

export function createNvReel({ renderer }) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const texOf = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return t;
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 12);
  const reel = new THREE.Group();
  reel.rotation.set(0, 0, REEL_LAYOUT.ROLL);
  scene.add(reel);
  const reelHome = new THREE.Vector3();
  let narrow = false, viewW = 1, viewH = 1;

  const grooveTex = texOf(drawGrooves());
  const sleeveGeo = new THREE.BoxGeometry(CW, CW, 0.035);
  const peekDiscGeo = new THREE.CircleGeometry(DISC_R, 96);
  const peekLabelGeo = new THREE.CircleGeometry(DISC_R * 0.34, 48);
  const slots = Array.from({ length: SLOTS }, () => {
    const pivot = new THREE.Group(); reel.add(pivot);
    const edge = new THREE.MeshBasicMaterial({ color: CREAM });
    const front = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const back = new THREE.MeshBasicMaterial({ color: '#d9ccb2' });
    const sleeve = new THREE.Mesh(sleeveGeo, [edge, edge, edge, edge, front, back]);
    pivot.add(sleeve);
    // 슬리브 뒤로 위쪽에 살짝 보이는 판 (LP가 꽂힌 느낌). 맨 앞은 홈 엔진의 판이 대신함
    const peek = new THREE.Group(); pivot.add(peek);
    const pVinyl = new THREE.MeshBasicMaterial({ color: VINYL, transparent: true });
    const pLines = new THREE.MeshBasicMaterial({ map: grooveTex, color: CREAM, transparent: true, opacity: 0.35, depthWrite: false });
    const pLabel = new THREE.MeshBasicMaterial({ transparent: true });
    [[peekDiscGeo, pVinyl], [peekDiscGeo, pLines], [peekLabelGeo, pLabel]].forEach(([geo, mat], j) => {
      const mesh = new THREE.Mesh(geo, mat); mesh.position.z = -0.03 + j * 0.002; peek.add(mesh);
    });
    return { pivot, sleeve, peek, mats: [edge, front, back], pmats: [pVinyl, pLines, pLabel], k: null, d: 0 };
  });

  /* ---- 앨범 ---- */
  let list = [];          // [{ slug, title, artist, image, color, arrived }]
  let sleeves = [];       // 앨범마다 { canvas, tex }
  let gen = 0;
  const wrap = (k) => (list.length ? ((k % list.length) + list.length) % list.length : 0);
  function setAlbums(next) {
    gen++;
    sleeves.forEach((s) => s.tex.dispose());
    list = next.slice();
    sleeves = list.map((a) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = SLEEVE_PX;
      const g = canvas.getContext('2d');
      paintSleeve(g, a, null);
      const s = { canvas, tex: texOf(canvas) };
      if (a.image) {
        const img = new Image(), my = gen;
        img.crossOrigin = 'anonymous'; img.decoding = 'async';
        img.onload = () => { if (my !== gen) return; paintSleeve(g, a, img); s.tex.needsUpdate = true; };
        img.src = a.image;
      }
      return s;
    });
    slots.forEach((it) => { it.k = null; });
  }
  function setSlot(it, k) {
    if (it.k === k) return;
    it.k = k;
    const s = sleeves[wrap(k)];
    it.mats[1].map = s?.tex ?? null; it.mats[1].needsUpdate = true;
    it.sleeve.userData.k = k;
  }

  /* ---- 자리 ---- */
  const tmpC = new THREE.Color(), creamC = new THREE.Color(CREAM), backC = new THREE.Color('#d9ccb2'), vinylC = new THREE.Color(VINYL), whiteC = new THREE.Color('#ffffff');
  // d = 맨 앞에서 몇 번째(소수). 0 = 맨 앞, 양수 = 기다리는 판, 음수 = 지나간 판
  function poseSlot(it, d, bg) {
    it.d = d;
    const th = d * STEP, pv = it.pivot;
    const lift = LIFT * (1 - ss(0, 0.85, Math.abs(d)));
    pv.position.set(RC * Math.sin(th), -d * 0.06, RC * (1 - Math.cos(th)) + lift);
    pv.rotation.set(0, -th, 0);
    // 멀어질수록 배경색에 묻힘. 지나간 판은 왼쪽에 한두 장만 남기고 흐려짐
    const fog = d > 0.5 ? Math.min(0.78, (d - 0.5) * 0.11) : d < -0.5 ? Math.min(0.7, (-d - 0.5) * 0.3) : 0;
    const o = d < 0 ? 0.55 * (1 - ss(0.15, 1.3, -d)) + 0.45 * (1 - ss(0, 0.5, -d)) : 1 - ss(SLOTS - BEHIND - 3, SLOTS - BEHIND - 1, d);
    for (const m of it.mats) {
      const tr = o < 1;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = o;
    }
    it.mats[1].color.copy(whiteC).lerp(bg, fog);
    it.mats[0].color.copy(creamC).lerp(bg, fog);
    it.mats[2].color.copy(backC).lerp(bg, fog);
    it.peek.position.set(0, CW * (0.1 + 0.05 * Math.sin(d * 1.7 + 1)), -0.03);
    const po = o * ss(0.45, 0.95, Math.abs(d));
    it.pmats[0].opacity = po; it.pmats[1].opacity = po * 0.35; it.pmats[2].opacity = po;
    it.pmats[0].color.copy(vinylC).lerp(bg, fog);
    it.pmats[2].color.copy(tmpC.set(list[wrap(it.k)]?.color || '#bbcbda')).lerp(bg, fog);
    it.peek.visible = po > 0.01;
    pv.visible = o > 0.01 && list.length > 0;
  }

  // 맨 앞 슬리브 기준 판 자리 (화면 px): 슬리브에서 오른쪽으로 빠져나온 자리 / 위에 떠 있는 자리
  const localIn = new THREE.Vector3(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), pr = new THREE.Vector3();
  function slotScreen(up, f, hover, out) {
    const outX = CW * (REEL_LAYOUT.OUT + REEL_LAYOUT.OUT_HOVER * hover);
    localIn.set(outX, up, -0.05);
    pa.copy(localIn).applyMatrix4(slots[BEHIND].pivot.matrixWorld);
    pb.copy(localIn).applyMatrix4(slots[BEHIND + 1].pivot.matrixWorld);
    pa.lerp(pb, ss(0, 0.4, f));                  // 다음 슬리브로 일찍 옮겨 감 (커버를 가리지 않게)
    const depth = camera.position.z - pa.z;
    const rWorld = DISC_R * reel.scale.x;
    pr.copy(pa).project(camera);
    out.x = (pr.x * 0.5 + 0.5) * viewW;
    out.y = (-pr.y * 0.5 + 0.5) * viewH;
    out.r = (rWorld / (depth * Math.tan((camera.fov * Math.PI) / 360))) * (viewH / 2);
    return out;
  }

  const disc = { inside: { x: 0, y: 0, r: 1 }, above: { x: 0, y: 0, r: 1 } };
  let attachedK = 0, visible = false;
  const bgC = new THREE.Color();
  /**
   * pos: 지금 맨 앞 앨범 번호(소수, 끝없이 누적) · spinIn: 들어오고 나갈 때 더 감기는 칸 수
   * offsetX: 들어오고 나갈 때 오른쪽으로 밀려나는 거리 · hover: 0..1 (판이 조금 더 빠져나옴)
   * bg: 배경색(THREE.Color, 먼 슬리브가 묻히는 색) · show: 릴을 그릴지
   */
  function update({ pos, spinIn, offsetX, hover, bg, show }) {
    bgC.copy(bg);
    const base = Math.floor(pos + spinIn);
    slots.forEach((it, j) => setSlot(it, base + j - BEHIND));
    // 판 자리는 릴이 "제자리에 있을 때" 기준
    reel.position.copy(reelHome);
    slots.forEach((it, j) => poseSlot(it, Math.floor(pos) + j - BEHIND - pos, bgC));
    reel.updateMatrixWorld(true);
    const f = pos - Math.floor(pos);
    slotScreen(0, f, hover, disc.inside);
    slotScreen(CW * REEL_LAYOUT.ABOVE, f, hover, disc.above);
    attachedK = Math.floor(pos) + (ss(0, 0.4, f) > 0.5 ? 1 : 0);
    // 실제로 그리는 자세
    slots.forEach((it, j) => poseSlot(it, base + j - BEHIND - pos - spinIn, bgC));
    reel.position.x = reelHome.x + offsetX;
    reel.updateMatrixWorld(true);
    visible = show && list.length > 0;
  }

  // pass: 'back' = 판 뒤에 있는 슬리브, 'front' = 판 앞(판이 꽂힌 슬리브와 지나간 슬리브)
  const savedVis = new Array(SLOTS);
  function render(pass) {
    slots.forEach((it, j) => {
      savedVis[j] = it.pivot.visible;
      const isFront = it.k <= attachedK;
      if ((pass === 'front') !== isFront) it.pivot.visible = false;
    });
    renderer.render(scene, camera);
    slots.forEach((it, j) => { it.pivot.visible = savedVis[j]; });
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  /** 화면 좌표 → 맞은 슬리브의 번호 k (없으면 null) */
  function pick(clientX, clientY, rect) {
    if (!visible) return null;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(slots.filter((s) => s.pivot.visible).map((s) => s.sleeve), false)[0];
    return hit ? hit.object.userData.k : null;
  }
  /** 맨 앞 슬리브의 커버 부분 화면 위치 (앨범 상세로 가는 커버 이동 전환의 출발점) */
  const corner = new THREE.Vector3();
  function coverRect(k, rect) {
    const it = slots.find((s) => s.k === k) ?? slots[BEHIND];
    const h = (CW / 2) * (1 - 2 * COVER_INSET), z = 0.0175;
    it.sleeve.updateWorldMatrix(true, false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
      corner.set(x, y, z).applyMatrix4(it.sleeve.matrixWorld).project(camera);
      const px = rect.left + (corner.x * 0.5 + 0.5) * rect.width, py = rect.top + (-corner.y * 0.5 + 0.5) * rect.height;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }

  function resize(w, h) {
    viewW = w; viewH = h;
    narrow = w < 760;
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    // 맨 앞 슬리브 자리: 넓은 화면은 가운데에서 살짝 왼쪽, 좁은 화면은 위쪽 가운데
    const v = new THREE.Vector3(narrow ? -0.12 : -0.06, narrow ? 0.24 : 0.04, 0.5).unproject(camera).sub(camera.position).normalize();
    const depth = narrow ? 15.5 : 11.6;
    reelHome.copy(camera.position).addScaledVector(v, depth / -v.z);
    reel.scale.setScalar(narrow ? 0.78 : 1);
  }

  function dispose() {
    gen++;
    sleeves.forEach((s) => s.tex.dispose());
    grooveTex.dispose(); sleeveGeo.dispose(); peekDiscGeo.dispose(); peekLabelGeo.dispose();
    slots.forEach((it) => { it.mats.forEach((m) => m.dispose()); it.pmats.forEach((m) => m.dispose()); });
  }

  return {
    setAlbums, update, render, pick, coverRect, resize, dispose, disc,
    get count() { return list.length; },
    get visible() { return visible; },
    get narrow() { return narrow; },
    album: (k) => list[wrap(k)],
    wrap,
  };
}
