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
// 한 장소가 여러 종류일 수 있음: kind = 1번(대표, 마커 색), also = 2번부터 (고른 순서)
export const kindsOf = (p) => [p.kind, ...(p.also ?? [])];
export const hasKind = (p, key) => p.kind === key || (p.also ?? []).includes(key);

// 자주 쓰는 동네 (입력 도우미 — 이 밖의 동네도 자유롭게 입력 가능)
export const AREAS = ["성수", "합정", "망원", "연남", "홍대", "을지로", "종로", "한남", "이태원", "신촌", "강남", "압구정", "문래", "부산"];

// NFKC: 한글 음절을 자모로 쪼개지 않음 (NFKD 면 "김밥레코즈" 가 빈 문자열이 됨)
// 동네 이름 로마자 (지도에서 동네를 고르면 Monoton 으로 크게 뜸). 없으면 한글만
export const AREA_ROMAN = {
  성수: "Seongsu", 합정: "Hapjeong", 망원: "Mangwon", 연남: "Yeonnam", 홍대: "Hongdae", 을지로: "Euljiro", 종로: "Jongno",
  한남: "Hannam", 이태원: "Itaewon", 신촌: "Sinchon", 강남: "Gangnam", 압구정: "Apgujeong", 문래: "Mullae", 부산: "Busan",
  해방촌: "Haebangchon", 대흥: "Daeheung", 신당: "Sindang", 뚝섬: "Ttukseom", 인사동: "Insadong", 충정로: "Chungjeongno",
  황학동: "Hwanghak", 남영: "Namyeong", 삼각지: "Samgakji", 회현: "Hoehyeon", 동묘: "Dongmyo",
};

export const slugify = (s = "") =>
  s.normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");

// 인스타 아이디만 남김: "@abc", "instagram.com/abc/" → "abc"
export const cleanInstagram = (v = "") =>
  v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");

// 길찾기 링크 (네이버지도 — 관리자가 넣은 장소 링크가 없을 때 주소·이름으로 검색)
export const naverSearch = (p) => `https://map.naver.com/p/search/${encodeURIComponent(p.address || p.name)}`;

// 행사 기간 안인가 (오늘 기준, 날짜만 비교)
export function isOnNow(p, today = new Date()) {
  if (!hasKind(p, "event")) return false;
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(today);   // 서울 날짜 (YYYY-MM-DD)
  return (!p.starts_on || p.starts_on <= d) && (!p.ends_on || d <= p.ends_on);
}

// 지도에서 읽는 칸 (공개 장소만 — RLS)
export const PLACE_FIELDS = "id, slug, name, name_en, kind, also, area, address, lat, lng, hours, instagram, website, map_url, note, genres, starts_on, ends_on, news_slug";

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

// ── 지금 영업 중? ──
// 서울 시간 기준. 오늘 줄의 시간(자정 넘김 포함)과 어제 줄의 자정 넘긴 시간을 같이 봄. 휴게시간은 빼고, "휴무" 는 닫힘
// → { state: "open" | "break" | "closed" | null, until?: "21:00", back?: "18:00" }   null = 영업시간을 못 읽음
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const RANGE = /(\d{1,2}:\d{2})\s*[–~-]\s*(\d{1,2}:\d{2})/;
function rangeOf(text) {
  if (/휴무/.test(text)) return { closed: true };
  const brk = text.match(/휴게[^\d]*(\d{1,2}:\d{2})\s*[–~-]\s*(\d{1,2}:\d{2})/);
  const main = text.replace(/\(?휴게[^)]*\)?/, "").match(RANGE);
  if (!main) return null;
  return { start: toMin(main[1]), end: toMin(main[2]), endText: main[2], brk: brk && { start: toMin(brk[1]), end: toMin(brk[2]), endText: brk[2] } };
}
function seoulClock(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  return (Number(parts.hour) % 24) * 60 + Number(parts.minute);
}
export function openState(p, now = new Date()) {
  if (p.kind === "event" && !isOnNow(p, now)) return { state: "closed" };
  if (!p.hours) return { state: null };
  const day = seoulDay(now), min = seoulClock(now);
  const rows = parseHours(p.hours, day);
  const dayless = rows.length && rows.every((r) => !r.days);          // "10:00–18:00" 처럼 요일 없이 = 매일
  const today = dayless ? rows[0] : rows.find((r) => r.today);
  const yesterday = dayless ? rows[0] : parseHours(p.hours, (day + 6) % 7).find((r) => r.today);
  // 어제 시작해서 자정을 넘긴 영업 (예: 20:30–01:30 의 새벽)
  const y = yesterday && rangeOf(yesterday.text);
  if (y && !y.closed && y.end < y.start && min < y.end) return { state: "open", until: y.endText };
  if (!today) return { state: rows.some((r) => r.days) ? "closed" : null };
  const r = rangeOf(today.text);
  if (!r) return { state: null };
  if (r.closed) return { state: "closed" };
  const inRange = r.end > r.start ? min >= r.start && min < r.end : min >= r.start;
  if (!inRange) return { state: "closed" };
  if (r.brk && min >= r.brk.start && min < r.brk.end) return { state: "break", back: r.brk.endText };
  return { state: "open", until: r.endText };
}
