// 장르 slug ↔︎ id (genres 테이블). 한 번만 불러 둠 — Digging·Collection 공용
let promise = null;
export function getGenreIds(supabase) {
  if (!promise) {
    promise = supabase.from("genres").select("id, slug").then(({ data, error }) => {
      if (error) { promise = null; throw error; }
      return Object.fromEntries((data ?? []).map((g) => [g.slug, g.id]));
    });
  }
  return promise;
}
