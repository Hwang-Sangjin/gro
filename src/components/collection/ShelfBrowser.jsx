"use client";
// 소장(Owned) / 위시리스트(Wishlist) 탭 + 장르 바 + 검색 + 앨범 그리드
// 내 Collection(/collection)과 공개 컬렉션(/collection/<아이디>)이 같이 씀
import { useEffect, useRef, useState } from "react";

import AlbumGrid from "@/components/albums/AlbumGrid";
import GenreBar, { GENRE_ITEMS } from "@/components/albums/GenreBar";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";
import closeGrid from "@/components/digging/closeGrid";
import CrateView, { ViewToggle } from "@/components/albums/crate/CrateView";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";
export const SHELF_TABS = [
  { kind: "owned", name: "Owned" },
  { kind: "wishlist", name: "Wishlist" },
];

/**
 * shelves: { owned: [...], wishlist: [...] } (null = 불러오는 중) · error: 못 불러옴
 * label: 탭 위 작은 글씨 (예: "Jin’s shelf") · aside: 그 줄 오른쪽 (예: 공유 버튼)
 * basePath: 장르 링크 주소 (/collection 또는 /collection/<아이디>) · ready: 장르 바 등장 시작
 * renderEmpty(tab): 그 탭이 비었을 때 · errorText: 못 불러왔을 때 문구
 */
