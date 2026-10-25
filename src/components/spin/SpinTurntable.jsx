"use client";
// /lab/spin 3D 보기 — 턴테이블 위에서 도는 판. 판 윗면은 2D에서 구운 그림(disc 캔버스)을 그대로 붙임
// 회전 각도·반짝임은 SpinStudio 의 재생 루프가 motion ref 에 써 둔 값을 매 프레임 읽음 (2D 와 같은 시계)
// 턴테이블·판은 임시 기본 도형 — 나중에 새 3D 모델로 바꿀 예정
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function Turntable({ disc, version, motion }) {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(disc);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [disc]);
  useEffect(() => { tex.needsUpdate = true; }, [tex, version]);
  useEffect(() => () => tex.dispose(), [tex]);

  const mats = useMemo(() => {
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.36, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0, transparent: true });
    const edge = new THREE.MeshStandardMaterial({ color: 0x141113, roughness: 0.4 });
    return { face, list: [edge, face, edge] };
  }, [tex]);

  const discRef = useRef(null);
  useFrame(() => {
    if (!discRef.current) return;
    discRef.current.rotation.y = (-motion.current.angle * Math.PI) / 180;   // 위에서 보면 시계 방향
    mats.face.emissiveIntensity = motion.current.pulse * 0.35;
  });

  const metal = <meshStandardMaterial color="#e2ddd4" metalness={0.85} roughness={0.25} />;
  return (
    <group>
      {/* 본체 */}
      <mesh position={[0.28, -0.19, 0]}><boxGeometry args={[3.15, 0.24, 2.55]} /><meshStandardMaterial color="#332a31" roughness={0.8} /></mesh>
      <mesh position={[0.28, -0.065, 0]}><boxGeometry args={[3.05, 0.01, 2.45]} /><meshStandardMaterial color="#2a2228" roughness={0.7} /></mesh>
      {/* 플래터 */}
      <mesh position={[0, -0.03, 0]}><cylinderGeometry args={[1.06, 1.06, 0.07, 96]} /><meshStandardMaterial color="#9a9aa0" metalness={0.85} roughness={0.3} /></mesh>
      {/* 판 */}
      <mesh ref={discRef} position={[0, 0.015, 0]} material={mats.list}><cylinderGeometry args={[1, 1, 0.02, 160]} /></mesh>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.018, 0.018, 0.09, 16]} /><meshStandardMaterial color="#dddddd" metalness={0.9} roughness={0.2} /></mesh>
      {/* 톤암 — 받침대에 걸쳐 둔 상태 (판 위 그림을 가리지 않게) */}
      <mesh position={[1.42, 0, -0.85]}><cylinderGeometry args={[0.14, 0.16, 0.12, 40]} /><meshStandardMaterial color="#1d191c" metalness={0.4} roughness={0.45} /></mesh>
      <mesh position={[1.42, 0.1, -0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.02, 1.55, 16]} />{metal}</mesh>
      <mesh position={[1.42, 0.1, -1.02]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.065, 0.065, 0.13, 28]} />{metal}</mesh>
      <mesh position={[1.4, 0.085, 0.72]}><boxGeometry args={[0.1, 0.045, 0.17]} /><meshStandardMaterial color="#2d6a6a" roughness={0.5} /></mesh>
      <mesh position={[1.42, 0.02, 0.45]}><cylinderGeometry args={[0.016, 0.016, 0.14, 12]} />{metal}</mesh>
    </group>
  );
}

export default function SpinTurntable({ disc, version, motion, className = "" }) {
  return (
    <Canvas className={className} flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: 30, position: [0.5, 4.7, 5.3], near: 0.1, far: 50 }}>
      <hemisphereLight args={["#fff4e0", "#2b2329", 2.6]} />
      <directionalLight position={[-2.5, 4, 2]} intensity={3.2} />
      <directionalLight position={[3, 2, -3]} intensity={1.4} color="#7fc1bd" />
      <Turntable disc={disc} version={version} motion={motion} />
      <OrbitControls makeDefault target={[0.25, -0.15, 0]} enableDamping enablePan={false} minDistance={2.4} maxDistance={8} maxPolarAngle={1.4} />
    </Canvas>
  );
}
