"use client";

import PageShell from "@/components/layout/PageShell";

const POSTS = [
  { no: "01", title: "재발매 소식", date: "2026.09.12" },
  { no: "02", title: "바이닐 관리법 — 정전기", date: "2026.09.05" },
  { no: "03", title: "이달의 신보", date: "2026.08.28" },
];

export default function News() {
  return (
    <PageShell>
      <header className="page-head">
        <span className="page-label">03 — News</span>
        <h1 className="page-title">소식과 관리법</h1>
        <p className="page-desc">신보·재발매 소식과 판을 오래 쓰는 방법.</p>
      </header>

      <ul className="page-list">
        {POSTS.map((post) => (
          <li className="page-row" key={post.no}>
            <span className="page-label">{post.no}</span>
            <strong>{post.title}</strong>
            <span className="page-label">{post.date}</span>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
