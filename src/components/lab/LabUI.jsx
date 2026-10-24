"use client";
// Lab 페이지(Brick·Map) 공용 UI — 세리프 제목, 작은 라벨, 등장/퇴장(Reveal), "01 — Title" 머리
import { createContext, useContext } from "react";

export const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
export const LABEL = "text-[11px] font-medium uppercase tracking-[0.26em] text-(--ink)/60";

// 나타나기/사라지기: shown 이 true 가 되면 아래에서 올라오며 열리고(i 순서대로 차례로), false 가 되면 빠르게 닫힘
// 퇴장 = --dur-exit + ease-groove-exit (사이트 공통 규칙, lib/motion.js)
export const ShownCtx = createContext(true);
export function Reveal({ as: Tag = "div", i = 0, className = "", style, ...rest }) {
  const on = useContext(ShownCtx);
  return (
    <Tag {...rest} data-on={on} style={{ ...style, transitionDelay: on ? `${140 + i * 85}ms` : `${i * 22}ms` }}
      className={`translate-y-6 opacity-0 [clip-path:inset(100%_0_0_0)] transition-[opacity,transform,clip-path] duration-(--dur-exit) ease-groove-exit data-[on=true]:translate-y-0 data-[on=true]:opacity-100 data-[on=true]:[clip-path:inset(-10px)] data-[on=true]:duration-(--dur-enter) data-[on=true]:ease-groove motion-reduce:transition-none ${className}`} />
  );
}

// 뉴스 글의 "01 — Title" 머리: 굵은 줄(왼쪽에서 그어짐) + 청록 번호 + 세리프 제목
export function Heading({ n, title, note, action }) {
  const on = useContext(ShownCtx);
  return (
    <div className="mb-3">
      <span aria-hidden="true" data-on={on}
        className="block h-1 origin-left scale-x-0 bg-(--ink) transition-transform duration-(--dur-exit) ease-groove-exit data-[on=true]:scale-x-100 data-[on=true]:duration-[900ms] data-[on=true]:ease-groove motion-reduce:transition-none" />
      <Reveal i={0} className="flex items-baseline justify-between gap-3 pt-2.5">
        <p className="flex items-baseline gap-2.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-(--accent)">{n} —</span>
          <span className={`${SERIF} text-[1.15rem] leading-none`}>{title}</span>
        </p>
        {action ?? (note && <span className="text-[11px] tracking-[0.04em] text-(--ink)/50">{note}</span>)}
      </Reveal>
    </div>
  );
}

