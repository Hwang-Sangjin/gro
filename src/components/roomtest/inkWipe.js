// 섹션 배경 전환 — 화면에 붙어 있는 캔버스 한 장이 모든 섹션의 바탕색을 그림 (섹션 DOM 은 투명)
// 판(kind 1, 2026-11-15 다시 그림): 커다란 레코드 판이 한 점(턴테이블)에서 퍼져 나가며 안쪽이 뚫림
//  - 반지름 R 안쪽 = 다음 색(늦은 밤의 방은 뚫림 → 방이 비침). 라벨 자리에 방이 보이는 셈
//  - R ~ R + vinyl 사이 = 검은 비닐 면: 아주 촘촘한 홈(화면에서 2~3px 간격), 트랙 사이의 매끈한 띠,
//    한 방향 빛에 생기는 X 자 반사(판이 돌아도 반사는 제자리), 안쪽 라벨 테두리와 바깥 가장자리의 얇은 하이라이트
//  - 바깥 가장자리 아래로 부드러운 그림자 (앞 섹션 위에 판이 놓인 느낌)
//  - 바깥쪽 OUTER 만큼은 꽉 찬 면이 아니라 홈이 하나씩 새겨지는 고리(예전 무늬): 바깥일수록 가는 선, 한쪽 끝에서 그어지며 굵어져 면에 붙음
//    → 판이 퍼지며 바깥 가장자리가 계속 새겨지는 모양 (2026-11-15 사용자: 예전 마스크 느낌 + 지금 판을 섞어 달라)
//
// 슬리브(kind 2, 2026-11-15): 다음 섹션이 커다란 종이 레코드 재킷처럼 아래에서 밀려 올라와 앞 섹션을 덮음
//  - 처음엔 화면보다 조금 좁고 살짝 기울어 있다가, 올라오면서 화면 폭에 맞게 펴짐 (물건이 들어오는 느낌)
//  - 위 가장자리: 잘린 종이의 밝은 단면 + 두께 + 입구 쪽 그늘, 모서리는 살짝 둥글고 종이 섬유가 보임
//  - 그 위로 부드러운 그림자, 덮이는 앞 섹션은 조금 어두워짐
//
//  set(list): list[i] = { kind: 1 고리 | 2 슬리브 | 3 창, ... } 또는 null(아직 화면에 닿지 않음)
//   창:     { cx, cy, hw, hh, r, rgba } — 가운데 · 반폭 · 반높이 · 모서리 둥글기 (화면 높이 = 1). 늦은 밤의 방 (2026-11-16)
//   고리:   { cx, cy, R, a0, aw, rgba }
//   슬리브: { top, inset, angle, dim, rgba } — top = 윗변 높이(화면 아래 0 … 위 1), inset = 좌우로 들어온 정도(화면 폭 비율),
//           angle = 기울기(rad), dim = 앞 섹션을 어둡게 하는 정도
//    cx·cy = 중심 (화면 높이 = 1 인 단위, 왼쪽 아래가 0,0 · 화면 밖이어도 됨), R = 꽉 찬 반지름 (같은 단위)
//    a0·aw = 화면에 보이는 호의 시작 각 · 폭(rad). 고리가 이 범위를 따라 그어짐. aw ≥ 2π 면 온 원(고리마다 시작점이 다름)
//    rgba = 그 안쪽 색 (0…1). a = 0 이면 뚫려서 뒤(3D 방)가 비침
//  순서대로 덧칠됨 → 뒤 섹션의 색이 앞 섹션 색 위로 올라옴

