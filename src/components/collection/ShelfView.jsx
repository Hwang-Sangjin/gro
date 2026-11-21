"use client";
// Collection 의 Shelf 보기 — 화면을 덮는 3D 무대 (Grid · Crate 에 이은 세 번째 보기. Crate 처럼 그리드 위를 덮음)
//  - 화면 가운데에 나무 칸막이장(LP 가 얇게 꽂힘)과, 그 옆(좁은 화면은 위)에 "지금 꺼낸 판"
//  - 휠 · 화살표 키 · 드래그로 한 장씩 꺼내 봄. 꺼낸 판을 누르면 앨범 상세로 (재킷이 그대로 날아가는 전환)
//  - 표시: 꺼낸 판이 꽂혀 있던 자리의 점 · 번호(07 / 28) · 아래 위치 줄
//  (2026-11-22 세 번째 판: ① DOM 의 넓은 책등 → ② 3D 선반 + 마우스 올리기 — 책등이 얇아 짚기 어렵고 선반이 작고 잘림 → ③ 가운데 무대 + 한 장씩)
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import { ViewToggle } from "@/components/albums/crate/CrateView";
import { GENRES } from "@/lib/genres";
import { coverUrl } from "@/lib/albums";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const KICKER = "text-[11px] font-medium uppercase tracking-[0.24em]";
const ORDER = GENRES.map((g) => g.slug);
const NAME = Object.fromEntries(GENRES.map((g) => [g.slug, g.name]));
const byArtist = (a, b) => (a.artist_names || "").localeCompare(b.artist_names || "") || a.title.localeCompare(b.title);
const primary = (a) => ORDER.find((s) => a.genres?.includes(s)) ?? "etc";
const pad3 = (n) => String(n).padStart(3, "0");

/**
 * albums: 지금 탭 · 장르 · 검색으로 걸러진 판들 · grouped: 장르별로 모아 칸막이를 꽂음 (장르를 고르지 않았을 때)
 * label: 어디의 선반인지 (Owned · Wishlist) · view / onViewChange / views: 보기 전환 (무대 안의 스위치)
 */
