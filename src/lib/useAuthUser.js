"use client";
// 지금 로그인한 사용자 (없으면 null). 첫 렌더는 서버와 같게 undefined(확인 중) → 브라우저에서 확인 후 갱신
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

let client = null;
export const authClient = () => (client ??= createClient());

export default function useAuthUser() {
  const [user, setUser] = useState(undefined);   // undefined = 아직 모름, null = 로그아웃
  useEffect(() => {
    const supabase = authClient();
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setUser(data.session?.user ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setUser(session?.user ?? null); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return user;
}

// 관리자인지 (profiles.role, 본인 줄만 읽힘). 메뉴에 "Admin" 을 보일지 정하는 용도 — 실제 막는 건 서버
const roleCache = new Map();
export function useIsAdmin(user) {
  const [admin, setAdmin] = useState(() => (user ? roleCache.get(user.id) ?? false : false));
  useEffect(() => {
    if (!user) { setAdmin(false); return; }
    if (roleCache.has(user.id)) { setAdmin(roleCache.get(user.id)); return; }
    let alive = true;
    authClient().from("profiles").select("role").eq("id", user.id).maybeSingle()
      .then(({ data }) => { const v = data?.role === "admin"; roleCache.set(user.id, v); if (alive) setAdmin(v); }, () => {});
    return () => { alive = false; };
  }, [user]);
  return admin;
}

// 화면에 보여 줄 이름·사진 (Google 프로필)
export function profileOf(user) {
  const m = user?.user_metadata ?? {};
  return {
    name: m.full_name || m.name || user?.email?.split("@")[0] || "",
    avatar: m.avatar_url || m.picture || null,
    email: user?.email ?? "",
  };
}

export async function signInWithGoogle(next = "/") {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  return authClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
}

export async function signOut() {
  await authClient().auth.signOut();
}
