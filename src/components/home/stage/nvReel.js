import * as THREE from 'three';

/* New Vinyls: 끝없는 앨범 릴
   - 큰 원통의 "안쪽 벽"에 앨범(LP 재킷 상자)이 꽂혀 있고, 원통이 돌며 한 장씩 앞으로 옴
   - 맨 앞 앨범은 정면, 뒤의 앨범들은 오른쪽으로 감겨 돌아오며 카메라 쪽으로 다가옴
   - Hero에서 올 때: 맨 앞 앨범 하나만 화면 아래에서 (반시계 90° 누운 채) 올라와 판을 받고 돌아섬,
     그 뒤 나머지 앨범이 가까운 순서대로 나타남 (front / clock)
   - 홈 엔진의 3D 판(정사영 카메라)과 깊이가 섞이지 않으므로 두 번에 나눠 그림:
       뒤쪽 앨범 → 판 → 맨 앞(과 지나간) 앨범   (판이 맨 앞 앨범 안에 든 것처럼 보임)
   - 앨범 자리는 14칸만 만들고 번호(k)만 바꿔 끼워 끝없이 이어지게 함 */

export const REEL_LAYOUT = {
  CW: 3.2,        // 슬리브 한 변
  DEPTH: 0.3,     // 앨범(상자) 두께
  TILT_X: 0.1,    // 앨범을 살짝 뒤로 젖혀 윗면이 보이게
  TILT_Y: 0.14,   // 살짝 돌려 오른쪽 옆면이 보이게
  THIN: 0.4,      // 멀리 있는 앨범일수록 두께를 줄이는 정도
  RC: 9,          // 원통 반지름
  STEP: 0.125,    // 슬리브 사이 각도
  LIFT: 1.15,     // 맨 앞 슬리브가 앞으로 나오는 거리
  GAP: 0.8,       // 뒤의 앨범일수록 이만큼씩(앞에서 멀수록 조금 더) 뒤로 물러남 → 두께·기울기까지 계산해 이웃 앨범끼리 뚫고 지나가지 않게
  FOG: 0.13,      // 한 칸 멀어질 때마다 배경색에 묻히는 정도 (최대 FOG_MAX)
  FOG_MAX: 0.86,
  BLUR: 0.75,     // 한 칸 멀어질 때마다 커버가 흐려지는 정도 (밉맵 단계, 최대 BLUR_MAX)
  BLUR_MAX: 4,
  ROLL: -0.07,    // 릴 전체 기울기 (감김이 오른쪽 아래로 흐르게)
  SLOTS: 14,
  BEHIND: 2,      // 앞으로 지나간 슬리브 몇 장까지 그릴지
  OUT_HOVER: 0.3, // 맨 앞 앨범에 마우스를 올리면 이만큼 빠져나옴
  OUT_EXIT: 1.08, // 판이 슬리브에서 완전히 빠져나온 자리 (들어가기 전 / Genre로 떠날 때)
  RISE: 9,        // 맨 앞 앨범이 화면 아래에서 올라오는 거리
  LOW: 0.9,       // 판을 받는 동안 맨 앞 앨범이 제자리보다 내려와 있는 거리 (슬리브 폭 대비) → 위에서 기다리는 판이 화면에 다 보이게
};
const { CW, DEPTH, RC, STEP, LIFT, SLOTS, BEHIND } = REEL_LAYOUT;
const DISC_R = CW * 0.47;

