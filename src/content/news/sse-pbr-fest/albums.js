// 김현창 바이닐 두 장 — Grooves DB(albums)에서 불러와 앨범 아트와 상세 링크에 씀 (다니엘 시저 글과 같은 방식)
// 앨범은 관리자(/admin/albums)에서 등록: 아티스트 "김현창", status published, 커버 업로드. 등록되기 전까지는 판 그림 자리표시로 보임
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";

export const RELEASES = [
  { kind: "EP · VINYL", title: "마침내 우리가 화원이 되기를", bg: "bg-(--sse-g)" },
  { kind: "1st ALBUM · VINYL", title: "살아서 슬퍼야지, 그렇게 선명히 너를 사랑해야지", bg: "bg-(--sse-p)" },
];

const norm = (v) => String(v ?? "").toLowerCase().replace(/[\s\[\]《》'’“”"]/g, "");
export const findRow = (rows, r) => rows?.find((a) => norm(a.title) === norm(r.title)) ?? null;
export const coverOf = (row) => (row?.thumb_path ? coverUrl(row.thumb_path) : null);

let cache = null;   // 같은 페이지 안에서 한 번만 요청
function load() {
  cache ??= createClient().from("albums")
    .select("slug, title, artist_names, thumb_path, cover_color, release_year")
    .eq("status", "published").ilike("artist_names", "%김현창%")
    .then(({ data }) => data ?? [], () => { cache = null; return []; });
  return cache;
}

// null = 불러오는 중, [] = 없음
export function useKimHyunchang() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let off = false;
    load().then((r) => { if (!off) setRows(r); });
    return () => { off = true; };
  }, []);
  return rows;
}
