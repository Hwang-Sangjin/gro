// /admin/albums/cover — 커버만 교체 (?slug= 로 앨범을 미리 채워서 열 수 있음)
import { AdminHeader } from "@/components/admin/AdminShell";
import CoverForm from "@/components/admin/CoverForm";

export default async function ReplaceCoverPage({ searchParams }) {
  const { slug = "" } = await searchParams;
  return (
    <>
      <AdminHeader eyebrow="Albums" title="Replace cover" />
      <CoverForm initialSlug={slug} />
    </>
  );
}
