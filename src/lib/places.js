// 바이닐 장소 (Lab · Map) — 관리자 화면과 지도가 같이 쓰는 정의
// 테이블: supabase/migrations/20261024_places.sql

// 종류 — 지도 마커 라벨 색(color)도 여기서 정함 (지도 바탕 위에서 잘 보이는 사이트 톤)
export const KINDS = [
  { key: "shop", label: "Shops", one: "Record shop", ko: "레코드숍", color: "#2d6a6a" },
  { key: "bar", label: "Bars", one: "LP bar · café", ko: "LP 바·카페", color: "#a63c2a" },
  { key: "listening", label: "Listening", one: "Listening room", ko: "리스닝룸", color: "#6f8fb6" },
  { key: "event", label: "Events", one: "Fair · pop-up", ko: "페어·팝업", color: "#c9952c" },
];
export const kindOf = (key) => KINDS.find((k) => k.key === key) ?? KINDS[0];

// 자주 쓰는 동네 (입력 도우미 — 이 밖의 동네도 자유롭게 입력 가능)
export const AREAS = ["성수", "합정", "망원", "연남", "홍대", "을지로", "종로", "한남", "이태원", "신촌", "강남", "압구정", "문래", "부산"];

// NFKC: 한글 음절을 자모로 쪼개지 않음 (NFKD 면 "김밥레코즈" 가 빈 문자열이 됨)
export const slugify = (s = "") =>
  s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");

// 인스타 아이디만 남김: "@abc", "instagram.com/abc/" → "abc"
export const cleanInstagram = (v = "") =>
  v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");

// 길찾기 링크 (앱 키 없이 열리는 공개 링크)
export const kakaoDirections = (p) => `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
export const naverSearch = (p) => `https://map.naver.com/p/search/${encodeURIComponent(p.address || p.name)}`;

// 행사 기간 안인가 (오늘 기준, 날짜만 비교)
export function isOnNow(p, today = new Date()) {
  if (p.kind !== "event") return false;
  const d = today.toISOString().slice(0, 10);
  return (!p.starts_on || p.starts_on <= d) && (!p.ends_on || d <= p.ends_on);
}

// 지도에서 읽는 칸 (공개 장소만 — RLS)
export const PLACE_FIELDS = "id, slug, name, name_en, kind, area, address, lat, lng, hours, instagram, website, map_url, note, genres, starts_on, ends_on, news_slug";

// ── 영업시간 ──
// 관리자 입력 규칙: "월–목 14:00–21:00 (휴게 17:30–18:00) · 금 14:00–21:00 · 토 14:00–20:00 · 일 14:00–18:00 · 월 휴무"
// 구간은 " · " 로, 요일 범위는 "월–목", 여러 요일은 "화·수·일", 묶음은 매일·평일·주말
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
function daysOf(token) {
  if (token === "매일") return [0, 1, 2, 3, 4, 5, 6];
  if (token === "평일") return [1, 2, 3, 4, 5];
  if (token === "주말") return [0, 6];
  const range = token.match(/^([일월화수목금토])[–-]([일월화수목금토])$/);
  if (range) {
    const out = [];
    for (let d = DAYS.indexOf(range[1]); ; d = (d + 1) % 7) { out.push(d); if (d === DAYS.indexOf(range[2])) break; }
    return out;
  }
  const list = token.split("·").map((t) => DAYS.indexOf(t.trim()));
  return list.every((d) => d >= 0) ? list : null;
}
// 오늘 요일 (서울 기준)
export const seoulDay = (now = new Date()) =>
  DAYS.indexOf(new Intl.DateTimeFormat("ko-KR", { weekday: "short", timeZone: "Asia/Seoul" }).format(now));

// → [{ days: "월–목", text: "14:00–21:00 (휴게 17:30–18:00)", today: true, closed: false }, …]
// 요일을 못 읽은 구간은 days 없이 text 만 (그대로 보여줌)
export function parseHours(hours = "", today = seoulDay()) {
  if (!hours) return [];
  return hours.split(/\s+·\s+/).map((part) => {
    const m = part.match(/^(\S+)\s+(.+)$/);
    const days = m ? daysOf(m[1]) : null;
    if (!days) return { days: null, text: part, today: false, closed: false };
    return { days: m[1], text: m[2], today: days.includes(today), closed: /휴무/.test(m[2]) };
  });
}

// 행사가 끝났는가 (끝난 페어·팝업은 지도에서 뺌)
export function isOver(p, today = new Date()) {
  if (p.kind !== "event" || !p.ends_on) return false;
  return p.ends_on < new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(today);
}
