// Home Hero (heroMode="ink"): 방 장면 속 잉크 판 한 장 + 주변 효과 · 누르기 · 끌어서 뒤집기 · "Grooves" 제목 · 커스텀 커서
//  /lab/room-test (VinylOnly.jsx) 에서 맞춘 그림을 Home(RoomTest 의 한 장면 흐름)으로 옮긴 것. 값은 VinylOnly 와 같음
//  판 자리 · 진행도 · 회전은 RoomTest 가 정하고(apply), 이 모듈은
//   - 처음 자세(Home Hero 구도: 기울기 40° · 화면에서 33° · 화면 폭 58% 크기)를 st.takeHero 로 넘김
//   - 뒤집기 회전(flipQ) · 누르는 중(holding) 을 알려 줌
//   - 판 가운데에 붙은 효과 틀(fxFrame: 헤일로 · 타이포 링 · 먼지)과 제목 · 커서를 매 프레임 갱신
import * as THREE from "three";
import { createHeroFx, HERO_SPIN, HERO_HOLD } from "@/components/vinyl/heroFx";

export { HERO_SPIN, HERO_HOLD };
export const INK_HERO = {
  tilt: 40, roll: 33,                         // Home HERO_COMPOSITION
  fxOut: [0, 0.05],                           // 진행도 P 에서 효과가 사라지는 구간 (lab: 판 진행도 0 ~ 0.14)
  heroP: 0.006,                               // 이 진행도 아래 = Hero (누르기 · 뒤집기 · 링은 여기서만)
};
const FLIP = { dragStart: 8, dragPerTurn: 1.6, stiffness: 70, damping: 0.82 };
const RING = { show: 0.55, hide: 1.28 };
const TITLE = { delay: 1.35, stagger: 0.06, dur: 0.9, out: [0, 0.04], lift: 0.25 };
const CURSOR = { ringLag: 0.12, scale: { idle: 0.32, disc: 1, drag: 0.78, flip: 0.7, link: 0.55 } };
// 테마별 Hero 색 (homeEngine THEME 과 같은 값): 크림(기본) · 브라운(다크 모드 = Home 의 nv 테마)
//  paper 바탕 · text 글자(제목 · 링 글자 · 커서 점) · ink3d 판 잉크 · 커서 링 · label3d 판 라벨
export const HERO_THEMES = {
  // 2026-11-15 사용자 결정: 판은 파랑 잉크 그대로(라이트 진한 파랑 · 다크 밝은 하늘색), 글자만 바탕과 반대 색(브라운 ↔ 크림)
  light: { paper: "#f4e7cd", text: "#4c404a", ink3d: "#4f6d93", label3d: "#bbcbda" },
  dark: { paper: "#4c404a", text: "#f4e7cd", ink3d: "#a9c1db", label3d: "#4d5f74" },
};
export const HS = HERO_THEMES.light;   // 처음 그리는 색 (마운트 뒤 테마에 맞춰 바뀜)
const COMP = { widthFraction: 0.58, compactWidthFraction: 0.74, heightFraction: 0.68, reservePx: 24 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const RPM = (r) => (r * Math.PI * 2) / 60;

// Home Hero 구도: 판(지름)이 화면 폭의 58%(세로 화면 74%) · 높이의 68% 안에 들어오는 반지름 px
function heroRadiusPx(width, height) {
  const tilt = THREE.MathUtils.degToRad(INK_HERO.tilt), roll = THREE.MathUtils.degToRad(INK_HERO.roll);
  const shortAxis = Math.sin(tilt), c = Math.cos(roll), s = Math.sin(roll);
  const thick = 0.021497 * Math.cos(tilt);
  const pw = 2 * Math.hypot(c, shortAxis * s) + thick * Math.abs(s);
  const ph = 2 * Math.hypot(s, shortAxis * c) + thick * Math.abs(c);
  const portrait = Math.min(1, Math.max(0, (1.25 - width / height) / 0.5));
  const tw = COMP.widthFraction + (COMP.compactWidthFraction - COMP.widthFraction) * portrait;
  const hf = Math.min(COMP.heightFraction, Math.max(0.1, 1 - COMP.reservePx / height));
  return Math.min((width * tw) / pw, (height * hf) / ph);
}

/**
 * @param {{ st: any, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, disc: { root: THREE.Object3D, uniforms: any },
 *   radius: number, reduced: boolean, stage: HTMLElement, title: HTMLElement|null, cursor: any, startAt: () => number|null }} o
 */
export function createInkHero({ st, renderer, camera, disc, radius, reduced, stage, title, cursor, startAt }) {
  const fx = createHeroFx({ ink: disc.uniforms.uInk, renderer, reduced });
  fx.setPixelRatio(renderer.getPixelRatio());
  const fxFrame = new THREE.Group();
  fxFrame.name = "inkHeroFx";
  fxFrame.scale.setScalar(radius);
  fxFrame.add(fx.group);
  const flipQ = new THREE.Quaternion();
  const pick = [];
  disc.root.traverse((o) => { if (o.isMesh) pick.push(o); });
  const h = { fx, fxFrame, flipQ, holding: false, dirty: true };

  // 처음 자세: 화면 가운데 · Home Hero 크기 (RoomTest 의 takeHero 가 P=0 카메라 앞 자리 · 렌즈를 맞춤)
  const tiltQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(INK_HERO.roll))
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(INK_HERO.tilt), 0, 0)));
  const lin = (hex) => { const c = new THREE.Color(hex); return { x: c.r, y: c.g, z: c.b }; };
  // 테마: <html data-theme="dark"> 면 브라운 바탕. 바뀌면 바탕 · 판 잉크 · 링 글자 · 제목 · 커서 색을 바로 바꿈
  let theme = HERO_THEMES.light;
  const applyTheme = () => {
    theme = document.documentElement.dataset.theme === "dark" ? HERO_THEMES.dark : HERO_THEMES.light;
    st.heroBg = new THREE.Color(theme.paper);
    st.themeCream = st.heroBg.clone();
    (st.heroInk ??= new THREE.Color()).set(theme.ink3d);
    (st.heroLabel ??= new THREE.Color()).set(theme.label3d);
    fx.setTheme({ text: theme.text, paper: theme.paper });
    if (title) title.style.color = theme.text;
    if (cursor) {
      cursor.label.style.color = theme.text;
      const d = cursor.dot.firstElementChild;
      d.style.background = theme.text; d.style.boxShadow = `0 0 0 1px ${theme.paper}`;
      for (const el of cursor.tick.children) el.setAttribute("stroke", theme.ink3d);
      cur.state = "";   // 커서 링 색 · 채움을 다시
    }
  };
  // 어두운 방에 들어가면: 다크 모드 Hero 의 판 색으로 (2026-11-15 사용자 결정 — 같은 파랑 판이 이어지게, 크림 · 청록으로 바꾸지 않음)
  //  다크 모드는 Hero 색 그대로, 라이트 모드는 진한 파랑 → 밝은 파랑 (거의 검은 방에서도 홈이 보이게)
  st.nightInk = new THREE.Color(HERO_THEMES.dark.ink3d);
  st.nightLabel = new THREE.Color(HERO_THEMES.dark.label3d);
  const themeMo = new MutationObserver(applyTheme);
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  h.place = () => {
    const r = renderer.domElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    st.canvasRect = r;
    st.takeHero({ radius: heroRadiusPx(r.width, r.height), rect: r, x: 0, y: 0, tiltQuat, ink: lin(theme.ink3d), label: lin(theme.label3d), omega: -RPM(HERO_SPIN.rpm) });
    h.dirty = false;
  };

  // ── 판 평면 (기울기 틀 = comp, 가운데 = center) 위 자리 · 판에 닿는지
  const comp = new THREE.Quaternion(), center = new THREE.Vector3();
  const _ray = new THREE.Raycaster(), _plane = new THREE.Plane(), _hit = new THREE.Vector3(), _n = new THREE.Vector3(), _qi = new THREE.Quaternion();
  const planeAt = (ndc, out) => {
    _ray.setFromCamera(ndc, camera);
    _n.set(0, 1, 0).applyQuaternion(comp);
    _plane.setFromNormalAndCoplanarPoint(_n, center);
    if (!_ray.ray.intersectPlane(_plane, _hit)) return null;
    _hit.sub(center).applyQuaternion(_qi.copy(comp).invert()).divideScalar(radius);
    return out.set(_hit.x, _hit.z);
  };
  const hitsDisc = (ndc) => { _ray.setFromCamera(ndc, camera); return _ray.intersectObjects(pick, false).length > 0; };
  const hero = () => st.p < INK_HERO.heroP;

  // ── 입력: 판 위를 누르면 가속부터 → 8px 넘게 끌면 끈 방향으로 뒤집기 → 놓으면 가까운 면(A/B)으로 스프링 안착
  const fl = { pressed: false, id: null, flipping: false, settling: false, rel: 0, vel: 0, target: 0, last: 0,
    axis: new THREE.Vector3(1, 0, 0), dir: new THREE.Vector2(), start: new THREE.Vector2(), base: new THREE.Quaternion(), screen: new THREE.Vector2(), sideB: false };
  const pointer = { ndc: null };
  const cur = { mouse: new THREE.Vector2(-100, -100), ring: new THREE.Vector2(-100, -100), visible: false, overLink: false, state: "" };
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const ndcOf = (e, out) => {
    const r = renderer.domElement.getBoundingClientRect();
    return out.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  };
  const _pd = new THREE.Vector2(), _pp = new THREE.Vector2();
  const onMove = (e) => {
    ndcOf(e, pointer.ndc ??= new THREE.Vector2());
    if (e.pointerType === "mouse") { cur.mouse.set(e.clientX, e.clientY); if (!cur.visible) { cur.ring.copy(cur.mouse); cur.visible = true; } }
    cur.overLink = !!(e.target instanceof Element && e.target.closest("a, button, [role='button']"));
    if (!fl.pressed || e.pointerId !== fl.id) return;
    if (!fl.flipping) {
      if (Math.hypot(e.clientX - fl.screen.x, e.clientY - fl.screen.y) < FLIP.dragStart) return;
      if (!planeAt(ndcOf(e, _pd), _pp)) return;
      fl.dir.copy(_pp).sub(fl.start);
      if (fl.dir.lengthSq() < 1e-8) fl.dir.set(1, 0);
      fl.dir.normalize();
      fl.axis.set(fl.dir.y, 0, -fl.dir.x);
      h.holding = false; fl.flipping = true; fl.settling = false;
      fl.base.copy(flipQ); fl.rel = 0; fl.last = 0; fl.vel = 0;
    }
    if (!planeAt(ndcOf(e, _pd), _pp)) return;
    fl.rel = (_pp.sub(fl.start).dot(fl.dir) / FLIP.dragPerTurn) * Math.PI;
  };
  const onDown = (e) => {
    if (fl.pressed || e.button !== 0 || !hero() || !hitsDisc(ndcOf(e, _pd))) return;
    if (e.target instanceof Element && e.target.closest("a, button, [role='button']")) return;
    fl.pressed = true; fl.id = e.pointerId;
    fl.screen.set(e.clientX, e.clientY);
    planeAt(_pd, fl.start);
    h.holding = true;
    stage.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const endPress = (e) => {
    if (!fl.pressed || e.pointerId !== fl.id) return;
    fl.pressed = false; fl.id = null; h.holding = false;
    if (fl.flipping) {
      fl.flipping = false;
      fl.target = Math.round((fl.rel + fl.vel * 0.18) / Math.PI) * Math.PI;
      fl.settling = true;
    }
    if (stage.hasPointerCapture?.(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  };
  const onLeave = () => { pointer.ndc = null; cur.visible = false; };
  const noMenu = (e) => { if (hero()) e.preventDefault(); };
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerdown", onDown);
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) stage.addEventListener(t, endPress);
  stage.addEventListener("pointerleave", onLeave);
  stage.addEventListener("contextmenu", noMenu);

  const _dq = new THREE.Quaternion(), _fup = new THREE.Vector3();
  const updateFlip = (dt) => {
    if (fl.flipping) {
      const v = dt > 0 ? (fl.rel - fl.last) / dt : 0;
      fl.vel += (v - fl.vel) * (1 - Math.exp(-dt / 0.06));
      fl.last = fl.rel;
    } else if (fl.settling) {
      const kk = FLIP.stiffness, c = 2 * Math.sqrt(kk) * FLIP.damping;
      fl.vel += (kk * (fl.target - fl.rel) - c * fl.vel) * dt;
      fl.rel += fl.vel * dt;
      if (Math.abs(fl.target - fl.rel) < 0.0015 && Math.abs(fl.vel) < 0.02) { fl.rel = fl.target; fl.settling = false; }
    }
    if (fl.flipping || fl.settling || fl.rel !== 0) {
      _dq.setFromAxisAngle(fl.axis, fl.rel);
      flipQ.multiplyQuaternions(_dq, fl.base);
      if (!fl.flipping && !fl.settling) { fl.base.copy(flipQ); fl.rel = 0; }
    }
    _fup.set(0, 1, 0).applyQuaternion(flipQ);
    const b = _fup.y < 0;
    if (b !== fl.sideB) { fl.sideB = b; fx.setSideB(b); }
  };
  // Hero 를 떠나면(내려가기 시작) 누르던 것은 놓고, 뒤집던 판은 가까운 면으로
  const letGo = () => {
    h.holding = false;
    if (fl.flipping) { fl.flipping = false; fl.target = Math.round(fl.rel / Math.PI) * Math.PI; fl.settling = true; }
  };

  // ── 제목: 회전이 시작되고 조금 뒤 글자가 하나씩 올라옴 · 빨라질수록 기울고 벌어짐 · 내려가면 위로 걷히며 옅어짐
  const letters = [...(title?.children ?? [])];
  const letterVel = letters.map(() => 0);
  const updateTitle = (dt, omega, p) => {
    if (!title) return;
    const s = startAt();
    const t = s == null ? -1 : performance.now() / 1000 - s - TITLE.delay;
    const rpmNow = (Math.abs(omega) * 60) / (Math.PI * 2);
    const amount = reduced ? 0 : clamp01((rpmNow - HERO_SPIN.rpm) / (HERO_HOLD.maxRpm - HERO_SPIN.rpm));
    letters.forEach((el, i) => {
      const rk = reduced ? (t >= 0 ? 1 : 0) : 1 - Math.pow(1 - clamp01((t - i * TITLE.stagger) / TITLE.dur), 3);
      el.style.translate = `0 ${((1 - rk) * 110).toFixed(2)}%`;
      letterVel[i] += (amount - letterVel[i]) * (1 - Math.exp(-dt / (0.12 + i * 0.07)));
      const v = letterVel[i], spread = (i - (letters.length - 1) / 2) * v * 0.09;
      el.style.transform = `translateX(${spread.toFixed(3)}em) skewX(${(-v * 28).toFixed(2)}deg)`;
    });
    const out = smooth(p, TITLE.out[0], TITLE.out[1]);
    title.style.opacity = String(1 - out);
    title.style.visibility = out >= 1 ? "hidden" : "";
    title.style.translate = `0 calc(-50% - ${(out * TITLE.lift * stage.clientHeight).toFixed(1)}px)`;
  };

  // ── 커스텀 커서 (마우스 · Hero 에서만): 점은 바로, 링은 살짝 늦게
  let cursorOn = null;
  const setCursorState = (s) => {
    const c = cursor;
    if (!c || s === cur.state) return;
    cur.state = s;
    c.shape.style.transform = `scale(${CURSOR.scale[s] ?? CURSOR.scale.idle})`;
    const filled = s === "disc" || s === "drag" || s === "flip";
    c.shape.style.backgroundColor = filled ? `color-mix(in srgb, ${theme.paper} 72%, transparent)` : "transparent";
    c.shape.style.backdropFilter = filled ? "blur(6px)" : "none";
    c.shape.style.borderColor = s === "link" ? theme.text : theme.ink3d;
    c.label.style.opacity = filled ? "1" : "0";
    c.tick.style.opacity = s === "drag" ? "1" : "0";
    c.dot.firstElementChild.style.opacity = s === "idle" ? "1" : "0";
    if (s === "disc") c.label.textContent = "Hold\nDrag";
    if (s === "flip") c.label.textContent = "Flip";
  };
  const updateCursor = (dt, fade, omega, angle) => {
    const c = cursor;
    if (!finePointer || !c) return;
    const on = fade > 0.02;
    // Hero 동안은 이 커서만 (사이트 공통 커서 SiteCursor 는 data-home-stage 안에서 숨음)
    if (on !== cursorOn) { cursorOn = on; stage.style.cursor = on ? "none" : ""; stage.toggleAttribute("data-home-stage", on); }
    const s = !cur.visible || !on ? "hidden" : fl.flipping ? "flip" : h.holding ? "drag" : st.overDisc ? "disc" : cur.overLink ? "link" : "idle";
    setCursorState(s);
    const show = s !== "hidden";
    c.ring.style.opacity = show ? "1" : "0";
    c.dot.style.opacity = show ? "1" : "0";
    if (!show) return;
    cur.ring.lerp(cur.mouse, reduced ? 1 : 1 - Math.exp(-dt / CURSOR.ringLag));
    c.dot.style.transform = `translate3d(${cur.mouse.x}px, ${cur.mouse.y}px, 0)`;
    c.ring.style.transform = `translate3d(${cur.ring.x.toFixed(2)}px, ${cur.ring.y.toFixed(2)}px, 0)`;
    if (s === "drag") {
      const charge = Math.min(1, Math.abs(omega) / RPM(HERO_HOLD.maxRpm));
      c.shape.style.transform = `scale(${(CURSOR.scale.drag - 0.14 * charge).toFixed(3)})`;
      const rpmNow = (Math.abs(omega) * 60) / (Math.PI * 2);
      c.label.textContent = `${rpmNow < 0.5 ? 0 : Math.round(rpmNow)} rpm`;
      c.tick.style.transform = `rotate(${(-angle * 180 / Math.PI).toFixed(1)}deg)`;
    }
  };

  // ── 매 프레임 (RoomTest apply 에서 판 자리를 정한 뒤): comp = 기울기 틀(회전 · 뒤집기 뺀 것), c = 판 가운데
  const _cf = new THREE.Vector3(), _v = new THREE.Vector3(), _cursor = new THREE.Vector2();
  h.update = (dt, { p, compQuat, centerPos, omega, angle }) => {
    if (!hero()) letGo();
    updateFlip(dt);
    comp.copy(compQuat); center.copy(centerPos);
    fxFrame.position.copy(center);
    fxFrame.quaternion.copy(comp);
    const fade = reduced ? 1 - smooth(p, 0, 0.001) : 1 - smooth(p, INK_HERO.fxOut[0], INK_HERO.fxOut[1]);
    fxFrame.visible = fade > 0.001;
    // 빛줄기 장축: 기울기 틀에서 본 시선의 수평 방향에 수직
    camera.getWorldDirection(_cf);
    _v.copy(_cf).negate().applyQuaternion(_qi.copy(comp).invert());
    let fx2 = _v.x, fz2 = _v.z;
    const l = Math.hypot(fx2, fz2) || 1; fx2 /= l; fz2 /= l;
    const major = Math.atan2(fx2, -fz2);   // (-fz, 0, fx) 의 각도
    let cursorPt = null;
    st.overDisc = false;
    if (pointer.ndc && fade > 0.001) {
      const pt = planeAt(pointer.ndc, _cursor);
      if (pt) {
        cursorPt = pt;
        const rr = Math.hypot(pt.x, pt.y);
        if (rr < RING.show) st.overRing = true; else if (rr > RING.hide) st.overRing = false;
      }
      st.overDisc = hero() && hitsDisc(pointer.ndc);
    } else st.overRing = false;
    fx.update(dt, { omega, angle, major, cursor: cursorPt, ring: (st.overRing || h.holding) && hero(), fade, time: performance.now() / 1000 });
    const sk = fx.streak();
    disc.uniforms.uStreak.value = sk.streak; disc.uniforms.uSharp.value = sk.sharp;
    updateTitle(dt, omega, p);
    updateCursor(dt, fade, omega, angle);
  };

  applyTheme();
  h.dispose = () => {
    themeMo.disconnect();
    stage.removeAttribute("data-home-stage");
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerdown", onDown);
    for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) stage.removeEventListener(t, endPress);
    stage.removeEventListener("pointerleave", onLeave);
    stage.removeEventListener("contextmenu", noMenu);
    stage.style.cursor = "";
    fxFrame.removeFromParent();
    fx.dispose();
  };
  return h;
}
