"use client";
// 소리 켜기 · 끄기 (Crate 무대의 작은 글자 버튼) — 판을 넘기는 소리
//  처음에는 꺼져 있음. 켜는 순간(누르는 동작)에만 오디오가 만들어짐 (CrateProvider) · 페이지를 옮겨도 그대로
import { useCrate } from "@/components/crate/CrateProvider";

export default function SoundToggle({ className = "" }) {
  const crate = useCrate();
  if (!crate) return null;
  const on = crate.sound;
  return (
    <button type="button" aria-pressed={on} onClick={() => crate.toggleSound()}
      className={`pointer-events-auto relative inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.24em] transition-opacity duration-300 before:absolute before:-inset-x-2 before:-inset-y-1 before:content-[''] hover:opacity-100 ${on ? "opacity-100" : "opacity-60"} ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.2h2.3L8 3.5v9L4.8 9.8H2.5z" fill={on ? "currentColor" : "none"} />
        {on ? <path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.3 3.9a5.8 5.8 0 0 1 0 8.2" /> : <path d="M10.6 6.2l3 3.6M13.6 6.2l-3 3.6" />}
      </svg>
      {/* 좁은 화면에서는 그림만 (보기 스위치와 한 줄에 들어가게) */}
      <span className="max-[819px]:sr-only">Sound {on ? "on" : "off"}</span>
    </button>
  );
}
