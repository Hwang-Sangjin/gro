"use client";

// src/components/digging/DiggingGrid.jsx
// 첫 페이지는 서버에서 받아오고, 이후 페이지는 스크롤에 맞춰 브라우저에서 이어 붙인다

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlbumGrid from "@/components/albums/AlbumGrid";
import styles from "./Digging.module.css";

import { createClient } from "@/utils/supabase/client";
import { fetchDiggingPage } from "@/lib/albums";

export default function DiggingGrid({ initial, genreId = null, query = "", onRequest }) {
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
      const next = await fetchDiggingPage(supabase, { cursor, genreId, seed: initial.seed });
      setItems((prev) => [...prev, ...next.items]);
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    } catch {
      setError("앨범을 더 불러오지 못했어요.");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [supabase, cursor, genreId, hasMore, initial.seed]);

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
      <AlbumGrid albums={filtered} aria-busy={loading} />
      {filtered.length === 0 && (
        <div className={styles.empty} role="status">
          {error ? "Search didn’t finish. Please try again." : hasMore ? "Searching…" : <>
            <p>No records match “{query.trim()}”.</p>
            {/* 없는 판이면 바로 요청 */}
            {onRequest && <button type="button" onClick={onRequest}
              className="mt-4 inline-flex min-h-11 items-center rounded-full border border-current px-6 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
              Request this record
            </button>}
          </>}
        </div>
      )}

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
