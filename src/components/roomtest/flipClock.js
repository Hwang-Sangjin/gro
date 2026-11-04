// 창가 선반 플립 시계: 보는 사람의 현재 시각을 띄우고, 분(·시)이 바뀌면 윗판이 앞으로 넘어감
// Blender 에서 나눠 둔 판(prop_cs_clock_{hour,min}_{top,bot,flap})을 이름으로 찾아 숫자를 캔버스로 그림
//   top  : 위 반쪽 (UV v 위 반)      — 넘어가는 동안 이미 다음 숫자
//   bot  : 아래 반쪽 (UV v 아래 반)  — 판이 다 넘어올 때까지 지금 숫자
//   flap : 경첩(원점)에 달린 판, 앞면 = 위 반 / 뒷면 = 아래 반 → 그림 위 반 = 지금 숫자, 아래 반 = 다음 숫자
// 시간에 따라 바뀌는 장치라 Blender 클립이 아니라 여기서 돌림 (방 reveal 애니메이션과는 따로)
import * as THREE from "three";

const PREFIX = "prop_cs_clock_";
const S = 256;                      // 숫자 그림 한 장 크기 (Blender 기본 그림과 같은 배치, 축소)
const BG = "#141416", FG = "#eeeae0";
const FLIP = 0.42;                  // 한 장 넘어가는 시간(초)

// 숫자 두 자리 그림. half: "top" | "bot" | "both" — 그 반쪽만 그리고 나머지는 판 색
function draw(ctx, text, ampm, half = "both") {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, S, S);
  ctx.save();
  if (half !== "both") { ctx.beginPath(); ctx.rect(0, half === "top" ? 0 : S / 2, S, S / 2); ctx.clip(); }
  ctx.fillStyle = FG; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(S * 0.62)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(text, S / 2, S * 0.53);
  if (ampm) { ctx.font = `700 ${Math.round(S * 0.075)}px Arial, sans-serif`; ctx.textAlign = "left"; ctx.fillText(ampm, S * 0.06, S * 0.17); }
  ctx.restore();
  ctx.fillStyle = "#050505"; ctx.fillRect(0, S * 0.495, S, S * 0.012);   // 위·아래 판 틈
}
function canvasTex() {
  const c = document.createElement("canvas"); c.width = c.height = S;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4;   // glTF UV 기준
  return { c, ctx: c.getContext("2d"), t };
}
// 판 재질: 원래 재질을 복사해 숫자 그림을 붙이고, 어두운 방에서도 읽히게 같은 그림으로 은은히 발광
function cardMat(src, tex) {
  const m = src.clone();
  m.map = tex; m.emissiveMap = tex; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.55;
  m.needsUpdate = true;
  return m;
}

const fmt = (d) => {
  const h = d.getHours() % 12 || 12;
  return { hour: String(h), min: String(d.getMinutes()).padStart(2, "0"), ampm: d.getHours() < 12 ? "AM" : "PM" };
};

// root 안에서 시계를 찾아 붙임. 없으면 null. update(dt) 를 매 프레임 부르면 됨
// opts.now: 지금 시각을 돌려주는 함수 (확인용으로 빨리 가는 시계를 넣을 수 있음)
export function attachFlipClock(root, opts = {}) {
  const get = (n) => root.getObjectByName(PREFIX + n);
  if (!get("hour_flap")) return null;
  const now = opts.now ?? (() => new Date());
  const units = ["hour", "min"].map((key) => {
    const top = get(`${key}_top`), bot = get(`${key}_bot`), flap = get(`${key}_flap`);
    const T = canvasTex(), B = canvasTex(), F = canvasTex();
    top.material = cardMat(top.material, T.t);
    bot.material = cardMat(bot.material, B.t);
    flap.material = cardMat(flap.material, F.t);
    // 경첩 축 = 판의 "위" 방향을 "앞" 방향으로 돌리는 축 (위 × 앞, 판 로컬). 이 축으로 +180° 돌면 판이 앞으로 넘어감
    //  앞 = 판의 두 면 법선 중 시계 몸체 반대쪽, 위 = 경첩(원점)에서 판 가운데 쪽 (판은 경첩 위로만 뻗어 있음)
    const body = root.getObjectByName("prop_cs_clock");
    body.updateWorldMatrix(true, false); flap.updateWorldMatrix(true, false);
    const bodyLocal = flap.worldToLocal(body.getWorldPosition(new THREE.Vector3()));
    const nrm = flap.geometry.attributes.normal;
    let front = null;
    for (let i = 0; i < nrm.count; i++) { const n = new THREE.Vector3().fromBufferAttribute(nrm, i); if (!front || n.dot(bodyLocal) < front.dot(bodyLocal)) front = n; }
    flap.geometry.computeBoundingBox();
    const up = flap.geometry.boundingBox.getCenter(new THREE.Vector3()).projectOnPlane(front).normalize();
    const axis = new THREE.Vector3().crossVectors(up, front).normalize();
    return { key, top, bot, flap, T, B, F, axis, q0: flap.quaternion.clone(), shown: null, next: null, t: -1 };
  });

  const paint = (u, cur, nxt, ampm) => {
    const a = u.key === "hour" ? ampm : null;
    draw(u.T.ctx, nxt, a, "top"); u.T.t.needsUpdate = true;          // 위: 다음 숫자(넘어가는 판 뒤에서 드러남)
    draw(u.B.ctx, cur, a, "bot"); u.B.t.needsUpdate = true;          // 아래: 판이 덮을 때까지 지금 숫자
    // 넘어가는 판: 위 반 = 지금 숫자, 아래 반 = 다음 숫자
    u.F.ctx.clearRect(0, 0, S, S);
    const tmp = document.createElement("canvas"); tmp.width = tmp.height = S; const tc = tmp.getContext("2d");
    draw(tc, cur, a, "top"); u.F.ctx.drawImage(tmp, 0, 0, S, S / 2, 0, 0, S, S / 2);
    draw(tc, nxt, a, "bot"); u.F.ctx.drawImage(tmp, 0, S / 2, S, S / 2, 0, S / 2, S, S / 2);
    u.F.t.needsUpdate = true;
  };
  const settle = (u, val, ampm) => { u.shown = val; u.next = null; u.t = -1; u.flap.quaternion.copy(u.q0); paint(u, val, val, ampm); };

  const t0 = fmt(now());
  settle(units[0], t0.hour, t0.ampm); settle(units[1], t0.min, t0.ampm);
  const _q = new THREE.Quaternion();
  const ease = (x) => (x < 0.85 ? (x / 0.85) ** 2 : 1 + Math.sin(((x - 0.85) / 0.15) * Math.PI) * 0.035);   // 떨어지듯 빨라지다 끝에서 살짝 튐

  return {
    units,
    update(dt) {
      const f = fmt(now());
      for (const u of units) {
        const want = u.key === "hour" ? f.hour : f.min;
        if (u.t < 0 && want !== u.shown) { u.next = want; u.t = 0; paint(u, u.shown, want, f.ampm); }
        if (u.t >= 0) {
          u.t += dt / FLIP;
          const k = Math.min(u.t, 1);
          u.flap.quaternion.copy(u.q0).multiply(_q.setFromAxisAngle(u.axis, Math.PI * Math.min(ease(k), 1.02)));
          if (u.t >= 1) settle(u, u.next, f.ampm);
        }
      }
    },
  };
}