export default function ShelfView({ albums, grouped = false, label = "Shelf", view, onViewChange, views }) {
  const hostRef = useRef(null), engineRef = useRef(null), sourceRef = useRef(null);
  const [layout, setLayout] = useState(null);     // { narrow, spot: { left, top, size } } — 꺼낸 판 자리
  const [picked, setPicked] = useState(null);     // { index, total, album, marker }
  const [ready, setReady] = useState(false);
  const transition = useAlbumTransition();
  const transitionRef = useRef(transition);
  useEffect(() => { transitionRef.current = transition; });

  // 꽂는 순서: (장르별로 모아) 아티스트 → 제목
  const items = useMemo(() => {
    const card = (a) => ({ album: { ...a, image: coverUrl(a.thumb_path), genre: NAME[primary(a)] } });
    if (!grouped) return [...albums].sort(byArtist).map(card);
    const out = [];
    for (const slug of ORDER) {
      const group = albums.filter((a) => primary(a) === slug).sort(byArtist);
      if (group.length) out.push({ divider: slug }, ...group.map(card));
    }
    return out;
  }, [albums, grouped]);

  // 재킷의 화면 자리에 맞춘 빈 상자를 출발점으로 넘겨 커버가 상세 페이지로 날아가게 함 (Crate 와 같은 방식)
  const open = (album, rect) => {
    const t = transitionRef.current, src = sourceRef.current;
    if (!t || !src || !rect) { location.assign(`/album/${encodeURIComponent(album.slug)}`); return; }
    Object.assign(src.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    t.openAlbum({ slug: album.slug, color: album.cover_color, imageUrl: album.image, source: src });
  };
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; });

  useEffect(() => {
    let alive = true, engine = null;
    import("./shelfEngine").then(({ createShelfEngine }) => {
      if (!alive || !hostRef.current) return;
      engine = createShelfEngine({ host: hostRef.current, items, onLayout: setLayout, onSelect: setPicked, onOpen: (a, r) => openRef.current(a, r) });
      engineRef.current = engine;
      setReady(true);
    });
    return () => { alive = false; engine?.dispose(); engineRef.current = null; setPicked(null); setReady(false); };
  }, [items]);

  // 무대가 떠 있는 동안 아래 페이지는 잠금 (휠이 판을 넘기는 데 쓰임) · Esc → 그리드
  useEffect(() => {
    const page = hostRef.current?.closest(".page");
    page?.dispatchEvent(new Event("page:lock"));
    const esc = (e) => { if (e.key === "Escape") onViewChange?.("grid"); };
    window.addEventListener("keydown", esc);
    return () => { page?.dispatchEvent(new Event("page:unlock")); window.removeEventListener("keydown", esc); };
  }, [onViewChange]);

  const a = picked?.album, spot = layout?.spot;
  const tint = { color: `color-mix(in oklab, ${a?.cover_color || "var(--ink)"} 35%, var(--ink))` };
  const at = picked && picked.total > 1 ? picked.index / (picked.total - 1) : 0;

  return (
    <>
      <div ref={hostRef} data-no-select data-lenis-prevent data-crate-ignore role="region"
        aria-label={`${label} shelf. Scroll or use the arrow keys to pull out the next record; press Enter to open it.`}
        className={`fixed inset-0 z-[25] isolate cursor-grab touch-none text-(--ink) outline-none transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ "--gut": "clamp(16px, 4vw, 56px)" }}>
        {/* 바탕: 페이지와 같은 종이 (페이지 색 + 종이 결) — 헤더와 이어짐 */}
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-(--bg)" />
          <div className="absolute inset-0 bg-(--paper-surface,var(--bg)) bg-(image:--paper-texture-image) bg-repeat bg-blend-soft-light opacity-(--paper-texture-opacity) [background-size:var(--paper-texture-size)_var(--paper-texture-size)]" />
        </div>

        {/* 위: 어디의 선반인지 · 보기 전환 */}
        <p className={`${KICKER} pointer-events-none absolute left-[var(--gut)] top-[calc(var(--ct-header-h,106px)+1.1rem)] opacity-70`}>{label} · Shelf</p>
        <div className="absolute right-[var(--gut)] top-[calc(var(--ct-header-h,106px)+0.6rem)]">
          <ViewToggle view={view} onChange={onViewChange} views={views} className="bg-(--bg)" />
        </div>

        {/* 표시: 꺼낸 판이 꽂혀 있던 자리 (칸 바닥 턱 위의 점) */}
        {picked && (
          <span aria-hidden="true" className="pointer-events-none absolute size-[9px] -translate-x-1/2 translate-y-[3px] rounded-full bg-(--accent) shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)] transition-[left,top] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ left: picked.marker.left, top: picked.marker.top }} />
        )}

        {/* 꺼낸 판의 정보: 그 판 바로 아래 */}
        {a && spot && (
          <div key={a.slug} className="pointer-events-none absolute" style={{ left: spot.left, top: spot.top + spot.size + (layout.narrow ? 14 : 22), width: spot.size }}>
            <p className={`${KICKER} tabular-nums opacity-70`}>{pad3(picked.index + 1)} / {pad3(picked.total)}{a.genre ? ` · ${a.genre}` : ""}</p>
            <h2 className={`${SERIF} mt-1.5 truncate text-[clamp(1.4rem,2.2vw,2.3rem)] font-black leading-[1.08] tracking-[-0.015em] animate-[crate-title_.7s_cubic-bezier(.22,1,.36,1)_both]`} style={tint}>{a.title}</h2>
            <div className="mt-1.5 flex items-center justify-between gap-4">
              <p className="min-w-0 truncate text-[15px]">{a.artist_names}</p>
              <button type="button" onClick={() => engineRef.current?.openSelected()}
                className="pointer-events-auto inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-(--ink) bg-(--ink) px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cream) transition-opacity hover:opacity-85">
                Open record <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        )}

        {/* 아래: 쓰는 법 · 선반 안에서 지금 어디쯤인지 */}
        <p className={`${KICKER} pointer-events-none absolute bottom-[clamp(1rem,3vh,1.75rem)] left-[var(--gut)] text-[10px] opacity-60`}>
          <span className="[@media(hover:none)]:hidden">Scroll · ← → · Drag</span><span className="hidden [@media(hover:none)]:inline">Swipe to pull the next record</span>
        </p>
        {picked && picked.total > 1 && (
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[calc(clamp(1rem,3vh,1.75rem)+0.4rem)] left-[calc(var(--gut)+12rem)] right-[var(--gut)] h-px bg-(--ink)/30 max-[819px]:left-[var(--gut)] max-[819px]:bottom-[calc(clamp(1rem,3vh,1.75rem)+1.6rem)]">
            <span className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--accent) transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ left: `${(at * 100).toFixed(2)}%` }} />
          </div>
        )}
        {/* 화면 낭독기: 지금 꺼낸 판 */}
        <p className="sr-only" aria-live="polite">{a ? `${a.title} — ${a.artist_names}, ${picked.index + 1} of ${picked.total}` : ""}</p>
      </div>
      {/* 앨범 상세로 날아가는 커버의 출발점 */}
      <div ref={sourceRef} aria-hidden="true" className="pointer-events-none fixed z-[26]" />
    </>
  );
}
