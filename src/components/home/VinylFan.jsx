"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// ── 진열 축(대각선). 화면 기준 "오른쪽 + 위" 로 뻗는다
const STEP_X = 1.55;
const STEP_Y = 0.7;
const STEP_Z = -0.6; // 그리기 순서만 만든다. 직교 카메라라 크기엔 영향 없음

const SCALE_FALLOFF = 0.012; // 0 이면 앞뒤 크기 완전히 동일
const SLEEVE = 3.2;
const DEPTH = 0.18;
const TILT_Y = -0.42;

const VISIBLE = 6;
const WORLD_H = 9.4;
const ORIGIN = [-3.4, -2.0];

const EASE = 5;

function Rig() {
  const camera = useThree((s) => s.camera);
  const height = useThree((s) => s.size.height);

  // useMemo 는 사이드이펙트용이 아니다. 레이아웃 확정 후 한 번만 잡는다
  useLayoutEffect(() => {
    camera.zoom = height / WORLD_H;
    camera.updateProjectionMatrix();
  }, [camera, height]);

  return null;
}

export default function VinylFan({ items, scrollRef, onActiveChange }) {
  const groups = useRef([]);
  const mats = useRef([]); // [i] = [disc, sleeve, art]
  const lastActive = useRef(-1);

  // 지오메트리는 전부 공유. 앨범 수가 늘어도 GPU 버퍼는 3개뿐
  const geo = useMemo(
    () => ({
      disc: new THREE.CylinderGeometry(SLEEVE * 0.47, SLEEVE * 0.47, 0.04, 64),
      sleeve: new THREE.BoxGeometry(SLEEVE, SLEEVE, DEPTH),
      art: new THREE.PlaneGeometry(SLEEVE * 0.92, SLEEVE * 0.5),
    }),
    [],
  );

  // 머티리얼은 앨범마다. transparent 는 생성 시 한 번만 켠다 — 프레임 중에 바꾸면 셰이더가 재컴파일된다
  const materials = useMemo(
    () =>
      items.map((item) => [
        new THREE.MeshStandardMaterial({
          color: "#7fa3c7",
          roughness: 0.6,
          transparent: true,
        }),
        new THREE.MeshStandardMaterial({
          color: "#efe3cc",
          roughness: 0.9,
          transparent: true,
        }),
        new THREE.MeshStandardMaterial({
          color: item.color,
          roughness: 0.95,
          transparent: true,
        }),
      ]),
    [items],
  );

  mats.current = materials;

  useEffect(() => {
    return () => {
      Object.values(geo).forEach((g) => g.dispose());
      materials.flat().forEach((m) => m.dispose());
    };
  }, [geo, materials]);

  // 인라인 화살표를 ref 로 쓰면 리렌더마다 detach/attach 가 일어난다. 한 번 만들어 고정
  const setGroup = useMemo(
    () => items.map((_, i) => (el) => (groups.current[i] = el)),
    [items],
  );

  useFrame((state, delta) => {
    const s = scrollRef.current;
    s.current = THREE.MathUtils.damp(s.current, s.target, EASE, delta);

    for (let i = 0; i < items.length; i++) {
      const g = groups.current[i];
      if (!g) continue;

      const o = i - s.current;
      const dist = Math.abs(o);

      // 범위 밖이면 행렬 계산조차 건너뛴다
      if (dist > VISIBLE) {
        g.visible = false;
        continue;
      }
      g.visible = true;

      g.position.set(
        ORIGIN[0] + o * STEP_X,
        ORIGIN[1] + o * STEP_Y,
        o * STEP_Z,
      );
      g.rotation.y = TILT_Y;
      g.scale.setScalar(1 - o * SCALE_FALLOFF);

      const vis = 1 - THREE.MathUtils.smoothstep(dist, VISIBLE - 1.2, VISIBLE);
      const m = mats.current[i];
      if (m[0].opacity !== vis) {
        m[0].opacity = vis;
        m[1].opacity = vis;
        m[2].opacity = vis;
      }
    }

    const active = THREE.MathUtils.clamp(
      Math.round(s.current),
      0,
      items.length - 1,
    );
    if (active !== lastActive.current) {
      lastActive.current = active;
      onActiveChange?.(active);
    }
  });

  return (
    <>
      <Rig />
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 3, 8]} intensity={1.1} />
      <directionalLight position={[-5, 2, 3]} intensity={0.4} />

      {items.map((item, i) => (
        <group key={item.id} ref={setGroup[i]}>
          <mesh
            geometry={geo.disc}
            material={materials[i][0]}
            position={[SLEEVE * 0.46, 0, -DEPTH * 0.6]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <mesh geometry={geo.sleeve} material={materials[i][1]} />
          <mesh
            geometry={geo.art}
            material={materials[i][2]}
            position={[0, -SLEEVE * 0.22, DEPTH / 2 + 0.002]}
          />
        </group>
      ))}
    </>
  );
}
