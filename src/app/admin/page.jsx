// /admin — 대시보드: 숫자 한눈에 + 최근 등록한 앨범 + 바로가기
import Link from "next/link";
import { getDashboard } from "@/lib/admin/data";
import { coverUrl } from "@/lib/albums";
import { AdminHeader } from "@/components/admin/AdminShell";
import { SERIF, card, btnPrimary, btnGhost } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-(--ink)/55">{label}</p>
      <p className={`${SERIF} mt-3 text-[44px] leading-none tabular-nums`}>{value}</p>
      {hint && <p className="mt-2 text-[12px] text-(--ink)/50">{hint}</p>}
    </div>
  );
}

export default async function AdminHome() {
  const d = await getDashboard();
  return (
    <>
      <AdminHeader eyebrow="Overview" title="Dashboard">
        <Link href="/admin/albums/new" className={btnPrimary}>+ New album</Link>
        <Link href="/admin/albums" className={btnGhost}>All albums</Link>
      </AdminHeader>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Published" value={d.published} hint="Visible on Digging" />
        <Stat label="Hidden" value={d.draft} hint="Drafts, not on the site" />
        <Stat label="Members" value={d.users} hint="Signed in with Google" />
        <Stat label="On shelves" value={d.owned + d.wishlist} hint={`${d.owned} owned · ${d.wishlist} wishlist`} />
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">Recently added</h2>
          <Link href="/admin/albums" className="text-[12px] text-(--ink)/60 underline-offset-4 hover:text-(--ink) hover:underline">See all</Link>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {d.recent.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/albums/${encodeURIComponent(a.slug)}`} className="group block">
                <span className="relative block aspect-square overflow-hidden rounded-lg" style={{ backgroundColor: a.cover_color || "#bbcbda" }}>
                  {a.thumb_path && <img src={coverUrl(a.thumb_path)} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  {a.status !== "published" && <span className="absolute left-2 top-2 rounded-full bg-(--cream) px-2 py-0.5 text-[10px] uppercase tracking-[0.15em]">Hidden</span>}
                </span>
                <span className="mt-2 block truncate text-[13px] font-medium">{a.title}</span>
                <span className="block truncate text-[12px] text-(--ink)/55">{a.artist_names}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
