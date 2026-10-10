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

    const stop = () => lenis.stop();
    const start = () => lenis.start();
    window.addEventListener("crate:start", stop);
    window.addEventListener("crate:end", start);
    // 페이지 안에서 스크롤을 잠깐 잠글 때 (Digging 크레이트 보기 등)
    window.addEventListener("page-scroll:lock", stop);
    window.addEventListener("page-scroll:unlock", start);
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
      window.removeEventListener("page-scroll:lock", stop);
      window.removeEventListener("page-scroll:unlock", start);
      lenis.destroy();
    };
  }, [wrapperRef, contentRef, enabled]);
}
