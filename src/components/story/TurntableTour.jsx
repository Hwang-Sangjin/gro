"use client";
// 스크롤 투어 — Home 방 모델의 턴테이블만 꺼내서, 스크롤하면 카메라가 부품을 차례로 찾아감 (Vinyl A to Z 04)
//  - 모델: 방 GLB(grooves_room_blockout_reveal.glb, Home 을 본 사람은 브라우저에 있음)에서 Turntable_Plinth 만 떼어 씀
//  - 재질 · 빛: Home 과 같은 turntableLook.js (덧붙인 노브 · 버튼 · 피치 · 명판 포함)
//  - 이 투어에서만 붙이는 부품 둘: 안티스케이팅 다이얼 · 큐 레버 (turntableDetails 와 같은 방식, 본체 좌표 m)
//  - 단계(steps)마다: 카메라 자세(초점 부품 둘레의 방위 · 높이 · 거리) · 밝힐 부품(이름) · 이름표 · 움직임(아래 pose())
//  - 마지막 단계의 버튼: 소리를 켜고 바늘을 내림 (Home 의 바늘 소리)
//  - WebGL 을 못 쓰면 글 카드만 (그림 없이도 읽힘)
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { applyTurntableLook } from "@/components/roomtest/turntableLook";
import { makeEnvironment, makeRecord, drawLabel } from "@/components/roomtest/sleeveParts";
import { createRoomSound } from "@/components/roomtest/roomSound";
import { scrollerOf, useScrollProgress } from "./scroll";

const MODEL_URL = "/models/room/grooves_room_blockout_reveal.glb";
const DECK = 0.0936;                       // 데크 윗면 높이 (본체 기준, turntableDetails.js 와 같은 값)
const PLATTER = { x: -0.0421, z: -0.007 }; // 플래터 가운데
const ARM_SWING = -0.42;                   // 톤암이 판 위로 들어가는 각도 (Home 과 같은 값)
const ARM_LIFT = -0.035;                   // 큐 레버로 들었을 때 톤암 기울기 (rad, 헤드셸 쪽이 약 7mm 뜸)
const RPM = (r) => (r / 60) * Math.PI * 2;
const ACCENT = "#7fc1bd";
const AS = { x: 0.104, z: -0.132 };        // 안티스케이팅 다이얼 자리 (톤암 받침 왼쪽 뒤)
const CUE = { x: 0.181, z: -0.058 };       // 큐 레버 자리 (톤암 받침 오른쪽 앞, 피치 홈보다 뒤)

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const range = (s, a, b) => clamp01((s - a) / (b - a));
const smooth = (x) => x * x * (3 - 2 * x);
const sr = (s, a, b) => smooth(range(s, a, b));

