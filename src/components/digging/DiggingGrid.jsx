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

// 슬리브에서 빠져나오는 판: 잉크 홈(Home 판과 같은 크림·파랑) + 가운데 라벨은 앨범 커버
const GROOVES = "repeating-radial-gradient(circle at 50% 50%, #4f6d93 0 1.1px, #f4e7cd 1.1px 3.2px, #4f6d93 3.2px 3.9px, #f4e7cd 3.9px 6px)";
function SleeveRecord({ src, color }) {
  return (
    <span aria-hidden="true"
      className="pointer-events-none absolute inset-[3%] rounded-full opacity-0 shadow-[0_10px_24px_rgba(48,38,44,0.18)] transition-[translate,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [[data-revealed=true]>&]:opacity-100 group-hover:translate-x-[46%] group-focus-visible:translate-x-[46%] motion-reduce:transition-none">
      <span className="absolute inset-0 rounded-full group-hover:animate-[spin_3.6s_linear_infinite] motion-reduce:!animate-none"
        style={{ backgroundImage: `radial-gradient(circle, #f4e7cd 0 1.6%, transparent 1.7%), radial-gradient(circle, transparent 0 17.5%, #4f6d93 17.6% 18.4%, transparent 18.5% 47%, #4f6d93 47% 48.5%, transparent 48.6%), ${GROOVES}` }}>
        {/* 라벨 = 앨범 커버 (돌면서 그림이 같이 돎) */}
        <span className="absolute inset-[32.5%] overflow-hidden rounded-full"
          style={{ backgroundColor: color, backgroundImage: src ? `url("${src}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
          <span className="absolute left-1/2 top-1/2 h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f4e7cd]" />
        </span>
      </span>
    </span>
  );
}

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
      className={`${styles.card} group relative transition-[opacity,scale] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:scale-[1.04] focus-visible:z-10 focus-visible:scale-[1.04] motion-reduce:transition-none`} href={`/album/${album.slug}`} aria-label={`${album.title} — ${album.artist_names}`}>
      <span ref={revealRef} className={styles.hitArea} data-revealed={revealed} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
        <SleeveRecord src={failed ? null : src} color={album.cover_color || "#bbcbda"} />
        <span ref={art} data-album-source className={styles.art}>
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
