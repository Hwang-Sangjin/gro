"use client";
/* 로그인 / 회원가입 화면 — Google 계정 하나로 (처음이면 그 자리에서 가입됨)
   ?next=/collection 처럼 넘어오면 로그인 후 그 페이지로 돌아감. ?error= 는 실패 이유 */
import { useEffect, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import useAuthUser, { profileOf, signInWithGoogle, signOut } from "@/lib/useAuthUser";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function AuthPanel({ mode = "login" }) {
  const user = useAuthUser();
  const [next, setNext] = useState("/");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = q.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    if (q.get("error")) setError(q.get("error"));
  }, []);

  async function google() {
    setBusy(true); setError("");
    const { error: e } = await signInWithGoogle(next);
    if (e) { setError(e.message); setBusy(false); }   // 성공하면 Google 페이지로 넘어감
  }

  const p = profileOf(user);
  const signup = mode === "signup";
  return (
    <PageShell>
      <section className="mx-auto flex min-h-[calc(100svh-var(--ct-header-h,106px)-6rem)] w-full max-w-[560px] flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/60">{signup ? "Sign up" : "Login"}</p>
        <h1 className={`${SERIF} mt-4 text-[clamp(2.75rem,7vw,4.5rem)] font-black leading-[0.95] tracking-[-0.03em] text-(--ink)`}>
          {user ? "반가워요" : signup ? "판을 모을 준비" : "다시 오셨네요"}
        </h1>

        {user ? (
          <div className="mt-10">
            <div className="flex items-center gap-4 border-y border-(--ink)/20 py-5">
              {p.avatar
                ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full object-cover" />
                : <span className={`${SERIF} grid size-12 place-items-center rounded-full bg-(--ink) text-xl font-black text-(--cream)`}>{p.name.slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0">
                <p className="truncate text-[17px] font-medium text-(--ink)">{p.name}</p>
                <p className="truncate text-[13px] text-(--ink)/60">{p.email}</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href={next === "/login" || next === "/signup" ? "/collection" : next}
                className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-[#c8553d]">
                {next !== "/" ? "계속하기" : "내 컬렉션"}
              </Link>
              <button type="button" onClick={signOut}
                className="min-h-12 px-2 text-[13px] font-medium uppercase tracking-[0.18em] text-(--ink)/60 underline-offset-4 transition-colors hover:text-(--ink) hover:underline">
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="max-w-[40ch] text-[15px] leading-7 text-(--ink)/75">
              {signup ? "Google 계정으로 바로 시작해요. 내가 가진 판을 모으고, 듣고 싶은 판을 기억해 둘 수 있어요."
                : "Google 계정으로 로그인하면 내 컬렉션을 볼 수 있어요."}
            </p>
            <button type="button" onClick={google} disabled={busy || user === undefined}
              className="group mt-10 flex min-h-14 w-full items-center justify-center gap-3 rounded-full border border-(--ink) bg-[color-mix(in_oklab,var(--cream)_82%,white)] px-6 text-[15px] font-medium text-(--ink) transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-white disabled:pointer-events-none disabled:opacity-50">
              <GoogleMark />
              {busy ? "Google로 이동 중…" : "Google로 계속하기"}
            </button>
            {error && <p role="alert" className="mt-4 text-[13px] text-[#b45137]">{error}</p>}
            <p className="mt-8 text-[12px] leading-6 text-(--ink)/60">
              처음이면 자동으로 계정이 만들어져요. 이름·이메일·프로필 사진만 받아 와요.
            </p>
            <p className="mt-6 border-t border-(--ink)/20 pt-6 text-[13px] text-(--ink)">
              {signup ? <>이미 계정이 있나요? <Link href="/login" className="underline underline-offset-4">로그인</Link></>
                : <>처음이신가요? <Link href="/signup" className="underline underline-offset-4">회원가입</Link></>}
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
