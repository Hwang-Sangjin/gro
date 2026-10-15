// Next 16: 예전 middleware.ts → proxy.ts
// 요청마다 Supabase 로그인 세션(쿠키)을 확인하고, 만료가 가까우면 새 토큰으로 갱신해 쿠키에 다시 씀
// (서버 컴포넌트는 쿠키를 쓸 수 없어서, 갱신은 여기서 담당)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // 로그인 쿠키가 없으면(로그아웃 상태·첫 방문) 확인할 세션이 없음 → 바로 통과 (Supabase 왕복 없음)
  if (!request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // 이 호출이 세션을 확인·갱신함 (지우지 말 것)
  // getClaims: 토큰 서명을 이 자리에서 확인 → 페이지를 넘길 때마다 Supabase 인증 서버에 다녀오지 않음
  // (만료가 가까우면 이때 새 토큰으로 갱신). 프로젝트가 예전 대칭 키(HS256)면 알아서 서버 확인으로 넘어감
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // 정적 파일·이미지·3D 모델 등은 건너뜀
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|models/|draco/|doodles/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|glb|gltf|woff2?|mp4|webm)$).*)",
  ],
};
