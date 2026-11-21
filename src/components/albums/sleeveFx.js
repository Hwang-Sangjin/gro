import * as THREE from 'three';

/* 3D 재킷의 디테일 — Crate(crateEngine) 가 씀. 엔진에 빛 계산이 없어서(MeshBasic) 여기서 셰이더로 그림
   ① 떼어지는 스티커 (NEW IN): 그리드 카드의 CSS 스티커(Digging.module.css .sticker)와 같은 물건을 3D 로
      참고: fablegrounds.com/labs/sticker-peel — 접힌 선을 넘어간 꼭짓점을 원통에 감아 올림(말림), 뒷면은 종이 색
      스티커를 잡고 끌면 떼어짐 (crateEngine): 잡은 가장자리와 손가락 사이의 수직이등분선이 접힌 선 → uDir(떼어지는 방향) · uPeel(접힌 선의 자리)
   ② 재킷 마감 (finish): 앞면 위에 덧대는 투명한 판 — 종이 모서리의 밝고 어두운 선 · 가장자리 그늘, 그리고
      비닐 포장 (uWrap, 2026-11-22): 주름 지도(wrapMap — 판마다 다른 구김)의 표면에 빛을 비춤 → 창이 비친 빛 띠가 주름에서 꺾이고, 비탈마다 밝고 어두움 · 필름의 결 · 가장자리를 감싼 선 · 옅은 흰 막
   둘 다 안개(scene.fog) · 투명도 · 밝기(uShade)를 재킷과 같이 받음 */

// 평소 들림 · 재킷에 마우스를 올렸을 때 · 스티커에 올렸을 때 (지름 대비) · 말리는 반지름 · 떼어지는 방향(도, 오른쪽 위) · 이만큼 넘게 떼고 놓으면 떨어짐
export const PEEL = { rest: 0.09, hover: 0.15, grab: 0.26, radius: 0.075, dir: 38, off: 0.6 };
export const STICKER = { size: 0.2, at: 0.35, tilt: 0.21 };                 // 재킷 한 변 대비 지름 · 가운데에서의 거리(오른쪽 위) · 기울기(rad)
const NEW_MS = 45 * 864e5;   // 들어온 지 45일 안 = NEW IN (lib/albums.js NEW_DAYS 와 같은 기준)
export const isNewIn = (createdAt) => !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_MS;

const FOG_V = '#include <fog_pars_vertex>', FOG_F = '#include <fog_pars_fragment>';

