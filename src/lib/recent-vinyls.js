// Home uses upload order; Digging keeps its release-date cursor ordering.
import { cached } from "./dataCache";

export const RECENT_VINYL_LIMIT = 7;

// Home 용: 저장해 둔 목록을 바로 쓰고, 5분이 지났으면 뒤에서 새로 받아 둠 (dataCache.js)
//  (키 v2: 방 턴테이블 음악용 youtube_playlist_id 를 같이 받음 — 예전 키에 저장된 목록에는 없어서 새 키로)
export const getRecentVinyls = (supabase) => cached("recent-vinyls-v2", () => fetchRecentVinyls(supabase), { valid: (rows) => rows?.length > 0 });

export async function fetchRecentVinyls(supabase, signal) {
  let query = supabase
    .from("albums")
    .select("id, slug, title, artist_names, cover_path, thumb_path, cover_color, youtube_playlist_id, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_VINYL_LIMIT);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
