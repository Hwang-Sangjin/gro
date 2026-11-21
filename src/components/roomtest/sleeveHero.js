// Home Hero (heroMode="sleeve"): 방 장면과 같은 캔버스에서 도는 LP 재킷 줄 (새 Hero 5단계)
//  실험 페이지에서 맞춘 (부품 · 조정 값은 sleeveParts.js) 재킷 · 판 · 줄 넘기기 · 등장 · 열기를 방 장면으로 옮긴 것. 조정 값(S)과 재질은 그 파일 것을 그대로 씀
//  이 모듈이 하는 일
//   - 재킷 줄을 P=0 카메라 앞에 세움 (줄 틀 = 그때의 카메라 자리 · 방향 기준)
//   - 판은 방 장면의 판(st.disc) 한 장: 재킷 안 → 열면 빠져나온 자리를 매 프레임 st.heroPos · st.heroQuat 로 넘김
//     → 그 뒤(턴테이블로 내려가 앉기 · 방이 지어짐)는 RoomTest 의 한 장면 흐름이 그대로 이어 감 = 판이 갈아 끼워지지 않음
//   - 스크롤을 내리기 시작하면 저절로 열리고(판이 나옴), 더 내리면 재킷들은 물러나며 사라짐. 열린 판을 누르면 착지 자리까지 스크롤을 대신 내려 줌
//  방 재질에 영향을 주지 않게: 장면 전체 환경(scene.environment) · 안개(scene.fog) 대신 재킷 · 판 재질에만 환경을 달고, 멀어지는 재킷은 투명도로 옅어짐
import * as THREE from "three";
import { S, makeEnvironment, makePaperMaps, makeJacket, makeRecord, drawFront, drawBack, drawLabel } from "./sleeveParts";

