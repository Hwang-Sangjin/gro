"use client";
// 지금 재생 중인 앨범 (헤더의 "Now spinning" 표시용). 앨범 상세의 YouTube 재생 상태가 씀.
import { useSyncExternalStore } from "react";

let current = null; // { slug, title, artist } | null
const listeners = new Set();

export function setNowSpinning(value) {
  if (current?.slug === value?.slug && !!current === !!value) return;
  current = value;
  listeners.forEach(fn => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useNowSpinning() {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
