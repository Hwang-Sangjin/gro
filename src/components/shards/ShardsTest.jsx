"use client";
// /lab/shards — 표면에 붙은 파편이 커서 근처에서 구 모양으로 밀려나는 효과 예시 (임시, 메뉴에 없음)
// 모델은 일단 구. 바꿀 때는 아래 makeModel() 이 돌려주는 지오메트리 두 개만 바꾸면 됨.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildShards, createShardSim, createShardMaterial } from "./shardsCore";

// 모델: shell = 파편으로 쪼갤 껍질, body = 안쪽 몸체(껍질보다 살짝 작게) — 나중에 GLB 로 교체
function makeModel(detail) {
  return {
    shell: new THREE.IcosahedronGeometry(1, detail),       // 삼각형 크기가 고름 (20 × (detail+1)² 개)
    body: new THREE.SphereGeometry(0.975, 96, 64),
  };
}

const DETAILS = [
  { label: "2만", detail: 31 },
  { label: "5만", detail: 49 },
  { label: "10만", detail: 70 },
];

function Shards({ detail, radius, back, hold, spin, onCount }) {
  const gl = useThree((s) => s.gl);
  const group = useRef();
  const body = useRef();

  const model = useMemo(() => makeModel(detail), [detail]);
  const shards = useMemo(() => buildShards(model.shell), [model]);
  const sim = useMemo(() => createShardSim(shards), [shards]);
  const shell = useMemo(() => createShardMaterial(), []);

  useEffect(() => { onCount(shards.count); }, [shards, onCount]);
  useEffect(() => () => {
    sim.dispose(); shards.geometry.dispose(); shards.restTexture.dispose(); shards.faceTexture.dispose();
    model.shell.dispose(); model.body.dispose();
  }, [sim, shards, model]);
  useEffect(() => () => shell.material.dispose(), [shell]);

  // 커서: 화면 위에 있는지 + 지금 세기(0 → 1 로 부드럽게)
  const over = useRef(false);
  const strength = useRef(0);
  const local = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const el = gl.domElement;
    const enter = () => { over.current = true; };
    const leave = () => { over.current = false; };
    el.addEventListener("pointermove", enter);
    el.addEventListener("pointerdown", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
    return () => {
      el.removeEventListener("pointermove", enter);
      el.removeEventListener("pointerdown", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("pointercancel", leave);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    if (spin) group.current.rotation.y += dt * 0.15;

    // 몸체(껍질 아님)에 광선을 쏴서 커서가 닿은 표면 위 점을 구함 — 모델이 돌아도 매 프레임 다시 구함
    let hit = null;
    if (over.current) {
      state.raycaster.setFromCamera(state.pointer, state.camera);
      hit = state.raycaster.intersectObject(body.current, false)[0];
    }
    const u = sim.uniforms;
    if (hit) {
      group.current.worldToLocal(local.copy(hit.point));
      if (strength.current < 0.02) u.uMouse.value.copy(local);          // 처음 닿을 때는 바로 그 자리에서 시작
      else u.uMouse.value.lerp(local, 1 - Math.exp(-20 * dt));
    }
    strength.current += ((hit ? 1 : 0) - strength.current) * (1 - Math.exp(-(hit ? 10 : 5) * dt));

    u.uRadius.value = radius * strength.current;
    u.uBack.value = back;
    u.uHold.value = hold;
    sim.step(gl, dt);

    shell.uniforms.uState.value = sim.texture;
    shell.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={group}>
      {/* 안쪽 몸체: 유리처럼 비쳐서 뒤로 밀려난 파편이 보임 */}
      <mesh ref={body} geometry={model.body}>
        <meshPhysicalMaterial
          color="#58c9c0" roughness={0.18} metalness={0}
          transmission={1} thickness={1.4} ior={1.35}
          attenuationColor="#45cfc6" attenuationDistance={2.5}
          emissive="#12807c" emissiveIntensity={0.45}
        />
      </mesh>
      {/* 파편 껍질: 꼭짓점이 셰이더에서 움직이므로 화면 밖 판정은 끔 */}
      <mesh geometry={shards.geometry} material={shell.material} frustumCulled={false} />
    </group>
  );
}

// 배경(위아래 그라데이션) + 반사용 환경 + 좁은 화면에서 카메라 물리기
function Stage() {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;

    const cv = document.createElement("canvas");
    cv.width = 4; cv.height = 256;
    const ctx = cv.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#0c2a5e");
    grad.addColorStop(1, "#2f6fb5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    const bg = new THREE.CanvasTexture(cv);
    bg.colorSpace = THREE.SRGBColorSpace;
    scene.background = bg;

    return () => {
      scene.environment = null; scene.background = null;
      env.dispose(); bg.dispose(); pmrem.dispose(); room.dispose?.();
    };
  }, [gl, scene]);

  useEffect(() => {
    camera.position.set(0, 0, 4.4 * Math.max(1, 0.85 / (size.width / size.height)));
    camera.lookAt(0, 0, 0);
  }, [camera, size]);

  return (
    <>
      <directionalLight position={[-3, 4, 5]} intensity={2.2} />
      <directionalLight position={[4, -1, -3]} intensity={0.5} color="#9fd0ff" />
    </>
  );
}

function Slider({ label, value, min, max, step, onChange, unit = "" }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "5.5em 1fr 3.2em", alignItems: "center", gap: 8 }}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
    </label>
  );
}

export default function ShardsTest() {
  const [detailIdx, setDetailIdx] = useState(1);
  const [radius, setRadius] = useState(0.55);
  const [back, setBack] = useState(2.2);
  const [hold, setHold] = useState(0.9);
  const [spin, setSpin] = useState(true);
  const [count, setCount] = useState(0);

  return (
    <div lang="ko" style={{ position: "fixed", inset: 0, background: "#0c2a5e", touchAction: "none" }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 35, near: 0.1, far: 50, position: [0, 0, 4.4] }}>
        <Stage />
        <Shards
          key={detailIdx}
          detail={DETAILS[detailIdx].detail}
          radius={radius} back={back} hold={hold} spin={spin}
          onCount={setCount}
        />
      </Canvas>

      <div
        style={{
          position: "absolute", left: 16, bottom: 16, width: "min(300px, calc(100vw - 32px))",
          display: "grid", gap: 8, padding: "12px 14px", borderRadius: 12,
          background: "rgba(8, 20, 44, 0.72)", color: "#e8eefb", font: "13px/1.4 system-ui, sans-serif",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong>파편 껍질</strong>
          <span style={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>파편 {count.toLocaleString()}개</span>
        </div>
        <Slider label="구 반지름" value={radius} min={0.2} max={1} step={0.05} onChange={setRadius} />
        <Slider label="머무는 시간" value={hold} min={0.1} max={3} step={0.1} onChange={setHold} unit="초" />
        <Slider label="복귀 빠르기" value={back} min={0.5} max={8} step={0.1} onChange={setBack} />
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ width: "5.5em" }}>파편 수</span>
          {DETAILS.map((d, i) => (
            <button
              key={d.label} type="button" onClick={() => setDetailIdx(i)} aria-pressed={i === detailIdx}
              style={{
                padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(232,238,251,0.4)", cursor: "pointer",
                background: i === detailIdx ? "#e8eefb" : "transparent", color: i === detailIdx ? "#0c2a5e" : "inherit",
              }}
            >
              {d.label}
            </button>
          ))}
          <label style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} />
            회전
          </label>
        </div>
      </div>
    </div>
  );
}
