// 로그인과 상관없는 공개 데이터용 Supabase 클라이언트 (쿠키를 안 읽음 → 사이트맵·공개 페이지를 캐시할 수 있음)
import { createClient } from "@supabase/supabase-js";

export function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
