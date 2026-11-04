"use client";
// /lab/env-test — 방 바깥 2.5D 배경 구성을 정하는 테스트
// 방: Blender GLB 그대로 (reveal 클립 끝 자세). 화면: 16:9 고정.
// 배경 모드
//   Physical  — 실제 깊이에 놓은 판 + 끝없는 땅 (지금 카메라로는 땅만 보임)
//   Hybrid    — 하늘은 화면 배경(카메라와 무관), 스카이라인·강변·한강은 실제 깊이에 놓은 판.
//               판 높이는 "기준 카메라 화면에서 윗선이 어디 오는가"로 정함 → 깊이는 진짜라 시차는 그대로 생김
//   Screen    — 그라데이션 화면 배경만
// 카메라 프리셋: 내려다보는 각 25° / 18° / 12°. 방이 화면에서 같은 크기가 되게 거리를 맞춤.
// 창문 안(Window_City)에만 남산타워, 바깥 배경에는 남산 없음.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import LAYER_CFG from "./env-layers.json";
import { attachFlipClock } from "@/components/roomtest/flipClock";
import { addShelfTestProps } from "@/components/roomtest/shelfTestProps";
import { D2R, ASPECT, computeRig, makeBase as makeBaseElev, layerGeom, loadLayerTexture, fitLayerTexture, layerColors, layerBlurFor, imageTexture, dofImagePx, windowBlurPx, createWindowGlass, edgeFadeTexture, applyWallColors } from "./envCore";

// 프리셋 기준 카메라 (envCore 는 내려다보는 각만 받음)
const makeBase = (rig, preset) => makeBaseElev(rig, preset.elev);

const MODEL_URL = "/models/room/grooves_room_blockout_reveal.glb";
const EMPTY = "#ff3df5";            // Physical 모드에서 아무것도 없는 곳

// 하늘 그라데이션 (위 → 아래). 창문 안 하늘도 같은 색
const SKY = [[0, "#2e2752"], [0.45, "#7c5288"], [0.75, "#e0906e"], [1, "#f6c48e"]];

// place "ground": 땅에서 H 만큼 높이 / place "screen": 기준 카메라 화면에서 윗선이 s (0 = 아래, 1 = 위)
// look "solid": 단색 판 / "skyline": 윗선이 건물 실루엣 / "water": 수면 띠
// D: 방 가운데에서 카메라 반대쪽으로 떨어진 거리(m), W: 폭(0 = 자동), x: 옆으로 비낀 자리들
const MODES = {
  physical: {
    label: "Physical", desc: "실제 깊이의 판 + 끝없는 땅", sky: false, ground: true,
    layers: [
      { id: "p_sky",  name: "하늘 판",      color: "#7a5fa8", D: 400, place: "ground", H: 320, look: "solid", on: true },
      { id: "p_city", name: "먼 도시·강변", color: "#c07a5a", D: 120, place: "ground", H: 45,  look: "solid", on: true },
      { id: "p_near", name: "가까운 건물",  color: "#3f7f8c", D: 25,  place: "ground", H: 22,  look: "solid", W: 14, x: [-16, 16], on: true },
    ],
  },
  hybrid: {
    label: "Hybrid", desc: "하늘 = 화면 배경, 도시·한강 = 깊이 있는 판", sky: true, ground: false,
    layers: LAYER_CFG.layers,       // 거리·윗선 설정값은 env-layers.json
  },
  screen: { label: "Screen", desc: "그라데이션 화면 배경만", sky: true, ground: false, layers: [] },
};
const ALL_LAYERS = Object.values(MODES).flatMap((m) => m.layers);
const KINDS = ["배경", "방", "방 아래 건물", "땅", "창문 배경(남산)", ...ALL_LAYERS.map((L) => L.name)];
const kindIndex = (id) => 5 + ALL_LAYERS.findIndex((L) => L.id === id);

const PRESETS = [
  { id: "A", elev: null, label: "A 25°", desc: "지금 미니어처 구도 (GLB 카메라 그대로)" },
  { id: "B", elev: 18,   label: "B 18°", desc: "실내와 바깥의 균형" },
  { id: "C", elev: 12,   label: "C 12°", desc: "도시 배경 강조" },
];
// yaw·pitch: 방 가운데를 도는 궤도 회전(카메라 위치가 바뀜) / tx·ty: 카메라와 바라보는 점을 함께 옆·위로 옮김(회전 없음)
const CAM0 = { yaw: 0, pitch: 0, dolly: 1, zoom: 1, tx: 0, ty: 0 };
const ORBIT = { yaw: 3, pitch: 1.5 };            // 마우스 궤도 범위(°)
const TRUCK = { x: 0.75, y: 0.4 };               // 마우스 평행 이동 범위(m) — 궤도 3° 와 비슷한 거리 (14.7m × 3° ≈ 0.77m)

function canvasTex(w, h, draw, { repeat = false, flipY = true } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = flipY;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function skyGradient(g, w, h, y0 = 0, y1 = h) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [k, c] of SKY) gr.addColorStop(k, c);
  g.fillStyle = gr; g.fillRect(0, y0, w, y1 - y0);
}
// 매번 같은 실루엣이 나오게 (시드 고정 난수)
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
function grid(g, w, h) {
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3;
  for (let i = 1; i < 10; i++) {
    g.beginPath(); g.moveTo((w * i) / 10, 0); g.lineTo((w * i) / 10, h); g.stroke();
    g.beginPath(); g.moveTo(0, (h * i) / 10); g.lineTo(w, (h * i) / 10); g.stroke();
  }
}
function label(g, w, y, text, size = 56) {
  g.fillStyle = "rgba(255,255,255,0.85)"; g.font = `bold ${size}px sans-serif`; g.textAlign = "center";
  g.fillText(text, w / 2, y);
}

