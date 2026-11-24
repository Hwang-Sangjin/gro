"use client";
// 스토리 히어로용 LP 한 장 (3D): Home Hero 의 재킷 · 판 부품(sleeveParts.js)을 그대로 써서 재킷 한 장만 세움
//  - 마우스를 따라 재킷이 기울고 · 살짝 따라 움직이고 · 빛이 흐름 (Home 과 같은 값 S.pose). 마우스는 화면 어디에 있든 재킷 가운데 기준으로 봄
//  - 비닐 포장: Home · Crate 와 같은 주름 지도를 코팅 층에 끼우고 wrap.fade 초 동안 서서히 깊어지게
//  - 누르면 판이 재킷 입구(오른쪽)로 빠져나오며 돌기 시작 · 다시 누르면 들어감 (Home 의 열기와 같은 스프링 S.open)
//  - 줄 넘기기 · 턴테이블 착지는 없음 (방이 없는 페이지)
//  - WebGL 을 못 쓰거나 모션 줄이기면 fallback(평면 커버)을 그대로 보여 줌
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { scrollerOf } from "./scroll";
import { WRAP, wrapNormalData } from "@/components/albums/sleeveFx";
import { S, makeEnvironment, makePaperMaps, makeJacket, makeRecord, drawFront, drawBack, drawLabel } from "@/components/roomtest/sleeveParts";

