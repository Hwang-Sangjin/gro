"use client";
import { useRef } from "react";

import { useIntro } from "@/components/intro/intro-context";
import usePageLenis from "./usePageLenis";

/** Fixed viewport shell; each page keeps its own scroll position while flipping. */
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