// 띠 텍스처: 위쪽이 실루엣(투명 바탕), 아래는 단색. 한 장 = 가로 4 : 세로 1, 판 폭만큼 반복
function bandTexture(L) {
  return canvasTex(2048, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = L.color;
    if (L.look === "water") {
      g.fillRect(0, h * 0.18, w, h);
      g.fillStyle = "rgba(255,190,140,0.35)";                 // 노을이 비친 물결
      for (let i = 0; i < 60; i++) { const r = rng(i + 11); g.fillRect(r() * w, h * (0.25 + r() * 0.7), 40 + r() * 120, 4); }
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(0, h * 0.18, w, 6);   // 강둑 선
    } else {
      const r = rng(L.seed ?? 1);
      let x = 0;
      while (x < w) {
        const bw = 40 + r() * 110, bh = h * (0.25 + r() * 0.7);
        g.fillStyle = L.color; g.fillRect(x, h - bh, bw + 1, bh);
        if (L.lit) {
          g.fillStyle = "rgba(255,200,120,0.85)";
          for (let yy = h - bh + 14; yy < h - 10; yy += 18) for (let xx = x + 8; xx < x + bw - 10; xx += 16) if (r() < 0.35) g.fillRect(xx, yy, 6, 8);
        }
        x += bw + r() * 12;
      }
    }
    label(g, w, h - 40, `${L.name} · ${L.D}m`, 44);
  }, { repeat: true });
}
function solidTexture(L) {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = L.color; g.fillRect(0, 0, w, h);
    grid(g, w, h);
    label(g, w, h / 2 + 22, `${L.name} · ${L.D}m`, 64);
  });
}
// 창문 전용 배경: 하늘 + 남산 + 타워 (GLB UV 는 flipY = false 기준)
function windowTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    skyGradient(g, w, h, 0, h * 0.8);
    g.fillStyle = "#3a3050";                                                  // 남산
    g.beginPath(); g.moveTo(w * 0.2, h); g.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.82, h); g.fill();
    g.fillStyle = "#4a3d62"; g.fillRect(0, h * 0.8, w, h * 0.2);              // 앞 도시
    g.fillStyle = "#2a2340";                                                  // 타워
    g.fillRect(w * 0.5 - 6, h * 0.22, 12, h * 0.4);
    g.fillRect(w * 0.5 - 22, h * 0.32, 44, 22);
    g.fillRect(w * 0.5 - 2, h * 0.12, 4, h * 0.1);
    g.fillStyle = "#ffd48a"; g.fillRect(w * 0.5 - 18, h * 0.335, 36, 6);
    label(g, w, h * 0.95, "창문 전용 · 남산타워", 40);
  }, { flipY: false });
}

function Room({ onReady, replayRef }) {
  const gltf = useGLTF(MODEL_URL, false, false);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf]);

  useEffect(() => {
    const clip = gltf.animations.find((a) => a.name === "reveal") ?? gltf.animations[0];
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.time = clip.duration;          // 처음엔 다 지어진 방으로
    mixer.update(0);
    replayRef.current = () => { action.reset(); action.play(); };

    const root = gltf.scene;
    applyWallColors(root, LAYER_CFG.walls);   // 절단면·건물 외벽을 어둡게
    onReady({ ...computeRig(root, gltf.cameras[0]), root });
    return () => { mixer.stopAllAction(); };
  }, [gltf, mixer, onReady, replayRef]);

  // 창가 선반 새 소품(플립 시계 · 지금 듣는 판): 방 GLB 에 없으면 확인용 GLB 를 선반에 얹음. 시계는 현재 시각
  //  ?clockfast=1 이면 1분이 2초로 빨리 감 (넘어가는 모습 확인용)
  const clockRef = useRef(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const t0 = Date.now(), fast = q.get("clockfast") === "1";
    const now = fast ? () => new Date(t0 + (Date.now() - t0) * 30) : undefined;
    gltf.scene.updateMatrixWorld(true);
    const shelfFinal = gltf.scene.getObjectByName("pivot_bookshelf")?.matrixWorld.clone();
    const drop = addShelfTestProps(gltf.scene, shelfFinal, () => { clockRef.current = attachFlipClock(gltf.scene, { now }); });
    return () => { drop(); clockRef.current = null; };
  }, [gltf]);
  useFrame((_, dt) => { mixer.update(Math.min(dt, 0.05)); clockRef.current?.update(Math.min(dt, 0.1)); });
  return <primitive object={gltf.scene} />;
}

// 기준 카메라 + 자세(궤도 회전·평행 이동·거리·줌) → 카메라 위치
function applyPose(camera, rig, base, p) {
  const s = base.sph.clone();
  s.theta += p.yaw * D2R;
  s.phi = THREE.MathUtils.clamp(s.phi - p.pitch * D2R, 0.05, Math.PI - 0.05);
  s.radius *= p.dolly;
  const tgt = rig.target.clone().addScaledVector(base.right, p.tx).addScaledVector(base.up, p.ty);
  camera.position.setFromSpherical(s).add(tgt);
  camera.lookAt(tgt);
  const fov = rig.fov / p.zoom;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();
}

// blurFor: 깊이 흐림 px (blurKey 가 바뀌면 다시 흐림)
function useLayerImage(url, blurFor, blurKey, single) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!url) return;
    let t, live = true;
    loadLayerTexture(url, (x) => { if (live) { t = x; setTex(x); } else x.dispose(); }, blurFor, single);
    return () => { live = false; t?.dispose(); setTex(null); };
  }, [url, blurKey]);   // eslint-disable-line react-hooks/exhaustive-deps
  return tex;
}

