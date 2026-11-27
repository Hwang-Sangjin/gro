// Listening 보기의 턴테이블 무대 (crateEngine 이 Listening 에 처음 들어갈 때 불러 씀)
//  Home 방의 턴테이블을 그대로 재사용: 방 GLB 에서 pivot_turntable 만 꺼내고, 재질 · 빛은 turntableLook.js (Home 과 같은 것)
//  판은 sleeveParts.makeRecord (Home Hero 의 판), 라벨은 고른 앨범으로 그림
//  크레이트 장면(화면 px 에 맞춘 단위 · 빛 없는 재질)과 따로, 실제 크기(m) 장면 + 제 카메라로 같은 캔버스의 한 구역(viewport)에 먼저 그림
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { applyTurntableLook } from "@/components/roomtest/turntableLook";
import { makeEnvironment, makeRecord, drawLabel } from "@/components/roomtest/sleeveParts";

const ROOM_URL = "/models/room/grooves_room_blockout_reveal.glb";
export const STAGE = {
  fov: 24,
  elev: 0.74,        // 카메라가 내려다보는 각도 (rad)
  yaw: 0,            // 턴테이블을 돌려 놓는 각도 (rad) — 앞면이 카메라를 보게
  fit: 0.9,          // 화면 구역에 맞출 때의 여유
  armSwing: -0.42,   // 톤암이 판 위로 들어가는 각도 (Home RoomTest 의 ARM_SWING)
  rpm: 100 / 3,
  key: 4.2, hemi: 1.0, room: 0.25,
  lift: 0.16,        // 판을 바꿀 때 판이 떠오르는 높이 (m)
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** @param {{ renderer: THREE.WebGLRenderer }} o */
export async function createListenStage({ renderer }) {
  const draco = new DRACOLoader().setDecoderPath("/draco/");
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(ROOM_URL);
  draco.dispose();
  const pivot = gltf.scene.getObjectByName("pivot_turntable");
  if (!pivot) throw new Error("turntable not found");
  gltf.scene.updateMatrixWorld(true);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(STAGE.fov, 1, 0.05, 20);
  // 턴테이블: 방 안에서의 자리 · 방향을 지우고 원점에 놓음
  const holder = new THREE.Group();
  pivot.removeFromParent();
  pivot.position.set(0, 0, 0); pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1);
  holder.add(pivot); holder.rotation.y = STAGE.yaw;
  scene.add(holder);
  // 먼지 덮개는 열어 둠 (Blender 의 cover_open 끝 자세)
  const mixer = new THREE.AnimationMixer(pivot);
  const lidClip = gltf.animations.find((a) => a.name === "cover_open");
  if (lidClip) {
    const a = mixer.clipAction(lidClip);
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.time = lidClip.duration;
    mixer.update(0);
  }
  holder.updateMatrixWorld(true);
  const seat = pivot.getObjectByName("Turntable_DiscSeat"), platter = pivot.getObjectByName("Turntable_Platter"), arm = pivot.getObjectByName("Turntable_Tonearm");
  const armBase = arm?.rotation.y ?? 0;

  // 가운데 · 크기 (덮개까지 포함)
  const box = new THREE.Box3().setFromObject(holder), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  holder.position.sub(center); holder.updateMatrixWorld(true);
  const R = size.length() / 2;

  // 빛: Home 과 같은 구성 (고른 빛 + 턴테이블을 비추는 조명 하나 — 그림자를 만듦)
  const hemi = new THREE.HemisphereLight("#fff6e8", "#b9a88f", STAGE.hemi);
  const key = new THREE.SpotLight("#ffe2b8", STAGE.key, 6, 0.55, 0.6, 1.2);
  scene.add(hemi, key, key.target);

  // 판 (실제 크기) — 판 자리 위에 놓고 플래터와 같이 돎
  const record = makeRecord(renderer);
  scene.add(record.group);
  const envMap = makeEnvironment(renderer);
  for (const m of [record.vinyl, record.labelMat]) { m.envMap = envMap; m.envMapIntensity = 0.9; }
  record.group.traverse((o) => { if (o.isMesh && o.material.envMap !== envMap) { o.material.envMap = envMap; o.material.envMapIntensity = 0.9; } });
  const look = applyTurntableLook({ root: pivot, envMap, key, renderer, casters: [record.group] });

  // 바닥 그림자 (종이 위에 떠 보이지 않게)
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const sg = sc.getContext("2d"), grad = sg.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(30,20,26,.42)"); grad.addColorStop(0.55, "rgba(30,20,26,.16)"); grad.addColorStop(1, "rgba(30,20,26,0)");
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.7, size.z * 1.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -size.y / 2 - 0.001, 0);
  scene.add(shadow);

  const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(), _spin = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const ptr = { x: 0, y: 0 };
  let vel = 0, spin = 0, armK = 0, liftK = 0, disposed = false;
  const seatLift = 0.0045;   // 판 자리는 두꺼운 예전 판 기준 → 고무 매트 위로 올림

  return {
    /** 고른 앨범의 라벨 */
    setAlbum(card) { if (card && !disposed) record.setLabel(drawLabel({ title: card.title, artist_names: card.artist }, card.color || "#bbcbda")); },
    /**
     * rect: 캔버스 안에서 그릴 구역 (CSS px, 왼쪽 위 기준) · H: 캔버스 높이 · k: 등장 정도 0…1 (오른쪽에서 들어옴)
     * playing: 판이 돌고 바늘이 내려감 · lift: 판을 바꾸는 중 0…1…0 (판이 떠오름) · hover: 마우스 (-1…1)
     */
    render(rect, H, k, dt, { playing, lift = 0, hover }) {
      if (disposed || k <= 0.001) return;
      const e = ease(Math.min(1, k));
      // 움직임
      vel += ((playing ? (STAGE.rpm * Math.PI * 2) / 60 : 0) - vel) * (1 - Math.exp(-dt * 1.2));
      spin -= vel * dt;
      if (platter) platter.rotation.y -= vel * dt;
      armK += ((playing ? 1 : 0) - armK) * (1 - Math.exp(-dt * 3));
      if (arm) arm.rotation.y = armBase + STAGE.armSwing * ease(armK);
      liftK += (lift - liftK) * (1 - Math.exp(-dt * 9));
      holder.updateMatrixWorld(true);
      if (seat) { seat.getWorldPosition(_p); seat.getWorldQuaternion(_q); } else { _p.set(0, 0, 0); _q.identity(); }
      _up.copy(UP).applyQuaternion(_q);
      record.group.position.copy(_p).addScaledVector(_up, seatLift + STAGE.lift * liftK);
      record.group.quaternion.copy(_q).multiply(_spin.setFromAxisAngle(UP, spin));
      ptr.x += ((hover?.x ?? 0) - ptr.x) * (1 - Math.exp(-dt * 5)); ptr.y += ((hover?.y ?? 0) - ptr.y) * (1 - Math.exp(-dt * 5));
      look.update(_p, STAGE.room, ptr);
      // 카메라: 구역에 턴테이블이 다 들어오는 거리
      const w = Math.max(1, rect.width), h = Math.max(1, rect.height), aspect = w / h;
      const half = THREE.MathUtils.degToRad(STAGE.fov / 2), fitH = Math.min(half, Math.atan(Math.tan(half) * aspect));
      const dist = (R / Math.sin(fitH)) * STAGE.fit;
      camera.aspect = aspect; camera.updateProjectionMatrix();
      camera.position.set(0, Math.sin(STAGE.elev) * dist, Math.cos(STAGE.elev) * dist);
      camera.lookAt(0, 0, 0);
      const tm = renderer.toneMapping;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.setViewport(rect.left + (1 - e) * w * 1.4, H - rect.top - h, w, h);
      renderer.render(scene, camera);
      renderer.toneMapping = tm;
    },
    dispose() {
      disposed = true;
      look.dispose(); envMap.dispose(); shadowTex.dispose(); shadow.geometry.dispose(); shadow.material.dispose();
      record.labelMat.map?.dispose();
      scene.traverse((o) => { if (o.isMesh) { o.geometry?.dispose(); for (const m of [o.material].flat()) m?.dispose?.(); } });
    },
  };
}
