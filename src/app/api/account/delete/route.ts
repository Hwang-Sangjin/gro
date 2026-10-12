// src/app/api/account/delete/route.ts — 내 계정 삭제 (로그인한 본인만)
// POST JSON { confirm: "DELETE" }
// 1) 내가 올린 요청 커버(request-covers/<내 id>/…) 지움
// 2) Supabase Auth 사용자 삭제 → profiles · user_albums · album_requests 는 on delete cascade 로 같이 지워짐
// 관리자 계정은 여기서 못 지움 (관리자가 0명이 되는 사고 방지 — SQL Editor 에서 역할을 먼저 바꿀 것)

import { getAdmin, serviceClient } from "@/lib/admin/auth";

export const runtime = "nodejs";
const BUCKET = "request-covers";

export async function POST(req: Request) {
  const { user, admin } = await getAdmin();
  if (!user) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (admin) return Response.json({ error: "Staff accounts can’t be deleted here. Remove the admin role first." }, { status: 403 });

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch {}
  if (body.confirm !== "DELETE") return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });

  const db = serviceClient();

  // 1) 업로드한 커버 이미지 (폴더 안 파일을 100개씩 나눠 지움)
  for (;;) {
    const { data: files, error } = await db.storage.from(BUCKET).list(user.id, { limit: 100 });
    if (error) break;                       // 버킷이 없거나 비어 있음 → 계속 진행
    if (!files?.length) break;
    const { error: rmError } = await db.storage.from(BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
    if (rmError) return Response.json({ error: "Couldn’t remove your uploaded images. Please try again." }, { status: 500 });
    if (files.length < 100) break;
  }

  // 2) 계정 (+ cascade 로 프로필·컬렉션·요청)
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: "Couldn’t delete your account. Please try again." }, { status: 500 });

  return Response.json({ ok: true });
}
