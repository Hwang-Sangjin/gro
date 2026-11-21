"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import SplitTitle from "@/components/digging/SplitTitle";
import { createClient } from "@/utils/supabase/client";
import { fetchDiggingPage, fetchSortedPage, fetchNewIn, countNewIn, newShuffleSeed, DIGGING_SORTS } from "@/lib/albums";
import useAuthUser from "@/lib/useAuthUser";
import { fetchOwnedIds } from "@/lib/userAlbums";
import { getGenreIds } from "@/lib/genreIds";
import { getGenreCounts } from "@/lib/genreCounts";
import { GENRES } from "@/lib/genres";
import GenreBar, { GENRE_ITEMS, lineOf } from "@/components/albums/GenreBar";
import "@fontsource/permanent-marker/400.css";   // 칸막이 마커 손글씨
import RequestDialog from "@/components/requests/RequestDialog";
import DiggingGrid from "./DiggingGrid";
import useReveal from "./useReveal";
import closeGrid from "./closeGrid";
import styles from "./Digging.module.css";
import CrateView, { ViewToggle } from "@/components/albums/crate/CrateView";
import useViewSwitch from "@/components/albums/useViewSwitch";

const VIEWS = ["grid", "crate", "list"];   // (2026-11-22 Shelf 보기를 넣었다가 뺌 — 사용자: 별로)
// "New in" 탭: 새로 들어온 판만 (최근 들어온 순). 장르가 아니라서 장르 id 없이 따로 받아 옴
const NEW = "new", PINNED = [{ slug: NEW, name: "New in" }];

/* 장르를 바꿔도 페이지는 그대로: 그리드만 해당 장르의 판으로 바뀜.
   - 주소(?genre=)는 replaceState로만 맞춰 둠 → 새로고침·공유하면 그 장르로 열림 (서버가 첫 페이지를 그려 줌)
   - 한 번 본 장르는 기억해 두었다가 다시 고르면 바로 보여 줌 */
