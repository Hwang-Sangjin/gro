// src/lib/albums.js
// 서버 컴포넌트와 클라이언트 컴포넌트가 같이 쓰는 앨범 조회 함수

export const PAGE_SIZE = 24;

const STORAGE_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/album-covers`;

export function coverUrl(path) {
  return path ? `${STORAGE_BASE}/${path}` : null;
}

// PAGE_SIZE + 1 개를 요청해서 "다음 페이지가 있는지" 를 판단한다
export async function fetchDiggingPage(
  supabase,
  { cursor = null, genreId = null } = {},
) {
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
  };
}
