"use client";
import { useEffect, useState } from "react";
import { useIntro } from "@/components/intro/intro-context";
import { isPageSettled } from "@/lib/motion";

// 등장 애니메이션 시작 신호: 인트로가 끝나고, 페이지 전환(crate)이 없거나 착지했을 때 true
//  - 크레이트가 "턱" 하고 서는 순간(crate:land)에 바로 true → 전환이 다 끝날 때까지 빈 화면으로 기다리지 않음
//  - minDelay: 마운트 직후 레이아웃이 자리 잡을 시간
export default function usePageSettled({ minDelay = 120 } = {}) {
  const { done } = useIntro();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!done) return;
    let frame;
    const start = performance.now();
    const check = () => {
      if (performance.now() - start < minDelay || !isPageSettled()) frame = requestAnimationFrame(check);
      else setSettled(true);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [done, minDelay]);
  return settled;
}
