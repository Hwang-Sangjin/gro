"use client";

// src/components/digging/DiggingGrid.jsx
// 첫 페이지는 서버에서 받아오고, 이후 페이지는 스크롤에 맞춰 브라우저에서 이어 붙인다

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlbumGrid from "@/components/albums/AlbumGrid";
import AlbumList from "@/components/albums/AlbumList";
import styles from "./Digging.module.css";

import { createClient } from "@/utils/supabase/client";
import { fetchDiggingPage, fetchSortedPage } from "@/lib/albums";

// exclude: 빼고 보여 줄 앨범 id 모음 (로그인 사용자의 "Not owned" — 내가 가진 판)
// loadAll: 스크롤을 기다리지 않고 남은 묶음을 끝까지 받음 (Crate 보기 — 그리드가 덮여 있어 스크롤로는 더 안 받아짐)
// view: "list" 면 그리드 대신 글자 목록
// arriving: 다른 보기에서 커버가 날아오는 중 (AlbumList 로 넘김)
export default function DiggingGrid({ initial, genreId = null, query = "", onRequest, lead = null, exclude = null, loadAll = false, view = "grid", arriving = false }) {
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
      // 정렬해서 받은 목록(initial.sort)이면 다음 묶음도 같은 순서로
      const next = initial.sort ? await fetchSortedPage(supabase, { sort: initial.sort, cursor, genreId }) : await fetchDiggingPage(supabase, { cursor, genreId, seed: initial.seed });
      setItems((prev) => [...prev, ...next.items]);
      setCursor(next.cursor);
      setHasMore(next.hasMore);
    } catch {
      setError("Couldn’t load more records.");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [supabase, cursor, genreId, hasMore, initial.seed, initial.sort]);

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
  useEffect(() => {
    if (loadAll && hasMore && !loading && !error) loadMore();
  }, [loadAll, hasMore, loading, error, loadMore]);
  const filtered = items.filter(album => (!exclude || !exclude.has(album.id)) && (!term ||
    `${album.title} ${album.artist_names}`.toLocaleLowerCase().includes(term)));
  // 빼고 나니 보이는 판이 적으면 다음 묶음을 바로 이어서 받음 (화면이 비어 보이지 않게)
  useEffect(() => {
    if (exclude && filtered.length < 8 && hasMore && !loading && !error) loadMore();
  }, [exclude, filtered.length, hasMore, loading, error, loadMore]);

  if (items.length === 0 && !hasMore && !loading) {   // 첫 화면이 비어 왔으면(서버가 못 읽음) 아래 sentinel 이 바로 불러옴
    return (
      <div className="page-empty">
        <p>No records in the crate yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* 앨범에 마우스를 올리면 나머지 앨범은 흐려짐 (마우스를 떼면 원래대로) */}
      {view === "list" && filtered.length > 0 ? <AlbumList albums={filtered} aria-busy={loading} arriving={arriving} /> : <AlbumGrid albums={filtered} aria-busy={loading} lead={lead}>
        {/* 다음 묶음이 남아 있는 동안 그리드 끝에 빈 재킷 자리 한 줄 → 받아 오는 사이에 화면이 비지 않음 */}
        {hasMore && !error && !term && filtered.length > 0 && [0, 1, 2, 3].map((i) => (
          <span key={`sk${i}`} aria-hidden="true" className={styles.skeleton} style={{ "--i": i }}><span /><span /></span>
        ))}
      </AlbumGrid>}
      {filtered.length === 0 && (
        <div className={styles.empty} role="status">
          {error ? "Search didn’t finish. Please try again." : hasMore ? "Searching…" : <>
            <p>{term ? <>No records match “{query.trim()}”.</> : "You already own every record here."}</p>
            {/* 없는 판이면 바로 요청 */}
            {onRequest && term && <button type="button" onClick={onRequest}
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
        {loading && <span className="sr-only">Loading…</span>}
        {error && (
          <button type="button" className="chip" onClick={loadMore}>
            Try again
          </button>
        )}
      </div>
    </>
  );
}
