"use client";
// 지도 위 커서 — 턴테이블 톤암. 바늘 끝이 마우스 위치
// - 평소: 암이 살짝 들려 있음 (판 위가 아님)
// - 판(마커) 위: 암이 내려앉고 바늘 끝에 작은 홈 링이 퍼짐
// - 지도를 끄는 중: 암이 더 들림
// 마우스(정밀 포인터)에서만. 터치·펜은 원래 커서 그대로
import { useEffect, useRef, useState } from "react";

const TIP = { x: 10.4, y: 79.6 };        // viewBox 안 바늘 끝 (암이 내려앉았을 때) — 이 점이 마우스 자리
const PIVOT = "78px 18px";               // 암이 도는 축 (viewBox 와 같은 px 크기로 그림)

export default function Tonearm({ host }) {
  const el = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const h = host.current, me = el.current;
    if (!h || !me || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setOn(true);
    let raf = 0, x = 0, y = 0;
    const draw = () => { raf = 0; me.style.transform = `translate3d(${x - TIP.x}px, ${y - TIP.y}px, 0)`; };
    const move = (e) => {
      const r = h.getBoundingClientRect();
      x = e.clientX - r.left; y = e.clientY - r.top;
      me.dataset.show = String(!e.target.closest?.(".maplibregl-ctrl"));   // 확대 버튼·출처 위에선 원래 커서
      me.dataset.down = String(Boolean(e.target.closest?.("[data-place]")));
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const leave = () => { me.dataset.show = "false"; };
    const press = (e) => { if (!e.target.closest?.("[data-place], .maplibregl-ctrl")) me.dataset.lift = "true"; };
    const release = () => { me.dataset.lift = "false"; };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerleave", leave);
    h.addEventListener("pointerdown", press);
    addEventListener("pointerup", release);
    return () => {
      cancelAnimationFrame(raf);
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerleave", leave);
      h.removeEventListener("pointerdown", press);
      removeEventListener("pointerup", release);
    };
  }, [host]);

  return (
    <div ref={el} aria-hidden="true" data-show="false" data-down="false" data-lift="false"
      className={`group/arm pointer-events-none absolute left-0 top-0 z-[6] size-[96px] opacity-0 transition-opacity duration-200 data-[show=true]:opacity-100 ${on ? "" : "hidden"}`}>
      {/* 바늘 끝 링 — 판 위에서 내려앉을 때 퍼짐 */}
      <span className="absolute size-7 rounded-full border border-(--accent) opacity-0 group-data-[down=true]/arm:animate-[needle-cue_1.4s_ease-out_infinite]"
        style={{ left: TIP.x, top: TIP.y, transform: "translate(-50%,-50%)" }} />
      <svg viewBox="0 0 96 96" width="96" height="96" className="absolute inset-0 overflow-visible drop-shadow-[0_6px_6px_rgba(0,0,0,.35)]">
        {/* 축 받침 (판 마커와 같은 검은 원판 + 홈) */}
        <circle cx="78" cy="18" r="13" fill="#141113" />
        <circle cx="78" cy="18" r="10" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth=".8" />
        <circle cx="78" cy="18" r="7.2" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth=".8" />
        {/* 움직이는 암 — 축을 중심으로 돎 */}
        <g className="origin-[78px_18px] rotate-[-9deg] transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-data-[down=true]/arm:rotate-0 group-data-[lift=true]/arm:rotate-[-16deg]"
          style={{ transformOrigin: PIVOT }}>
          {/* 평형추 (축 뒤쪽) */}
          <g transform="rotate(-45 78 18)">
            <rect x="84" y="13" width="11" height="10" rx="2.4" fill="#2a222a" stroke="#f4e7cd" strokeWidth="1.2" />
            <line x1="88" y1="13.6" x2="88" y2="22.4" stroke="rgba(244,231,205,.35)" strokeWidth=".8" />
            <line x1="91" y1="13.6" x2="91" y2="22.4" stroke="rgba(244,231,205,.35)" strokeWidth=".8" />
          </g>
          {/* 암 — 잉크 테두리 위 크림 관 + 빛 줄 */}
          <path d="M78 18 L29 66" stroke="#2a222a" strokeWidth="6" strokeLinecap="round" />
          <path d="M78 18 L29 66" stroke="#f4e7cd" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M75.5 19.2 L31 62.8" stroke="rgba(255,255,255,.75)" strokeWidth=".9" strokeLinecap="round" />
          {/* 헤드셸 + 카트리지 (청록) + 손잡이 */}
          <g transform="rotate(24 20 74)">
            <path d="M27 66 L35 60" stroke="#2a222a" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M27 66 L35 60" stroke="#f4e7cd" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="9" y="65" width="20" height="12" rx="2.6" fill="#f4e7cd" stroke="#2a222a" strokeWidth="1.6" />
            <rect x="11.5" y="71" width="12" height="7.5" rx="1.4" fill="var(--accent,#2d6a6a)" stroke="#2a222a" strokeWidth="1.2" />
            <line x1="15" y1="78.5" x2="13.5" y2="83" stroke="#2a222a" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </g>
        {/* 축 위 뚜껑 */}
        <circle cx="78" cy="18" r="5" fill="#f4e7cd" stroke="#2a222a" strokeWidth="1.4" />
        <circle cx="78" cy="18" r="1.7" fill="#2a222a" />
      </svg>
    </div>
  );
}
