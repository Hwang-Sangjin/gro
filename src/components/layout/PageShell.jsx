"use client";
import { useRef } from "react";

import { useIntro } from "@/components/intro/intro-context";
import usePageLenis from "./usePageLenis";

/**
 * 모든 페이지의 공통 껍데기.
 * 페이지 루트는 반드시 100svh 로 고정되고 스크롤은 안쪽에서 일어난다 —
 * 루트가 길어지면 ::view-transition-old 의 inset(%) 정사각형 클립이 깨진다.
 */
export default function PageShell({ className = "", children }) {
  const wrapper = useRef();
  const content = useRef();

  const { done } = useIntro();

  usePageLenis({ wrapperRef: wrapper, contentRef: content, enabled: done });

  return (
    <div
      className={`page ${className}`.trim()}
      ref={wrapper}
      data-lenis-prevent
    >
      <div className="page-content" ref={content}>
        {children}
      </div>
    </div>
  );
}
