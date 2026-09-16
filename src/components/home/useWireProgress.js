"use client";

import { useEffect } from "react";

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

const smootherstep = (x) => {
  const t = clamp01(x);
  return t * t * t * (t * (6 * t - 15) + 10);
};

// veil 상단이 화면 하단에 닿는 순간 0, 완전히 지나간 순간 1
const band = (el) => {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const h = window.innerHeight;
  return smootherstep((h - r.top) / (h + r.height));
};

/**
 * --wire-t (0=크림 1=잉크) 를 :root 에 매 프레임 기록한다.
 * Lenis 든 네이티브 스크롤이든 getBoundingClientRect 기준이라 동일하게 동작.
 * 값이 바뀔 때만 써서 스타일 무효화를 최소화한다.
 */
export default function useWireProgress({ inRef, outRef, enabled = true }) {
  useEffect(() => {
    const root = document.documentElement;

    if (!enabled) {
      root.style.setProperty("--wire-t", "0");
      return;
    }

    let raf = 0;
    let last = -1;

    const tick = () => {
      const next =
        Math.round(clamp01(band(inRef.current) - band(outRef.current)) * 1000) /
        1000;

      if (next !== last) {
        last = next;
        root.style.setProperty("--wire-t", String(next));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      // 홈을 벗어나면 제거 → 다른 페이지와 navbar 는 자동으로 크림/잉크 기본값
      root.style.removeProperty("--wire-t");
    };
  }, [inRef, outRef, enabled]);
}
