"use client";
// Brick 3D 판 — 32×32 판 앞뒤 두 면. 브릭은 색별로(많은 색부터) 위에서 떨어져 끼워짐
// - 새 이미지: 판이 세로축으로 반 바퀴 뒤집히고, 뒷면(이제 앞)에 새 브릭이 끼워짐
// - 보정만 바뀜: 그 면에서 색이 바뀐 칸만 다시 톡 끼워짐
// - hover(팔레트 번호): 그 색 브릭만 떠오르고 나머지는 어두워짐
// - replay: { color: 번호 | null(전체), nonce } — 다시 끼우기
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PALETTE } from "@/lib/brick/palette";

const PLATE_T = 0.6;      // 판 두께
const DROP = 0.42;        // 브릭 하나가 떨어지는 시간(초)
const FALL_H = 9;         // 떨어지기 시작하는 높이
const FLIP_T = 1.1;       // 뒤집는 시간(초)
const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const PAL = PALETTE.map((p) => new THREE.Color(p.hex));

// 1×1 둥근 플레이트: 아래 원판 + 위 스터드 (z 축이 위)
// 브릭이 2,048개(앞뒤 두 면)라서 삼각형을 아껴요: 바닥 면은 판에 가려지니 빼고, 둘레는 16/12 조각
function brickGeometry() {
  const base = new THREE.CylinderGeometry(0.47, 0.47, 0.34, 16, 1, false).rotateX(Math.PI / 2).translate(0, 0, 0.17);
  const stud = new THREE.CylinderGeometry(0.29, 0.29, 0.16, 12, 1, false).rotateX(Math.PI / 2).translate(0, 0, 0.42);
  return mergeGeometries([dropBottom(base), dropBottom(stud)]);
}
// 아래쪽(-z) 뚜껑 삼각형 제거 — 원기둥은 index 가 [옆면, 위 뚜껑, 아래 뚜껑] 순서
function dropBottom(g) {
  const idx = g.index.array, total = idx.length;
  const radial = g.parameters.radialSegments;
  const cap = radial * 3;   // 뚜껑 삼각형 radial 개 × 꼭짓점 3
  const g2 = g.clone();
  g2.setIndex(Array.from(idx.slice(0, total - cap)));
  return g2.toNonIndexed();
}

// 색 순서대로 시작 시간 매기기 (counts 순서 = 많은 색부터). only: 그 색만
function schedule(cells, counts, now, only = null, changed = null) {
  const n = cells.length;
  const start = new Float32Array(n).fill(-1);
  if (changed) { for (let i = 0; i < n; i++) start[i] = changed[i] ? now + Math.random() * 0.35 : -2; return start; }
  const groups = only == null ? counts : counts.filter((c) => c.index === only);
  const total = groups.reduce((s, g) => s + g.count, 0) || 1;
  const at = new Map();
  let t = now;
  for (const g of groups) { const dur = 0.16 + 2.4 * (g.count / total); at.set(g.index, [t, dur]); t += dur; }
  for (let i = 0; i < n; i++) {
    const g = at.get(cells[i]);
    start[i] = g ? g[0] + Math.random() * g[1] * 0.9 : -2;   // -2 = 이미 끼워져 있음 (그대로)
  }
  return start;
}

