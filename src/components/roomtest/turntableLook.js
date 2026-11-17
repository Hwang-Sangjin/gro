// 턴테이블을 구운 그림 대신 실시간 재질 + 움직이는 빛으로 (2026-11-16 사용자 요청 A4, 참고: Discography 의 CD 플레이어)
//  방의 다른 물체는 구운 그림 그대로. 턴테이블만 카메라가 가까이 다가가는 주인공이라 따로 다룸
//  - 재질: GLB 재질 이름(mat_tt_walnut · TA_silver …)마다 실제 물성을 줌 — 무광 크림 본체(이름은 walnut 이지만), 새틴 블랙 데크, 헤어라인 알루미늄, 고무, 크롬, 투명 덮개
//  - 반사: 부드러운 빛 띠가 있는 환경(재킷 · 판과 같은 것)을 이 재질들에만 닮 → 금속 · 래커 · 덮개에 빛이 비침
//  - 움직이는 빛: 마우스를 따라 반사가 돌고(envTurn), 턴테이블을 비추는 조명이 조금 움직임(keyShift) · 그 조명이 그림자를 만듦(판 · 톤암 → 플래터 · 데크)
//  - 방이 지어진 뒤에는 반사 세기를 낮춤(room) → 구운 방 안에서 혼자 번쩍이지 않게
import * as THREE from "three";

export const TT_LOOK = {
  body: "#c9bca0",               // 본체 색 (무광 크림. 무대 조명을 받으면 하얗게 날아가서 사이트 크림 #f4e7cd 보다 꽤 낮춤)
  env: 1.7, room: 0.5,           // 반사 세기: 어두운 무대(턴테이블만 있을 때) → 방이 지어진 뒤
  envTurn: 0.7,                  // 마우스를 따라 반사가 도는 정도 (rad)
  keyShift: 0.35,                // 마우스를 따라 조명이 움직이는 거리 (m)
  shadow: { size: 1024, radius: 5, bias: -0.0006 },
};
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

// 잔 결(거칠기): 미세한 얼룩 · 먼지 — 매끈한 면이 플라스틱처럼 보이지 않게
function grainMap(base, spread) {
  const N = 256, c = canvasOf(N, N), x = c.getContext("2d"), d = x.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let px = 0; px < N; px++) {
    const i = (y * N + px) * 4, v = base + (hash(px, y) - 0.5) * spread + (hash(Math.floor(px / 9), Math.floor(y / 9)) - 0.5) * spread * 0.8;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.max(0, Math.min(255, v)); d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4);
  return t;
}

/**
 * @param {{ root: THREE.Object3D, envMap: THREE.Texture, key?: THREE.SpotLight, renderer: THREE.WebGLRenderer, casters?: THREE.Object3D[] }} o
 *  root: 턴테이블 부품이 들어 있는 노드 (구운 그림을 입힌 뒤에 부름 — 본체의 구운 재질을 여기서 바꿈)
 *  key: 턴테이블을 비추는 조명 (그림자를 만들게 함) · casters: 그림자를 드리울 다른 물체 (판)
 */
