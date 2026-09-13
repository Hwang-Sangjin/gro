"use client";

import { useEffect } from "react";

const COLORS = ["#2f5a72", "#8a4b3c", "#5c4a70"];

export default function DiscColor() {
  useEffect(() => {
    const root = document.documentElement;
    let last = -1;

    const pick = () => {
      let i = Math.floor(Math.random() * COLORS.length);
      if (i === last) i = (i + 1) % COLORS.length;
      last = i;
      root.style.setProperty("--disc-label", COLORS[i]);
    };

    pick();

    const onDown = (e) => {
      if (e.target.closest("a[href]")) pick();
    };

    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  return null;
}
