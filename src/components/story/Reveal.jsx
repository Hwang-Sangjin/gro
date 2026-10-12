"use client";
// 화면에 들어오면 한 번 나타남 (아래에서 떠오르며). as 로 태그 지정, delay(ms)
// RiseText: 줄 단위로 마스크 아래에서 올라오는 제목 (사이트 공통 제목 등장과 같은 느낌)
import { createElement, useEffect, useRef, useState } from "react";
import { useIntro } from "@/components/intro/intro-context";
import { scrollerOf } from "./scroll";

export function useInView(ref, { once = true, threshold = 0.15 } = {}) {
  const [seen, setSeen] = useState(false);
  const { done } = useIntro();
  useEffect(() => {
    const el = ref.current;
    if (!el || !done) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); }
      else if (!once) setSeen(false);
    }, { root: scrollerOf(el), threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once, threshold, done]);
  return seen;
}

export default function Reveal({ as = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);
  const seen = useInView(ref);
  return createElement(as, {
    ref, ...rest, "data-seen": seen,
    style: { transitionDelay: seen ? `${delay}ms` : "0ms", ...rest.style },
    className: `transition-[opacity,translate] duration-[1000ms] ease-[cubic-bezier(.22,1,.36,1)] data-[seen=false]:translate-y-8 data-[seen=false]:opacity-0 motion-reduce:transition-none motion-reduce:data-[seen=false]:translate-y-0 ${className}`,
  }, children);
}

// lines: ["What is", "a record?"] — 줄마다 차례로
export function RiseText({ as = "h2", lines, className = "", lineClassName = "", delay = 0, step = 110 }) {
  const ref = useRef(null);
  const seen = useInView(ref);
  return createElement(as, { ref, className }, lines.map((line, i) => (
    <span key={i} className={`block overflow-y-clip pb-[.08em] ${lineClassName}`}>
      <span data-seen={seen} style={{ transitionDelay: seen ? `${delay + i * step}ms` : "0ms" }}
        className="block transition-transform duration-[1100ms] ease-[cubic-bezier(.22,1,.36,1)] data-[seen=false]:translate-y-[110%] motion-reduce:transition-none motion-reduce:data-[seen=false]:translate-y-0">
        {line}
      </span>
    </span>
  )));
}
