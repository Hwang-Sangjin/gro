"use client";
import { useEffect, useState } from "react";
import usePageSettled from "@/components/motion/usePageSettled";

// Lab 페이지(Brick·Map) 등장/퇴장 신호
// - 인트로가 끝나고 페이지 전환(crate)이 착지하면 true → 패널과 판이 나타남 (digging 의 useReveal 과 같은 기준)
// - 다른 페이지로 넘어가기 시작하면(crate:start) false → 패널이 먼저 사라짐 (퇴장: --dur-exit + ease-groove-exit)
// - 전환이 취소돼 이 페이지가 남으면(crate:end) 다시 true
export default function useLabReveal() {
  const settled = usePageSettled();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!settled) return;
    setShown(true);
    const leave = () => setShown(false);
    const stay = () => setShown(true);
    window.addEventListener("crate:start", leave);
    window.addEventListener("crate:end", stay);
    return () => { window.removeEventListener("crate:start", leave); window.removeEventListener("crate:end", stay); };
  }, [settled]);
  return shown;
}
