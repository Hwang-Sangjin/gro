"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * 페이지 스크롤 컨테이너 전용 Lenis. root Lenis 와 별개 인스턴스다.
 * wrapper 에는 data-lenis-prevent 가 붙어 있어야 root 가 이 영역을 건드리지 않는다.
 */
// 옵션 (Expedia Route 66 의 스크롤을 참고, 2026-11-15)
//  - 스크롤이 움직인 그 순간(같은 프레임)에 wrapper 로 "page:lenis-scroll" 을 보냄 → 스크롤을 따라 그리는 것(WebGL 바탕 등)이
//    브라우저 scroll 이벤트를 기다렸다 다음 프레임에 그리지 않게 (글자와 바탕이 한 프레임씩 어긋나 떨려 보이던 원인)
//  - syncTouch: 터치 기기에서도 손가락 스크롤을 Lenis 가 부드럽게 따라감 (Route 66 과 같음). 끄는 영역은 data-lenis-prevent-touch
//  - scrollbar: 얇은 스크롤바 (끌어서 이동 · 스크롤하는 동안 진해짐 · 스크롤이 잠기면 숨음). 기본 스크롤바는 사이트 전체에서 숨김
export default function usePageLenis({
  wrapperRef,
  contentRef,
  enabled = true,
  syncTouch = false,
  scrollbar = false,
  wheelScale = null,
  driveRef = null,
}) {
  // driveRef: 주면 이 훅은 자기 requestAnimationFrame 을 돌리지 않고 driveRef.current = (time) => … 를 넘김
  //  → 페이지가 자기 그리기 루프 맨 앞에서 불러 스크롤과 3D 를 한 프레임에 (Route 66 의 GSAP ticker 하나와 같은 방식)
  // wheelScale(scroll) → 이 자리에서 휠 한 칸에 곱할 값 (1 = 그대로). 휠만, 터치는 손가락과 1:1 그대로
  //  Lenis 가 휠 값을 쓰기 직전(virtualScroll)에 곱함 → 늘 쓰던 lerp 경로 그대로라 끊기지 않음
  const scaleRef = useRef(wheelScale);
  scaleRef.current = wheelScale;
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;

    if (!wrapper || !content || !enabled) return;

    const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: syncTouch && touch,
      virtualScroll: (data) => {
        const k = data.event.type === "wheel" ? scaleRef.current?.(lenis.targetScroll, data.deltaY) : 1;
        if (k && k !== 1) data.deltaY *= k;
        return true;
      },
    });
    lenis.on("scroll", () => wrapper.dispatchEvent(new CustomEvent("page:lenis-scroll")));
    const bar = scrollbar ? createScrollbar(wrapper, lenis) : null;

    // 페이지 넘김 중 + 이 페이지가 잠금을 요청한 동안(예: Crate 보기)은 스크롤 멈춤
    let pageLocked = false, flipping = false;
    const sync = () => { if (pageLocked || flipping) lenis.stop(); else lenis.start(); };
    const stop = () => { flipping = true; sync(); };
    const start = () => { flipping = false; sync(); };
    const lock = () => { pageLocked = true; sync(); };
    const unlock = () => { pageLocked = false; sync(); };
    // 다른 컴포넌트가 이 페이지의 스크롤 위치를 바로 옮길 때 (예: Crate → Grid 전에 맨 앞 판이 보이게)
    // detail.smooth: 바로 옮기지 않고 부드럽게 이동 (Home 목차)
    //  detail.duration · detail.easing 로 바꿀 수 있음 (Home 섹션 자동 넘김) · detail.lock: 끝날 때까지 휠 · 터치 입력을 받지 않음
    const scrollTo = (e) => {
      const d = e.detail ?? {};
      lenis.scrollTo(d.top ?? 0, d.smooth ? { duration: d.duration ?? 1.6, ...(d.easing ? { easing: d.easing } : {}), ...(d.lock ? { lock: true } : {}), force: true } : { immediate: true, force: true });
    };
    window.addEventListener("crate:start", stop);
    window.addEventListener("crate:end", start);
    wrapper.addEventListener("page:lock", lock);
    wrapper.addEventListener("page:unlock", unlock);
    wrapper.addEventListener("page:scrollto", scrollTo);
    if (document.documentElement.dataset.crateTransition === "true") stop();

    // 스크롤 속도 → 부드럽게 → wrapper 의 --scroll-v (0…±12). 앨범 그리드가 크레이트 속 판처럼 젖혀지는 데 씀 (Digging.module.css)
    // 차분하게: 천천히 읽으며 내리는 속도(4 이하)는 무시, 휠 한 칸마다 튀는 값은 한 번 걸러서, 멈출 때 출렁이지 않게(임계 감쇠)
    // 움직임 줄이기면 0 고정
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPRING = { max: 12, dead: 4, stiff: 60, bounce: 0 };
    let sv = 0, svVel = 0, svIn = 0, svLast = performance.now(), svShown = 0;
    const springScroll = (now) => {
      const dt = Math.min(0.05, (now - svLast) / 1000); svLast = now;
      if (reduced) return;
      const raw = lenis.velocity || 0;
      svIn += (raw - svIn) * (1 - Math.exp(-dt * 6));                       // 휠 한 칸마다 튀는 속도를 고르게
      const mag = Math.max(0, Math.abs(svIn) - SPRING.dead);
      const target = Math.sign(svIn) * Math.min(SPRING.max, mag * 0.6);
      const damp = 2 * Math.sqrt(SPRING.stiff) * (1 - SPRING.bounce * 0.75);
      svVel += (SPRING.stiff * (target - sv) - damp * svVel) * dt;
      sv += svVel * dt;
      if (Math.abs(sv) < 0.002 && Math.abs(svVel) < 0.01 && target === 0) { sv = 0; svVel = 0; }
      const shown = Math.round(sv * 1000) / 1000;
      if (shown !== svShown) { svShown = shown; wrapper.style.setProperty("--scroll-v", String(shown)); }
    };

    let raf = 0;
    const step = (time) => { lenis.raf(time); springScroll(time); };
    if (driveRef) driveRef.current = step;
    else {
      const tick = (time) => { step(time); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (driveRef?.current === step) driveRef.current = null;
      window.removeEventListener("crate:start", stop);
      window.removeEventListener("crate:end", start);
      wrapper.removeEventListener("page:lock", lock);
      wrapper.removeEventListener("page:unlock", unlock);
      wrapper.removeEventListener("page:scrollto", scrollTo);
      bar?.dispose();
      lenis.destroy();
      wrapper.style.removeProperty("--scroll-v");
    };
  }, [wrapperRef, contentRef, enabled, syncTouch, scrollbar, driveRef]);
}

