// src/app/api/admin/requests/route.ts — 요청 처리 (관리자만)
// POST JSON { id, status: "pending" | "added" | "declined", album_slug?, admin_note? }
//   added    = 앨범을 등록함 (album_slug 로 연결 → 요청한 사람이 바로 들으러 갈 수 있음)
//   declined = 이번엔 못 올림 (admin_note 에 이유, 요청한 사람에게 보임)

import { adminGuard, serviceClient } from "@/lib/admin/auth";

export const runtime = "nodejs";
const STATUSES = ["pending", "added", "declined"];

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id, status, album_slug = null, admin_note = null } = await req.json();
    if (!id || !STATUSES.includes(status)) {
      return Response.json({ error: "id and status (pending | added | declined) are required." }, { status: 400 });
    }
    if (status === "added" && !album_slug) {
      return Response.json({ error: "The added album’s slug is required." }, { status: 400 });
    }
    const { data, error } = await serviceClient()
      .from("album_requests")
      .update({
        status,
        album_slug: status === "added" ? String(album_slug).trim() : null,
        admin_note: status === "declined" ? (String(admin_note ?? "").trim() || null) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id).select("id, status, album_slug, admin_note").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return Response.json({ error: "Request not found." }, { status: 404 });
    return Response.json({ ok: true, ...data });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
