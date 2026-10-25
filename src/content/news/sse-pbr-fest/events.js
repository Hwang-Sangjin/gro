// SSE PBR FEST — 프로그램 데이터. 새 프로그램이 공개되면 EVENTS 에 한 줄씩 추가하면 달력·상세·필터가 알아서 맞춰짐
// d: 날짜(YYYY-MM-DD) · t: 시작 시각들 · h: 제목 · p: 출연/진행 · k: 종류(live | talk | workshop | signing) · v: 바이닐 발매 공연이면 1
// 출처: 쎄 프로젝트 공식 안내(2026-10-26 확인). 포스터 5색에 종류를 하나씩 배정

export const TYPES = {
  live: { n: "Live", a: "LIVE", c: "#29b6b9" },
  talk: { n: "Talk", a: "TALK", c: "#f4b5c8" },
  workshop: { n: "Workshop", a: "WORK", c: "#f5dc92" },
  signing: { n: "Signing", a: "SIGN", c: "#bba2cc" },
};

export const EVENTS = [
  { d: "2026-10-31", t: ["19:30"], h: "프롬 LIVE & TALK", p: "진행 · 음악평론가 김윤하", k: ["live", "talk"] },
  { d: "2026-11-01", t: ["17:00"], h: "범프투소울 LIVE", p: "", k: ["live"] },
  { d: "2026-11-04", t: ["16:00"], h: "제시카 혜전 리 · 심볼 만들기 WORKSHOP", p: "", k: ["workshop"] },
  { d: "2026-11-06", t: ["20:00"], h: "ACOUSTIC LIVE", p: "사가, 소실, 김초원", k: ["live"] },
  { d: "2026-11-07", t: ["15:00", "18:00"], h: "김현창 바이닐 발매 LIVE & SIGNING", p: "", k: ["live", "signing"], v: 1 },
  { d: "2026-11-08", t: ["16:00"], h: "Dime.Mov & TwoBeats · Beat performance live", p: "Lo-g, Seongjae.Oh, Slosolo, Loopland, Vies Kim, Kurtncxll, kr₩808, Nogymx (Beats and Loops)", k: ["live"] },
  { d: "2026-11-09", t: ["16:00"], h: "크래커프린트 · 실크 스크린 WORKSHOP", p: "", k: ["workshop"] },
  { d: "2026-11-10", t: ["19:30"], h: "사공 SIGNING EVENT", p: "", k: ["signing"] },
  { d: "2026-11-12", t: ["19:30"], h: "전진희 SIGNING EVENT", p: "", k: ["signing"] },
  { d: "2026-11-13", t: ["20:00"], h: "권한결 & archie · 즉흥 라이브 퍼포먼스 “손바닥 뒤집기”", p: "", k: ["live"] },
  { d: "2026-11-14", t: ["18:00"], h: "《동화 EP》 발매 기념 LIVE & TALK", p: "지넥스 with 진보, 이제, slowly, 릴썸머(JP) · 진행 음악평론가 게다", k: ["live", "talk"] },
  { d: "2026-11-15", t: ["17:00"], h: "신온유와 김강 LIVE", p: "", k: ["live"] },
  { d: "2026-11-17", t: ["18:30"], h: "밍기뉴 · 기타코드 배우기 WORKSHOP", p: "", k: ["workshop"] },
  { d: "2026-11-18", t: ["19:00"], h: "알레프 SIGNING EVENT", p: "", k: ["signing"] },
  { d: "2026-11-20", t: ["20:00"], h: "진동욱 LIVE & SIGNING", p: "", k: ["live", "signing"] },
  { d: "2026-11-21", t: ["18:00"], h: "여유와 설빈, 최제니 LIVE", p: "", k: ["live"] },
  { d: "2026-11-22", t: ["17:00"], h: "피달소 TALK", p: "진행 · 음악평론가 조혜림", k: ["talk"] },
];

export const OPEN_AT = Date.parse("2026-10-31T10:00:00+09:00");
export const CLOSE_AT = Date.parse("2026-11-23T19:00:00+09:00");
export const RUN_FROM = "2026-10-31";
export const RUN_TO = "2026-11-23";

// 달력은 월요일 시작, 10/26 부터 5주
export const CAL_DAYS = Array.from({ length: 35 }, (_, i) => {
  const dt = new Date(Date.UTC(2026, 9, 26 + i));
  const m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  return { m, d, key: `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
});
export const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const weekdayOf = (key) => WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
export const typesOn = (key) => {
  const out = [];
  EVENTS.forEach((e) => { if (e.d === key) e.k.forEach((t) => { if (!out.includes(t)) out.push(t); }); });
  return out;
};
export const EVENT_DAYS = [...new Set(EVENTS.map((e) => e.d))];
