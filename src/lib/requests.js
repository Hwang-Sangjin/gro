"use client";
// 앨범 등록 요청 — album_requests 테이블 (RLS: 본인 요청만 쓰고 읽음)
import { authClient } from "@/lib/useAuthUser";

export const STATUS_LABEL = { pending: "In the queue", added: "Added", declined: "Not this time" };

const COVER_BUCKET = "request-covers";
export const requestCoverUrl = (path) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${COVER_BUCKET}/${path}` : null;

// 필수: title, artist / 선택: link, note, genres[], releaseDate, releaseYear, format, label, catalogNo, youtube, tracks(텍스트), cover(File)
export async function submitRequest(input) {
  const db = authClient();
  const clean = (v) => (v == null ? null : String(v).trim() || null);
  let cover_path = null;
  if (input.cover) {
    // 커버: request-covers/<내 id>/<시각>.<확장자> (본인 폴더만 올릴 수 있음)
    const { data: { session } } = await db.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) throw new Error("Please log in again.");
    const ext = (input.cover.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from(COVER_BUCKET).upload(path, input.cover, { contentType: input.cover.type, upsert: false });
    if (upErr) throw new Error("Couldn’t upload the cover image (max 5MB, JPG/PNG/WebP).");
    cover_path = path;
  }
  const year = Number(input.releaseYear) || (input.releaseDate ? Number(String(input.releaseDate).slice(0, 4)) : null);
  const { error } = await db.from("album_requests").insert({
    title: clean(input.title), artist: clean(input.artist), link: clean(input.link), note: clean(input.note),
    genres: input.genres?.length ? input.genres : null,
    release_date: clean(input.releaseDate), release_year: year || null,
    format: clean(input.format), label: clean(input.label), catalog_no: clean(input.catalogNo),
    youtube_playlist: clean(input.youtube), tracks: clean(input.tracks), cover_path,
  });
  if (error) {
    // 23505 = 같은 앨범을 이미 대기 중으로 요청함
    if (error.code === "23505") throw new Error("You already requested this record — it’s in the queue.");
    throw new Error("Couldn’t send your request. Please try again.");
  }
}

export async function fetchMyRequests() {
  const { data, error } = await authClient().from("album_requests")
    .select("id, title, artist, status, album_slug, admin_note, created_at")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}
