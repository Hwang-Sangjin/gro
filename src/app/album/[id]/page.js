import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { coverUrl } from "@/lib/albums";
import AlbumDetailView from "@/components/album/AlbumDetailView";

export default async function Album({ params }) {
  // Existing links pass a slug despite the historical [id] folder name.
  const { id: slug } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("albums")
    .select("id, slug, title, artist_names, cover_path, thumb_path, cover_color, release_year, format, label, description")
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error("앨범 정보를 불러오지 못했습니다.");
  if (!data) notFound();
  return <AlbumDetailView album={{ id: data.id, slug: data.slug,
    title: data.title, artistNames: data.artist_names,
    coverUrl: coverUrl(data.cover_path || data.thumb_path), thumbUrl: coverUrl(data.thumb_path), coverColor: data.cover_color,
    releaseYear: data.release_year, format: data.format, label: data.label,
    description: data.description }} />;
}
