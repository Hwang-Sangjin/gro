// /admin/albums/new — 새 앨범 등록
// 요청에서 넘어오면 (?title=&artists=&slug=&request=) 폼이 채워져 있고, 등록하면 그 요청이 "Added" 로
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminShell";
import AlbumForm from "@/components/admin/AlbumForm";
import { btnGhost } from "@/components/admin/ui";

export default async function NewAlbumPage({ searchParams }) {
  const { title = "", artists = "", slug = "", request = "" } = await searchParams;
  const prefill = title || artists ? { title, artists: artists.split(",").map((a) => a.trim()).filter(Boolean), slug } : null;
  return (
    <>
      <AdminHeader eyebrow={request ? `From request #${request}` : "Albums"} title="New album">
        {request && <Link href="/admin/requests" className={btnGhost}>← Requests</Link>}
      </AdminHeader>
      <AlbumForm prefill={prefill} requestId={request || null} />
    </>
  );
}
