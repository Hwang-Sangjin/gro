// /admin/albums/[slug] — 앨범 수정 (지금 정보가 채워진 폼)
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlbumForEdit } from "@/lib/admin/data";
import { AdminHeader } from "@/components/admin/AdminShell";
import AlbumForm from "@/components/admin/AlbumForm";
import { btnGhost } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function EditAlbumPage({ params }) {
  const { slug } = await params;
  const album = await getAlbumForEdit(decodeURIComponent(slug));
  if (!album) notFound();
  return (
    <>
      <AdminHeader eyebrow={album.artists.join(", ") || "Albums"} title={album.title}>
        <Link href="/admin/albums" className={btnGhost}>← All albums</Link>
      </AdminHeader>
      <AlbumForm key={album.slug} initial={album} />
    </>
  );
}
