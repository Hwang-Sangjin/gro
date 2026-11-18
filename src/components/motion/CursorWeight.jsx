"use client";
// 커서에 가까운 글자일수록 굵기가 바뀌는 글 (가변 글꼴의 wght 축). 멀어지면 원래 굵기로
//  글자마다 span 으로 나누고(낱말은 줄바꿈 안 되게 묶음), 커서와 글자 가운데 사이 거리 → 목표 굵기 (radius 안에서 부드럽게)
//  지금 굵기는 목표를 천천히 따라감 (follow) · rest > near 면 반대로 커서 근처가 가늘어짐
//  마우스가 없는 기기 · 동작 줄이기 · active=false 에서는 rest 굵기 그대로 · 화면에 보일 때만 커서를 따라감
//  글꼴: Hahmlet 가변(100–900 이 한 파일). className 에 다른 글꼴을 주면 그 글꼴도 가변이어야 매끄러움
import "@fontsource-variable/hahmlet/wght.css";
import { useEffect, useRef } from "react";

export const CW_FONT = "font-['Hahmlet_Variable','Hahmlet',Georgia,serif]";

export default function CursorWeight({ text, rest = 300, near = 900, radius = 260, follow = 7, active = true, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !active) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = [...root.querySelectorAll("[data-cw]")];
    const now = chars.map(() => rest), want = chars.map(() => rest);
    let raf = 0, last = 0, on = false;
    const tick = (t) => {
      const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
      last = t;
      const a = 1 - Math.exp(-dt * follow);
      let moving = false;
      for (let i = 0; i < chars.length; i++) {
        const d = want[i] - now[i];
        if (Math.abs(d) < 0.5) { if (now[i] !== want[i]) { now[i] = want[i]; chars[i].style.setProperty("--cw", want[i].toFixed(0)); } continue; }
        now[i] += d * a;
        chars[i].style.setProperty("--cw", now[i].toFixed(1));
        moving = true;
      }
      raf = moving ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onMove = (e) => {
      for (let i = 0; i < chars.length; i++) {
        const r = chars[i].getBoundingClientRect();
        const k = Math.max(0, 1 - Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / radius);
        want[i] = rest + (near - rest) * k * k * (3 - 2 * k);
      }
      kick();
    };
    const calm = () => { want.fill(rest); kick(); };
    const toggle = (yes) => {
      if (yes === on) return;
      on = yes;
      if (on) { window.addEventListener("pointermove", onMove, { passive: true }); document.documentElement.addEventListener("pointerleave", calm); }
      else { window.removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("pointerleave", calm); calm(); }
    };
    const io = new IntersectionObserver(([e]) => toggle(e.isIntersecting));
    io.observe(root);
    return () => {
      io.disconnect(); toggle(false); cancelAnimationFrame(raf);
      chars.forEach((c) => c.style.setProperty("--cw", rest));
    };
  }, [rest, near, radius, follow, active]);
  const words = text.split(" ");
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((w, j) => (
        <span key={j} aria-hidden="true">
          {j > 0 && " "}
          <span className="inline-block whitespace-nowrap">
            {[...w].map((c, i) => (
              <span key={i} data-cw className="inline-block" style={{ "--cw": rest, fontWeight: "var(--cw)", fontVariationSettings: '"wght" var(--cw)' }}>{c}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