export const WIPE = {
  vinyl: 0.3,     // 판(kind 1)의 비닐 면 폭 (화면 높이 대비)
  groove: 2.6,    // 홈 간격 (화면 px)
  tracks: 5,      // 트랙 수 (사이에 매끈한 띠)
  outer: 0.42,    // 비닐 면 중 바깥쪽 이 비율은 새겨지는 고리로 (0 = 꽉 찬 판만)
  ring: 0.014,    // 새겨지는 고리 하나의 폭 (화면 높이 대비)
  lead: 0.45,     // 다음 색이 섹션 윗변보다 먼저 올라오는 최대 높이 (화면 높이 대비). 섹션 사이 빈 여백(45svh)과 같은 값
  sag: 0.26,      // 큰 원(화면 아래 멀리 중심)의 호가 화면 폭에서 휘는 높이. sag + band ≤ lead 여야 앞 섹션 글 위로 번지지 않음
  grain: 0.014,   // 가장자리 잉크 번짐 세기
  dprMax: 2,
};
// 슬리브 전환 조정 값
export const SLEEVE = {
  lift: 0.18,     // 슬리브 윗변이 섹션 윗변보다 먼저 올라오는 높이 (화면 높이 대비). 기울기·그림자까지 더해도 lead(0.45) 안
  inset: 0.07,    // 처음 좁은 정도: 좌우 각각 화면 폭의 이만큼 안쪽에서 시작
  tilt: 0.045,    // 처음 기울기(rad, 약 2.6°). 섹션마다 방향을 번갈아
  settle: 0.55,   // 윗변이 화면 높이의 이만큼 올라오면 폭·기울기가 다 펴짐
  dim: 0.1,       // 다 덮일 무렵 앞 섹션이 어두워지는 정도
  radius: 0.012,  // 모서리 둥글기 (화면 높이 대비)
  shadow: 0.05,   // 그림자 번지는 거리 (화면 높이 대비)
};
export const WIPE_BAND = WIPE.vinyl;
const MAX = 4;   // 한 페이지의 경계 수

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec3 uCen[${MAX}];   // 고리: cx, cy, R · 슬리브: top, inset, angle · 창: cx, cy, 반폭
uniform vec2 uAng[${MAX}];   // 고리: a0, aw · 슬리브: dim, - · 창: 반높이, 모서리 둥글기
uniform vec4 uC[${MAX}];
uniform float uOn[${MAX}];   // 0 꺼짐 · 1 고리 · 2 슬리브 · 3 창
uniform float uGrain;
const float BAND = ${WIPE_BAND.toFixed(4)};
const float GROOVE = ${WIPE.groove.toFixed(2)};
const float TRACKS = ${WIPE.tracks.toFixed(1)};
const float OUTER = ${WIPE.outer.toFixed(3)};
const float RW = ${WIPE.ring.toFixed(4)};
const float SR = ${SLEEVE.radius.toFixed(4)}, SSH = ${SLEEVE.shadow.toFixed(4)};

