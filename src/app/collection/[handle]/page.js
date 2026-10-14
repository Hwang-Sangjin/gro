// /collection/<아이디> — 공개한 사람의 컬렉션 (읽기 전용). 공개 안 했거나 없는 아이디면 404
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import PublicCollectionView from "@/components/collection/PublicCollectionView";

const load = cache(async (raw) => {
  let handle = raw;
  try { handle = decodeURIComponent(raw); } catch {}
  handle = handle.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/.test(handle)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_collection", { p_handle: handle });
  if (error) throw new Error("Couldn’t load this collection.");
  if (!data?.handle) return null;
  return { handle: data.handle, owned: data.owned ?? [], wishlist: data.wishlist ?? [] };
});

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const data = await load(handle).catch(() => null);
  if (!data) return { title: "Collection · Grooves", robots: { index: false } };
  const n = data.owned.length, w = data.wishlist.length;
  return {
    title: `@${data.handle}’s collection · Grooves`,
    description: `${n} record${n === 1 ? "" : "s"} on the shelf${w ? ` and ${w} on the wishlist` : ""} — @${data.handle} on Grooves.`,
    alternates: { canonical: `/collection/${data.handle}` },
    openGraph: {
      type: "profile", siteName: "Grooves", title: `@${data.handle}’s collection`,
      description: `${n} record${n === 1 ? "" : "s"} on the shelf${w ? ` and ${w} on the wishlist` : ""}.`,
    },
  };
}

export default async function PublicCollection({ params }) {
  const { handle } = await params;
  const data = await load(handle);
  if (!data) notFound();
  return <PublicCollectionView data={data} />;
}
