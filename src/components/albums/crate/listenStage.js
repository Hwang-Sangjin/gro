// Listening 보기의 무대: 재킷 옆으로 나온 판 + 톤암 (crateEngine 이 Listening 에 처음 들어갈 때 불러 씀)
//  (2026-11-27 사용자 요청: 처음엔 턴테이블 전체를 놓았음 → 톤암만 3D 로 가져오고, 판은 재킷 옆으로 나오게)
//  톤암은 Home 방의 것을 그대로 재사용: 방 GLB 의 Turntable_Tonearm, 재질 · 빛은 turntableLook.js (Home 과 같은 것)
//  판은 sleeveParts.makeRecord (Home Hero 의 판), 라벨은 고른 앨범으로 그림
//  크레이트 장면(화면 px 에 맞춘 단위 · 빛 없는 재질)과 따로, 실제 크기(m) 장면을 위에서 내려다보는 카메라로 같은 캔버스에 먼저 그림
//   → 판은 누워 있고(방의 턴테이블과 같은 자세) 카메라가 위에 있으므로 화면에서는 정면을 보는 원. 톤암과 판의 자리 관계는 모델 그대로
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { applyTurntableLook } from "@/components/roomtest/turntableLook";
import { makeEnvironment, makeRecord, drawLabel, S } from "@/components/roomtest/sleeveParts";

