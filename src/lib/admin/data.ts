// src/lib/admin/data.ts — 서버 전용. 관리자 화면에서 읽는 데이터 (숨김 앨범까지 모두)
// 반드시 getAdmin()/layout 의 관리자 확인을 통과한 화면에서만 부를 것
import { serviceClient } from "./auth";

const LIST = "id, slug, title, artist_names, thumb_path, cover_color, status, release_year, format, created_at";

export async function getDashboard() {
  const db = serviceClient();
  const count = (q: any) => q.then((r: any) => r.count ?? 0).catch(() => 0);
  const [published, draft, users, owned, wishlist, recent] = await Promise.all([
    count(db.from("albums").select("id", { count: "exact", head: true }).eq("status", "published")),
    count(db.from("albums").select("id", { count: "exact", head: true }).neq("status", "published")),
    count(db.from("profiles").select("id", { count: "exact", head: true })),
    count(db.from("user_albums").select("album_id", { count: "exact", head: true }).eq("kind", "owned")),
    count(db.from("user_albums").select("album_id", { count: "exact", head: true }).eq("kind", "wishlist")),
    db.from("albums").select(LIST).order("created_at", { ascending: false }).limit(6).then((r: any) => r.data ?? []),
  ]);
  return { published, draft, users, owned, wishlist, recent };
}

export async function listAlbums() {
  const { data, error } = await serviceClient()
    .from("albums").select(LIST).order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// 수정 화면: 앨범 + 아티스트(순서대로) + 장르 slug + 트랙
export async function getAlbumForEdit(slug: string) {
  const db = serviceClient();
  const { data: album, error } = await db.from("albums")
    .select("id, slug, title, release_date, release_year, format, label, catalog_no, is_reissue, description, youtube_playlist_id, status, thumb_path, cover_color")
    .eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!album) return null;
  const [artists, genres, tracks] = await Promise.all([
    db.from("album_artists").select("position, artists(name)").eq("album_id", album.id).order("position"),
    db.from("album_genres").select("genres(slug)").eq("album_id", album.id),
    db.from("tracks").select("disc_no, side, side_position, title, duration_sec").eq("album_id", album.id)
      .order("disc_no").order("side").order("side_position"),
  ]);
  return {
    ...album,
    artists: (artists.data ?? []).map((r: any) => r.artists?.name).filter(Boolean),
    genres: (genres.data ?? []).map((r: any) => r.genres?.slug).filter(Boolean),
    tracks: tracks.data ?? [],
  };
}
