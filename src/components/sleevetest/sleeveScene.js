// LP 재킷 줄 + 판을 실제처럼 그리는 장면 (새 Home Hero 1 · 2단계, /lab/sleeve-test)
//  2단계: 재킷 여러 장이 한 줄로 (가운데 크게, 양옆은 작게 물러남) · 좌우로 끌어 넘기고 놓으면 스프링으로 가운데에 붙음
//         넘기는 속도만큼 재킷이 기울고 살짝 가라앉음 · 옆 재킷을 누르면 그리로, 가운데 재킷을 누르면 판이 나옴
//  참고: https://github.com/dmtrbrl/discography (아이디어 · 수치만 참고, 코드는 새로 씀)
//  실제처럼 보이게 하는 것 네 가지
//   1) 실제 크기 (m 단위: 재킷 315 × 315 × 3.4 mm, 판 지름 301 mm · 두께 1.9 mm, 라벨 지름 100 mm)
//   2) 빛을 그 자리에서 계산 (구운 그림이 아님): 부드러운 긴 빛 띠가 있는 환경을 재질이 비춤 → 기울이면 빛이 흐름
//   3) 표면의 잔 결: 종이 결 · 코팅 광택 · 모서리 닳음 · 판 자국(ring wear) / 판의 촘촘한 홈 · 트랙 사이 매끈한 띠
//   4) 판의 홈 반사: 홈 방향으로 늘어나는 반사(anisotropy) → 빛이 부채꼴로 비치고 기울이면 돎
import * as THREE from "three";

export const S = {
  jacket: { size: 0.315, thick: 0.0034 },
  disc: { r: 0.1505, thick: 0.0019, label: 0.05, hole: 0.0036, grooveIn: 0.0605, grooveOut: 0.1462, tracks: 5 },
  // 구도: 살짝 돌아선 줄 (Discography 는 가로 · 세로 22°) · 마우스를 따라 기우는 정도(rad) · 따라붙는 빠르기
  pose: { rotX: -0.16, rotY: -0.3, hover: 0.24, rowHover: 0.05, shift: 0.012, follow: 5 },
  // 줄: 재킷 사이 간격(m) · 옆으로 갈수록 뒤로 물러나는 깊이(m) · 가운데가 아닌 재킷의 크기 · 이만큼 떨어진 재킷까지만 그림
  //  좁은 화면(화면비 narrow 이하 = 세로로 든 휴대폰)에서는 간격을 gapNarrow 로 좁혀 양옆 재킷이 화면 안에 걸쳐 보이게
  row: { gap: 0.41, gapNarrow: 0.36, depth: 0.13, inactive: 0.8, radius: 4, narrow: 0.8 },
  // 넘기기: 놓으면 스프링(stiff · damp, 살짝 넘쳤다 돌아옴)으로 가운데에 붙음 · 던진 속도를 flick 초만큼 더 감 · 끌기 시작 거리(px)
  //  넘기는 속도(장/초)만큼 재킷이 기울고(lean, 최대 leanMax rad) 가라앉음(dip, 최대 dipMax m)
  //  tap: 누른 자리에서 이 px 안에서 뗐으면 끌기가 아니라 누르기로 봄 · maxVel: 끄는 속도(장/초) 상한
  //   (예전: 누르다 손이 5px 만 흔들려도 끌기가 되고, 순간 속도가 그대로 던지는 속도가 돼서 옆 앨범으로 넘어갔음)
  browse: { stiff: 95, damp: 15.5, flick: 0.22, dragStart: 5, tap: 12, maxVel: 6, lean: 0.075, leanMax: 0.36, dip: 0.0045, dipMax: 0.022 },
  pull: { out: 0.5 },     // 열렸을 때 판이 재킷 밖으로 나온 정도 (재킷 폭 대비)
  // 열기 (4단계): 가운데 재킷을 누르면 양옆 재킷은 옆으로 밀려나며 멀어지고(spread · recede m), 가운데 재킷은 정면을 보며 다가옴(forward m · scale 배)
  //  판은 열림이 pullFrom 을 지난 뒤부터 빠져나옴. 열린 동안 재킷은 조금만 기울고(hover 배), 판은 마우스를 따라 기울며(discTilt rad) 빛이 돎(envTurn rad)
  open: { stiff: 30, damp: 10.5, spread: 1.0, recede: 0.9, forward: 0.1, scale: 1.1, fitW: 0.78, pullFrom: 0.3, hover: 0.45, discTilt: 0, envTurn: 1.3, discSpin: 0.9 },     // discTilt 는 0: 판만 따로 기울이면 재킷 앞면을 뚫고 나옴 → 재킷과 같이 기울고 빛이 돎
  camera: { fov: 28, dist: 1.12, fitH: 0.56, fitW: 0.4, fitWNarrow: 0.6 },     // 가운데 재킷이 화면 높이 · 폭에서 차지하는 최대 비율 (좁은 화면은 폭의 fitWNarrow)
  // 등장: 재킷이 멀리(recede m 뒤) 점처럼 작게(scale) 있다가 dur 초 동안 다가오며 커짐. 가운데 먼저, 옆은 한 칸에 stagger 초씩 늦게 (최대 maxSteps 칸)
  //  멀리 있는 동안은 안개에 묻혀 있어서 바탕에서 스며 나오듯 나타남. turn = 다가오며 풀리는 회전(rad)
  intro: { dur: 1.25, stagger: 0.16, maxSteps: 4, scale: 0.05, recede: 1.5, turn: 0.55, rise: 0.05 },
  fog: { near: 1.25, far: 2.7 },     // 먼 재킷이 종이 바탕에 묻힘 (안개 색 = 페이지 바탕색)
  light: { key: 1.5, hemi: 1.15, env: 1.0, exposure: 1.0, shadow: 0.2 },   // hemi = 종이를 고르게 밝히는 빛 (반사에는 안 잡힘)
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

// ── 환경: 어두운 방 + 위쪽의 길고 부드러운 빛 띠(소프트박스) + 옆의 옅은 채움 빛. 재질이 이걸 비춤
//  방이 어두워야 검은 비닐이 검게 보이고 빛 띠만 또렷하게 비침 (밝은 방이면 판 전체가 회색으로 뜸)
export function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.033, 0.03), side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, pos, look, power, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint[0] * power, tint[1] * power, tint[2] * power), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  panel(7, 0.9, [0.5, 3.4, 2.2], [0, 0, 0], 10, [1, 0.97, 0.9]);     // 긴 빛 띠 (위 · 앞)
  panel(2.2, 3.2, [-4.6, 0.6, 2.4], [0, 0, 0], 2.2, [1, 0.95, 0.88]); // 왼쪽 채움
  panel(1.2, 2.6, [4.8, 0.2, -1.5], [0, 0, 0], 3.0, [0.62, 0.78, 1]); // 오른쪽 뒤 푸른 테두리 빛
  panel(6, 6, [0, -3.8, 0], [0, 0, 0], 0.25, [1, 0.94, 0.84]);         // 바닥에서 올라오는 종이빛
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

