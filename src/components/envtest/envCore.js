// 방 바깥 2.5D 배경 (Hybrid) — /lab/env-test 와 /lab/room-test 가 같이 씀
//  하늘 = 화면 전체 판(카메라와 무관), 스카이라인·아파트·한강 = 실제 깊이에 놓은 판,
//  판 높이는 "기준 카메라 화면에서 윗선이 어디 오는가(s)"로 역산. 설정값은 env-layers.json
import * as THREE from "three";

export const D2R = Math.PI / 180;
export const ASPECT = 16 / 9;
const UP = new THREE.Vector3(0, 1, 0);

// GLB 카메라 + 다 지어진 방 → 기준점들
export function computeRig(root, gcam) {
  root.updateMatrixWorld(true);
  const pos = gcam.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(gcam.getWorldQuaternion(new THREE.Quaternion()));
  // 방 상자 (러그는 모프 때문에, 방 아래 건물과 창밖 그림은 구도와 상관없어서 뺌)
  const roomBox = new THREE.Box3();
  const bldBox = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    if (o.name.startsWith("building")) bldBox.union(b);
    else if (o.name !== "rug" && o.name !== "Window_City") roomBox.union(b);
  });
  const c = roomBox.getCenter(new THREE.Vector3());
  const target = pos.clone().addScaledVector(fwd, fwd.dot(c.clone().sub(pos)));   // 시선 위에서 방 가운데와 가장 가까운 점
  const fH = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
  // 방 크기 맞춤용 점들: 상자 모서리는 앞이 뚫린 방에선 빈 곳이라, 실제 메시 꼭짓점을 골고루 뽑아 씀
  const roomPts = [];
  root.traverse((o) => {
    if (!o.isMesh || o.name.startsWith("building") || o.name === "rug" || o.name === "Window_City") return;
    const a = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(a.count / 60));
    for (let i = 0; i < a.count; i += step) roomPts.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld));
  });
  return {
    pos, target, fov: gcam.fov, fH, roomBox, roomPts,
    ground: bldBox.isEmpty() ? -12 : bldBox.min.y,
    right: new THREE.Vector3().crossVectors(fH, UP).normalize(),
    windowCity: root.getObjectByName("Window_City"),
  };
}

// 방이 화면에서 차지하는 크기 = 방 꼭짓점들을 감싸는 화면 사각형의 긴 변 (가로는 화면비를 곱해 세로와 같은 단위로)
function roomScreenSize(cam, pts) {
  const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
  const p = new THREE.Vector3();
  for (const v of pts) { p.copy(v).project(cam); min.min(p); max.max(p); }
  return Math.max((max.x - min.x) * ASPECT, max.y - min.y);
}

// 기준 카메라: 내려다보는 각(elev, null = GLB 카메라 그대로)만 바꾸고, 방이 GLB 카메라 때와 같은 크기가 되도록 거리를 맞춤
export function makeBase(rig, elev) {
  const sph0 = new THREE.Spherical().setFromVector3(rig.pos.clone().sub(rig.target));
  const cam = new THREE.PerspectiveCamera(rig.fov, ASPECT, 0.1, 3000);
  const place = (sph) => { cam.position.setFromSpherical(sph).add(rig.target); cam.lookAt(rig.target); cam.updateMatrixWorld(); };
  place(sph0);
  const size0 = roomScreenSize(cam, rig.roomPts);
  const sph = sph0.clone();
  if (elev != null) {
    sph.phi = (90 - elev) * D2R;
    for (let i = 0; i < 6; i++) { place(sph); sph.radius *= roomScreenSize(cam, rig.roomPts) / size0; }
  }
  place(sph);
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  return { sph, cam, right, up, elev: 90 - sph.phi / D2R };
}

// 기준 카메라 화면에서 높이 s(0 = 아래, 1 = 위) 를 지나는 시선이 깊이 D 의 판과 만나는 높이
export function screenTopY(rig, base, D, s) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 2 * s - 1), base.cam);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(rig.fH, rig.target.clone().addScaledVector(rig.fH, D));
  return ray.ray.intersectPlane(plane, new THREE.Vector3())?.y ?? 0;
}

