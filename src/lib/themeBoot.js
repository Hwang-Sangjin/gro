// 서버(layout.js)와 브라우저가 같이 쓰는 테마 상수 — "use client" 가 없어야 layout 에서 문자열로 쓸 수 있음
export const THEME_KEY = "grooves-theme";
// layout.js <head> 에 그대로 들어가는 코드 (React 보다 먼저 실행 → 다크 모드여도 첫 화면이 깜빡이지 않음)
export const THEME_BOOT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
