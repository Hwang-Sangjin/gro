"use client";
// Collection 의 Shelf 보기 — 나무 선반에 LP 재킷이 얇게 꽂힌 3D 장면 (Grid · Crate 에 이은 세 번째 보기)
//  - 책등 위에 마우스를 두면 그 판이 앞으로 나와 앞면을 보여 줌 (shelfEngine.js). 옆으로 쓸면 잇달아 나왔다 들어감
//  - 누르면 앨범 상세로 (나온 재킷이 그대로 날아가는 전환). 터치는 첫 번에 뽑고, 한 번 더 누르면 열림
//  - 장르를 고르지 않았으면 장르별로 모아 꽂고 사이에 크래프트 칸막이 + 선반 턱의 다이모 라벨. 라벨을 누르면 그 장르만
//  (2026-11-22 다시 만듦: 처음엔 DOM 으로 넓은 책등을 그렸는데 — 실제 재킷은 훨씬 얇고, 재킷이 3D 로 나오는 쪽이 낫다는 요청)
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import { GENRES } from "@/lib/genres";
import { coverUrl } from "@/lib/albums";

const ORDER = GENRES.map((g) => g.slug);
const NAME = Object.fromEntries(GENRES.map((g) => [g.slug, g.name]));
const byArtist = (a, b) => (a.artist_names || "").localeCompare(b.artist_names || "") || a.title.localeCompare(b.title);
const primary = (a) => ORDER.find((s) => a.genres?.includes(s)) ?? "etc";

/**
 * albums: 지금 탭 · 장르 · 검색으로 걸러진 판들 · grouped: 장르별로 모아 칸막이를 꽂음 (장르를 고르지 않았을 때)
 * onGenre(slug): 장르 라벨을 누름
 */
export default function ShelfView({ albums, grouped = false, onGenre }) {
  const hostRef = useRef(null), engineRef = useRef(null), sourceRef = useRef(null);
  const [active, setActive] = useState(null);     // 지금 나와 있는 판
  const [labels, setLabels] = useState([]);       // 장르 라벨 자리 (캔버스 px)
  const transition = useAlbumTransition();
  const transitionRef = useRef(transition);
  useEffect(() => { transitionRef.current = transition; });

  // 꽂는 순서: (장르별로 모아) 아티스트 → 제목
  const items = useMemo(() => {
    const card = (a) => ({ album: { ...a, image: coverUrl(a.thumb_path) } });
    if (!grouped) return [...albums].sort(byArtist).map(card);
    const out = [];
    for (const slug of ORDER) {
      const group = albums.filter((a) => primary(a) === slug).sort(byArtist);
      if (group.length) out.push({ divider: slug, name: NAME[slug] }, ...group.map(card));
    }
    return out;
  }, [albums, grouped]);
  const order = useMemo(() => items.filter((it) => it.album).map((it) => it.album), [items]);

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
      engine = createShelfEngine({ host: hostRef.current, items, onActive: setActive, onLabels: setLabels, onOpen: (a, r) => openRef.current(a, r) });
      engineRef.current = engine;
    });
    return () => { alive = false; engine?.dispose(); engineRef.current = null; setActive(null); setLabels([]); };
  }, [items]);

  return (
    <div role="tabpanel">
      {/* 지금 나와 있는 판 (없으면 쓰는 법) */}
      <div className="mb-2 flex min-h-7 items-baseline justify-between gap-6">
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/65">{albums.length} on the shelf</span>
        <p aria-live="polite" className="min-w-0 truncate text-right text-[15px]">
          {active
            ? <><strong className="font-bold">{active.title}</strong><span className="text-(--ink)/70"> — {active.artist_names}</span></>
            : <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/65"><span className="[@media(hover:none)]:hidden">Run along the spines</span><span className="hidden [@media(hover:none)]:inline">Slide along the spines</span></span>}
        </p>
      </div>
      {/* 3D 선반 (캔버스는 엔진이 넣음) + 그 위의 장르 라벨. 판이 나와 있는 동안은 라벨을 숨김 (HTML 이라 재킷 위에 떠 보임) */}
      <div ref={hostRef} className="relative min-h-[40vh]">
        {labels.map((l) => (
          <button key={l.slug} type="button" onClick={() => onGenre?.(l.slug)} aria-label={`Show only ${l.name}`}
            className={`absolute -translate-y-1/2 whitespace-nowrap rounded-[1px] bg-[#1d1a1c] px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-[#f4efe6] transition-opacity duration-300 before:absolute before:-inset-2 before:content-[''] ${active ? "pointer-events-none opacity-0" : "hover:opacity-80"}`}
            style={{ left: l.left - 3, top: l.top }}>
            {l.name}
          </button>
        ))}
      </div>
      {/* 키보드 · 화면 낭독기: 같은 판들의 링크 목록 (Tab 으로 옮기면 선반에서 그 판이 나옴) */}
      <ul className="sr-only">
        {order.map((a) => (
          <li key={a.id}>
            <Link href={`/album/${a.slug}`} onFocus={() => engineRef.current?.setActive(a.slug)} onBlur={() => engineRef.current?.setActive(null)}
              onClick={(e) => {
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                const rect = engineRef.current?.rectOf(a.slug);
                if (!rect) return;
                e.preventDefault(); open(a, rect);
              }}>
              {a.title} — {a.artist_names}
            </Link>
          </li>
        ))}
      </ul>
      {/* 앨범 상세로 날아가는 커버의 출발점 */}
      <div ref={sourceRef} aria-hidden="true" className="pointer-events-none fixed z-[26]" />
    </div>
  );
}
