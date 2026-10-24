// /admin/places — 지도 장소 전체 (숨김 포함): 검색 · 종류 필터 · 보이기/숨기기 · 수정
import Link from "next/link";
import { listPlaces } from "@/lib/admin/data";
import { AdminHeader } from "@/components/admin/AdminShell";
import PlaceTable from "@/components/admin/PlaceTable";
import { btnPrimary, btnGhost } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminPlaces() {
  const places = await listPlaces();
  return (
    <>
      <AdminHeader eyebrow={`${places.length} places · Lab Map`} title="Places">
        <Link href="/admin/places/new" className={btnPrimary}>+ New place</Link>
        <a href="/lab/map" target="_blank" rel="noreferrer" className={btnGhost}>Open map ↗︎</a>
      </AdminHeader>
      <PlaceTable places={places} />
    </>
  );
}
