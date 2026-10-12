// /admin/albums/new — 새 앨범 등록
// 요청에서 넘어오면 (?request=id) 요청에 적힌 값(제목·아티스트·장르·발매·트랙·커버…)으로 폼이 채워지고,
// 등록하면 그 요청이 "Added" 로 바뀜
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminShell";
import AlbumForm from "@/components/admin/AlbumForm";
import { btnGhost } from "@/components/admin/ui";
import { getRequest } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");

export default async function NewAlbumPage({ searchParams }) {
  const { title = "", artists = "", slug = "", request = "" } = await searchParams;
  const r = request ? await getRequest(Number(request)) : null;
  const prefill = r ? {
    title: r.title, artists: [r.artist], slug: slugify(`${r.artist} ${r.title}`),
    genres: r.genres ?? [], releaseDate: r.release_date ?? "", releaseYear: r.release_year ? String(r.release_year) : "",
    format: r.format ?? "", label: r.label ?? "", catalogNo: r.catalog_no ?? "", youtubePlaylistId: r.youtube_playlist ?? "",
    tracks: r.tracks ?? "", requestCoverPath: r.cover_path ?? null,   // 메모(note)는 관리자에게 하는 말이라 설명에는 안 넣음
  } : title || artists ? { title, artists: artists.split(",").map((a) => a.trim()).filter(Boolean), slug } : null;
  return (
    <>
      <AdminHeader eyebrow={request ? `From request #${request}` : "Albums"} title="New album">
        {request && <Link href="/admin/requests" className={btnGhost}>← Requests</Link>}
      </AdminHeader>
      <AlbumForm prefill={prefill} requestId={request || null} />
    </>
  );
}