const STICKER_VERT = /* glsl */ `
  #include <common>
  ${FOG_V}
  uniform float uPeel, uRadius;
  uniform vec2 uDir;
  varying vec2 vP;        // 펴져 있을 때의 자리 (지름 = 1)
  varying float vD;       // 접힌 선을 넘어간 거리 (음수 = 아직 붙어 있는 쪽)
  varying float vTheta;   // 감긴 각도
  void main() {
    vec3 p = position;
    vP = p.xy;
    float s = dot(p.xy, uDir), s0 = 0.5 - uPeel, d = s - s0;
    vD = d; vTheta = 0.0;
    if (d > 0.0) {
      // 접힌 선에서부터 반지름 uRadius 의 원통에 감김: 반 바퀴(π)까지는 호를 따라, 그 뒤로는 뒤집힌 채 평평하게 되돌아감
      float th = d / uRadius, ns, z;
      if (th < PI) { ns = s0 + uRadius * sin(th); z = uRadius * (1.0 - cos(th)); }
      else { ns = s0 - (d - PI * uRadius); z = 2.0 * uRadius; }
      p.xy += (ns - s) * uDir; p.z = z;
      vTheta = th;
    }
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const STICKER_FRAG = /* glsl */ `
  #include <common>
  ${FOG_F}
  uniform sampler2D uMap;
  uniform vec3 uBack;
  uniform float uOpacity, uShade, uPeel;
  varying vec2 vP;
  varying float vD;
  varying float vTheta;
  void main() {
    float r = length(vP) * 2.0;                       // 0 가운데 → 1 가장자리
    float disc = 1.0 - smoothstep(1.0 - fwidth(r) * 1.2, 1.0, r);
    vec3 col; float alpha = disc;
    if (gl_FrontFacing) {
      col = texture2D(uMap, vP + 0.5).rgb;
      if (vD <= 0.0) {
        // 들린 조각이 앞면에 드리우는 그늘 (접힌 선 바로 앞)
        col *= 1.0 - 0.34 * clamp(uPeel * 6.0, 0.0, 1.0) * smoothstep(-(0.05 + uPeel * 0.9), 0.0, vD);
        // 스티커가 재킷에 드리우는 그림자 (붙어 있는 부분의 둘레 — 조금 아래 · 오른쪽)
        float sh = 0.32 * (1.0 - smoothstep(0.86, 1.2, length(vP - vec2(0.012, -0.03)) * 2.0));
        col *= disc; alpha = max(disc, sh * (1.0 - disc));
      } else col *= 1.0 - 0.3 * sin(min(vTheta, 1.5708));   // 말려 올라가는 면은 빛을 덜 받음
    } else {
      // 뒷면(종이): 꺾이는 곳이 어둡고, 넘어와 누운 쪽이 밝음 + 말린 등에 걸리는 빛
      float t = clamp(vTheta / PI, 0.0, 1.0);
      col = uBack * (0.66 + 0.34 * smoothstep(0.5, 0.95, t)) + 0.08 * exp(-pow((t - 0.8) / 0.12, 2.0));
    }
    alpha *= uOpacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col * uShade, alpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

const FINISH_VERT = /* glsl */ `
  ${FOG_V}
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FINISH_FRAG = /* glsl */ `
  ${FOG_F}
  uniform sampler2D uWrapMap;   // 비닐의 주름 지도: rg = 표면의 기울기(가로 · 세로), b = 들뜬 높이
  uniform vec2 uLight, uFlip;
  uniform float uOpacity, uGloss, uWrap, uSeed, uTone;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // 가장자리가 또렷한 띠 (가운데 c · 반폭 hw · 가장자리의 번짐 soft) — 비닐에 비친 창
  float band(float x, float c, float hw, float soft) { return smoothstep(c - hw - soft, c - hw, x) - smoothstep(c + hw, c + hw + soft, x); }
  void main() {
    vec2 q = vUv - 0.5;
    // 주름 지도는 몇 장을 뒤집어 가며 같이 씀 (uFlip) → 기울기도 같이 뒤집음
    vec3 m = texture2D(uWrapMap, q * uFlip + 0.5).rgb;
    vec2 g = (m.rg * 2.0 - 1.0) * uFlip * uWrap;
    float film = noise(vUv * vec2(1.6, 11.0) + uSeed);   // 필름의 결: 가로로 긴 옅은 얼룩 (또렷하면 주사선처럼 보임)
    // 광택 = 비닐에 비친 빛. 표면이 기운 만큼 비치는 자리가 밀림 → 띠가 주름을 만나면 꺾이고 끊기며, 굴곡을 따라 울음
    vec2 r = q + g * 0.17;
    float along = dot(r, vec2(0.80, 0.60)) - uLight.x * 0.6 - uLight.y * 0.25;
    float across = dot(r, vec2(-0.60, 0.80));
    float soft = exp(-along * along / 0.035) * 0.15;
    float paper = soft + exp(-pow(along + 0.34, 2.0) / 0.004) * 0.06;   // 비닐이 없을 때: 종이의 부드러운 광택
    float bent = along + 0.035 * sin(across * 5.0 + uSeed);
    float win = band(bent, 0.02, 0.085, 0.02) * (1.0 - 0.8 * band(bent, 0.035, 0.007, 0.006));   // 창 하나 (가운데 창살)
    //  (2026-11-22 세기를 줄임: 어두운 커버에서 띠가 커버를 넓게 덮었음. 어두운 커버일수록 흰 띠가 도드라지므로 uTone 으로 더 줄임)
    float wrap = soft * 0.28 + (win * 0.13 + band(bent, -0.34, 0.02, 0.012) * 0.10 + band(bent, 0.47, 0.03, 0.03) * 0.045)
      * (0.88 + 0.12 * film) * (0.55 + 0.45 * smoothstep(-0.62, 0.05, across));
    float tone = mix(0.55, 1.0, smoothstep(0.08, 0.55, uTone));
    float w = mix(paper, wrap * tone, uWrap) * uGloss;
    // 주름의 입체감: 빛(왼쪽 위)을 향한 비탈은 밝고 등진 비탈은 어두움 — 빛 띠와 상관없이 어디서나 (흰 커버에서도 주름이 보이게)
    float d = -dot(g, vec2(-0.6, 0.8));
    w += (max(d, 0.0) * (0.24 + 0.12 * uGloss) + d * abs(d) * step(0.0, d) * 0.24) * mix(0.7, 1.0, tone);   // 가파른 비탈에는 반짝임이 더 얹힘
    float k = max(-d, 0.0) * 0.30;
    // 비닐에 비친 어두운 것들 (방 안): 넓고 흐린 얼룩이 굴곡을 따라 휘어 보임 — 밝은 커버에서도 비닐이 씌워진 것이 보이게
    vec2 r2 = q + g * 0.30;
    float room = sin(dot(r2, vec2(0.50, -0.86)) * 6.5 + uSeed + 2.4 * noise(r2 * 2.6 + uSeed));
    k += uWrap * 0.055 * smoothstep(0.25, 0.95, room) * (0.5 + 0.5 * uGloss);
    w += uWrap * (0.022 + 0.05 * m.b + 0.012 * smoothstep(0.5, 1.0, film) * uGloss);   // 옅은 흰 막 (들뜬 곳은 더 뿌옇게) + 결에 걸리는 빛
    // 두꺼운 종이의 모서리: 위 · 왼쪽 끝은 빛을 받아 밝고, 아래 · 오른쪽 끝은 어두움
    float e = 0.010;
    w += max(1.0 - smoothstep(0.0, e, 1.0 - vUv.y), 1.0 - smoothstep(0.0, e, vUv.x)) * 0.30;
    k += max(1.0 - smoothstep(0.0, e, vUv.y), 1.0 - smoothstep(0.0, e, 1.0 - vUv.x)) * 0.34;
    k += 0.07 * smoothstep(0.30, 0.74, length(q));   // 가장자리로 갈수록 조금 어두움
    // 비닐이 가장자리를 감싸 넘어가는 선 (네 변 모두, 아주 가늘게)
    float rim = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    w += uWrap * (1.0 - smoothstep(0.002, 0.007, rim)) * 0.22;
    float a = clamp(w + k, 0.0, 1.0) * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(w / (w + k + 0.0001)), a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

/* 비닐의 주름 지도 한 장 (seed 마다 다름) — 높이를 그린 뒤 기울기로 바꿔 담음 (rg = 기울기, b = 높이)
   실제 수축 비닐을 보고 넣은 것들 (2026-11-22, 예전에는 모서리마다 같은 부챗살을 수식으로 그려서 네 모서리가 똑같아 보였음):
   - 필름 전체의 완만한 굴곡 (빛 띠가 곧지 않고 울게 됨)
   - 모서리의 구김: 모서리마다 0~4 줄 — 시작하는 자리 · 방향 · 길이 · 굵기 · 휘는 정도가 제각각. 가끔 한 줄이 길게 뻗음
   - 변에서 안으로 당겨진 짧은 선 몇 줄, 한쪽 변에 몰린 잔주름 한두 무더기
   - 면을 가로지르는 넓고 완만한 주름 1~3 줄
   - 세 장에 한 장꼴로 한쪽 변 가까이의 이음선
   세기는 "기울기" 단위: amp 1 = 가장 가파른 곳의 기울기 1 (셰이더가 이 값으로 빛을 밀고 · 비탈을 밝히고 어둡게 함) */
const WRAP_MAPS = 3, WRAP_SIZE = 512;
function wrapMap(seed, seam = false, N = WRAP_SIZE) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pm = () => rnd() * 2 - 1;
  const H = new Float32Array(N * N);
  // 1) 완만한 굴곡: 길쭉하고 비스듬한 넓은 둔덕 · 꺼진 곳을 흩뿌림 (격자로 만들었더니 칸의 경계가 줄로 비쳐서 바꿈)
  for (let i = 0; i < 16; i++) {
    const cx = rnd(), cy = rnd(), ang = rnd() * Math.PI, c = Math.cos(ang), sn = Math.sin(ang);
    const ra = 0.14 + rnd() * 0.26, rb = ra * (0.3 + rnd() * 0.5), amp = pm() * 0.2 * rb;   // 가장 가파른 곳의 기울기 ≈ 0.17
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = (x + 0.5) / N - cx, py = (y + 0.5) / N - cy, u = (px * c + py * sn) / ra, v = (py * c - px * sn) / rb, d = u * u + v * v;
      if (d < 9) H[y * N + x] += amp * Math.exp(-d);
    }
  }
  // 2) 주름 한 줄: (sx, sy) 에서 ang 방향으로 len 만큼, 굵기 w, 세기 amp(음수 = 골), bend = 가면서 옆으로 휘는 정도
  //    taper: 'start' 시작이 가장 세고 끝으로 갈수록 풀림(모서리 · 변에서 당겨진 것) / 'mid' 가운데가 가장 셈 / 'none' 처음부터 끝까지
  const crease = (sx, sy, ang, len, w, amp, bend = 0, taper = 'start') => {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, pad = w * 5 + Math.abs(bend) * len;
    const ex = sx + dx * len, ey = sy + dy * len;
    const x0 = Math.max(0, Math.floor((Math.min(sx, ex) - pad) * N)), x1 = Math.min(N - 1, Math.ceil((Math.max(sx, ex) + pad) * N));
    const y0 = Math.max(0, Math.floor((Math.min(sy, ey) - pad) * N)), y1 = Math.min(N - 1, Math.ceil((Math.max(sy, ey) + pad) * N));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = (x + 0.5) / N - sx, py = (y + 0.5) / N - sy, t = (px * dx + py * dy) / len;
      if (t < -0.06 || t > 1.02) continue;
      const tc = Math.min(1, Math.max(0, t));
      const env = taper === 'none' ? 1 : taper === 'mid' ? Math.sin(Math.PI * tc) ** 0.9 : (1 - tc) ** 1.5 * Math.min(1, (t + 0.06) / 0.06);
      const wt = taper === 'start' ? w * (0.55 + 1.1 * tc) : w;                // 당겨진 주름은 풀리면서 넓어짐
      const d = (px * nx + py * ny - bend * len * tc * tc) / wt;
      if (d > 4 || d < -4) continue;
      H[y * N + x] += ((amp * w) / 0.858) * env * Math.exp(-d * d);
    }
  };
  // 3) 모서리의 구김: 모서리마다 줄 수가 다름 (없기도 함)
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const ix = cx ? -1 : 1, iy = cy ? -1 : 1, diag = Math.atan2(iy, ix), r = rnd();
    const count = r < 0.08 ? 0 : r < 0.28 ? 1 : r < 0.56 ? 2 : r < 0.8 ? 3 : r < 0.93 ? 4 : 5;
    for (let k = 0; k < count; k++) {
      const off = rnd() * rnd() * 0.13, onX = rnd() < 0.5, long = rnd() < 0.22;
      const x = cx + (onX ? ix * off : ix * 0.004), y = cy + (onX ? iy * 0.004 : iy * off), ang = diag + pm() * 0.68;
      const len = long ? 0.28 + rnd() * 0.42 : 0.06 + rnd() * rnd() * 0.26, w = (0.0045 + rnd() * 0.008) * (long ? 1.5 : 1);
      const amp = (0.5 + rnd() * 0.5) * (rnd() < 0.22 ? -1 : 1), bend = pm() * 0.34;
      crease(x, y, ang, len, w, amp, bend);
      // 가끔 바로 옆에 나란한 짝 (비닐이 접혀 두 겹으로 잡힌 자국)
      if (rnd() < 0.45) { const g = (0.008 + rnd() * 0.012) * (rnd() < 0.5 ? -1 : 1); crease(x - Math.sin(ang) * g, y + Math.cos(ang) * g, ang + pm() * 0.09, len * (0.45 + rnd() * 0.4), w * 0.8, amp * 0.7, bend); }
    }
  }
  // 변: 가운데 0 아래 · 1 오른쪽 · 2 위 · 3 왼쪽. t = 변을 따라간 자리 → 시작점과 안쪽을 향한 방향
  const edge = (e, t) => (e === 0 ? [t, 0.003, Math.PI / 2] : e === 1 ? [0.997, t, Math.PI] : e === 2 ? [t, 0.997, -Math.PI / 2] : [0.003, t, 0]);
  // 4) 변에서 안으로 당겨진 짧은 선
  for (let i = 2 + Math.floor(rnd() * 4); i > 0; i--) {
    const [x, y, base] = edge(Math.floor(rnd() * 4), 0.12 + rnd() * 0.76);
    crease(x, y, base + pm() * 0.9, 0.04 + rnd() * 0.16, 0.004 + rnd() * 0.005, 0.35 + rnd() * 0.45, pm() * 0.3);
  }
  // 5) 한쪽 변에 몰린 잔주름 (비닐이 남아 겹친 곳)
  for (let i = rnd() < 0.78 ? (rnd() < 0.35 ? 2 : 1) : 0; i > 0; i--) {
    const e = Math.floor(rnd() * 4), gap = 0.011 + rnd() * 0.012, lean = pm() * 0.3;
    let t = 0.1 + rnd() * 0.6;
    for (let j = 5 + Math.floor(rnd() * 6); j > 0 && t < 0.95; j--) {
      const [x, y, base] = edge(e, t);
      crease(x, y, base + lean + pm() * 0.12, 0.02 + rnd() * 0.05, 0.0034 + rnd() * 0.0024, 0.4 + rnd() * 0.4);
      t += gap * (0.7 + rnd() * 0.6);
    }
  }
  // 6) 면을 가로지르는 넓고 완만한 주름
  for (let i = 2 + Math.floor(rnd() * 3); i > 0; i--)
    crease(0.08 + rnd() * 0.5, 0.08 + rnd() * 0.84, pm() * 1.1, 0.35 + rnd() * 0.45, 0.012 + rnd() * 0.02, (0.24 + rnd() * 0.26) * (rnd() < 0.4 ? -1 : 1), pm() * 0.3, 'mid');
  // 7) 이음선: 비닐을 붙인 자리 — 한쪽 변 가까이의 곧은 두 줄 (seam: 세 장에 한 장)
  if (seam) { const u = 0.945 + rnd() * 0.02; crease(u, -0.02, Math.PI / 2, 1.04, 0.0026, 0.5, 0, 'none'); crease(u + 0.007, -0.02, Math.PI / 2, 1.04, 0.0022, -0.28, 0, 'none'); }
  // 높이 → 기울기 (가운데 차분). 0~255 로 담음
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, xa = Math.max(0, x - 1), xb = Math.min(N - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(N - 1, y + 1);
    const gx = ((H[y * N + xb] - H[y * N + xa]) * N) / (xb - xa), gy = ((H[yb * N + x] - H[ya * N + x]) * N) / (yb - ya);
    out[i * 4] = Math.max(0, Math.min(255, Math.round((gx * 0.5 + 0.5) * 255)));
    out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((gy * 0.5 + 0.5) * 255)));
    out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(H[i] * 90 * 255)));
    out[i * 4 + 3] = 255;
  }
  return out;
}

