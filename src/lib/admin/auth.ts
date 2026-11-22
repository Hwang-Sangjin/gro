// src/lib/admin/auth.ts — 서버 전용
// 관리자 확인: 로그인 세션(쿠키)으로 사용자를 알아낸 뒤, profiles.role 이 'admin' 인지 서비스 키로 확인
// - 관리자 페이지(layout)와 /api/admin/* 가 같이 씀
// - 예전 ADMIN_SECRET(관리자 키 입력) 방식을 대신함

import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/utils/supabase/server";

// RLS 를 건너뛰는 서버용 클라이언트 (관리자 확인을 통과한 뒤에만 씀)
export function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export type AdminCheck = {
  user: { id: string; email?: string | null; user_metadata?: Record<string, any> } | null;
  admin: boolean;
};

// 한 요청 안에서는 한 번만 확인 (layout · page · data 함수가 같이 불러도 Supabase 왕복 1번)
export const getAdmin = cache(async function getAdmin(): Promise<AdminCheck> {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await serviceClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { user, admin: data?.role === "admin" };
});

// 관리자 화면 데이터용 서비스 클라이언트: 부를 때마다 관리자인지 다시 확인 (아니면 404)
//  (2026-11-23) layout 의 확인만 믿지 않음 — App Router 는 layout 과 page 를 따로 그려서,
//  페이지 조각만 요청하면 layout 을 건너뛸 수 있음. 그래서 숨김 앨범 · 요청 · 이메일을 읽는 곳마다 여기서 막음
export async function adminDb() {
  const { admin } = await getAdmin();
  if (!admin) notFound();
  return serviceClient();
}

// API 라우트 맨 앞에서: 관리자가 아니면 바로 돌려줄 응답, 관리자면 null
export async function adminGuard(): Promise<Response | null> {
  const { user, admin } = await getAdmin();
  if (!user) return Response.json({ error: "Please log in." }, { status: 401 });
  if (!admin) return Response.json({ error: "Staff only." }, { status: 403 });
  return null;
}
