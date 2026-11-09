// 구운 빛(라이트맵)을 방 GLB 오브젝트에 입힘 — Blender blender/exports/bake_lightmaps.py 결과
//  기본 = 색까지 구운 그림(groups[g].color, bake_lightmaps.py mode=color): Lookdev 톤매핑까지 입힌 그림을 그대로 보여 줌 (웹 톤매핑 끔)
//  ?lm=light = 아래의 빛만 구운 라이트맵 방식 (비교용)
//  public/models/room/bake/lightmaps.json: groups { 이름: { file, scale, gain, variants } } · objects { 오브젝트 이름: 그룹 }
//  라이트맵 = 빛만 구운 것 (그림자 · 벽에 튕긴 빛 · 램프 빛, 재질 색 없음). 값 ÷ scale 을 sRGB 8bit 로 저장해 둠
//  → 원래 텍스처·색 × 라이트맵 × scale 을 빛 계산 없는 재질(MeshBasicMaterial)로. 두 번째 UV(BakeUV = uv1) 사용
//  MeshBasicMaterial 은 lightMap 을 π 로 나눠서 쓰므로 세기 = scale × π (Blender 미리보기와 같은 밝기)
//  상태(variants): on = 가구 · 램프 다 있음 / off = 가구는 있고 램프 꺼짐 / empty = 가구 없이 방 뼈대만 / empty_lit = 가구 없이 램프 빛만 켜짐
//   가구가 놓이며 empty(_lit) → off/on (바닥에 아직 없는 가구 그림자가 미리 찍히지 않게), 빛이 켜지며 off → on
//   setLightmapState(build, lit) 로 모든 재질이 같이 섞임. 없는 상태는 가까운 상태로 대신 (empty → off → on, empty_lit → on)
import * as THREE from "three";

export const BAKE_URL = new URLSearchParams(location.search).get("quality") === "mobile" ? "/models/room/bake_mobile/" : "/models/room/bake/";

// 모든 구운 재질이 같이 쓰는 섞는 비율 (on, off, empty, empty_lit)
const state = { value: new THREE.Vector4(1, 0, 0, 0) };
//  build: 0 = 빈 방 → 1 = 가구 다 놓임 / lit: 0 = 램프 빛 꺼짐 → 1 = 켜짐
export function setLightmapState(build, lit) {
  const b = THREE.MathUtils.clamp(build, 0, 1), l = THREE.MathUtils.clamp(lit, 0, 1);
  state.value.set(b * l, b * (1 - l), (1 - b) * (1 - l), (1 - b) * l);
}

const VARIANTS = ["off", "empty", "empty_lit"];
// 상태 비율 → 실제로 있는 그림들의 비율 (없는 상태는 가까운 상태로: empty → off → on, empty_lit → on)
const LM_WEIGHTS = `vec4 lmW = uLmState;
      #ifndef LM_V2
        lmW.y += lmW.z; lmW.z = 0.0;
      #endif
      #ifndef LM_V1
        lmW.x += lmW.y; lmW.y = 0.0;
      #endif
      #ifndef LM_V3
        lmW.x += lmW.w; lmW.w = 0.0;
      #endif`;
function variantDefs(sh, v) {
  let defs = "uniform vec4 uLmState;\n";
  sh.uniforms.uLmState = state;
  for (const [i, name] of VARIANTS.entries()) if (v[name]) {
    defs += `#define LM_V${i + 1}\nuniform sampler2D uLm${i + 1};\n`;
    sh.uniforms["uLm" + (i + 1)] = { value: v[name].t };
  }
  return defs;
}

// 색까지 구운 그림: map 대신 상태별 그림을 섞음 (빛 계산 없음, 톤매핑 끔)
function colorShader(m, v) {
  if (!VARIANTS.some((n) => v[n])) return;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = variantDefs(sh, v) + sh.fragmentShader.replace("#include <map_fragment>", `${LM_WEIGHTS}
      vec4 lmC = texture2D( map, vMapUv ) * lmW.x;
      #ifdef LM_V1
        lmC += texture2D( uLm1, vMapUv ) * lmW.y;
      #endif
      #ifdef LM_V2
        lmC += texture2D( uLm2, vMapUv ) * lmW.z;
      #endif
      #ifdef LM_V3
        lmC += texture2D( uLm3, vMapUv ) * lmW.w;
      #endif
      diffuseColor *= lmC;`);
  };
  m.customProgramCacheKey = () => "lmc" + VARIANTS.map((n) => (v[n] ? 1 : 0)).join("");
}
function variantShader(m, v) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLmK = { value: new THREE.Vector4(v.on.k, v.off?.k ?? 0, v.empty?.k ?? 0, v.empty_lit?.k ?? 0) };
    sh.fragmentShader = "uniform vec4 uLmK;\n" + variantDefs(sh, v) + sh.fragmentShader.replace(
      "reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;",
      `${LM_WEIGHTS}
      vec3 lmSum = lightMapTexel.rgb * uLmK.x * lmW.x;
      #ifdef LM_V1
        lmSum += texture2D( uLm1, vLightMapUv ).rgb * uLmK.y * lmW.y;
      #endif
      #ifdef LM_V2
        lmSum += texture2D( uLm2, vLightMapUv ).rgb * uLmK.z * lmW.z;
      #endif
      #ifdef LM_V3
        lmSum += texture2D( uLm3, vLightMapUv ).rgb * uLmK.w * lmW.w;
      #endif
      reflectedLight.indirectDiffuse += lmSum * RECIPROCAL_PI;`);
  };
  m.customProgramCacheKey = () => "lm" + VARIANTS.map((n) => (v[n] ? 1 : 0)).join("");
}

