"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * 페이지 스크롤 컨테이너 전용 Lenis. root Lenis 와 별개 인스턴스다.
 * wrapper 에는 data-lenis-prevent 가 붙어 있어야 root 가 이 영역을 건드리지 않는다.
 */
export default function usePageLenis({
  wrapperRef,
  contentRef,
  enabled = true,
}) {
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;

    if (!wrapper || !content || !enabled) return;

    const lenis = new Lenis({
      wrapper,
      content,
      lerp: 0.1,
      smoothWheel: true,
    });

    // 페이지 넘김 중 + 이 페이지가 잠금을 요청한 동안(예: Crate 보기)은 스크롤 멈춤
    let pageLocked = false, flipping = false;
    const sync = () => { if (pageLocked || flipping) lenis.stop(); else lenis.start(); };
    const stop = () => { flipping = true; sync(); };
    const start = () => { flipping = false; sync(); };
    const lock = () => { pageLocked = true; sync(); };
    const unlock = () => { pageLocked = false; sync(); };
    // 다른 컴포넌트가 이 페이지의 스크롤 위치를 바로 옮길 때 (예: Crate → Grid 전에 맨 앞 판이 보이게)
    const scrollTo = (e) => { lenis.scrollTo(e.detail?.top ?? 0, { immediate: true, force: true }); };
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
    const tick = (time) => {
      lenis.raf(time);
      springScroll(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("crate:start", stop);
      window.removeEventListener("crate:end", start);
      wrapper.removeEventListener("page:lock", lock);
      wrapper.removeEventListener("page:unlock", unlock);
      wrapper.removeEventListener("page:scrollto", scrollTo);
      lenis.destroy();
      wrapper.style.removeProperty("--scroll-v");
    };
  }, [wrapperRef, contentRef, enabled]);
}
