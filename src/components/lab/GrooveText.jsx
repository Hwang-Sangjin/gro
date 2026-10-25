"use client";
// 줄무늬(Groove) 제목 — 레코드 홈처럼 글자 안이 평행선으로 채워진 디스플레이 글씨
// - 영문: Monoton (Google Fonts, Vernon Adams) — 글자 자체가 여러 줄
// - 한글: Black Han Sans 에 SVG 필터(feMorphology erode)로 글자 안쪽을 깎아 같은 줄무늬를 만듦
//   선 간격은 실제 글자 크기에 맞춰 계산 (크기가 바뀌어도 줄 굵기 비율 그대로)
// 색은 글자색(currentColor)을 그대로 씀 → 테마가 바뀌면 같이 바뀜
//
// <GrooveText as="h1" className="text-[56px]">Dig the city.</GrooveText>
import { useId, useLayoutEffect, useRef, useState } from "react";
import "@fontsource/monoton/400.css";
import "@fontsource/black-han-sans/400.css";

export const GROOVE = "font-['Monoton','Black_Han_Sans',sans-serif] font-normal tracking-[0.01em]";
const HANGUL = /([ᄀ-ᇿ㄰-㆏가-힯]+(?:\s+[ᄀ-ᇿ㄰-㆏가-힯]+)*)/;

export default function GrooveText({ as: Tag = "span", children, className = "", bands = 3, ...rest }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef(null);
  const [size, setSize] = useState(48);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize(parseFloat(getComputedStyle(el).fontSize) || 48);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const text = typeof children === "string" ? children : String(children ?? "");
  const parts = text.split(HANGUL);
  const step = Math.max(0.6, size * 0.021);   // 선 하나·틈 하나의 굵기 (Black Han Sans 획 굵기 기준)
  const erodes = Array.from({ length: bands * 2 }, (_, i) => +(step * (i + 1)).toFixed(2));

  return (
    <Tag ref={ref} className={`${GROOVE} ${className}`} {...rest}>
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id={`groove-${id}`} x="-5%" y="-10%" width="110%" height="120%" colorInterpolationFilters="sRGB">
          {erodes.map((r, i) => <feMorphology key={i} in="SourceAlpha" operator="erode" radius={r} result={`e${i + 1}`} />)}
          {/* 바깥 선(원본 − e1), 안쪽 선(e2 − e3)…, 맨 안 심(e_last) */}
          {Array.from({ length: bands }, (_, b) => (
            <feComposite key={b} in={b === 0 ? "SourceAlpha" : `e${b * 2}`} in2={`e${b * 2 + 1}`} operator="out" result={`r${b}`} />
          ))}
          <feMerge result="lines">
            {Array.from({ length: bands }, (_, b) => <feMergeNode key={b} in={`r${b}`} />)}
            <feMergeNode in={`e${bands * 2}`} />
          </feMerge>
          <feComposite in="SourceGraphic" in2="lines" operator="in" />
        </filter>
      </svg>
      {parts.map((part, i) => (i % 2 === 1
        ? <span key={i} style={{ filter: `url(#groove-${id})` }}>{part}</span>
        : part))}
    </Tag>
  );
}
