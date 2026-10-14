"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { fetchDiggingPage } from "@/lib/albums";
import { getGenreIds } from "@/lib/genreIds";
import GenreBar from "@/components/albums/GenreBar";
import RequestDialog from "@/components/requests/RequestDialog";
import DiggingGrid from "./DiggingGrid";
import useReveal from "./useReveal";
import closeGrid from "./closeGrid";
import styles from "./Digging.module.css";
import CrateView, { ViewToggle } from "@/components/albums/crate/CrateView";

// 장르별 앨범 수 (공개된 앨범만). 실패하면 숫자 없이 보여 줌
let countsPromise = null;
function getGenreCounts(supabase) {
  if (!countsPromise) {
    countsPromise = (async () => {
      const [rows, total, ids] = await Promise.all([
        supabase.from("album_genres").select("genre_id, albums!inner(status)").eq("albums.status", "published").limit(10000),
        supabase.from("albums").select("id", { count: "exact", head: true }).eq("status", "published"),
        getGenreIds(supabase),
      ]);
      if (rows.error) throw rows.error;
      const slugById = Object.fromEntries(Object.entries(ids).map(([slug, id]) => [id, slug]));
      const out = { all: total.count ?? null };
      for (const r of rows.data ?? []) { const slug = slugById[r.genre_id]; if (slug) out[slug] = (out[slug] ?? 0) + 1; }
      return out;
    })().catch(() => { countsPromise = null; return null; });
  }
  return countsPromise;
}

/* 장르를 바꿔도 페이지는 그대로: 그리드만 해당 장르의 판으로 바뀜.
   - 주소(?genre=)는 replaceState로만 맞춰 둠 → 새로고침·공유하면 그 장르로 열림 (서버가 첫 페이지를 그려 줌)
   - 한 번 본 장르는 기억해 두었다가 다시 고르면 바로 보여 줌 */
export default function DiggingCatalog({ initial, genreId, genre: initialGenre }) {
  const [genre, setGenre] = useState(initialGenre ?? null);
  const [current, setCurrent] = useState({ key: initialGenre ?? "all", initial, genreId });
  const [switching, setSwitching] = useState(false);
  const cache = useRef(new Map([[initialGenre ?? "all", { initial, genreId }]]));
  const wanted = useRef(initialGenre ?? "all");
  const supabaseRef = useRef(null);
  const gridWrapRef = useRef(null);
  const selectGenre = useCallback(async (slug) => {
    const key = slug ?? "all";
    if (key === wanted.current) return;
    wanted.current = key;
    setGenre(slug);
    const url = new URL(location.href);
    if (slug) url.searchParams.set("genre", slug); else url.searchParams.delete("genre");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    // 지금 판들을 접어 닫는 동안 새 장르를 불러오고, 둘 다 끝나면 새 판들이 펼쳐지며 등장
    setSwitching(true);
    const closing = closeGrid(gridWrapRef.current);
    try {
      let data = cache.current.get(key);
      if (!data) {
        const supabase = (supabaseRef.current ??= createClient());
        const id = slug ? (await getGenreIds(supabase))[slug] ?? null : null;
        data = { initial: await fetchDiggingPage(supabase, { genreId: id, seed: initial.seed }), genreId: id };
        cache.current.set(key, data);
      }
      await closing;
      if (wanted.current === key) setCurrent({ key, ...data });
    } catch {
      // 실패하면 예전 방식(페이지 이동)으로
      if (wanted.current === key) location.assign(slug ? `/digging?genre=${slug}` : "/digging");
    } finally {
      if (wanted.current === key) setSwitching(false);
    }
  }, [initial.seed]);
  const [titleRef, titleRevealed] = useReveal();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");   // 'grid' | 'crate' (Crate 보기는 지금 그리드의 판들로)
  const request = useRef(null);
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let alive = true;
    getGenreCounts((supabaseRef.current ??= createClient())).then((c) => { if (alive) setCounts(c); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><h1 className={styles.title}>DIGGING</h1></span>
          {/* Existing transparent brand asset; no new artwork dependency. */}
          <img className={`${styles.mark} w-[clamp(84px,11vw,200px)]! ml-[clamp(0.25rem,1vw,1rem)]!`} src="/images/grooves/title-crate.gif" alt="" />
        </div>
      </header>
      {/* 장르 인덱스 (Collection 과 같은 컴포넌트). Digging 에만 + Request */}
      <GenreBar genre={genre} counts={counts} onPick={selectGenre}
        hrefFor={(slug) => (slug ? `/digging?genre=${slug}` : "/digging")}
        query={query} onQueryChange={setQuery} searchId="digging-search"
        extra={<>
          <ViewToggle view={view} onChange={setView} className="mr-2" />
          <button className={styles.request} onClick={() => request.current?.open({ title: query.trim() })}>+ Request</button>
          <span className={styles.separator} aria-hidden="true" />
        </>} />
      {/* 장르를 바꾸면 지금 판들이 접혀 사라진 뒤, 그리드만 새로 그려짐 (카드가 다시 펼쳐지며 등장) */}
      <div ref={gridWrapRef} aria-busy={switching} className={switching ? "pointer-events-none" : undefined}>
        <DiggingGrid key={current.key} initial={current.initial} genreId={current.genreId} query={query} onRequest={() => request.current?.open({ title: query.trim() })} />
      </div>
      {/* Crate 보기: 그리드 위를 덮는 3D 크레이트 (Grid / Crate 버튼으로 전환) */}
      <CrateView gridRef={gridWrapRef} view={view} onViewChange={setView} title="Digging" />
      {/* 없는 판 요청 (로그인 사용자) — 검색 결과가 없을 때도 여기로 */}
      <RequestDialog ref={request} />
    </>
  );
}