const CREAM = '#f4e7cd';
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hasKo = (s) => /[가-힣]/.test(s || '');
const lumHex = (h) => { const n = parseInt((h || '#888888').slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

// 슬리브 앞면 = 앨범 커버 이미지 그대로 (테두리 없음). 옆면·뒷면은 대표 색 (setSlot)
const SLEEVE_PX = 640;
export const COVER_INSET = 0;    // 커버가 앞면 전체 (커버 이동 전환 위치 계산용)
function paintSleeve(g, a, img) {
  const S = SLEEVE_PX;
  if (img) {
    // 정사각이 아니면 가운데를 잘라 채움
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
    return;
  }
  // 이미지를 불러오기 전/실패: 대표 색 + 제목
  const light = lumHex(a.color) > 0.55;
  g.fillStyle = a.color || '#bbcbda'; g.fillRect(0, 0, S, S);
  g.fillStyle = light ? '#2a2228' : CREAM; g.textBaseline = 'top';
  g.font = `900 ${Math.round(S * 0.08)}px ${hasKo(a.title) ? '"Gowun Batang",' : ''}"Grooves Bodoni", Georgia, serif`;
  const words = (a.title || '').toUpperCase().split(' ');
  const lines = []; let line = '';
  for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (g.measureText(t).width > S * 0.84 && line) { lines.push(line); line = wd; } else line = t; }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, S * 0.07, S * 0.07 + i * S * 0.095));
  g.font = `500 ${Math.round(S * 0.038)}px "PP Neue Montreal", Arial, sans-serif`;
  g.fillText((a.artist || '').toUpperCase(), S * 0.07, S * 0.88);
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
  camera.updateMatrixWorld();   // 장면에 넣지 않은 카메라라 직접 갱신 (그리기 전에도 project/unproject가 맞게)
  const reel = new THREE.Group();
  reel.rotation.set(0, 0, REEL_LAYOUT.ROLL);
  scene.add(reel);
  const reelHome = new THREE.Vector3();
  let narrow = false, viewW = 1, viewH = 1;

  const sleeveGeo = new THREE.BoxGeometry(CW, CW, DEPTH);
  const TILT_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(REEL_LAYOUT.TILT_X, -REEL_LAYOUT.TILT_Y, 0));
  const faceQ = new THREE.Quaternion();
  const slots = Array.from({ length: SLOTS }, () => {
    const pivot = new THREE.Group(); reel.add(pivot);
    // 상자 면: 앞 = 커버 이미지, 윗면 = 대표 색(밝게), 오른쪽 옆면 = 대표 색(어둡게), 나머지 = 대표 색
    const edge = new THREE.MeshBasicMaterial();
    const top = new THREE.MeshBasicMaterial();
    const right = new THREE.MeshBasicMaterial();
    const front = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const back = new THREE.MeshBasicMaterial();
    // 멀리 있는 커버는 흐리게: 텍스처를 밉맵 bias로 뭉개서 읽음 (uBlur)
    const blur = { value: 0 };
    front.onBeforeCompile = (shader) => {
      shader.uniforms.uBlur = blur;
      shader.fragmentShader = 'uniform float uBlur;\n' + shader.fragmentShader.replace('texture2D( map, vMapUv )', 'texture2D( map, vMapUv, uBlur )');
    };
    const sleeve = new THREE.Mesh(sleeveGeo, [right, edge, top, edge, front, back]);   // +x, -x, +y, -y, +z, -z
    // pivot(릴 자리) → tilt(윗면·옆면이 보이게 살짝 젖힘, 항상 같은 방향) → turn(맨 앞 앨범이 판을 받을 때 눕는 회전) → 앨범
    // 젖힘을 회전보다 바깥에 둬서, 앨범이 누워 있어도 화면에서 보는 기울기가 그대로 (비틀려 보이지 않게)
    const tilt = new THREE.Group(); tilt.quaternion.copy(TILT_Q); pivot.add(tilt);
    const turn = new THREE.Group(); tilt.add(turn);
    turn.add(sleeve);
    return { pivot, tilt, turn, sleeve, blur, mats: [edge, front, back, top, right], edgeC: new THREE.Color(), backC: new THREE.Color(), topC: new THREE.Color(), rightC: new THREE.Color(), labelC: new THREE.Color(), k: null, d: 0 };
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
    const col = list[wrap(k)]?.color;
    it.labelC.set(/^#[0-9a-f]{6}/i.test(col || '') ? col : '#bbcbda');
    it.backC.copy(it.labelC).multiplyScalar(0.82);
    it.edgeC.copy(it.labelC).multiplyScalar(0.6);
    it.topC.copy(it.labelC).lerp(whiteC, 0.18);          // 윗면: 빛을 받아 밝게
    it.rightC.copy(it.labelC).multiplyScalar(0.48);      // 오른쪽 옆면: 그늘
    it.sleeve.userData.k = k;
  }

  /* ---- 자리 ---- */
  const whiteC = new THREE.Color('#ffffff');
  // d = 맨 앞에서 몇 번째(소수). 0 = 맨 앞, 양수 = 기다리는 판, 음수 = 지나간 판. alpha = 등장/퇴장 정도
  function poseSlot(it, d, bg, alpha = 1) {
    it.d = d;
    const th = d * STEP, pv = it.pivot;
    const lift = LIFT * (1 - ss(0, 0.85, Math.abs(d)));
    const back = REEL_LAYOUT.GAP * Math.pow(Math.max(0, Math.abs(d) - 0.5), 1.1);
    pv.position.set(RC * Math.sin(th), -d * 0.06, RC * (1 - Math.cos(th)) + lift - back);
    pv.rotation.set(0, -th, 0);
    // 멀리(옆으로 많이 돈) 앨범일수록 두께가 화면에서 크게 보이니 얇게 → 옆면이 과하게 두꺼워 보이지 않게
    it.sleeve.scale.z = 1 / (1 + REEL_LAYOUT.THIN * Math.max(0, Math.abs(d) - 0.5));
    // 멀어질수록 배경색에 묻힘. 지나간 판은 왼쪽에 한두 장만 남기고 흐려짐
    const far = Math.max(0, Math.abs(d) - 0.5);
    const fog = Math.min(REEL_LAYOUT.FOG_MAX, far * (d > 0 ? REEL_LAYOUT.FOG : 0.3));
    it.blur.value = Math.min(REEL_LAYOUT.BLUR_MAX, far * REEL_LAYOUT.BLUR);   // 멀수록 흐릿하게 (원근감)
    const o = alpha * (d < 0 ? 0.55 * (1 - ss(0.15, 1.3, -d)) + 0.45 * (1 - ss(0, 0.5, -d)) : 1 - ss(SLOTS - BEHIND - 3, SLOTS - BEHIND - 1, d));
    for (const m of it.mats) {
      const tr = o < 1;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = o;
      m.depthWrite = o > 0.5;
    }
    it.mats[1].color.copy(whiteC).lerp(bg, fog);
    it.mats[0].color.copy(it.edgeC).lerp(bg, fog);
    it.mats[2].color.copy(it.backC).lerp(bg, fog);
    it.mats[3].color.copy(it.topC).lerp(bg, fog);
    it.mats[4].color.copy(it.rightC).lerp(bg, fog);
    pv.visible = o > 0.01 && list.length > 0;
  }

  // 판 자리 계산용: 맨 앞 슬리브(와 다음 슬리브)의 '제자리' 행렬 (등장 애니메이션과 무관)
  const homeA = new THREE.Matrix4(), homeB = new THREE.Matrix4();
  let homeF = 0;
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pr = new THREE.Vector3();
  /** 맨 앞 슬리브 기준 로컬 좌표(슬리브 폭 단위, +x = 열린 쪽) → 화면 px 중심·판 반지름 */
  function discScreen(lx, ly, out) {
    pa.set(lx * CW, ly * CW, 0).applyMatrix4(homeA);
    pb.set(lx * CW, ly * CW, 0).applyMatrix4(homeB);
    pa.lerp(pb, ss(0, 0.4, homeF));                  // 다음 슬리브로 일찍 옮겨 감 (커버를 가리지 않게)
    const depth = camera.position.z - pa.z;
    const rWorld = DISC_R * reel.scale.x;
    pr.copy(pa).project(camera);
    out.x = (pr.x * 0.5 + 0.5) * viewW;
    out.y = (-pr.y * 0.5 + 0.5) * viewH;
    out.r = (rWorld / (depth * Math.tan((camera.fov * Math.PI) / 360))) * (viewH / 2);
    return out;
  }

  let attachedK = 0, visible = false;
  const bgC = new THREE.Color();
  const REVEAL = { stagger: 0.12, each: 0.55, slide: 1.6 };   // 나머지 앨범이 차례로 나타나는 간격·시간(초)·밀려 오는 거리
  /**
   * pos: 지금 맨 앞 앨범 번호(소수, 끝없이 누적)
   * clock: 나머지 앨범이 나타난 시간(초, 줄어들면 거꾸로 사라짐)
   * front: 맨 앞 앨범 { rise: 0 = 화면 아래, 1 = 올라옴 · low: 제자리보다 내려와 있는 정도(슬리브 폭 단위)
   *         · flat: 1 = 카메라를 정면으로 봄(커버만 보임), 0 = 다른 앨범처럼 살짝 젖힘
   *         · turn: 1 = 반시계 90°(열린 쪽이 위) · alpha }
   * hover는 판 쪽에서 처리 · bg: 배경색(먼 슬리브가 묻히는 색) · show: 릴을 그릴지
   */
  function update({ pos, clock, front, bg, show }) {
    bgC.copy(bg);
    const base = Math.floor(pos), fk = Math.round(pos);
    slots.forEach((it, j) => setSlot(it, base + j - BEHIND));
    reel.position.copy(reelHome);
    slots.forEach((it, j) => poseSlot(it, base + j - BEHIND - pos, bgC));
    reel.updateMatrixWorld(true);
    homeA.copy(slots[BEHIND].pivot.matrixWorld); homeB.copy(slots[BEHIND + 1].pivot.matrixWorld);
    homeF = pos - base;
    attachedK = base + (ss(0, 0.4, homeF) > 0.5 ? 1 : 0);
    // 실제로 그리는 자세: 맨 앞은 아래에서 올라와 돌아서고, 나머지는 가까운 순서대로 오른쪽 안쪽에서 밀려 들어옴
    slots.forEach((it, j) => {
      const k = base + j - BEHIND, d = k - pos;
      if (k === fk) {
        poseSlot(it, d, bgC, front.alpha);
        it.pivot.position.y -= (1 - front.rise) * REEL_LAYOUT.RISE + front.low * CW;
        it.turn.rotation.z = front.turn * Math.PI / 2;
        // 판을 받는 동안(flat)은 앨범이 카메라를 정면으로 봄 → 커버만 보이고 윗면·옆면은 안 보임
        if (front.flat > 0.001) {
          it.pivot.updateMatrixWorld();
          it.tilt.lookAt(camera.position);
          if (front.flat < 0.999) faceQ.copy(it.tilt.quaternion), it.tilt.quaternion.copy(TILT_Q).slerp(faceQ, front.flat);
        } else it.tilt.quaternion.copy(TILT_Q);
        return;
      }
      it.turn.rotation.z = 0;
      it.tilt.quaternion.copy(TILT_Q);
      const rank = d > 0 ? d : -d * 1.5;
      const e = ss(0, 1, (clock - (rank - 1) * REVEAL.stagger) / REVEAL.each);
      poseSlot(it, d, bgC, e);
      it.pivot.position.x += (1 - e) * REVEAL.slide;
      it.pivot.position.z -= (1 - e) * REVEAL.slide * 0.6;
    });
    reel.updateMatrixWorld(true);
    visible = show && list.length > 0;
  }
  const revealTotal = () => REVEAL.stagger * (SLOTS - BEHIND - 2) + REVEAL.each;

  // pass: 'back' = 판 뒤에 있는 슬리브, 'front' = 판 앞(판이 꽂힌 슬리브와 지나간 슬리브)
  const savedVis = new Array(SLOTS);
  function render(pass) {
    slots.forEach((it, j) => {
      savedVis[j] = it.pivot.visible;
      const isFront = it.k <= attachedK && it.d < 1.5;   // 멀리 감겨 들어간 슬리브는 판 뒤로
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
    const h = (CW / 2) * (1 - 2 * COVER_INSET), z = DEPTH / 2;
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
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    // 맨 앞 슬리브 자리: 넓은 화면은 가운데에서 살짝 왼쪽, 좁은 화면은 위쪽 가운데
    const v = new THREE.Vector3(narrow ? -0.12 : -0.06, narrow ? 0.24 : 0.04, 0.5).unproject(camera).sub(camera.position).normalize();
    const depth = narrow ? 15.5 : 11.6;
    reelHome.copy(camera.position).addScaledVector(v, depth / -v.z);
    reel.scale.setScalar(narrow ? 0.78 : 1);
  }

  function dispose() {
    gen++;
    sleeves.forEach((s) => s.tex.dispose());
    sleeveGeo.dispose();
    slots.forEach((it) => { it.mats.forEach((m) => m.dispose()); });
  }

  return {
    setAlbums, update, render, pick, coverRect, resize, dispose, discScreen, revealTotal,
    get count() { return list.length; },
    get visible() { return visible; },
    get narrow() { return narrow; },
    album: (k) => list[wrap(k)],
    wrap,
  };
}
