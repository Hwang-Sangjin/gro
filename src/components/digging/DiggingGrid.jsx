"use client";

// src/components/digging/DiggingGrid.jsx
// 첫 페이지는 서버에서 받아오고, 이후 페이지는 스크롤에 맞춰 브라우저에서 이어 붙인다

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import useReveal from "./useReveal";
import styles from "./Digging.module.css";

import { createClient } from "@/utils/supabase/client";
import { coverUrl, fetchDiggingPage } from "@/lib/albums";

function AlbumCard({ album, onTint }) {
  const transition = useAlbumTransition();
  function open(event) {
    if (!transition || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    transition.openAlbum({ slug: album.slug, color: album.cover_color,
      imageUrl: failed ? null : src, source: art.current });
  }
  const [failed, setFailed] = useState(false);
  const src = coverUrl(album.thumb_path);
  const art = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef(null);
  // A server-rendered cached image may finish before React attaches onLoad.
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !src) return;
    let cancelled = false;
    const complete = () => {
      if (cancelled) return;
      if (image.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    };
    const error = () => { if (!cancelled) setFailed(true); };
    image.addEventListener("load", complete);
    image.addEventListener("error", error);
    if (image.complete) complete();
    return () => {
      cancelled = true;
      image.removeEventListener("load", complete);
      image.removeEventListener("error", error);
    };
  }, [src]);
  // Expand the color panel even while the network is still loading the image.
  const [revealRef, revealed] = useReveal({ randomDelay: true });
  function move(event) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    art.current?.style.setProperty("--rx", `${-y * 7}deg`);
    art.current?.style.setProperty("--ry", `${x * 7}deg`);
  }
  function reset() {
    art.current?.style.setProperty("--rx", "0deg");
    art.current?.style.setProperty("--ry", "0deg");
  }
  return (
    <Link data-crate-skip data-album-slug={album.slug} data-album-color={album.cover_color || "#bbcbda"} data-album-image={failed ? undefined : src} onClick={open}
      onPointerEnter={(e) => { if (e.pointerType !== "touch") onTint?.(album.cover_color); }}
      className={`${styles.card} group relative [--sleeve-depth:clamp(6px,0.7vw,12px)] [transition:opacity_500ms_ease-in-out_100ms,scale_500ms_cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:scale-[1.04] focus-visible:z-10 focus-visible:scale-[1.04] motion-reduce:transition-none`} href={`/album/${album.slug}`} aria-label={`${album.title} — ${album.artist_names}`}>
      <span ref={revealRef} className={styles.hitArea} data-revealed={revealed} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
        <span ref={art} data-album-source className={styles.art}>
          {/* 호버하면 슬리브에 두께가 생김: 위·오른쪽 면이 비스듬히 솟아 종이 재킷 상자처럼 보임 */}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-0 h-0 w-full origin-bottom-left -skew-x-45 bg-[#e6d2ab] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:h-[var(--sleeve-depth)] group-focus-visible:h-[var(--sleeve-depth)] motion-reduce:transition-none" />
          <span aria-hidden="true" className="pointer-events-none absolute left-full top-0 h-full w-0 origin-top-left -skew-y-45 bg-[#b89a6c] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-[var(--sleeve-depth)] group-focus-visible:w-[var(--sleeve-depth)] motion-reduce:transition-none" />
          <span className={styles.revealPanel} data-image-ready={loaded || failed || !src} style={{ backgroundColor: album.cover_color || "#bbcbda" }}>
          {src && !failed ? <img ref={imageRef} src={src} alt="" loading="lazy" decoding="async" /> : <span className={styles.placeholder} aria-hidden="true">G</span>}
          </span>
        </span>
      </span>
      <span className={styles.caption}><strong>{album.title}</strong><span>{album.artist_names}</span></span>
    </Link>
  );
}

export default function DiggingGrid({ initial, genreId = null, query = "" }) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.cursor);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sentinelRef = useRef(null);
  const busyRef = useRef(false); // 같은 커서로 두 번 요청하는 걸 막는다

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const next = await fetchDiggingPage(supabase, { cursor, genreId });
      setItems((prev) => [...prev, ...next.items]);
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    } catch {
      setError("앨범을 더 불러오지 못했어요.");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [supabase, cursor, genreId, hasMore]);

  // 바닥 600px 전에 미리 다음 페이지를 요청한다
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || error) return;

    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore, error]);

  // The existing RPC has no search argument. For an active search, traverse
  // every page in the selected genre before reporting a definitive no-result.
  const term = query.trim().toLocaleLowerCase();
  useEffect(() => {
    if (term && hasMore && !loading && !error) loadMore();
  }, [term, hasMore, loading, error, loadMore]);
  // 마우스를 올린 앨범의 색이 종이에 아주 옅게 번짐 (그리드를 벗어나면 원래 종이색)
  const gridRef = useRef(null);
  const tint = useCallback((color) => {
    const page = gridRef.current?.closest(".ct-page");   // 헤더도 같은 종이색이 되도록 페이지 레이어 전체에
    if (!page) return;
    if (color) page.style.setProperty("--dig-tint", color);
    else page.style.removeProperty("--dig-tint");
  }, []);
  useEffect(() => () => tint(null), [tint]);
  const filtered = items.filter(album => !term ||
    `${album.title} ${album.artist_names}`.toLocaleLowerCase().includes(term));

  if (items.length === 0) {
    return (
      <div className="page-empty">
        <p>아직 등록된 판이 없어요.</p>
      </div>
    );
  }

  return (
    <>
      {/* 앨범에 마우스를 올리면 나머지 앨범은 흐려짐 (마우스를 떼면 원래대로) */}
      <div ref={gridRef} className={`${styles.grid} [@media(hover:hover)_and_(pointer:fine)]:[&:has(>a:hover)>a:not(:hover)]:opacity-35`} aria-busy={loading} onPointerLeave={() => tint(null)}>
        {filtered.map(album => <AlbumCard key={album.id} album={album} onTint={tint} />)}
      </div>
      {filtered.length === 0 && <p className={styles.empty} role="status">{error ? "검색을 완료하지 못했어요. 다시 시도해 주세요." : hasMore ? "검색 중…" : "검색한 앨범이 없어요."}</p>}

      <div
        ref={sentinelRef}
        className={styles.status}
        role="status"
      >
        {loading && "불러오는 중…"}
        {error && (
          <button type="button" className="chip" onClick={loadMore}>
            다시 시도
          </button>
        )}
      </div>
    </>
  );
}
