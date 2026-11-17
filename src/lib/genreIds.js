// 장르 slug ↔︎ id (genres 테이블). 한 번만 불러 둠 — Digging·Collection 공용
//  장르는 거의 안 바뀜 → 하루 동안은 저장해 둔 것을 그대로 씀 (dataCache.js)
import { cached } from "./dataCache";

export function getGenreIds(supabase) {
  return cached("genre-ids", async () => {
    const { data, error } = await supabase.from("genres").select("id, slug");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((g) => [g.slug, g.id]));
  }, { fresh: 24 * 60 * 60_000, keep: 7 * 24 * 60 * 60_000, valid: (ids) => ids && Object.keys(ids).length > 0 });
}
