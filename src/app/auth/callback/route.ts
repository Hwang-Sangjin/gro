// Google 로그인 후 돌아오는 곳: ?code= 를 Supabase 세션(쿠키)으로 바꾸고 원래 가려던 페이지로 보냄
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// 같은 사이트 안의 경로만 허용 (//evil.com 같은 외부 주소로 튕기지 않게)
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Vercel 등 프록시 뒤에서는 원래 호스트를 써야 쿠키가 맞는 도메인에 남음
      // (프로토콜도 프록시가 알려준 값을 따름 — 로컬 `next start`는 http)
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
      if (forwardedHost) return NextResponse.redirect(`${forwardedProto || "https"}://${forwardedHost}${next}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  // 실패: 로그인 페이지에 이유를 붙여 돌려보냄
  const fail = searchParams.get("error_description") || searchParams.get("error") || "Couldn’t finish signing in.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(fail)}&next=${encodeURIComponent(next)}`);
}