function Side({ face, data, n, hover, geom }) {
  const mesh = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const lift = useMemo(() => new Float32Array(n * n), [n]);
  const dim = useMemo(() => new Float32Array(n * n).fill(1), [n]);

  useFrame(({ clock }) => {
    const m = mesh.current, s = data.current;
    if (!m || !s.cells) { if (m) m.count = 0; return; }
    m.count = n * n;
    const now = clock.elapsedTime;
    const h = hover.current;
    for (let i = 0; i < n * n; i++) {
      const c = s.cells[i];
      const st = s.start[i];
      let k = st === -2 ? 1 : st < 0 ? 0 : Math.min(1, Math.max(0, (now - st) / DROP));
      const x = (i % n) - (n - 1) / 2, y = (n - 1) / 2 - Math.floor(i / n);
      const want = h == null ? 0 : c === h ? 0.55 : 0;
      lift[i] += (want - lift[i]) * 0.18;
      const wd = h == null || c === h ? 1 : 0.28;
      dim[i] += (wd - dim[i]) * 0.15;
      const z = PLATE_T / 2 + (1 - easeOutBack(k)) * FALL_H + lift[i];
      dummy.position.set(x, y, k <= 0 ? -50 : z);
      const sc = k <= 0 ? 0.0001 : 1;
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.set(0, 0, (1 - Math.min(1, k * 1.4)) * 1.2);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      tmp.copy(PAL[c]).multiplyScalar(dim[i]);
      m.setColorAt(i, tmp);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group rotation={[0, face ? Math.PI : 0, 0]}>
      <instancedMesh ref={mesh} args={[geom, undefined, n * n]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.32} metalness={0} />
      </instancedMesh>
    </group>
  );
}

function Board({ mosaic, sourceKey, hover, replay, view, n }) {
  const geom = useMemo(brickGeometry, []);
  useEffect(() => () => geom.dispose(), [geom]);
  const sides = [useRef({ cells: null, start: null }), useRef({ cells: null, start: null })];
  const active = useRef(0);
  const flip = useRef({ from: 0, to: 0, t0: -10 });
  const lastKey = useRef(null);
  const flipGroup = useRef(null);
  const tiltGroup = useRef(null);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const { clock, pointer } = useThree();
  const reduced = useMemo(() => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  // 새 모자이크가 들어옴
  useEffect(() => {
    if (!mosaic) return;
    const now = clock.elapsedTime;
    const { cells, counts } = mosaic;
    if (lastKey.current === null) {
      sides[0].current = { cells, start: reduced ? new Float32Array(cells.length).fill(-2) : schedule(cells, counts, now + 0.3) };
    } else if (lastKey.current !== sourceKey) {
      // 다른 이미지 → 뒤집기
      const next = 1 - active.current;
      active.current = next;
      const f = flip.current;
      f.from = f.to; f.to = f.to + Math.PI; f.t0 = reduced ? -10 : now;
      sides[next].current = { cells, start: reduced ? new Float32Array(cells.length).fill(-2) : schedule(cells, counts, now + FLIP_T * 0.55) };
    } else {
      // 같은 이미지, 보정만 바뀜 → 바뀐 칸만
      const s = sides[active.current].current;
      const changed = s.cells ? cells.map((c, i) => (c !== s.cells[i] ? 1 : 0)) : null;
      sides[active.current].current = { cells, start: reduced ? new Float32Array(cells.length).fill(-2) : schedule(cells, counts, now, null, changed) };
    }
    lastKey.current = sourceKey;
  }, [mosaic]); // eslint-disable-line react-hooks/exhaustive-deps

  // 다시 끼우기
  useEffect(() => {
    if (!replay?.nonce || !mosaic) return;
    const s = sides[active.current].current;
    if (!s.cells) return;
    const now = clock.elapsedTime;
    const start = schedule(s.cells, mosaic.counts, now + 0.1, replay.color);
    if (replay.color != null) for (let i = 0; i < start.length; i++) if (s.cells[i] !== replay.color) start[i] = -2;
    sides[active.current].current = { ...s, start };
  }, [replay?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock: c }, delta) => {
    const f = flip.current;
    const ease = 1 - Math.exp(-Math.min(delta, 0.1) * 6);   // 프레임 속도와 상관없이 같은 속도로 기울기 따라감
    const k = Math.min(1, Math.max(0, (c.elapsedTime - f.t0) / FLIP_T));
    if (flipGroup.current) {
      flipGroup.current.rotation.y = f.from + (f.to - f.from) * easeInOut(k);
      flipGroup.current.position.z = Math.sin(Math.PI * k) * 6;   // 뒤집는 동안 살짝 앞으로
    }
    const g = tiltGroup.current;
    if (g) {
      const flat = view === "flat";
      const tx = flat ? 0 : -0.42 + pointer.y * 0.08;
      const ty = flat ? 0 : 0.22 + pointer.x * 0.16;
      g.rotation.x += (tx - g.rotation.x) * ease;
      g.rotation.y += (ty - g.rotation.y) * ease;
    }
  });

  return (
    <group ref={tiltGroup}>
      <group ref={flipGroup}>
        <mesh receiveShadow>
          <boxGeometry args={[n + 0.6, n + 0.6, PLATE_T]} />
          <meshStandardMaterial color="#2a222a" roughness={0.6} />
        </mesh>
        <Side face={0} data={sides[0]} n={n} hover={hoverRef} geom={geom} />
        <Side face={1} data={sides[1]} n={n} hover={hoverRef} geom={geom} />
      </group>
    </group>
  );
}

// 판이 화면에 꽉 차게 카메라 거리 맞춤
function Fit({ n }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const fov = (camera.fov * Math.PI) / 180;
    const need = (n + 6) / 2 / Math.tan(fov / 2) / Math.min(1, size.width / size.height);
    camera.position.set(0, 0, need);
    camera.near = 1; camera.far = need * 4;
    camera.updateProjectionMatrix();
  }, [camera, size, n]);
  return null;
}

export default function BrickBoard({ mosaic, sourceKey, hover = null, replay, view = "3d", n = 32, className = "" }) {
  return (
    <div className={className}>
      <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 0, 80] }} gl={{ antialias: true, alpha: true }} shadows>
        <Fit n={n} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#fff6e8", "#3a2e36", 0.5]} />
        <directionalLight position={[-18, 26, 40]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} />
        <Board mosaic={mosaic} sourceKey={sourceKey} hover={hover} replay={replay} view={view} n={n} />
      </Canvas>
    </div>
  );
}