export function applyTurntableLook({ root, envMap, key, renderer, casters = [] }) {
  const paint = grainMap(176, 16), satin = grainMap(118, 26), rubberG = grainMap(214, 22);     // paint: 무광 도장 (거칠기 ≈ 0.66 ~ 0.72)
  const made = new Map(), mats = [], owned = [paint, satin, rubberG];
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  // 재질 이름(뒤의 _bakedColor · __source 는 떼고 봄) → 새 재질. src = 원래 재질 (그림 · 투명도를 이어받을 때)
  const make = (name, src) => {
    const n = name.replace(/_bakedColor$|_baked$|__source$/, "");
    const map = src.isMeshBasicMaterial ? null : src.map ?? null;     // 구운 그림은 버림, 원래 그림(플래터 무늬)은 씀
    switch (n) {
      // 본체: 무광 크림 도장 (2026-11-16 사용자 선택. 처음의 주황빛 호두나무 결 + 래커는 촌스럽다고 함 → 사이트 크림색에 가까운 무광, 60년대 오디오 느낌)
      case "mat_tt_walnut": return P({ color: TT_LOOK.body, roughness: 1, roughnessMap: paint, metalness: 0, sheen: 0.25, sheenRoughness: 0.6, sheenColor: "#fff6e2" });
      case "mat_tt_deck_black": return P({ color: "#101012", roughness: 1, roughnessMap: satin, metalness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.5 });
      case "mat_tt_rubber": return P({ color: "#0b0b0c", map, roughness: 1, roughnessMap: rubberG, metalness: 0 });
      // (처음엔 얼룩 거칠기 그림 + 결 방향 반사를 줬는데, 큰 노브 윗면이 깨진 무늬처럼 지글거려 z-fighting 으로 보였음 → 고른 거칠기로)
      case "mat_tt_alu_brushed": return P({ color: map ? "#ffffff" : "#b4b7bc", map, roughness: 0.34, metalness: 1 });
      case "TA_silver": return P({ color: "#c9ccd1", roughness: 0.2, metalness: 1 });
      case "TA_needle_tip": return P({ color: "#d4d4d8", roughness: 0.12, metalness: 1 });
      case "TA_black": case "mat_hinge_black": return P({ color: "#141416", roughness: 0.38, metalness: 0.35, clearcoat: 0.25, clearcoatRoughness: 0.4 });
      case "TA_red": return P({ color: "#5a1612", roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 });
      case "mat_dustcover_glass": return P({ color: "#2a2d33", roughness: 0.06, metalness: 0, transparent: true, opacity: 0.13, clearcoat: 1, clearcoatRoughness: 0.05, side: src.side, depthWrite: false });
      default: return null;
    }
  };
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const src = o.material, k = src.uuid;
    if (!made.has(k)) {
      const m = make(src.name || "", src);
      if (m) { m.name = (src.name || "").replace(/_bakedColor$|_baked$|__source$/, "") + "_live"; m.envMap = envMap; m.envMapIntensity = TT_LOOK.env; mats.push(m); }
      made.set(k, m);
    }
    const m = made.get(k);
    if (m) o.material = m;
    if (!o.material.transparent) { o.castShadow = true; o.receiveShadow = true; }
  });
  // 조명 하나가 그림자를 만듦 (턴테이블 부품 · 판만 드리움 — 방의 구운 재질은 그림자를 받지 않음)
  if (key) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(TT_LOOK.shadow.size, TT_LOOK.shadow.size);
    key.shadow.radius = TT_LOOK.shadow.radius; key.shadow.bias = TT_LOOK.shadow.bias; key.shadow.normalBias = 0.004;
    key.shadow.camera.near = 0.4; key.shadow.camera.far = 3.5;
    for (const c of casters) c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  const _rot = new THREE.Euler(), _off = new THREE.Vector3(0.35, 1.3, 0.9), _p = new THREE.Vector3();
  return {
    mats,
    /** 매 프레임: seat = 턴테이블 판 자리(조명이 따라감) · roomK = 방이 지어진 정도 0…1 · ptr = 마우스(-1…1) */
    update(seat, roomK, ptr) {
      const k = TT_LOOK.env + (TT_LOOK.room - TT_LOOK.env) * roomK;
      _rot.set(-ptr.y * TT_LOOK.envTurn * 0.5, ptr.x * TT_LOOK.envTurn, 0);
      for (const m of mats) { m.envMapIntensity = k; m.envMapRotation.copy(_rot); }
      if (key) {
        key.position.copy(seat).add(_p.copy(_off)).add(_p.set(ptr.x * TT_LOOK.keyShift, 0, -ptr.y * TT_LOOK.keyShift * 0.6));
        key.target.position.copy(seat);
      }
    },
    dispose() { for (const m of mats) m.dispose(); for (const t of owned) t.dispose(); },
  };
}