export default function DiggingCatalog({ initial, genreId, genre: initialGenre }) {
  const [genre, setGenre] = useState(initialGenre ?? null);
  const [current, setCurrent] = useState({ key: initialGenre ?? "all", initial, genreId });
  const [switching, setSwitching] = useState(false);
  // 기억해 둔 목록: "장르|정렬" 마다 (정렬 기본 = 섞은 순서)
  const cache = useRef(new Map([[`${initialGenre ?? "all"}|shuffle`, { initial, genreId }]]));
  const [sort, setSort] = useState("shuffle");
  const sortRef = useRef("shuffle");
  const wanted = useRef(initialGenre ?? "all");
  const supabaseRef = useRef(null);
  const gridWrapRef = useRef(null);
  // 섞는 순서: 처음엔 서버가 정한 것, Shuffle 을 누르면 새로 (장르를 바꿔도 같은 순서로)
  const seedRef = useRef(initial.seed);
  // 장르(key) · 지금 정렬의 첫 묶음 (한 번 받은 것은 기억해 둔 것으로)
  const loadList = async (key) => {
    const sortKey = key === NEW ? "new" : sortRef.current, at = `${key}|${sortKey}`;
    let data = cache.current.get(at);
    if (data) return data;
    const supabase = (supabaseRef.current ??= createClient());
    if (key === NEW) data = { initial: await fetchNewIn(supabase), genreId: null };
    else {
      const id = key === "all" ? null : (await getGenreIds(supabase))[key] ?? null;
      const first = sortKey === "shuffle" ? await fetchDiggingPage(supabase, { genreId: id, seed: seedRef.current }) : await fetchSortedPage(supabase, { sort: sortKey, genreId: id });
      data = { initial: first, genreId: id };
    }
    cache.current.set(at, data);
    return data;
  };
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
      const data = await loadList(key);
      await closing;
      if (wanted.current === key) setCurrent({ key, ...data });
    } catch {
      // 실패하면 예전 방식(페이지 이동)으로
      if (wanted.current === key) location.assign(slug ? `/digging?genre=${slug}` : "/digging");
    } finally {
      if (wanted.current === key) setSwitching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 정렬 바꾸기: 지금 장르를 그 순서로 다시 받아 옴 (지금 판들을 접고 → 펼침)
  const changeSort = async (next) => {
    if (switching || next === sortRef.current || wanted.current === NEW) return;
    const key = wanted.current;
    sortRef.current = next; setSort(next);
    setSwitching(true);
    const closing = closeGrid(gridWrapRef.current);
    try {
      const data = await loadList(key);
      await closing;
      if (wanted.current === key && sortRef.current === next) setCurrent({ key, ...data });
    } catch { await closing; }
    finally { setSwitching(false); }
  };
  // 다시 섞기: 지금 장르를 새 순서로 (지금 판들을 접고 → 새 순서를 받아 → 펼침). 기억해 둔 다른 장르 목록은 버림 (예전 순서라서)
  const shuffle = async () => {
    if (switching || wanted.current === NEW || sortRef.current !== "shuffle") return;   // New in 은 들어온 순서 그대로 (섞지 않음) · 정렬해 보는 중에도 섞지 않음
    const key = wanted.current, seed = newShuffleSeed();
    seedRef.current = seed;
    cache.current.clear();
    setSwitching(true);
    const closing = closeGrid(gridWrapRef.current);
    try {
      const supabase = (supabaseRef.current ??= createClient());
      const id = key === "all" ? null : (await getGenreIds(supabase))[key] ?? null;
      const data = { initial: await fetchDiggingPage(supabase, { genreId: id, seed }), genreId: id };
      cache.current.set(`${key}|shuffle`, data);
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
    if (slug && (slug === NEW || GENRES.some((g) => g.slug === slug))) selectGenre(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [titleRef, titleRevealed] = useReveal();
  const [query, setQuery] = useState("");
  // 'grid' | 'crate' | 'list' (Crate 는 지금 그리드의 판들로). 보기 사이는 커버가 날아가며 넘어감 · 돌아오면 보던 보기로
  const { view, setView, arriving } = useViewSwitch(gridWrapRef);
  const request = useRef(null);
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let alive = true;
    const supabase = (supabaseRef.current ??= createClient());
    // 장르별 수 + 새로 들어온 판 수 (0 이면 New in 탭이 안 보임)
    Promise.all([getGenreCounts(supabase), countNewIn(supabase).catch(() => 0)]).then(([c, n]) => { if (alive) setCounts(c ? { ...c, [NEW]: n } : c); });
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
      <GenreBar genre={genre} counts={counts} onPick={selectGenre} pinned={PINNED}
        hrefFor={(slug) => (slug ? `/digging?genre=${slug}` : "/digging")}
        query={query} onQueryChange={setQuery} searchId="digging-search"
        /* 다시 섞기 · (로그인하면) 내가 가진 판 빼고 보기: 장르 줄 위 작은 줄(판 수 옆)에 — 장르 목록의 폭을 뺏지 않게 (2026-11-21) */
        meta={<>
          {/* 정렬 (Collection 의 Sort 와 같은 모양). New in 탭은 늘 들어온 순 */}
          <label className={`inline-flex items-center gap-2 transition-colors hover:text-(--ink) ${genre === NEW ? "opacity-50" : "cursor-pointer"}`}>
            Sort
            <select value={genre === NEW ? "new" : sort} onChange={(e) => changeSort(e.target.value)} disabled={switching || genre === NEW} aria-label="Sort records"
              className="cursor-pointer appearance-none rounded-sm border-b border-current/40 bg-transparent pb-px font-[inherit] uppercase tracking-[inherit] text-(--ink) outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--ink) disabled:cursor-default">
              {DIGGING_SORTS.map((o) => <option key={o.key} value={o.key} style={{ color: "#2a2228", backgroundColor: "#f4e7cd" }}>{o.name}</option>)}
            </select>
          </label>
          {/* 다시 섞기: 섞은 순서로 볼 때만 */}
          {sort === "shuffle" && <button type="button" className={styles.tool} onClick={shuffle} disabled={switching || genre === NEW} aria-label="Shuffle the crate again">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5h2.6c1.4 0 2.3.6 3 1.7l1.8 3.1c.7 1.1 1.6 1.7 3 1.7H14M11.8 9.4 14 11l-2.2 1.6M2 11h2.6c.9 0 1.6-.3 2.2-.8M14 4.5h-1.6c-.9 0-1.6.3-2.2.8M11.8 2.9 14 4.5l-2.2 1.6" /></svg>
            Shuffle
          </button>}
          {user && (
            <button type="button" className={styles.tool} onClick={toggleOwned} disabled={switching} aria-pressed={hideOwned}
              title="Show only records you don’t own yet">
              <span aria-hidden="true" className={styles.toolCheck} />
              Not owned
            </button>
          )}
        </>}
        extra={<>
          <ViewToggle view={view} onChange={setView} views={VIEWS} className="mr-2" />
          <button className={styles.request} onClick={() => request.current?.open({ title: query.trim() })}>+ Request</button>
          <span className={styles.separator} aria-hidden="true" />
        </>} />
      {/* 장르를 바꾸면 지금 판들이 접혀 사라진 뒤, 그리드만 새로 그려짐 (카드가 다시 펼쳐지며 등장) */}
      <div ref={gridWrapRef} aria-busy={switching} className={switching ? "pointer-events-none" : undefined}>
        <DiggingGrid key={`${current.key}:${current.initial.sort ?? ""}:${current.seed ?? ""}:${notOwned}`} initial={current.initial} genreId={current.genreId} query={query} onRequest={() => request.current?.open({ title: query.trim() })}
          exclude={notOwned ? owned : null} loadAll={view === "crate"} view={view} arriving={arriving}
          lead={query.trim() ? null : <GenreDivider slug={current.key === "all" ? null : current.key} count={counts?.[current.key] ?? null} notOwned={notOwned} leaving={switching} sort={current.initial.sort ?? null} />} />
      </div>
      {/* Crate 보기: 그리드 위를 덮는 3D 크레이트 (Grid / Crate 버튼으로 전환) */}
      <CrateView gridRef={gridWrapRef} view={view === "crate" ? "crate" : "grid"} onViewChange={setView} title="Digging" total={notOwned || query.trim() ? null : counts?.[current.key] ?? null} />
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
const SORT_HEAD = { new: "Newest first", year: "By year", artist: "A to Z" };   // 칸막이 손글씨 (전체를 정렬해 볼 때)
function GenreDivider({ slug, count, notOwned = false, leaving = false, sort = null }) {
  const name = slug === NEW ? "New in" : GENRE_ITEMS.find((g) => g.slug === slug)?.name ?? "All";
  const head = slug ? name : SORT_HEAD[sort] ?? "Shuffled for you", tab = slug ? name : "All records";
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
