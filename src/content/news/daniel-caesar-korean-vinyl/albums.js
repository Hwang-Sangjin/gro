// 다니엘 시저 앨범 — Grooves DB(albums)에서 한 번만 불러와 썸네일과 본문이 같이 씀
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";

// 이번 국내반 세 장 (발매순). disc: 마블 색 [많은 색, 중간, 적은 색] — 커버를 못 찾을 때 대신 보여줌
export const RELEASES = [
  { slug: "daniel-caesar-pilgrims-paradise", title: "Pilgrim’s Paradise", disc: ["#141113", "#ece7dc", "#5d5a58"], seed: 7 },
  { slug: "daniel-caesar-freudian", title: "Freudian", disc: ["#2f5fa8", "#3f8a5c", "#f2efe6"], seed: 3 },
  { slug: "daniel-caesar-case-study-01", title: "Case Study 01", disc: ["#1d3a86", "#141113", "#b8322a"], seed: 11 },
];

const low = (v) => String(v ?? "").toLowerCase().replace(/[’']/g, "").trim();
export const findRow = (rows, r) => rows?.find((a) => a.slug === r.slug) ?? rows?.find((a) => low(a.title) === low(r.title));
export const coverOf = (row) => (row?.thumb_path ? coverUrl(row.thumb_path) : null);

let cache = null;   // 같은 페이지 안에서 한 번만 요청
function load() {
  cache ??= createClient().from("albums")
    .select("slug, title, artist_names, thumb_path, cover_color, release_year")
    .eq("status", "published").ilike("artist_names", "%daniel caesar%")
    .then(({ data }) => [...(data ?? [])].sort((a, b) => (a.release_year ?? 0) - (b.release_year ?? 0) || a.title.localeCompare(b.title)),
      () => { cache = null; return []; });
  return cache;
}

// null = 불러오는 중, [] = 없음
export function useCaesar() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let off = false;
    load().then((r) => { if (!off) setRows(r); });
    return () => { off = true; };
  }, []);
  return rows;
}