const ROOM_URL = "/models/room/grooves_room_blockout_reveal.glb";
export const STAGE = {
  tilt: 0.16,        // 카메라를 수직에서 앞쪽으로 기울인 각도 (rad) — 톤암의 높이가 조금 보이게
  armSwing: -0.42,   // 톤암이 판 위로 들어가는 각도 (Home RoomTest 의 ARM_SWING)
  rpm: 100 / 3,
  key: 4.2, hemi: 1.0, room: 0.3,
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** @param {{ renderer: THREE.WebGLRenderer }} o */
export async function createListenStage({ renderer }) {
  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(ROOM_URL);
  draco.dispose();
  const pivot = gltf.scene.getObjectByName("pivot_turntable");
  if (!pivot) throw new Error("turntable not found");

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 10);
  // 턴테이블: 방 안에서의 자리 · 방향을 지우고 원점에 놓음 (부품의 자리 관계는 그대로 — 톤암과 판 자리)
  pivot.removeFromParent();
  pivot.position.set(0, 0, 0); pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1);
  scene.add(pivot);
  pivot.updateMatrixWorld(true);
  const seat = pivot.getObjectByName("Turntable_DiscSeat"), arm = pivot.getObjectByName("Turntable_Tonearm");
  const armBase = arm?.rotation.y ?? 0;

  const hemi = new THREE.HemisphereLight("#fff6e8", "#b9a88f", STAGE.hemi);
  const key = new THREE.SpotLight("#ffe2b8", STAGE.key, 6, 0.55, 0.6, 1.2);
  scene.add(hemi, key, key.target);

  // 판 (실제 크기) — 판 자리에 놓음
  const record = makeRecord(renderer);
  scene.add(record.group);
  const envMap = makeEnvironment(renderer);
  record.group.traverse((o) => { if (o.isMesh) { o.material.envMap = envMap; o.material.envMapIntensity = 0.9; } });
  const look = applyTurntableLook({ root: pivot, envMap, key, renderer, casters: [record.group] });
  // 톤암만 남김 (본체 · 플래터 · 덮개 · 덧붙인 노브들 · 톤암 받침대는 숨김)
  const keep = new Set();
  arm?.traverse((o) => keep.add(o));
  pivot.traverse((o) => { if (o.isMesh && (!keep.has(o) || o.name === "Tonearm_ArmRest")) o.visible = false; });

  // 판 아래 종이에 지는 부드러운 그림자
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const sg = sc.getContext("2d"), grad = sg.createRadialGradient(64, 64, 40, 64, 64, 64);
  grad.addColorStop(0, "rgba(30,20,26,.5)"); grad.addColorStop(0.55, "rgba(30,20,26,.2)"); grad.addColorStop(1, "rgba(30,20,26,0)");
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(S.disc.r * 2.5, S.disc.r * 2.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _spin = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const ptr = { x: 0, y: 0 };
  let vel = 0, spin = 0, armK = 0, liftK = 0, disposed = false;

  return {
    /** 고른 앨범의 라벨 */
    setAlbum(card) { if (card && !disposed) record.setLabel(drawLabel({ title: card.title, artist_names: card.artist }, card.color || "#bbcbda")); },
    /**
     * at: 판의 자리 (CSS px, 캔버스 왼쪽 위 기준) { cx0 재킷 안, cx1 다 나온 자리, cy, d 지름 } · W · H: 캔버스 크기
     * k: 등장 정도 0…1 (판이 재킷에서 나옴 → 톤암이 나타남) · playing: 판이 돌고 바늘이 내려감
     * lift: 판을 바꾸는 중 0…1…0 (판이 재킷 쪽으로 들어갔다 다시 나옴) · hover: 마우스 (-1…1)
     */
    render(at, W, H, k, dt, { playing, lift = 0, hover }) {
      if (disposed || k <= 0.001) return;
      liftK += (lift - liftK) * (1 - Math.exp(-dt * 9));
      const out = ease(ss(0, 0.75, k)) * (1 - ease(Math.min(1, liftK)));   // 판이 나온 정도
      const armIn = ss(0.6, 1, k);                                          // 톤암이 나타난 정도
      // 움직임
      vel += ((playing ? (STAGE.rpm * Math.PI * 2) / 60 : 0) - vel) * (1 - Math.exp(-dt * 1.2));
      spin -= vel * dt;
      armK += ((playing && out > 0.98 ? 1 : 0) - armK) * (1 - Math.exp(-dt * 3));
      if (arm) { arm.rotation.y = armBase + STAGE.armSwing * ease(armK); arm.scale.setScalar(Math.max(0.0001, ease(armIn))); arm.visible = armIn > 0.001; }
      pivot.updateMatrixWorld(true);
      if (seat) { seat.getWorldPosition(_p); seat.getWorldQuaternion(_q); } else { _p.set(0, 0, 0); _q.identity(); }
      // 판: 다 나왔을 때의 자리 = 판 자리(톤암과 맞는 곳). 덜 나왔으면 화면 왼쪽(-x)으로 — 재킷 안
      const mpp = (S.disc.r * 2) / Math.max(1, at.d);   // 화면 1px = 몇 m
      const back = (at.cx1 - at.cx0) * mpp * (1 - out);
      record.group.position.copy(_p); record.group.position.x -= back; record.group.position.y += 0.0045;
      record.group.quaternion.copy(_q).multiply(_spin.setFromAxisAngle(UP, spin));
      shadow.position.copy(record.group.position); shadow.position.y -= 0.012; shadow.position.z += 0.006;
      ptr.x += ((hover?.x ?? 0) - ptr.x) * (1 - Math.exp(-dt * 5)); ptr.y += ((hover?.y ?? 0) - ptr.y) * (1 - Math.exp(-dt * 5));
      look.update(_p, STAGE.room, ptr);
      // 카메라: 위에서 내려다봄 (화면 위 = 턴테이블의 뒤쪽). 판 자리가 화면의 (cx1, cy) 에 오게
      camera.left = -at.cx1 * mpp; camera.right = (W - at.cx1) * mpp; camera.top = at.cy * mpp; camera.bottom = -(H - at.cy) * mpp;
      camera.updateProjectionMatrix();
      camera.up.set(0, 0, -1);
      camera.position.set(_p.x, _p.y + Math.cos(STAGE.tilt) * 2, _p.z + Math.sin(STAGE.tilt) * 2);
      camera.lookAt(_p);
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.setViewport(0, 0, W, H);
      renderer.render(scene, camera);
      renderer.toneMapping = tm;
    },
    dispose() {
      disposed = true;
      look.dispose(); envMap.dispose(); shadowTex.dispose();
      record.labelMat.map?.dispose();
      scene.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); for (const m of [o.material].flat()) m?.dispose?.(); } });
    },
  };
}
