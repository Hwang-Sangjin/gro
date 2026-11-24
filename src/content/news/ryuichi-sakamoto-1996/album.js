// 류이치 사카모토 — Grooves DB(albums)에서 한 번만 불러와 썸네일과 본문이 같이 씀
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";

export const ALBUM_SLUG = "ryuichi-sakamoto-1996";
export const coverOf = (row) => (row?.thumb_path ? coverUrl(row.thumb_path) : null);

let cache = null;   // 같은 페이지 안에서 한 번만 요청
function load() {
  cache ??= createClient().from("albums")
    .select("slug, title, artist_names, cover_path, thumb_path, cover_color, release_year")
    .eq("status", "published").ilike("artist_names", "%sakamoto%")
    .then(({ data }) => [...(data ?? [])].sort((a, b) => (a.release_year ?? 0) - (b.release_year ?? 0) || a.title.localeCompare(b.title)),
      () => { cache = null; return []; });
  return cache;
}

// null = 불러오는 중, [] = 없음
export function useSakamoto() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    load().then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, []);
  return rows;
}
