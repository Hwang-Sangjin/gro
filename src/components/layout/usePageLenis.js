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

    let raf = 0;
    const tick = (time) => {
      lenis.raf(time);
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
    };
  }, [wrapperRef, contentRef, enabled]);
}
