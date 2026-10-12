"use client";
// News 스토리 공용 — 스크롤 진행도
// 페이지는 window 가 아니라 PageShell 의 .page 가 스크롤함 → 그 요소의 scroll 을 들음
// 진행도는 리렌더 없이 CSS 변수(--p)로 넣음: style={{ transform: "scale(calc(1 + var(--p) * 3))" }}
// JS(3D 등)에서 쓰려면 onProgress 콜백
import { useEffect } from "react";

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const scrollerOf = (el) => el?.closest(".page") ?? null;

// mode "scene": 키 큰 구역이 화면에 붙어 있는 동안 0→1 (위가 화면 위에 닿을 때 0, 바닥이 화면 바닥에 닿을 때 1)
// mode "pass" : 요소가 화면 아래로 들어와서 위로 나갈 때까지 0→1
export function useScrollProgress(ref, { mode = "scene", onProgress, cssVar = "--p" } = {}) {
  useEffect(() => {
    const el = ref.current;
    const scroller = scrollerOf(el);
    if (!el || !scroller) return;
    let raf = 0, last = -1;
    const measure = () => {
      raf = 0;
      const box = el.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      const vh = scroller.clientHeight;
      const top = box.top - view.top;
      const p = mode === "scene"
        ? clamp01(-top / Math.max(1, box.height - vh))
        : clamp01((vh - top) / (vh + box.height));
      if (Math.abs(p - last) < 0.0005) return;
      last = p;
      el.style.setProperty(cssVar, p.toFixed(4));
      onProgress?.(p);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(measure); };
    scroller.addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    measure();
    return () => { scroller.removeEventListener("scroll", queue); removeEventListener("resize", queue); cancelAnimationFrame(raf); };
  }, [ref, mode, onProgress, cssVar]);
}

// 구간 진행도: p 가 a→b 를 지날 때 0→1 (CSS 에서 쓰려면 아래 seg() 문자열)
export const range = (p, a, b) => clamp01((p - a) / (b - a));
// CSS calc 용: var(--p) 의 a~b 구간을 0~1 로 (clamp)
export const seg = (a, b, v = "--p") => `clamp(0, (var(${v}) - ${a}) / ${b - a}, 1)`;