function Layer({ L, rig, base, dof }) {
  const useImg = !!L.img && L.useImg !== false;
  const g = layerGeom(L, rig, base);
  const img = useLayerImage(useImg ? L.img : null, layerBlurFor(L, g, base, dof), `${dof}|${L.band}|${L.D}`, L.single);
  const draw = useMemo(() => (L.look === "solid" ? solidTexture(L) : bandTexture(L)), [L]);
  useEffect(() => () => draw.dispose(), [draw]);
  const { at, W, top, bandH } = g;
  const rotY = Math.atan2(-rig.fH.x, -rig.fH.z);                 // 판 앞면이 카메라 쪽
  const kind = kindIndex(L.id);
  const fillH = L.place === "screen" && !L.noFill ? 2000 : 0;   // noFill: 그림 아래쪽이 투명한 모서리 전경
  const tex = useImg && img ? img : draw;
  const { tint, fill } = layerColors(L);
  const fade = edgeFadeTexture(L.fadeX);   // 판 양 끝 서서히 투명 (모서리 전경)
  let bandMeshH = bandH, bandUp = 0, bandW = W;
  if (tex === img) { const f = fitLayerTexture(tex, W, bandH, L.single); bandMeshH = f.h; bandUp = f.up; bandW = f.w; }
  else if (L.look !== "solid") { tex.repeat.x = Math.max(1, Math.round(W / (bandH * 4))); tex.needsUpdate = true; }

  return (L.x ?? [0]).map((x, i) => {
    const p = at.clone().addScaledVector(rig.right, x);
    return (
      <group key={i} position={[p.x, top, p.z]} rotation={[0, rotY, 0]} userData={{ kind }}>
        <mesh position={[0, -bandH / 2 + bandUp / 2, 0]}>
          <planeGeometry args={[bandW, bandMeshH]} />
          <meshBasicMaterial map={tex} color={tex === img ? tint : "#ffffff"} transparent={tex === img || L.look !== "solid" || !!fade} alphaTest={tex === img ? L.alphaTest ?? 0.01 : 0.5} alphaMap={fade} toneMapped={false} />
        </mesh>
        {fillH > 0 && (
          <mesh position={[0, -bandH * 0.99 - fillH / 2, 0]}>
            <planeGeometry args={[bandW, fillH]} />
            <meshBasicMaterial color={useImg && L.fill ? fill : L.color} transparent={!!fade} alphaMap={fade} toneMapped={false} />
          </mesh>
        )}
      </group>
    );
  });
}

// 하늘: 그라데이션 또는 이미지(화면 배경이라 카메라와 무관).
// 이미지는 위아래 위치(off)·세로 배율(scale)로 맞춤: 화면 높이 v(0 아래 ~ 1 위) 에 이미지 높이 off + v × scale 이 옴 (이미지 밖은 끝 색이 늘어남)
const SKY_IMG = LAYER_CFG.sky.image;   // 확정된 하늘 (env-layers.json)
function SkyBackground({ on, kind, off, scale, dof }) {
  const { scene } = useThree();
  const grad = useMemo(() => canvasTex(4, 512, (g, w, h) => skyGradient(g, w, h)), []);
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (kind !== "image") return;
    let t, live = true;
    // 하늘은 가장 먼 것이라 깊이 흐림 그대로 (이미지 세로 한 장 = 화면 세로의 1/scale)
    new THREE.ImageLoader().load(SKY_IMG, (im) => { t = imageTexture(im, dofImagePx(dof, im.height, 1 / scale)); if (live) setImg(t); else t.dispose(); });
    return () => { live = false; t?.dispose(); setImg(null); };
  }, [kind, dof, scale]);
  useEffect(() => {
    if (img) { img.offset.y = off; img.repeat.y = scale; }
    scene.background = !on ? new THREE.Color(EMPTY) : kind === "image" && img ? img : grad;
  }, [on, kind, img, off, scale, scene, grad]);
  useEffect(() => () => grad.dispose(), [grad]);
  return null;
}
// 이미지의 노을 가장 밝은 줄(아래에서 15%)이 먼 스카이라인 윗선(화면 72%)에 오게: off = 0.15 − 0.72 (늘이지 않음)
const SKY_FITS = { 원본: { off: 0, scale: 1 }, "노을↔스카이라인": { off: LAYER_CFG.sky.offsetY, scale: LAYER_CFG.sky.scaleY } };

// 창문 배경: "image" = 남산 이미지 (env-layers.json 의 window), "test" = 테스트 그림, "glb" = GLB 원래 그림
function WindowView({ rig, base, kind, dof }) {
  const tex = useMemo(() => windowTexture(), []);
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (kind !== "image") return;
    let t, live = true;
    // GLB UV 기준이라 flipY 끔 (이미지 위 = 판 위). 창밖은 멀리 있어 가장 먼 흐림
    new THREE.ImageLoader().load(LAYER_CFG.window.image, (im) => {
      t = imageTexture(im, windowBlurPx({ ...LAYER_CFG, dof: { strength: dof } }, rig, base, im.height), { flipY: false });
      if (live) setImg(t); else t.dispose();
    });
    return () => { live = false; t?.dispose(); setImg(null); };
  }, [kind, dof, rig, base]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  // "glass": 창문 그림 판을 숨기고 유리만 → 창 너머로 바깥 레이어
  useEffect(() => {
    const m = rig.windowCity;
    if (kind !== "glass" || !m) return;
    const glass = createWindowGlass(rig.root);
    m.visible = false;
    return () => { m.visible = true; if (glass) { glass.removeFromParent(); glass.material.map.dispose(); glass.material.dispose(); glass.geometry.dispose(); } };
  }, [rig, kind]);
  useEffect(() => {
    const m = rig.windowCity;
    if (!m || kind === "glb" || kind === "glass") return;
    mat.map = kind === "image" && img ? img : tex;
    mat.needsUpdate = true;
    const orig = m.material;
    m.material = mat;
    return () => { m.material = orig; };
  }, [rig, kind, img, mat, tex]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  return null;
}

// parallax: "off" | "orbit"(방 가운데를 ±3°·±1.5° 돎) | "truck"(회전 없이 ±0.75m·±0.4m 평행 이동)
function CameraRig({ rig, base, cam, parallax, amt = 1 }) {
  const { camera, pointer } = useThree();
  const sm = useRef({ x: 0, y: 0 });
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 4);
    sm.current.x += ((parallax !== "off" ? pointer.x : 0) - sm.current.x) * k;
    sm.current.y += ((parallax !== "off" ? pointer.y : 0) - sm.current.y) * k;
    const p = { ...cam };
    // amt: 시차 세기 (1 = 궤도 ±3°·±1.5°, 평행 ±0.75m·±0.4m)
    if (parallax === "orbit") { p.yaw += sm.current.x * ORBIT.yaw * amt; p.pitch += sm.current.y * ORBIT.pitch * amt; }
    if (parallax === "truck") { p.tx += sm.current.x * TRUCK.x * amt; p.ty += sm.current.y * TRUCK.y * amt; }
    applyPose(camera, rig, base, p);
  });
  return null;
}

