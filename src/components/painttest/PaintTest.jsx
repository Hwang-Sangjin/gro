"use client";
// /lab/paint-test — 고흐풍 유화 밤하늘 배경 셰이더 테스트
// 마우스: 조명 방향 + 판이 살짝 기울어짐 (물감 두께에 맺히는 빛 확인용)
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { NS, vertexShader, fragmentShader } from "./oilSkyShader";

// [x, y, 반지름, 회전] — 자리는 화면 비율(0~1). 회전 ±2 는 빛 없는 큰 소용돌이
const STARS = [
  [0.80, 0.78, 0.11, 1],
  [0.14, 0.82, 0.05, -1],
  [0.33, 0.62, 0.045, 1],
  [0.52, 0.86, 0.04, -1],
  [0.62, 0.50, 0.06, 1],
  [0.22, 0.30, 0.05, 1],
  [0.45, 0.38, 0.16, -2],
  [0.86, 0.25, 0.045, -1],
];

const CONTROLS = [
  { key: "len", label: "붓결 길이", min: 0.02, max: 0.2, step: 0.005 },
  { key: "relief", label: "물감 두께", min: 0, max: 20, step: 0.5 },
  { key: "speed", label: "흐름 속도", min: 0, max: 1, step: 0.02 },
];
const DEFAULTS = { len: 0.09, relief: 8, speed: 0.3 };

function Sky({ params }) {
  const group = useRef();
  const { viewport, size } = useThree();
  const material = useMemo(() => {
    if (STARS.length !== NS) throw new Error(`STARS 는 ${NS}개여야 함`);
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 }, uAspect: { value: 1 }, uResY: { value: 900 },
        uLen: { value: DEFAULTS.len }, uRelief: { value: DEFAULTS.relief }, uSpeed: { value: DEFAULTS.speed },
        uLight: { value: new THREE.Vector3(-0.4, 0.5, 0.5) },
        uStars: { value: STARS.map((s) => new THREE.Vector4(...s)) },
      },
    });
  }, []);

  useFrame((state, dt) => {
    const u = material.uniforms;
    u.uTime.value += dt;
    u.uAspect.value = size.width / size.height;
    u.uResY.value = size.height * state.viewport.dpr;
    u.uLen.value = params.len; u.uRelief.value = params.relief; u.uSpeed.value = params.speed;
    const { x, y } = state.pointer;
    u.uLight.value.lerp(new THREE.Vector3(-0.4 + x * 0.9, 0.5 + y * 0.9, 0.5), 0.08);
    const k = 1 - Math.exp(-dt * 4);
    group.current.rotation.y += (x * 0.07 - group.current.rotation.y) * k;
    group.current.rotation.x += (-y * 0.05 - group.current.rotation.x) * k;
  });

  return (
    <group ref={group}>
      <mesh material={material} scale={[viewport.width * 1.15, viewport.height * 1.15, 1]}>
        <planeGeometry />
      </mesh>
    </group>
  );
}

export default function PaintTest() {
  const [params, setParams] = useState(DEFAULTS);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#060b22" }}>
      <Canvas flat dpr={[1, 1.5]} camera={{ fov: 35, position: [0, 0, 5] }}>
        <Sky params={params} />
      </Canvas>
      <div style={{ position: "absolute", right: 16, bottom: 16, padding: "10px 12px", borderRadius: 8, background: "rgba(6,11,34,.7)", color: "#e9e2c4", font: "12px/1.4 sans-serif", display: "grid", gap: 6 }}>
        {CONTROLS.map((c) => (
          <label key={c.key} style={{ display: "grid", gridTemplateColumns: "70px 140px 36px", alignItems: "center", gap: 8 }}>
            {c.label}
            <input type="range" min={c.min} max={c.max} step={c.step} value={params[c.key]}
              onChange={(e) => setParams((p) => ({ ...p, [c.key]: +e.target.value }))} />
            <span>{params[c.key]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
