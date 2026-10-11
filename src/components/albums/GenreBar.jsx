"use client";
// 장르 인덱스 바 — Digging·Collection 공용
// - 장르를 세리프로 크게 나열, 고른 장르만 진하게 + 장르 색 밑줄, 개수는 위첨자
// - 스크롤해서 헤더 아래에 붙으면 작게 한 줄로 접힘
// - 오른쪽: (선택) extra 슬롯 + 검색
//
// <GenreBar genre={slug|null} counts={{ all: 29, pop: 5, … } | null} onPick={slug => …}
//   hrefFor={slug => "/digging?genre=…"} query={q} onQueryChange={setQ} label="Browse by genre" extra={<button/>} />
import { useEffect, useRef, useState } from "react";
import { GENRES } from "@/lib/genres";
import { GENRE_LOOK } from "@/components/home/stage/homeGenres";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";

// 장르 색 (Home 장르 다이얼과 같은 팔레트). 밑줄은 잉크색을 라벨색 쪽으로 눌러 크림 위에서도 보이게
const ALL_LOOK = { ink: "#bbcbda", label: "#4c404a" };
const lookOf = (slug) => (slug ? GENRE_LOOK[slug] : ALL_LOOK) ?? ALL_LOOK;
export const lineOf = (slug) => { const l = lookOf(slug); return `color-mix(in oklab, ${l.ink} 70%, ${l.label})`; };
export const GENRE_ITEMS = [{ slug: null, name: "All" }, ...GENRES.map((g) => ({ slug: g.slug, name: g.name }))];

export default function GenreBar({
  genre = null, counts = null, onPick, hrefFor = () => "#",
  query = "", onQueryChange, label = "Browse by genre", searchId = "album-search",
  extra = null, topRule = "thick", className = "",
}) {
  const barRef = useRef(null);
  const [filtersRef, filtersRevealed] = useReveal();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(Boolean(query));
  const input = useRef(null);
  const trigger = useRef(null);

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

  const pick = (slug) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;   // 새 탭 열기는 그대로
    e.preventDefault();
    if ((slug ?? null) === (genre ?? null)) return;
    // 바가 위에 붙어 있을 만큼 내려와 있었다면, 새 목록의 처음부터 보이게
    const bar = barRef.current, page = bar?.closest(".page");
    if (bar && page && page.scrollTop > bar.offsetTop) page.scrollTo({ top: bar.offsetTop - 8, behavior: "instant" });
    onPick?.(slug);
  };
  function closeSearch() { onQueryChange?.(""); setOpen(false); trigger.current?.focus(); }
  const total = counts?.[genre ?? "all"];

  return (
    <div ref={barRef} data-stuck={stuck} className={`group/bar sticky top-[calc(var(--ct-header-h,106px)-3px)] z-20 mb-[clamp(1.5rem,3vw,2.5rem)] bg-[var(--dig-paper,#f3e7cd)] transition-colors duration-[800ms] ${className}`}>
      <div className={`grid grid-rows-[1fr] overflow-hidden ${topRule === "thick" ? "border-t-[3px]" : "border-t"} border-[#4c404a] transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[stuck=true]/bar:grid-rows-[0fr]`}>
        <div className="flex min-h-0 items-center justify-between overflow-hidden pt-3 transition-opacity duration-300 group-data-[stuck=true]/bar:opacity-0 text-[10px] font-medium uppercase tracking-[0.3em] text-[#4c404a99]">
          <span>{label}</span>
          <span className="tabular-nums">{total != null ? `${total} record${total === 1 ? "" : "s"}` : ""}</span>
        </div>
      </div>
      <div className="flex items-center gap-6 border-b border-[#4c404a99] py-[clamp(0.75rem,1.4vw,1.25rem)] transition-[padding] duration-500 group-data-[stuck=true]/bar:py-2">
        <nav ref={filtersRef} data-revealed={filtersRevealed} aria-label="장르 필터"
          className={`${styles.filterReveal} flex min-w-0 [&_sup]:transition-opacity group-data-[stuck=true]/bar:[&_sup]:opacity-0 flex-1 flex-nowrap items-baseline gap-x-[clamp(0.5rem,0.9vw,1.1rem)] gap-y-1 overflow-x-auto [scrollbar-width:none] md:flex-wrap group-data-[stuck=true]/bar:flex-nowrap`}>
          {GENRE_ITEMS.map((it, i) => {
            const on = (genre ?? null) === it.slug;
            const n = counts ? (counts[it.slug ?? "all"] ?? 0) : null;
            return (
              <a key={it.slug ?? "all"} href={hrefFor(it.slug)} data-crate-skip onClick={pick(it.slug)}
                aria-current={on ? "page" : undefined} style={{ "--reveal-order": i, "--line": lineOf(it.slug) }}
                className={`group/g relative shrink-0 whitespace-nowrap font-['Grooves_Bodoni',Georgia,serif] font-black uppercase leading-[1.05] tracking-[-0.03em] transition-[color,font-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-[clamp(1.2rem,1.85vw,2.1rem)] group-data-[stuck=true]/bar:text-[clamp(0.9rem,1.05vw,1.15rem)] ${on ? "text-[#4c404a]" : "text-[#4c404a40] hover:text-[#4c404ab3] focus-visible:text-[#4c404ab3]"}`}>
                <span className="relative">
                  {it.name}
                  {/* 장르 색 밑줄: 고른 장르는 꽉, 마우스를 올리면 왼쪽에서 그어짐 */}
                  <span aria-hidden="true" className={`absolute -bottom-[0.06em] left-0 h-[0.1em] min-h-[2px] bg-[var(--line)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "w-full" : "w-0 group-hover/g:w-full group-focus-visible/g:w-full"}`} />
                </span>
                {n != null && <sup className="ml-[0.15em] align-[1.1em] font-sans text-[max(0.3em,9px)] font-semibold tracking-normal tabular-nums">{n}</sup>}
                {i < GENRE_ITEMS.length - 1 && <span aria-hidden="true" className="ml-[clamp(0.5rem,0.9vw,1.1rem)] font-normal text-[#4c404a2e]">/</span>}
              </a>
            );
          })}
        </nav>
        <div className={`${styles.actions} mt-0! shrink-0 self-center`}>
          {extra}
          {onQueryChange && (
            <div className={styles.search} data-open={open}>
              <button ref={trigger} type="button" className={styles.iconButton} aria-label="앨범 검색" aria-expanded={open} aria-controls={searchId} onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/></svg>
              </button>
              <div className={styles.searchField} inert={!open}>
                <input id={searchId} ref={input} type="search" value={query} onChange={e => onQueryChange(e.target.value)} onKeyDown={e => { if (e.key === "Escape") closeSearch(); }} placeholder="앨범, 아티스트 검색" aria-label="앨범명 또는 아티스트" />
                <button type="button" className={styles.iconButton} onClick={closeSearch} aria-label="검색 닫기">×</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 고른 장르 색의 얇은 띠 */}
      <span aria-hidden="true" className="block h-[3px] transition-colors duration-500" style={{ backgroundColor: lineOf(genre) }} />
    </div>
  );
}