// 스티커 앞면 그림 (동그라미 모양은 셰이더가 오려 냄 → 여기는 네모 가득 칠함)
function stickerTexture(label, aniso) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#d9542c'; g.fillRect(0, 0, 256, 256);
  // 테두리 두 줄 (CSS 의 안쪽 그림자 두 겹과 같은 모양)
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 7; g.beginPath(); g.arc(128, 128, 123, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.38)'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 109, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff7ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 41px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  try { g.letterSpacing = '5px'; } catch {}
  g.fillText(label, 128 + 2, 131);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

export const WRAP = { maps: WRAP_MAPS, size: WRAP_SIZE };
/** 주름 지도 i 번째(0 ~ WRAP.maps-1)를 노멀 그림(RGBA, 접선 공간)으로 — Home hero 의 재킷이 코팅 층의 요철로 씀 (sleeveParts.js)
 *  k = 기울기를 얼마나 살릴지 (1 = 가장 가파른 주름이 45°) */
export function wrapNormalData(i, k = 0.6) {
  const g = wrapMap(7 + i * 3, i === 1), n = g.length / 4, out = new Uint8Array(g.length);
  for (let p = 0; p < n; p++) {
    const x = -(g[p * 4] / 127.5 - 1) * k, y = -(g[p * 4 + 1] / 127.5 - 1) * k, l = Math.hypot(x, y, 1);
    out[p * 4] = Math.round((x / l * 0.5 + 0.5) * 255); out[p * 4 + 1] = Math.round((y / l * 0.5 + 0.5) * 255); out[p * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); out[p * 4 + 3] = 255;
  }
  return out;
}

