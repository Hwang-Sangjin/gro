"use client";
// Home(3D 방) 준비 신호 — 첫 로딩 화면(프리로더)이 이걸 기다렸다가 걷힘
//  방 GLB · 구운 빛(KTX2) · 바깥 배경 그림을 받고, GPU 에 올리고, 셰이더를 미리 컴파일한 뒤 markHomeReady()
//  예전에는 프리로더가 판 모델만 기다려서, 이 무거운 일이 Hero 가 보이는 동안 돌아 화면이 버벅였음

let resolve;
export const homeReady = new Promise((r) => { resolve = r; });
export const markHomeReady = () => {
  if (typeof window !== "undefined" && window.__homeReadyAt == null) window.__homeReadyAt = Math.round(performance.now());   // 확인용: 몇 ms 에 준비됐는지
  resolve?.();
};

// 방 화면을 쓰는 주소 (첫 로딩을 이 주소에서 시작했을 때만 기다림)
export const isHomeRoute = (path) => path === "/" || path === "/lab/room-test";
