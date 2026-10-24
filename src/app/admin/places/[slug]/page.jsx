// /admin/places/[slug] — 장소 수정
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceForEdit } from "@/lib/admin/data";
import { AdminHeader } from "@/components/admin/AdminShell";
import PlaceForm from "@/components/admin/PlaceForm";
import { btnGhost } from "@/components/admin/ui";
import { kindOf } from "@/lib/places";

export const dynamic = "force-dynamic";

export default async function EditPlacePage({ params }) {
  const { slug } = await params;
  const place = await getPlaceForEdit(decodeURIComponent(slug));
  if (!place) notFound();
  return (
    <>
      <AdminHeader eyebrow={[kindOf(place.kind).ko, place.area].filter(Boolean).join(" · ")} title={place.name}>
        <Link href="/admin/places" className={btnGhost}>← All places</Link>
      </AdminHeader>
      <PlaceForm key={place.slug} initial={place} />
    </>
  );
}
