"use client";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";

export default function Collection() {
  // TODO: auth 붙으면 세션 없을 때 /login 으로
  const signedIn = false;

  return (
    <PageShell>
      <header className="page-head ct-reveal">
        <span className="page-label">02 — Collection</span>
        <h1 className="page-title">내가 가진 판</h1>
        <p className="page-desc">소장 중인 바이닐을 한자리에.</p>
      </header>

      {signedIn ? (
        <div className="page-grid" />
      ) : (
        <div className="page-empty ct-reveal">
          <p>컬렉션은 로그인 후에 볼 수 있습니다.</p>
          <Link className="home-cta" href="/login">
            Login
          </Link>
        </div>
      )}
    </PageShell>
  );
}
