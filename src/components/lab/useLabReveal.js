"use client";
import { useEffect, useState } from "react";
import { useIntro } from "@/components/intro/intro-context";

// Lab 페이지(Brick·Map) 등장/퇴장 신호
// - 인트로·페이지 전환(crate)이 끝난 뒤 true → 패널과 판이 나타남 (digging 의 useReveal 과 같은 기준)
// - 다른 페이지로 넘어가기 시작하면(crate:start) false → 패널이 먼저 사라짐
// - 전환이 취소돼 이 페이지가 남으면(crate:end) 다시 true
export default function useLabReveal() {
  const { done } = useIntro();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!done) return;
    let frame;
    const start = performance.now();
    const check = () => {
      if (performance.now() - start < 120 || document.querySelector(".preloader") ||
          document.documentElement.dataset.crateTransition === "true") frame = requestAnimationFrame(check);
      else setShown(true);
    };
    frame = requestAnimationFrame(check);
    const leave = () => setShown(false);
    const stay = () => setShown(true);
    window.addEventListener("crate:start", leave);
    window.addEventListener("crate:end", stay);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("crate:start", leave); window.removeEventListener("crate:end", stay); };
  }, [done]);
  return shown;
}
