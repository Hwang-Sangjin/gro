// 사이트 공통 모션 토큰 — CSS 쪽 값은 app/globals.css (@theme --ease-groove* / :root --dur-*)
// 두 곳을 항상 같이 고친다.
//
// 규칙
//  - 등장: ease-groove, 기본 0.85s. 여러 개면 위→아래, 왼→오른쪽 순서로 stagger (무작위 금지)
//  - 퇴장: 등장의 약 40% 길이 + ease-groove-exit. stagger 는 없거나 아주 짧게
//  - 페이지 안의 등장은 "페이지가 착지한 순간"(crate:land)부터 시작한다 → isPageSettled()

export const EASE = {
  groove: "cubic-bezier(0.22, 1, 0.36, 1)",
  grooveExit: "cubic-bezier(0.55, 0, 1, 0.45)",
};

// 초 단위 (GSAP 용)
export const DUR = {
  enter: 0.85,
  exit: 0.32,
};

// 카드 묶음 stagger (ms) — 같은 프레임에 보이기 시작한 것끼리 화면 순서대로
export const STAGGER = { step: 55, max: 8 };

// 인트로가 사라졌고, 페이지 전환이 없거나 이미 착지했는가
export function isPageSettled() {
  if (typeof document === "undefined") return false;
  if (document.querySelector(".preloader")) return false;
  const d = document.documentElement.dataset;
  return d.crateTransition !== "true" || d.crateLanded === "true";
}
