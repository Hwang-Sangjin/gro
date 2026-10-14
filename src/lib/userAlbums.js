"use client";
// 내 판 (소장 owned / 위시리스트 wishlist) — user_albums 테이블. RLS 로 본인 행만 보임.
import { authClient } from "@/lib/useAuthUser";
import { getGenreIds } from "@/lib/genreIds";

export const SHELVES = ["owned", "wishlist"];

// Digging 카드와 같은 모양으로 돌려줌 (id, slug, title, artist_names, thumb_path, cover_color) + genres: [장르 slug]
export async function fetchShelves() {
  const supabase = authClient();
  const [{ data, error }, genreIds] = await Promise.all([
    supabase.from("user_albums")
      .select("kind, created_at, albums!inner(id, slug, title, artist_names, thumb_path, cover_color, status, album_genres(genre_id))")
      .eq("albums.status", "published")
      .order("created_at", { ascending: false }),
    getGenreIds(supabase).catch(() => ({})),
  ]);
  if (error) throw error;
  const slugById = Object.fromEntries(Object.entries(genreIds).map(([slug, id]) => [String(id), slug]));
  const shelves = { owned: [], wishlist: [] };
  for (const row of data ?? []) {
    const { album_genres: links = [], ...album } = row.albums;
    shelves[row.kind]?.push({ ...album, genres: links.map(l => slugById[String(l.genre_id)]).filter(Boolean) });
  }
  return shelves;
}

// 이 앨범이 내 어느 칸에 있는지: "owned" | "wishlist" | null
export async function fetchAlbumKind(albumId) {
  const { data, error } = await authClient().from("user_albums")
    .select("kind").eq("album_id", albumId).maybeSingle();
  if (error) throw error;
  return data?.kind ?? null;
}

// kind 가 null 이면 빼기, 아니면 그 칸으로 넣기/옮기기
export async function setAlbumKind(userId, albumId, kind) {
  const table = authClient().from("user_albums");
  const { error } = kind
    ? await table.upsert({ user_id: userId, album_id: albumId, kind, created_at: new Date().toISOString() }, { onConflict: "user_id,album_id" })
    : await table.delete().eq("album_id", albumId);
  if (error) throw error;
}

// 이 판을 소장한 사람 수 (함수가 아직 DB에 없으면 null → 화면에 안 보임)
export async function fetchOwnerCount(albumId) {
  const { data, error } = await authClient().rpc("album_owner_count", { p_album_id: String(albumId) });
  if (error || typeof data !== "number") return null;
  return data;
}
