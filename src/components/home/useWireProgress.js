"use client";

import { useEffect } from "react";

const clamp01 = x => Math.max(0, Math.min(1, x));
const smootherstep = x => {
  const t = clamp01(x);
  return t * t * t * (t * (6 * t - 15) + 10);
};

// Layout offsets ignore the crate's rotate/scale transform. The scroll viewport
// is PageShell, not window; transient projected bounds must not change the theme.
function band(element, page) {
  if (!element || !page) return 0;
  let top = 0;
  for (let node = element; node && node !== page; node = node.offsetParent) {
    top += node.offsetTop;
  }
  return smootherstep(
    (page.clientHeight - (top - page.scrollTop)) /
    (page.clientHeight + element.offsetHeight),
  );
}

export default function useWireProgress({ inRef, outRef, enabled = true }) {
  useEffect(() => {
    const page = inRef.current?.closest(".page");
    const layer = page?.closest(".ct-page");
    if (!page || !layer) return;
    let raf = 0;
    let paused = false;
    const sync = () => {
      raf = 0;
      if (paused) return;
      const progress = enabled
        ? Math.round(clamp01(band(inRef.current, page) - band(outRef.current, page)) * 1000) / 1000
        : 0;
      const value = String(progress);
      // Color belongs to this page, never to the document or destination route.
      if (layer.style.getPropertyValue("--wire-t") !== value) {
        layer.style.setProperty("--wire-t", value);
      }
      layer.style.setProperty("--paper-header-y", `${-page.scrollTop}px`);
    };
    const schedule = () => { if (!paused && !raf) raf = requestAnimationFrame(sync); };
    const stop = () => { sync(); paused = true; cancelAnimationFrame(raf); raf = 0; };
    const resume = () => { paused = false; schedule(); };
    sync();
    paused = document.documentElement.dataset.crateTransition === "true";
    page.addEventListener("scroll", schedule, {passive:true});
    window.addEventListener("resize", schedule);
    window.addEventListener("crate:start", stop);
    window.addEventListener("crate:end", resume);
    const observer = new ResizeObserver(schedule);
    [page, page.querySelector(".page-content"), inRef.current, outRef.current].filter(Boolean).forEach(el => observer.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      page.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("crate:start", stop);
      window.removeEventListener("crate:end", resume);
      layer.style.removeProperty("--wire-t");
      layer.style.removeProperty("--paper-header-y");
    };
  }, [inRef, outRef, enabled]);
}
