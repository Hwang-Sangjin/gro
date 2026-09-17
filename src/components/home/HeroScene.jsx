"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// 임시 씬. 나중에 잉크 선화 리스닝룸으로 교체된다
export default function HeroScene() {
  const disc = useRef();
  const box = useRef();

  useFrame((state, delta) => {
    if (disc.current) disc.current.rotation.y += delta * 0.4;
    if (box.current) {
      box.current.rotation.x += delta * 0.2;
      box.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />

      {/* 바이닐 자리 */}
      <mesh ref={disc} position={[-1.6, 0, 0]} rotation={[Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.06, 64]} />
        <meshStandardMaterial color="#2f5a72" roughness={0.45} metalness={0.1} />
      </mesh>

      {/* 슬리브 자리 */}
      <mesh ref={box} position={[1.7, -0.2, 0]}>
        <boxGeometry args={[1.8, 1.8, 0.18]} />
        <meshStandardMaterial color="#4c404a" roughness={0.7} />
      </mesh>
    </>
  );
}