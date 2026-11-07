// 구운 빛(라이트맵)을 방 GLB 오브젝트에 입힘 — Blender blender/exports/bake_lightmaps.py 결과
//  public/models/room/bake/lightmaps.json: groups { 이름: { file, scale } } · objects { 오브젝트 이름: 그룹 }
//  라이트맵 = 빛만 구운 것 (그림자 · 벽에 튕긴 빛 · 램프 빛, 재질 색 없음). 값 ÷ scale 을 sRGB 8bit 로 저장해 둠
//  → 원래 텍스처·색 × 라이트맵 × scale 을 빛 계산 없는 재질(MeshBasicMaterial)로. 두 번째 UV(BakeUV = uv1) 사용
//  MeshBasicMaterial 은 lightMap 을 π 로 나눠서 쓰므로 세기 = scale × π (Blender 미리보기와 같은 밝기)
import * as THREE from "three";

export const BAKE_URL = "/models/room/bake/";

// 끝나면 바꾼 메시 수를 돌려줌. 이미 바꾼 재질은 (원래 재질, 그룹) 마다 하나만 만들어 같이 씀
export async function applyLightmaps(root) {
  // 다시 구워도 파일 이름이 같아 브라우저가 예전 그림을 씀 → 목록은 매번 새로, 그림은 굽은 때(version)를 붙여서
  const man = await fetch(BAKE_URL + "lightmaps.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!man) return 0;
  const loader = new THREE.TextureLoader();
  const maps = {};
  await Promise.all(Object.entries(man.groups).map(([g, v]) => loader.loadAsync(BAKE_URL + v.file + (man.version ? "?v=" + man.version : "")).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;          // glTF UV 기준
    t.channel = 1;            // BakeUV (TEXCOORD_1)
    maps[g] = { t, k: v.scale * (v.gain ?? 1) * Math.PI };   // gain: 그룹별 밝기 배율 (너무 어두운 이웃 옥상 등)
  })));
  const made = new Map();
  let n = 0;
  for (const [name, g] of Object.entries(man.objects)) {
    const node = root.getObjectByName(name);
    if (!node || !maps[g]) continue;
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
      if (!m) {
        m = new THREE.MeshBasicMaterial({
          name: src.name + "_baked", map: src.map ?? null, color: (tinted ? src.userData.baseColor : src.color)?.clone() ?? new THREE.Color(1, 1, 1),
          lightMap: maps[g].t, lightMapIntensity: maps[g].k,
          side: src.side, transparent: src.transparent, opacity: src.opacity, alphaTest: src.alphaTest,
        });
        made.set(key, m);
      }
      o.material = m;
      n++;
    }
  }
  return n;
}
