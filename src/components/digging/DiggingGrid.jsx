"use client";

// src/components/digging/DiggingGrid.jsx
// 첫 페이지는 서버에서 받아오고, 이후 페이지는 스크롤에 맞춰 브라우저에서 이어 붙인다

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import { coverUrl, fetchDiggingPage } from "@/lib/albums";

function Cover({ album }) {
  const [loaded, setLoaded] = useState(false);
  const src = coverUrl(album.thumb_path);

  return (
    // 이미지가 오기 전에는 대표색으로 칸을 채워둔다
    <span
      className="card-cover relative overflow-hidden"
      style={{ backgroundColor: album.cover_color ?? undefined }}
    >
      {src && (
        // 썸네일은 이미 400px webp 로 최적화돼 있어서 next/image 를 거치지 않는다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${album.title} 커버`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}

export default function DiggingGrid({ initial, genreId = null }) {
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

  if (items.length === 0) {
    return (
      <div className="page-empty">
        <p>아직 등록된 판이 없어요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-grid">
        {items.map((album) => (
          <Link className="card" href={`/album/${album.slug}`} key={album.id}>
            <Cover album={album} />
            <strong>{album.title}</strong>
            <span className="card-meta">
              {album.artist_names} — {album.release_year}
            </span>
          </Link>
        ))}
      </div>

      <div
        ref={sentinelRef}
        className="flex h-16 items-center justify-center text-sm opacity-60"
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
