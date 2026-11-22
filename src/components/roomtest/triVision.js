// 벽 그림을 "트라이비전"으로 바꿔 걸기 (2026-11-22 사용자 요청 · 참고 영상: 미술관의 회전 슬랫 액자)
//  그림 면을 세로로 긴 삼각기둥 슬랫 여러 개로 나눔. 기둥의 세 면에 각각 다른 그림이 붙어 있고,
//  슬랫이 왼쪽부터 한 줄씩 차례로 120° 돌면 그림이 파도처럼 바뀜
//   면 0 = 원래 그림 (방의 구운 그림 그대로 — 같은 재질을 복사해 써서 조명 상태가 같이 바뀜)
//   면 1 · 2 = 앨범 커버 두 칸: 지금 걸린 커버와 다음 커버 → 듣는 판이 바뀌어도 같은 방식으로 넘어감
//  쉬는 동안(원래 그림) 에는 슬랫을 숨기고 방의 원래 그림을 그대로 보여 줌
import * as THREE from "three";

export const TRI = {
  slats: 14,        // 슬랫 수
  turn: 0.7,        // 슬랫 하나가 도는 시간(초)
  wave: 0.05,       // 옆 슬랫이 따라 도는 간격(초) — 클수록 파도가 느리게 지나감
  gap: 0.035,       // 슬랫 사이 틈 (슬랫 폭 대비) — 틈으로 어두운 뒤판이 보임
  shade: 0.3,       // 옆을 보는 면의 밝기 (정면 = 1)
};
const TAU3 = (Math.PI * 2) / 3;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

// 원래 그림 면의 (x, y) → uv: 메시 앞면의 꼭짓점들에서 최소제곱으로 구한 1차식 (구운 그림에서 이 면이 차지한 자리)
function fitUV(samples, get) {
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = 0, bu = [0, 0, 0], bv = [0, 0, 0];
  for (const s of samples) {
    const [u, v] = get(s);
    sxx += s.x * s.x; sxy += s.x * s.y; sx += s.x; syy += s.y * s.y; sy += s.y; n++;
    bu[0] += s.x * u; bu[1] += s.y * u; bu[2] += u; bv[0] += s.x * v; bv[1] += s.y * v; bv[2] += v;
  }
  const m = new THREE.Matrix3().set(sxx, sxy, sx, sxy, syy, sy, sx, sy, n);
  if (Math.abs(m.determinant()) < 1e-18) return null;
  m.invert();
  const cu = new THREE.Vector3(...bu).applyMatrix3(m), cv = new THREE.Vector3(...bv).applyMatrix3(m);
  return (x, y) => [cu.x * x + cu.y * y + cu.z, cv.x * x + cv.y * y + cv.z];
}

/**
 * artMesh: 벽 그림 메시 · face: 그 앞면에 맞춘 판 (RoomTest makeCoverFace 가 만든 것 — 자리와 방향만 씀) · w / h: 그림 면의 가로 · 세로
 * glow: 커버의 밝기 (방의 구운 그림과 맞추려고) · reduced: 동작 줄이기 (바로 바뀜)
 */