// 얇은 스크롤바: 화면 오른쪽 끝의 손잡이. 길이 = 화면 / 전체, 위치 = 스크롤 비율. 끌면 그 자리로 바로
//  평소엔 옅게, 스크롤·끄는 동안 진하게, 스크롤이 잠겨 있으면(lenis.stop) 숨김. 색은 바탕에 따라 뒤집힘(difference)
const BAR = { width: 3, gap: 6, min: 40, idle: 0.28, active: 0.75 };
function createScrollbar(wrapper, lenis) {
  const host = wrapper.parentElement;
  const track = document.createElement("div");
  const handle = document.createElement("div");
  track.setAttribute("aria-hidden", "true");
  Object.assign(track.style, {
    position: "absolute", top: "0", right: `${BAR.gap}px`, bottom: "0", width: `${BAR.width + 10}px`, zIndex: "60",
    mixBlendMode: "difference", transition: "opacity .4s", opacity: "0", pointerEvents: "none",
  });
  Object.assign(handle.style, {
    position: "absolute", top: "0", right: "0", width: `${BAR.width}px`, borderRadius: `${BAR.width}px`,
    background: "#fff", opacity: String(BAR.idle), transition: "opacity .3s, width .2s", cursor: "grab", pointerEvents: "auto",
  });
  track.appendChild(handle);
  host.appendChild(track);
  let h = BAR.min, room = 0, y = 0, drag = null, idleT = 0;
  const layout = () => {
    const vh = wrapper.clientHeight, total = lenis.limit + vh;
    const hidden = lenis.limit <= 1 || lenis.isStopped;
    track.style.opacity = hidden ? "0" : "1";
    handle.style.pointerEvents = hidden ? "none" : "auto";
    if (lenis.limit <= 1) return;
    h = Math.max(BAR.min, (vh * vh) / total);
    room = vh - h;
    handle.style.height = `${h}px`;
    place();
  };
  const place = () => {
    y = lenis.limit > 0 ? (lenis.scroll / lenis.limit) * room : 0;
    handle.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
  };
  const wake = () => {
    handle.style.opacity = String(BAR.active);
    clearTimeout(idleT);
    idleT = setTimeout(() => { if (!drag) handle.style.opacity = String(BAR.idle); }, 700);
  };
  const onScroll = () => { place(); wake(); };
  const down = (e) => {
    e.preventDefault();
    drag = { y0: e.clientY, from: y };
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = "grabbing"; handle.style.width = `${BAR.width + 2}px`;
    wake();
  };
  const move = (e) => {
    if (!drag || lenis.isStopped) return;
    const ny = Math.min(room, Math.max(0, drag.from + e.clientY - drag.y0));
    lenis.scrollTo((ny / Math.max(1, room)) * lenis.limit, { immediate: true });
  };
  const up = () => { if (!drag) return; drag = null; handle.style.cursor = "grab"; handle.style.width = `${BAR.width}px`; wake(); };
  const offScroll = lenis.on("scroll", onScroll);
  handle.addEventListener("pointerdown", down);
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up);
  handle.addEventListener("pointercancel", up);
  // 길이가 바뀔 때 (내용이 늘거나 창 크기) + 잠금이 풀리고 걸릴 때
  const ro = new ResizeObserver(layout);
  ro.observe(wrapper); if (wrapper.firstElementChild) ro.observe(wrapper.firstElementChild);
  const relayout = () => requestAnimationFrame(layout);
  wrapper.addEventListener("page:lock", relayout);
  wrapper.addEventListener("page:unlock", relayout);
  window.addEventListener("crate:start", relayout);
  window.addEventListener("crate:end", relayout);
  layout();
  return {
    dispose() {
      clearTimeout(idleT);
      offScroll?.();
      ro.disconnect();
      wrapper.removeEventListener("page:lock", relayout);
      wrapper.removeEventListener("page:unlock", relayout);
      window.removeEventListener("crate:start", relayout);
      window.removeEventListener("crate:end", relayout);
      track.remove();
    },
  };
}
