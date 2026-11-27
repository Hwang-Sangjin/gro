// 파편 껍질 효과의 뼈대 (모델과 무관 — 어떤 BufferGeometry 든 넣을 수 있음)
//
// 1) buildShards(geometry)  : 삼각형 하나 = 파편 하나가 되게 지오메트리를 풀고,
//                             파편마다 "제자리(중심)·면 방향"을 텍스처 한 칸에 적음
// 2) createShardSim(...)    : 파편마다 "지금 얼마나 밀려나 있는가"를 텍스처에 들고 매 프레임 GPU 에서 갱신
//                             (커서 둘레 구 안에 있으면 구 표면까지 밀려남 → 커서가 떠나면 잠깐 머물다 천천히 복귀)
// 3) createShardMaterial(...): 껍질 재질. 버텍스 셰이더가 2) 의 텍스처를 읽어 삼각형을 통째로 옮기고 돌림
import * as THREE from "three";

// ── 1) 지오메트리 ───────────────────────────────────────────────
export function buildShards(source) {
  // 삼각형끼리 꼭짓점을 나눠 쓰지 않게 풀어야 조각이 따로 움직임
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const pos = geometry.attributes.position;
  const count = pos.count / 3;                       // 파편 수
  const size = Math.ceil(Math.sqrt(count));          // 상태 텍스처 한 변 (파편 하나 = 한 칸)

  const restData = new Float32Array(size * size * 4);   // xyz = 파편 중심, w = 난수
  const faceData = new Float32Array(size * size * 4);   // xyz = 면 방향,   w = 난수
  const aCentroid = new Float32Array(pos.count * 3);
  const aRef = new Float32Array(pos.count * 2);         // 이 꼭짓점이 읽을 텍스처 칸
  const aRand = new Float32Array(pos.count * 3);

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const mid = new THREE.Vector3(), n = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();

  for (let t = 0; t < count; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    mid.copy(a).add(b).add(c).divideScalar(3);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();

    const r1 = Math.random(), r2 = Math.random(), r3 = Math.random();
    restData.set([mid.x, mid.y, mid.z, r1], t * 4);
    faceData.set([n.x, n.y, n.z, r2], t * 4);

    const u = ((t % size) + 0.5) / size;
    const v = (Math.floor(t / size) + 0.5) / size;
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      aCentroid.set([mid.x, mid.y, mid.z], i * 3);
      aRef.set([u, v], i * 2);
      aRand.set([r1, r2, r3], i * 3);
    }
  }

  geometry.setAttribute("aCentroid", new THREE.BufferAttribute(aCentroid, 3));
  geometry.setAttribute("aRef", new THREE.BufferAttribute(aRef, 2));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(aRand, 3));

  const tex = (data) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  };

  return { geometry, count, size, restTexture: tex(restData), faceTexture: tex(faceData) };
}

// ── 2) 밀려남 계산 (GPU, 파편 하나 = 한 픽셀) ─────────────────────
const SIM_FRAG = /* glsl */ `
  uniform sampler2D uPrev;     // 지난 프레임: xyz = 밀려난 만큼, w = 머무는 시간(1 → 0)
  uniform sampler2D uRest;
  uniform sampler2D uFace;
  uniform vec2 uRes;
  uniform vec3 uMouse;         // 커서가 닿은 표면 위 점 (모델 좌표)
  uniform float uRadius;       // 밀어내는 구의 반지름
  uniform float uDt;
  uniform float uOut;          // 밀려나는 빠르기
  uniform float uBack;         // 돌아오는 빠르기
  uniform float uHold;         // 돌아오기 전에 떠 있는 시간(초)

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec4 rest = texture2D(uRest, uv);
    vec4 face = texture2D(uFace, uv);
    vec4 prev = texture2D(uPrev, uv);

    // 커서 → 파편 방향. 한가운데 조각은 방향이 없으므로 표면을 따라 아무 방향이나 조금 섞음
    // (면 방향을 섞으면 가운데 조각들이 카메라 쪽으로 튀어나와 구멍을 가림)
    vec3 any = normalize(vec3(rest.w, face.w, fract(rest.w * 7.13 + face.w * 3.71)) - 0.5 + 1e-3);
    vec3 d = rest.xyz - uMouse + cross(face.xyz, any) * uRadius * 0.06;
    float dist = length(d);
    float inside = uRadius - dist;                       // > 0 이면 구 안

    vec3 target = vec3(0.0);
    if (inside > 0.0) {
      // 구 표면까지 + 조각마다 조금씩 더 (고리가 두께를 갖게)
      float extra = uRadius * 0.3 * rest.w * smoothstep(0.0, uRadius * 0.25, inside);
      target = (d / max(dist, 1e-5)) * (inside + extra);
      target += face.xyz * uRadius * 0.12 * face.w * smoothstep(0.0, uRadius * 0.25, inside);   // 표면에서 살짝 뜸
    }

    bool pushed = inside > 0.0;
    float hold = pushed ? 1.0 : max(0.0, prev.w - uDt / (uHold * (0.4 + 1.2 * rest.w)));
    float free = 1.0 - hold;
    float k = pushed ? uOut : uBack * free * free;       // 머무는 동안은 거의 안 돌아옴

    vec3 offset = mix(prev.xyz, target, 1.0 - exp(-k * uDt));
    gl_FragColor = vec4(offset, hold);
  }
`;

