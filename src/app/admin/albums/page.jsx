// /admin/albums — 전체 앨범 (숨김 포함): 검색 · 공개/숨김 전환 · 수정 · 커버 교체
import Link from "next/link";
import { listAlbums } from "@/lib/admin/data";
import { AdminHeader } from "@/components/admin/AdminShell";
import AlbumTable from "@/components/admin/AlbumTable";
import { btnPrimary } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminAlbums() {
  const albums = await listAlbums();
  return (
    <>
      <AdminHeader eyebrow={`${albums.length} records`} title="Albums">
        <Link href="/admin/albums/new" className={btnPrimary}>+ New album</Link>
      </AdminHeader>
      <AlbumTable albums={albums} />
    </>
  );
}
