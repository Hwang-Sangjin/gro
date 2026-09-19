"use client";
import { useEffect, useState } from "react";

// 화면에 실제로 보이는 동안만 true. Canvas frameloop 을 끄는 데 쓴다
export default function useInViewport(ref, rootMargin = "200px") {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return visible;
}
