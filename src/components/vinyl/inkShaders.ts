// 잉크 드로잉(인그레이빙) 스타일 바이닐 셰이더
// 모든 색은 sRGB 값을 그대로 vec3(0..1)로 넘긴다 (ShaderMaterial은 colorspace 변환을 하지 않음).

export const NOISE = /* glsl */`
float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise3(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
                 mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                 mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
// 화면 픽셀 기준 두께의 링(선)
float ring(float v, float c, float px){
  float d = abs(v - c) / max(fwidth(v), 1e-6);
  return 1.0 - smoothstep(px - 0.6, px + 0.6, d);
}
// 주기 패턴 위 선: 밀도(0..1)만큼 굵어지고, 너무 촘촘하면 평균 톤으로 페이드(모아레 방지)
float hatch(float coord, float density){
  float fw = fwidth(coord);
  float d = abs(fract(coord) - 0.5);
  float halfW = 0.5 * density;
  float line = 1.0 - smoothstep(halfW - fw, halfW + fw, d);
  line *= step(0.001, density);
  return mix(line, density * 0.8, smoothstep(0.38, 0.8, fw));
}
`

export const discVert = /* glsl */`
varying vec3 vLocal;
varying vec3 vLocalN;
void main(){
  vLocal = position;
  vLocalN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`

export const discFrag = /* glsl */`
precision highp float;
varying vec3 vLocal;
varying vec3 vLocalN;
uniform vec3 uInk, uLabel;
uniform vec3 uCamLocal, uLightLocal;
uniform float uLineFreq, uStreak, uSharp, uRough, uWobble, uBase;
uniform float uTrackCount, uGapWidth, uInnerR, uOuterR, uLabelR, uHoleR, uTopY, uBotY;
${NOISE}

vec4 over(vec4 top, vec4 bottom){ // premultiplied over
  return top + bottom * (1.0 - top.a);
}

void main(){
  vec3 p = vLocal;
  float r = length(p.xz);
  vec2 cs = p.xz / max(r, 1e-5);
  float isSide = 1.0 - smoothstep(0.3, 0.7, abs(vLocalN.y));

  // 손떨림: 반지름을 θ 방향 노이즈로 살짝 흔듦
  float rr = r + (noise3(vec3(cs * 3.0, r * 4.0)) - 0.5) * uWobble;

  // ---- 조명: Kajiya-Kay (홈 방향 = 원주 방향) ----
  vec3 V = normalize(uCamLocal - p);
  // 보이는 면이 항상 카메라를 향하도록 (모델 노멀 방향과 무관)
  vec3 N = isSide > 0.5 ? faceforward(normalize(vLocalN), -V, normalize(vLocalN)) : vec3(0.0, V.y >= 0.0 ? 1.0 : -1.0, 0.0);
  vec3 L = normalize(uLightLocal);
  vec3 T = vec3(-cs.y, 0.0, cs.x);
  vec3 H = normalize(L + V);
  float th = dot(T, H);
  float kk = sqrt(max(0.0, 1.0 - th * th));
  float spec = pow(kk, uSharp) + 0.35 * pow(kk, uSharp * 0.12);
  spec *= smoothstep(0.0, 0.15, dot(N, V)) * smoothstep(-0.1, 0.25, dot(N, L));

  vec4 col = vec4(0.0);

  if (isSide > 0.5) {
    // ---- 옆면: 세로 해칭 + 위/아래 모서리 선 ----
    float a = atan(p.z, p.x) / 6.2831853;
    float shade = 0.35 + 0.45 * (1.0 - max(dot(N, L), 0.0));
    float n = noise3(vec3(cs * 6.0, p.y * 40.0));
    float v = hatch(a * 720.0, clamp(shade + (n - 0.5) * 0.3, 0.0, 1.0) * 0.55);
    float edge = max(ring(p.y, uTopY, 1.1), ring(p.y, uBotY, 1.3));
    float ink = max(v, edge);
    // 홈 영역 경계의 작은 턱은 그냥 선 한 줄처럼
    if (r < uOuterR + 0.01) ink = max(ink, 0.85);
    col = vec4(uInk * ink, ink);
  } else {
    float ink = 0.0;
    vec4 fill = vec4(0.0);

    if (r < uLabelR) {
      // ---- 라벨: 옅은 블루 면 + 동심원 몇 줄 + 테두리 ----
      fill = vec4(uLabel, 1.0) * 0.9;
      float rings = max(ring(rr, uLabelR * 0.91, 0.6), ring(rr, uLabelR * 0.84, 0.5));
      rings = max(rings, ring(rr, uLabelR * 0.42, 0.5));
      rings = max(rings, ring(rr, uLabelR * 0.30, 0.5));
      ink = max(rings * 0.75, ring(r, uLabelR, 1.2));
      ink = max(ink, ring(r, uHoleR, 1.2));
      ink = max(ink, spec * uStreak * 0.12 * hatch(rr * uLineFreq * 0.6, 0.3));
    } else if (r < uInnerR) {
      // ---- 런아웃: 아주 성긴 선 ----
      float n = noise3(vec3(cs * 2.5, r * 70.0));
      float d = clamp(uBase * 0.6 + spec * uStreak * 0.5 + (n - 0.5) * 0.4 * uRough, 0.0, 1.0);
      ink = hatch(rr * uLineFreq * 0.35, d * 0.5) * 0.8;
      ink = max(ink, ring(r, uInnerR, 0.8));
    } else if (r < uOuterR) {
      // ---- grooves: 빛줄기 = 잉크 밀도 ----
      float n = noise3(vec3(cs * 2.2, r * 85.0));          // r로 빠르게, θ로 느리게 → 불꽃 모양 스트로크
      float n2 = noise3(vec3(cs * 9.0, r * 300.0));
      float d = uBase + spec * uStreak;
      d += (n - 0.5) * 0.9 * uRough + (n2 - 0.5) * 0.25 * uRough;
      d = smoothstep(0.08, 0.95, d);

      // 트랙 사이 gap: 해칭 없음 + 경계선
      float span = (uOuterR - uInnerR) / uTrackCount;
      float t = (r - uInnerR) / span;
      float dist = abs(fract(t + 0.5) - 0.5) * span;
      float interior = step(0.5, t) * step(t, uTrackCount - 0.5);
      float gap = interior * (1.0 - smoothstep(uGapWidth * 0.5, uGapWidth * 0.5 + 0.002, dist));
      ink = hatch(rr * uLineFreq, d) * (1.0 - gap);
      float k = floor(t + 0.5);
      if (interior > 0.5) ink = max(ink, ring(r, uInnerR + k * span, 0.7) * 0.9);
    } else {
      // ---- 바깥 테두리 ----
      ink = max(ring(r, uOuterR, 0.7) * 0.8, ring(r, 0.997, 1.4));
    }
    col = over(vec4(uInk * ink, ink), fill);
  }

  gl_FragColor = col;   // premultiplied, 종이 부분은 투명
}`