// 끝나면 바꾼 메시 수를 돌려줌. 이미 바꾼 재질은 (원래 재질, 그룹) 마다 하나만 만들어 같이 씀
export async function applyLightmaps(root) {
  // 다시 구워도 파일 이름이 같아 브라우저가 예전 그림을 씀 → 목록은 매번 새로, 그림은 굽은 때(version)를 붙여서
  const man = await fetch(BAKE_URL + "lightmaps.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!man) return 0;
  const loader = new THREE.TextureLoader();
  const load = (file) => loader.loadAsync(BAKE_URL + file + (man.version ? "?v=" + man.version : "")).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;          // glTF UV 기준
    t.channel = 1;            // BakeUV (TEXCOORD_1)
    return t;
  });
  // 색까지 구운 그림(color)이 있는 그룹은 그 그림을 그대로 (Blender 에서 Lookdev 톤매핑까지 입힘 → 웹 톤매핑 끔)
  //  ?lm=light 면 예전처럼 빛만 구운 라이트맵 × 원래 재질 (비교용)
  const useColor = typeof location === "undefined" || new URLSearchParams(location.search).get("lm") !== "light";
  const colors = {};
  if (useColor) await Promise.all(Object.entries(man.groups).filter(([, v]) => v.color?.on).map(async ([g, v]) => {
    const out = {};
    await Promise.all(Object.entries(v.color).map(async ([name, e]) => { out[name] = { t: await load(e.file) }; }));
    colors[g] = out;
  }));
  const maps = {};
  await Promise.all(Object.entries(man.groups).filter(([g, v]) => !colors[g] && (v.variants || v.file)).map(async ([g, v]) => {
    const gain = (v.gain ?? 1) * Math.PI;   // gain: 그룹별 밝기 배율 (너무 어두운 이웃 옥상 등)
    const variants = v.variants ?? { on: { file: v.file, scale: v.scale } };
    const out = {};
    await Promise.all(Object.entries(variants).map(async ([name, e]) => { out[name] = { t: await load(e.file), k: e.scale * gain }; }));
    maps[g] = out;
  }));
  const made = new Map();
  let n = 0;
  for (const [name, g] of Object.entries(man.objects)) {
    const node = root.getObjectByName(name);
    if (!node || !(maps[g] || colors[g])) continue;
    // 재질이 여러 개인 메시는 GLTFLoader 가 노드 아래 메시 여러 개로 나눔 → 그 메시들까지 (다른 오브젝트인 자식은 빼고)
    const meshes = node.isMesh ? [node] : node.children.filter((c) => c.isMesh && !man.objects[c.name] && c.children.length === 0);
    for (const o of meshes) {
      if (!o.geometry.attributes.uv1) continue;
      const src = o.material;
      // 스스로 빛나는 재질(건물 창 · 이름판 등)은 실시간 그대로 (빛 계산 없는 재질로 바꾸면 발광이 사라짐 · 램프 켜짐 연출도)
      //  단 envCore.applyWallColors 가 면 방향 색을 내려고 붙인 발광(wallTinted)은 진짜 발광이 아님 → 구운 빛으로 바꾸고 원래 색(baseColor)을 씀
      const tinted = src.userData.wallTinted;
      if (!tinted && src.emissive && src.emissive.getHex() !== 0 && (src.emissiveIntensity ?? 1) > 0) continue;
      const key = src.uuid + g;
      let m = made.get(key);
      if (!m && colors[g]) {
        const c = colors[g];
        m = new THREE.MeshBasicMaterial({
          name: src.name + "_bakedColor", map: c.on.t, toneMapped: false,
          side: src.side, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest,
        });
        colorShader(m, c);
        made.set(key, m);
      }
      if (!m) {
        const v = maps[g];
        m = new THREE.MeshBasicMaterial({
          name: src.name + "_baked", map: src.map ?? null, color: (tinted ? src.userData.baseColor : src.color)?.clone() ?? new THREE.Color(1, 1, 1),
          lightMap: v.on.t, lightMapIntensity: v.on.k,
          side: src.side, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest,
        });
        if (VARIANTS.some((n) => v[n])) variantShader(m, v);
        made.set(key, m);
      }
      o.material = m;
      n++;
    }
  }
  return n;
}
