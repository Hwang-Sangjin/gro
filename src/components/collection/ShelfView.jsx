"use client";
// Collection 의 Shelf 보기 — 판을 책등처럼 세워 나무 선반에 꽂음 (Grid · Crate 에 이은 세 번째 보기)
//  - 책등에 마우스를 올리면(또는 Tab) 그 판이 살짝 들리고 재킷이 옆으로 펼쳐져 나옴. 옆으로 쓸면 재킷이 잇달아 넘어감
//  - 누르면 앨범 상세로 (펼쳐진 재킷이 날아가는 전환). 터치는 첫 번에 뽑고, 한 번 더 누르면 열림
//  - 장르를 고르지 않았으면 장르별로 모아 꽂고 사이에 크래프트 칸막이. 칸막이를 누르면 그 장르만
//  모양은 Shelf.module.css
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import { lineOf } from "@/components/albums/GenreBar";
import { GENRES } from "@/lib/genres";
import { coverUrl } from "@/lib/albums";
import styles from "./Shelf.module.css";

const ORDER = GENRES.map((g) => g.slug);
const NAME = Object.fromEntries(GENRES.map((g) => [g.slug, g.name]));
const WIDTHS = [34, 38, 42, 46, 52];        // 책등 두께 (px) — 판마다 조금씩 다르게
const HEIGHTS = [0.9, 0.93, 0.95, 0.97];    // 줄 높이 대비 책등 높이

// 판마다 늘 같은 값이 나오는 작은 해시 (두께 · 높이를 고르는 데 씀: 새로 그려도 모양이 안 바뀜)
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
// 책등 글자색: 커버 색이 밝으면 잉크, 어두우면 크림
function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#2a2228";
  const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? "#2a2228" : "#f7efdf";
}
const byArtist = (a, b) => (a.artist_names || "").localeCompare(b.artist_names || "") || a.title.localeCompare(b.title);
const primary = (a) => ORDER.find((s) => a.genres?.includes(s)) ?? "etc";

/**
 * albums: 지금 탭 · 장르 · 검색으로 걸러진 판들 · grouped: 장르별로 모아 칸막이를 꽂음 (장르를 고르지 않았을 때)
 * onGenre(slug): 칸막이를 누름
 */
export default function ShelfView({ albums, grouped = false, onGenre }) {
  const transition = useAlbumTransition();
  const [active, setActive] = useState(null);   // { slug, side }
  const pointer = useRef("mouse");

  // 꽂는 순서: (장르별로 모아) 아티스트 → 제목
  const row = useMemo(() => {
    if (!grouped) return [...albums].sort(byArtist).map((album) => ({ album }));
    const out = [];
    for (const slug of ORDER) {
      const group = albums.filter((a) => primary(a) === slug).sort(byArtist);
      if (group.length) out.push({ divider: slug }, ...group.map((album) => ({ album })));
    }
    return out;
  }, [albums, grouped]);

  const current = active && albums.find((a) => a.slug === active.slug);
  // 뽑을 때: 재킷이 선반 오른쪽 밖으로 나가면 왼쪽으로 펼침
  const pull = (el, slug) => {
    if (active?.slug === slug) return;
    const r = el.getBoundingClientRect(), box = el.parentElement.getBoundingClientRect();
    setActive({ slug, side: r.right + el.offsetHeight > box.right && r.left - el.offsetHeight >= box.left ? "left" : "right" });
  };
  const open = (e, album) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // 터치: 첫 번은 뽑기만 (마우스는 올리는 순간 이미 뽑혀 있음)
    if (pointer.current !== "mouse" && active?.slug !== album.slug) { e.preventDefault(); pull(e.currentTarget, album.slug); return; }
    if (!transition) return;
    e.preventDefault();
    transition.openAlbum({ slug: album.slug, color: album.cover_color, imageUrl: coverUrl(album.thumb_path), source: e.currentTarget.querySelector("[data-shelf-cover]") });
  };

  return (
    <div role="tabpanel">
      {/* 지금 뽑은 판 (없으면 쓰는 법) */}
      <div className="mb-[clamp(1.25rem,3vh,2rem)] flex min-h-7 items-baseline justify-between gap-6">
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/65">{albums.length} on the shelf</span>
        <p aria-live="polite" className="min-w-0 truncate text-right text-[15px]">
          {current
            ? <><strong className="font-bold">{current.title}</strong><span className="text-(--ink)/70"> — {current.artist_names}</span></>
            : <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/65"><span className="[@media(hover:none)]:hidden">Run along the spines</span><span className="hidden [@media(hover:none)]:inline">Tap a spine</span></span>}
        </p>
      </div>
      <div className={styles.shelf} data-has-active={!!active} onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}>
        {row.map((it, i) => {
          if (it.divider) {
            return (
              <button key={`d:${it.divider}`} type="button" className={styles.divider} style={{ "--i": i, "--line": lineOf(it.divider) }}
                onClick={() => onGenre?.(it.divider)} aria-label={`Show only ${NAME[it.divider]}`}>
                <span className={styles.dymo}>{NAME[it.divider]}</span>
              </button>
            );
          }
          const a = it.album, h = hash(a.slug), on = active?.slug === a.slug, src = coverUrl(a.thumb_path);
          return (
            <Link key={a.id} href={`/album/${a.slug}`} data-shelf-spine className={styles.slot} aria-label={`${a.title} — ${a.artist_names}`}
              data-active={on} data-side={on ? active.side : undefined}
              style={{ "--i": i, "--w": `${WIDTHS[h % WIDTHS.length]}px`, "--h": `${HEIGHTS[(h >>> 4) % HEIGHTS.length] * 100}%`, "--c": a.cover_color || "#bbcbda", "--t": inkOn(a.cover_color) }}
              onPointerDown={(e) => { pointer.current = e.pointerType; }}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") { pointer.current = "mouse"; pull(e.currentTarget, a.slug); } }}
              onFocus={(e) => pull(e.currentTarget, a.slug)}
              onBlur={() => setActive((v) => (v?.slug === a.slug ? null : v))}
              onClick={(e) => open(e, a)}>
              <span className={styles.spine}>
                <span className={styles.title}>{a.title}</span>
                <span className={styles.artist}>{a.artist_names}</span>
              </span>
              <span className={styles.cover} data-shelf-cover aria-hidden="true">
                {src && <img src={src} alt="" loading="lazy" decoding="async" />}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
