// 방 안 소품 상호작용 (C, 2026-11-19): 레코드 상자 · 지금 듣는 판 · 책 → 메뉴 카드 / 스피커 · 앰프 → 음악 / 커튼 · 창문 · 벽 그림 → 방 분위기 / 컵 → 김(연기)
//  RoomTest 의 st.targets 에 { key, objs, tip(), click(), lift } 를 더하고, tick(dt) 를 매 프레임 부름
//  움직임은 메시(조각)의 지역 변환만 바꿈 — pivot 은 Blender reveal 클립이 움직이므로 건드리지 않음
//  늘 남는 상태(커튼 · 창문 · 벽 그림)는 부드럽게 따라가는 값(0…1), 한 번 하는 동작(톡 튀기 · 한 모금)은 시간(초)
import * as THREE from "three";
import { makeTriVision } from "./triVision";

export const PROPS = {
  hop: { dur: 0.36, h: 0.035 },              // 상자 · 책 · 거치대: 누르면 톡 튀고 메뉴 카드가 뜸
  curtain: { cover: 0.42, rate: 2.6 },       // 커튼: 닫으면 창 폭의 이만큼까지 펼쳐짐 · 따라가는 빠르기
  city: { off: 0.28, rate: 2.2 },            // 창문: 바깥 불을 끄면 이 밝기로
  art: { glow: 0.78 },                       // 벽 그림: 커버의 밝기 (바뀌는 움직임은 triVision.js 의 TRI)
  beat: { bpm: 112, amp: 0.045 },            // 스피커 우퍼: 음악이 나오는 동안 이 박자로 펌핑 (실제 소리 분석은 YouTube 에서 못 함)
};
const follow = (cur, want, dt, rate) => cur + (want - cur) * (1 - Math.exp(-dt * rate));
const meshesOf = (o) => { const out = []; o?.traverse((m) => { if (m.isMesh) out.push(m); }); return out; };
const boxOf = (m) => { m.geometry.computeBoundingBox(); return m.geometry.boundingBox; };

/**
 * @param {{ st: any, root: THREE.Object3D, makeCoverFace: Function, sound: any, camera: THREE.Camera }} o
 * @returns {{ targets: any[], tick: (dt: number, time: number) => void }}
 */
