"use client";
// 크림(light) ↔︎ 브라운(dark) 테마
// - <html data-theme="dark"> 하나로 전환 (globals.css 가 --cream/--ink 를 맞바꿈)
// - 고른 값은 이 브라우저에 기억 → layout.js 의 인라인 스크립트가 첫 화면부터 적용 (깜빡임 없음)
// - 바꿀 때는 버튼 자리에서 원이 퍼지며 새 색으로 덮임 (View Transition, 지원 안 하면 바로 바뀜)
import { useSyncExternalStore } from "react";

import { THEME_KEY } from "./themeBoot";

export const getTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}

// origin: 원이 퍼져 나갈 중심 (보통 누른 버튼)
export function setTheme(next, origin) {
  const root = document.documentElement;
  const apply = () => {
    if (next === "dark") root.dataset.theme = "dark"; else delete root.dataset.theme;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced) { apply(); return; }
  const box = origin?.getBoundingClientRect();
  const x = box ? box.left + box.width / 2 : innerWidth - 40, y = box ? box.top + box.height / 2 : 40;
  root.style.setProperty("--theme-x", `${x}px`);
  root.style.setProperty("--theme-y", `${y}px`);
  root.style.setProperty("--theme-r", `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`);
  root.classList.add("theme-switching");
  const t = document.startViewTransition(apply);
  t.finished.finally(() => root.classList.remove("theme-switching"));
}

export const toggleTheme = (origin) => setTheme(getTheme() === "dark" ? "light" : "dark", origin);
