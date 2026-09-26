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
    let frame;
    const start = performance.now();
    const check = () => {
      // Native page snapshots can otherwise cover the whole reveal animation.
      const transitioning = (document.getAnimations?.() || []).some(animation =>
        animation.playState !== "finished" && animation.playState !== "idle" &&
        (/^(page-in|page-out|disc-out)$/.test(animation.animationName || "") ||
          String(animation.effect?.pseudoElement || "").includes("view-transition")));
      if (performance.now() - start < 120 || transitioning || document.querySelector(".preloader") ||
          document.documentElement.dataset.albumTransition === "true") {
        frame = requestAnimationFrame(check);
      } else setPageReady(true);
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
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
