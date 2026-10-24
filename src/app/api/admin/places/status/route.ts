// src/app/api/admin/places/status/route.ts
// 장소 공개 / 숨김 전환 — 관리자만. POST JSON { id, status: "published" | "draft" }

import { adminGuard, serviceClient } from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { id, status } = await req.json();
    if (!id || !["published", "draft"].includes(status)) {
      return Response.json({ error: "id and status (published | draft) are required." }, { status: 400 });
    }
    const { data, error } = await serviceClient()
      .from("places").update({ status }).eq("id", id).select("id, status").maybeSingle();
    if (error) {
      if (error.code === "23514") return Response.json({ error: "Put a pin on the map first (Edit → click the map)." }, { status: 400 });
      throw new Error(error.message);
    }
    if (!data) return Response.json({ error: "Place not found." }, { status: 404 });
    return Response.json({ ok: true, ...data });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
