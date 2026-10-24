"use client";
import { useEffect, useRef, useState } from "react";
import usePageSettled from "@/components/motion/usePageSettled";
import { STAGGER } from "@/lib/motion";

// 같은 프레임에 보이기 시작한 요소들을 모아 화면 순서(위→아래, 왼→오른쪽)대로 차례로 등장시킴
// → 무작위가 아니라 크레이트를 한 장씩 넘기는 리듬
let queue = [];
let frame = 0;
function flush() {
  frame = 0;
  const batch = queue;
  queue = [];
  const rows = batch.map((item) => ({ item, box: item.el.getBoundingClientRect() }));
  // 같은 줄로 볼 높이 차이: 카드 높이의 절반
  rows.sort((a, b) => {
    const tol = Math.min(a.box.height, b.box.height) / 2;
    return Math.abs(a.box.top - b.box.top) > tol ? a.box.top - b.box.top : a.box.left - b.box.left;
  });
  rows.forEach(({ item }, i) => item.start(Math.min(i, STAGGER.max) * STAGGER.step));
}
function enqueue(item) {
  queue.push(item);
  if (!frame) frame = requestAnimationFrame(flush);
  return () => { queue = queue.filter((q) => q !== item); };
}

// Observe PageShell's scrolling element; each mounted item reveals only once.
// stagger: true → 같이 보이기 시작한 카드끼리 화면 순서대로 (Digging·Collection 카드)
export default function useReveal({ ready = true, stagger = false } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const pageReady = usePageSettled();
  useEffect(() => {
    const element = ref.current;
    if (!element || !pageReady) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    }, { root: element.closest(".page"), threshold: .12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageReady]);
  useEffect(() => {
    if (!pageReady || !visible || !ready || revealed) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !stagger || !ref.current) { setRevealed(true); return; }
    let timer;
    const cancel = enqueue({ el: ref.current, start: (delay) => { timer = setTimeout(() => setRevealed(true), delay); } });
    return () => { cancel(); clearTimeout(timer); };
  }, [pageReady, visible, ready, stagger, revealed]);
  return [ref, revealed];
}
