"use client";
// 내 판: 소장(Owned) / 위시리스트(Wishlist) — Digging 과 같은 머리말·장르 바(GenreBar)·그리드(AlbumGrid)
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";
import AlbumGrid from "@/components/albums/AlbumGrid";
import GenreBar, { GENRE_ITEMS } from "@/components/albums/GenreBar";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";
import useAuthUser, { profileOf } from "@/lib/useAuthUser";
import { fetchShelves } from "@/lib/userAlbums";
import shuffle from "@/lib/shuffle";
import closeGrid from "@/components/digging/closeGrid";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";
const TABS = [
  { kind: "owned", name: "Owned", empty: "아직 꽂힌 판이 없어요", hint: "앨범 페이지에서 ‘소장하기’를 누르면 여기에 꽂혀요." },
  { kind: "wishlist", name: "Wishlist", empty: "갖고 싶은 판을 담아 보세요", hint: "앨범 페이지에서 ‘위시리스트’를 누르면 여기에 모여요." },
];

export default function Collection() {
  const user = useAuthUser();   // undefined = 확인 중
  // 고른 것(바로 바뀜) / 보여 주는 판들(지금 판들이 접혀 닫힌 뒤 바뀜) — 탭·장르 둘 다
  const [view, setView] = useState({ tab: "owned", genre: null });
  const [shown, setShown] = useState({ tab: "owned", genre: null });
  const [query, setQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const wanted = useRef(shown);
  const wrapRef = useRef(null);
  const [shelves, setShelves] = useState(null);
  const [error, setError] = useState(false);
  const [titleRef, titleRevealed] = useReveal();
  const [barRef, barRevealed] = useReveal({ ready: user !== undefined });

  // ?tab=wishlist&genre=pop 로 바로 열기 (서버 렌더와 어긋나지 않게 마운트 후에 읽음)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const next = {
      tab: q.get("tab") === "wishlist" ? "wishlist" : "owned",
      genre: GENRE_ITEMS.some(g => g.slug && g.slug === q.get("genre")) ? q.get("genre") : null,
    };
    if (next.tab !== "owned" || next.genre) { wanted.current = next; setView(next); setShown(next); }
  }, []);

  useEffect(() => {
    if (!user) { setShelves(null); return; }
    let alive = true;
    setError(false);
    // 들어올 때마다 순서를 섞어서 (새로 발견하는 느낌으로)
    fetchShelves().then(s => { if (alive) setShelves({ owned: shuffle(s.owned), wishlist: shuffle(s.wishlist) }); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [user]);

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
  const current = TABS.find(t => t.kind === shown.tab);
  const genreName = GENRE_ITEMS.find(g => g.slug === shown.genre)?.name;
  const name = profileOf(user).name;
  const key = `${shown.tab}:${shown.genre ?? "all"}`;

  return (
    <PageShell className={`${styles.page} paper-textured`}>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><h1 className={`${styles.title} text-[clamp(2.25rem,8.6vw,10rem)]!`}>COLLECTION</h1></span>
          <img className={styles.mark} src="/images/grooves/vinyl-mark.png" alt="" />
        </div>
      </header>

      {user === null ? (
        <div className="mt-6 flex flex-col items-start gap-6 border-t-[3px] border-[#4c404a] pt-10">
          <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>로그인하고 내 판을 모아 보세요</p>
          <p className="text-[15px] leading-7 text-[#4c404ab3]">소장한 판과 갖고 싶은 판을 한자리에 꽂아 둘 수 있어요.</p>
          <Link href="/login?next=/collection" className="inline-flex min-h-12 items-center rounded-full bg-[#4c404a] px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-[#f4e7cd] transition-colors hover:bg-[#c8553d]">
            Login
          </Link>
        </div>
      ) : (
        <>
          {/* 소장 / 위시리스트 탭: 위 굵은 선, 작은 라벨, Bodoni 탭 */}
          <div className="border-t-[3px] border-[#4c404a]">
            <div className="flex items-center justify-between pt-3 text-[10px] font-medium uppercase tracking-[0.3em] text-[#4c404a99]">
              <span>{name ? `${name}’s shelf` : "My shelf"}</span>
            </div>
            <div className="py-[clamp(0.75rem,1.4vw,1.25rem)]">
              <div ref={barRef} data-revealed={barRevealed} role="tablist" aria-label="내 판 보기"
                className={`${styles.filterReveal} flex flex-wrap items-baseline gap-x-[clamp(0.5rem,0.9vw,1.1rem)]`}>
                {TABS.map((t, i) => {
                  const on = view.tab === t.kind;
                  const n = shelves ? shelves[t.kind].length : null;
                  return (
                    <button key={t.kind} type="button" role="tab" aria-selected={on} onClick={() => change({ tab: t.kind })} style={{ "--reveal-order": i }}
                      className={`group/g relative shrink-0 whitespace-nowrap ${SERIF} font-black uppercase leading-[1.05] tracking-[-0.03em] transition-colors duration-500 text-[clamp(1.6rem,2.6vw,2.8rem)] ${on ? "text-[#4c404a]" : "text-[#4c404a40] hover:text-[#4c404ab3] focus-visible:text-[#4c404ab3]"}`}>
                      <span className="relative">
                        {t.name}
                        <span aria-hidden="true" className={`absolute -bottom-[0.06em] left-0 h-[0.08em] min-h-[2px] bg-[#c8553d] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "w-full" : "w-0 group-hover/g:w-full group-focus-visible/g:w-full"}`} />
                      </span>
                      {n != null && <sup className="ml-[0.15em] align-[1.1em] font-sans text-[max(0.3em,10px)] font-semibold tracking-normal tabular-nums">{n}</sup>}
                      {i < TABS.length - 1 && <span aria-hidden="true" className="ml-[clamp(0.5rem,0.9vw,1.1rem)] font-normal text-[#4c404a2e]">/</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 장르 + 검색 (Digging 과 같은 바, + Request 없이) */}
          <GenreBar genre={view.genre} counts={counts} onPick={(slug) => change({ genre: slug })}
            hrefFor={(slug) => `/collection?${new URLSearchParams({ ...(view.tab === "wishlist" && { tab: "wishlist" }), ...(slug && { genre: slug }) })}`}
            query={query} onQueryChange={setQuery} searchId="collection-search" />

          <div ref={wrapRef} aria-busy={switching} className={switching ? "pointer-events-none" : undefined}>
          {error ? (
            <p className={styles.empty} role="status">내 판을 불러오지 못했어요. 새로고침해 주세요.</p>
          ) : !shelves ? (
            <p className={styles.status} role="status">{user ? "불러오는 중…" : ""}</p>
          ) : items.length ? (
            <AlbumGrid key={key} role="tabpanel" albums={items} />
          ) : term && inGenre.length ? (
            <p className={styles.empty} role="status">검색한 앨범이 없어요.</p>
          ) : shown.genre && inShelf.length ? (
            <div key={key} role="tabpanel" className="flex flex-col items-center px-6 py-20 text-center transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] starting:translate-y-3 starting:opacity-0">
              <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>{genreName} 판은 아직 없어요</p>
              <button type="button" onClick={() => change({ genre: null })} className="mt-8 inline-flex min-h-12 items-center rounded-full border border-[#4c404a] px-7 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-[#4c404a] hover:text-[#f4e7cd]">
                All genres
              </button>
            </div>
          ) : (
            <div key={key} role="tabpanel" className="flex flex-col items-center px-6 py-20 text-center transition-[opacity,translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] starting:translate-y-3 starting:opacity-0">
              <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>{current.empty}</p>
              <p className="mt-3 text-[15px] leading-7 text-[#4c404ab3]">{current.hint}</p>
              <Link href="/digging" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-[#4c404a] px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-[#f4e7cd] transition-colors hover:bg-[#c8553d]">
                Start digging
              </Link>
            </div>
          )}
          </div>
        </>
      )}
    </PageShell>
  );
}
