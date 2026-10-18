// News 스토리 목록 — 글 하나 = 코드 파일 하나 (src/content/news/<slug>/Story.jsx)
// 새 글: 1) 여기에 한 줄 추가  2) stories.jsx 에 컴포넌트 연결  3) <slug>/Story.jsx 작성
// category: news(팝업·판매·행사 소식) | guide(Vinyl A to Z) | picks(추천)

export const CATEGORIES = [
  { key: "news", name: "News", desc: "Pop-ups, fairs, new pressings" },
  { key: "guide", name: "Vinyl A to Z", desc: "How records work, history, care" },
  { key: "picks", name: "Picks", desc: "Albums and songs for the moment" },
];
export const categoryName = (key) => CATEGORIES.find((c) => c.key === key)?.name ?? key;

export const STORIES = [
  {
    slug: "the-vinyl-dictionary",
    category: "guide",
    title: "The Vinyl Dictionary",
    dek: "LP, EP or single; 7, 10 or 12 inches; 33⅓, 45 or 78 — the words printed on every record, sorted out. Vinyl A to Z, chapter two.",
    date: "2026-10-17",
    read: "5 min",
    cover: "a-to-z-02",
    homeArt: "care",
  },
  {
    slug: "seoul-record-fair-2026",
    category: "news",
    title: "Seoul Record Fair 2026",
    dek: "The 15th fair lands in Seongsu — two days of crates, fair-only pressings and the people who still love the needle drop.",
    date: "2026-10-13",
    read: "3 min",
    cover: "fair-poster",
    homeArt: "press",
  },
  {
    slug: "records-for-autumn",
    category: "picks",
    title: "Records for an Autumn Evening",
    dek: "Seven albums — and the one song from each — for the hour when the light turns gold and the windows go cold.",
    date: "2026-10-10",
    read: "6 min",
    cover: "autumn",
    homeArt: "reissue",
  },
  {
    slug: "what-is-a-record",
    category: "guide",
    title: "What Is Vinyl?",
    dek: "Sound becomes a groove, and a groove becomes sound — what a record is made of, and how it holds music. Vinyl A to Z, chapter one.",
    date: "2026-10-06",
    read: "4 min",
    cover: "a-to-z-01",
    homeArt: "care",
  },
];

export const getStory = (slug) => STORIES.find((s) => s.slug === slug) ?? null;
export const nextStory = (slug) => {
  const i = STORIES.findIndex((s) => s.slug === slug);
  return STORIES[(i + 1) % STORIES.length];
};
export const formatDate = (iso) =>
  new Date(`${iso}T12:00:00+09:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Seoul" });
