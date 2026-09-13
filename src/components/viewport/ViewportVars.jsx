"use client";

import { useEffect } from "react";

export default function ViewportVars() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const side = Math.min(w, h);

      const xPct = ((w - side) / 2 / w) * 100;
      const yPct = ((h - side) / 2 / h) * 100;

      root.style.setProperty("--sq-x", `${xPct}%`);
      root.style.setProperty("--sq-y", `${yPct}%`);

      console.log("inset %:", xPct.toFixed(2), yPct.toFixed(2));
    };

    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(root);

    return () => ro.disconnect();
  }, []);

  return null;
}
