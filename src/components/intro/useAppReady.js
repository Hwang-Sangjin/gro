"use client";

import { useEffect, useState } from "react";
import { homeReady, isHomeRoute } from "@/lib/homeReady";

// 연출 타이밍(고정)과 리소스 대기(가변)를 분리하기 위한 훅.
// 글꼴·페이지 로드 + 3D 판 모델(vinyl.glb) + (Home 이면) 3D 방 준비를 기다림.
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

    // 3D 판 모델: Footer 가 거의 모든 페이지에 있어서 인트로 동안 미리 받음 (느린 망에서도 인트로가 4초 이상 붙잡히지 않게)
    tasks.push(Promise.race([
      import("@/lib/vinylModel").then((m) => m.preloadVinyl()).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]));

    // Home(3D 방): 방 에셋을 받고 GPU 에 올리고 셰이더까지 데운 뒤 걷힘 → Hero 가 보이는 동안 버벅이지 않음
    //  너무 느린 망에서는 12초까지만 기다리고 나머지는 Hero 뒤에서 이어서 받음
    if (isHomeRoute(location.pathname)) {
      tasks.push(Promise.race([homeReady, new Promise((resolve) => setTimeout(resolve, 12000))]));
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
