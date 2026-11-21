import * as THREE from 'three';

/* 3D 재킷의 디테일 — Crate(crateEngine) 가 씀. 엔진에 빛 계산이 없어서(MeshBasic) 여기서 셰이더로 그림
   ① 떼어지는 스티커 (NEW IN): 그리드 카드의 CSS 스티커(Digging.module.css .sticker)와 같은 물건을 3D 로
      참고: fablegrounds.com/labs/sticker-peel — 접힌 선을 넘어간 꼭짓점을 원통에 감아 올림(말림), 뒷면은 종이 색
   ② 재킷 마감 (finish): 앞면 위에 덧대는 투명한 판 — 미끄러지는 광택 띠 · 종이 모서리의 밝고 어두운 선 · 가장자리 그늘
   둘 다 안개(scene.fog) · 투명도 · 밝기(uShade)를 재킷과 같이 받음 */

export const PEEL = { rest: 0.09, hover: 0.32, radius: 0.075, dir: 38 };   // 평소 들림 · 마우스를 올렸을 때 (지름 대비) · 말리는 반지름 · 떼어지는 방향(도, 오른쪽 위)
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
  uniform vec2 uLight;
  uniform float uOpacity, uGloss;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv - 0.5;
    // 광택: 비스듬한 밝은 띠(넓은 것 하나 + 가는 것 하나)가 빛(uLight)을 따라 미끄러짐
    float along = dot(q, vec2(0.80, 0.60)) - uLight.x * 0.6 - uLight.y * 0.25;
    float w = (exp(-along * along / 0.035) * 0.15 + exp(-pow(along + 0.34, 2.0) / 0.004) * 0.06) * uGloss;
    // 두꺼운 종이의 모서리: 위 · 왼쪽 끝은 빛을 받아 밝고, 아래 · 오른쪽 끝은 어두움
    float e = 0.010;
    w += max(1.0 - smoothstep(0.0, e, 1.0 - vUv.y), 1.0 - smoothstep(0.0, e, vUv.x)) * 0.30;
    float k = max(1.0 - smoothstep(0.0, e, vUv.y), 1.0 - smoothstep(0.0, e, 1.0 - vUv.x)) * 0.34;
    k += 0.07 * smoothstep(0.30, 0.74, length(q));   // 가장자리로 갈수록 조금 어두움
    float a = clamp(w + k, 0.0, 1.0) * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(w / (w + k + 0.0001)), a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

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

/** 엔진마다 하나: 모양 · 그림은 같이 쓰고, 재질은 판마다 따로 (투명도 · 들림이 판마다 다름) */
export function createSleeveFx({ aniso = 1 } = {}) {
  const stickerGeo = new THREE.PlaneGeometry(1.3, 1.3, 40, 40);   // 지름 1 의 스티커 + 둘레의 그림자 자리
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const map = stickerTexture('NEW IN', aniso);
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
    /** 재킷 마감 한 장: 크기 1 = 재킷 한 변. u.uLight(빛의 자리, -1~1) · u.uGloss(광택 세기) · u.uOpacity */
    finish() {
      const material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLight: { value: new THREE.Vector2() }, uOpacity: { value: 1 }, uGloss: { value: 1 } }]),
        vertexShader: FINISH_VERT, fragmentShader: FINISH_FRAG, transparent: true, depthWrite: false, fog: true,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      return { mesh: new THREE.Mesh(planeGeo, material), u: material.uniforms };
    },
    dispose() { stickerGeo.dispose(); planeGeo.dispose(); map.dispose(); },
  };
}