// 카메라가 움직이는 범위(궤도 / 평행 이동의 9 자세) 동안 각 레이어가 화면에 드러나는 부분을 광선으로 계산
// 레이어는 가까운 것부터 가림. 방은 가림에 넣지 않음(= 이미지가 필요한 영역을 넉넉하게 잡음)
const POSES = {
  orbit: [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => ({ ...CAM0, yaw: a * ORBIT.yaw, pitch: b * ORBIT.pitch }))),
  truck: [-1, 0, 1].flatMap((a) => [-1, 0, 1].map((b) => ({ ...CAM0, tx: a * TRUCK.x, ty: b * TRUCK.y }))),
};
const SHOT_PX = { w: 1920, h: 1080, dpr: 2 };    // 기준 화면: 1080p, 레티나
function analyze(rig, base, layers, poseSets = POSES) {
  const cam = new THREE.PerspectiveCamera(rig.fov, ASPECT, 0.1, 4000);
  const geo = layers.filter((L) => L.on).map((L) => ({ L, g: layerGeom(L, rig, base) })).sort((a, b) => a.L.D - b.L.D);
  const plane = (g) => new THREE.Plane().setFromNormalAndCoplanarPoint(rig.fH, g.at);
  const ray = new THREE.Raycaster();
  const hit = new THREE.Vector3();
  const NX = 33, NY = 81;
  const res = {};
  for (const { L } of geo) res[L.id] = { uMin: Infinity, uMax: -Infinity, vMin: Infinity, vMax: -Infinity, topScr: [Infinity, -Infinity], edge: false, maxDist: 0 };
  const sky = { lowest: 1 };
  const shift = {};
  for (const [setName, poses] of Object.entries(poseSets)) for (const p of poses) {
    applyPose(cam, rig, base, p);
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const sx = (i / (NX - 1)) * 2 - 1, sy = (j / (NY - 1)) * 2 - 1;
      ray.setFromCamera(new THREE.Vector2(sx, sy), cam);
      let got = null;
      for (const { L, g } of geo) {
        if (!ray.ray.intersectPlane(plane(g), hit)) continue;
        if (hit.y > g.top || hit.y < g.bottom) continue;
        const u = hit.clone().sub(g.at).dot(rig.right);
        const inside = g.xs.some((x) => Math.abs(u - x) <= g.W / 2);
        if (!inside) { res[L.id].edge = true; continue; }        // 판 옆으로 새는 시선 = 가장자리 드러남
        const r = res[L.id];
        r.uMin = Math.min(r.uMin, u); r.uMax = Math.max(r.uMax, u);
        r.vMin = Math.min(r.vMin, hit.y); r.vMax = Math.max(r.vMax, hit.y);
        r.maxDist = Math.max(r.maxDist, hit.distanceTo(cam.position));
        got = L.id; break;
      }
      if (!got) sky.lowest = Math.min(sky.lowest, (sy + 1) / 2);
    }
    // 레이어 윗선이 화면 어디에 오는지 (가운데 기준)
    for (const { L, g } of geo) {
      const s = (g.at.clone().setY(g.top).project(cam).y + 1) / 2;
      res[L.id].topScr = [Math.min(res[L.id].topScr[0], s), Math.max(res[L.id].topScr[1], s)];
    }
    // 시차: 오른쪽 끝 자세에서 각 레이어 윗선 가운데와 방 가운데가 화면에서 얼마나 움직였나 (1920 기준 px)
    const isEdge = setName === "orbit" ? p.yaw === ORBIT.yaw && p.pitch === 0 : p.tx === TRUCK.x && p.ty === 0;
    if (isEdge) {
      const px = (v) => ((v.clone().project(cam).x + 1) / 2) * SHOT_PX.w;
      const cam0 = new THREE.PerspectiveCamera(rig.fov, ASPECT, 0.1, 4000);
      applyPose(cam0, rig, base, CAM0);
      const px0 = (v) => ((v.clone().project(cam0).x + 1) / 2) * SHOT_PX.w;
      shift[setName] = { 방: px(rig.target) - px0(rig.target) };
      for (const { L, g } of geo) { const v = g.at.clone().setY(g.top); shift[setName][L.name] = px(v) - px0(v); }
    }
  }
  // 비교용 제자리 회전: 카메라 위치는 그대로 두고 고개만 3° 돌림 → 모든 것이 같은 만큼 밀려 깊이 차이(시차)가 없음
  {
    const cam0 = new THREE.PerspectiveCamera(rig.fov, ASPECT, 0.1, 4000);
    applyPose(cam0, rig, base, CAM0);
    cam.copy(cam0); cam.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), ORBIT.yaw * D2R); cam.updateMatrixWorld();
    const px = (c, v) => ((v.clone().project(c).x + 1) / 2) * SHOT_PX.w;
    shift.pan = { 방: px(cam, rig.target) - px(cam0, rig.target) };
    for (const { L, g } of geo) { const v = g.at.clone().setY(g.top); shift.pan[L.name] = px(cam, v) - px(cam0, v); }
  }
  // 이미지 크기: 기준 화면(1080p × dpr 2)에서 그 깊이 1m 가 몇 px 인지로 환산
  const out = geo.map(({ L, g }) => {
    const r = res[L.id];
    const pxPerM = (SHOT_PX.h * SHOT_PX.dpr) / g.viewH;
    const w = r.uMax - r.uMin, h = g.top - r.vMin;
    return {
      id: L.id, name: L.name, D: L.D, s: L.s ?? null,
      plane: { topY: +g.top.toFixed(2), centerOffset: +((r.uMin + r.uMax) / 2).toFixed(2), distFromCam: +g.dist.toFixed(1), viewH: +g.viewH.toFixed(2) },
      need: { w: +w.toFixed(2), h: +h.toFixed(2), aspect: +(w / h).toFixed(2), bottomY: +r.vMin.toFixed(2) },
      topOnScreen: r.topScr.map((v) => +(v * 100).toFixed(1)),
      px: { sharp: [Math.ceil(w * pxPerM), Math.ceil(h * pxPerM)] },
      edgeExposed: r.edge, maxDist: +r.maxDist.toFixed(1),
    };
  });
  return { layers: out, skyLowest: +(sky.lowest * 100).toFixed(1), shift, far: cam.far };
}