// ── 종이 결 (재킷 앞 · 뒤가 같이 씀): 거칠기 · 요철
export function makePaperMaps() {
  const N = 512;
  const rough = canvasOf(N, N), bump = canvasOf(N, N);
  const rc = rough.getContext("2d"), bc = bump.getContext("2d");
  const rd = rc.createImageData(N, N), bd = bc.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const fine = hash(x, y), fiber = hash(Math.floor(x / 3), y * 0.37) * 0.6 + hash(x * 0.41, Math.floor(y / 4)) * 0.4;
    const r = 156 + (fiber - 0.5) * 20;     // 거칠기 ≈ 0.57 ~ 0.65 (점 단위 잔 결은 뺌: 코팅에 비친 빛이 흰 점으로 반짝였음)
    const b = 128 + (fine - 0.5) * 14 + (fiber - 0.5) * 40;
    rd.data[i] = rd.data[i + 1] = rd.data[i + 2] = r; rd.data[i + 3] = 255;
    bd.data[i] = bd.data[i + 1] = bd.data[i + 2] = b; bd.data[i + 3] = 255;
  }
  rc.putImageData(rd, 0, 0); bc.putImageData(bd, 0, 0);
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; };
  return { rough: tex(rough), bump: tex(bump) };
}

// 재킷 면에 세월을 얹음: 가장자리 · 모서리가 하얗게 닳음 + 안의 판이 눌러 생긴 둥근 자국(ring wear)
function wear(ctx, N, amount = 1) {
  ctx.save();
  // 가장자리: 안쪽으로 옅어지는 밝은 띠 (네 변)
  for (const [x0, y0, x1, y1] of [[0, 0, 0, 1], [0, 0, 1, 0], [1, 0, -1, 0], [0, 1, 0, -1]]) {
    const g = ctx.createLinearGradient(x0 * N, y0 * N, (x0 + x1 * 0.011) * N, (y0 + y1 * 0.011) * N);
    g.addColorStop(0, `rgba(245,238,225,${0.5 * amount})`); g.addColorStop(1, "rgba(245,238,225,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  }
  // 모서리: 더 많이 닳음
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const g = ctx.createRadialGradient(cx * N, cy * N, 0, cx * N, cy * N, N * 0.02);
    g.addColorStop(0, `rgba(248,242,230,${0.75 * amount})`); g.addColorStop(1, "rgba(248,242,230,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  }
  // 가장자리 잔 긁힘
  for (let k = 0; k < 220; k++) {
    const side = k % 4, t = hash(k, 1.3), d = hash(k, 7.1) * 0.012, len = 0.004 + hash(k, 3.3) * 0.02;
    const x = side === 0 ? d : side === 1 ? 1 - d : t, y = side === 2 ? d : side === 3 ? 1 - d : t;
    ctx.strokeStyle = `rgba(250,246,236,${(0.12 + hash(k, 9.9) * 0.3) * amount})`;
    ctx.lineWidth = 0.6 + hash(k, 5.5) * 1.2;
    ctx.beginPath(); ctx.moveTo(x * N, y * N);
    ctx.lineTo((x + (side < 2 ? 0 : len)) * N, (y + (side < 2 ? len : 0)) * N); ctx.stroke();
  }
  // ring wear: 판 가장자리 자리에 아주 옅은 고리 (군데군데 끊김)
  ctx.lineWidth = N * 0.006;
  for (let k = 0; k < 40; k++) {
    const a0 = hash(k, 2.2) * Math.PI * 2, span = 0.05 + hash(k, 4.4) * 0.22;
    ctx.strokeStyle = `rgba(245,240,228,${(0.015 + hash(k, 6.6) * 0.04) * amount})`;
    ctx.beginPath(); ctx.arc(N / 2, N / 2, N * (0.468 + (hash(k, 8.8) - 0.5) * 0.008), a0, a0 + span); ctx.stroke();
  }
  ctx.restore();
}

function colorTex(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };
const readable = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.25 ? "#1d181c" : "#f1e7d2"; };

// 앞면: 커버 그림 + 닳음
export function drawFront(img, color, N = 1024) {
  const c = canvasOf(N, N), x = c.getContext("2d");
  x.fillStyle = color; x.fillRect(0, 0, N, N);
  if (img) x.drawImage(img, 0, 0, N, N);
  wear(x, N, 0.32);     // 닳은 자국은 옅게 (0.8 은 하얀 테두리처럼 보였음)
  return c;
}
// 뒷면: 뒷면 그림이 없으므로 커버 색 바탕에 제목 · 아티스트 · 면 표기 · 바코드를 조판
export function drawBack(album, color) {
  const SIZE = 512, N = 1024, c = canvasOf(SIZE, SIZE), x = c.getContext("2d");
  x.scale(SIZE / N, SIZE / N);     // 1024 기준으로 그리고 절반 크기로 (뒷면은 뒤집어 볼 때만 보임)
  const bg = shade(color, 0.82), fg = readable(bg);
  x.fillStyle = bg; x.fillRect(0, 0, N, N);
  x.fillStyle = fg; x.textBaseline = "top";
  x.font = "600 22px Georgia, serif"; x.fillText((album?.artist_names || "Unknown artist").toUpperCase(), 84, 96);
  x.font = "italic 64px Georgia, serif";
  wrapText(x, album?.title || "Untitled", 84, 136, N - 168, 72);
  x.globalAlpha = 0.75; x.font = "18px Georgia, serif";
  ["SIDE A", "SIDE B"].forEach((s, k) => {
    x.fillText(s, 84 + k * 430, 470);
    x.fillRect(84 + k * 430, 500, 340, 1.5);
    for (let r = 0; r < 5; r++) x.fillRect(84 + k * 430, 528 + r * 34, 180 + hash(k, r) * 150, 6);
  });
  x.globalAlpha = 0.6; x.font = "15px Georgia, serif";
  x.fillText("Grooves pressing · 33⅓ RPM · stereo", 84, N - 118);
  x.globalAlpha = 1; x.fillStyle = "#f4efe6"; x.fillRect(N - 250, N - 150, 166, 76);
  x.fillStyle = "#15131a";
  for (let k = 0, px = N - 240; px < N - 96; k++) { const w = 1 + Math.floor(hash(k, 4.2) * 4); if (k % 2 === 0) x.fillRect(px, N - 142, w, 60); px += w; }
  wear(x, N, 0.4);
  return c;
}
function wrapText(x, text, left, top, width, line) {
  const words = String(text).split(/\s+/); let row = "", y = top;
  for (const w of words) {
    if (x.measureText(row + w).width > width && row) { x.fillText(row.trim(), left, y); row = ""; y += line; }
    row += w + " ";
  }
  x.fillText(row.trim(), left, y);
}
// 라벨: 커버 색 종이 + 둥글게 돌아가는 글자 + 가운데 구멍 둘레의 눌린 자국
export function drawLabel(album, color) {
  const N = 512, c = canvasOf(N, N), x = c.getContext("2d");
  const fg = readable(color);
  x.fillStyle = color; x.fillRect(0, 0, N, N);
  x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 1.5;
  for (const r of [0.47, 0.455, 0.2]) { x.beginPath(); x.arc(N / 2, N / 2, N * r, 0, Math.PI * 2); x.stroke(); }
  x.globalAlpha = 1; x.fillStyle = fg; x.textAlign = "center";
  x.font = "italic 34px Georgia, serif"; x.fillText(clip(x, album?.title || "Untitled", N * 0.62), N / 2, N * 0.3);
  x.font = "600 15px Georgia, serif"; x.fillText(clip(x, (album?.artist_names || "").toUpperCase(), N * 0.7), N / 2, N * 0.36);
  x.font = "14px Georgia, serif"; x.globalAlpha = 0.8;
  x.fillText("SIDE A", N * 0.27, N * 0.52); x.fillText("33⅓ RPM", N * 0.73, N * 0.52);
  x.fillText("GROOVES", N / 2, N * 0.72);
  return c;
}
const clip = (x, s, w) => { let t = s; while (t.length > 3 && x.measureText(t).width > w) t = t.slice(0, -2); return t === s ? s : t.trim() + "…"; };

// ── 판의 홈: 반지름 방향 1줄짜리 그림 (요철 · 거칠기). 홈은 촘촘한 물결, 트랙 사이 · 안쪽(dead wax) · 가장자리는 매끈
function makeGrooveMaps(r0, r1) {
  const H = 2048, bump = canvasOf(4, H), rough = canvasOf(4, H);
  const bc = bump.getContext("2d"), rc = rough.getContext("2d");
  const D = S.disc, span = D.grooveOut - D.grooveIn;
  const gaps = Array.from({ length: D.tracks - 1 }, (_, k) => D.grooveIn + span * ((k + 1) / D.tracks + (hash(k, 1.7) - 0.5) * 0.06));
  for (let j = 0; j < H; j++) {
    const r = r0 + ((j + 0.5) / H) * (r1 - r0);
    let groove = r > D.grooveIn && r < D.grooveOut ? 1 : 0;
    for (const g of gaps) if (Math.abs(r - g) < 0.0007) groove = 0;
    const wave = Math.sin((r / 0.00034) * Math.PI * 2);
    const b = 128 + (groove ? wave * 88 : 0);
    const ro = groove ? 96 + hash(j, 3.1) * 14 : 30;     // 홈 ≈ 0.38 ~ 0.43 · 매끈한 띠 ≈ 0.12
    bc.fillStyle = `rgb(${b},${b},${b})`; bc.fillRect(0, H - 1 - j, 4, 1);
    rc.fillStyle = `rgb(${ro},${ro},${ro})`; rc.fillRect(0, H - 1 - j, 4, 1);
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  return { bump: tex(bump), rough: tex(rough) };
}
// 판 면 한 장: 극좌표 격자. uv = (각도, 반지름) → 홈 그림이 반지름을 따라 놓임. tangent = 반지름 방향 (홈 반사가 늘어나는 방향의 기준)
function polarFace(r0, r1, y, up) {
  const T = 192, R = 24, pos = [], nor = [], uv = [], tan = [], idx = [];
  for (let i = 0; i <= R; i++) for (let j = 0; j <= T; j++) {
    const t = i / R, a = (j / T) * Math.PI * 2, r = r0 + (r1 - r0) * t, c = Math.cos(a), s = Math.sin(a);
    pos.push(r * c, y, r * s); nor.push(0, up, 0); uv.push(j / T, t); tan.push(c, 0, s, 1);
  }
  for (let i = 0; i < R; i++) for (let j = 0; j < T; j++) {
    const a = i * (T + 1) + j, b = a + 1, c = a + T + 1, d = c + 1;
    if (up > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("tangent", new THREE.Float32BufferAttribute(tan, 4));
  g.setIndex(idx);
  return g;
}

export function makeRecord(renderer) {
  const D = S.disc, h = D.thick / 2, group = new THREE.Group();
  const maps = makeGrooveMaps(D.label - 0.0005, D.r - 0.0006);
  const vinyl = new THREE.MeshPhysicalMaterial({
    color: "#08080a", roughness: 1, roughnessMap: maps.rough, metalness: 0, bumpMap: maps.bump, bumpScale: 0.6,
    // 홈 방향 반사는 약하게: 세면 빛 띠가 판 전체로 번져 판이 은회색으로 보였음 (검은 비닐에 빛이 한 갈래로만 비치게)
    anisotropy: 0.38, anisotropyRotation: 0, clearcoat: 0.22, clearcoatRoughness: 0.22, specularIntensity: 1,
  });
  for (const up of [1, -1]) {
    const face = new THREE.Mesh(polarFace(D.label - 0.0005, D.r - 0.0006, up * h, up), vinyl);
    face.castShadow = face.receiveShadow = true;
    group.add(face);
  }
  // 둥근 가장자리 (매끈한 검은 비닐)
  const rim = new THREE.Mesh(
    new THREE.LatheGeometry([[D.r - 0.0006, h], [D.r - 0.0002, h * 0.7], [D.r, 0], [D.r - 0.0002, -h * 0.7], [D.r - 0.0006, -h]].map(([x, y]) => new THREE.Vector2(x, y)), 192),
    new THREE.MeshPhysicalMaterial({ color: "#08080a", roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.2 }));
  rim.castShadow = true;
  group.add(rim);
  // 라벨 (종이, 살짝 도드라짐) 앞 · 뒤
  const labelMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.78 });
  for (const up of [1, -1]) {
    const m = new THREE.Mesh(new THREE.RingGeometry(D.hole, D.label, 96), labelMat);
    m.rotation.x = -up * Math.PI / 2; m.position.y = up * (h + 0.00012);
    m.receiveShadow = true;
    group.add(m);
  }
  return { group, vinyl, labelMat, setLabel(canvas) { labelMat.map?.dispose(); labelMat.map = colorTex(canvas, renderer); labelMat.needsUpdate = true; } };
}

export function makeJacket(renderer, paper) {
  const J = S.jacket;
  const face = () => new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 1, roughnessMap: paper.rough,
    // 얇은 무광 코팅: 빛 띠가 아주 흐릿하게만 비침 (2026-11-17: 요철을 빼고 코팅을 낮춤 — 커버 위에 흰 점이 반짝이고 뿌연 막이 끼어 색이 떠 보였음)
    clearcoat: 0.12, clearcoatRoughness: 0.55, specularIntensity: 0.35,
  });
  const front = face(), back = face();
  const edge = new THREE.MeshStandardMaterial({ color: "#e9e1d0", roughness: 0.9 });
  // 입구(오른쪽): 두 장의 판지 사이 어두운 틈
  const mouthC = canvasOf(16, 4), mx = mouthC.getContext("2d");
  mx.fillStyle = "#ebe4d4"; mx.fillRect(0, 0, 16, 4); mx.fillStyle = "#0c0a0c"; mx.fillRect(4, 0, 8, 4);
  const mouthTex = new THREE.CanvasTexture(mouthC); mouthTex.colorSpace = THREE.SRGBColorSpace; mouthTex.magFilter = THREE.NearestFilter;
  const mouth = new THREE.MeshStandardMaterial({ map: mouthTex, roughness: 0.9 });
  const spine = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });
  // BoxGeometry 재질 순서: +x(입구) · -x(책등) · +y · -y · +z(앞) · -z(뒤)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(J.size, J.size, J.thick), [mouth, spine, edge, edge, front, back]);
  mesh.castShadow = true;
  const set = (mat, canvas) => { mat.map?.dispose(); mat.map = colorTex(canvas, renderer); mat.needsUpdate = true; };
  return {
    mesh,
    setArt(frontCanvas, backCanvas, color) { set(front, frontCanvas); set(back, backCanvas); spine.color.set(shade(color, 0.82)); },
    setFront(frontCanvas) { set(front, frontCanvas); },
  };
}

