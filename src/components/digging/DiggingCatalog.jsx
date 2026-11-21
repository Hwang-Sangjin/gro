"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import SplitTitle from "@/components/digging/SplitTitle";
import { createClient } from "@/utils/supabase/client";
import { fetchDiggingPage, newShuffleSeed } from "@/lib/albums";
import useAuthUser from "@/lib/useAuthUser";
import { fetchOwnedIds } from "@/lib/userAlbums";
import { getGenreIds } from "@/lib/genreIds";
import { GENRES } from "@/lib/genres";
import { cached } from "@/lib/dataCache";
import GenreBar, { GENRE_ITEMS, lineOf } from "@/components/albums/GenreBar";
import "@fontsource/permanent-marker/400.css";   // 칸막이 마커 손글씨
import RequestDialog from "@/components/requests/RequestDialog";
import DiggingGrid from "./DiggingGrid";
import useReveal from "./useReveal";
import closeGrid from "./closeGrid";
import styles from "./Digging.module.css";
import CrateView, { ViewToggle } from "@/components/albums/crate/CrateView";

// 장르별 앨범 수 (공개된 앨범만). 실패하면 숫자 없이 보여 줌
//  저장해 둔 숫자를 바로 보여 주고 10분이 지났으면 뒤에서 새로 받아 둠 (dataCache.js)
function getGenreCounts(supabase) {
  {
    return cached("genre-counts", (async () => {
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
    }), { fresh: 10 * 60_000, valid: (c) => c?.all != null }).catch(() => null);
  }
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
  // 섞는 순서: 처음엔 서버가 정한 것, Shuffle 을 누르면 새로 (장르를 바꿔도 같은 순서로)
  const seedRef = useRef(initial.seed);
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
        data = { initial: await fetchDiggingPage(supabase, { genreId: id, seed: seedRef.current }), genreId: id };
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
  }, []);
  // 다시 섞기: 지금 장르를 새 순서로 (지금 판들을 접고 → 새 순서를 받아 → 펼침). 기억해 둔 다른 장르 목록은 버림 (예전 순서라서)
  const shuffle = async () => {
    if (switching) return;
    const key = wanted.current, seed = newShuffleSeed();
    seedRef.current = seed;
    cache.current.clear();
    setSwitching(true);
    const closing = closeGrid(gridWrapRef.current);
    try {
      const supabase = (supabaseRef.current ??= createClient());
      const id = key === "all" ? null : (await getGenreIds(supabase))[key] ?? null;
      const data = { initial: await fetchDiggingPage(supabase, { genreId: id, seed }), genreId: id };
      cache.current.set(key, data);
      await closing;
      if (wanted.current === key) setCurrent({ key, ...data, seed });
    } catch { await closing; }
    finally { setSwitching(false); }
  };
  // 로그인한 경우: 내가 가진 판(owned)은 빼고 보기. 처음 켤 때 내 판 목록을 받아 둠
  const user = useAuthUser();
  const [hideOwned, setHideOwned] = useState(false);
  const [owned, setOwned] = useState(null);
  const notOwned = !!user && hideOwned && !!owned;
  const toggleOwned = async () => {
    if (switching) return;
    const next = !hideOwned;
    if (next && !owned) {
      try { setOwned(await fetchOwnedIds()); } catch { return; }
    }
    setSwitching(true);
    await closeGrid(gridWrapRef.current);
    setHideOwned(next);
    setSwitching(false);
  };
  // 페이지는 캐시된 '전체' 화면 → 주소에 ?genre= 가 있으면 열리자마자 그 장르로 바꿈
  useEffect(() => {
    const slug = new URLSearchParams(location.search).get("genre");
    if (slug && GENRES.some((g) => g.slug === slug)) selectGenre(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          <span className={styles.titleMask}><SplitTitle text="DIGGING" /></span>
          {/* Existing transparent brand asset; no new artwork dependency. */}
          <img className={`${styles.mark} w-[clamp(84px,11vw,200px)]! ml-[clamp(0.25rem,1vw,1rem)]!`} src="/images/grooves/title-crate.gif" alt="" />
        </div>
      </header>
      {/* 장르 인덱스 (Collection 과 같은 컴포넌트). Digging 에만 + Request */}
      <GenreBar genre={genre} counts={counts} onPick={selectGenre}
        hrefFor={(slug) => (slug ? `/digging?genre=${slug}` : "/digging")}
        query={query} onQueryChange={setQuery} searchId="digging-search"
        /* 다시 섞기 · (로그인하면) 내가 가진 판 빼고 보기: 장르 줄 위 작은 줄(판 수 옆)에 — 장르 목록의 폭을 뺏지 않게 (2026-11-21) */
        meta={<>
          <button type="button" className={styles.tool} onClick={shuffle} disabled={switching} aria-label="Shuffle the crate again">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5h2.6c1.4 0 2.3.6 3 1.7l1.8 3.1c.7 1.1 1.6 1.7 3 1.7H14M11.8 9.4 14 11l-2.2 1.6M2 11h2.6c.9 0 1.6-.3 2.2-.8M14 4.5h-1.6c-.9 0-1.6.3-2.2.8M11.8 2.9 14 4.5l-2.2 1.6" /></svg>
            Shuffle
          </button>
          {user && (
            <button type="button" className={styles.tool} onClick={toggleOwned} disabled={switching} aria-pressed={hideOwned}
              title="Show only records you don’t own yet">
              <span aria-hidden="true" className={styles.toolCheck} />
              Not owned
            </button>
          )}
        </>}
        extra={<>
          <ViewToggle view={view} onChange={setView} className="mr-2" />
          <button className={styles.request} onClick={() => request.current?.open({ title: query.trim() })}>+ Request</button>
          <span className={styles.separator} aria-hidden="true" />
        </>} />
      {/* 장르를 바꾸면 지금 판들이 접혀 사라진 뒤, 그리드만 새로 그려짐 (카드가 다시 펼쳐지며 등장) */}
      <div ref={gridWrapRef} aria-busy={switching} className={switching ? "pointer-events-none" : undefined}>
        <DiggingGrid key={`${current.key}:${current.seed ?? ""}:${notOwned}`} initial={current.initial} genreId={current.genreId} query={query} onRequest={() => request.current?.open({ title: query.trim() })}
          exclude={notOwned ? owned : null}
          lead={query.trim() ? null : <GenreDivider slug={current.key === "all" ? null : current.key} count={counts?.[current.key] ?? null} notOwned={notOwned} leaving={switching} />} />
      </div>
      {/* Crate 보기: 그리드 위를 덮는 3D 크레이트 (Grid / Crate 버튼으로 전환) */}
      <CrateView gridRef={gridWrapRef} view={view} onViewChange={setView} title="Digging" />
      {/* 없는 판 요청 (로그인 사용자) — 검색 결과가 없을 때도 여기로 */}
      <RequestDialog ref={request} />
    </>
  );
}

// 장르 칸막이: 그리드 첫 칸 — 레코드 가게 상자의 크래프트 판지 칸막이 (2026-11-21 더 실물처럼)
//  탭: 판지를 둥글게 오려 낸 탭에 다이모 라벨(검은 테이프 · 눌려 튀어나온 흰 글자)로 장르 이름
//  판: 고무 도장(GROOVES · RECORD CRATE) · 장르 색 동그라미 스티커 · 마커 손글씨(장르 · 판 수)
//  장르를 바꾸면 그리드와 함께 새로 그려짐
//  글씨 움직임 (2026-11-21): 새로 그려질 때 다이모 테이프가 붙고 · 도장이 찍히고 · 마커로 써짐 / 바뀌기 직전(leaving) 지워지고 떨어짐
function GenreDivider({ slug, count, notOwned = false, leaving = false }) {
  const name = GENRE_ITEMS.find((g) => g.slug === slug)?.name ?? "All";
  const head = slug ? name : "Shuffled for you", tab = slug ? name : "All records";
  const countText = notOwned ? "Not in your shelf" : count != null ? `${count} record${count === 1 ? "" : "s"}` : "records";
  // data-crate-divider: Crate 보기(CrateView)가 이 칸막이도 크레이트 맨 앞에 꽂음 (같은 글을 3D 판에 그림)
  // data-crate-ignore: 칸막이를 잡고 끌어도 페이지 넘기기(CrateStage)가 일어나지 않게 — 끌어 볼 만한 물건처럼 보여서 Home 으로 넘어갔음
  return (
    <div aria-hidden="true" className={styles.divider} style={{ "--divider": lineOf(slug) }}
      data-crate-divider data-crate-ignore data-leaving={leaving} data-tab={tab} data-head={head} data-count={countText}>
      <span className={styles.dividerTab}>
        <span className={styles.dymo}>{tab}</span>
      </span>
      <span className={styles.dividerCard} data-divider-art>
        <span className={styles.dividerStamp}>Grooves<br />Record crate</span>
        <span className={styles.dividerDot} data-divider-dot />
        <span className={styles.dividerHand}>
          <span className={styles.dividerName}>{head}</span>
          <span className={styles.dividerCount}>{countText}</span>
        </span>
      </span>
    </div>
  );
}
