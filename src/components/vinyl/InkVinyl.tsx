"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  discFrag,
  discVert,
  hexToRgb,
  inkDefaults,
  shadowFrag,
  shadowVert,
} from "./inkShaders";

import { SpinHalo } from './SpinHalo';
import { useDiscInput } from './useDiscInput';
import { HERO_MOTION, heroInteraction, heroIsActive } from '../home/heroInteraction';

type InkParams = typeof inkDefaults;

type InkVinylProps = Partial<InkParams> & {
  url?: string;
  /** 잉크 선 색 (sRGB hex) */
  ink?: string;
  /** 라벨 면 색 (sRGB hex) */
  label?: string;
  /** 회전 속도. 0 = 정지 (값이 바뀌면 부드럽게 가속·감속) */
  rpm?: number;
  /** 멈춰 있다가 회전을 시작하기까지 기다리는 시간(초). active가 true가 된 시점부터 셈 */
  startDelay?: number;
  /** 정지 → 목표 속도까지 가속하는 시간(초). 클수록 천천히 출발 */
  spinEase?: number;
  /** 회전 시작 트리거. 인트로/로딩이 끝난 뒤 true로 넘기면 그때부터 startDelay를 셈 */
  active?: boolean;
  /** 커서 위치로 빛줄기를 움직일지 */
  followPointer?: boolean;
  /** 테두리를 일러스트처럼 두껍게 (모델 Y 스케일) */
  thickness?: number;
  /** 빛줄기 방향(도). 0 = 화면상 타원 장축 방향 (구도와 무관하게 자동 계산) */
  streakAngle?: number;
  /** 빛줄기 선명도. 0.2 = 넓고 흐림, 0.7 = 가늘고 선명 (권장 0.3~0.6) */
  streakSpread?: number;
} & ThreeElements["group"];

/** 빛이 디스크 평면과 이루는 최소 높이 (sin 값). 셰이더의 dot(N, L) 게이트를 통과시키기 위함 */
const MIN_LIGHT_Y = 0.3;

/** 직교 카메라일 때 셰이더용 눈 위치를 시선 반대 방향으로 이만큼 멀리 둠 (월드 단위) */
const ORTHO_EYE_DISTANCE = 1000;

const isFiniteVec = (v: THREE.Vector3) =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

