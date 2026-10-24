// /admin/places/new — 새 장소 (카카오 검색 또는 지도 클릭으로 위치)
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminShell";
import PlaceForm from "@/components/admin/PlaceForm";
import { btnGhost } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default function NewPlacePage() {
  return (
    <>
      <AdminHeader eyebrow="Places" title="New place">
        <Link href="/admin/places" className={btnGhost}>← All places</Link>
      </AdminHeader>
      <PlaceForm />
    </>
  );
}
