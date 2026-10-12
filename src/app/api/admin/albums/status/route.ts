// src/app/api/admin/albums/status/route.ts
// 앨범 공개 / 숨김 전환 — 관리자만
// POST JSON { slug, status: "published" | "draft" }
//   published = 사이트에 보임, draft = 숨김 (Digging·Collection·앨범 페이지에서 안 보임, 데이터는 그대로)

import { adminGuard, serviceClient } from "@/lib/admin/auth";

export const runtime = "nodejs";
const STATUSES = ["published", "draft"];

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const { slug, status } = await req.json();
    if (!slug || !STATUSES.includes(status)) {
      return Response.json({ error: "slug and status (published | draft) are required." }, { status: 400 });
    }
    const { data, error } = await serviceClient()
      .from("albums").update({ status }).eq("slug", slug).select("slug, status").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return Response.json({ error: `No album with slug '${slug}'.` }, { status: 404 });
    return Response.json({ ok: true, ...data });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