// 영역 보기: 종류마다 단색으로 칠해 레이어 경계를 보이게 (하늘 = 노랑)
const REGION = { 배경: "#ffd36b", 방: "#9a9a9a", "방 아래 건물": "#5f5f66", 땅: "#3c3c44", "창문 배경(남산)": "#ff5fc8",
  "먼 스카이라인": "#7b68e0", "강 건너 아파트": "#e0705f", 한강: "#36a2e0", "가까운 건물": "#3fbf8c",
  "가까운 둔치·나무": "#2fbf6a", "강둑 잔디·길": "#c8e64a", "남산(창 너머)": "#ff9f1c", "카메라 앞 옥상(전경)": "#ff4f4f", "카메라 앞 옥상 왼쪽": "#ff4f4f", "카메라 앞 옥상 오른쪽": "#ff4f4f" };
function RegionView({ on }) {
  const { scene } = useThree();
  const mats = useMemo(() => KINDS.map((k) => new THREE.MeshBasicMaterial({ color: REGION[k] ?? "#ffffff", toneMapped: false, side: THREE.DoubleSide })), []);
  useFrame(() => {
    if (!on) return;
    // 매 프레임 다시 칠함 (레이어를 켜고 끄면 새 메시가 생기므로)
    scene.traverse((o) => {
      if (!o.isMesh || o.name === "window_glass") return;   // 유리는 그대로 (창 너머가 보이게)
      const m = mats[kindOf(o)];
      if (o.material !== m) { o.userData.origMat = o.material; o.material = m; }
    });
  });
  useEffect(() => {
    if (on) { const bg = scene.background; scene.background = new THREE.Color(REGION.배경); return () => {
      scene.background = bg;
      scene.traverse((o) => { if (o.isMesh && o.userData.origMat) { o.material = o.userData.origMat; delete o.userData.origMat; } });
    }; }
  }, [on, scene]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return null;
}

function kindOf(o) {
  while (o) {
    if (o.userData.kind != null) return o.userData.kind;
    if (o.userData.ground) return 3;
    if (o.name === "Window_City") return 4;
    if (o.name?.startsWith("building")) return 2;
    o = o.parent;
  }
  return 1;
}

// 화면 정보: 카메라 각·fps 는 0.25초마다 글자만 바꿈.
// 화면 비율 측정은 비싸서(작은 화면에 종류별 단색으로 한 번 더 그리고 픽셀을 읽음) 켰을 때 1초마다, 또는 버튼으로 한 번만.
function Readout({ rig, infoRef, probeRef, probeOn, measureReq }) {
  const { camera, scene, gl } = useThree();
  const PW = 160, PH = 90;
  const rt = useMemo(() => new THREE.WebGLRenderTarget(PW, PH), []);
  const buf = useMemo(() => new Uint8Array(PW * PH * 4), []);
  const mats = useMemo(() => KINDS.map((_, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB((i * 12) / 255, 0, 0), toneMapped: false, side: THREE.DoubleSide })), []);
  useEffect(() => () => { rt.dispose(); mats.forEach((m) => m.dispose()); }, [rt, mats]);
  const t = useRef({ info: 0, probe: 0, frames: 0, fps: 0, fpsT: 0 });

  useFrame((_, dt) => {
    const s = t.current;
    s.frames++; s.fpsT += dt; s.info += dt; s.probe += dt;
    if (s.fpsT >= 1) { s.fps = s.frames / s.fpsT; s.frames = 0; s.fpsT = 0; }

    if (s.info >= 0.25 && infoRef.current) {
      s.info = 0;
      const dir = camera.getWorldDirection(new THREE.Vector3());
      const down = Math.asin(-dir.y) / D2R;
      const top = down - camera.fov / 2;
      infoRef.current.textContent = [
        `${s.fps.toFixed(0)} fps · 탭 ${document.visibilityState === "visible" ? "보임" : "숨김"} · 측정 ${probeOn ? "켜짐" : "꺼짐"}`,
        `카메라 (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})  세로 시야 ${camera.fov.toFixed(1)}°`,
        `내려다보는 각 ${down.toFixed(1)}° · 화면 위쪽 끝 ${top > 0 ? `수평 아래 ${top.toFixed(1)}°` : `수평 위 ${(-top).toFixed(1)}°`}`,
      ].join("\n");
    }

    const want = measureReq.current || (probeOn && s.probe >= 1);
    if (!want || !probeRef.current) return;
    measureReq.current = false; s.probe = 0;
    const saved = [];
    scene.traverse((o) => {
      if (o.isMesh && o.visible) { saved.push([o, o.material]); o.material = mats[kindOf(o)]; }
      else if (o.isLine && o.visible) { saved.push([o, null]); o.visible = false; }
    });
    const bg = scene.background; scene.background = null;
    const cc = gl.getClearColor(new THREE.Color()), ca = gl.getClearAlpha();
    gl.setClearColor(0x000000, 1);
    // 카메라 화면비는 그대로 (작은 화면에 늘려 그려도 넓이 비율은 같음)
    gl.setRenderTarget(rt); gl.clear(); gl.render(scene, camera); gl.setRenderTarget(null);
    gl.readRenderTargetPixels(rt, 0, 0, PW, PH, buf);
    gl.setClearColor(cc, ca); scene.background = bg;
    for (const [o, m] of saved) { if (m) o.material = m; else o.visible = true; }
    const count = {};
    for (let i = 0; i < buf.length; i += 4) {
      const k = KINDS[Math.round(buf[i] / 12)] ?? "?";
      count[k] = (count[k] ?? 0) + 1;
    }
    probeRef.current.textContent = ["화면에서 차지하는 비율", ...Object.entries(count).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `  ${k}  ${((n / (PW * PH)) * 100).toFixed(1)}%`)].join("\n");
  });
  return null;
}

