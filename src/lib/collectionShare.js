"use client";
// 내 컬렉션 공개 설정 (profiles.handle · collection_public) — supabase/migrations/20261014_public_collection.sql
import { authClient } from "@/lib/useAuthUser";

export const HANDLE_RULE = /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/;

// { handle, isPublic } — 마이그레이션 전이면 null
export async function fetchMyShare(userId) {
  const { data, error } = await authClient().from("profiles").select("handle, collection_public").eq("id", userId).maybeSingle();
  if (error || !data || !("handle" in data)) return null;
  return { handle: data.handle, isPublic: !!data.collection_public };
}

// 바꾼 결과 { handle, isPublic } · 실패하면 Error(code: "handle_taken" | "handle_invalid" | "failed")
export async function saveMyShare({ isPublic = null, handle = null }) {
  const { data, error } = await authClient().rpc("set_my_collection_share", { p_public: isPublic, p_handle: handle });
  if (error) {
    const code = /handle_taken/.test(error.message) ? "handle_taken" : /handle_invalid/.test(error.message) ? "handle_invalid" : "failed";
    throw Object.assign(new Error(code), { code });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { handle: row?.handle ?? handle, isPublic: !!row?.collection_public };
}
