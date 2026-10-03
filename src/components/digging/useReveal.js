"use client";
import { useEffect, useRef, useState } from "react";
import { useIntro } from "@/components/intro/intro-context";

// Observe PageShell's scrolling element; each mounted item reveals only once.
export default function useReveal({ ready = true, randomDelay = false } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { done } = useIntro();
  const [pageReady, setPageReady] = useState(false);
  useEffect(() => {
    if (!done) return;
    // 전환 중에는 매 프레임 polling 대신 crate:end 이벤트를 기다린다.
    let frame = 0;
    let cancelled = false;
    const start = performance.now();
    const onEnd = () => { if (!cancelled) frame = requestAnimationFrame(check); };
    const check = () => {
      if (cancelled) return;
      if (document.documentElement.dataset.crateTransition === "true") {
        window.addEventListener("crate:end", onEnd, { once: true });
        return;
      }
      if (performance.now() - start < 120 || document.querySelector(".preloader")) {
        frame = requestAnimationFrame(check);
        return;
      }
      setPageReady(true);
    };
    frame = requestAnimationFrame(check);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("crate:end", onEnd);
    };
  }, [done]);
  useEffect(() => {
    const element = ref.current;
    if (!element || !done) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    }, { root: element.closest(".page"), threshold: .12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [done]);
  useEffect(() => {
    if (!pageReady || !visible || !ready || revealed) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced || !randomDelay ? 0 : 100 + Math.random() * 200;
    const timer = setTimeout(() => setRevealed(true), delay);
    return () => clearTimeout(timer);
  }, [pageReady, visible, ready, randomDelay, revealed]);
  return [ref, revealed];
}