export function setupRoomProps({ st, root, makeCoverFace, sound, camera }) {
  const targets = [];
  const R = st.reduced;
  const add = (key, objs, def) => { objs = objs.filter(Boolean); if (objs.length) targets.push({ key, objs, liftK: 0, base: objs.map((o) => o.position.y), ...def }); };

  // ── 페이지로 가는 소품 (상자 · 책 · 거치대): 누르면 톡 튀고 그 위에 작은 메뉴 카드가 뜸 → 카드의 버튼을 눌러야 이동
  //  (2026-11-20 사용자: 누르자마자 페이지가 바뀌는 건 별로) · 카드는 RoomTest 가 그림 (st.openMenu)
  const hops = new Map();   // target → 시간
  const menu = (build) => (t) => {
    const m = build();
    if (!m) return;
    sound.click?.();
    if (!R) hops.set(t, 0);
    st.openMenu?.({ obj: t.objs[0], key: t.key, ...m });
  };
  const np = root.getObjectByName("prop_cs_np");
  add("vinyl_box", [root.getObjectByName("pivot_prop_cs_vinyl_box")?.children[0]], {
    lift: 0.02, tip: () => "Record crate",
    click: menu(() => ({ kicker: "Record crate", title: "Dig through the crates", actions: [{ label: "Start digging", href: "/digging" }, { label: "Your collection", href: "/collection" }] })),
  });
  add("book", [root.getObjectByName("pivot_prop_ct_book")?.children[0]], {
    lift: 0.015, tip: () => "Journal",
    click: menu(() => ({ kicker: "Journal", title: "News & Stories", actions: [{ label: "Read the news", href: "/news" }] })),
  });
  add("now_playing", [np], {
    lift: 0.012,
    tip: () => st.nowPlaying?.title ?? "Now playing",
    click: menu(() => {
      const a = st.nowPlaying;
      if (!a?.slug || st.swap) return null;
      const actions = [{ label: "View album", href: `/album/${encodeURIComponent(a.slug)}` }];
      if (a.playlist) actions.push({ label: "Open on YouTube", href: `https://www.youtube.com/playlist?list=${encodeURIComponent(a.playlist)}`, external: true });
      return { kicker: "Now playing", title: a.title, sub: a.artist, actions };
    }),
  });

  // ── 음악: 앰프 = 재생 · 멈춤 (턴테이블과 같음, VU 바늘은 재생 중에 이미 움직임) · 스피커 = 소리 끄기 · 켜기
  add("amp", [root.getObjectByName("pivot_amp")], { lift: 0, tip: () => (st.playing ? "Pause ■" : "Play ▸"), click: () => st.togglePlay?.() });
  const speakers = ["pivot_speaker_L", "pivot_speaker_R"].map((n) => root.getObjectByName(n)).filter(Boolean);
  for (const sp of speakers) add(sp.name, [sp], {
    lift: 0,
    tip: () => (!st.musicPlaying ? "Play ▸" : st.musicMuted ? "Sound on" : "Mute"),
    click: () => {
      if (!st.musicPlaying) { if (!st.playing || st.musicOff) st.togglePlay?.(); return; }
      st.musicMuted = !st.musicMuted; st.music?.setMuted(st.musicMuted); sound.click?.();
    },
  });
  // 우퍼: 각자 가운데를 축으로 크기만 (조각의 지역 좌표)
  const woofers = speakers.flatMap((sp) => meshesOf(sp).filter((m) => /woofer/i.test(m.name))).map((m) => {
    const c = boxOf(m).getCenter(new THREE.Vector3());
    return { m, base: m.matrix.clone(), c };
  });
  let pump = 0;

  // ── 커튼: 창 쪽으로 펼쳐 닫음. 창에서 먼 쪽 가장자리를 붙여 두고 폭(지역 z)만 늘림
  const cloth = root.getObjectByName("curtain_1");
  const frame = root.getObjectByName("window_frame");
  let curtain = null;
  // 잴 것은 방이 다 지어진 뒤(처음 누를 때) — 짓는 동안엔 pivot 크기가 0 에 가까워 길이를 잴 수 없음
  //  창틀 상자를 커튼 지역 좌표로 옮겨서: 폭 방향 · 창에서 먼 쪽 가장자리 · 창 폭을 같은 단위로
  const measureCurtain = () => {
    cloth.updateMatrixWorld(true); frame.updateMatrixWorld(true);
    const b = boxOf(cloth), size = b.getSize(new THREE.Vector3());
    const axis = size.x > size.z ? "x" : "z";     // 폭 방향 = 가로 축 중 긴 쪽 (커튼 메시: x 두께 · y 높이 · z 폭)
    const fb = new THREE.Box3().setFromObject(frame).applyMatrix4(new THREE.Matrix4().copy(cloth.matrixWorld).invert());
    const wc = fb.getCenter(new THREE.Vector3()), winW = fb.getSize(new THREE.Vector3())[axis];
    const far = Math.abs(b.min[axis] - wc[axis]) > Math.abs(b.max[axis] - wc[axis]) ? b.min[axis] : b.max[axis];
    const width = size[axis];
    return { axis, anchor: far, base: cloth.matrix.clone(), k: 0, want: 0, stretch: Math.max(1.2, (winW * PROPS.curtain.cover + width) / width) };
  };
  if (cloth && frame) {
    add("curtain", [cloth], {
      lift: 0, tip: () => (curtain?.want ? "Open curtain" : "Close curtain"),
      click: () => { curtain ??= measureCurtain(); curtain.want = curtain.want ? 0 : 1; sound.click?.(); },
    });
  }

  // ── 창문: 바깥(남산 · 도시) 불을 끄고 켬 — 창 안 그림 + 바깥 배경 레이어의 밝기
  const city = { k: 1, want: 1, mats: null };
  add("window", [frame, st.env?.glass, st.env?.windowMat ? root.getObjectByName("Window_City") : null], {
    lift: 0, tip: () => (city.want < 1 ? "City lights on" : "City lights off"),
    click: () => { city.want = city.want < 1 ? 1 : PROPS.city.off; sound.click?.(); },
  });

  // ── 벽 그림: 지금 듣는 판 커버로 바꿔 걸기 ↔ 원래 그림. 그림 면이 세로 슬랫(삼각기둥)으로 나뉘어 차례로 돌며 바뀜 (triVision.js)
  //  (2026-11-22 예전: 원래 그림 위에 커버 판이 서서히 나타남) 듣는 판이 바뀌면 다음 커버도 같은 방식으로 넘어감
  const artMesh = root.getObjectByName("wall_art_1");
  const art = { want: 0, tri: null, album: null, slot: 0, loading: null };
  if (artMesh) {
    add("wall_art", [artMesh, root.getObjectByName("wall_art_2")], {
      lift: 0, tip: () => (art.want ? "Original art" : "Hang this record"),
      click: () => { art.want = art.want ? 0 : 1; sound.click?.(); },
    });
  }
  const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
  // 슬랫은 처음 걸 때 만듦 (방이 다 지어지고 구운 재질이 입혀진 뒤라야 원래 그림을 그대로 옮길 수 있음)
  const triOf = () => {
    if (art.tri || !artMesh) return art.tri;
    const { face, mat } = makeCoverFace(artMesh, st.roomCenter);   // 그림 면의 자리 · 방향만 빌림
    const b = boxOf(artMesh).getSize(new THREE.Vector3());
    const dims = [b.x, b.y, b.z].sort((a, c) => c - a);            // 그림 판: 두 큰 값 = 세로 · 가로
    art.tri = makeTriVision({ artMesh, face, w: dims[1] * 0.98, h: dims[0] * 0.98, glow: PROPS.art.glow, reduced: R });
    face.removeFromParent(); face.geometry.dispose(); mat.dispose();
    return art.tri;
  };
  // 이 앨범의 커버를 지금 정면이 아닌 커버 칸에 붙이고 그 면으로 돌림
  const showArt = (album) => {
    if (!album?.image || art.album === album || art.loading === album) return;
    const tri = triOf();
    if (!tri || tri.busy) return;                                   // 도는 중이면 끝난 뒤 다음 프레임에 다시
    art.loading = album;
    const slot = tri.face === 1 ? 2 : 1;
    loader.load(album.image, (tex) => {
      if (art.loading !== album) { tex.dispose(); return; }
      art.loading = null;
      if (!art.want) { tex.dispose(); return; }
      tex.colorSpace = THREE.SRGBColorSpace;
      tri.setCover(slot, tex);
      art.album = album; art.slot = slot;
      tri.go(slot);
    }, undefined, () => { if (art.loading === album) art.loading = null; });
  };

  // ── 컵: 늘 피어오르는 김 (2026-11-20 사용자: 들어 올리는 동작 말고 연기로) — makeSteam 아래
  const cupMesh = root.getObjectByName("prop_ct_cup_1");
  const steam = cupMesh ? makeSteam(cupMesh) : null;

  const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _c = new THREE.Vector3();
  const tick = (dt, time) => {
    // 톡 튀기
    for (const [t, s] of hops) {
      const k = (s + dt) / PROPS.hop.dur;
      t.hop = k >= 1 ? 0 : Math.sin(Math.PI * k) * PROPS.hop.h;
      if (k >= 1) hops.delete(t); else hops.set(t, s + dt);
    }
    // 스피커 우퍼: 음악이 나오는 동안 박자 (소리를 끄면 멈춤)
    const on = st.musicPlaying && !st.musicMuted && !R;
    const beat = on ? Math.pow(Math.max(0, Math.sin(time * Math.PI * (PROPS.beat.bpm / 60))), 10) : 0;
    pump = follow(pump, beat, dt, 30);
    for (const w of woofers) {
      const s = 1 + PROPS.beat.amp * pump;
      w.m.matrix.copy(w.base).multiply(_m.makeTranslation(w.c)).multiply(_m2.makeScale(s, s, s)).multiply(_m.makeTranslation(_c.copy(w.c).negate()));
      w.m.matrix.decompose(w.m.position, w.m.quaternion, w.m.scale);
    }
    // 커튼
    if (curtain) {
      curtain.k = R ? curtain.want : follow(curtain.k, curtain.want, dt, PROPS.curtain.rate);
      const s = 1 + (curtain.stretch - 1) * curtain.k, a = curtain.anchor, ax = curtain.axis;
      _c.set(0, 0, 0)[ax] = a;
      _m.copy(curtain.base).multiply(_m2.makeTranslation(_c)).multiply(_m2.makeScale(ax === "x" ? s : 1, 1, ax === "z" ? s : 1));
      _c.set(0, 0, 0)[ax] = -a;
      _m.multiply(_m2.makeTranslation(_c));
      _m.decompose(cloth.position, cloth.quaternion, cloth.scale);
    }
    // 창문: 바깥 밝기. 창 안 그림 · 하늘은 RoomTest 가 매 프레임 칠하면서 st.cityMul 을 곱함, 바깥 레이어 색은 여기서
    city.k = R ? city.want : follow(city.k, city.want, dt, PROPS.city.rate);
    if (st.env?.group && Math.abs(city.k - (st.cityMul ?? 1)) > 1e-4) {
      if (!city.mats) { city.mats = []; st.env.group.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) if (m?.color && !city.mats.some((x) => x.m === m)) city.mats.push({ m, c: m.color.clone() }); }); }
      for (const { m, c } of city.mats) m.color.copy(c).multiplyScalar(city.k);
    }
    st.cityMul = city.k;
    // 벽 그림: 걸어 두었으면 지금 듣는 판의 커버로 (판이 바뀌면 다음 커버로 넘어감), 아니면 원래 그림으로
    if (art.want && st.nowPlaying) showArt(st.nowPlaying);
    if (art.tri) {
      if (!art.want) { art.album = null; art.loading = null; art.tri.go(0); }
      art.tri.tick(dt);
    }
    // 컵 김: 시간을 흘리고(동작 줄이기면 멈춘 한 장면), 카메라 쪽을 보게 (세로축으로만)
    if (steam) {
      if (!R) steam.uniforms.uTime.value = time;
      if (camera) { camera.getWorldPosition(_c); steam.mesh.parent.worldToLocal(_c); _c.y = steam.mesh.position.y; steam.mesh.lookAt(steam.mesh.parent.localToWorld(_c)); }
    }
  };
  return { targets, tick };
}

