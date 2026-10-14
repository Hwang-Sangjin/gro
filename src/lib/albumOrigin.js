"use client";
// 앨범을 어느 목록에서 열었는지 기억 → 앨범 상세의 "Back to …" 버튼이 그 목록(탭·장르까지)으로 돌아감
// 새 목록 페이지를 추가하려면 ALBUM_ORIGINS 에 한 줄만 넣으면 됨 (커버가 날아가는 전환도 같이 켜짐)
import { useEffect, useState } from "react";

export const ALBUM_ORIGINS = {
  "/digging": "Digging",
  "/collection": "Collection",
};
// 공개 컬렉션 (/collection/<아이디>) 도 목록 — 돌아갈 때 "Back to @아이디"
const PUBLIC_COLLECTION = /^\/collection\/([^/]+)$/;
export function originLabel(path) {
  if (ALBUM_ORIGINS[path]) return ALBUM_ORIGINS[path];
  const m = PUBLIC_COLLECTION.exec(path);
  if (!m) return null;
  try { return `@${decodeURIComponent(m[1])}`; } catch { return `@${m[1]}`; }
}
// 커버 이동 전환을 쓰는 페이지 (Home New Vinyls 는 돌아갈 곳은 Digging 그대로)
export const isCoverFlightSource = (path) => path === "/" || originLabel(path) !== null;

const DEFAULT = { href: "/digging", label: "Digging" };
const KEY = "grooves:album-origin";

// 지금 페이지에서 slug 앨범을 연다고 기록 (탭 하나 안에서만, 새로고침해도 유지)
export function rememberAlbumOrigin(slug) {
  try {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (originLabel(path)) sessionStorage.setItem(KEY, JSON.stringify({ slug, href: path + location.search, path }));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

// 이 앨범을 연 목록 { href, label } — 기록이 없거나 다른 앨범의 기록이면 Digging
// 첫 렌더는 서버와 같게 기본값, 브라우저에서 읽은 뒤 바뀜
export function useAlbumOrigin(slug) {
  const [origin, setOrigin] = useState(DEFAULT);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
      const label = saved?.slug === slug ? originLabel(saved.path) : null;
      setOrigin(label ? { href: saved.href, label } : DEFAULT);
    } catch { setOrigin(DEFAULT); }
  }, [slug]);
  return origin;
}
