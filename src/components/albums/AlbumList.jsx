"use client";
// 앨범 목록 보기 (List) — Digging · Collection 공용. 그리드의 커버 대신 글자 줄로 빠르게 훑음
//  한 줄 = 번호 · 작은 커버 · 제목 · 아티스트 · 연도. 누르면 앨범 상세로 (작은 커버가 날아가는 전환)
//  마우스가 있는 기기: 줄에 올리면 그 판의 커버가 커서 옆에 크게 떠서 따라오고, 나머지 줄은 옅어짐 (Home 의 News 목록과 같은 방식)
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import { coverUrl } from "@/lib/albums";

const NEW_DAYS = 45;   // 들어온 지 이 날수 안이면 New (AlbumCard 의 NEW IN 과 같은 기준)
const COVER = { gap: 28, follow: 0.24 };   // 떠 있는 커버: 커서와의 가로 거리(px) · 따라오는 속도(1 = 바로 붙음)
const isNew = (a) => a.created_at && Date.now() - new Date(a.created_at).getTime() < NEW_DAYS * 864e5;

// arriving: 다른 보기에서 커버가 날아오는 중 (useViewSwitch) → 줄이 아래에서 올라오는 움직임은 뺌 (커버가 내려앉을 자리가 어긋나지 않게)
export default function AlbumList({ albums, className = "", arriving = false, ...rest }) {
  const transition = useAlbumTransition();
  const listRef = useRef(null), floatRef = useRef(null);
  const [active, setActive] = useState(-1);   // 커버를 띄운 줄 (-1 = 없음)
  const m = useRef({ x: 0, y: 0, tx: 0, ty: 0, raf: 0, on: false, reduced: false });

  useEffect(() => { m.current.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; return () => cancelAnimationFrame(m.current.raf); }, []);
  // 떠 있는 커버는 목표 자리를 향해 매 프레임 남은 거리의 follow 만큼 다가감
  const follow = () => {
    const s = m.current, el = floatRef.current;
    s.raf = 0;
    if (!el) return;
    const k = s.reduced ? 1 : COVER.follow;
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
    el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`;
    if (Math.abs(s.tx - s.x) > 0.3 || Math.abs(s.ty - s.y) > 0.3) s.raf = requestAnimationFrame(follow);
  };
  // 커서(화면 좌표) → 커버 목표 자리: 커서 오른쪽, 세로로는 커서가 커버 가운데 (오른쪽 끝에 닿으면 커서 왼쪽 · 위아래는 화면 안)
  const aim = (cx, cy) => {
    const s = m.current, el = floatRef.current;
    if (!el) return;
    const w = el.offsetWidth, vw = window.innerWidth, vh = window.innerHeight;
    s.tx = cx + COVER.gap + w > vw - 8 ? cx - COVER.gap - w : cx + COVER.gap;
    s.ty = Math.max(8, Math.min(vh - w - 8, cy - w / 2));
    if (!s.on) { s.on = true; s.x = s.tx; s.y = s.ty; }   // 처음 뜰 때는 그 자리에서 바로
    if (!s.raf) s.raf = requestAnimationFrame(follow);
  };
  const onRow = (i) => (e) => { if (e.pointerType !== "mouse") return; aim(e.clientX, e.clientY); setActive(i); };
  const hide = () => { m.current.on = false; setActive(-1); };

  const open = (e, a) => {
    if (!transition || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    transition.openAlbum({ slug: a.slug, color: a.cover_color, imageUrl: coverUrl(a.thumb_path), source: e.currentTarget.querySelector("[data-list-cover]") });
  };

  const shown = active >= 0 ? albums[active] : null;
  return (
    <div {...rest} className={className}>
      <ol ref={listRef} onPointerLeave={hide} className="border-t border-(--ink)/50">
        {albums.map((a, i) => {
          const src = coverUrl(a.thumb_path);
          return (
            <li key={a.id}>
              <Link href={`/album/${a.slug}`} onClick={(e) => open(e, a)} onPointerEnter={onRow(i)} onPointerMove={onRow(i)}
                aria-label={`${a.title} — ${a.artist_names}`}
                data-list-row data-album-slug={a.slug} data-album-title={a.title} data-album-artist={a.artist_names} data-album-color={a.cover_color || "#bbcbda"} data-album-image={src || undefined}
                className={`group/row grid grid-cols-[2rem_2.75rem_minmax(0,1fr)_1.25rem] items-center gap-x-3 border-b border-(--ink)/18 py-2.5 transition-[opacity,translate] duration-500 ${arriving ? "" : "starting:translate-y-2"} starting:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ink) md:grid-cols-[3rem_3rem_minmax(0,1.5fr)_minmax(0,1fr)_4.5rem_1.25rem] md:gap-x-5 md:py-3 motion-reduce:transition-none ${active >= 0 && active !== i ? "md:opacity-40" : ""}`}
                style={{ transitionDelay: active >= 0 ? "0ms" : `${Math.min(i, 24) * 18}ms` }}>
                <span className="text-[11px] font-medium tabular-nums tracking-[0.14em] text-(--ink)/60">{String(i + 1).padStart(3, "0")}</span>
                {/* 작은 커버: 눈으로 찾는 단서이자, 앨범 상세로 날아가는 전환의 출발점 */}
                <span data-list-cover data-cover-slug={a.slug} data-cover-color={a.cover_color || "#bbcbda"} data-cover-image={src || undefined} className="block aspect-square w-full overflow-hidden" style={{ backgroundColor: a.cover_color || "#bbcbda" }}>
                  {src && <img src={src} alt="" loading="lazy" decoding="async" className="block size-full object-cover" />}
                </span>
                <span className="min-w-0 transition-transform duration-500 ease-groove group-hover/row:translate-x-2 motion-reduce:transition-none motion-reduce:group-hover/row:translate-x-0">
                  <span className="flex min-w-0 items-baseline gap-2.5">
                    <strong className="min-w-0 truncate font-['Hahmlet',Georgia,serif] text-[clamp(1rem,1.35vw,1.3rem)] font-bold leading-snug">{a.title}</strong>
                    {isNew(a) && <span className="shrink-0 rounded-full bg-[#d9603b] px-2 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.14em] text-[#fff7ea]">New</span>}
                  </span>
                  <span className="block truncate text-[13px] text-(--ink)/75 md:hidden">{a.artist_names}{a.release_year ? ` · ${a.release_year}` : ""}</span>
                </span>
                <span className="hidden min-w-0 truncate text-[14px] text-(--ink)/85 md:block">{a.artist_names}</span>
                <span className="hidden text-right text-[13px] tabular-nums text-(--ink)/70 md:block">{a.release_year ?? ""}</span>
                <span aria-hidden="true" className="text-right text-(--ink)/50 transition-[translate,color] duration-300 group-hover/row:translate-x-0.5 group-hover/row:text-(--accent)">→</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {/* 떠 있는 커버 (마우스가 있는 기기에서만 보임) */}
      <div ref={floatRef} aria-hidden="true"
        className={`pointer-events-none fixed left-0 top-0 z-30 aspect-square w-[clamp(160px,17vw,250px)] overflow-hidden shadow-[0_24px_48px_-20px_rgb(0_0_0/0.55)] transition-opacity duration-300 [@media(hover:none)]:hidden ${shown ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundColor: shown?.cover_color || "transparent" }}>
        {shown && coverUrl(shown.thumb_path) && <img key={shown.slug} src={coverUrl(shown.thumb_path)} alt="" className="block size-full object-cover" />}
      </div>
    </div>
  );
}