// ── 컵 김 (참고: 32-coffee-smoke 예시) — 노이즈 그림 한 장으로
//  꼭짓점: 높이를 따라 노이즈만큼 비틀고(twist) · 위로 갈수록 노이즈 바람에 밀림
//  조각: 노이즈를 위로 흘려 보내며 옅은 곳을 잘라 연기 결을 만들고, 가장자리 · 위쪽은 서서히 사라지게
//  노이즈 그림은 그려서 만듦(이어 붙여도 이음매가 없는 값 노이즈 4겹) — 따로 받을 파일 없음
export const STEAM = { w: 0.094, h: 0.32, twist: 8, wind: 0.06, color: "#f3e6d4", opacity: 0.75 };   // 크기(m) · 비틀기 · 바람 · 색 · 진하기 (방 전체 구도에서도 보이게 2026-11-20 키움)

let noiseTex = null;
function steamNoise() {
  if (noiseTex) return noiseTex;
  const N = 128, c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d"), img = g.createImageData(N, N);
  const hash = (x, y, s) => { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); };
  const smooth = (t) => t * t * (3 - 2 * t);
  // 칸 수 p 짜리 격자 값 노이즈, 가장자리에서 처음 칸으로 돌아가 이어짐
  const layer = (x, y, p, s) => {
    const fx = (x / N) * p, fy = (y / N) * p, x0 = Math.floor(fx), y0 = Math.floor(fy);
    const u = smooth(fx - x0), v = smooth(fy - y0), w = (i) => ((i % p) + p) % p;
    const a = hash(w(x0), w(y0), s), b = hash(w(x0 + 1), w(y0), s), cc = hash(w(x0), w(y0 + 1), s), d = hash(w(x0 + 1), w(y0 + 1), s);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let n = 0, amp = 0.5, tot = 0;
    for (let o = 0; o < 4; o++) { n += layer(x, y, 4 << o, o + 1) * amp; tot += amp; amp *= 0.5; }
    const v = Math.round((n / tot) * 255), i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseTex = new THREE.CanvasTexture(c);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
  return noiseTex;
}

