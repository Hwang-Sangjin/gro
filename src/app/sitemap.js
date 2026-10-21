// /sitemap.xml — 검색엔진이 찾을 페이지 목록: 메인 페이지들 + 공개된 앨범 + News 글 + 공개한 컬렉션
import { SITE } from "@/lib/site";
import { STORIES } from "@/content/news";
import { publicClient } from "@/lib/publicSupabase";

export const revalidate = 3600;   // 한 시간마다 새로 만듦

export default async function sitemap() {
  const at = (path) => `${SITE.url}${path}`;
  const pages = [
    { url: at("/"), changeFrequency: "daily", priority: 1 },
    { url: at("/digging"), changeFrequency: "daily", priority: 0.9 },
    { url: at("/news"), changeFrequency: "weekly", priority: 0.7 },
    { url: at("/lab/brick"), changeFrequency: "monthly", priority: 0.6 },
    { url: at("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: at("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
  const stories = STORIES.map((s) => ({
    url: at(`/news/${s.slug}`), lastModified: new Date(`${s.date}T12:00:00+09:00`), changeFrequency: "monthly", priority: 0.6,
  }));

  // DB를 못 읽어도 사이트맵은 나오게 (앨범·컬렉션만 빠짐)
  let albums = [], collections = [];
  try {
    const supabase = publicClient();
    const [a, c] = await Promise.all([
      supabase.from("albums").select("slug, created_at").eq("status", "published").order("created_at", { ascending: false }).limit(5000),
      supabase.rpc("public_collection_handles"),
    ]);
    albums = (a.data ?? []).map((x) => ({
      url: at(`/album/${encodeURIComponent(x.slug)}`), lastModified: x.created_at ? new Date(x.created_at) : undefined, changeFrequency: "monthly", priority: 0.8,
    }));
    collections = (Array.isArray(c.data) ? c.data : []).map((handle) => ({
      url: at(`/collection/${encodeURIComponent(handle)}`), changeFrequency: "weekly", priority: 0.4,
    }));
  } catch {}

  return [...pages, ...stories, ...albums, ...collections];
}
