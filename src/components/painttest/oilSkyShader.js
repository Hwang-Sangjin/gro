// 유화 밤하늘 셰이더
// 1) 흐름장: 물결치는 기본 흐름 + 별마다 소용돌이
// 2) 붓결: 흐름선을 따라 노이즈를 적분(LIC) → 흐름 방향으로 길게 늘어난 터치
// 3) 임파스토: 붓결을 높이로 보고 노멀을 뽑아 조명
export const NS = 8;

export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const fragmentShader = /* glsl */ `
precision highp float;
#define NS ${NS}
#define STEPS 16
varying vec2 vUv;
uniform float uTime, uAspect, uLen, uRelief, uSpeed, uResY;
uniform vec3 uLight;
uniform vec4 uStars[NS];   // xy: 자리(uv), z: 반지름, w: 회전 방향(±1 별, ±2 빛 없는 소용돌이)

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y);
}
vec2 starPos(vec4 s) { return (s.xy - .5) * vec2(uAspect, 1.); }

vec2 flow(vec2 p) {
  float a = (vnoise(p * 1.3 + vec2(0., uTime * .015)) - .5) * 2.2 + sin(p.x * 1.7 + p.y * .8) * .35;
  vec2 v = vec2(cos(a), sin(a));
  for (int i = 0; i < NS; i++) {
    vec4 s = uStars[i];
    vec2 d = p - starPos(s);
    float l = length(d) + 1e-4, r = s.z * 2.2;
    float w = exp(-l * l / (r * r)) * 6.;
    // 별은 동심원, 큰 소용돌이만 안쪽으로 말려 들어감
    v += (vec2(-d.y, d.x) / l * sign(s.w) - d / l * step(1.5, abs(s.w)) * .2) * w;
  }
  return normalize(v);
}

// x: 가는 붓털 결, y: 터치 하나의 색 덩어리
vec2 paint(vec2 q) {
  return vec2(vnoise(q * 95.), vnoise(q * 34. + 17.));
}

void main() {
  vec2 p = (vUv - .5) * vec2(uAspect, 1.);

  // 흐름을 따라 흘러가게: 두 위상을 번갈아 섞음
  // 적분 창(붓 하나 길이)을 흐름선 위에서 밀어 움직임을 만듦 → 굽은 흐름에서도 결이 흐름선을 벗어나지 않음
  float t = uTime * uSpeed;
  float f0 = fract(t), f1 = fract(t + .5);
  float w0 = 1. - abs(2. * f0 - 1.), w1 = 1. - w0;
  float c0 = .5 - f0, c1 = .5 - f1;

  vec2 acc0 = vec2(0.), acc1 = vec2(0.);
  float ws0 = 0., ws1 = 0.;
  for (int dir = -1; dir <= 1; dir += 2) {
    vec2 q = p;
    for (int i = 0; i < STEPS; i++) {
      float s = float(dir) * float(i) / float(STEPS);
      vec2 nz = paint(q);
      float k0 = .5 + .5 * cos(3.14159 * clamp((s - c0) * 2., -1., 1.));
      float k1 = .5 + .5 * cos(3.14159 * clamp((s - c1) * 2., -1., 1.));
      acc0 += k0 * nz; ws0 += k0;
      acc1 += k1 * nz; ws1 += k1;
      q += flow(q) * float(dir) * uLen / float(STEPS);
    }
  }
  vec2 n = (w0 * (acc0 / ws0 - .5) + w1 * (acc1 / ws1 - .5)) / sqrt(w0 * w0 + w1 * w1);
  float fine = clamp(n.x * 2.6 + .5, 0., 1.);
  float tone = clamp(n.y * 2.4 + .5, 0., 1.);

  // 별빛
  float glow = 0.;
  for (int i = 0; i < NS; i++) {
    vec4 s = uStars[i];
    if (abs(s.w) > 1.5) continue;
    float l = length(p - starPos(s));
    glow = max(glow, exp(-l * l / (s.z * s.z * .8)));
  }

  // 색: 남색 → 울트라마린 → 코발트 → 옅은 하늘색, 별 둘레는 노랑
  vec3 col = mix(vec3(.035, .07, .22), vec3(.09, .22, .62), smoothstep(.1, .45, tone));
  col = mix(col, vec3(.2, .42, .8), smoothstep(.45, .7, tone));
  col = mix(col, vec3(.58, .73, .86), smoothstep(.74, .95, tone));
  float y = glow + (tone - .5) * .5 * smoothstep(.02, .2, glow);
  col = mix(col, vec3(.93, .87, .56), smoothstep(.3, .52, y));
  col = mix(col, vec3(.96, .78, .2), smoothstep(.55, .8, y));
  col = mix(col, vec3(.93, .55, .1), smoothstep(.95, 1.15, y));
  col *= .82 + .32 * fine;

  // 임파스토: 높이 → 노멀 → 조명
  float h = fine * .7 + tone * .3;
  vec2 g = vec2(dFdx(h), dFdy(h)) * uRelief * uResY / 900.;
  vec3 N = normalize(vec3(-g, 1.));
  vec3 L = normalize(uLight);
  float shade = 1. + (dot(N, L) - L.z) * 1.2;
  float spec = pow(max(dot(N, normalize(L + vec3(0, 0, 1))), 0.), 40.) * .3;
  gl_FragColor = vec4(col * shade + spec * vec3(1., .97, .9), 1.);
}`;