export default function ShelfBrowser({ shelves, error, label, aside, basePath, ready = true, renderEmpty, errorText, tablistLabel = "Shelves" }) {
  // 고른 것(바로 바뀜) / 보여 주는 판들(지금 판들이 접혀 닫힌 뒤 바뀜) — 탭·장르 둘 다
  const [view, setView] = useState({ tab: "owned", genre: null });
  const [shown, setShown] = useState({ tab: "owned", genre: null });
  const [query, setQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const [crateView, setCrateView] = useState("grid");   // 'grid' | 'crate' — 지금 탭(Owned / Wishlist)·장르·검색의 판들로
  const wanted = useRef(shown);
  const wrapRef = useRef(null);
  const [barRef, barRevealed] = useReveal({ ready });

  // ?tab=wishlist&genre=pop 로 바로 열기 (서버 렌더와 어긋나지 않게 마운트 후에 읽음)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const next = {
      tab: q.get("tab") === "wishlist" ? "wishlist" : "owned",
      genre: GENRE_ITEMS.some(g => g.slug && g.slug === q.get("genre")) ? q.get("genre") : null,
    };
    if (next.tab !== "owned" || next.genre) { wanted.current = next; setView(next); setShown(next); }
  }, []);

  // 탭·장르 전환: 지금 판들을 등장의 역순(그림 → 단색 → 가운데 줄 → 사라짐)으로 닫은 뒤 새 판들이 펼쳐짐
  async function change(patch) {
    const next = { ...wanted.current, ...patch };
    if (next.tab === wanted.current.tab && next.genre === wanted.current.genre) return;
    wanted.current = next;
    setView(next);
    const url = new URL(window.location.href);
    if (next.tab === "owned") url.searchParams.delete("tab"); else url.searchParams.set("tab", next.tab);
    if (next.genre) url.searchParams.set("genre", next.genre); else url.searchParams.delete("genre");
    window.history.replaceState(window.history.state, "", url);
    setSwitching(true);
    await closeGrid(wrapRef.current);
    if (wanted.current !== next) return;   // 닫는 사이에 다른 걸 눌렀으면 그쪽이 마무리
    setShown(next);
    setSwitching(false);
  }

  // 장르별 개수 (고른 탭 기준)
  const shelf = shelves?.[view.tab] ?? [];
  const counts = shelves ? shelf.reduce((acc, a) => {
    for (const g of a.genres ?? []) acc[g] = (acc[g] ?? 0) + 1;
    return acc;
  }, { all: shelf.length }) : null;

  // 보여 줄 판: 탭 → 장르 → 검색어
  const term = query.trim().toLocaleLowerCase();
  const inShelf = shelves?.[shown.tab] ?? [];
  const inGenre = shown.genre ? inShelf.filter(a => a.genres?.includes(shown.genre)) : inShelf;
  const items = term ? inGenre.filter(a => `${a.title} ${a.artist_names}`.toLocaleLowerCase().includes(term)) : inGenre;
  const genreName = GENRE_ITEMS.find(g => g.slug === shown.genre)?.name;
  const key = `${shown.tab}:${shown.genre ?? "all"}`;

  return (
    <>
      {/* 소장 / 위시리스트 탭: 위 굵은 선, 작은 라벨, Bodoni 탭 */}
      <div className="border-t-[3px] border-(--ink)">
        <div className="flex min-h-9 items-center justify-between gap-4 pt-3 text-[10px] font-medium uppercase tracking-[0.3em] text-(--ink)/60">
          <span className="min-w-0 truncate">{label}</span>
          {aside}
        </div>
        <div className="py-[clamp(0.75rem,1.4vw,1.25rem)]">
          <div ref={barRef} data-revealed={barRevealed} role="tablist" aria-label={tablistLabel}
            className={`${styles.filterReveal} flex flex-wrap items-baseline gap-x-[clamp(0.5rem,0.9vw,1.1rem)]`}>
            {SHELF_TABS.map((t, i) => {
              const on = view.tab === t.kind;
              const n = shelves ? shelves[t.kind].length : null;
              return (
                <button key={t.kind} type="button" role="tab" aria-selected={on} onClick={() => change({ tab: t.kind })} style={{ "--reveal-order": i }}
                  className={`group/g relative shrink-0 whitespace-nowrap before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] ${SERIF} font-black uppercase leading-[1.05] tracking-[-0.03em] transition-colors duration-500 text-[clamp(1.6rem,2.6vw,2.8rem)] ${on ? "text-(--ink)" : "text-(--ink)/25 hover:text-(--ink)/70 focus-visible:text-(--ink)/70"}`}>
                  <span className="relative">
                    {t.name}
                    <span aria-hidden="true" className={`absolute -bottom-[0.06em] left-0 h-[0.08em] min-h-[2px] bg-[#c8553d] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "w-full" : "w-0 group-hover/g:w-full group-focus-visible/g:w-full"}`} />
                  </span>
                  {n != null && <sup className="ml-[0.15em] align-[1.1em] font-sans text-[max(0.3em,10px)] font-semibold tracking-normal tabular-nums">{n}</sup>}
                  {i < SHELF_TABS.length - 1 && <span aria-hidden="true" className="ml-[clamp(0.5rem,0.9vw,1.1rem)] font-normal text-(--ink)/18">/</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 장르 + 검색 (Digging 과 같은 바, + Request 없이) */}
      <GenreBar genre={view.genre} counts={counts} onPick={(slug) => change({ genre: slug })}
        hrefFor={(slug) => `${basePath}?${new URLSearchParams({ ...(view.tab === "wishlist" && { tab: "wishlist" }), ...(slug && { genre: slug }) })}`}
        query={query} onQueryChange={setQuery} searchId="collection-search"
        extra={items.length ? <ViewToggle view={crateView} onChange={setCrateView} className="mr-1" /> : null} />

      <CrateView gridRef={wrapRef} view={crateView} onViewChange={setCrateView} title={SHELF_TABS.find((t) => t.kind === shown.tab)?.name ?? "Shelf"} />
      <div ref={wrapRef} aria-busy={switching} className={switching ? "pointer-events-none" : undefined}>
        {error ? (
          <p className={styles.empty} role="status">{errorText}</p>
        ) : !shelves ? (
          <p className={styles.status} role="status">Loading…</p>
        ) : items.length ? (
          <AlbumGrid key={key} role="tabpanel" albums={items} />
        ) : term && inGenre.length ? (
          <p className={styles.empty} role="status">No records match your search.</p>
        ) : shown.genre && inShelf.length ? (
          <div key={key} role="tabpanel" className="flex flex-col items-center px-6 py-20 text-center transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] starting:translate-y-3 starting:opacity-0">
            <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>No {genreName} records yet</p>
            <button type="button" onClick={() => change({ genre: null })} className="mt-8 inline-flex min-h-12 items-center rounded-full border border-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
              All genres
            </button>
          </div>
        ) : (
          <div key={key} role="tabpanel" className="flex flex-col items-center px-6 py-20 text-center transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] starting:translate-y-3 starting:opacity-0">
            {renderEmpty(shown.tab)}
          </div>
        )}
      </div>
    </>
  );
}
