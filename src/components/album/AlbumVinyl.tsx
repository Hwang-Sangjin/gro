"use client";

/* 앨범 상세의 3D 바이닐 — Home과 같은 잉크 드로잉 판(vinyl.glb + inkShaders).
   Home Hero의 인터랙션(누르기·헤일로)과는 분리된 단독 컴포넌트:
   - 재생 중이면 앨범 RPM으로 돌고, 멈추면 관성으로 서서히 멈춤
   - 정면을 살짝 기울여 두께와 빛줄기가 보이게, 마우스를 따라 빛줄기가 움직임 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { discFrag, discVert, hexToRgb, inkDefaults } from "../vinyl/inkShaders";

// face: 0 = 앞면(A·C), 1 = 뒷면(B·D). 바뀌면 판을 세로축으로 반 바퀴 뒤집음. snap이면 애니메이션 없이 바로
type Props = { ink: string; label: string; rpm: number; playing: boolean; face?: number; snap?: boolean };

const TILT = THREE.MathUtils.degToRad(76);   // 90 = 완전 정면. 조금 눕혀 옆면이 살짝 보이게
const ORTHO_EYE = 1000;
const FLIP = { duration: 0.9, lift: 0.07 };  // 뒤집기 시간(초), 뒤집는 동안 살짝 떠오르는 정도(배율)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function Disc({ ink, label, rpm, playing, face = 0, snap = false }: Props) {
  const { scene } = useGLTF("/models/vinyl.glb", "/draco/");
  const { camera, pointer, invalidate, size } = useThree();
  const comp = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const omega = useRef(0);
  const flip = useRef<THREE.Group>(null);
  // 뒤집기: 같은 방향으로 계속 반 바퀴씩 (A→B→A가 되감기처럼 보이지 않게)
  const flipState = useRef({ from: face * Math.PI, to: face * Math.PI, t: 1, face });
  const reduced = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const uniforms = useMemo(() => ({
    uInk: { value: new THREE.Vector3() }, uLabel: { value: new THREE.Vector3() },
    uCamLocal: { value: new THREE.Vector3(0, 3, 3) }, uLightLocal: { value: new THREE.Vector3(0, 1, 0) },
    uLineFreq: { value: inkDefaults.lineFreq }, uStreak: { value: inkDefaults.streak }, uSharp: { value: inkDefaults.sharp },
    uRough: { value: inkDefaults.rough }, uWobble: { value: inkDefaults.wobble }, uBase: { value: inkDefaults.base },
    uTrackCount: { value: inkDefaults.trackCount }, uGapWidth: { value: inkDefaults.gapWidth },
    uInnerR: { value: inkDefaults.innerR }, uOuterR: { value: inkDefaults.outerR },
    uLabelR: { value: inkDefaults.labelR }, uHoleR: { value: inkDefaults.holeR },
    uTopY: { value: inkDefaults.topY }, uBotY: { value: inkDefaults.botY },
  }), []);

  const { inkMat, depthMat } = useMemo(() => ({
    inkMat: new THREE.ShaderMaterial({ vertexShader: discVert, fragmentShader: discFrag, uniforms, transparent: true, premultipliedAlpha: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
    depthMat: new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  }), [uniforms]);
  useEffect(() => () => { inkMat.dispose(); depthMat.dispose(); }, [inkMat, depthMat]);

  // 모델 복제 → 메시마다 depth 프리패스 + 잉크 패스 (Home과 같은 방식)
  const { model, disc } = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.scale.set(1, 1.8, 1);
    const meshes: THREE.Mesh[] = [];
    cloned.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    for (const m of meshes) {
      const pre = new THREE.Mesh(m.geometry, depthMat);
      pre.position.copy(m.position); pre.quaternion.copy(m.quaternion); pre.scale.copy(m.scale);
      pre.renderOrder = 0;
      m.parent?.add(pre);
      m.material = inkMat; m.renderOrder = 2;
    }
    return { model: cloned, disc: meshes[0] ?? null };
  }, [scene, inkMat, depthMat]);

  useEffect(() => {
    uniforms.uInk.value.set(...hexToRgb(ink));
    uniforms.uLabel.value.set(...hexToRgb(label));
    invalidate();
  }, [ink, label, uniforms, invalidate]);

  // frameloop="demand"라 재생 상태가 바뀌면 직접 깨워야 useFrame이 돌기 시작함 (이후엔 회전 중 계속 invalidate)
  useEffect(() => { invalidate(); }, [playing, rpm, invalidate]);

  useEffect(() => {
    const f = flipState.current;
    if (f.face === face) return;
    f.face = face;
    const now = f.from + (f.to - f.from) * easeInOut(f.t);  // 뒤집는 도중에 또 바뀌어도 지금 각도에서 이어감
    if (snap || reduced) { f.from = f.to = face * Math.PI; f.t = 1; }
    else { f.from = now; f.to = f.to + Math.PI; f.t = 0; }
    invalidate();
  }, [face, snap, reduced, invalidate]);

  // 판이 캔버스를 꽉 채우게 (반지름 1 + 옆면 여유)
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(size.width, size.height) / 2 / 1.03;
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);

  const inv = useMemo(() => new THREE.Matrix4(), []);
  const compInv = useMemo(() => new THREE.Matrix4(), []);
  const v = useMemo(() => ({ fwd: new THREE.Vector3(), eye: new THREE.Vector3(), view: new THREE.Vector3(), flat: new THREE.Vector3(), major: new THREE.Vector3(), half: new THREE.Vector3(), light: new THREE.Vector3(), cam: new THREE.Vector3(), tmp: new THREE.Vector3(), smooth: new THREE.Vector2() }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    // 재생 중이면 앨범 RPM으로 가속, 멈추면 관성으로 감속
    const target = playing && !reduced ? -(rpm / 60) * Math.PI * 2 : 0;
    omega.current += (target - omega.current) * (1 - Math.exp(-dt / (playing ? 0.6 : 1.1)));
    if (spin.current) spin.current.rotation.y = (spin.current.rotation.y + omega.current * dt) % (Math.PI * 2);
    v.smooth.lerp(pointer, 1 - Math.exp(-dt * 3));
    const f = flipState.current;
    if (f.t < 1) f.t = Math.min(1, f.t + dt / FLIP.duration);
    if (flip.current) {
      const k = easeInOut(f.t);
      flip.current.rotation.y = f.from + (f.to - f.from) * k;
      flip.current.scale.setScalar(1 + FLIP.lift * Math.sin(Math.PI * k));
    }
    const moving = Math.abs(omega.current) > 0.001 || v.smooth.distanceTo(pointer) > 0.002 || f.t < 1;

    // 빛줄기 방향 (InkVinyl과 같은 계산: 화면상 장축 기준 + 커서로 살짝 회전)
    const c = comp.current;
    if (c && disc) {
      c.updateWorldMatrix(true, false); disc.updateWorldMatrix(true, false);
      if (Math.abs(disc.matrixWorld.determinant()) > 1e-10) {
        compInv.copy(c.matrixWorld).invert();
        camera.getWorldDirection(v.fwd); camera.getWorldPosition(v.eye);
        v.eye.addScaledVector(v.fwd, -ORTHO_EYE);
        v.view.copy(v.fwd).negate().transformDirection(compInv);
        v.flat.set(v.view.x, 0, v.view.z);
        if (v.flat.lengthSq() < 1e-6) v.flat.set(0, 0, 1);
        v.flat.normalize();
        v.major.set(-v.flat.z, 0, v.flat.x);
        const a = v.smooth.x * 0.7, m = THREE.MathUtils.clamp(0.45 + v.smooth.y * 0.15, 0.1, 0.9);
        v.half.set(v.major.x * Math.cos(a) + v.flat.x * Math.sin(a), 0, v.major.z * Math.cos(a) + v.flat.z * Math.sin(a)).multiplyScalar(m);
        // 뒤집혀 아랫면이 보이면(view.y < 0) 빛도 아랫면 쪽으로 — 어느 면이든 같은 빛줄기
        const sgn = v.view.y < 0 ? -1 : 1;
        v.half.y = sgn; v.half.normalize();
        v.light.copy(v.half).multiplyScalar(2 * v.half.dot(v.view)).sub(v.view).normalize();
        if (v.light.y * sgn < 0.3) { v.light.y = 0.3 * sgn; v.light.normalize(); }
        v.light.transformDirection(c.matrixWorld);
        inv.copy(disc.matrixWorld).invert();
        v.cam.copy(v.eye).applyMatrix4(inv);
        v.tmp.copy(v.light).transformDirection(inv);
        uniforms.uCamLocal.value.copy(v.cam);
        uniforms.uLightLocal.value.copy(v.tmp);
      }
    }
    if (moving) invalidate();
  });

  return (
    <group ref={flip}>
      <group ref={comp} rotation={[TILT, 0, 0]}>
        <group ref={spin}>
          <primitive object={model} dispose={null} />
        </group>
      </group>
    </group>
  );
}

export default function AlbumVinyl(props: Props) {
  return (
    <Canvas orthographic camera={{ position: [0, 0, 100], zoom: 100, near: 0.1, far: 400 }}
      gl={{ alpha: true, antialias: true, premultipliedAlpha: true }} dpr={[1, 2]}
      // 재생 중엔 매 프레임 그림(회전이 확실히 이어지게). 멈추면 demand로 돌아가 관성으로 서는 동안만 그림
      frameloop={props.playing ? "always" : "demand"}
      resize={{ offsetSize: true }} className="!absolute inset-0" aria-hidden="true">
      <Suspense fallback={null}><Disc {...props} /></Suspense>
    </Canvas>
  );
}