// ── 이 투어에서만 붙이는 부품 (본체의 자식, 좌표는 본체 기준)
function addTourParts(plinth, track) {
  const group = new THREE.Group();
  group.name = "TourParts";
  plinth.add(group);
  const made = [];
  const P = (o) => { const m = new THREE.MeshPhysicalMaterial(o); track(m); return m; };
  const alu = P({ color: "#c9ccd1", roughness: 0.25, metalness: 1 });
  const black = P({ color: "#141416", roughness: 0.4, metalness: 0.35, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); made.push(m); return m; };

  // 안티스케이팅: 은색 고리 받침 + 검은 다이얼(돌아감) + 흰 표시선
  const antiSkate = new THREE.Group(); antiSkate.name = "Web_AntiSkate"; antiSkate.position.set(AS.x, DECK, AS.z); group.add(antiSkate);
  add(new THREE.CylinderGeometry(0.0105, 0.0112, 0.0018, 40), alu, 0, 0.0009, 0, antiSkate);
  const dial = new THREE.Group(); dial.position.y = 0.0018; antiSkate.add(dial);
  add(new THREE.CylinderGeometry(0.0082, 0.0086, 0.0062, 40), black, 0, 0.0031, 0, dial);
  add(new THREE.BoxGeometry(0.0012, 0.0004, 0.006), P({ color: "#f1ead8", roughness: 0.6 }), 0, 0.0064, 0.0036, dial);
  // 눈금 점 0 ~ 3 (다이얼 둘레)
  const tick = P({ color: "#ece5d3", roughness: 0.7 });
  for (let i = 0; i <= 6; i++) { const a = -Math.PI * 0.75 + (i / 6) * Math.PI * 1.5; add(new THREE.CylinderGeometry(i % 2 ? 0.0004 : 0.0007, i % 2 ? 0.0004 : 0.0007, 0.0002, 10), tick, Math.sin(a) * 0.0135, DECK + 0.0001, AS.z + Math.cos(a) * 0.0135 - AS.z).position.set(AS.x + Math.sin(a) * 0.0135, DECK + 0.0001, AS.z + Math.cos(a) * 0.0135); }

  // 큐 레버: 은색 기둥 + 검은 손잡이 막대(들면 올라감)
  const cue = new THREE.Group(); cue.name = "Web_CueLever"; cue.position.set(CUE.x, DECK, CUE.z); group.add(cue);
  add(new THREE.CylinderGeometry(0.0045, 0.005, 0.0022, 28), alu, 0, 0.0011, 0, cue);
  add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.012, 20), alu, 0, 0.0082, 0, cue);
  const handle = new THREE.Group(); handle.position.y = 0.0135; cue.add(handle);
  add(new THREE.BoxGeometry(0.0038, 0.0032, 0.022), black, 0, 0, 0.0095, handle);
  add(new THREE.SphereGeometry(0.0026, 16, 12), black, 0, 0, 0.0205, handle);

  return {
    dial, handle,
    dispose() { for (const m of made) { m.geometry.dispose(); } group.removeFromParent(); },
  };
}

/**
 * @param steps [{ focus?: string[], at?: [x,y,z], cam: { az, el, dist }, label?: string }] — 본체 좌표(m) · 각도(도)
 * @param renderCard (step, i) => ReactNode : 단계마다 글 카드
 */