// 판의 자리와 크기
export function layerGeom(L, rig, base) {
  const at = rig.target.clone().addScaledVector(rig.fH, L.D);
  const dist = base.cam.position.distanceTo(at);
  const viewH = 2 * dist * Math.tan((rig.fov / 2) * D2R);       // 그 깊이에서 화면 세로가 몇 m 인지
  const W = L.W || viewH * ASPECT * 3;                           // 좌우로 돌려도 남게 화면 폭의 3배
  let top, bandH;
  if (L.place === "screen") { top = screenTopY(rig, base, L.D, L.s); bandH = viewH * (L.band ?? 0.16); }   // band: 띠 높이(화면 세로 비율)
  else { top = rig.ground + L.H; bandH = L.H; }
  const bottom = L.place === "screen" ? -Infinity : rig.ground; // 화면 기준 판은 띠 아래를 같은 색으로 아래 끝까지
  return { at, dist, viewH, W, top, bandH, bottom, xs: L.x ?? [0] };
}

// 깊이 흐림(DOF 흉내): 방이 초점. 거리 dist 의 것은 화면에서 strength × |1 − 초점 거리/dist| px 만큼 흐림
// (1080p 화면 기준 px, 무한히 먼 하늘 = strength, 카메라 쪽은 초점의 절반 거리면 같은 만큼·더 가까우면 더 흐림, 최대 ×4)
// 실행 중 후처리 대신 이미지를 불러올 때 한 번만 흐림
export const dofScreenPx = (strength, focus, dist) => (strength > 0 ? strength * Math.min(4, Math.abs(1 - focus / dist)) : 0);
// 화면 px → 이미지 px: 이미지 세로 한 장이 화면 세로의 screenFrac 만큼일 때
export const dofImagePx = (screenPx, imgH, screenFrac) => (screenPx * imgH) / (screenFrac * 1080);

// 이미지를 미리 흐린 캔버스. 가장자리가 투명으로 번지지 않게 좌우·아래(와 grow 가 아니면 위)를 거울로 덧대고 흐린 뒤 가운데만 씀
// grow: 위쪽이 투명한 띠 이미지(레이어)는 위에 투명 여백을 붙여 흐림이 위로 번질 자리를 줌 → 결과가 그만큼 키가 커짐
// (canvas filter 를 못 쓰는 브라우저에선 흐림 없이 그대로)
export function blurImage(img, px, grow = false) {
  if (!(px > 0.25)) return img;
  const w = img.width, h = img.height, pad = Math.ceil(px * 3), top = grow ? pad : 0;
  const c1 = document.createElement("canvas");
  c1.width = w + 2 * pad; c1.height = h + 2 * pad;
  const g1 = c1.getContext("2d");
  const copies = [[1, 1, pad, pad], [-1, 1, pad, pad], [-1, 1, pad + 2 * w, pad], [1, -1, pad, pad + 2 * h]];
  if (!grow) copies.push([1, -1, pad, pad]);
  for (const [sx, sy, dx, dy] of copies) {
    g1.setTransform(sx, 0, 0, sy, dx, dy);
    g1.drawImage(img, 0, 0);
  }
  const c2 = document.createElement("canvas");
  c2.width = w; c2.height = h + top;
  const g2 = c2.getContext("2d");
  g2.filter = `blur(${px.toFixed(2)}px)`;
  g2.drawImage(c1, -pad, -pad + top);
  return c2;
}
// grow 로 키가 커졌으면 texture.userData.growTop = 원래 높이 대비 위로 늘어난 비율
export function imageTexture(img, px, { flipY = true, wrapS = THREE.ClampToEdgeWrapping, grow = false } = {}) {
  const src = blurImage(img, px, grow);
  const t = src === img ? new THREE.Texture(img) : new THREE.CanvasTexture(src);
  t.userData.growTop = (src.height - img.height) / img.height;
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = flipY;
  t.wrapS = wrapS;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// 레이어 이미지 텍스처: 띠 한 장을 좌우로 뒤집어 가며 이어 붙임(끝끼리 맞지 않아도 이음매가 안 생김)
// blurFor(이미지 세로 px) → 흐림 px (없으면 흐리지 않음). single: 반복하지 않는 한 장짜리 그림(예: 남산)
export function loadLayerTexture(url, onLoad, blurFor, single = false) {
  new THREE.ImageLoader().load(url, (img) => onLoad?.(imageTexture(img, blurFor?.(img.height) ?? 0, { wrapS: single ? THREE.ClampToEdgeWrapping : THREE.MirroredRepeatWrapping, grow: true })));
}
// 레이어 하나의 흐림: 띠 이미지 세로 = 화면 세로의 band 만큼. blurMul: 레이어별 배율 (카메라 앞 전경은 목표 이미지처럼 더 뭉갬)
export const layerBlurFor = (L, g, base, strength) => (imgH) => dofImagePx(dofScreenPx(strength, base.sph.radius, g.dist) * (L.blurMul ?? 1), imgH, L.band ?? 0.16);
// 띠 높이 bandH, 한 장 폭 = bandH × 이미지 비율, 판 가운데에 이미지 가운데가 오게
// 흐림 여백(growTop)이 있으면 띠를 그만큼 위로 늘림 → 원래 그림의 자리·크기는 그대로. 늘어난 { h, up, w } 을 돌려줌
// single: 한 장짜리 그림은 판 폭을 그림 비율대로 줄임 (w), 반복 없음
export function fitLayerTexture(tex, W, bandH, single = false) {
  const grow = tex.userData.growTop ?? 0, h = bandH * (1 + grow), aspect = tex.image.width / tex.image.height;
  if (single) { tex.repeat.x = 1; tex.offset.x = 0; return { h, up: bandH * grow, w: h * aspect }; }
  const r = W / (h * aspect);
  tex.repeat.x = r; tex.offset.x = 0.5 - 0.5 * r;
  return { h, up: bandH * grow, w: W };
}
// 판 양 끝을 서서히 투명하게 하는 알파 맵 (fadeX = 양쪽에서 판 폭의 이만큼씩). 모서리에만 놓는 전경처럼 판이 화면 안에서 끝날 때
const fadeCache = new Map();
export function edgeFadeTexture(fadeX) {
  if (!(fadeX > 0)) return null;
  if (fadeCache.has(fadeX)) return fadeCache.get(fadeX);
  const c = document.createElement("canvas");
  c.width = 256; c.height = 1;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, "#000"); gr.addColorStop(fadeX, "#fff"); gr.addColorStop(1 - fadeX, "#fff"); gr.addColorStop(1, "#000");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 1);
  const t = new THREE.CanvasTexture(c);
  fadeCache.set(fadeX, t);
  return t;
}

