"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { fetchDiggingPage } from "@/lib/albums";
import { GENRES } from "@/lib/genres";
import { GENRE_LOOK } from "@/components/home/stage/homeGenres";
import DiggingGrid from "./DiggingGrid";
import { crateMemory } from "./DiggingCrate";
import useReveal from "./useReveal";
import styles from "./Digging.module.css";

// 장르 slug → id (genres 테이블). 한 번만 불러 둠
let genreIdsPromise = null;
function getGenreIds(supabase) {
  if (!genreIdsPromise) {
    genreIdsPromise = supabase.from("genres").select("id, slug").then(({ data, error }) => {
      if (error) { genreIdsPromise = null; throw error; }
      return Object.fromEntries((data ?? []).map((g) => [g.slug, g.id]));
    });
  }
  return genreIdsPromise;
}

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

// 장르 색 (Home 장르 다이얼과 같은 팔레트). 밑줄은 잉크색을 라벨색 쪽으로 눌러 크림 위에서도 보이게
const ALL_LOOK = { ink: "#bbcbda", label: "#4c404a" };
const lookOf = (slug) => (slug ? GENRE_LOOK[slug] : ALL_LOOK) ?? ALL_LOOK;
const lineOf = (slug) => { const l = lookOf(slug); return `color-mix(in oklab, ${l.ink} 70%, ${l.label})`; };
const ITEMS = [{ slug: null, name: "All" }, ...GENRES.map((g) => ({ slug: g.slug, name: g.name }))];

/* 지금 그리드의 판들을 등장 때와 반대로 접어서 닫음 (그림이 먼저 흐려지고, 가운데 세로선으로 접힘) */
function closeGrid(wrap) {
  if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const H = innerHeight;
  const ease = "cubic-bezier(0.55, 0, 0.75, 0.2)";
  const jobs = [];
  wrap.querySelectorAll("a[data-album-slug]").forEach((card) => {
    const r = card.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < H;
    const panel = card.querySelector("[data-image-ready]");
    const caption = card.lastElementChild;
    if (!visible || !panel) { card.style.visibility = "hidden"; return; }
    const delay = Math.random() * 120;
    const media = panel.querySelector("img, span");
    if (media) jobs.push(media.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay, easing: "ease-in", fill: "forwards" }).finished);
    jobs.push(panel.animate(
      [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 calc(50% - 2px) 0 calc(50% - 2px))", offset: 0.85 }, { clipPath: "inset(50% calc(50% - 2px) 50% calc(50% - 2px))" }],
      { duration: 520, delay: delay + 140, easing: ease, fill: "forwards" }).finished);
    if (caption) jobs.push(caption.animate([{ opacity: getComputedStyle(caption).opacity }, { opacity: 0 }], { duration: 260, delay, fill: "forwards" }).finished);
  });
  return Promise.all(jobs).catch(() => {});
}

/* 장르를 바꿔도 페이지는 그대로: 그리드만 해당 장르의 판으로 바뀜.
   - 주소(?genre=)는 replaceState로만 맞춰 둠 → 새로고침·공유하면 그 장르로 열림 (서버가 첫 페이지를 그려 줌)
   - 한 번 본 장르는 기억해 두었다가 다시 고르면 바로 보여 줌 */