export default function TurntableTour({ steps, renderCard, dropLabel = "Drop the needle" }) {
  const wrapRef = useRef(null), hostRef = useRef(null), labelRef = useRef(null);
  const st = useRef({ s: 0, dropped: false, dropT: 0 }).current;
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [dropped, setDropped] = useState(false);
  const N = steps.length;

  const onProgress = useCallback((p) => { st.s = p * (N - 1); }, [st, N]);
  useScrollProgress(wrapRef, { mode: "scene", onProgress, cssVar: "--tour" });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.setClearColor(0, 0);
    const canvas = renderer.domElement;
    canvas.className = "absolute inset-0 size-full";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
    scene.add(new THREE.HemisphereLight(0xfff4e2, 0x6d6258, 1.1));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    scene.add(key, key.target);
    const env = makeEnvironment(renderer);
    const sound = createRoomSound();
    st.sound = sound;

    let alive = true, raf = 0, look = null, parts = null, mixer = null, closeAct = null, closeEnd = 0, record = null;
    const tilt = new THREE.Group();   // 수평 단계: 본체를 살짝 기울임 (바닥 가운데 기준)
    scene.add(tilt);
    const overlays = [];               // 밝히는 부품 위에 겹친 빛 (같은 모양, 더하기 혼합)
    const glowMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });

    // 그림자 받는 바닥 (페이지 바탕 위에 옅은 그림자만)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    const draco = new DRACOLoader().setDecoderPath("/draco/");
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const cams = [];   // 단계마다 { target, pos }
    const anchors = []; // 단계마다 이름표 자리 (본체 좌표 → 세계)
    let plinth, arm, armBase = 0, platter, cw, cwBase = 0;

    loader.loadAsync(MODEL_URL).then((gltf) => {
      if (!alive) return;
      plinth = gltf.scene.getObjectByName("Turntable_Plinth");
      if (!plinth) throw new Error("no turntable");
      plinth.removeFromParent();
      plinth.position.set(0, 0, 0); plinth.rotation.set(0, 0, 0); plinth.scale.set(1, 1, 1);
      tilt.add(plinth);
      look = applyTurntableLook({ root: tilt, envMap: env, key, renderer, casters: [] });
      parts = addTourParts(plinth, (m) => { m.envMap = env; m.envMapIntensity = 1.7; look.mats.push(m); });
      arm = plinth.getObjectByName("Turntable_Tonearm"); armBase = arm?.rotation.y ?? 0;
      platter = plinth.getObjectByName("Turntable_Platter");
      cw = plinth.getObjectByName("Tonearm_Counterweight"); cwBase = cw?.position.z ?? 0;
      // 먼지 덮개 닫힘 동작 (Home 과 같은 Blender 클립)
      mixer = new THREE.AnimationMixer(tilt);
      const close = gltf.animations.find((a) => a.name === "cover_close");
      if (close) {
        closeAct = mixer.clipAction(close); closeAct.setLoop(THREE.LoopOnce, 1); closeAct.clampWhenFinished = true; closeAct.play(); closeAct.paused = true;
        closeEnd = close.duration;
        const tk = close.tracks.find((t) => t.name.endsWith(".quaternion"));
        if (tk) { const n = tk.times.length, v = tk.values, e = (n - 1) * 4; for (let i = 0; i < n; i++) { const d = Math.abs(v[i * 4] * v[e] + v[i * 4 + 1] * v[e + 1] + v[i * 4 + 2] * v[e + 2] + v[i * 4 + 3] * v[e + 3]); if (d > 0.9999) { closeEnd = tk.times[i]; break; } } }
        closeAct.time = 0; mixer.update(0);
      }
      // 판 (Home Hero 와 같은 실제 같은 판): 플래터 매트 위
      const seat = plinth.getObjectByName("Turntable_DiscSeat");
      const seatTop = seat ? new THREE.Box3().setFromObject(seat).max.y : DECK + 0.03;
      const rec = makeRecord(renderer);
      rec.setLabel(drawLabel({ title: "Side A", artist_names: "Grooves" }, "#c9772f"));
      rec.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; for (const m of [o.material].flat()) { m.envMap = env; m.envMapIntensity = 0.42; } } });
      record = { group: rec.group, rec, seatTop };
      rec.group.position.set(PLATTER.x, seatTop + 0.00095, PLATTER.z);
      plinth.add(rec.group);
      // 밝힐 부품마다 겹침 빛
      const byName = new Map();
      plinth.traverse((o) => { if (o.name) byName.set(o.name, o); });
      steps.forEach((step, i) => {
        for (const name of step.focus ?? []) {
          const o = byName.get(name); if (!o) continue;
          // 먼저 모아 두고 붙임 (traverse 도중에 자식을 붙이면 새 자식까지 다시 돌며 끝없이 붙었음)
          const meshes = [];
          o.traverse((m) => { if (m.isMesh && !m.userData.isGlow) meshes.push(m); });
          for (const m of meshes) {
            if (!m.userData.glow) {
              const g = new THREE.Mesh(m.geometry, glowMat.clone());
              g.userData.isGlow = true; g.renderOrder = 2;
              m.add(g); m.userData.glow = g;
              overlays.push({ mesh: g, steps: new Set() });
            }
            overlays.find((x) => x.mesh === m.userData.glow).steps.add(i);
          }
        }
      });
      // 단계마다 카메라 · 이름표 자리 (쉬는 자세 기준)
      tilt.updateMatrixWorld(true);
      steps.forEach((step) => {
        const box = new THREE.Box3();
        for (const name of step.focus ?? []) { const o = byName.get(name); if (o) box.expandByObject(o); }
        const target = step.at ? new THREE.Vector3(...step.at) : box.isEmpty() ? new THREE.Vector3(0, 0.09, 0) : box.getCenter(new THREE.Vector3());
        const { az, el, dist } = step.cam;
        const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
        const pos = target.clone().add(new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).multiplyScalar(dist));
        cams.push({ target, pos });
        anchors.push(step.label ? (step.labelAt ? new THREE.Vector3(...step.labelAt) : box.isEmpty() ? target.clone() : new THREE.Vector3(target.x, box.max.y + 0.004, target.z)) : null);
      });
      const bottom = new THREE.Box3().setFromObject(plinth).min.y;
      ground.position.y = bottom;
      setReady(true);
    }).catch((err) => { console.error("[TurntableTour]", err); if (alive) setFailed(true); });

    const fit = () => {
      const r = host.getBoundingClientRect();
      const w = Math.max(1, r.width), h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // 넓은 화면: 글 카드가 왼쪽에 있으므로 턴테이블을 오른쪽으로 비켜 그림
      //  세로 화면(휴대폰): 글 카드가 아래에 있으므로 위로 올려 그림
      if (w >= 1024) camera.setViewOffset(w, h, -w * 0.2, 0, w, h); else if (h > w) camera.setViewOffset(w, h, 0, h * 0.16, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(host);
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { root: scrollerOf(host), threshold: 0 });
    io.observe(host);
    const ptr = new THREE.Vector2(), ptrS = new THREE.Vector2();
    const onMove = (e) => { if (e.pointerType === "mouse") ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); };
    addEventListener("pointermove", onMove, { passive: true });

    const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3(), seatW = new THREE.Vector3();
    let spin = 0, omega = 0, lift = 0, last = performance.now(), time = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
      if (!visible || !cams.length) return;
      const s = st.s;
      // 카메라: 두 단계 사이를 부드럽게 (단계 가운데에서는 멈춰 있음)
      const i0 = Math.min(N - 1, Math.floor(s)), i1 = Math.min(N - 1, i0 + 1), f = smooth(range(s - i0, 0.35, 0.95));
      _t.lerpVectors(cams[i0].target, cams[i1].target, f);
      _p.lerpVectors(cams[i0].pos, cams[i1].pos, f);
      ptrS.lerp(ptr, 1 - Math.exp(-dt * 4));
      _v.subVectors(_p, _t).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -ptrS.x * 0.08);   // 마우스를 따라 살짝 둘러봄
      if (camera.aspect < 1) _v.multiplyScalar(1 + (1 - camera.aspect) * 0.9);         // 세로 화면은 폭이 좁아서 조금 물러남
      camera.position.copy(_t).add(_v).add(new THREE.Vector3(0, ptrS.y * 0.02, 0));
      camera.lookAt(_t);

      // ── 움직임 (단계 번호는 Story 의 STEPS 순서와 같음)
      // 1 수평: 기울었다가 바로 섬
      tilt.rotation.z = 0.045 * sr(s, 0.45, 0.8) * (1 - sr(s, 0.95, 1.3));
      // 2~: 플래터가 돎 (3 에서 45 로 바뀌었다가 돌아옴)
      const rpm45 = sr(s, 2.95, 3.15) * (1 - sr(s, 3.5, 3.7));
      const want = s > 1.6 && !reduced ? RPM(100 / 3 + (45 - 100 / 3) * rpm45) : 0;
      omega += (want - omega) * (1 - Math.exp(-dt * 2));
      spin += omega * dt;
      if (platter) platter.rotation.y = spin;
      if (record) {
        // 판: 8 단계 앞에서 위에서 내려와 앉음 · 같이 돎
        const k = sr(s, 7.3, 7.7);
        record.group.visible = k > 0.001;
        record.group.position.y = record.seatTop + 0.00095 + (1 - k) * 0.08;
        record.group.rotation.y = spin;
      }
      // 6 카운터웨이트: 추가 앞으로 돌며 침압이 0 → 2.0g
      const g = sr(s, 5.55, 5.95);
      if (cw) cw.position.z = cwBase + 0.004 * g;
      // 7 안티스케이팅 다이얼: 0 → 2
      const as = sr(s, 6.55, 6.95);
      if (parts) parts.dial.rotation.y = -as * (Math.PI * 1.5) * (2 / 3);
      // 8 큐: 톤암이 판 위로 → 레버를 내리면 천천히 내려앉음 → 다시 들고 돌아옴 / 10: 판 위로 와서 들린 채 기다림 → 버튼으로 내림
      const in8 = sr(s, 7.55, 7.95) * (1 - sr(s, 8.55, 8.95)), in10 = sr(s, 9.55, 9.95);
      const lift8 = Math.max(1 - sr(s, 8.05, 8.4), sr(s, 8.45, 8.6));
      if (st.dropped && s > 9.5) st.dropT = Math.min(1, st.dropT + dt / 1.2); else if (s <= 9.5) { st.dropT = 0; if (st.dropped) { st.dropped = false; setDropped(false); } }
      const liftWant = in10 > 0.01 ? 1 - smooth(st.dropT) : in8 > 0.01 ? lift8 : 0;
      lift += (liftWant - lift) * (1 - Math.exp(-dt * 6));
      if (st.dropped && st.dropT >= 1 && !st.landed) { st.landed = true; sound.needleDown(); }
      if (!st.dropped) st.landed = false;
      if (arm) { arm.rotation.y = armBase + ARM_SWING * Math.max(in8, in10); arm.rotation.x = ARM_LIFT * lift; }
      if (parts) parts.handle.rotation.x = -0.5 * lift;
      // 9 덮개: 닫혔다가 10 에서 다시 열림
      if (closeAct) { const c = sr(s, 8.6, 9.0) * (1 - sr(s, 9.35, 9.75)); closeAct.time = c * closeEnd; mixer.update(0); }

      // 밝히기: 지금 단계(가까운 쪽) 부품이 숨 쉬듯
      const near = Math.round(s), focusK = 1 - Math.min(1, Math.abs(s - near) * 3);
      const pulse = 0.22 + Math.sin(time * 3) * 0.08;
      for (const o of overlays) o.mesh.material.opacity = o.steps.has(near) ? pulse * focusK : 0;

      // 이름표: 지금 단계의 부품 위치를 화면 좌표로
      const lab = labelRef.current, anc = anchors[near];
      if (lab) {
        if (anc && focusK > 0.2) {
          const v = anc.clone().applyMatrix4(tilt.matrixWorld).project(camera);
          const r = host.getBoundingClientRect();
          lab.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px)`;
          lab.style.opacity = String(focusK);
          const extra = near === 6 ? ` · ${(2 * g).toFixed(1)}g` : near === 7 ? ` · ${(2 * as).toFixed(1)}` : near === 3 ? ` · ${rpm45 > 0.5 ? "45" : "33⅓"} RPM` : "";
          const text = steps[near].label + extra;
          if (lab.dataset.text !== text) { lab.dataset.text = text; lab.firstChild.textContent = text; }
        } else lab.style.opacity = "0";
      }

      if (look && plinth) { seatW.set(PLATTER.x, DECK, PLATTER.z).applyMatrix4(tilt.matrixWorld); look.update(seatW, 0, ptrS); }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      removeEventListener("pointermove", onMove);
      look?.dispose(); parts?.dispose();
      for (const o of overlays) { o.mesh.material.dispose(); o.mesh.removeFromParent(); }
      glowMat.dispose();
      scene.traverse((o) => { if (o.isMesh) { o.geometry?.dispose?.(); for (const m of [o.material].flat()) { m?.map?.dispose?.(); m?.dispose?.(); } } });
      env.dispose(); draco.dispose(); sound.dispose(); renderer.dispose(); canvas.remove();
    };
  }, [st, steps, N]);

  const drop = () => {
    st.sound?.setEnabled(true);
    st.dropped = true; st.dropT = 0; setDropped(true);
  };

  return (
    <div ref={wrapRef} className="relative" style={{ "--tour": 0 }}>
      {/* 화면에 붙어 있는 턴테이블 */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <div ref={hostRef} className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} />
        {!ready && !failed && <p className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-[0.3em] text-(--ink)/45">Setting up the turntable…</p>}
        <div ref={labelRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 opacity-0 transition-opacity duration-200">
          <span className="block -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-full bg-(--ink) px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-(--cream) shadow-md" />
        </div>
      </div>
      {/* 글 카드 (화면 하나에 한 단계). 카드가 화면 가운데를 지날 때 그 단계 */}
      <ol className="relative -mt-[100svh]">
        {steps.map((step, i) => (
          <li key={i} className="flex min-h-[100svh] items-end px-[clamp(16px,4vw,72px)] pb-[12svh] lg:items-center lg:pb-0">
            <div className="w-full max-w-[440px] rounded-[6px] border-[3px] border-(--ink) bg-(--cream)/92 p-[clamp(1.1rem,2.4vw,1.75rem)] backdrop-blur-sm">
              {renderCard(step, i)}
              {i === N - 1 && !failed && (
                <button type="button" onClick={drop} disabled={!ready || dropped}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-(--ink) px-6 text-[12px] font-semibold uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent) disabled:opacity-60">
                  {dropped ? "Playing · 소리 켜짐" : dropLabel} <span aria-hidden="true">{dropped ? "♪" : "↓"}</span>
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
