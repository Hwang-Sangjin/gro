"use client";
import { useRef } from "react";

import { useIntro } from "@/components/intro/intro-context";
import usePageLenis from "./usePageLenis";
import SiteFooter from "./SiteFooter";

/** Fixed viewport shell; each page keeps its own scroll position while flipping.
 *  footer: 맨 아래 공통 Footer (로그인처럼 한 화면짜리 페이지는 false) */
export default function PageShell({ className = "", footer = true, children }) {
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
        {footer && <>
          <div aria-hidden="true" className="h-[clamp(4rem,8vw,7rem)] shrink-0" />
          <SiteFooter />
        </>}
      </div>
    </div>
  );
}