const V = {
  pull: 0.5,        // 열렸을 때 판이 재킷 밖으로 나온 정도 (재킷 폭 대비)
  spin: 0.55,       // 열린 판이 도는 빠르기 (바퀴/초 — 33⅓ 보다 느리게, 보기 좋게)
  fitW: 0.86,       // 열린 모양(재킷 + 나온 판)이 화면 폭에서 차지하는 비율
  env: 1.0, discEnv: 0.42,
  shift: 0.022,     // 마우스를 따라 재킷이 옮겨 가는 거리 (m, 화면 끝까지 갔을 때)
  reach: 0.6,       // 마우스가 재킷 가운데에서 화면 크기의 이만큼 떨어지면 끝까지 기욺
  wrapAfter: 900,   // 비닐 주름을 만들기 시작하기까지(ms) — 첫 장면을 먼저 그림
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const loadImage = (src) => new Promise((done) => { if (!src) return done(null); const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => done(im); im.onerror = () => done(null); im.src = src; });

export default function SleeveHero3D({ album, image, color = "#181818", fallback, className = "" }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const [ok, setOk] = useState(false);       // 3D 가 첫 장면을 그렸으면 true → fallback 을 숨김
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = S.light.exposure;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.className = "absolute inset-0 size-full";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(S.camera.fov, 1, 0.01, 10);
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7f72, S.light.hemi));
    const key = new THREE.DirectionalLight(0xfff3e0, S.light.key);
    key.position.set(0.6, 1.2, 1.4);
    scene.add(key);

    const envMap = makeEnvironment(renderer);
    const paper = makePaperMaps();
    const jacket = makeJacket(renderer, paper);
    const record = makeRecord(renderer);
    const mats = [jacket.mesh.material].flat();
    for (const m of mats) { m.envMap = envMap; m.envMapIntensity = V.env; m.needsUpdate = true; }
    record.group.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) { m.envMap = envMap; m.envMapIntensity = V.discEnv; m.needsUpdate = true; } });

    // rig(기울기) 안에 재킷과 판. 판은 재킷 면에 세워 두고(x 축 90°) 입구 쪽(+x)으로 pull 만큼 나옴
    const rig = new THREE.Group(), holder = new THREE.Group(), discArm = new THREE.Group();
    holder.add(jacket.mesh);
    discArm.add(record.group);
    holder.add(discArm);
    rig.add(holder);
    scene.add(rig);

    const s = { pointer: new THREE.Vector2(), tilt: new THREE.Vector2(), open: 0, openV: 0, want: 0, spin: 0, w: 1, h: 1, visible: true, drawn: false, t: 0 };
    const _er = new THREE.Euler();

    const fit = () => {
      const r = host.getBoundingClientRect();
      s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
      renderer.setSize(s.w, s.h, false);
      camera.aspect = s.w / s.h;
      // 열린 모양(재킷 폭 × (1 + pull))이 화면 폭의 fitW 안에 들도록 거리를 정함
      const vfov = THREE.MathUtils.degToRad(S.camera.fov);
      const needW = (S.jacket.size * (1 + V.pull)) / V.fitW;
      const needH = S.jacket.size / 0.82;
      const dist = Math.max(needH / (2 * Math.tan(vfov / 2)), needW / (2 * Math.tan(vfov / 2) * camera.aspect));
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    // 페이지는 자기 스크롤 상자(.page) 안에서 움직임 → 그 상자를 기준으로 봄 (Reveal 과 같은 방식)
    const io = new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; }, { root: scrollerOf(host), threshold: 0 });
    io.observe(host);

    // 커버 그림 · 라벨
    let alive = true;
    loadImage(image).then((img) => {
      if (!alive) return;
      jacket.setArt(drawFront(img, color), drawBack(album, color), color);
      record.setLabel(drawLabel(album, color));
    });

    // 비닐 주름: 앨범 이름으로 주름 지도 한 장과 뒤집는 방향을 고름 (Home hero 와 같은 방식)
    const wrap = { tex: null, timer: 0, raf: 0 };
    wrap.timer = setTimeout(() => {
      if (!alive) return;
      let n = 2166136261; const key = `${album?.title}|${album?.artist_names}`;
      for (let i = 0; i < key.length; i++) n = Math.imul(n ^ key.charCodeAt(i), 16777619);
      n >>>= 0;
      const fx = (n >> 3) & 1 ? -1 : 1, fy = (n >> 4) & 1 ? -1 : 1;
      const t = new THREE.DataTexture(wrapNormalData(n % WRAP.maps), WRAP.size, WRAP.size, THREE.RGBAFormat);
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(fx, fy); t.offset.set(fx < 0 ? 1 : 0, fy < 0 ? 1 : 0);
      t.needsUpdate = true;
      wrap.tex = t;
      const t0 = performance.now();
      const step = () => {
        if (!alive) return;
        const x = Math.min(1, (performance.now() - t0) / (S.wrap.fade * 1000));
        jacket.setWrap(t, fx, fy, x * x * (3 - 2 * x));
        if (x < 1) wrap.raf = requestAnimationFrame(step);
      };
      step();
    }, V.wrapAfter);

    // 마우스: 화면 어디에 있든 재킷 가운데에서 얼마나 떨어졌는지로 기울기를 정함 (Home hero 처럼 화면 전체가 무대)
    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const k = (v) => Math.max(-1, Math.min(1, v));
      s.pointer.set(k((e.clientX - cx) / (innerWidth * V.reach)), k(-(e.clientY - cy) / (innerHeight * V.reach)));
    };
    const onLeave = () => s.pointer.set(0, 0);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    apiRef.current = { setOpen: (v) => { s.want = v ? 1 : 0; } };

    let raf = 0, last = performance.now();
    const O = S.open;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!s.visible && s.drawn) return;
      s.t += dt;
      // 마우스가 없으면(터치) 아주 천천히 저절로 흔들림
      const idle = s.pointer.lengthSq() === 0 ? 1 : 0;
      const target = idle ? _idle.set(Math.sin(s.t * 0.55) * 0.35, Math.sin(s.t * 0.37 + 1.1) * 0.2) : s.pointer;
      s.tilt.lerp(target, 1 - Math.exp(-dt * S.pose.follow));
      // 열기 스프링 (살짝 넘쳤다 돌아옴)
      s.openV += ((s.want - s.open) * O.stiff - s.openV * O.damp) * dt;
      s.open += s.openV * dt;
      const pk = clamp01(s.open), pull = V.pull * pk * pk * (3 - 2 * pk);
      // 열리면 덜 기울고, 모양이 가운데 오도록 재킷을 왼쪽으로
      const hoverK = 1 - (1 - O.hover) * pk;
      rig.rotation.set(S.pose.rotX * 0.4 - s.tilt.y * S.pose.hover * hoverK, S.pose.rotY * 0.5 + s.tilt.x * S.pose.hover * hoverK, 0);
      holder.position.set(-pull * S.jacket.size * 0.5 + s.tilt.x * V.shift, s.tilt.y * V.shift, 0);
      s.spin += dt * V.spin * Math.PI * 2 * clamp01((s.open - 0.4) / 0.6);
      discArm.position.set(pull * S.jacket.size, 0, 0);
      discArm.rotation.set(Math.PI / 2, s.spin, 0);
      // 기울면 빛이 흐름 (재질에 비친 환경을 돌림)
      _er.set(s.tilt.y * O.envTurn * 0.5, s.tilt.x * O.envTurn, 0);
      for (const m of mats) m.envMapRotation?.copy(_er);
      record.vinyl.envMapRotation?.copy(_er);
      renderer.render(scene, camera);
      if (!s.drawn) { s.drawn = true; setOk(true); }
    };
    const _idle = new THREE.Vector2();
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      clearTimeout(wrap.timer); cancelAnimationFrame(wrap.raf); wrap.tex?.dispose();
      apiRef.current = null;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry?.dispose();
        for (const m of [o.material].flat()) { for (const k of ["map", "roughnessMap", "bumpMap"]) m[k]?.dispose?.(); m.dispose(); }
      });
      envMap.dispose();
      for (const t of Object.values(paper)) t.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [album, image, color]);

  const toggle = () => { const v = !open; setOpen(v); apiRef.current?.setOpen(v); };

  return (
    <div className={`relative ${className}`}>
      {/* 3D 가 뜨기 전 · 못 뜨면 평면 커버 */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${ok ? "pointer-events-none opacity-0" : "opacity-100"}`}>{fallback}</div>
      <div ref={hostRef} className={`absolute inset-0 transition-opacity duration-700 ${ok ? "opacity-100" : "opacity-0"}`} />
      {ok && (
        <button type="button" onClick={toggle} aria-pressed={open}
          aria-label={open ? "판을 재킷에 다시 넣기" : "재킷에서 판 꺼내기"}
          className="absolute inset-0 z-10 cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--accent)" />
      )}
      {ok && (
        <p aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-8 text-center text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/50">
          {open ? "Put it back" : "Pull the record"}
        </p>
      )}
    </div>
  );
}
