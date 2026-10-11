"use client";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";
import useAuthUser, { profileOf } from "@/lib/useAuthUser";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";

export default function Collection() {
  const user = useAuthUser();   // undefined = 확인 중
  const p = profileOf(user);

  return (
    <PageShell>
      <header className="page-head ct-reveal">
        <span className="page-label">03 — Collection</span>
        <h1 className="page-title">{user ? `${p.name}의 판` : "내가 가진 판"}</h1>
        <p className="page-desc">소장 중인 바이닐을 한자리에.</p>
      </header>

      {user === undefined ? null : user ? (
        // TODO: 컬렉션 테이블(collections) 연결 — 지금은 빈 상태
        <div className="mx-auto mt-10 flex max-w-[520px] flex-col items-center px-6 py-16 text-center">
          <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight text-[#4c404a]`}>아직 꽂힌 판이 없어요</p>
          <p className="mt-3 text-[15px] leading-7 text-[#4c404a]/70">Digging에서 마음에 드는 판을 찾아 컬렉션에 담아 보세요.</p>
          <Link href="/digging" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-[#4c404a] px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-[#f4e7cd] transition-colors hover:bg-[#c8553d]">
            Start digging
          </Link>
        </div>
      ) : (
        <div className="page-empty ct-reveal">
          <p>컬렉션은 로그인 후에 볼 수 있습니다.</p>
          <Link className="home-cta" href="/login?next=/collection">
            Login
          </Link>
        </div>
      )}
    </PageShell>
  );
}
