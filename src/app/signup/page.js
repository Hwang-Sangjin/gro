"use client";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";

export default function Signup() {
  return (
    <PageShell>
      <div className="auth">
        <span className="page-label">Sign up</span>
        <h1 className="page-title">판을 모을 준비</h1>

        <div className="auth-form">
          <input className="field" type="text" placeholder="Nickname" />
          <input className="field" type="email" placeholder="Email" />
          <input className="field" type="password" placeholder="Password" />
          <button type="button" className="home-cta">
            Create account
          </button>
        </div>

        <p className="page-desc">
          이미 계정이 있나요? <Link href="/login">로그인</Link>
        </p>
      </div>
    </PageShell>
  );
}
