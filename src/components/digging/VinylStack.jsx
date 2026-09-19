"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const deg = THREE.MathUtils.degToRad;

// ── 치수 ──
const COVER = 1.6;
const DEPTH = 0.03;
const PITCH = 0.75; // 카드 사이 z 간격. 카메라 각도와 함께 "위 25% 만 보이는" 비율을 정한다

// ── 자세 ──
const LEAN = deg(12); // 평상시 뒤로 기대는 각
export const CAM_ELEV = deg(30); // 카메라가 내려다보는 각. VinylCrate 의 카메라 위치와 맞춰야 한다
const FORWARD_TILT = deg(55); // 선택 시 앞 카드가 앞으로 젖혀지는 각

// ── 선택 연출 ──
const LIFT_Y = 1.0; // 선택 카드가 위로 뽑혀 올라오는 높이
const LIFT_Z = 0.25; // 선택 카드가 살짝 앞으로 나오는 양
const PUSH_Z = 0.55; // 앞 카드들이 앞으로 밀려나는 거리

// ── 이징 ──
const FOLLOW = 9;
const ANIM = 7;

function Vinyl({ color, meshRef, onClick }) {
  const faces = useMemo(() => {
    const c = new THREE.Color(color);
    const hex = (col) => `#${col.getHexString()}`;
    return {
      front: color,
      back: hex(c.clone().lerp(new THREE.Color("#1c171b"), 0.45)),
      spine: hex(c.clone().multiplyScalar(0.9)),
      edge: "#efe6d6",
    };
  }, [color]);

  // BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z(앞), -Z(뒤)
  return (
    <mesh ref={meshRef} onClick={onClick}>
      <boxGeometry args={[COVER, COVER, DEPTH]} />
      <meshStandardMaterial
        attach="material-0"
        color={faces.spine}
        roughness={0.8}
      />
      <meshStandardMaterial
        attach="material-1"
        color={faces.spine}
        roughness={0.8}
      />
      <meshStandardMaterial
        attach="material-2"
        color={faces.edge}
        roughness={0.9}
      />
      <meshStandardMaterial
        attach="material-3"
        color={faces.edge}
        roughness={0.9}
      />
      <meshStandardMaterial
        attach="material-4"
        color={faces.front}
        roughness={0.7}
      />
      <meshStandardMaterial
        attach="material-5"
        color={faces.back}
        roughness={0.7}
      />
    </mesh>
  );
}

export default function VinylStack({
  items,
  scrollRef,
  selectedRef,
  onSelect,
  onActiveChange,
}) {
  const meshes = useRef([]);
  const lastActive = useRef(-1);
  // 카드별 애니메이션 상태. lift = 뽑혀 올라온 정도, push = 앞으로 젖혀진 정도 (둘 다 0~1)
  const anim = useRef(items.map(() => ({ lift: 0, push: 0 })));

  useFrame((_, dt) => {
    const s = scrollRef.current;
    const sel = selectedRef.current;

    s.current += (s.target - s.current) * (1 - Math.exp(-dt * FOLLOW));
    const k = 1 - Math.exp(-dt * ANIM);

    for (let i = 0; i < items.length; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;

      const a = anim.current[i];
      a.lift += ((sel === i ? 1 : 0) - a.lift) * k;
      a.push += ((sel !== null && i < sel ? 1 : 0) - a.push) * k;

      // 중앙(현재 인덱스)에서 몇 칸 떨어졌는지. 양수 = 뒤, 음수 = 앞(카메라 쪽)
      const o = i - s.current;

      // 카드는 서 있고 z 로만 나란히. 선택되면 위로, 앞 카드는 앞으로
      mesh.position.set(
        0,
        a.lift * LIFT_Y,
        -o * PITCH + a.lift * LIFT_Z + a.push * PUSH_Z,
      );

      // 평상시 뒤로 살짝 기댐 → 선택되면 카메라를 정면으로(-CAM_ELEV) → 밀리면 앞으로 젖힘(+)
      mesh.rotation.x =
        -LEAN + a.lift * (LEAN - CAM_ELEV) + a.push * (LEAN + FORWARD_TILT);
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
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 6, 5]} intensity={1.3} />
      <directionalLight position={[-4, 2, 2]} intensity={0.3} />

      {items.map((item, i) => (
        <Vinyl
          key={item.id}
          color={item.color}
          meshRef={(el) => (meshes.current[i] = el)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(i);
          }}
        />
      ))}
    </>
  );
}
