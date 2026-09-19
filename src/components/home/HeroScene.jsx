"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// 임시 씬. 머티리얼은 "실제 웜톤 색" 으로 둔다 — 모노톤은 PaperFadePass 가 입힌다
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
      <color attach="background" args={["#e6cfa8"]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} />

      <mesh ref={disc} position={[-1.6, 0, 0]} rotation={[Math.PI / 2.6, 0, 0]}>
        <cylinderGeometry args={[1.4, 1.4, 0.06, 64]} />
        <meshStandardMaterial
          color="#2a2326"
          roughness={0.45}
          metalness={0.1}
        />
      </mesh>

      <mesh ref={box} position={[1.7, -0.2, 0]}>
        <boxGeometry args={[1.8, 1.8, 0.18]} />
        <meshStandardMaterial color="#c4573a" roughness={0.7} />
      </mesh>

      <mesh position={[0, -1.6, -1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 14]} />
        <meshStandardMaterial color="#7a5236" roughness={0.9} />
      </mesh>
    </>
  );
}
