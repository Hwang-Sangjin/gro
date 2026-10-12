// /admin/albums/new — 새 앨범 등록
import { AdminHeader } from "@/components/admin/AdminShell";
import AlbumForm from "@/components/admin/AlbumForm";

export default function NewAlbumPage() {
  return (
    <>
      <AdminHeader eyebrow="Albums" title="New album" />
      <AlbumForm />
    </>
  );
}
