// 효과음 설정 — Home(roomSound) 과 Crate(sfx) 가 같이 씀
//  기본은 켜짐 (2026-11-22 사용자 요청. 예전: 꺼짐). 사용자가 끄면 이 브라우저에 기억해 다음에도 꺼져 있음
//  브라우저는 사용자가 한 번 누르거나 키를 치기 전에는 소리를 막음 (자동 재생 규칙)
//   → "켜짐"이어도 실제 소리는 첫 누름 · 키 입력 뒤부터 남. 휠로 스크롤만 한 동안에는 나지 않음 (휠은 그 "누름"으로 치지 않음)
const KEY = "grooves:sound";

export function getSoundPref() {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setSoundPref(on) {
  try { if (on) localStorage.removeItem(KEY); else localStorage.setItem(KEY, "off"); } catch {}
}

const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"];
/**
 * 사용자가 누르거나 키를 칠 때마다 start() 를 부름 — start 가 true 를 돌려주면(소리를 켰으면) 그만 들음
 *  (소리 장치가 아직 준비되지 않았으면 false 를 돌려주고 다음 누름에 다시 시도)
 * 돌려주는 것: 듣기를 그만두는 함수
 */
export function untilGesture(start) {
  let done = false;
  const stop = () => { if (done) return; done = true; for (const t of GESTURES) window.removeEventListener(t, on, true); };
  const on = () => { let ok = false; try { ok = start() !== false; } catch {} if (ok) stop(); };
  for (const t of GESTURES) window.addEventListener(t, on, { capture: true, passive: true });
  return stop;
}
