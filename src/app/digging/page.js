"use client";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";

const PLACEHOLDER = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Digging() {
  return (
    <PageShell>
      <header className="page-head">
        <span className="page-label">01 — Digging</span>
        <h1 className="page-title">모든 판을 뒤져보는 곳</h1>
        <p className="page-desc">장르, 연도, 레이블로 좁혀가며 찾으세요.</p>
      </header>

      <div className="page-toolbar">
        <div className="page-toolbar-group">
          <button type="button" className="chip" data-active="true">
            3D view
          </button>
          <button type="button" className="chip">
            Image view
          </button>
        </div>
        <button type="button" className="chip">
          + Request
        </button>
      </div>

      <div className="page-grid">
        {PLACEHOLDER.map((id) => (
          <Link className="card" href={`/album/${id}`} key={id}>
            <span className="card-cover" />
            <strong>Album {id}</strong>
            <span className="card-meta">Artist — 2025</span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