export function InkVinyl({
  url = "/models/vinyl.glb",
  ink = "#4f6d93",
  label = "#bbcbda",
  rpm = 8,
  startDelay = 1,
  spinEase = 3,
  active = true,
  followPointer = true,
  thickness = 1.8,
  streakAngle = 0,
  streakSpread = 0.45,
  ...rest
}: InkVinylProps) {
  // props를 셰이더 파라미터와 group props로 분리
  const params = { ...inkDefaults };
  const groupProps: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k in inkDefaults) (params as Record<string, number>)[k] = v as number;
    else groupProps[k] = v;
  }

  const { scene } = useGLTF(url, "/draco/");
  const { camera, pointer, invalidate } = useThree();
  const size = useThree((s) => s.size);
  // tilt/roll/scale이 적용되는 그룹 (spin 바깥). 빛줄기 방향의 기준 좌표계
  const compRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const omega = useRef(0);
  const elapsed = useRef(0);
  const startedAt = useRef<number | null>(null); // active가 처음 true가 된 시각(초)

  const uniforms = useMemo(
    () => ({
      uInk: { value: new THREE.Vector3() },
      uLabel: { value: new THREE.Vector3() },
      // 첫 프레임 전에도 셰이더가 유효한 값을 받도록 기본값을 넣어둠 (0 벡터면 normalize가 NaN)
      uCamLocal: { value: new THREE.Vector3(0, 3, 3) },
      uLightLocal: { value: new THREE.Vector3(0, 1, 0) },
      uLineFreq: { value: inkDefaults.lineFreq },
      uStreak: { value: inkDefaults.streak },
      uSharp: { value: inkDefaults.sharp },
      uRough: { value: inkDefaults.rough },
      uWobble: { value: inkDefaults.wobble },
      uBase: { value: inkDefaults.base },
      uTrackCount: { value: inkDefaults.trackCount },
      uGapWidth: { value: inkDefaults.gapWidth },
      uInnerR: { value: inkDefaults.innerR },
      uOuterR: { value: inkDefaults.outerR },
      uLabelR: { value: inkDefaults.labelR },
      uHoleR: { value: inkDefaults.holeR },
      uTopY: { value: inkDefaults.topY },
      uBotY: { value: inkDefaults.botY },
    }),
    [],
  );

  const shadowUniforms = useMemo(
    () => ({
      uInk: uniforms.uInk, // 디스크와 같은 잉크 색 공유
      uRough: uniforms.uRough,
      uCenter: { value: new THREE.Vector2(0.12, 0.1) },
      uRadius: { value: new THREE.Vector2(1.12, 0.92) },
      uShadow: { value: inkDefaults.shadow },
    }),
    [uniforms],
  );

  const { inkMat, depthMat, shadowMat } = useMemo(() => {
    const inkMat = new THREE.ShaderMaterial({
      vertexShader: discVert,
      fragmentShader: discFrag,
      uniforms,
      transparent: true,
      premultipliedAlpha: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    // 디스크를 "불투명한 종이"로: 색은 안 쓰고 depth만 먼저 기록
    const depthMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const shadowMat = new THREE.ShaderMaterial({
      vertexShader: shadowVert,
      fragmentShader: shadowFrag,
      uniforms: shadowUniforms,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      toneMapped: false,
    });
    return { inkMat, depthMat, shadowMat };
  }, [uniforms, shadowUniforms]);

  // 모델 복제 → 메시마다 depth 프리패스 + 잉크 패스
  // 주의: useMemo 안에서 ref에 대입하면 안 됨. StrictMode(개발 모드)는 이 함수를 두 번 실행하고
  // 결과 하나만 쓰기 때문에, ref가 화면에 없는 복제본의 메시를 가리키게 됨.
  // → model과 disc를 같은 호출의 결과로 함께 반환해서 항상 짝이 맞게 함
  const { model, disc, pickTargets } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.scale.set(1, thickness, 1);
    const meshes: THREE.Mesh[] = [];
    cloned.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    for (const m of meshes) {
      const pre = new THREE.Mesh(m.geometry, depthMat);
      pre.position.copy(m.position);
      pre.quaternion.copy(m.quaternion);
      pre.scale.copy(m.scale);
      pre.renderOrder = 0;
      m.parent?.add(pre);
      m.material = inkMat;
      m.renderOrder = 2;
    }
    return { model: cloned, disc: meshes[0] ?? null, pickTargets: meshes };
  }, [scene, inkMat, depthMat, thickness]);

  useDiscInput(pickTargets);

  // props → uniforms
  useEffect(() => {
    uniforms.uInk.value.set(...hexToRgb(ink));
    uniforms.uLabel.value.set(...hexToRgb(label));
    uniforms.uLineFreq.value = params.lineFreq;
    uniforms.uStreak.value = params.streak;
    uniforms.uSharp.value = params.sharp;
    uniforms.uRough.value = params.rough;
    uniforms.uWobble.value = params.wobble;
    uniforms.uBase.value = params.base;
    uniforms.uTrackCount.value = params.trackCount;
    uniforms.uGapWidth.value = params.gapWidth;
    uniforms.uInnerR.value = params.innerR;
    uniforms.uOuterR.value = params.outerR;
    uniforms.uLabelR.value = params.labelR;
    uniforms.uHoleR.value = params.holeR;
    uniforms.uTopY.value = params.topY;
    uniforms.uBotY.value = params.botY;
    shadowUniforms.uShadow.value = params.shadow;
    invalidate();
  });

  // 모델 준비·화면 크기 변경 시 한 프레임 강제 → useFrame이 빛 방향을 반드시 다시 계산
  useEffect(() => {
    invalidate();
  }, [size, model, invalidate]);

  useEffect(
    () => () => {
      inkMat.dispose();
      depthMat.dispose();
      shadowMat.dispose();
    },
    [inkMat, depthMat, shadowMat],
  );

  const inv = useMemo(() => new THREE.Matrix4(), []);
  const compInv = useMemo(() => new THREE.Matrix4(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camLocal = useMemo(() => new THREE.Vector3(), []);
  const camFwd = useMemo(() => new THREE.Vector3(), []);
  const eyeWorld = useMemo(() => new THREE.Vector3(), []);
  const viewDir = useMemo(() => new THREE.Vector3(), []);
  const half = useMemo(() => new THREE.Vector3(), []);
  const viewFlat = useMemo(() => new THREE.Vector3(), []);
  const major = useMemo(() => new THREE.Vector3(), []);
  const lightDir = useMemo(() => new THREE.Vector3(), []);
  const smooth = useMemo(() => new THREE.Vector2(), []);
  const zero = useMemo(() => new THREE.Vector2(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // One angular velocity drives the record, DOM cursor and halo.
    const enabled = active && heroIsActive() && !heroInteraction.reduced;
    if (active && startedAt.current === null) {
      startedAt.current = performance.now() / 1000;
      elapsed.current = 0;
    }
    if (!active) { startedAt.current = null; elapsed.current = 0; }
    if (enabled) elapsed.current += dt;
    const t = elapsed.current - startDelay;
    const ramp = t <= 0 ? 0 : spinEase <= 0 || t >= spinEase ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * t / spinEase);
    const motorOmega = -(rpm * ramp / 60) * Math.PI * 2;
    if (!enabled) {
      omega.current = 0;
      heroInteraction.holding = false;
    } else if (heroInteraction.holding) {
      const dir = Math.sign(motorOmega) || -1;
      const maxOmega = HERO_MOTION.maxRpm / 60 * Math.PI * 2;
      omega.current = THREE.MathUtils.clamp(omega.current + dir * HERO_MOTION.accel * dt, -maxOmega, maxOmega);
    } else {
      omega.current += (motorOmega - omega.current) * (1 - Math.exp(-dt / Math.max(HERO_MOTION.inertia / 3, 0.01)));
    }
    if (spinRef.current) spinRef.current.rotation.y = (spinRef.current.rotation.y + omega.current * dt) % (Math.PI * 2);
    heroInteraction.omega = omega.current;
    heroInteraction.angle = spinRef.current?.rotation.y ?? 0;
    if (enabled && (rpm !== 0 || Math.abs(omega.current) > 0.0001 || followPointer)) invalidate();

    // 커서 위치를 부드럽게 따라감 (R3F pointer는 y가 위로 +)
    smooth.lerp(followPointer ? pointer : zero, 1 - Math.exp(-dt * 3));

    const comp = compRef.current;
    if (!comp || !disc) return;

    // 1) 카메라 방향을 '레코드 평면 좌표계'로 (tilt/roll만 반영, spin 제외)
    comp.updateWorldMatrix(true, false);
    disc.updateWorldMatrix(true, false);
    // 스케일 0(캔버스 크기 측정 전, 등장 애니메이션 시작 등)이면 역행렬이 없음
    // → 이번 프레임은 건너뛰고 이전 값을 유지 (0 벡터가 들어가 빛줄기가 꺼지는 것 방지)
    if (
      Math.abs(comp.matrixWorld.determinant()) < 1e-10 ||
      Math.abs(disc.matrixWorld.determinant()) < 1e-10
    ) {
      invalidate();
      return;
    }
    compInv.copy(comp.matrixWorld).invert();

    // 셰이더에 넘길 '눈 위치'(월드)
    //  - 원근 카메라: 실제 카메라 위치
    //  - 직교 카메라: 시선이 모두 평행하므로, 시선 반대 방향으로 아주 멀리 둔 점
    //    (카메라 위치를 그대로 쓰면 레코드가 카메라 거리만큼 크게 스케일될 때
    //     픽셀마다 시선이 크게 틀어져 빛줄기가 엉뚱하게 계산됨)
    camera.getWorldDirection(camFwd);
    camera.getWorldPosition(eyeWorld);
    const isOrtho =
      (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    if (isOrtho) eyeWorld.addScaledVector(camFwd, -ORTHO_EYE_DISTANCE);

    if (isOrtho) {
      viewDir.copy(camFwd).negate().transformDirection(compInv);
    } else {
      viewDir.copy(eyeWorld).applyMatrix4(compInv).normalize();
    }

    // 2) 화면상 타원의 장축 방향을 '시선' 기준으로 구함
    //    시선의 평면 성분(viewFlat)과 수직인 평면 방향 = 화면에서 가장 길게 보이는 축
    //    → 그룹을 어떤 순서로 회전시켰는지와 무관하게 항상 같은 결과
    viewFlat.set(viewDir.x, 0, viewDir.z);
    if (viewFlat.lengthSq() < 1e-6) viewFlat.set(0, 0, 1); // 정면에서 내려다볼 때
    viewFlat.normalize();
    major.set(-viewFlat.z, 0, viewFlat.x);

    // 3) 원하는 하프 벡터 H
    //    평면 성분 방향 = 장축을 streakAngle만큼 돌린 방향, 크기 = 선명도
    //    커서 x는 빛줄기를 회전, 커서 y는 선명도를 살짝 조절
    const a = THREE.MathUtils.degToRad(streakAngle) + smooth.x * 0.6;
    const m = THREE.MathUtils.clamp(streakSpread + smooth.y * 0.15, 0.1, 0.9);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    half
      .set(major.x * ca + viewFlat.x * sa, 0, major.z * ca + viewFlat.z * sa)
      .multiplyScalar(m);
    half.y = 1;
    half.normalize();

    // 4) 이 H를 만들어내는 빛 방향: L = 2(H·V)H − V
    lightDir
      .copy(half)
      .multiplyScalar(2 * half.dot(viewDir))
      .sub(viewDir)
      .normalize();
    // 빛이 디스크 평면 아래로 내려가면 셰이더가 빛줄기를 꺼버리므로 최소 높이 보장
    if (lightDir.y < MIN_LIGHT_Y) {
      lightDir.y = MIN_LIGHT_Y;
      lightDir.normalize();
    }

    // 5) 레코드 좌표계 → 월드 → 회전 중인 디스크 메시 로컬
    lightDir.transformDirection(comp.matrixWorld);
    inv.copy(disc.matrixWorld).invert();
    camLocal.copy(eyeWorld).applyMatrix4(inv);
    tmp.copy(lightDir).transformDirection(inv);
    // 계산 결과가 유효할 때만 반영
    if (isFiniteVec(camLocal) && isFiniteVec(tmp) && tmp.lengthSq() > 0.5) {
      uniforms.uCamLocal.value.copy(camLocal);
      uniforms.uLightLocal.value.copy(tmp);
    }
  }, -0.5); // After camera/picking, before halo.

  return (
    <group ref={compRef} {...(groupProps as ThreeElements["group"])}>
      <SpinHalo inkUniform={uniforms.uInk} compRef={compRef} />
      {/* 바닥 그림자: 디스크 depth 뒤에 그려져야 하므로 renderOrder 1 */}
      <mesh
        position-y={-0.42}
        rotation-x={-Math.PI / 2}
        renderOrder={1}
        material={shadowMat}
      >
        <planeGeometry args={[6, 6]} />
      </mesh>
      <group>
        <group ref={spinRef}>
          <primitive object={model} dispose={null} />
        </group>
      </group>
    </group>
  );
}

// Loaded only inside the dynamically imported Hero Canvas.
