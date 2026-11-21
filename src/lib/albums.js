// src/lib/albums.js
// 서버 컴포넌트와 클라이언트 컴포넌트가 같이 쓰는 앨범 조회 함수

export const PAGE_SIZE = 24;

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/album-covers`;

export function coverUrl(path) {
  return path ? `${STORAGE_BASE}/${path}` : null;
}

// 무작위 순서용 seed — Digging 에 들어올 때마다 새로 만들어 순서가 매번 달라짐
export const newShuffleSeed = () => Math.random().toString(36).slice(2, 10);

// created_at · release_year: 카드 NEW IN 스티커와 캡션의 연도용 (2026-11-20)
const CARD_COLUMNS = "id, slug, title, artist_names, thumb_path, cover_color, created_at, release_year";

// 새로 들어온 판 (NEW IN): 들어온 지 NEW_DAYS 안 — 카드 스티커 · Digging 의 "New in" 탭 · Crate 표시가 같은 기준
export const NEW_DAYS = 45;
const newSince = () => new Date(Date.now() - NEW_DAYS * 864e5).toISOString();
// Digging 의 한 묶음과 같은 모양으로 돌려줌 (최근 들어온 순 · 더 받을 것 없음)
export async function fetchNewIn(supabase) {
  const { data, error } = await supabase.from("albums").select(CARD_COLUMNS)
    .eq("status", "published").gte("created_at", newSince()).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(60);
  if (error) throw error;
  return { items: data ?? [], hasMore: false, cursor: null, seed: null };
}
export async function countNewIn(supabase) {
  const { count, error } = await supabase.from("albums").select("id", { count: "exact", head: true }).eq("status", "published").gte("created_at", newSince());
  if (error) throw error;
  return count ?? 0;
}

// PAGE_SIZE + 1 개를 요청해서 "다음 페이지가 있는지" 를 판단한다
// - seed 가 있으면 무작위 순서(digging_shuffle, cursor = 몇 개째부터)
// - 그 함수가 아직 DB 에 없으면 예전 순서(digging_page, cursor = 날짜·id)로 자동 전환 → 결과의 seed 가 null
export async function fetchDiggingPage(
  supabase,
  { cursor = null, genreId = null, seed = null } = {},
) {
  if (seed) {
    const offset = typeof cursor === "number" ? cursor : 0;
    const { data, error } = await supabase.rpc("digging_shuffle", {
      p_seed: seed,
      p_offset: offset,
      p_genre_id: genreId == null ? null : String(genreId),
      p_limit: PAGE_SIZE + 1,
    }).select(CARD_COLUMNS);
    if (!error) {
      const hasMore = data.length > PAGE_SIZE;
      const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
      return { items, hasMore, cursor: offset + items.length, seed };
    }
    // PGRST202 = 함수가 없음 (SQL 을 아직 실행하지 않음) → 예전 순서로
    if (error.code !== "PGRST202") throw error;
  }

  const { data, error } = await supabase.rpc("digging_page", {
    p_cursor_date: cursor?.date ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_genre_id: genreId,
    p_limit: PAGE_SIZE + 1,
  });

  if (error) throw error;

  const hasMore = data.length > PAGE_SIZE;
  const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
  const last = items.at(-1);

  return {
    items,
    hasMore,
    cursor: last ? { date: last.sort_date, id: last.id } : null,
    seed: null,
  };
}