/** @param {HTMLElement} host  @param {{ onIndex?: (i: number) => void, onPull?: (open: boolean) => void, onRecord?: (i: number) => void }} [opts]
 *  onPull = 열림 · 닫힘이 바뀔 때 · onRecord = 열린 상태에서 판을 누름 (5단계에서 턴테이블로 보냄) */
export function createSleeveScene(host, { onIndex, onPull, onRecord } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = S.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;     // 넓게 번지는 부드러운 그림자 (재킷이 판 · 옆 재킷 위에 드리움)
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "pan-y";     // 가로로 끌면 줄 넘기기, 세로는 페이지 스크롤

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = S.light.env;
  const pageColor = getComputedStyle(document.documentElement).getPropertyValue("--cream").trim() || "#f4e7cd";
  scene.fog = new THREE.Fog(pageColor, S.fog.near, S.fog.far);     // (거리는 fit 에서 카메라 거리에 맞춰 다시 정함)
  const camera = new THREE.PerspectiveCamera(S.camera.fov, 1, 0.1, 20);
  camera.position.set(0, 0, S.camera.dist);

  const key = new THREE.DirectionalLight("#fff6e6", S.light.key);
  key.position.set(-0.45, 0.8, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -0.9, right: 0.9, top: 0.6, bottom: -0.6, near: 0.2, far: 4 });
  key.shadow.radius = 10; key.shadow.blurSamples = 16; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002;
  scene.add(key, key.target, new THREE.HemisphereLight("#fff8ec", "#cbbfae", S.light.hemi));

  // 줄(rig) → 재킷마다 자리 틀(holder) → 재킷. 판은 한 장: 가운데 재킷의 자리 틀에 붙어 그 입구로 빠져나옴
  const rig = new THREE.Group();
  scene.add(rig);
  const paper = makePaperMaps();
  const record = makeRecord(renderer);
  record.group.rotation.x = Math.PI / 2;     // 판 축을 재킷 면에 수직으로
  record.group.visible = false;
  /** @type {{ album: any, color: string, holder: THREE.Group, jacket: ReturnType<typeof makeJacket>, img: any }[]} */
  let items = [];

  const st = {
    pointer: new THREE.Vector2(), tilt: new THREE.Vector2(),
    pos: 0, vel: 0, target: 0, index: 0,          // 줄 위치(장 단위, 소수) · 속도(장/초) · 붙을 자리 · 지금 가운데
    pull: 0, pullTarget: 0, recAt: -1,            // 판이 나온 정도(열림에서 나옴) · 열림 목표(0 닫힘 · >0 열림) · 판이 붙어 있는 재킷
    open: 0, openV: 0,                            // 열린 정도 0 → 1 (스프링)
    introT: reduced ? 99 : -1,                    // 등장이 시작된 뒤 흐른 시간 (-1 = 아직 숨김, reveal() 이 시작)
  };
  const drag = { id: null, active: false, moved: false, x0: 0, pos0: 0, lastX: 0, lastT: 0, v: 0 };

  const fit = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // 가운데 재킷이 화면 높이의 fitH · 폭의 fitW 를 넘지 않는 거리 (좁은 화면에서도 양옆 재킷이 보이게)
    const t = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    st.narrow = camera.aspect <= S.row.narrow;
    camera.position.z = Math.max(S.jacket.size / S.camera.fitH, S.jacket.size / (st.narrow ? S.camera.fitWNarrow : S.camera.fitW) / camera.aspect) / t;
    camera.updateProjectionMatrix();
    scene.fog.near = camera.position.z + S.fog.near - S.camera.dist; scene.fog.far = camera.position.z + S.fog.far - S.camera.dist;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  const setIndex = (i) => { if (i !== st.index) { st.index = i; onIndex?.(i); } };
  // 판은 가운데에 자리 잡은 재킷에서만 나옴. 넘기는 도중에 누르면 기억해 뒀다가(wantPull) 자리 잡은 뒤에 꺼냄
  const setPullTarget = (out) => {
    if (out && (st.recAt !== st.target || Math.abs(st.pos - st.target) > 0.06)) { st.wantPull = true; return; }
    st.wantPull = false;
    const v = out && items.length ? S.pull.out : 0;
    if (v === st.pullTarget) return;
    st.pullTarget = v; onPull?.(v > 0);
  };
  const go = (i) => {
    if (!items.length) return;
    const t = Math.min(items.length - 1, Math.max(0, Math.round(i)));
    if (t !== st.target) st.wantPull = false;
    st.target = t;
    if (st.target !== st.recAt) setPullTarget(false);     // 다른 재킷으로 가면 판은 넣음
  };

  // ── 입력: 가로로 끌어 넘기기 · 눌렀다 떼면(끌지 않았으면) 옆 재킷은 그리로, 가운데 재킷은 판을 뺐다 넣음
  const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
  const ndcOf = (e) => {
    const r = host.getBoundingClientRect();
    return _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  };
  // 화면에서 재킷 한 칸이 차지하는 px (끈 거리를 장 수로 바꿈)
  const pxPerItem = () => {
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    return ((st.narrow ? S.row.gapNarrow : S.row.gap) / visH) * host.clientHeight * Math.cos(S.pose.rotY);
  };
  const introBusy = () => st.introT < S.intro.dur * 0.75;     // 가운데 재킷이 거의 다 올 때까지는 입력을 받지 않음
  const onDown = (e) => {
    if (drag.id != null || e.button !== 0 || !items.length || introBusy()) return;
    Object.assign(drag, { id: e.pointerId, active: true, moved: false, locked: st.pullTarget > 0 || st.open > 0.05, x0: e.clientX, pos0: st.pos, lastX: e.clientX, lastT: performance.now(), v: 0 });
    renderer.domElement.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    st.pointer.copy(ndcOf(e));
    if (!drag.active || e.pointerId !== drag.id || drag.locked) return;     // 열려 있는 동안은 줄을 끌 수 없음
    const dx = e.clientX - drag.x0;
    if (!drag.moved) {
      if (Math.abs(dx) < S.browse.dragStart) return;
      drag.moved = true;
      setPullTarget(false);
    }
    const per = pxPerItem(), now = performance.now(), dtm = Math.max(8, now - drag.lastT);
    // 줄 끝을 넘어 끌면 점점 뻑뻑하게
    let p = drag.pos0 - dx / per;
    const over = p < 0 ? p : p > items.length - 1 ? p - (items.length - 1) : 0;
    if (over) p -= over * 0.65;
    const inst = (-(e.clientX - drag.lastX) / per) / (dtm / 1000);
    drag.v += (Math.max(-S.browse.maxVel, Math.min(S.browse.maxVel, inst)) - drag.v) * 0.32;
    drag.far = Math.max(drag.far ?? 0, Math.abs(dx));
    drag.lastX = e.clientX; drag.lastT = now;
    st.pos = p; st.vel = drag.v;
    st.target = Math.min(items.length - 1, Math.max(0, Math.round(p)));
  };
  const onUp = (e) => {
    if (e.pointerId !== drag.id) return;
    // 거의 안 움직였으면 누르기 (손이 조금 흔들린 것). 줄은 제자리로
    const tapped = drag.moved && (drag.far ?? 0) < S.browse.tap;
    if (tapped) { st.target = Math.min(items.length - 1, Math.max(0, Math.round(drag.pos0))); st.vel = 0; }
    const moved = drag.moved && !tapped, still = performance.now() - drag.lastT > 90;
    drag.far = 0;
    drag.id = null; drag.active = false;
    if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
    if (e.pointerType !== "mouse") st.pointer.set(0, 0);     // 터치: 손을 떼면 기울기를 풂 (마지막 닿은 자리에 기운 채 남지 않게)
    if (moved) { go(st.pos + (still ? 0 : drag.v * S.browse.flick)); return; }
    // 누르기만 함: 어떤 재킷인지
    ray.setFromCamera(ndcOf(e), camera);
    // 보이는 재킷만 대상으로 (Raycaster 는 visible 을 보지 않음 → 멀어서 숨긴 재킷이 줄 한가운데에 남아 먼저 맞았음)
    const hit = ray.intersectObjects(items.filter((it) => it.holder.visible).map((it) => it.jacket.mesh).concat(record.group.visible ? record.group.children : []), false)[0];
    if (!hit) return;
    const i = items.findIndex((it) => it.jacket.mesh === hit.object);
    if (i < 0) { if (st.open > 0.9) onRecord?.(st.recAt); return; }     // 판을 누름 → (5단계) 턴테이블로
    if (i !== Math.round(st.pos)) { if (!drag.locked) go(i); }
    else setPullTarget(st.pullTarget === 0);
  };
  const onLeave = () => st.pointer.set(0, 0);
  const el = renderer.domElement;
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  for (const t of ["pointerup", "pointercancel"]) el.addEventListener(t, onUp);
  el.addEventListener("pointerleave", onLeave);

  const attachRecord = (i) => {
    const it = items[i]; if (!it) return;
    it.holder.add(record.group);
    record.setLabel(drawLabel(it.album, it.color));
    record.group.visible = true;
    st.recAt = i;
  };

  const frame = (dt) => {
    const n = items.length, B = S.browse, R = S.row, I = S.intro, gap = st.narrow ? R.gapNarrow : R.gap;
    if (st.introT >= 0 && st.introT < 90) st.introT += dt;
    if (reduced) st.tilt.set(0, 0);     // 모션 줄이기: 마우스를 따라 기울지 않음
    else st.tilt.lerp(st.pointer, 1 - Math.exp(-dt * S.pose.follow));
    // 줄 위치: 끄는 동안은 손을 따르고, 놓으면 스프링으로 붙을 자리에 (살짝 넘쳤다 돌아옴)
    if (!drag.active || !drag.moved) {
      if (reduced) { st.pos = st.target; st.vel = 0; }
      else {
        st.vel += (B.stiff * (st.target - st.pos) - B.damp * st.vel) * dt;
        st.pos += st.vel * dt;
        if (Math.abs(st.target - st.pos) < 0.0005 && Math.abs(st.vel) < 0.002) { st.pos = st.target; st.vel = 0; }
      }
    }
    if (n) setIndex(Math.min(n - 1, Math.max(0, Math.round(st.pos))));
    // 열림(스프링) → 판이 나온 정도. 다 들어갔고 가운데가 바뀌었으면 판을 그 재킷으로 옮겨 붙임
    const O = S.open, openTo = st.pullTarget > 0 ? 1 : 0;
    if (reduced) { st.open = openTo; st.openV = 0; }
    else {
      st.openV += (O.stiff * (openTo - st.open) - O.damp * st.openV) * dt;
      st.open += st.openV * dt;
      if (Math.abs(openTo - st.open) < 0.0005 && Math.abs(st.openV) < 0.002) { st.open = openTo; st.openV = 0; }
    }
    const o = clamp01(st.open), oe = o * o * (3 - 2 * o);
    const pk = clamp01((o - O.pullFrom) / (1 - O.pullFrom));
    st.pull = S.pull.out * pk * pk * (3 - 2 * pk);
    if (n && st.pull < 0.01 && st.pullTarget === 0 && st.recAt !== st.target && Math.abs(st.pos - st.target) < 0.5) attachRecord(st.target);
    else if (n && st.recAt < 0) attachRecord(st.index);
    if (st.wantPull && st.recAt === st.target && Math.abs(st.pos - st.target) <= 0.06) setPullTarget(true);

    // 줄의 돌아선 각도는 열리면 풀려 정면을 봄
    rig.rotation.set((S.pose.rotX - st.tilt.y * S.pose.rowHover) * (1 - oe), (S.pose.rotY + st.tilt.x * S.pose.rowHover) * (1 - oe), 0);
    // 열린 재킷 + 나온 판이 화면 폭의 fitW 안에 들어오는 크기
    const visW = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - O.forward) * camera.aspect;
    const openScale = Math.min(O.scale, (visW * O.fitW) / (S.jacket.size * (1 + S.pull.out)));
    const hoverK = 1 - (1 - O.hover) * oe;
    const lean = Math.max(-B.leanMax, Math.min(B.leanMax, -st.vel * B.lean));
    const dip = Math.min(B.dipMax, Math.abs(st.vel) * B.dip);
    for (let i = 0; i < n; i++) {
      const it = items[i], d = i - st.pos, ad = Math.abs(d);
      it.holder.visible = ad < R.radius && st.introT >= 0;
      if (!it.holder.visible) continue;
      // 등장: 0 → 1 (가운데 먼저). 다 오면 1 로 고정
      const ik0 = clamp01((st.introT - Math.min(ad, I.maxSteps) * I.stagger) / I.dur);
      const ik = 1 - Math.pow(1 - ik0, 4);
      const front = clamp01(1 - ad);                              // 1 = 가운데
      const out = i === st.recAt ? st.pull : 0;
      const mine = i === st.recAt;                                 // 열리는(판이 붙은) 재킷
      const sc = (R.inactive + (1 - R.inactive) * front) * (mine ? 1 + (openScale - 1) * oe : 1);
      it.holder.scale.setScalar(sc * (I.scale + (1 - I.scale) * ik));
      // 열리면: 양옆 재킷은 옆으로 밀려나며 멀어져 안개에 묻히고, 가운데 재킷은 앞으로
      const away = mine ? 0 : oe;
      it.holder.position.set(
        d * gap * (0.55 + 0.45 * ik) + Math.sign(d || 1) * away * O.spread - (out * S.jacket.size * sc) / 2 + st.tilt.x * S.pose.shift * front,
        -dip + st.tilt.y * S.pose.shift * front - (1 - ik) * I.rise,
        -Math.min(ad, 3) * R.depth - (1 - ik) * I.recede - away * O.recede + (mine ? oe * O.forward : 0));
      // 가운데 재킷은 마우스를 따라 기울고(빛이 면 위를 흐름), 모두 넘기는 속도만큼 기욺. 등장 중에는 돌아선 채 다가오며 풀림. 열린 동안은 조금만
      it.holder.rotation.set(-st.tilt.y * S.pose.hover * hoverK * front * ik + (1 - ik) * 0.25, st.tilt.x * S.pose.hover * hoverK * front * ik + lean + (1 - ik) * I.turn, lean * -0.25);
    }
    record.group.position.x = st.pull * S.jacket.size;
    // 판: 빠져나오며 살짝 돎 (손으로 꺼낼 때처럼). 열린 동안은 마우스를 따라 기울고 → 홈에 비친 빛이 부채꼴로 돎
    record.group.rotation.set(Math.PI / 2 + st.tilt.y * O.discTilt * oe, (st.pull / S.pull.out) * O.discSpin, -st.tilt.x * O.discTilt * oe);
    // 빛도 마우스를 따라 조금 돎 (열린 동안만): 판 · 재킷에 비친 빛 띠가 흐름
    scene.environmentRotation.set(st.tilt.y * O.envTurn * 0.5 * oe, st.tilt.x * O.envTurn * oe, 0);
    record.group.visible = st.recAt >= 0 && st.pull > 0.002;       // 다 들어가 있으면 그리지 않음
    renderer.render(scene, camera);
  };
  let raf = 0, last = performance.now();
  const tick = (now) => { raf = requestAnimationFrame(tick); frame(Math.min(0.05, (now - last) / 1000)); last = now; };
  raf = requestAnimationFrame(tick);

  const disposeItem = (it) => {
    it.holder.removeFromParent();
    it.jacket.mesh.geometry.dispose();
    for (const m of it.jacket.mesh.material) { m.map?.dispose(); m.dispose(); }
  };
  return {
    S, st, frame, renderer, record, camera,
    get items() { return items; },
    /** 앨범 목록으로 줄을 다시 만듦: { title, artist_names, cover_color }[] (커버 그림은 setCover 로 나중에) */
    setAlbums(list) {
      rig.remove(record.group); record.group.visible = false;
      items.forEach(disposeItem);
      items = list.map((album) => {
        const color = album?.cover_color || "#8a7f86";
        const jacket = makeJacket(renderer, paper);
        jacket.setArt(drawFront(null, color), drawBack(album, color), color);
        const holder = new THREE.Group();
        holder.add(jacket.mesh);
        rig.add(holder);
        return { album, color, holder, jacket, img: null };
      });
      st.pos = st.target = Math.min(st.target, Math.max(0, items.length - 1)); st.vel = 0;
      st.pull = st.pullTarget = st.open = st.openV = 0; st.recAt = -1; st.index = -1;
      if (items.length) setIndex(Math.round(st.pos));
    },
    /** i 번째 재킷 앞면에 커버 그림을 입힘 */
    setCover(i, img) {
      const it = items[i]; if (!it || !img) return;
      it.img = img;
      it.jacket.setFront(drawFront(img, it.color));
    },
    /** 등장 시작 (첫 로딩 화면이 걷힌 뒤 부름). 이미 시작했으면 아무것도 안 함 */
    reveal() { if (st.introT < 0) st.introT = 0; },
    /** 등장을 처음부터 다시 (확인용) */
    replay() { st.introT = reduced ? 99 : 0; },
    go(i) { if (st.pullTarget === 0) go(i); },
    step(d) { if (!introBusy() && st.pullTarget === 0) go(st.target + d); },     // 열려 있는 동안은 줄이 움직이지 않음
    setPull(out) { if (!introBusy()) setPullTarget(out); },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      for (const t of ["pointerup", "pointercancel"]) el.removeEventListener(t, onUp);
      el.removeEventListener("pointerleave", onLeave);
      items.forEach(disposeItem);
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) { if (!m) continue; for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
      });
      paper.rough.dispose(); paper.bump.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
