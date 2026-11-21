// 장르별 앨범 수 (공개된 앨범만) — { all: 39, pop: 7, … }. Digging·Home 공용. 실패하면 null (숫자 없이 보여 줌)
//  저장해 둔 숫자를 바로 보여 주고 10분이 지났으면 뒤에서 새로 받아 둠 (dataCache.js)
import { cached } from "./dataCache";
import { getGenreIds } from "./genreIds";

export function getGenreCounts(supabase) {
  return cached("genre-counts", (async () => {
    const [rows, total, ids] = await Promise.all([
      supabase.from("album_genres").select("genre_id, albums!inner(status)").eq("albums.status", "published").limit(10000),
      supabase.from("albums").select("id", { count: "exact", head: true }).eq("status", "published"),
      getGenreIds(supabase),
    ]);
    if (rows.error) throw rows.error;
    const slugById = Object.fromEntries(Object.entries(ids).map(([slug, id]) => [id, slug]));
    const out = { all: total.count ?? null };
    for (const r of rows.data ?? []) { const slug = slugById[r.genre_id]; if (slug) out[slug] = (out[slug] ?? 0) + 1; }
    return out;
  }), { fresh: 10 * 60_000, valid: (c) => c?.all != null }).catch(() => null);
}

// 판이 한 장도 없는 장르는 탭에서 뺌 (눌러도 빈 화면뿐). 숫자를 아직 못 받았으면 전부 보여 줌.
//  "All" 과 지금 고른 장르는 0이어도 남김 (주소로 바로 들어온 경우)
export const hasRecords = (counts, slug, selected = null) =>
  !counts || slug == null || slug === selected || (counts[slug] ?? 0) > 0;
