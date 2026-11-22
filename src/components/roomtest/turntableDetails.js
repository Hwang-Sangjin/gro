// 턴테이블에 덧붙이는 부품 (2026-11-22 사용자 요청: 모델을 좀 더 디테일하게)
//  방 GLB 의 턴테이블은 본체가 둥근 상자, 버튼이 납작한 원기둥 셋뿐이라 가까이서 보면 밋밋함.
//  GLB 를 다시 내보내면 reveal 클립 · 압축까지 긴 과정을 다시 타야 해서, 형태를 웹에서 만들어 본체(Turntable_Plinth)의 자식으로 붙임
//   → 방이 지어질 때 본체와 같이 움직이고, 재질 · 반사 · 그림자는 턴테이블의 실시간 재질(turntableLook.js)과 같은 규칙
//  좌표는 본체 기준 (m): x 왼쪽(-) · 오른쪽(+), y 위, z 뒤(-, 덮개 경첩) · 앞(+). 값은 GLB 의 메시에서 직접 잼
//   데크 윗면 y 0.0936 · 큰 노브 (-0.181, 0.132) 반지름 0.0155 · 작은 버튼 둘 (-0.148 / -0.123, 0.144) 반지름 0.007
//   플래터 가운데 (-0.042, -0.007) 반지름 0.1467 · 톤암 받침 (0.146, -0.093) · 오른쪽 앞 은색 받침 (0.186, 0.099)
//  Blender 에서 모델을 고쳐 다시 내보내게 되면 이 파일의 부품과 겹치지 않는지 확인할 것 (같은 자리의 부품은 여기서 빼기)
import * as THREE from "three";

const DECK = 0.0936;
const KNOB = { x: -0.181, z: 0.132 };
const BUTTONS = [{ x: -0.148, z: 0.144, label: "START · STOP" }, { x: -0.123, z: 0.144, label: "33 · 45" }];
const PLATTER = { x: -0.042, z: -0.007, r: 0.1467 };
const INK = "#ece5d3";   // 데크 위 실크 인쇄 색 (살짝 누런 흰색)