/** 엔진마다 하나: 모양 · 그림은 같이 쓰고, 재질은 판마다 따로 (투명도 · 들림이 판마다 다름) */
export function createSleeveFx({ aniso = 1 } = {}) {
  const stickerGeo = new THREE.PlaneGeometry(1.3, 1.3, 40, 40);   // 지름 1 의 스티커 + 둘레의 그림자 자리
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const map = stickerTexture('NEW IN', aniso);
  // 주름 지도: 처음에는 평평한 한 점짜리 → 한 장씩 틈틈이 만들어 채움 (한 장에 수십 ms). 판마다 한 장을 골라 가로 · 세로로 뒤집어 씀 → 12 가지
  let alive = true;
  const wraps = Array.from({ length: WRAP_MAPS }, (_, i) => {
    const t = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    setTimeout(() => {
      if (!alive) return;
      t.image = { data: wrapMap(7 + i * 3, i === 1), width: WRAP_SIZE, height: WRAP_SIZE };
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = aniso;
      t.needsUpdate = true;
    }, 60 + i * 90);
    return t;
  });
  const dir = (PEEL.dir * Math.PI) / 180;
  return {
    /** 스티커 한 장: 크기 1 = 지름. u.uPeel(들림) · u.uOpacity · u.uShade(밝기) 를 매 프레임 넣음 */
    sticker() {
      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
          uMap: { value: null }, uBack: { value: new THREE.Color('#f1e6cf') }, uDir: { value: new THREE.Vector2(Math.cos(dir), Math.sin(dir)) },
          uPeel: { value: PEEL.rest }, uRadius: { value: PEEL.radius }, uOpacity: { value: 1 }, uShade: { value: 1 },
        }]),
        vertexShader: STICKER_VERT, fragmentShader: STICKER_FRAG, transparent: true, side: THREE.DoubleSide, fog: true,
      });
      material.uniforms.uMap.value = map;
      return { mesh: new THREE.Mesh(stickerGeo, material), u: material.uniforms };
    },
    /** 재킷 마감 한 장: 크기 1 = 재킷 한 변. u.uLight(빛의 자리, -1~1) · u.uGloss(광택 세기) · u.uOpacity · u.uWrap(비닐 포장 0~1). 주름은 wrapFor 로 판마다 고름 */
    finish() {
      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLight: { value: new THREE.Vector2() }, uFlip: { value: new THREE.Vector2(1, 1) }, uWrapMap: { value: null }, uOpacity: { value: 1 }, uGloss: { value: 1 }, uWrap: { value: 1 }, uSeed: { value: 0 }, uTone: { value: 0.5 } }]),
        vertexShader: FINISH_VERT, fragmentShader: FINISH_FRAG, transparent: true, depthWrite: false, fog: true,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      material.uniforms.uWrapMap.value = wraps[0];
      return { mesh: new THREE.Mesh(planeGeo, material), u: material.uniforms };
    },
    /** 이 판의 비닐: n(판마다 다른 정수)으로 주름 지도와 뒤집는 방향을 고름 · tone = 커버의 밝기 0~1 (어두우면 빛 띠를 줄임) */
    wrapFor(finish, n, tone = 0.5) {
      finish.u.uTone.value = tone;
      finish.u.uWrapMap.value = wraps[n % WRAP_MAPS];
      finish.u.uFlip.value.set((n >> 3) & 1 ? -1 : 1, (n >> 4) & 1 ? -1 : 1);
      finish.u.uSeed.value = (n % 1000) / 37;
    },
    dispose() { alive = false; stickerGeo.dispose(); planeGeo.dispose(); map.dispose(); for (const t of wraps) t.dispose(); },
  };
}
