import { NOISE } from './inkShaders';
export const LANES = 6;
export const haloFrag = /* glsl */`
precision highp float;
varying vec2 vP;
uniform vec3 uInk;
uniform float uFx, uDir, uRipple, uTime;
uniform float uLane[${LANES}];
${NOISE}
float hash1(float n){ return fract(sin(n * 127.1) * 43758.5453); }

void main(){
  float r = length(vP);
  if (r < 1.0 || r > 2.0) discard;
  float th = atan(vP.y, vP.x);
  vec2 cs = vP / r;
  float fx = uFx;
  float ink = 0.0;

  // ---- 1) 모션 아크 ----
  for (int i = 0; i < ${LANES}; i++) {
    float fi = float(i);
    // 레인은 속도가 오를수록 안쪽부터 하나씩 켜짐
    float laneOn = smoothstep(fi * 0.13, fi * 0.13 + 0.18, fx);
    if (laneOn <= 0.0) continue;
    float R = 1.045 + fi * 0.062 + (noise3(vec3(cs * 2.0, fi * 7.0)) - 0.5) * 0.012;
    float line = ring(r, R, 0.75 + 0.5 * fx);
    if (line <= 0.0) continue;
    float segs = 2.0 + fi;                                   // 바깥 레인일수록 조각 수 증가
    float phi = th + uLane[i] + hash1(fi) * 6.2831853;
    float u = fract(phi * segs / 6.2831853);
    float L = mix(0.06, 0.62, fx) * (1.0 - fi * 0.08);      // 호 길이 = 속도
    float g = clamp(u / L, 0.0, 1.0);
    float inside = step(u, L);
    float head = uDir < 0.0 ? g : 1.0 - g;                    // 진행 방향 앞쪽이 진하고 꼬리는 흐리게
    float stroke = inside * smoothstep(0.0, 0.85, head) * (0.55 + 0.45 * noise3(vec3(cs * 14.0, fi)));
    ink = max(ink, line * stroke * laneOn * (1.0 - fi * 0.1));
  }

  // ---- 2) 사운드 리플 ----
  float rippleOn = smoothstep(0.05, 0.35, fx);
  if (rippleOn > 0.0) {
    float wob = (noise3(vec3(cs * 3.0, uTime * 0.2)) - 0.5) * 0.05;
    float ph = (r - 1.0 + wob) * 5.0 - uRipple;
    float fw = fwidth(ph);
    float d = abs(fract(ph + 0.5) - 0.5);
    float rr = 1.0 - smoothstep(fw * 0.6, fw * 1.6, d);
    float dash = smoothstep(0.35, 0.6, noise3(vec3(cs * 7.0, floor(ph) * 3.1)));  // 끊긴 펜 선
    float fade = (1.0 - smoothstep(1.05, 1.15 + 0.8 * fx, r)) * smoothstep(1.0, 1.04, r);
    ink = max(ink, rr * dash * fade * rippleOn * 0.7);
  }

  // ---- 3) 잉크 튐 ----
  float flickOn = smoothstep(0.55, 0.9, fx);
  if (flickOn > 0.0) {
    vec2 cell = vec2(floor((th + uLane[0]) * 18.0), floor((r - uRipple * 0.08) * 22.0));
    float h = hash1(cell.x * 13.7 + cell.y * 71.3);
    if (h > 0.93) {
      vec2 f = vec2(fract((th + uLane[0]) * 18.0), fract((r - uRipple * 0.08) * 22.0)) - 0.5;
      float dot = 1.0 - smoothstep(0.12, 0.22, length(f * vec2(0.55, 1.0)));
      ink = max(ink, dot * flickOn * (1.0 - smoothstep(1.2, 1.9, r)) * 0.8);
    }
  }

  ink *= 0.85;
  gl_FragColor = vec4(uInk * ink, ink);
}`;
export const haloVert = /* glsl */`
varying vec2 vP;
void main(){
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