export default function DiggingCatalog({ initial, genreId, genre: initialGenre, view: initialView = "grid" }) {
  // 보기 방식: grid | crate.
  // 주소는 바꾸지 않음 — 검색 파라미터가 바뀌면 Next 라우터가 페이지를 다시 그리면서(개발 모드 등)
  // 그리드가 한 줄 튀거나 새로 그려져, 3D 카드가 잰 자리와 어긋났음. 대신 이 탭(sessionStorage)에 기억
  // (?view=crate로 들어오는 링크는 그대로 지원)
  const [view, setViewState] = useState(() => {
    if (typeof window === "undefined") return initialView === "crate" ? "crate" : "grid";
    if (new URLSearchParams(window.location.search).get("view") === "crate") return "crate";
    try { if (sessionStorage.getItem("grooves:dig-view") === "crate") return "crate"; } catch {}
    return initialView === "crate" ? "crate" : "grid";
  });
  const viewRef = useRef(view); viewRef.current = view;
  const setView = useCallback((v) => {
    // 클릭한 순간의 스크롤 위치를 기억 → 크레이트 전환은 이 위치를 기준으로
    if (v === "crate") crateMemory.holdTop = barRef.current?.closest(".page")?.scrollTop ?? null;
    setViewState(v);
    try { sessionStorage.setItem("grooves:dig-view", v); } catch {}
    // 예전 링크의 ?view=crate가 남아 있으면 그리드로 돌아갈 때만 정리 (크레이트로 갈 땐 주소를 건드리지 않음)
    if (v === "grid" && new URLSearchParams(location.search).has("view")) {
      const url = new URL(location.href); url.searchParams.delete("view");
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, []);
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
    // 장르 줄이 위에 붙어 있을 만큼 내려와 있었다면, 새 목록의 처음부터 보이게
    const nav = barRef.current, page = nav?.closest(".page");
    if (nav && page && page.scrollTop > nav.offsetTop) page.scrollTo({ top: nav.offsetTop - 8, behavior: "instant" });
    // 지금 판들을 접어 닫는 동안 새 장르를 불러오고, 둘 다 끝나면 새 판들이 펼쳐지며 등장
    setSwitching(true);
    // 크레이트 보기에선 그리드가 숨어 있으니 접는 애니메이션 없이 바로
    const closing = viewRef.current === "crate" ? Promise.resolve() : closeGrid(gridWrapRef.current);
    try {
      let data = cache.current.get(key);
      if (!data) {
        const supabase = (supabaseRef.current ??= createClient());
        const id = slug ? (await getGenreIds(supabase))[slug] ?? null : null;
        data = { initial: await fetchDiggingPage(supabase, { genreId: id }), genreId: id };
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
  const pick = (slug) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;   // 새 탭 열기는 그대로
    e.preventDefault();
    selectGenre(slug);
  };
  const [titleRef, titleRevealed] = useReveal();
  const [filtersRef, filtersRevealed] = useReveal();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef(null);
  const trigger = useRef(null);
  const request = useRef(null);
  const navRef = useRef(null);
  const barRef = useRef(null);
  const [counts, setCounts] = useState(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let alive = true;
    getGenreCounts((supabaseRef.current ??= createClient())).then((c) => { if (alive) setCounts(c); });
    return () => { alive = false; };
  }, []);
  // 장르 줄이 헤더 아래에 붙으면 작게 한 줄로 접힘
  useEffect(() => {
    const bar = barRef.current, page = bar?.closest(".page");
    if (!bar || !page) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const top = parseFloat(getComputedStyle(bar).top) || 0;
      setStuck(bar.getBoundingClientRect().top - page.getBoundingClientRect().top <= top + 1 && page.scrollTop > 0);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    page.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => { page.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  function closeSearch() { setQuery(""); setOpen(false); trigger.current?.focus(); }
  return (
    <>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><h1 className={styles.title}>DIGGING</h1></span>
          {/* Existing transparent brand asset; no new artwork dependency. */}
          <img className={styles.mark} src="/images/grooves/vinyl-mark.png" alt="" />
        </div>
      </header>
      {/* 장르 인덱스: DIGGING과 같은 세리프로 장르를 크게 나열. 고른 장르만 진하게, 장르 색 밑줄.
          스크롤해서 헤더 아래에 붙으면 작게 한 줄로 접힘 */}
      <div ref={barRef} data-dig-bar data-stuck={stuck} className="group/bar sticky top-[calc(var(--ct-header-h,106px)-3px)] z-20 mb-[clamp(1.5rem,3vw,2.5rem)] bg-[var(--dig-paper,#f3e7cd)] transition-colors duration-[800ms]">
        <div className="grid grid-rows-[1fr] overflow-hidden border-t-[3px] border-[#4c404a] transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[stuck=true]/bar:grid-rows-[0fr]">
          <div className="flex min-h-0 items-center justify-between overflow-hidden pt-3 transition-opacity duration-300 group-data-[stuck=true]/bar:opacity-0 text-[10px] font-medium uppercase tracking-[0.3em] text-[#4c404a99]">
            <span>Browse by genre</span>
            <span className="tabular-nums">{counts?.[genre ?? "all"] != null ? `${counts[genre ?? "all"]} records` : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-6 border-b border-[#4c404a99] py-[clamp(0.75rem,1.4vw,1.25rem)] transition-[padding] duration-500 group-data-[stuck=true]/bar:py-2">
          <nav ref={(el) => { filtersRef.current = el; navRef.current = el; }} data-revealed={filtersRevealed} aria-label="장르 필터"
            className={`${styles.filterReveal} flex min-w-0 [&_sup]:transition-opacity group-data-[stuck=true]/bar:[&_sup]:opacity-0 flex-1 flex-nowrap items-baseline gap-x-[clamp(0.5rem,0.9vw,1.1rem)] gap-y-1 overflow-x-auto [scrollbar-width:none] md:flex-wrap group-data-[stuck=true]/bar:flex-nowrap`}>
            {ITEMS.map((it, i) => {
              const on = (genre ?? null) === it.slug;
              const n = counts ? (counts[it.slug ?? "all"] ?? 0) : null;
              return (
                <a key={it.slug ?? "all"} href={it.slug ? `/digging?genre=${it.slug}` : "/digging"} data-crate-skip onClick={pick(it.slug)}
                  aria-current={on ? "page" : undefined} style={{ "--reveal-order": i, "--line": lineOf(it.slug) }}
                  className={`group/g relative shrink-0 whitespace-nowrap font-['Grooves_Bodoni',Georgia,serif] font-black uppercase leading-[1.05] tracking-[-0.03em] transition-[color,font-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-[clamp(1.2rem,1.85vw,2.1rem)] group-data-[stuck=true]/bar:text-[clamp(0.9rem,1.05vw,1.15rem)] ${on ? "text-[#4c404a]" : "text-[#4c404a40] hover:text-[#4c404ab3] focus-visible:text-[#4c404ab3]"}`}>
                  <span className="relative">
                    {it.name}
                    {/* 장르 색 밑줄: 고른 장르는 꽉, 마우스를 올리면 왼쪽에서 그어짐 */}
                    <span aria-hidden="true" className={`absolute -bottom-[0.06em] left-0 h-[0.1em] min-h-[2px] bg-[var(--line)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "w-full" : "w-0 group-hover/g:w-full group-focus-visible/g:w-full"}`} />
                  </span>
                  {n != null && <sup className="ml-[0.15em] align-[1.1em] font-sans text-[max(0.3em,9px)] font-semibold tracking-normal tabular-nums">{n}</sup>}
                  {i < ITEMS.length - 1 && <span aria-hidden="true" className="ml-[clamp(0.5rem,0.9vw,1.1rem)] font-normal text-[#4c404a2e]">/</span>}
                </a>
              );
            })}
          </nav>
        <div className={`${styles.actions} mt-0! shrink-0 self-center`}>
            {/* 보기 방식: Grid ↔ Crate (3D) */}
            <div role="group" aria-label="보기 방식" className="relative flex rounded-full border border-[#4c404a4d] p-[3px]">
              <span aria-hidden="true" className={`absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-[#4c404a] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${view === "crate" ? "translate-x-full" : ""}`} />
              {["grid", "crate"].map((v) => (
                <button key={v} type="button" aria-pressed={view === v} aria-label={v === "grid" ? "그리드로 보기" : "크레이트(3D)로 보기"} onClick={() => setView(v)}
                  className={`relative z-[1] flex min-h-9 w-11 items-center justify-center gap-2 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] transition-colors duration-500 sm:w-[5.5rem] ${view === v ? "text-[#f3e7cd]" : "text-[#4c404a]"}`}>
                  {/* 좁은 화면에선 아이콘만 */}
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 shrink-0 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.4">
                    {v === "grid" ? <path d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" /> : <path d="M2 4.5h7.5v9H2zM11 3.5l3 1v9l-3-1M9.5 4.5l1.5-1" />}
                  </svg>
                  <span className="hidden sm:inline">{v}</span>
                </button>
              ))}
            </div>
            <span className={styles.separator} aria-hidden="true" />
            <button className={styles.request} onClick={() => request.current?.showModal()}>+ Request</button>
            <span className={styles.separator} aria-hidden="true" />
            <div className={styles.search} data-open={open}>
              <button ref={trigger} type="button" className={styles.iconButton} aria-label="앨범 검색" aria-expanded={open} aria-controls="digging-search" onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/></svg>
              </button>
              <div className={styles.searchField} inert={!open}>
                <input id="digging-search" ref={input} type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape") closeSearch(); }} placeholder="앨범, 아티스트 검색" aria-label="앨범명 또는 아티스트" />
                <button type="button" className={styles.iconButton} onClick={closeSearch} aria-label="검색 닫기">×</button>
              </div>
            </div>
          </div>
        </div>
        {/* 고른 장르 색의 얇은 띠 */}
        <span aria-hidden="true" className="block h-[3px] transition-colors duration-500" style={{ backgroundColor: lineOf(genre) }} />
      </div>
      {/* 장르를 바꾸면 지금 판들이 접혀 사라진 뒤, 그리드만 새로 그려짐 (카드가 다시 펼쳐지며 등장) */}
      <div ref={gridWrapRef} aria-busy={switching} className={switching ? "pointer-events-none" : undefined}>
        <DiggingGrid key={current.key} initial={current.initial} genreId={current.genreId} query={query} view={view} setView={setView} />
      </div>
      <dialog ref={request} className={styles.dialog}>
        <h2>Request a record</h2>
        <p>앨범 등록 요청 기능을 준비하고 있어요.</p>
        <form method="dialog"><button className={styles.request}>닫기</button></form>
      </dialog>
    </>
  );
}