const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// 노브 옆면의 톱니 홈 (요철 그림: 세로 줄)
function knurlMap() {
  const c = canvasOf(64, 8), x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "#222"); g.addColorStop(0.5, "#eee"); g.addColorStop(1, "#222");
  x.fillStyle = g; x.fillRect(0, 0, 64, 8);
  const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(56, 1);
  return t;
}
// 동심원 결 (노브 · 버튼 윗면: 선반으로 깎은 금속)
function spunMap() {
  const N = 256, c = canvasOf(N, N), x = c.getContext("2d");
  x.fillStyle = "#7a7a7a"; x.fillRect(0, 0, N, N);
  for (let r = 2; r < N * 0.72; r += 1.6) { x.strokeStyle = `rgba(${r % 3 < 1.6 ? "255,255,255" : "0,0,0"},0.2)`; x.lineWidth = 0.9; x.beginPath(); x.arc(N / 2, N / 2, r, 0, Math.PI * 2); x.stroke(); }
  return tex(c, false);
}
// 실크 인쇄: 투명 바탕에 흰 글자 · 선. draw(ctx, W, H) 로 그림 (1m = px 픽셀)
function printed(w, h, draw, px = 9000) {
  const W = Math.round(w * px), H = Math.round(h * px), c = canvasOf(W, H), x = c.getContext("2d");
  x.fillStyle = INK; x.strokeStyle = INK; x.textAlign = "center"; x.textBaseline = "middle";
  draw(x, W, H, px);
  return tex(c);
}
const SANS = '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif';
const spaced = (x, s, cx, cy, gap) => {   // 자간을 벌린 글자 (가운데 맞춤)
  const ws = [...s].map((ch) => x.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + gap * (s.length - 1);
  let at = cx - total / 2;
  [...s].forEach((ch, i) => { x.fillText(ch, at + ws[i] / 2, cy); at += ws[i] + gap; });
};

/**
 * root: 턴테이블 부품이 들어 있는 노드 · P: 재질을 만드는 함수 (turntableLook 의 MeshPhysicalMaterial) · track(mat): 반사 세기를 같이 받게 등록
 * 돌려주는 것: { dispose() }
 */
export function addTurntableDetails({ root, P, track }) {
  const plinth = root.getObjectByName("Turntable_Plinth"), platter = root.getObjectByName("Turntable_Platter");
  if (!plinth) return { dispose() {} };
  const made = [], texs = [];
  const group = new THREE.Group();
  group.name = "turntable_details";
  plinth.add(group);
  const M = (o) => { const m = P(o); track(m); return m; };
  const keep = (t) => { texs.push(t); return t; };
  const add = (geo, mat, x, y, z, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); made.push(m);
    return m;
  };
  // 데크 위에 눕힌 인쇄 판 (앞에서 읽히게: 글자의 위가 뒤쪽을 향함)
  const print = (w, h, x, z, draw, y = DECK + 0.00025) => {
    const mat = M({ map: keep(printed(w, h, draw)), transparent: true, depthWrite: false, roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const m = add(new THREE.PlaneGeometry(w, h), mat, x, y, z);
    m.rotation.x = -Math.PI / 2; m.castShadow = false;
    return m;
  };

  const knurl = keep(knurlMap()), spun = keep(spunMap());
  const alu = M({ color: "#b9bcc1", roughness: 0.3, metalness: 1 });
  const aluKnurl = M({ color: "#aeb1b6", roughness: 0.36, metalness: 1, bumpMap: knurl, bumpScale: 1.4 });
  const aluTop = M({ color: "#c6c9ce", roughness: 0.24, metalness: 1, bumpMap: spun, bumpScale: 0.35 });
  const black = M({ color: "#131315", roughness: 0.42, metalness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  const chrome = M({ color: "#d6d8dc", roughness: 0.12, metalness: 1 });
  const slot = M({ color: "#050506", roughness: 0.25, metalness: 0.2 });

  // ── 큰 노브 (속도 선택): 검은 받침 고리 · 톱니 옆면 · 오목한 윗면 · 흰 표시선. 원래의 납작한 원기둥을 덮음
  add(new THREE.CylinderGeometry(0.0192, 0.0196, 0.0014, 64), black, KNOB.x, DECK + 0.0007, KNOB.z);
  add(new THREE.CylinderGeometry(0.0164, 0.0170, 0.0068, 64, 1, true), aluKnurl, KNOB.x, DECK + 0.0048, KNOB.z);
  const cap = new THREE.LatheGeometry([[0, 0.0068], [0.0128, 0.0070], [0.0146, 0.0078], [0.0158, 0.0082], [0.0164, 0.0078]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
  add(cap, aluTop, KNOB.x, DECK + 0.0004, KNOB.z);
  const mark = add(new THREE.BoxGeometry(0.0011, 0.0004, 0.0072), M({ color: "#f3efe4", roughness: 0.5 }), 0, 0, 0);
  // 표시선: 노브 가운데에서 "33" 눈금 쪽(왼쪽 뒤)을 가리킴
  mark.position.set(KNOB.x + Math.sin(-0.62) * 0.0098, DECK + 0.0079, KNOB.z - Math.cos(-0.62) * 0.0098); mark.rotation.y = 0.62;
  // 눈금: 노브 뒤쪽 반원에 점 셋 + OFF · 33 · 45
  print(0.052, 0.03, KNOB.x + 0.001, KNOB.z - 0.0165, (x, W, H, px) => {
    const cx = W / 2 - 0.001 * px, cy = H + 0.0015 * px, R = 0.0235 * px;
    x.font = `700 ${0.0031 * px}px ${SANS}`;
    [["OFF", -0.92], ["33", -0.3], ["45", 0.32]].forEach(([s, a]) => {
      const px0 = cx + Math.sin(a) * R, py0 = cy - Math.cos(a) * R;
      x.beginPath(); x.arc(cx + Math.sin(a) * (R - 0.0042 * px), cy - Math.cos(a) * (R - 0.0042 * px), 0.00055 * px, 0, Math.PI * 2); x.fill();
      x.save(); x.translate(px0, py0); x.rotate(a * 0.55); x.fillText(s, 0, 0); x.restore();
    });
  });

  // ── 작은 버튼 둘: 크롬 테 · 살짝 볼록한 검은 캡 · 위쪽의 작은 글자
  for (const b of BUTTONS) {
    const ring = add(new THREE.TorusGeometry(0.0082, 0.00085, 12, 48), chrome, b.x, DECK + 0.0003, b.z);
    ring.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.0064, 0.0070, 0.0026, 40), black, b.x, DECK + 0.0001, b.z);
    const dome = add(new THREE.SphereGeometry(0.0145, 32, 8, 0, Math.PI * 2, 0, 0.455), aluTop, b.x, DECK + 0.0014 - 0.0145 * Math.cos(0.455), b.z);
    dome.scale.set(1, 0.6, 1); dome.position.y = DECK + 0.0014 - 0.0145 * 0.6 * Math.cos(0.455);
    print(0.024, 0.005, b.x, b.z - 0.0128, (x, W, H, px) => { x.font = `700 ${0.0024 * px}px ${SANS}`; spaced(x, b.label, W / 2, H / 2, 0.00045 * px); });
  }
  // 전원 불빛: 버튼 사이 위쪽의 작은 호박색 점 (빛 번짐을 받게 밝게)
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.05, 0.28), toneMapped: false });
  add(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0008, 16), led, -0.1355, DECK + 0.0004, 0.1275).castShadow = false;
  add(new THREE.TorusGeometry(0.0019, 0.0005, 8, 24), chrome, -0.1355, DECK + 0.0002, 0.1275).rotation.x = Math.PI / 2;

  // ── 스트로브: 플래터 테두리의 점 줄(판과 같이 돎) + 그 앞을 비추는 작은 등
  if (platter) {
    const c = canvasOf(1024, 64), x = c.getContext("2d");
    x.fillStyle = "#1a1b1d";
    [[180, 8], [174, 24], [186, 40], [192, 56]].forEach(([n, y]) => { for (let i = 0; i < n; i++) x.fillRect((i / n) * 1024, y - 4, (1024 / n) * 0.52, 8); });
    const dots = keep(tex(c)); dots.wrapS = THREE.RepeatWrapping;
    const band = add(new THREE.CylinderGeometry(PLATTER.r + 0.0004, PLATTER.r + 0.0004, 0.017, 128, 1, true),
      M({ map: dots, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 0, -0.0165, 0, platter);
    band.castShadow = false;
  }
  // 등의 자리: 플래터 앞쪽 가운데 (왼쪽 앞은 버튼 글자와 겹쳤음)
  const sd = new THREE.Vector2(0.2, 0.98).normalize(), sx = PLATTER.x + sd.x * (PLATTER.r + 0.0125), sz = PLATTER.z + sd.y * (PLATTER.r + 0.0125);
  add(new THREE.CylinderGeometry(0.0062, 0.0068, 0.0078, 32), black, sx, DECK + 0.0039, sz);
  add(new THREE.CylinderGeometry(0.0046, 0.0046, 0.0006, 24), chrome, sx, DECK + 0.0081, sz);
  const lamp = add(new THREE.PlaneGeometry(0.0052, 0.0034), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.36, 0.2), toneMapped: false }), sx - sd.x * 0.0066, DECK + 0.0042, sz - sd.y * 0.0066);
  lamp.rotation.y = Math.atan2(-sd.x, -sd.y); lamp.castShadow = false;

  // ── 피치 조절: 오른쪽의 홈 · 손잡이 · 눈금
  const FZ = 0.022, FX = 0.1925, FL = 0.07;
  add(new THREE.BoxGeometry(0.0036, 0.0006, FL), slot, FX, DECK + 0.0001, FZ).castShadow = false;
  add(new THREE.BoxGeometry(0.0125, 0.0058, 0.0074), alu, FX, DECK + 0.0031, FZ + 0.006);
  add(new THREE.BoxGeometry(0.0127, 0.0006, 0.0009), black, FX, DECK + 0.0061, FZ + 0.006).castShadow = false;
  print(0.011, FL + 0.016, FX - 0.0125, FZ, (x, W, H, px) => {
    x.lineWidth = 0.00035 * px;
    for (let i = 0; i <= 8; i++) { const y = 0.008 * px + (i / 8) * FL * px, long = i % 4 === 0; x.beginPath(); x.moveTo(W, y); x.lineTo(W - (long ? 0.0044 : 0.0026) * px, y); x.stroke(); }
    x.font = `700 ${0.0023 * px}px ${SANS}`; x.textAlign = "left";
    x.fillText("+", 0.0006 * px, 0.008 * px); x.fillText("0", 0.0006 * px, 0.008 * px + FL * px / 2); x.fillText("–", 0.0006 * px, 0.008 * px + FL * px);
  });
  print(0.02, 0.004, FX - 0.004, FZ - FL / 2 - 0.0075, (x, W, H, px) => { x.font = `700 ${0.0024 * px}px ${SANS}`; spaced(x, "PITCH", W / 2, H / 2, 0.0006 * px); });

  // ── 이름: 데크 오른쪽 앞의 인쇄 + 본체 앞면의 금속 명판
  print(0.092, 0.017, 0.098, 0.1418, (x, W, H, px) => {
    x.font = `900 ${0.0086 * px}px "Grooves Display", "Hahmlet", Georgia, serif`; x.fillText("Grooves", W / 2, H * 0.36);
    x.font = `700 ${0.0021 * px}px ${SANS}`; spaced(x, "DIRECT DRIVE  ·  STEREO TURNTABLE  ·  G-33", W / 2, H * 0.84, 0.0006 * px);
  });
  const plate = add(new THREE.BoxGeometry(0.056, 0.0105, 0.0009), M({ color: "#19191b", roughness: 0.4, metalness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.35 }), -0.146, 0.056, 0.1767 + 0.0003);   // 검은 아노다이징 판에 밝은 글자 (은색 판 + 어두운 글자는 어두운 방을 비춰 글자가 안 읽혔음)
  const plateInk = M({ map: keep(printed(0.056, 0.0105, (x, W, H, px) => { x.font = `700 ${0.0036 * px}px ${SANS}`; spaced(x, "GROOVES  G-33", W / 2, H / 2 + 1, 0.0011 * px); })), transparent: true, depthWrite: false, roughness: 0.5, metalness: 0.2 });
  const plateFace = add(new THREE.PlaneGeometry(0.056, 0.0105), plateInk, 0, 0, 0.00052, plate);
  plateFace.castShadow = false;

  // ── 이음 틈: 데크 둘레를 따라 가는 어두운 홈 (본체에 끼워진 판으로 보이게)
  {
    const hx = 0.2082, hz = 0.1599, t = 0.0011, y = DECK - 0.0002;
    for (const [w, d, x, z] of [[hx * 2 + t, t, 0, hz], [hx * 2 + t, t, 0, -hz], [t, hz * 2 + t, hx, 0], [t, hz * 2 + t, -hx, 0]])
      add(new THREE.BoxGeometry(w, 0.0008, d), slot, x, y, z).castShadow = false;
  }

  // ── 나사: 데크 네 귀퉁이 (일자 홈)
  const screw = M({ color: "#6f7176", roughness: 0.3, metalness: 1 });
  for (const [x, z, a] of [[-0.1995, 0.1515, 0.5], [0.1995, 0.1515, -0.9], [-0.1995, -0.1515, 1.3], [0.1995, -0.1515, 0.2]]) {
    add(new THREE.CylinderGeometry(0.0023, 0.0023, 0.0006, 20), screw, x, DECK + 0.0002, z).castShadow = false;
    const s = add(new THREE.BoxGeometry(0.0036, 0.0002, 0.0005), slot, x, DECK + 0.00056, z); s.rotation.y = a; s.castShadow = false;
  }

  return {
    group,
    dispose() {
      for (const m of made) { m.geometry.dispose(); m.removeFromParent(); }
      for (const t of texs) t.dispose();
      led.dispose(); lamp.material.dispose(); group.removeFromParent();
    },
  };
}