// tint: 이미지 색에 곱하는 밝기 (1 = 그대로, 눈에 보이는 밝기 기준). 띠 아래 채움 색에도 같이 곱함
export function layerColors(L) {
  const t = L.tint ?? 1, tint = new THREE.Color().setRGB(t, t, t, THREE.SRGBColorSpace);
  return { tint, fill: L.fill ? new THREE.Color(L.fill).multiply(tint) : new THREE.Color(L.color) };
}

// 하늘: 화면 전체를 덮는 판. 깊이는 맨 뒤(1.0)라 방·레이어 뒤에만 보이고, 투명도로 서서히 나타낼 수 있음
// 화면 높이 v(0 아래 ~ 1 위) 에 이미지 높이 off + v × scale 이 옴 (이미지 밖은 끝 색이 늘어남)
export function createSkyQuad(url, off, scale, blur = 0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, uOff: { value: off }, uScale: { value: scale }, uOpacity: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }",
    fragmentShader: `uniform sampler2D map; uniform float uOff, uScale, uOpacity; varying vec2 vUv;
      void main() {
        vec2 uv = vec2(vUv.x, clamp(uOff + vUv.y * uScale, 0.001, 0.999));
        gl_FragColor = vec4(texture2D(map, uv).rgb, uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.visible = false;
  // 이미지 세로 한 장 = 화면 세로의 1/scale. blur = 화면 px (가장 먼 것이라 흐림 세기 그대로)
  new THREE.ImageLoader().load(url, (img) => { mat.uniforms.map.value = imageTexture(img, dofImagePx(blur, img.height, 1 / scale)); mesh.visible = true; });
  return mesh;
}

// 창문 안 풍경은 멀리 있는 것이라 가장 먼 흐림 그대로. 이미지 세로 = 창문 판 원래 높이(imageHeightM)가 화면에서 차지하는 비율
export function windowBlurPx(cfg, rig, base, imgH) {
  const viewH = 2 * base.sph.radius * Math.tan((rig.fov / 2) * D2R);
  return dofImagePx(cfg.dof?.strength ?? 0, imgH, cfg.window.imageHeightM / viewH);
}

// room-test 용: 레이어 판들(이미지 있는 것만) + 하늘 + 창문 + 바깥 면 색을 한 번에. fade(k) 로 같이 나타냄
// 창문: cfg.window.mode "glass" 면 그림 판을 숨기고 유리 → 창 너머로 레이어(남산 포함)가 보임. 아니면 남산 그림 판
// roomTest: false 인 레이어는 room-test 에서 뺌 (3D 로 바꿀 좌우 전경 등)
export function createEnv(rig, base, cfg, root) {
  const group = new THREE.Group();
  group.name = "env_layers";
  const mats = [];
  const rotY = Math.atan2(-rig.fH.x, -rig.fH.z);                 // 판 앞면이 카메라 쪽
  for (const L of cfg.layers) {
    if (!L.on || !L.img || L.roomTest === false) continue;
    const g = layerGeom(L, rig, base);
    const { tint, fill } = layerColors(L);
    const fade = edgeFadeTexture(L.fadeX);
    const band = new THREE.MeshBasicMaterial({ color: tint, transparent: true, alphaTest: L.alphaTest ?? 0.01, toneMapped: false, opacity: 0, alphaMap: fade });   // alphaTest: 투명 가장자리가 어두운 테두리로 보이는 그림(남산)은 높여서 잘라 냄
    const fillMat = new THREE.MeshBasicMaterial({ color: fill, transparent: true, toneMapped: false, opacity: 0, alphaMap: fade });
    mats.push(band, fillMat);
    const bandMeshes = [], fillMeshes = [];
    loadLayerTexture(L.img, (t) => {
      const { h, up, w } = fitLayerTexture(t, g.W, g.bandH, L.single);
      for (const bm of bandMeshes) { bm.scale.set(w / g.W, h / g.bandH, 1); bm.position.y = -g.bandH / 2 + up / 2; }
      for (const fm of fillMeshes) fm.scale.x = w / g.W;
      band.map = t; band.needsUpdate = true;
    }, layerBlurFor(L, g, base, cfg.dof?.strength ?? 0), L.single);
    for (const x of g.xs) {
      const p = g.at.clone().addScaledVector(rig.right, x);
      const holder = new THREE.Group();
      holder.name = "env_" + L.id;
      holder.position.set(p.x, g.top, p.z);
      holder.rotation.y = rotY;
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(g.W, g.bandH), band);
      bm.position.y = -g.bandH / 2;
      bandMeshes.push(bm);
      holder.add(bm);
      // 띠 아래 채움 (noFill: 그림 아래쪽이 투명한 모서리 전경은 채우지 않음)
      if (!L.noFill) {
        const fm = new THREE.Mesh(new THREE.PlaneGeometry(g.W, 2000), fillMat);
        fm.position.y = -g.bandH * 0.99 - 1000;
        fillMeshes.push(fm);
        holder.add(fm);
      }
      group.add(holder);
    }
  }
  const sky = createSkyQuad(cfg.sky.image, cfg.sky.offsetY, cfg.sky.scaleY, cfg.dof?.strength ?? 0);
  sky.name = "env_sky";
  // 창문 안: 남산 이미지 (GLB UV 기준이라 flipY 끔). 밝기는 night(0~1) 로
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  new THREE.ImageLoader().load(cfg.window.image, (img) => {
    windowMat.map = imageTexture(img, windowBlurPx(cfg, rig, base, img.height), { flipY: false });
    windowMat.needsUpdate = true;
  });
  if (rig.windowCity) rig.windowCity.material = windowMat;
  const glass = cfg.window.mode === "glass" && root ? createWindowGlass(root) : null;
  if (glass && rig.windowCity) rig.windowCity.visible = false;
  if (root) applyWallColors(root, cfg.walls);
  return {
    group, sky, windowMat, glass,
    fade(k) {
      group.visible = k > 0.001;
      if (glass) glass.material.opacity = k;
      sky.visible = group.visible && !!sky.material.uniforms.map.value;
      sky.material.uniforms.uOpacity.value = k;
      for (const m of mats) { m.opacity = k; m.transparent = k < 1 || m.alphaTest > 0; m.depthWrite = k >= 1; }
    },
    night(k) { windowMat.color.setScalar(k); },
  };
}

// 창문 유리: 창틀 안쪽에 옅은 하늘빛 + 비스듬한 반사 줄만 있는 얇은 판 (진짜 굴절 대신 흉내).
// 창문 그림 판(Window_City)을 숨기면 창 너머로 바깥 배경 레이어가 그대로 보임 → 창 안에서도 시차가 생김
export function createWindowGlass(root) {
  const frame = root.getObjectByName("window_frame");
  if (!frame) return null;
  const b = new THREE.Box3().setFromObject(frame);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(190, 205, 255, 0.06)";
  g.fillRect(0, 0, 256, 256);
  for (const [x0, w, a] of [[40, 70, 0.10], [130, 28, 0.07]]) {   // 비스듬한 반사 줄 두 개
    const gr = g.createLinearGradient(x0, 0, x0 + w, 0);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.save(); g.translate(128, 128); g.rotate(-0.5); g.translate(-128, -128);
    g.fillStyle = gr; g.fillRect(x0, -200, w, 656);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  // 창틀 상자에서 가장 얇은 축이 창의 두께 방향
  const s = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
  const thin = s.x <= s.z ? "x" : "z";
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(thin === "x" ? s.z : s.x, s.y), mat);
  mesh.position.copy(ctr);
  if (thin === "x") mesh.rotation.y = Math.PI / 2;
  mesh.name = "window_glass";
  mesh.renderOrder = 5;
  frame.attach(mesh);   // 창틀에 붙여 reveal 애니메이션을 따라 움직이게 (방이 다 지어진 자세에서 부를 것)
  return mesh;
}

// 방 바깥 면 색: 벽·바닥 절단면(mat_wall_section)과 방 아래 건물 외벽(mat_building_wall)을 면 방향마다 다른 색으로 (env-layers.json 의 walls).
// 한 재질이라 조명만으로는 면마다 차이가 거의 안 나서, 셰이더에서 면의 월드 방향으로 색을 곱함:
//   위를 보는 면: 낮은 곳(ledgeBelowY 아래 = 바닥 높이의 앞 턱)은 ledge(밝게), 높은 곳(벽 윗면)은 top
//   +x 를 보는 면(화면 오른쪽 면) = right(가장 어둡게), +z(glTF) 를 보는 면(화면 왼쪽 면) = left(덜 어둡게), 나머지 = other
// 재질 색·발광은 흰색·회색으로 두고 그 위에 곱함 (건물은 원래 텍스처·불 켜진 창 발광 유지)
export function applyWallColors(root, walls) {
  if (!walls) return;
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) {
      const w = m.name === "mat_wall_section" ? walls.section : m.name === "mat_building_wall" ? walls.building : null;
      if (!w || m.userData.wallTinted) continue;
      m.userData.wallTinted = true;
      m.color.set("#ffffff");
      m.emissive?.setScalar(w.emissive ?? 0.5);
      const col = (c) => ({ value: new THREE.Color(c) });
      const u = { uTop: col(w.top), uLedge: col(w.ledge ?? w.top), uLeft: col(w.left), uRight: col(w.right), uOther: col(w.other ?? w.left), uLedgeY: { value: w.ledgeBelowY ?? -1e9 } };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = "varying vec3 vWallN; varying float vWallY;\n" + sh.vertexShader.replace("#include <begin_vertex>",
          "#include <begin_vertex>\n vWallN = normalize(mat3(modelMatrix) * objectNormal); vWallY = (modelMatrix * vec4(transformed, 1.0)).y;");
        const tint = `
          vec3 wn = normalize(vWallN);
          vec3 wt = abs(wn.x) > abs(wn.z) ? (wn.x > 0.0 ? uRight : uOther) : (wn.z > 0.0 ? uLeft : uOther);
          if (wn.y > 0.7) wt = vWallY < uLedgeY ? uLedge : uTop;`;
        sh.fragmentShader = "uniform vec3 uTop, uLedge, uLeft, uRight, uOther; uniform float uLedgeY; varying vec3 vWallN; varying float vWallY;\n" + sh.fragmentShader
          .replace("#include <map_fragment>", "#include <map_fragment>\n" + tint + "\n diffuseColor.rgb *= wt;")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance *= wt;");
      };
      m.customProgramCacheKey = () => "wallTint";
      m.needsUpdate = true;
    }
  });
}