export const shadowVert = /* glsl */`
varying vec2 vXZ;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vXZ = vec2(position.x, -position.y);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

export const shadowFrag = /* glsl */`
precision highp float;
varying vec2 vXZ;
uniform vec3 uInk;
uniform vec2 uCenter;
uniform vec2 uRadius;
uniform float uShadow, uRough;
${NOISE}
void main(){
  vec2 q = (vXZ - uCenter) / uRadius;
  float len = length(q);
  vec2 cs = q / max(len, 1e-5);
  float n = noise3(vec3(cs * 2.0, len * 14.0));
  float n2 = noise3(vec3(q * 9.0, 3.0));
  float body = 1.0 - smoothstep(0.35, 1.05 + (n - 0.5) * 0.25, len);
  float d = clamp(body * uShadow * 0.75 + (n2 - 0.5) * 0.35 * uRough * body, 0.0, 1.0);
  float scrib = hatch(dot(q, vec2(0.8, 0.6)) * 34.0 + (n2 - 0.5) * 1.6, d * 0.55);
  float lines = max(hatch(len * 16.0 + (n - 0.5) * 1.2, d * 0.4), scrib * smoothstep(0.55, 0.75, n) * body);
  // 바깥으로 퍼지는 몇 줄의 스케치 링
  float halo = 0.0;
  for (int i = 0; i < 3; i++) {
    float R = 1.05 + float(i) * 0.09 + (noise3(vec3(cs * 1.5, float(i))) - 0.5) * 0.06;
    halo = max(halo, ring(len, R, 0.5) * (0.55 - float(i) * 0.15));
  }
  float ink = max(lines, halo * uShadow);
  ink *= 1.0 - smoothstep(1.2, 1.45, len);
  gl_FragColor = vec4(uInk * ink, ink) * 0.45;
}`

export const inkDefaults = {
  lineFreq: 75,      // 선 밀도 (반지름 1당 줄 수)
  streak: 1.1,       // 빛줄기 강도
  sharp: 60,         // 빛줄기 선명도 (클수록 가늘고 날카로움)
  base: 0.1,         // 빛이 없는 곳에도 남는 기본 홈선
  rough: 0.85,       // 스트로크 끝 거칠기 (노이즈 양)
  wobble: 0.0012,    // 손떨림 (반지름 흔들림)
  shadow: 0.45,      // 바닥 그림자 농도
  trackCount: 5,
  gapWidth: 0.006,
  innerR: 0.46,
  outerR: 0.965,
  labelR: 0.3303,
  holeR: 0.0254,
  topY: 0.0,
  botY: -0.0215,
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
