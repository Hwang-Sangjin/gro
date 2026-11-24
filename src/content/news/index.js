// News 스토리 목록 — 글 하나 = 코드 파일 하나 (src/content/news/<slug>/Story.jsx)
// 새 글: 1) 여기에 한 줄 추가  2) stories.jsx 에 컴포넌트 연결  3) <slug>/Story.jsx 작성
// category: news(팝업·판매·행사 소식) | guide(Vinyl A to Z) | picks(추천)

export const CATEGORIES = [
  { key: "news", name: "News", desc: "Pop-ups, fairs, new pressings" },
  { key: "guide", name: "Vinyl A to Z", desc: "How records work, history, care" },
  { key: "picks", name: "Picks", desc: "Albums and songs for the moment" },
];
export const categoryName = (key) => CATEGORIES.find((c) => c.key === key)?.name ?? key;

// 목록·Next story·Home 모두 최신순 (배열에 넣는 순서와 상관없이 날짜로 정렬)
// draft: true = 테스트용. 목록 · Home · sitemap · Next story 에는 안 나오고, 주소(/news/<slug>)로만 열림 (검색엔진 noindex)
const ALL = [
  {
    slug: "how-a-turntable-works",
    draft: true,   // 2026-11-24 사용자: 아직 공개할 품질이 아님 → 테스트용
    category: "guide",
    title: "How a Turntable Works",
    dek: "플래터, 톤암, 카운터웨이트, 안티스케이팅 — Grooves의 턴테이블을 스크롤하며 부품 하나씩 살펴봐요. Vinyl A to Z 네 번째 이야기.",
    date: "2026-11-24",
    read: "5 min",
    cover: "a-to-z-04",
    homeArt: "care",
  },
  {
    slug: "ryuichi-sakamoto-1996",
    category: "news",
    title: "Ryuichi Sakamoto, 1996",
    dek: "피아노·첼로·바이올린으로 다시 연주한 사카모토의 영화음악, 1996이 30주년 2LP로 다시 나와요. 곡마다 흐르던 영화 장면과 그의 음악 인생까지.",
    date: "2026-11-22",
    read: "7 min",
    cover: "sakamoto-portrait",
    homeArt: "reissue",
  },
  {
    slug: "sse-pbr-fest",
    category: "news",
    title: "SSE PBR FEST",
    dek: "쎄 프로젝트 18년의 아카이브가 동대문 DDP에 한 달간 열려요. 팝업과 라이브·토크, 그리고 김현창의 바이닐 발매까지.",
    date: "2026-10-26",
    read: "6 min",
    cover: "sse-poster",
    homeArt: "press",
  },
  {
    slug: "daniel-caesar-korean-vinyl",
    category: "news",
    title: "Daniel Caesar, Pressed for Korea",
    dek: "세컨드트랙이 다니엘 시저의 세 장을 국내 정식 LP로 발매해요. 비싼 수입반 대신 이제 국내에서 — 판마다 먼저 들어볼 곡도 하나씩 골랐어요.",
    date: "2026-10-20",
    read: "4 min",
    cover: "caesar",
    homeArt: "press",
  },
  {
    slug: "the-vinyl-dictionary",
    category: "guide",
    title: "The Vinyl Dictionary",
    dek: "LP·EP·싱글, 7·10·12인치, 33⅓·45·78 — 레코드에 적힌 말들을 하나씩 정리했어요. Vinyl A to Z 두 번째 이야기.",
    date: "2026-10-17",
    read: "5 min",
    cover: "a-to-z-02",
    homeArt: "care",
  },
  {
    slug: "seoul-record-fair-2026",
    category: "news",
    title: "Seoul Record Fair 2026",
    dek: "열다섯 번째 서울레코드페어가 성수에서 열려요. 이틀 동안의 디깅, 페어 한정반, 그리고 여전히 바늘을 내리는 사람들.",
    date: "2026-10-18",
    read: "5 min",
    cover: "fair-poster",
    homeArt: "press",
  },
  {
    slug: "records-for-autumn",
    category: "picks",
    title: "Records for an Autumn Evening",
    dek: "해가 금빛으로 기울고 창문이 차가워지는 시간을 위한 일곱 장의 앨범, 그리고 앨범마다 한 곡.",
    date: "2026-10-10",
    read: "6 min",
    cover: "autumn-doodle",
    homeArt: "reissue",
  },
  {
    slug: "what-is-a-record",
    category: "guide",
    title: "What Is Vinyl?",
    dek: "소리가 홈이 되고, 홈이 다시 소리가 되기까지 — 레코드는 무엇으로 만들어지고 어떻게 음악을 담을까요. Vinyl A to Z 첫 번째 이야기.",
    date: "2026-10-06",
    read: "4 min",
    cover: "a-to-z-01",
    homeArt: "care",
  },
].sort((a, b) => b.date.localeCompare(a.date));
export const STORIES = ALL.filter((s) => !s.draft);

export const getStory = (slug) => ALL.find((s) => s.slug === slug) ?? null;
export const nextStory = (slug) => {
  const i = STORIES.findIndex((s) => s.slug === slug);
  return STORIES[(i + 1) % STORIES.length];
};
export const formatDate = (iso) =>
  new Date(`${iso}T12:00:00+09:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Seoul" });
