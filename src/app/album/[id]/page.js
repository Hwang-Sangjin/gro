import { cache } from "react";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/publicSupabase";
import { coverUrl } from "@/lib/albums";
import AlbumDetailView from "@/components/album/AlbumDetailView";

// 앨범 상세는 로그인과 상관없는 공개 데이터 → 처음 열릴 때 한 번 만들어 캐시(ISR)해 두고 5분마다 새로 고침
// (관리자에서 고치면 revalidateAlbum 으로 바로 새로 만듦). 캐시된 페이지라 그리드에서 미리 받아 둘 수 있어 열리는 게 빠름
export const revalidate = 300;
export function generateStaticParams() { return []; }

// 링크 카드용 제목·설명 (로그인과 상관없는 공개 조회)
const loadMeta = cache(async (slug) => {
  const { data } = await publicClient().from("albums")
    .select("title, artist_names, release_year, format, description")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  return data;
});

export async function generateMetadata({ params }) {
  const { id: slug } = await params;
  const a = await loadMeta(slug).catch(() => null);
  if (!a) return { title: "Album · Grooves" };
  const by = a.artist_names ? ` — ${a.artist_names}` : "";
  const facts = [a.artist_names, a.release_year, a.format].filter(Boolean).join(" · ");
  const blurb = (a.description || "").replace(/\s+/g, " ").trim();
  const description = blurb ? (blurb.length > 150 ? `${blurb.slice(0, 149).trimEnd()}…` : blurb) : `${facts}. Listen and put it on your shelf on Grooves.`;
  return {
    title: `${a.title}${by} · Grooves`, description,
    alternates: { canonical: `/album/${slug}` },
    openGraph: { type: "music.album", siteName: "Grooves", title: `${a.title}${by}`, description },
  };
}

export default async function Album({ params }) {
  // Existing links pass a slug despite the historical [id] folder name.
  const { id: slug } = await params;
  const supabase = publicClient();
  const { data, error } = await supabase.from("albums")
    .select("id, slug, title, artist_names, cover_path, thumb_path, cover_color, release_year, format, label, description, youtube_playlist_id, rpm")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error("Couldn’t load album details.");
  if (!data) notFound();
  const { data: tracks, error: tracksError } = await supabase.from("tracks")
    .select("disc_no, side, side_position, title, duration_sec")
    .eq("album_id", data.id)
    .order("disc_no").order("side").order("side_position");
  return <AlbumDetailView album={{ id: data.id, slug: data.slug,
    title: data.title, artistNames: data.artist_names,
    coverUrl: coverUrl(data.cover_path || data.thumb_path), thumbUrl: coverUrl(data.thumb_path), coverColor: data.cover_color,
    releaseYear: data.release_year, format: data.format, label: data.label,
    tracksUnavailable: Boolean(tracksError),
    tracks: (tracksError ? [] : tracks || []).map(track => ({ discNo: track.disc_no,
      side: track.side, position: track.side_position, title: track.title, durationSec: track.duration_sec })),
    youtubePlaylistId: data.youtube_playlist_id, rpm: data.rpm, description: data.description }} />;
}