float fwidthSafe(float v){ return 0.; }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
  vec2 u = f * f * (3. - 2. * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1. - u.x) + (d - b) * u.x * u.y;
}
void main(){
  vec2 p = vec2(vUv.x * uRes.x / uRes.y, vUv.y);
  float px = 1. / uRes.y;
  // 잉크 번짐: 굵은 결 + 잔 결
  float grain = ((vnoise(p * 11.) - .5) + (vnoise(p * 47.) - .5) * .6) * uGrain;
  float asp = uRes.x / uRes.y;
  vec4 c = vec4(0.);   // premultiplied (rgb × a)
  for (int i = 0; i < ${MAX}; i++){
    if (uOn[i] < .5) continue;
    if (uOn[i] > 2.5) {
      // ── 창 (kind 3): 둥근 사각형 구멍. 종이(앞 섹션 색)를 오려 낸 자리로 뒤(3D 방)가 비침
      vec2 wq = abs(p - uCen[i].xy) - vec2(uCen[i].z, uAng[i].x) + uAng[i].y;
      float wd = length(max(wq, 0.)) + min(max(wq.x, wq.y), 0.) - uAng[i].y;   // 구멍까지 거리 (안쪽 -)
      float wm = 1. - smoothstep(-px * .75, px * .75, wd);
      float cut = (1. - wm) * (1. - smoothstep(0., px * 2.5, wd));             // 오려 낸 종이의 밝은 단면
      c.rgb = mix(c.rgb, vec3(c.a), cut * .22);
      c = mix(c, vec4(uC[i].rgb * uC[i].a, uC[i].a), wm);
      float wsh = wm * exp(-max(-wd, 0.) / .018) * .5;                          // 종이 두께가 방 위에 드리우는 그늘
      c = vec4(0., 0., 0., wsh) + c * (1. - wsh);
      continue;
    }
    if (uOn[i] > 1.5) {
      // ── 슬리브
      float top = uCen[i].x, inset = uCen[i].y, ang = uCen[i].z;
      vec2 q = p - vec2(asp * .5, top);
      float cs = cos(ang), sn = sin(ang);
      q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);   // 슬리브 기준 좌표 (윗변 가운데가 0,0, 아래로 -)
      float hw = asp * .5 + .03 - inset * asp;               // 반폭 (다 펴지면 화면보다 조금 넓어 옆 모서리는 안 보임)
      vec2 dq = abs(q - vec2(0., -1.5)) - vec2(hw, 1.5) + SR;
      float sd = length(max(dq, 0.)) + min(max(dq.x, dq.y), 0.) - SR;   // 둥근 사각형까지 거리 (안쪽 -)
      sd += (vnoise(p * 260.) - .5) * .0011;                 // 종이 가장자리의 아주 잔 섬유
      float m = 1. - smoothstep(-px * .75, px * .75, sd);
      // 덮이는 앞 섹션: 조금 어둡게 + 슬리브 그림자 (위·옆으로 부드럽게)
      c.rgb *= 1. - uAng[i].x;
      float sh = (1. - m) * exp(-max(sd, 0.) / (SSH * .3)) * .3;
      c = vec4(0., 0., 0., sh) + c * (1. - sh);
      // 종이: 결(가로로 긴 섬유) + 얼룩
      vec3 col = uC[i].rgb;
      col *= 1. + (vnoise(p * vec2(340., 150.)) - .5) * .016 + (vnoise(p * 55.) - .5) * .014;   // 은은하게 (세면 헤어라인 금속처럼 보임)
      // 가장자리: 밝은 단면 → 살짝 어두운 두께 → 입구 쪽 그늘
      float dIn = -sd;
      float cut = 1. - smoothstep(0., px * 2.2, dIn);
      float lip = smoothstep(px * 2.2, px * 3.5, dIn) * (1. - smoothstep(px * 5., px * 11., dIn));
      col = mix(col, vec3(1.), cut * .32);
      col *= 1. - lip * .12;
      col *= 1. - .07 * exp(-max(-q.y, 0.) / .035);
      c = mix(c, vec4(col * uC[i].a, uC[i].a), m);
      continue;
    }
    // ── 판
    vec2 q = p - uCen[i].xy;
    float R = uCen[i].z;
    float d = length(q);
    float m = d <= R ? 1. : 0.;                         // 안쪽: 다음 색 (뚫림이면 방)
    float t = (d - R) / BAND;                           // 비닐 면 안에서 0(라벨 쪽) … 1(바깥 가장자리)
    // 바깥 그림자: 판이 앞 섹션 위에 놓인 느낌
    float solidEnd = R + BAND * (1. - OUTER);           // 꽉 찬 면이 끝나는 반지름 (그 바깥은 새겨지는 고리)
    float shOut = d > solidEnd ? exp(-(d - solidEnd) / .03) * .3 : 0.;
    c = vec4(0., 0., 0., shOut) + c * (1. - shOut);
    if (t > 0. && t < 1.) {
      float ang = atan(q.y, q.x);
      // 홈: 화면 px 간격의 아주 가는 동심원 (안티에일리어싱: 간격이 픽셀보다 작아지면 평균으로)
      float gp = d / (px * GROOVE);
      float groove = .5 + .5 * cos(gp * 6.2832);
      float fw = fwidthSafe(gp);
      groove = mix(groove, .5, clamp(fw * 1.5, 0., 1.));
      // 트랙 사이 매끈한 띠 (홈이 없고 조금 더 반짝임)
      float tt = fract(t * TRACKS);
      float gap = (1. - smoothstep(.0, .025, tt)) + smoothstep(.975, 1., tt);
      gap *= step(.06, t) * step(t, .96);
      // 빛 반사: 판 위 한 방향 빛 → 서로 마주 보는 두 갈래(X 자). 홈 결이 반사를 잘게 쪼갬
      float l1 = pow(abs(cos(ang - .62)), 7.);
      float l2 = pow(abs(cos(ang + .95)), 12.) * .6;
      // 반사는 홈 결을 따라 잘게 일렁임 (판마다 다른 반사 띠)
      float ripple = .75 + .25 * sin(d * 38. + ang * 2.);
      float sheen = (l1 + l2) * ripple * (.45 + .55 * groove) * (1. - gap * .5);
      vec3 vin = vec3(.055, .050, .062) * (.7 + .6 * groove * (1. - gap));
      vin += vec3(.70, .66, .74) * sheen * .32;
      vin += vec3(.32, .30, .34) * gap * (l1 + l2 + .15) * .35;   // 트랙 사이 띠: 매끈해서 빛이 길게
      // 가장자리: 안쪽 라벨 테두리(가는 밝은 선 + 매끈한 런아웃) · 바깥 둥근 모서리 하이라이트
      float inner = 1. - smoothstep(0., px * 2.5, d - R);
      float runout = smoothstep(.0, .05, t) * (1. - smoothstep(.05, .09, t));
      vin = mix(vin, vec3(.05, .045, .055), runout * .7);
      vin += vec3(.55, .5, .45) * inner * .55;
      // 칠할 곳: 안쪽은 꽉 찬 면, 바깥 OUTER 는 새겨지는 고리 (예전 홈 무늬: 바깥 고리일수록 가는 선 · 한쪽 끝에서 그어짐)
      float mv = 1.;
      if (d > solidEnd) {
        float dd = d - solidEnd, zone = BAND * OUTER;
        float k = floor(dd / RW);
        float age = clamp(1. - (k + 1.) * RW / zone, 0., 1.);          // 1 = 면에 붙음 … 0 = 막 새겨지기 시작
        float h = hash(vec2(k, float(i) + 3.));
        float th = mix(.10 + h * .12, 1.04, smoothstep(0., 1., pow(age, mix(.8, 1.5, h))));
        float fr = abs(fract(dd / RW) - .5) * 2.;
        float e = px * 2.4 / RW;
        float s = fract((ang + 3.14159) / 6.28318 + h);
        float f = age * 2.6 + (h - .5) * .3;
        float tip = smoothstep(0., .06, f - s);
        float radial = 1. - smoothstep(th - e, th + e, fr);
        float radialTip = 1. - smoothstep(th * tip - e, th * tip + e, fr);
        mv = min(radial, radialTip) * step(s, f);
      }
      c = mix(c, vec4(vin, 1.), mv);
      continue;
    }
    c = mix(c, vec4(uC[i].rgb * uC[i].a, uC[i].a), m);
  }
  gl_FragColor = c;
}`;

export function createInkWipe(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error("ink wipe shader", gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // 화면을 덮는 삼각형 하나
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n) => gl.getUniformLocation(prog, n);
  const uRes = u("uRes"), uCen = u("uCen"), uAng = u("uAng"), uC = u("uC"), uOn = u("uOn");
  gl.uniform1f(u("uGrain"), WIPE.grain);
  gl.clearColor(0, 0, 0, 0);

  const cen = new Float32Array(MAX * 3), ang = new Float32Array(MAX * 2), col = new Float32Array(MAX * 4), on = new Float32Array(MAX);
  let key = "";
  const draw = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!on.some(Boolean)) return;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform3fv(uCen, cen);
    gl.uniform2fv(uAng, ang);
    gl.uniform4fv(uC, col);
    gl.uniform1fv(uOn, on);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  return {
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, WIPE.dprMax);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; key = ""; }
    },
    set(list) {
      on.fill(0);
      for (let i = 0; i < Math.min(MAX, list.length); i++) {
        const b = list[i];
        if (!b) continue;   // 아직 화면에 닿지 않은 경계
        if (b.kind === 3) { on[i] = 3; cen.set([b.cx, b.cy, b.hw], i * 3); ang.set([b.hh, b.r], i * 2); }
        else if (b.kind === 2) { on[i] = 2; cen.set([b.top, b.inset, b.angle], i * 3); ang.set([b.dim, 0], i * 2); }
        else { on[i] = 1; cen.set([b.cx, b.cy, b.R], i * 3); ang.set([b.a0, b.aw], i * 2); }
        col.set(b.rgba, i * 4);
      }
      // 같은 화면이면 다시 그리지 않음
      const k = [on, cen, ang, col].map((a) => a.join(",")).join("|") + canvas.width + "x" + canvas.height;
      if (k === key) return;
      key = k;
      draw();
    },
    // 컨텍스트는 버리지 않음: 같은 캔버스에서 다시 만들 수 있게 (getContext 는 같은 컨텍스트를 돌려줌)
    dispose() { gl.deleteProgram(prog); gl.deleteBuffer(buf); },
  };
}
