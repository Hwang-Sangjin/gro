"use client";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";

export default function Login() {
  return (
    <PageShell>
      <div className="auth">
        <span className="page-label">Login</span>
        <h1 className="page-title">다시 오셨네요</h1>

        <div className="auth-form">
          <input className="field" type="email" placeholder="Email" />
          <input className="field" type="password" placeholder="Password" />
          <button type="button" className="home-cta">
            Sign in
          </button>
        </div>

        <p className="page-desc">
          처음이신가요? <Link href="/signup">회원가입</Link>
        </p>
      </div>
    </PageShell>
  );
}
