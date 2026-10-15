"use client";
// "What is a record?" — 바늘이 홈을 따라가는 3D 장면
// 스크롤(progress 0→1)에 따라 카메라가 판 위 → 바늘 옆 아주 가까이로 내려감
// 판은 33⅓ rpm 으로 돌고, 바늘 끝은 홈의 굴곡을 따라 아주 살짝 떨림
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const RPS = (100 / 3) / 60;                // 33⅓ rpm → 초당 바퀴
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const TIP = [1.55, 0.012, 0.25];
const ARM_PIVOT = [2.5, 0.13, -1.45];   // 판(반지름 2) 바깥 오른쪽 뒤

// 홈이 보이는 판 표면 (캔버스로 그린 동심원 + 라벨)
function useDiscTexture(ink, label) {
  return useMemo(() => {
    const size = 2048, c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d"), mid = size / 2;
    g.fillStyle = "#17121a"; g.fillRect(0, 0, size, size);
    for (let r = mid * 0.36; r < mid * 0.985; r += 2.2) {
      const gap = [0.52, 0.64, 0.77, 0.88].some((k) => Math.abs(r / mid - k) < 0.006);   // 곡 사이 빈 홈
      g.strokeStyle = gap ? "rgba(255,255,255,.02)" : `rgba(${ink},${0.05 + Math.random() * 0.07})`;
      g.lineWidth = 1.1;
      g.beginPath(); g.arc(mid, mid, r, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = label; g.beginPath(); g.arc(mid, mid, mid * 0.33, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a222a"; g.beginPath(); g.arc(mid, mid, mid * 0.02, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [ink, label]);
}

function Rig({ progress, ink, label, head }) {
  const disc = useRef(null), stylus = useRef(null);
  const { camera } = useThree();
  const tex = useDiscTexture(ink, label);
  const look = useMemo(() => new THREE.Vector3(), []);
  // 바늘이 닿는 자리 (판 오른쪽 바깥 홈)
  const tip = useMemo(() => new THREE.Vector3(...TIP), []);
  // 톤암 방향(바늘 → 피벗)으로 헤드셸을 돌리고, 헤드셸 뒤끝에서 피벗까지 원통을 이음
  const arm = useMemo(() => {
    const flat = new THREE.Vector3(ARM_PIVOT[0] - TIP[0], 0, ARM_PIVOT[2] - TIP[2]).normalize();
    const yaw = Math.atan2(-flat.z, flat.x);                          // 로컬 +x 가 피벗 쪽을 보게
    const a = new THREE.Vector3(TIP[0], TIP[1] + 0.097, TIP[2]).addScaledVector(flat, 0.28);
    const b = new THREE.Vector3(...ARM_PIVOT);
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    return {
      yaw, len,
      mid: a.clone().add(b).multiplyScalar(0.5).toArray(),
      weight: b.clone().addScaledVector(dir, 0.22).toArray(),         // 피벗 뒤 균형추
      q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    };
  }, []);

  useFrame((state, dt) => {
    const t = ease(progress.current);
    if (disc.current) disc.current.rotation.y -= RPS * Math.PI * 2 * Math.min(dt, 0.05);
    // 바늘 끝 미세 진동 (음악이 홈을 흔드는 느낌)
    if (stylus.current) stylus.current.position.y = 0.0015 * Math.sin(state.clock.elapsedTime * 90) * (0.4 + t);
    // 카메라: 판 위 비스듬히 → 바늘 옆 매크로
    // 세로 화면(폰)은 판이 잘리지 않게 조금 멀리·넓게, 처음부터 바늘 쪽을 봄
    const tall = state.size.width < state.size.height;
    camera.position.set(lerp(tall ? 1.2 : 0.4, tip.x + 0.42, t), lerp(tall ? 4.6 : 3.4, 0.11, t), lerp(tall ? 3.6 : 3.3, tip.z + (tall ? 0.7 : 0.55), t));
    look.set(lerp(tall ? 1.1 : 0, tip.x, t), lerp(0, tip.y, t), lerp(tall ? -0.2 : 0, tip.z, t));
    camera.lookAt(look);
    camera.fov = lerp(tall ? 52 : 38, tall ? 40 : 30, t); camera.updateProjectionMatrix();
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} />
      <pointLight position={[tip.x + 0.3, 0.25, tip.z + 0.3]} intensity={0.7} distance={2} color="#f4e7cd" />
      {/* 판 + 플래터 */}
      <mesh position={[0, -0.03, 0]}><cylinderGeometry args={[2.05, 2.05, 0.04, 96]} /><meshStandardMaterial color="#2a222a" metalness={0.6} roughness={0.5} /></mesh>
      <group ref={disc}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2, 160]} /><meshStandardMaterial map={tex} roughness={0.32} metalness={0.15} /></mesh>
        <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.025, 0.025, 0.05, 16]} /><meshStandardMaterial color="#c9c3bd" metalness={0.9} roughness={0.25} /></mesh>
      </group>
      {/* 바늘 끝 → 카트리지 → 헤드셸 (톤암 방향으로 나란히) */}
      <group position={tip} rotation={[0, arm.yaw, 0]}>
        <group ref={stylus}>
          <mesh position={[0, 0.007, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.006, 0.014, 12]} /><meshStandardMaterial color="#e8f1ff" metalness={0.2} roughness={0.05} /></mesh>
          <mesh position={[0.03, 0.022, 0]} rotation={[0, 0, -1.05]}><cylinderGeometry args={[0.003, 0.003, 0.07, 8]} /><meshStandardMaterial color="#bfb8b0" metalness={0.9} roughness={0.2} /></mesh>
          <mesh position={[0.11, 0.06, 0]}><boxGeometry args={[0.13, 0.06, 0.07]} /><meshStandardMaterial color={head} roughness={0.45} /></mesh>
          <mesh position={[0.17, 0.097, 0]}><boxGeometry args={[0.24, 0.014, 0.1]} /><meshStandardMaterial color="#d8d2ca" metalness={0.85} roughness={0.25} /></mesh>
        </group>
      </group>
      {/* 톤암: 헤드셸 뒤끝에서 판 밖 피벗까지 */}
      <mesh position={arm.mid} quaternion={arm.q}>
        <cylinderGeometry args={[0.016, 0.02, arm.len, 16]} /><meshStandardMaterial color="#d8d2ca" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[ARM_PIVOT[0], 0.03, ARM_PIVOT[2]]}><cylinderGeometry args={[0.09, 0.11, 0.2, 24]} /><meshStandardMaterial color="#2a222a" metalness={0.7} roughness={0.35} /></mesh>
      <mesh position={arm.weight} quaternion={arm.q}><cylinderGeometry args={[0.07, 0.07, 0.14, 24]} /><meshStandardMaterial color="#8d867f" metalness={0.8} roughness={0.3} /></mesh>
    </>
  );
}

// progress: { current: 0..1 } (ScrollScene onProgress 로 채우거나 고정값). 화면에 있을 때만 그림
// ink: 홈 선 색 "r,g,b" · label: 라벨 색 · head: 카트리지(헤드) 색
export default function NeedleScene({ progress, className = "", ink = "187,203,218", label = "#bbcbda", head = "#c8553d" }) {
  const box = useRef(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = box.current;
    const io = new IntersectionObserver(([e]) => setLive(e.isIntersecting), { root: el?.closest(".page") ?? null });
    if (el) io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={className}>
      <Canvas frameloop={live ? "always" : "never"} dpr={[1, 1.75]} camera={{ fov: 38, near: 0.01, far: 50, position: [0.4, 3.4, 3.3] }} gl={{ antialias: true, alpha: true }}>
        <Rig progress={progress} ink={ink} label={label} head={head} />
      </Canvas>
    </div>
  );
}
