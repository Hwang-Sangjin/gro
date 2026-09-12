"use client";

import { useEffect, useState } from "react";

// 연출 타이밍(고정)과 리소스 대기(가변)를 분리하기 위한 훅.
// 나중에 3D 모델 로딩(useProgress 등)을 여기에 조건으로 추가하면 된다.
export function useAppReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tasks = [];

    if (document.fonts?.ready) tasks.push(document.fonts.ready);

    if (document.readyState !== "complete") {
      tasks.push(
        new Promise((resolve) =>
          window.addEventListener("load", resolve, { once: true }),
        ),
      );
    }

    Promise.all(tasks).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