export function makeTriVision({ artMesh, face, w, h, glow = 0.78, reduced = false }) {
  const N = TRI.slats, sw = w / N, fw = sw * (1 - TRI.gap), rIn = fw / (2 * Math.sqrt(3)), rOut = rIn * 2;
  const group = new THREE.Group();
  group.name = "wall_art_trivision";
  group.position.copy(face.position); group.quaternion.copy(face.quaternion);
  group.visible = false;
  artMesh.add(group);
  // 기둥 전체가 뒤판 앞에 있게 축을 앞으로 뺌 (뒤판이 원래 그림을 가림)
  const zBack = 0.0015, zAxis = zBack + rOut + 0.001;

  // 원래 그림의 uv: 그림 면 위의 꼭짓점 (법선이 면 방향 · 면 위에 있는 것)
  const X = new THREE.Vector3(1, 0, 0).applyQuaternion(face.quaternion), Y = new THREE.Vector3(0, 1, 0).applyQuaternion(face.quaternion), Nn = new THREE.Vector3(0, 0, 1).applyQuaternion(face.quaternion);
  const g = artMesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, uv1 = g.attributes.uv1;
  const c = face.position, cx = c.dot(X), cy = c.dot(Y), cd = c.dot(Nn), p = new THREE.Vector3(), q = new THREE.Vector3();
  const samples = [];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nor && q.fromBufferAttribute(nor, i).dot(Nn) < 0.9) continue;
    if (Math.abs(p.dot(Nn) - cd) > 0.01) continue;
    samples.push({ x: p.dot(X) - cx, y: p.dot(Y) - cy, i });
  }
  const mapUv = uv ? fitUV(samples, (s) => [uv.getX(s.i), uv.getY(s.i)]) : null;
  const mapUv1 = uv1 ? fitUV(samples, (s) => [uv1.getX(s.i), uv1.getY(s.i)]) : null;

  // 커버(정사각)를 그림 면 비율에 맞춰 가운데를 잘라 씀
  const r = w / h, crop = r <= 1 ? { u0: (1 - r) / 2, du: r, v0: 0, dv: 1 } : { u0: 0, du: 1, v0: (1 - 1 / r) / 2, dv: 1 / r };

  // 면 묶음 셋 (면마다 재질 하나, 슬랫 N 개의 네모를 한 메시로) — 자리 · 밝기는 돌 때마다 다시 계산
  const sets = [0, 1, 2].map((k) => {
    const geo = new THREE.BufferGeometry();
    const P = new Float32Array(N * 12), C = new Float32Array(N * 12).fill(1), U = new Float32Array(N * 8), U1 = k === 0 && mapUv1 ? new Float32Array(N * 8) : null, I = [];
    for (let i = 0; i < N; i++) {
      const x0 = -w / 2 + i * sw + (sw - fw) / 2, x1 = x0 + fw, fx0 = (x0 + w / 2) / w, fx1 = (x1 + w / 2) / w;
      // 꼭짓점 순서: 왼쪽 아래 · 오른쪽 아래 · 오른쪽 위 · 왼쪽 위
      const corners = [[x0, -h / 2, fx0, 0], [x1, -h / 2, fx1, 0], [x1, h / 2, fx1, 1], [x0, h / 2, fx0, 1]];
      corners.forEach(([x, y, fx, fy], j) => {
        const o = (i * 4 + j) * 2;
        if (k === 0) {
          const a = mapUv ? mapUv(x, y) : [fx, fy]; U[o] = a[0]; U[o + 1] = a[1];
          if (U1) { const b = mapUv1(x, y); U1[o] = b[0]; U1[o + 1] = b[1]; }
        } else { U[o] = crop.u0 + crop.du * fx; U[o + 1] = crop.v0 + crop.dv * fy; }
      });
      I.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(C, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    if (U1) geo.setAttribute("uv1", new THREE.BufferAttribute(U1, 2));
    geo.setIndex(I);
    let mat;
    if (k === 0) {
      // 방의 구운 재질을 복사 (상태별 그림을 섞는 셰이더도 그대로) + 꼭짓점 색으로 면의 밝기
      const src = artMesh.material;
      mat = src.clone();
      if (src.onBeforeCompile) mat.onBeforeCompile = src.onBeforeCompile;
      if (src.customProgramCacheKey) mat.customProgramCacheKey = src.customProgramCacheKey;
      mat.vertexColors = true;
    } else mat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(glow), vertexColors: true, toneMapped: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;   // 꼭짓점이 매 프레임 움직임
    group.add(mesh);
    return { geo, mat, mesh, P, C };
  });
  const backMat = new THREE.MeshBasicMaterial({ color: "#120e13", toneMapped: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), backMat);
  back.position.z = zBack;
  group.add(back);

  // 슬랫 i 의 각도 angles[i] 로 세 면의 꼭짓점 자리 · 밝기를 다시 놓음
  const angles = new Float32Array(N);
  const place = () => {
    for (let k = 0; k < 3; k++) {
      const { P, C, geo } = sets[k];
      for (let i = 0; i < N; i++) {
        const phi = angles[i] - k * TAU3, cs = Math.cos(phi), sn = Math.sin(phi);
        const xc = -w / 2 + (i + 0.5) * sw, shade = cs > 0 ? TRI.shade + (1 - TRI.shade) * cs ** 0.7 : TRI.shade * 0.5;
        for (let j = 0; j < 4; j++) {
          const x = j === 0 || j === 3 ? -fw / 2 : fw / 2, y = j < 2 ? -h / 2 : h / 2, o = (i * 4 + j) * 3;
          P[o] = xc + x * cs + rIn * sn; P[o + 1] = y; P[o + 2] = zAxis - x * sn + rIn * cs;
          C[o] = C[o + 1] = C[o + 2] = shade;
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    }
  };
  place();

  let cur = 0, base = 0, move = null, queued = null;   // cur: 지금 정면인 면 · base: 그 면의 각도 · move: { from, to, t, face }
  const start = (to) => {
    const step = (to - cur + 3) % 3 === 1 ? 1 : -1;     // 늘 한 면(120°)씩: 다음 면이면 앞으로, 아니면 뒤로
    move = { from: base, to: base + step * TAU3, t: 0, face: to };
    group.visible = true;
  };
  return {
    group,
    get face() { return move ? move.face : cur; },
    get busy() { return !!move; },
    /** 커버 그림을 면 1 또는 2 에 붙임 */
    setCover(slot, tex) { const m = sets[slot].mat; m.map?.dispose(); m.map = tex; m.needsUpdate = true; },
    /** 면 to(0 원래 그림 · 1 · 2 커버)가 정면에 오게 돌림. 도는 중이면 끝난 뒤에 이어서 */
    go(to) {
      if (to === (queued ?? (move ? move.face : cur))) return;
      if (move) { queued = to; return; }
      if (to !== cur) start(to);
    },
    tick(dt) {
      if (!move) return;
      move.t = reduced ? Infinity : move.t + dt;
      const total = (N - 1) * TRI.wave + TRI.turn;
      for (let i = 0; i < N; i++) angles[i] = move.from + (move.to - move.from) * ease(Math.min(1, Math.max(0, (move.t - i * TRI.wave) / TRI.turn)));
      if (move.t >= total) {
        cur = move.face; base = move.to; angles.fill(base); move = null;
        if (queued != null && queued !== cur) { const next = queued; queued = null; place(); start(next); return; }
        queued = null;
        if (cur === 0) group.visible = false;   // 원래 그림으로 돌아왔으면 방의 그림을 그대로 보여 줌
      }
      place();
    },
    dispose() {
      for (const s of sets) { s.geo.dispose(); if (s.mat !== artMesh.material) { if (s.mat.map && s !== sets[0]) s.mat.map.dispose(); s.mat.dispose(); } }
      back.geometry.dispose(); backMat.dispose(); group.removeFromParent();
    },
  };
}
