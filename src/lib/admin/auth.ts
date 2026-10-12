// src/lib/admin/auth.ts — 서버 전용
// 관리자 확인: 로그인 세션(쿠키)으로 사용자를 알아낸 뒤, profiles.role 이 'admin' 인지 서비스 키로 확인
// - 관리자 페이지(layout)와 /api/admin/* 가 같이 씀
// - 예전 ADMIN_SECRET(관리자 키 입력) 방식을 대신함

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

export async function getAdmin(): Promise<AdminCheck> {
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await serviceClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { user, admin: data?.role === "admin" };
}

// API 라우트 맨 앞에서: 관리자가 아니면 바로 돌려줄 응답, 관리자면 null
export async function adminGuard(): Promise<Response | null> {
  const { user, admin } = await getAdmin();
  if (!user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!admin) return Response.json({ error: "관리자 권한이 없습니다." }, { status: 403 });
  return null;
}
