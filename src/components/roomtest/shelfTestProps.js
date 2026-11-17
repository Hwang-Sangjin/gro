// 창가 선반 새 소품(플립 시계 · 지금 듣는 판)을 방 GLB 를 다시 내보내기 전까지 확인용 GLB 로 얹음
// 방 GLB 에 이미 들어 있으면 아무것도 안 함. 확인용 GLB 는 월드 자리(방이 다 지어진 자세)로 내보낸 것이라
// shelfFinal(다 지어진 자세에서의 선반 pivot 월드 행렬)로 선반 pivot 기준 자리로 바꿔 붙임 → reveal 애니메이션을 같이 따라감
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const SHELF_TEST_URL = "/models/room/test/shelf_props_test.glb?v=2";   // 다시 내보내면 v 를 올려 브라우저 캐시를 피함
const NAMES = ["prop_cs_clock", "prop_cs_np"];
export const NOW_PLAYING = { glow: 0.72 };   // 지금 듣는 판 커버 밝기 (1 = 그림 그대로. 방이 어두운 주황빛이라 조금 낮춤)
const HIDE = ["prop_cs_arch", ...[0, 1, 2, 3, 4, 5].map((i) => `prop_cs_book_up_${i}`)];

// 끝나면 onReady() 를 부름. 돌려주는 함수로 취소
export function addShelfTestProps(root, shelfFinal, onReady) {
  if (root.getObjectByName("prop_cs_clock")) { onReady?.(false); return () => {}; }
  let live = true;
  const added = [], hidden = [];
  new GLTFLoader().load(SHELF_TEST_URL, (g) => {
    if (!live) return;
    const pivot = root.getObjectByName("pivot_bookshelf");
    const inv = shelfFinal ? shelfFinal.clone().invert() : null;
    for (const name of NAMES) {
      const o = g.scene.getObjectByName(name);
      if (!o) continue;
      o.updateMatrix();
      if (pivot && inv) {
        new THREE.Matrix4().multiplyMatrices(inv, o.matrix).decompose(o.position, o.quaternion, o.scale);
        pivot.add(o);
      } else root.add(o);
      added.push(o);
    }
    // 지금 웹의 방 GLB 에는 Blender 에서 지운 소품(도자기 · 세운 책)이 아직 남아 있어 숨김
    for (const n of HIDE) { const o = root.getObjectByName(n); if (o) { o.visible = false; hidden.push(o); } }
    onReady?.(true);
  });
  return () => { live = false; for (const o of added) o.removeFromParent(); for (const o of hidden) o.visible = true; };
}

// 지금 듣는 판 재킷에 앨범 커버. skip = 벽 선반에 이미 놓인 앨범 수 (그 뒤에서 무작위, 없으면 전체에서)
export function applyNowPlaying(root, albums, skip = 0) {
  const np = root.getObjectByName("prop_cs_np_cover");
  if (!np || !albums.length) return null;
  const pool = albums.length > skip ? albums.slice(skip) : albums;
  const a = pool[Math.floor(Math.random() * pool.length)];
  new THREE.TextureLoader().setCrossOrigin("anonymous").load(a.image, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;     // glTF UV 기준
    // 커버는 제 색 그대로 (빛을 받지 않는 재질): 바로 옆 램프 빛을 받으면 하얗게 날아가 그림이 안 보였음 (2026-11-17 휴대폰 확인)
    const old = np.material;
    np.material = new THREE.MeshBasicMaterial({ name: "mat_now_playing_cover", map: tex, color: new THREE.Color().setScalar(NOW_PLAYING.glow), side: old.side,
      // 재킷 앞면에서 0.4mm 만 떠 있음 → 멀리서 재킷과 번갈아 보이지 않게 깊이를 카메라 쪽으로 당김
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    if (old.userData.nowPlaying) { old.map?.dispose(); old.dispose(); }
    np.material.userData.nowPlaying = true;
  });
  return a;
}