// dusk: 노을 조명 (env-layers.json 의 light). 끄면 room-test 원래 밤빛(차가운 달빛)
// 이웃 옥상 3D 자리잡기용 상자 (env-layers.json 의 neighbors, Blender 좌표: x, y 범위·deck = 옥상 바닥 높이 Z, 방 바닥 = 0)
// 건물 상자(땅 ~ 옥상 바닥) + 난간 네 변. glTF 좌표로: (x, Z, −y)
function NeighborBlockout({ rig }) {
  const items = LAYER_CFG.neighbors ?? [];
  return items.filter((n) => n.on !== false).map((n) => {
    const [x0, x1] = n.x, [y0, y1] = n.y, top = n.deck, bot = rig.ground, ph = n.parapet ?? 1, t = 0.18;
    const cx = (x0 + x1) / 2, cz = -(y0 + y1) / 2, w = x1 - x0, d = y1 - y0;
    const walls = [[cx, -y0, w, t], [cx, -y1, w, t], [x0, cz, t, d], [x1, cz, t, d]];
    return (
      <group key={n.id} userData={{ kind: kindIndex("h_fg_l") }}>
        <mesh position={[cx, (top + bot) / 2, cz]}>
          <boxGeometry args={[w, top - bot, d]} />
          <meshStandardMaterial color={n.color ?? "#d9c6b0"} roughness={0.9} />
        </mesh>
        {walls.map(([x, z, ww, dd], i) => (
          <mesh key={i} position={[x, top + ph / 2, z]}>
            <boxGeometry args={[ww, ph, dd]} />
            <meshStandardMaterial color={n.parapetColor ?? "#efe2cf"} roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  });
}

function Lights({ dusk }) {
  const L = LAYER_CFG.light;
  return dusk ? (
    <>
      <hemisphereLight args={[L.hemiSky, L.hemiGround, L.hemiIntensity]} />
      <directionalLight color={L.sunColor} intensity={L.sunIntensity} position={[-10, 8, 4]} />
    </>
  ) : (
    <>
      <hemisphereLight args={["#9fb0d8", "#2a2230", 1.0]} />
      <directionalLight color="#8fa6d8" intensity={0.7} position={[-10, 8, 4]} />
    </>
  );
}

export default function EnvTest() {
  // 비교 캡처용 주소 파라미터: ?yaw=3&tx=0.75&region=1&panel=0&mode=hybrid&preset=A
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const qn = (k) => (q.has(k) ? +q.get(k) : 0);
  const [rig, setRig] = useState(null);
  const [mode, setMode] = useState(() => (MODES[q.get("mode")] ? q.get("mode") : "hybrid"));
  // 캡처 비교용으로 주소에서 레이어 값을 덮어씀: ?L.h_apts.s=0.7&L.h_apts.tint=0.85
  const [layers, setLayers] = useState(() => Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, m.layers.map((L) => {
    const o = { ...L };
    for (const [key, v] of q) { const [p, id, f] = key.split("."); if (p === "L" && id === L.id) o[f] = +v; }
    return o;
  })])));
  const [presetId, setPresetId] = useState(() => (PRESETS.some((p) => p.id === q.get("preset")) ? q.get("preset") : LAYER_CFG.camera.preset));   // 기본 = env-layers.json (B 18°)
  const [cam, setCam] = useState(() => ({ ...CAM0, yaw: qn("yaw"), pitch: qn("pitch"), tx: qn("tx"), ty: qn("ty"), zoom: q.has("zoom") ? qn("zoom") : 1 }));   // ?zoom=4 처럼 확대해서 열기
  const [parallax, setParallax] = useState(q.get("parallax") ?? LAYER_CFG.camera.parallax.type);   // 기본 = 마우스 궤도 ±3°
  const [pAmt, setPAmt] = useState(() => (q.has("pamt") ? qn("pamt") : LAYER_CFG.camera.parallax.amount ?? 1));   // 시차 세기 기본 = env-layers.json (×0.3)
  const [dusk, setDusk] = useState(q.get("dusk") !== "0");   // 노을 조명
  const [dof, setDof] = useState(() => (q.has("dof") ? qn("dof") : LAYER_CFG.dof?.strength ?? 0));   // 깊이 흐림 (먼 곳, 1080p 화면 px)
  const [region, setRegion] = useState(q.get("region") === "1");
  const [panel, setPanel] = useState(q.get("panel") !== "0");
  const [report, setReport] = useState(null);
  const [windowView, setWindowView] = useState(q.get("win") ?? (LAYER_CFG.window.mode === "glass" ? "glass" : "image"));   // 기본 = env-layers.json (유리)
  const [skyKind, setSkyKind] = useState(q.get("sky") === "grad" ? "gradient" : "image");
  const [sky, setSky] = useState(() => (q.has("skyoff") ? { off: qn("skyoff"), scale: q.has("skyscale") ? qn("skyscale") : 1 } : SKY_FITS["노을↔스카이라인"]));
  const [probeOn, setProbeOn] = useState(false);
  const [exposure, setExposure] = useState(1);
  const glRef = useRef(null);
  const replayRef = useRef(null);
  const infoRef = useRef(null);
  const probeRef = useRef(null);
  const measureReq = useRef(true);

  const M = MODES[mode];
  const preset = PRESETS.find((p) => p.id === presetId);
  const base = useMemo(() => (rig ? makeBase(rig, preset) : null), [rig, preset]);

  useEffect(() => { if (glRef.current) glRef.current.toneMappingExposure = exposure; }, [exposure]);
  useEffect(() => { measureReq.current = true; }, [mode, presetId, layers, windowView]);
  useEffect(() => {
    window.__env = { rig, base, mode, setMode, setPresetId, cam, setCam, layers, setRegion, setPanel, setParallax,
      measure: () => (measureReq.current = true), analyze: (sets) => analyze(rig, base, layers.hybrid, sets), CAM0, POSES };
  }, [rig, base, mode, cam, layers]);
  const runReport = () => {
    const a = analyze(rig, base, layers.hybrid);
    setReport([
      `하늘이 보이는 가장 낮은 곳: 화면 아래에서 ${a.skyLowest}%`,
      ...a.layers.map((r) => `${r.name} (${r.D}m): 필요 ${r.need.w}×${r.need.h}m (${r.need.aspect}:1) · 선명 ${r.px.sharp.join("×")}px · 윗선 화면 ${r.topOnScreen.join("~")}%${r.edgeExposed ? " · 가장자리 드러남!" : ""}`),
      `시차 (오른쪽 끝, 1920px 기준)`,
      ...Object.entries(a.shift).map(([k, v]) => `  ${{ orbit: "궤도 +3°", truck: "평행 +0.75m", pan: "제자리 회전 3°" }[k]}: ` + Object.entries(v).map(([n, d]) => `${n} ${d.toFixed(0)}`).join(" · ")),
      `가장 먼 지점 ${Math.max(...a.layers.map((r) => r.maxDist))}m / 카메라 far ${a.far}m`,
    ].join("\n"));
  };

  const setL = (id, patch) => setLayers((all) => ({ ...all, [mode]: all[mode].map((L) => (L.id === id ? { ...L, ...patch } : L)) }));
  const slider = (lab, v, min, max, step, on, fmt = (x) => x) => (
    <label className="block">
      <div className="flex justify-between"><span>{lab}</span><span>{fmt(v)}</span></div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => on(+e.target.value)} className="w-full" />
    </label>
  );
  const btn = (on, text, onClick, key) => (
    <button key={key} onClick={onClick} className={`rounded px-2 py-1 ${on ? "bg-white text-black" : "bg-white/15"}`}>{text}</button>
  );

  return (
    // 사이트 머리글보다 위에 (페이지 안은 쌓임 순서가 갇혀 있어서 body 로 꺼냄), 16:9 화면을 가운데에
    createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#111", display: "grid", placeItems: "center" }}>
      <div style={q.get("fit") === "1" ? { position: "absolute", inset: 0 } : { width: `min(100vw, ${100 * ASPECT}vh)`, aspectRatio: "16 / 9", position: "relative" }}>
        <Canvas
          camera={{ fov: 17, near: 0.1, far: 4000, position: [11, 7, 7] }}
          onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; glRef.current = gl; }}
          dpr={[1, 2]}
        >
          <Lights dusk={dusk} />
          <Suspense fallback={null}>
            <Room onReady={setRig} replayRef={replayRef} />
          </Suspense>
          <SkyBackground on={M.sky} kind={skyKind} off={sky.off} scale={sky.scale} dof={dof} />
          {rig && base && (
            <>
              <CameraRig rig={rig} base={base} cam={cam} parallax={parallax} amt={pAmt} />
              <WindowView rig={rig} base={base} kind={windowView} dof={dof} />
              <RegionView on={region} />
              {q.get("nb") === "1" && <NeighborBlockout rig={rig} />}
              {layers[mode].filter((L) => L.on).map((L) => <Layer key={L.id + presetId} L={L} rig={rig} base={base} dof={dof} />)}
              {M.ground && (
                <>
                  <mesh position={[rig.target.x, rig.ground - 0.01, rig.target.z]} rotation={[-Math.PI / 2, 0, 0]} userData={{ ground: true }}>
                    <planeGeometry args={[4000, 4000]} />
                    <meshBasicMaterial color="#4a4a52" toneMapped={false} />
                  </mesh>
                  <gridHelper args={[400, 40, "#6a6a75", "#5a5a64"]} position={[rig.target.x, rig.ground + 0.02, rig.target.z]} />
                </>
              )}
              <Readout rig={rig} infoRef={infoRef} probeRef={probeRef} probeOn={probeOn} measureReq={measureReq} />
            </>
          )}
        </Canvas>
      </div>

      {!panel && q.get("ui") !== "0" && <button onClick={() => setPanel(true)} className="absolute top-3 left-3 rounded bg-black/60 px-2 py-1 text-[12px] text-white">패널</button>}
      <div className="absolute top-3 left-3 w-72 max-h-[calc(100vh-24px)] overflow-auto rounded-lg bg-black/75 p-3 text-[12px] text-white space-y-2" style={{ display: panel ? undefined : "none" }}>
        <div className="flex justify-between items-center">
          <b>배경 구성 테스트</b>
          <Link href="/lab/room-test" className="underline opacity-70">room-test</Link>
        </div>

        <div className="pt-1 font-bold">배경 모드</div>
        <div className="flex gap-1">{Object.entries(MODES).map(([k, m]) => btn(mode === k, m.label, () => setMode(k), k))}</div>
        <div className="opacity-70">{M.desc}{mode === "physical" ? " · 분홍 = 아무것도 없는 곳" : ""}</div>

        <div className="pt-1 font-bold">카메라 프리셋 (내려다보는 각)</div>
        <div className="flex gap-1">{PRESETS.map((p) => btn(presetId === p.id, p.label, () => { setPresetId(p.id); setCam(CAM0); }, p.id))}</div>
        <div className="opacity-70">{preset.desc}{base ? ` · 실제 ${base.elev.toFixed(1)}°, 거리 ${base.sph.radius.toFixed(1)}m` : ""}</div>
        {slider("좌우 회전", cam.yaw, -25, 25, 0.5, (v) => setCam({ ...cam, yaw: v }), (x) => `${x}°`)}
        {slider("위아래 (−면 낮게)", cam.pitch, -25, 20, 0.5, (v) => setCam({ ...cam, pitch: v }), (x) => `${x}°`)}
        {slider("거리", cam.dolly, 0.5, 2, 0.01, (v) => setCam({ ...cam, dolly: v }), (x) => `×${x.toFixed(2)}`)}
        {slider("줌", cam.zoom, 0.5, 2, 0.01, (v) => setCam({ ...cam, zoom: v }), (x) => `×${x.toFixed(2)}`)}
        {slider("평행 이동 좌우", cam.tx, -2, 2, 0.05, (v) => setCam({ ...cam, tx: v }), (x) => `${x.toFixed(2)}m`)}
        {slider("평행 이동 위아래", cam.ty, -1, 1, 0.05, (v) => setCam({ ...cam, ty: v }), (x) => `${x.toFixed(2)}m`)}
        <div>마우스 시차</div>
        <div className="flex gap-1">
          {btn(parallax === "off", "끔", () => setParallax("off"))}
          {btn(parallax === "orbit", "궤도 ±3°", () => setParallax("orbit"))}
          {btn(parallax === "truck", "평행 ±0.75m", () => setParallax("truck"))}
        </div>
        {parallax !== "off" && slider("시차 세기 (이미지 기준은 ×1)", pAmt, 0, 3, 0.1, setPAmt, (x) => `×${x.toFixed(1)}`)}
        <div className="flex gap-1">
          {btn(false, "카메라 처음대로", () => setCam(CAM0))}
          {btn(false, "reveal 다시", () => replayRef.current?.())}
        </div>

        <div className="pt-1 font-bold">레이어</div>
        {layers[mode].length === 0 && <div className="opacity-70">이 모드는 판 없음</div>}
        {layers[mode].map((L) => (
          <div key={L.id} className="rounded bg-white/5 p-2 space-y-1">
            <label className="flex gap-2 items-center">
              <input type="checkbox" checked={L.on} onChange={(e) => setL(L.id, { on: e.target.checked })} />
              <span style={{ background: L.color }} className="inline-block w-3 h-3 rounded-sm" />{L.name}
            </label>
            {slider("방에서 거리", L.D, 5, 600, 1, (v) => setL(L.id, { D: v }), (x) => `${x}m`)}
            {L.place === "screen"
              ? slider("화면 윗선 (기준 카메라)", L.s, 0, 1, 0.01, (v) => setL(L.id, { s: v }), (x) => `${Math.round(x * 100)}%`)
              : slider("높이 (땅부터)", L.H, 2, 400, 1, (v) => setL(L.id, { H: v }), (x) => `${x}m`)}
            {L.img && (
              <>
                <label className="flex gap-2"><input type="checkbox" checked={L.useImg !== false} onChange={(e) => setL(L.id, { useImg: e.target.checked })} />이미지 사용 (끄면 임시 그림)</label>
                {slider("띠 높이 (화면 세로)", L.band ?? 0.16, 0.05, 0.4, 0.01, (v) => setL(L.id, { band: v }), (x) => `${Math.round(x * 100)}%`)}
                {slider("밝기 (이미지에 곱함)", L.tint ?? 1, 0.4, 1.2, 0.01, (v) => setL(L.id, { tint: v }), (x) => `×${x.toFixed(2)}`)}
              </>
            )}
          </div>
        ))}
        {layers[mode].length > 0 && btn(false, "레이어 처음대로", () => setLayers((all) => ({ ...all, [mode]: MODES[mode].layers })))}

        <div className="pt-1 font-bold">조명</div>
        <div className="flex gap-1">
          {btn(dusk, "노을빛", () => setDusk(true))}
          {btn(!dusk, "원래 밤빛", () => setDusk(false))}
        </div>

        <div className="pt-1 font-bold">깊이 흐림</div>
        {slider("먼 곳 흐림 (1080p 화면 px, 0 = 끔)", dof, 0, 8, 0.5, setDof, (x) => `${x}px`)}
        <div className="opacity-70">방이 초점. 레이어는 거리만큼 덜 흐림 (잔디 ×0.48 ~ 스카이라인 ×0.96, 하늘·창밖 ×1)</div>

        <div className="pt-1 font-bold">하늘 (화면 배경)</div>
        <div className="flex gap-1">
          {btn(skyKind === "image", "이미지", () => setSkyKind("image"))}
          {btn(skyKind === "gradient", "그라데이션", () => setSkyKind("gradient"))}
        </div>
        {skyKind === "image" && (
          <>
            <div className="flex gap-1">{Object.entries(SKY_FITS).map(([k, v]) => btn(sky.off === v.off && sky.scale === v.scale, k, () => setSky(v), k))}</div>
            {slider("위아래 위치", sky.off, -1.5, 0.5, 0.01, (v) => setSky({ ...sky, off: v }), (x) => x.toFixed(2))}
            {slider("세로 배율 (1 = 원본)", sky.scale, 0.3, 3, 0.01, (v) => setSky({ ...sky, scale: v }), (x) => `×${x.toFixed(2)}`)}
          </>
        )}

        <div className="pt-1 font-bold">기타</div>
        <div>창문 안</div>
        <div className="flex gap-1">
          {btn(windowView === "image", "남산 이미지", () => setWindowView("image"))}
          {btn(windowView === "test", "테스트 그림", () => setWindowView("test"))}
          {btn(windowView === "glb", "GLB 원래", () => setWindowView("glb"))}
          {btn(windowView === "glass", "유리", () => setWindowView("glass"))}
        </div>
        {slider("노출", exposure, 0.2, 3, 0.05, setExposure, (x) => x.toFixed(2))}
        <label className="flex gap-2"><input type="checkbox" checked={probeOn} onChange={(e) => setProbeOn(e.target.checked)} />화면 비율 계속 측정 (1초마다, 무거움)</label>
        {btn(false, "지금 한 번 측정", () => (measureReq.current = true))}
        <label className="flex gap-2"><input type="checkbox" checked={region} onChange={(e) => setRegion(e.target.checked)} />영역 보기 (종류별 단색)</label>
        <div className="flex gap-1">
          {btn(false, "레이어 영역 계산 (Hybrid)", runReport)}
          {btn(false, "패널 숨기기", () => setPanel(false))}
        </div>
        {report && <pre className="whitespace-pre-wrap leading-snug opacity-90">{report}</pre>}

        <pre ref={infoRef} className="whitespace-pre-wrap pt-2 border-t border-white/20 leading-snug" />
        <pre ref={probeRef} className="whitespace-pre-wrap leading-snug" />
      </div>
    </div>, document.body)
  );
}