function makeSteam(cupMesh) {
  const b = new THREE.Box3().copy((cupMesh.geometry.computeBoundingBox(), cupMesh.geometry.boundingBox));
  const geo = new THREE.PlaneGeometry(1, 1, 16, 64);
  geo.translate(0, 0.5, 0);
  geo.scale(STEAM.w, STEAM.h, STEAM.w);
  const uniforms = {
    uTime: { value: 0 }, uNoise: { value: steamNoise() }, uTwist: { value: STEAM.twist }, uWind: { value: STEAM.wind },
    uColor: { value: new THREE.Color(STEAM.color) }, uOpacity: { value: STEAM.opacity },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `
      uniform float uTime; uniform sampler2D uNoise; uniform float uTwist; uniform float uWind;
      varying vec2 vUv;
      vec2 rot(vec2 v, float a) { float s = sin(a), c = cos(a); return mat2(c, s, -s, c) * v; }
      void main() {
        vec3 p = position;
        float twist = texture2D(uNoise, vec2(0.5, uv.y * 0.2 - uTime * 0.005)).r;
        p.xz = rot(p.xz, twist * uTwist);
        vec2 wind = vec2(texture2D(uNoise, vec2(0.25, uTime * 0.01)).r - 0.5, texture2D(uNoise, vec2(0.75, uTime * 0.01)).r - 0.5);
        p.xz += wind * uv.y * uv.y * uWind;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime; uniform sampler2D uNoise; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 s = vec2(vUv.x * 0.5, vUv.y * 0.3 - uTime * 0.03);
        float smoke = smoothstep(0.4, 1.0, texture2D(uNoise, s).r);
        smoke *= smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        smoke *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
        gl_FragColor = vec4(uColor, smoke * uOpacity);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "cup_steam";
  mesh.renderOrder = 10;   // 투명: 방 다음에
  mesh.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.004, (b.min.z + b.max.z) / 2);
  mesh.frustumCulled = false;   // 꼭짓점이 셰이더에서 움직여 상자가 맞지 않음
  cupMesh.add(mesh);
  return { mesh, uniforms };
}
