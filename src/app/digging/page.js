// src/app/digging/page.js
// 서버 컴포넌트. 첫 24개를 서버에서 가져와 HTML 에 포함시킨다

import Link from "next/link";

import PageShell from "@/components/layout/PageShell";
import DiggingGrid from "@/components/digging/DiggingGrid";
import { createClient } from "@/utils/supabase/server";
import { fetchDiggingPage } from "@/lib/albums";
import { GENRES } from "@/lib/genres";

export default async function Digging({ searchParams }) {
  const { genre = null } = await searchParams;
  const supabase = await createClient();

  // ?genre=jazz → genre_id
  let genreId = null;
  if (genre) {
    const { data } = await supabase
      .from("genres")
      .select("id")
      .eq("slug", genre)
      .maybeSingle();
    genreId = data?.id ?? null;
  }

  const initial = await fetchDiggingPage(supabase, { genreId });

  return (
    <PageShell>
      <header className="page-head">
        <span className="page-label">01 — Digging</span>
        <h1 className="page-title">모든 판을 뒤져보는 곳</h1>
        <p className="page-desc">장르, 연도, 레이블로 좁혀가며 찾으세요.</p>
      </header>

      <div className="page-toolbar">
        <div className="page-toolbar-group">
          <button type="button" className="chip opacity-40" disabled>
            3D view
          </button>
          <button type="button" className="chip" data-active="true">
            Image view
          </button>
        </div>
        <button type="button" className="chip">
          + Request
        </button>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="장르 필터">
        <Link
          href="/digging"
          scroll={false}
          className="chip"
          data-active={!genre}
        >
          All
        </Link>
        {GENRES.map((g) => (
          <Link
            key={g.slug}
            href={`/digging?genre=${g.slug}`}
            scroll={false}
            className="chip"
            data-active={genre === g.slug}
          >
            {g.name}
          </Link>
        ))}
      </nav>

      {/* 장르가 바뀌면 key 가 바뀌어 목록 상태가 초기화된다 */}
      <DiggingGrid key={genre ?? "all"} initial={initial} genreId={genreId} />
    </PageShell>
  );
}