export function createShardSim({ size, restTexture, faceTexture }) {
  const opts = {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: false, stencilBuffer: false,
  };
  let read = new THREE.WebGLRenderTarget(size, size, opts);
  let write = new THREE.WebGLRenderTarget(size, size, opts);

  const uniforms = {
    uPrev: { value: null },
    uRest: { value: restTexture },
    uFace: { value: faceTexture },
    uRes: { value: new THREE.Vector2(size, size) },
    uMouse: { value: new THREE.Vector3(0, 0, 999) },
    uRadius: { value: 0 },
    uDt: { value: 0.016 },
    uOut: { value: 14 },
    uBack: { value: 2.2 },
    uHold: { value: 0.9 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: SIM_FRAG,
    depthTest: false, depthWrite: false,
  });
  // 화면을 덮는 삼각형 하나
  const tri = new THREE.BufferGeometry();
  tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mesh = new THREE.Mesh(tri, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    uniforms,
    get texture() { return read.texture; },
    step(gl, dt) {
      uniforms.uPrev.value = read.texture;
      uniforms.uDt.value = dt;
      const before = gl.getRenderTarget();
      gl.setRenderTarget(write);
      gl.render(scene, camera);
      gl.setRenderTarget(before);
      [read, write] = [write, read];
    },
    dispose() {
      read.dispose(); write.dispose(); material.dispose(); tri.dispose();
    },
  };
}

// ── 3) 껍질 재질 ────────────────────────────────────────────────
// 기본 재질(빛·그림자 계산)은 그대로 두고, 꼭짓점 자리만 바꿔 끼움
export function createShardMaterial(params = {}) {
  const uniforms = { uState: { value: null }, uTime: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({
    color: "#efe9e1", roughness: 0.92, metalness: 0, side: THREE.DoubleSide, ...params,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uState = uniforms.uState;
    shader.uniforms.uTime = uniforms.uTime;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", /* glsl */ `
        #include <common>
        uniform sampler2D uState;
        uniform float uTime;
        attribute vec3 aCentroid;
        attribute vec2 aRef;
        attribute vec3 aRand;

        mat3 shardRotation(vec3 a, float ang) {
          float s = sin(ang), c = cos(ang), oc = 1.0 - c;
          return mat3(
            oc * a.x * a.x + c,       oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s,
            oc * a.x * a.y - a.z * s, oc * a.y * a.y + c,       oc * a.y * a.z + a.x * s,
            oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c
          );
        }
      `)
      // 삼각형의 세 꼭짓점이 같은 칸을 읽으므로 조각이 찢어지지 않고 통째로 움직임
      .replace("#include <beginnormal_vertex>", /* glsl */ `
        vec3 shardOffset = texture2D(uState, aRef).xyz;
        float shardAmt = length(shardOffset);
        float shardLoose = smoothstep(0.0, 0.12, shardAmt);
        float shardAngle = shardAmt * (3.0 + 5.0 * aRand.x)
          + shardLoose * 0.7 * sin(uTime * (1.0 + 2.0 * aRand.y) + aRand.z * 6.2831);
        mat3 shardRot = shardRotation(normalize(aRand * 2.0 - 1.0 + 1e-3), shardAngle);
        vec3 objectNormal = shardRot * normal;
      `)
      .replace("#include <begin_vertex>", /* glsl */ `
        float shardScale = 1.0 - 0.3 * shardLoose * aRand.y;
        vec3 transformed = aCentroid + shardRot * (position - aCentroid) * shardScale + shardOffset;
      `);
  };
  material.customProgramCacheKey = () => "shard-shell";

  return { material, uniforms };
}
