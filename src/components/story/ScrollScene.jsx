"use client";
// 스크롤하는 동안 화면에 붙어서 장면이 바뀌는 구역
// <ScrollScene height="300svh"> … var(--p) 로 움직이는 내용 … </ScrollScene>
// 바깥이 height 만큼 키가 크고, 안쪽(화면 크기)이 sticky. --p: 0 → 1
import { useRef } from "react";
import { useScrollProgress } from "./scroll";

export default function ScrollScene({ height = "300svh", className = "", innerClassName = "", onProgress, children, ...rest }) {
  const ref = useRef(null);
  useScrollProgress(ref, { mode: "scene", onProgress });
  return (
    <section ref={ref} {...rest} className={`relative ${className}`} style={{ height, "--p": 0 }}>
      <div className={`sticky top-0 h-svh overflow-hidden ${innerClassName}`}>{children}</div>
    </section>
  );
}
