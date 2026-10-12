"use client";
// 앨범 등록 요청 — album_requests 테이블 (RLS: 본인 요청만 쓰고 읽음)
import { authClient } from "@/lib/useAuthUser";

export const STATUS_LABEL = { pending: "In the queue", added: "Added", declined: "Not this time" };

export async function submitRequest({ title, artist, link, note }) {
  const clean = (v) => (v ?? "").trim() || null;
  const { error } = await authClient().from("album_requests").insert({
    title: clean(title), artist: clean(artist), link: clean(link), note: clean(note),
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
