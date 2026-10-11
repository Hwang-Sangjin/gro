"use client";
// 사이트 전체 커스텀 커서 — Home 스테이지 커서와 같은 모양 (작은 링 + 점)
// - 링크·버튼 위: 링이 커지고 점은 숨김
// - 앨범 카드 위: 링이 채워지며 "View"
// - 글자 입력칸 위·Home 스테이지 안(자체 커서가 있음)·유튜브 화면 위: 숨김 (원래 커서)
// - 색은 가리킨 곳의 글자색을 따라감 → 크림/브라운/앨범 색 어떤 배경에서도 보임
// - 마우스(정밀 포인터)에서만, 움직임 줄이기 설정이면 링이 지연 없이 따라감
import { useEffect, useRef } from "react";

const SCALE = { idle: 0.32, link: 0.55, view: 0.8 };
const LAG = 0.12;   // 링이 따라오는 지연(초). 점은 즉시

export default function SiteCursor() {
  const ring = useRef(null), shape = useRef(null), label = useRef(null), dot = useRef(null);

  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    let x = -100, y = -100, rx = -100, ry = -100, visible = false, state = "", color = "", raf = 0, last = performance.now();
    let target = null;

    const stateFor = (el) => {
      if (!el || el.closest("[data-home-stage]")) return "hidden";                    // Home 은 스테이지 커서
      if (el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], iframe")) return "hidden";
      if (el.closest("a[data-album-slug]")) return "view";
      if (el.closest("a, button, summary, label, [role='button'], [role='tab'], [role='menuitem']")) return "link";
      return "idle";
    };
    const setState = (next) => {
      if (next === state) return;
      state = next;
      const show = next !== "hidden";
      root.classList.toggle("site-cursor", show);                  // 원래 커서 숨김 (globals.css)
      ring.current.style.opacity = show ? "1" : "0";
      dot.current.style.opacity = next === "idle" ? "1" : "0";
      shape.current.style.transform = `scale(${SCALE[next] ?? SCALE.idle})`;
      const filled = next === "view";
      shape.current.style.backgroundColor = filled ? "color-mix(in srgb, var(--cream) 72%, transparent)" : "transparent";
      shape.current.style.backdropFilter = filled ? "blur(6px)" : "none";
      label.current.style.opacity = filled ? "1" : "0";
    };
    const paint = (el) => {
      // 가리킨 곳의 글자색 (앨범 페이지면 앨범 색 테마, 크림/브라운이면 잉크)
      const c = el ? getComputedStyle(el).color : "";
      if (c && c !== color) {
        color = c;
        shape.current.style.borderColor = c;
        label.current.style.color = c;
        dot.current.firstElementChild.style.backgroundColor = c;
      }
    };

    const move = (e) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      if (!visible) { rx = x; ry = y; visible = true; }
      const el = e.target instanceof Element ? e.target : null;
      if (el !== target) { target = el; setState(stateFor(el)); paint(el); }
    };
    const hide = () => { visible = false; target = null; setState("hidden"); };
    const out = (e) => { if (!e.relatedTarget) hide(); };          // 창 밖·iframe 으로 나감

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const k = reduced ? 1 : 1 - Math.exp(-dt / LAG);
      rx += (x - rx) * k; ry += (y - ry) * k;
      dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.current.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", out);
    addEventListener("blur", hide);
    // 페이지가 바뀌어 같은 자리에 다른 요소가 오면 다시 판정
    const recheck = () => { const el = document.elementFromPoint(x, y); target = el; if (visible) { setState(stateFor(el)); paint(el); } };
    const observer = new MutationObserver(() => { cancelAnimationFrame(recheck.raf); recheck.raf = requestAnimationFrame(recheck); });
    observer.observe(document.body, { childList: true, subtree: true });
    const themeObserver = new MutationObserver(() => { color = ""; requestAnimationFrame(recheck); });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(recheck.raf);
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", out);
      removeEventListener("blur", hide);
      observer.disconnect(); themeObserver.disconnect();
      root.classList.remove("site-cursor");
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
      <div ref={ring} className="absolute left-0 top-0 opacity-0 transition-opacity duration-300">
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div ref={shape} style={{ transform: "scale(0.32)" }}
            className="relative h-[88px] w-[88px] rounded-full border border-current transition-[transform,background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" />
          <span ref={label} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium uppercase tracking-[0.14em] opacity-0 transition-opacity duration-300">View</span>
        </div>
      </div>
      <div ref={dot} className="absolute left-0 top-0 opacity-0 transition-opacity duration-200">
        <div className="h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
  );
}