export const SLEEVE_HERO = {
  heroP: 0.006,              // 이 진행도 아래 = Hero (끌기 · 누르기는 여기서만). 넘으면 스크롤이 연 것으로 봄
  leave: [0.025, 0.12],       // 재킷들이 물러나며 사라지는 진행도 구간 (판이 가운데로 오기 전에 먼저 뒤로 빠짐)
  // (2026-11-17 사용자 요청) 재킷은 뒤로 물러나는 대신 왼쪽으로 빠져나감: 판은 가운데로 오고 재킷은 왼쪽으로 → 판을 재킷에서 꺼내 드는 모양
  leaveLeft: 1.5, leaveTurn: 0.5, leaveBack: 0.15, leaveDrop: 0,   // 왼쪽으로 가는 거리(m) · 가면서 도는 각(rad) · 살짝 뒤로 · 아래로
  // 착지 뒤 순서 (2026-11-17 사용자 요청): 판이 아주 천천히 앉고 → 톤암이 천천히 올라가고 → 덮개가 닫힌 다음 → 방은 빠르게 지어짐
  //  판이 앉은 뒤부터는 스크롤이 아니라 시간으로 흐름 (되돌리면 같은 순서를 거꾸로)
  landFollow: 3.6,           // 착지 구간에서 판이 스크롤 자리를 따라붙는 빠르기 (작을수록 천천히 내려앉음. 그 밖 구간은 8)
  landNear: 0.006,           // 착지까지 이만큼 남았으면 앉은 것으로 보고 톤암을 시작 (클수록 톤암이 일찍 움직임)
  // 내려앉는 구간 [시작, 길이]: center 가 끝나기(0.21) 전에 시작 (예전엔 0.15 에 가운데에서 멈췄다가 0.24 부터 내려갔음 — 사용자: 멈추지 말고 그대로 안착)
  land: [0.12, 0.22],
  landAuto: 0.13, landAutoSec: 3.0,     // 이 진행도를 지나 내려가면 착지 자리까지 스크롤을 대신 내려 줌 (걸리는 시간 · 초)
  landFrom: 0.12,             // 이 진행도부터 '착지 구간'
  needle: 2.4,               // 톤암이 판 위로 올라가는 시간(초)
  lidGap: 0.3,               // 톤암이 다 올라간 뒤 덮개가 닫히기 시작할 때까지(초)
  buildSpeed: 1.2,           // 방이 지어지는 빠르기 (Blender 클립 시간의 몇 배속 — 순서 · 간격의 비율은 그대로)   // 사라지며 물러나는 거리 · 내려가는 거리 (m)
  fade: [1.6, 3.2],          // 가운데에서 이만큼(장) 떨어진 재킷부터 옅어져 → 안 보임
  //  land: 열린 뒤 판이 턴테이블까지 내려가는 구간에서 휠 한 칸에 곱하는 값 (작을수록 천천히 · 많이 굴려야 함)
  swipeOpen: 48,             // 터치: 위로 이만큼(px) 밀면 가운데 재킷을 엶
  wheel: { step: 36, cooldown: 300, idle: 160, land: 0.3 },   // 휠로 넘기기: 한 장 넘기는 양(px) · 넘긴 뒤 쉬는 시간(ms) · 입력이 끊겼다고 보는 간격(ms)
  // 판이 턴테이블로 가는 길 (2026-11-16 사용자 요청): 재킷 옆에서 곧장 비스듬히 가지 않고, 먼저 화면 가운데(턴테이블 바로 위)로 온 뒤 위에서 아래로 내려앉음
  center: [0.03, 0.18],      // 판이 화면 가운데로 오는 진행도 [시작, 길이]
  landMs: 4800,              // 열린 판을 눌렀을 때 착지 자리까지 스크롤을 대신 내려 주는 시간 (예전 2.6초는 너무 빨랐음)
  pullOut: [0.008, 0.04], pullFull: 0.9,   // 스크롤 진행도 이 구간에서 판이 재킷 밖으로 다 나옴 (재킷 폭의 pullFull 배)
  flat: [0.06, 0.08],        // 판이 수평으로 눕기 시작하는 진행도 [시작, 길이] (재킷이 물러난 뒤)
  // "Grooves" 제목: 재킷이 다가온 뒤(delay 초) 글자가 하나씩 올라옴 · 스크롤을 내리면 위로 걷히며 옅어짐(out 진행도 구간, lift = 화면 높이 대비)
  title: { delay: 0.55, stagger: 0.06, dur: 0.9, out: [0.004, 0.04], lift: 0.12 },
  // 커스텀 커서 (마우스 · Hero 에서만): 링이 따라오는 지연(초) · 상태별 크기
  cursor: { ringLag: 0.12, scale: { idle: 0.32, open: 1, go: 0.78, drag: 0.7, play: 1, close: 0.78, link: 0.55 } },
  spinUp: [0.04, 0.09],      // 판이 돌기 시작하는 진행도 구간 (재킷 안 · 막 나온 동안은 돌지 않음)
  env: 1.0, discEnv: 0.42,    // 재킷 · 판에 비치는 환경 세기 (판은 낮춤: 누울 때 판 전체가 은색으로 번쩍이지 않게)
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 방 장면의 판으로 쓰는 실제 같은 판 (st.disc 와 같은 모양: root 는 아랫면 기준) */
export function makeSleeveDisc(renderer) {
  const record = makeRecord(renderer);
  const holder = new THREE.Group();
  holder.position.y = S.disc.thick / 2;     // 판 아랫면이 플래터에 닿게
  holder.add(record.group);
  const root = new THREE.Group();
  root.add(holder);
  let ref = null;
  const offsetMats = new Set();
  record.group.traverse((o) => {
    if (!o.isMesh) return;
    ref ??= o; o.castShadow = o.receiveShadow = false;
    o.receiveShadow = true;     // 재킷이 판에 드리우는 그림자 (Hero)
    for (const m of [o.material].flat()) offsetMats.add(m);
  });
  // 방 전체 구도(카메라 약 15m)에서는 판과 매트 사이 0.4mm 가 깊이 값으로 구분되지 않음 → 깊이를 카메라 쪽으로 살짝 당김
  //  단 턴테이블 근처에서만: Hero 에서 당기면 재킷 안의 판 테두리가 재킷 앞면을 뚫고 가는 선으로 보였음 (재킷을 기울일수록 심함)
  const setNearMat = (on) => { for (const m of offsetMats) { m.polygonOffset = on; m.polygonOffsetFactor = on ? -2 : 0; m.polygonOffsetUnits = on ? -8 : 0; } };
  setNearMat(false);
  return { root, uniforms: null, inkMat: null, baseMat: null, ref, record, setNearMat };
}

/**
 * @param {{ st: any, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, disc: ReturnType<typeof makeSleeveDisc>,
 *   stage: HTMLElement, reduced: boolean, camAtHero: () => void,
 *   onIndex?: (i: number) => void, onOpen?: (open: boolean) => void, onRecord?: (i: number) => void, onPlay?: (i: number) => void }} o
 *  title: "Grooves" 제목 h1 (글자마다 span) · cursor: 커스텀 커서 DOM { ring, dot, shape, label, tick } (없으면 안 씀)
 *  onPlay: 판이 Hero 를 떠날 때(스크롤 · 판 누르기) 그 판의 앨범 번호 → 방 선반의 "지금 듣는 판" 재킷에 씀
 *  camAtHero: 카메라를 P=0 자세로 놓는 함수 (줄 틀을 잡을 때만 부름)
 */
export function createSleeveHero({ st, renderer, scene, camera, disc, stage, reduced, camAtHero, onIndex, onOpen, onRecord, onPlay, title = null, cursor = null }) {
  const envMap = makeEnvironment(renderer);
  const paper = makePaperMaps();
  const withEnv = (m) => { m.envMap = envMap; m.envMapIntensity = SLEEVE_HERO.env; m.needsUpdate = true; };
  disc.record.group.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) { withEnv(m); m.envMapIntensity = SLEEVE_HERO.discEnv; } });

  // 줄 틀(frame): P=0 카메라 앞 · 카메라 방향 그대로 → 그 안의 줄(rig)은 lab 과 같은 좌표 (화면 가운데가 0,0)
  const frame = new THREE.Group(), rig = new THREE.Group();
  frame.name = "sleeveHero";
  frame.add(rig);
  scene.add(frame);
  /** @type {{ album: any, color: string, holder: THREE.Group, jacket: ReturnType<typeof makeJacket>, mats: THREE.Material[] }[]} */
  let items = [];

  const s = {
    pointer: new THREE.Vector2(), tilt: new THREE.Vector2(),
    pos: 0, vel: 0, target: 0, index: -1,
    pull: 0, wantOpen: false, clickOpen: false, recAt: -1, open: 0, openV: 0, playing: -1,
    introT: reduced ? 99 : -1, dist: 1, dirty: true, p: 0, leave: 0,
  };
  const drag = { id: null, active: false, moved: false, locked: false, x0: 0, pos0: 0, lastX: 0, lastT: 0, v: 0 };
  const cur = { mouse: new THREE.Vector2(-100, -100), ring: new THREE.Vector2(-100, -100), visible: false, overLink: false, state: "", on: null };
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const h = { frame, s, dirty: true, envMap };     // envMap: 턴테이블 재질도 같은 환경을 씀 (turntableLook.js)

  // 줄 틀 자리: 가운데 재킷이 화면 높이의 fitH · 폭의 fitW 를 넘지 않는 거리
  const place = () => {
    camAtHero();
    camera.updateMatrixWorld();
    const t = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    s.narrow = camera.aspect <= S.row.narrow;     // 세로로 든 휴대폰: 재킷을 폭에 더 크게 · 간격은 좁게 (양옆이 화면에 걸쳐 보임)
    s.dist = Math.max(S.jacket.size / S.camera.fitH, S.jacket.size / (s.narrow ? S.camera.fitWNarrow : S.camera.fitW) / camera.aspect) / t;
    s.fov = camera.fov; s.aspect = camera.aspect;
    frame.quaternion.copy(camera.quaternion);
    frame.position.copy(camera.position).addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), s.dist);
    frame.updateMatrixWorld(true);
    h.dirty = false;
  };

  // ── 종이 결 바탕: 사이트 바탕의 종이 결(paper-grain)을 장면 맨 뒤에 그림 → 재킷 · 판은 그 앞에 (결이 앨범 커버 위에 덮이지 않음)
  //  예전: 캔버스 위에 DOM 층으로 soft-light 를 덮어서 재킷 위에도 종이 결이 보였음. 섞는 식 · 세기 · 무늬 크기는 CSS(.paper-textured)와 같게
  const css = getComputedStyle(document.documentElement);
  const grainUrl = (css.getPropertyValue("--paper-texture-image").match(/url\(["']?(.*?)["']?\)/) ?? [])[1];
  const grainSize = parseFloat(css.getPropertyValue("--paper-texture-size")) || 640;
  const grainOpacity = parseFloat(css.getPropertyValue("--paper-texture-opacity")) || 0.8;
  const paperU = { tGrain: { value: null }, uBg: { value: new THREE.Vector3(1, 1, 1) }, uK: { value: 0 }, uScale: { value: new THREE.Vector2(1, 1) } };
  const paperMat = new THREE.ShaderMaterial({
    uniforms: paperU, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: "void main(){ gl_Position = vec4(position.xy, 1.0, 1.0); }",
    fragmentShader: `uniform sampler2D tGrain; uniform vec3 uBg; uniform float uK; uniform vec2 uScale;
      vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
      void main(){
        vec3 g = texture2D(tGrain, gl_FragCoord.xy * uScale).rgb;
        // soft-light (W3C 식): 바탕색 b 위에 결 g
        vec3 b = uBg;
        vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
        vec3 sl = mix(b - (1.0 - 2.0 * g) * b * (1.0 - b), b + (2.0 * g - 1.0) * (d - b), step(0.5, g));
        gl_FragColor = vec4(toLinear(mix(b, sl, uK)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const paperQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paperMat);
  paperQuad.frustumCulled = false; paperQuad.renderOrder = -1000; paperQuad.visible = false; paperQuad.name = "sleevePaper";
  scene.add(paperQuad);
  if (grainUrl) new THREE.TextureLoader().load(grainUrl, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; paperU.tGrain.value = t; });
  const _bg = { r: 0, g: 0, b: 0 }, _size = new THREE.Vector2();
  /** 매 프레임: bg = 지금 장면 바탕색 · k = 종이 결 세기 0…1 (Hero 에서 1, 바탕이 어두워지면 0) */
  h.backdrop = (bg, k) => {
    paperQuad.visible = k > 0.003 && !!paperU.tGrain.value;
    if (!paperQuad.visible) return;
    bg.getRGB(_bg, THREE.SRGBColorSpace);
    paperU.uBg.value.set(_bg.r, _bg.g, _bg.b);
    paperU.uK.value = k * grainOpacity;
    const pr = renderer.getPixelRatio();
    renderer.getDrawingBufferSize(_size);
    paperU.uScale.value.set(1 / (grainSize * pr), 1 / (grainSize * pr));
  };
  const hero = () => s.p < SLEEVE_HERO.heroP;
  const introBusy = () => s.introT < S.intro.dur * 0.75;
  const setIndex = (i) => { if (i !== s.index) { s.index = i; onIndex?.(i); } };
  const isOpen = () => s.clickOpen || !hero();
  let openSaid = false;
  const sayOpen = () => { const o = s.clickOpen; if (o !== openSaid) { openSaid = o; onOpen?.(o); } };
  // 판은 가운데에 자리 잡은 재킷에서만 나옴. 넘기는 도중에 누르면 기억해 뒀다가 자리 잡은 뒤에 엶
  const setOpen = (open) => {
    if (open && (s.recAt !== s.target || Math.abs(s.pos - s.target) > 0.06)) { s.wantOpen = true; return; }
    s.wantOpen = false; s.clickOpen = !!open && items.length > 0; sayOpen();
  };
  const go = (i) => {
    if (!items.length) return;
    const t = Math.min(items.length - 1, Math.max(0, Math.round(i)));
    if (t !== s.target) s.wantOpen = false;
    s.target = t;
    if (s.target !== s.recAt) setOpen(false);
  };

  // ── 입력 (Hero 에서만): 가로로 끌어 넘기기 · 옆 재킷을 누르면 그리로 · 가운데 재킷을 누르면 열고 닫음 · 열린 판을 누르면 턴테이블로
  const ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
  const ndcOf = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    return _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  };
  const pxPerItem = () => {
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(s.fov / 2)) * s.dist;
    return ((s.narrow ? S.row.gapNarrow : S.row.gap) / visH) * renderer.domElement.clientHeight * Math.cos(S.pose.rotY);
  };
  const isControl = (e) => e.target instanceof Element && !!e.target.closest("a, button, [role='button']");
  const onDown = (e) => {
    if (drag.id != null || e.button !== 0 || !items.length || introBusy() || !hero() || isControl(e)) return;
    Object.assign(drag, { id: e.pointerId, active: true, moved: false, locked: s.clickOpen || s.open > 0.05, x0: e.clientX, pos0: s.pos, lastX: e.clientX, lastT: performance.now(), v: 0 });
  };
  const onMove = (e) => {
    s.pointer.copy(ndcOf(e));
    if (e.pointerType === "mouse") { cur.mouse.set(e.clientX, e.clientY); if (!cur.visible) { cur.ring.copy(cur.mouse); cur.visible = true; } }
    cur.overLink = isControl(e);
    if (!drag.active || e.pointerId !== drag.id || drag.locked) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved) {
      if (Math.abs(dx) < S.browse.dragStart) return;
      drag.moved = true;
      stage.setPointerCapture?.(e.pointerId);
    }
    const per = pxPerItem(), now = performance.now(), dtm = Math.max(8, now - drag.lastT);
    let p = drag.pos0 - dx / per;
    const over = p < 0 ? p : p > items.length - 1 ? p - (items.length - 1) : 0;
    if (over) p -= over * 0.65;
    drag.v += (Math.max(-S.browse.maxVel, Math.min(S.browse.maxVel, (-(e.clientX - drag.lastX) / per) / (dtm / 1000))) - drag.v) * 0.32;
    drag.far = Math.max(drag.far ?? 0, Math.abs(dx));
    drag.lastX = e.clientX; drag.lastT = now;
    s.pos = p; s.vel = drag.v;
    s.target = Math.min(items.length - 1, Math.max(0, Math.round(p)));
  };
  const onUp = (e) => {
    if (e.pointerId !== drag.id) return;
    // 거의 안 움직였으면 누르기 (손이 조금 흔들린 것). 줄은 제자리로
    //  (예전: 5px 만 흔들려도 끌기가 되고 순간 속도가 던지는 속도가 돼서, 첫 앨범을 눌렀는데 옆 앨범으로 넘어갔음)
    const tapped = drag.moved && (drag.far ?? 0) < S.browse.tap;
    if (tapped) { s.target = Math.min(items.length - 1, Math.max(0, Math.round(drag.pos0))); s.vel = 0; }
    const moved = drag.moved && !tapped, still = performance.now() - drag.lastT > 90, locked = drag.locked;
    drag.far = 0;
    drag.id = null; drag.active = false;
    if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    if (e.pointerType !== "mouse") s.pointer.set(0, 0);     // 터치: 손을 떼면 기울기를 풂
    if (moved) { go(s.pos + (still ? 0 : drag.v * S.browse.flick)); return; }
    if (!hero()) return;
    ray.setFromCamera(ndcOf(e), camera);
    // 보이는 재킷만 대상으로 (Raycaster 는 visible 을 보지 않음). 예전: 멀어서 숨겨 둔 재킷은 자리를 갱신하지 않아 줄 한가운데(처음 자리)에 남아 있었고,
    //  가운데 재킷을 누르면 그 숨은 재킷이 먼저 맞아서 엉뚱한 앨범으로 넘어갔음
    const hit = ray.intersectObjects(items.filter((it) => it.holder.visible).map((it) => it.jacket.mesh).concat(disc.root.visible ? [disc.root] : []), true)[0];
    if (!hit) return;
    const i = items.findIndex((it) => it.jacket.mesh === hit.object);
    if (i < 0) { if (s.open > 0.9) onRecord?.(s.recAt); return; }     // 판 → 턴테이블로
    if (i !== Math.round(s.pos)) { if (!locked) go(i); }
    else setOpen(!s.clickOpen);
  };
  const onLeave = () => { s.pointer.set(0, 0); cur.visible = false; };
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  for (const t of ["pointerup", "pointercancel"]) stage.addEventListener(t, onUp);
  stage.addEventListener("pointerleave", onLeave);
  // 휠 (열지 않은 Hero 에서만): 페이지를 내리는 대신 앨범을 한 장씩 넘김. 열려 있으면 휠은 페이지 스크롤 (다음 섹션으로)
  //  트랙패드 관성으로 여러 장이 넘어가지 않게: 쌓인 양이 step 을 넘으면 한 장, 그 뒤 cooldown 동안은 쉼 · 입력이 idle 만큼 끊기면 쌓인 양을 비움
  const wheel = { acc: 0, last: 0, until: 0 };
  const onWheel = (e) => {
    if (!hero() || s.clickOpen || !items.length) return;
    e.preventDefault();
    if (introBusy()) return;
    const now = performance.now(), W = SLEEVE_HERO.wheel;
    if (now - wheel.last > W.idle) wheel.acc = 0;
    wheel.last = now;
    if (now < wheel.until) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    wheel.acc += d * (e.deltaMode === 1 ? 32 : 1);
    if (Math.abs(wheel.acc) < W.step) return;
    go(s.target + Math.sign(wheel.acc));
    wheel.acc = 0; wheel.until = now + W.cooldown;
  };
  stage.addEventListener("wheel", onWheel, { passive: false });
  const touchWas = stage.style.touchAction;
  stage.style.touchAction = "pan-y";     // 가로로 끌면 줄 넘기기(브라우저가 가로채지 않게), 세로는 페이지 스크롤
  // 터치 (열지 않은 Hero 에서만): 위로 밀면(= 아래로 스크롤하려는 손짓) 가운데 재킷을 엶
  //  열기 전에는 페이지 스크롤이 잠겨 있어서, 휴대폰에서 밀어도 아무 일도 안 일어났음 → 밀면 판이 나오고, 한 번 더 밀면 방으로 내려감
  //  (세로 밀기는 브라우저가 가져가 pointer 이벤트가 끊기므로 touch 이벤트로 봄)
  const swipe = { id: null, x: 0, y: 0 };
  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    if (e.touches.length !== 1 || !hero() || s.clickOpen || introBusy() || isControl(e)) { swipe.id = null; return; }
    swipe.id = t.identifier; swipe.x = t.clientX; swipe.y = t.clientY;
  };
  const onTouchMove = (e) => {
    if (swipe.id == null) return;
    const t = [...e.changedTouches].find((c) => c.identifier === swipe.id);
    if (!t) return;
    const dx = t.clientX - swipe.x, up = swipe.y - t.clientY;
    if (Math.abs(dx) > S.browse.dragStart && Math.abs(dx) > up) { swipe.id = null; return; }     // 가로 끌기 = 넘기기
    if (up > SLEEVE_HERO.swipeOpen && up > Math.abs(dx) * 1.5) { swipe.id = null; if (hero() && !s.clickOpen && items.length) setOpen(true); }
  };
  const onTouchEnd = () => { swipe.id = null; };
  stage.addEventListener("touchstart", onTouchStart, { passive: true });
  stage.addEventListener("touchmove", onTouchMove, { passive: true });
  for (const t of ["touchend", "touchcancel"]) stage.addEventListener(t, onTouchEnd, { passive: true });
  // 키보드 (Hero 에서만 · 글자 입력 중이 아닐 때): ← → 넘기기 · Enter 열고 닫기 · Esc 닫기
  const onKey = (e) => {
    if (!hero() || introBusy() || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t instanceof Element && t.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], button, a")) return;
    if (e.key === "ArrowRight") { if (!s.clickOpen) go(s.target + 1); }
    else if (e.key === "ArrowLeft") { if (!s.clickOpen) go(s.target - 1); }
    else if (e.key === "Enter") setOpen(!s.clickOpen);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  // 테마(크림 ↔ 브라운)가 바뀌면 Hero 바탕색을 다시 읽음 (방 장면의 바탕 = 이 색 → 밤색)
  const readTheme = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--cream").trim();
    if (!v) return;
    st.heroBg = new THREE.Color(v);
    st.themeCream = st.heroBg.clone();
  };
  // 제목 · 커서 색: 바탕과 반대 (크림 바탕 → 브라운 글자, 브라운 바탕 → 크림 글자)
  const look = { paper: "#f4e7cd", text: "#4c404a" };
  const paintTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    look.paper = dark ? "#4c404a" : "#f4e7cd"; look.text = dark ? "#f4e7cd" : "#4c404a";
    if (title) title.style.color = look.text;
    if (cursor) {
      cursor.label.style.color = look.text;
      const d = cursor.dot.firstElementChild;
      d.style.background = look.text; d.style.boxShadow = `0 0 0 1px ${look.paper}`;
      for (const el of cursor.tick.children) el.setAttribute("stroke", look.text);
      cur.state = "";
    }
  };
  const themeMo = new MutationObserver(() => { readTheme(); paintTheme(); });
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ── "Grooves" 제목: 글자가 하나씩 올라오고, 스크롤을 내리면 위로 걷히며 옅어짐
  const letters = [...(title?.children ?? [])];
  const updateTitle = (p) => {
    if (!title) return;
    const T = SLEEVE_HERO.title, t = s.introT < 0 ? -1 : s.introT - T.delay;
    letters.forEach((el, i) => {
      const rk = reduced ? (t >= 0 ? 1 : 0) : 1 - Math.pow(1 - clamp01((t - i * T.stagger) / T.dur), 3);
      el.style.translate = `0 ${((1 - rk) * 110).toFixed(2)}%`;
    });
    const out = smooth(p, T.out[0], T.out[1]);
    title.style.opacity = String(1 - out);
    title.style.visibility = out >= 1 ? "hidden" : "";
    title.style.translate = `0 calc(-50% - ${(out * T.lift * stage.clientHeight).toFixed(1)}px)`;
  };
  // ── 커스텀 커서: 점은 바로, 링은 살짝 늦게. 가리킨 것에 따라 글자가 바뀜
  //  가운데 재킷 "Open" · 옆 재킷 ← → · 끄는 중 ↔ · 열린 판 "Play" · 열린 재킷 "Close" · 버튼 위는 작은 링
  const LABEL = { open: "Open", drag: "↔", play: "Play", close: "Close" };
  const setCursor = (state, text) => {
    const c = cursor;
    if (!c || (state === cur.state && text === cur.text)) return;
    cur.state = state; cur.text = text;
    const C = SLEEVE_HERO.cursor, filled = state !== "idle" && state !== "link" && state !== "hidden";
    c.shape.style.transform = `scale(${C.scale[state] ?? C.scale.idle})`;
    c.shape.style.backgroundColor = filled ? `color-mix(in srgb, ${look.paper} 78%, transparent)` : "transparent";
    c.shape.style.backdropFilter = filled ? "blur(6px)" : "none";
    c.shape.style.borderColor = look.text;
    c.label.style.opacity = filled ? "1" : "0";
    c.tick.style.opacity = "0";
    c.dot.firstElementChild.style.opacity = state === "idle" ? "1" : "0";
    if (filled) c.label.textContent = text ?? "";
  };
  const hoverRay = new THREE.Raycaster();
  const updateCursor = (dt) => {
    const c = cursor;
    if (!finePointer || !c) return;
    const on = hero() && s.introT >= 0;
    // Hero 동안은 이 커서만 (사이트 공통 커서 SiteCursor 는 data-home-stage 안에서 숨음)
    if (on !== cur.on) { cur.on = on; stage.style.cursor = on ? "none" : ""; stage.toggleAttribute("data-home-stage", on); }
    let state = "hidden", text = null;
    if (on && cur.visible) {
      state = "idle";
      if (cur.overLink) state = "link";
      else if (drag.active && drag.moved) { state = "drag"; text = LABEL.drag; }
      else if (!introBusy()) {
        hoverRay.setFromCamera(s.pointer, camera);
        const hit = hoverRay.intersectObjects(items.filter((it) => it.holder.visible).map((it) => it.jacket.mesh).concat(disc.root.visible ? [disc.root] : []), true)[0];
        if (hit) {
          const i = items.findIndex((it) => it.jacket.mesh === hit.object), front = Math.round(s.pos);
          if (i < 0) { if (s.open > 0.9) { state = "play"; text = LABEL.play; } }
          else if (i !== front) { if (!s.clickOpen) { state = "go"; text = i < front ? "←" : "→"; } }
          else if (s.clickOpen) { state = "close"; text = LABEL.close; }
          else { state = "open"; text = LABEL.open; }
        }
      }
    }
    setCursor(state, text);
    const show = state !== "hidden";
    c.ring.style.opacity = show ? "1" : "0";
    c.dot.style.opacity = show ? "1" : "0";
    if (!show) return;
    cur.ring.lerp(cur.mouse, reduced ? 1 : 1 - Math.exp(-dt / SLEEVE_HERO.cursor.ringLag));
    c.dot.style.transform = `translate3d(${cur.mouse.x}px, ${cur.mouse.y}px, 0)`;
    c.ring.style.transform = `translate3d(${cur.ring.x.toFixed(2)}px, ${cur.ring.y.toFixed(2)}px, 0)`;
  };
  paintTheme();
  const attach = (i) => {
    const it = items[i]; if (!it) return;
    disc.record.setLabel(drawLabel(it.album, it.color));
    s.recAt = i;
  };

  // ── 매 프레임 (RoomTest apply 에서 판 자리를 정하기 전에): 줄을 움직이고, 판이 있을 자리를 st.heroPos · st.heroQuat 로 넘김
  const _m = new THREE.Matrix4(), _pos = new THREE.Vector3(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3(), _up = new THREE.Vector3();
  const _local = new THREE.Matrix4(), _eul = new THREE.Euler(), _lq = new THREE.Quaternion(), _lp = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  const _er = new THREE.Euler(), _mineMat = new THREE.Matrix4();
  h.update = (dt, p) => {
    s.p = p;
    if (h.dirty) place();
    updateTitle(p);
    updateCursor(dt);
    // 재킷이 다 물러난 뒤(판은 턴테이블로 가는 중 · 방이 지어지는 중)에는 할 일이 없음: 판의 떠난 자리(st.heroPos)는 그대로 둠
    if (s.gone && p > SLEEVE_HERO.leave[1] + 0.01) return;
    s.gone = false;
    const n = items.length, B = S.browse, R = S.row, I = S.intro, O = S.open, H = SLEEVE_HERO;     // (H 는 아래 pullAll 에서도 씀)
    if (s.introT >= 0 && s.introT < 90) s.introT += dt;
    if (reduced) s.tilt.set(0, 0);     // 모션 줄이기: 마우스를 따라 기울지 않음
    else s.tilt.lerp(s.pointer, 1 - Math.exp(-dt * S.pose.follow));
    if (!hero() && drag.active) { drag.id = null; drag.active = false; go(s.pos); }     // 스크롤이 시작되면 끌던 것은 놓음
    if (!drag.active || !drag.moved) {
      if (reduced) { s.pos = s.target; s.vel = 0; }
      else {
        s.vel += (B.stiff * (s.target - s.pos) - B.damp * s.vel) * dt;
        s.pos += s.vel * dt;
        if (Math.abs(s.target - s.pos) < 0.0005 && Math.abs(s.vel) < 0.002) { s.pos = s.target; s.vel = 0; }
      }
    }
    if (n) setIndex(Math.min(n - 1, Math.max(0, Math.round(s.pos))));
    // 열림: 눌러서 열었거나, 스크롤을 내리기 시작했으면 (판이 나와야 턴테이블로 갈 수 있음)
    const openTo = n && isOpen() && s.recAt === s.target ? 1 : 0;
    if (reduced) { s.open = openTo; s.openV = 0; }
    else {
      s.openV += (O.stiff * (openTo - s.open) - O.damp * s.openV) * dt;
      s.open += s.openV * dt;
      if (Math.abs(openTo - s.open) < 0.0005 && Math.abs(s.openV) < 0.002) { s.open = openTo; s.openV = 0; }
    }
    const o = clamp01(s.open), oe = o * o * (3 - 2 * o);
    const pk = clamp01((o - O.pullFrom) / (1 - O.pullFrom));
    s.pull = S.pull.out * pk * pk * (3 - 2 * pk);
    // 스크롤을 내리면 판이 재킷에서 마저 다 빠져나옴 (그 뒤에 눕기 시작 → 기울면서 재킷 앞면을 뚫지 않게)
    const pullAll = s.pull + smooth(p, H.pullOut[0], H.pullOut[1]) * (H.pullFull - S.pull.out) * (s.pull / S.pull.out);
    if (n && s.pull < 0.01 && openTo === 0 && s.recAt !== s.target && Math.abs(s.pos - s.target) < 0.5) attach(s.target);
    else if (n && s.recAt < 0) attach(Math.max(0, s.index));
    if (s.wantOpen && s.recAt === s.target && Math.abs(s.pos - s.target) <= 0.06) setOpen(true);
    // 판이 Hero 를 떠남 → 그 앨범을 알림 (한 번씩)
    if (n && !hero() && s.recAt >= 0 && s.playing !== s.recAt) { s.playing = s.recAt; onPlay?.(s.recAt); }
    // 스크롤을 되돌려 Hero 로 돌아오면: 스크롤이 열었던 것은 닫힘 (눌러서 연 것은 그대로)

    // 재킷들이 물러나는 정도 (스크롤)
    const leave = smooth(p, H.leave[0], H.leave[1]);
    const leaveE = leave * leave;     // 천천히 출발해 빨라지며 화면 밖으로
    s.leave = leave;
    frame.visible = leave < 1 && s.introT >= 0 && n > 0;
    if (leave >= 1 && s.open >= 1) s.gone = true;     // 다음 프레임부터 쉼 (이 프레임은 판 자리를 마지막으로 한 번 더 넘김)

    rig.rotation.set((S.pose.rotX - s.tilt.y * S.pose.rowHover) * (1 - oe), (S.pose.rotY + s.tilt.x * S.pose.rowHover) * (1 - oe), 0);
    const visW = 2 * Math.tan(THREE.MathUtils.degToRad(s.fov / 2)) * (s.dist - O.forward) * s.aspect;
    // 높이 한도: 열린 재킷이 아래 글(아티스트 · 제목 · 버튼, 약 O.clearPx)을 덮지 않게. 화면이 낮을수록 덜 커짐
    //  (닫힌 크기보다 작아지지는 않음 — (dist - forward) / dist 가 닫힌 재킷과 같은 겉보기 크기)
    const fitH = Math.max(0.3, 1 - (2 * O.clearPx) / Math.max(1, innerHeight));
    const capH = Math.max((s.dist - O.forward) / s.dist, ((visW / s.aspect) * fitH) / S.jacket.size);
    const openScale = Math.min(O.scale, capH, (visW * O.fitW) / (S.jacket.size * (1 + S.pull.out)));
    const hoverK = 1 - (1 - O.hover) * oe;
    const gap = s.narrow ? R.gapNarrow : R.gap;
    const lean = Math.max(-B.leanMax, Math.min(B.leanMax, -s.vel * B.lean));
    const dip = Math.min(B.dipMax, Math.abs(s.vel) * B.dip);
    let mineHolder = null, mineIk = 1;
    for (let i = 0; i < n; i++) {
      const it = items[i], d = i - s.pos, ad = Math.abs(d);
      const ik0 = clamp01((s.introT - Math.min(ad, I.maxSteps) * I.stagger) / I.dur), ik = 1 - Math.pow(1 - ik0, 4);
      const mine = i === s.recAt, away = mine ? 0 : oe;
      // 옅어짐: 멀리 있는 재킷 · 등장 중 · 열릴 때 밀려나는 양옆 · 스크롤로 물러나는 동안
      // (스크롤로 물러날 때는 먼저 뒤로 빠지며 작아지고, 끝 무렵에만 옅어짐 — 반투명한 채 오래 있으면 어두운 바탕에서 뿌옇게 비쳐 보였음)
      const alpha = (1 - smooth(ad, H.fade[0], H.fade[1])) * smooth(ik0, 0, 0.5) * (1 - away) * (1 - smooth(leave, 0.8, 1));
      it.holder.visible = frame.visible && alpha > 0.004;
      if (!it.holder.visible) continue;
      for (const m of it.mats) m.opacity = alpha;
      const front = clamp01(1 - ad), out = mine ? s.pull : 0;
      const sc = (R.inactive + (1 - R.inactive) * front) * (mine ? 1 + (openScale - 1) * oe : 1);
      it.holder.scale.setScalar(sc * (I.scale + (1 - I.scale) * ik));
      it.holder.position.set(
        d * gap * (0.55 + 0.45 * ik) + Math.sign(d || 1) * away * O.spread - (out * S.jacket.size * sc) / 2 + s.tilt.x * S.pose.shift * front,
        -dip + s.tilt.y * S.pose.shift * front - (1 - ik) * I.rise - leave * H.leaveDrop,
        -Math.min(ad, 3) * R.depth - (1 - ik) * I.recede - away * O.recede + (mine ? oe * O.forward : 0) - leave * H.leaveBack);
      it.holder.rotation.set(-s.tilt.y * S.pose.hover * hoverK * front * ik + (1 - ik) * 0.25, s.tilt.x * S.pose.hover * hoverK * front * ik + lean + (1 - ik) * I.turn, lean * -0.25);
      // 판이 있을 자리는 재킷이 빠져나가기 전 자세 기준 (재킷이 왼쪽으로 나가도 판은 딸려 가지 않음)
      if (mine) { it.holder.updateMatrix(); _mineMat.copy(it.holder.matrix); }
      it.holder.position.x -= leaveE * H.leaveLeft;
      it.holder.rotation.y += leaveE * H.leaveTurn;
      if (mine) { mineHolder = it.holder; mineIk = ik0; }
    }
    // 빛: 열린 동안 마우스를 따라 조금 돎 (재킷 · 판 재질에만)
    _er.set(s.tilt.y * O.envTurn * 0.5 * oe, s.tilt.x * O.envTurn * oe, 0);
    for (const it of items) for (const m of it.mats) m.envMapRotation?.copy(_er);
    disc.record.vinyl.envMapRotation?.copy(_er);

    // 판이 있을 자리: 그 재킷 안(입구 쪽으로 pull 만큼 나옴), 재킷 면에 누운 채 · 나오며 살짝 돎
    if (mineHolder) {
      rig.updateWorldMatrix(true, false);
      _eul.set(Math.PI / 2, (s.pull / S.pull.out) * O.discSpin, 0);
      _local.compose(_lp.set(pullAll * S.jacket.size, 0, 0), _lq.setFromEuler(_eul), _one);
      _m.multiplyMatrices(rig.matrixWorld, _mineMat).multiply(_local);
      _m.decompose(_pos, _q, _sc);
      // 방의 판 루트는 아랫면 기준 → 판 축 방향으로 두께 절반만큼 내림. 재킷 크기(가운데가 아닐 때 · 열릴 때)는 판 크기에 넣지 않음
      _up.set(0, 1, 0).applyQuaternion(_q);
      (st.heroPos ??= new THREE.Vector3()).copy(_pos).addScaledVector(_up, -S.disc.thick / 2);
      (st.heroQuat ??= new THREE.Quaternion()).copy(_q);
      st.heroScale = _sc.x;
    }
    // 재킷 안에 다 들어가 있고 아직 Hero 면 판은 그리지 않음 (재킷 옆면으로 비치지 않게). 등장 전에도 숨김
    st.heroDiscHidden = hero() && (s.pull < 0.002 || mineIk < 0.6 || s.introT < 0);
  };

  const disposeItem = (it) => {
    it.holder.removeFromParent();
    it.jacket.mesh.geometry.dispose();
    for (const m of it.mats) { m.map?.dispose(); m.dispose(); }
  };
  Object.defineProperty(h, "items", { get: () => items });     // (Object.assign 은 getter 를 값으로 복사해 버림)
  Object.assign(h, {
    /** albums: { title, artist, color }[] (RoomTest 의 앨범 목록 모양). 커버 그림은 setCover 로 */
    setAlbums(list) {
      items.forEach(disposeItem);
      items = list.map((a) => {
        const album = { title: a.title, artist_names: a.artist }, color = a.color || "#8a7f86";
        const jacket = makeJacket(renderer, paper);
        jacket.setArt(drawFront(null, color), drawBack(album, color), color);
        const mats = [...new Set(jacket.mesh.material)];
        for (const m of mats) { withEnv(m); m.transparent = true; }
        jacket.mesh.castShadow = true;     // 판 위에 재킷 그림자
        const holder = new THREE.Group();
        holder.add(jacket.mesh);
        rig.add(holder);
        return { album, color, holder, jacket, mats };
      });
      s.pos = s.target = Math.min(s.target, Math.max(0, items.length - 1)); s.vel = 0;
      s.open = s.openV = s.pull = 0; s.clickOpen = s.wantOpen = false; s.recAt = -1; s.index = -1;
      sayOpen();
    },
    /** 커버 그림을 앞면에. 좁은 화면(휴대폰)은 512px 로 그려 메모리를 아낌. 그림은 바로 GPU 에 올려 둠 (처음 보이는 프레임에 끊기지 않게) */
    setCover(i, img) {
      const it = items[i]; if (!it || !img) return;
      it.jacket.setFront(drawFront(img, it.color, s.narrow || Math.min(innerWidth, innerHeight) < 700 ? 512 : 1024));
      const map = it.jacket.mesh.material[4].map;
      if (map) { try { renderer.initTexture(map); } catch { /* 첫 그리기에서 올라감 */ } }
    },
    reveal() { if (s.introT < 0) s.introT = 0; },
    go(i) { if (!s.clickOpen && hero()) go(i); },
    step(d) { if (!introBusy() && !s.clickOpen && hero()) go(s.target + d); },
    setOpen(open) { if (!introBusy() && hero()) setOpen(open); },
    dispose() {
      window.removeEventListener("keydown", onKey);
      themeMo.disconnect();
      stage.style.cursor = ""; stage.removeAttribute("data-home-stage");
      stage.style.touchAction = touchWas;
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      for (const t of ["touchend", "touchcancel"]) stage.removeEventListener(t, onTouchEnd);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      for (const t of ["pointerup", "pointercancel"]) stage.removeEventListener(t, onUp);
      stage.removeEventListener("pointerleave", onLeave);
      items.forEach(disposeItem);
      frame.removeFromParent();
      paperQuad.removeFromParent(); paperQuad.geometry.dispose(); paperMat.dispose(); paperU.tGrain.value?.dispose();
      paper.rough.dispose(); paper.bump.dispose();
      envMap.dispose();
    },
  });
  return h;
}
