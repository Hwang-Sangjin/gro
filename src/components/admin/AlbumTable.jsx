"use client";
// 관리자 앨범 목록: 검색(제목·아티스트·slug), 상태 필터, 공개/숨김 전환(바로 반영)
import { useMemo, useState } from "react";
import Link from "next/link";
import { coverUrl } from "@/lib/albums";
import { field } from "./ui";

const FILTERS = [["all", "All"], ["published", "Published"], ["draft", "Hidden"]];

export default function AlbumTable({ albums: initial }) {
  const [albums, setAlbums] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return albums.filter((a) =>
      (filter === "all" || (filter === "published" ? a.status === "published" : a.status !== "published")) &&
      (!q || `${a.title} ${a.artist_names} ${a.slug}`.toLocaleLowerCase().includes(q)));
  }, [albums, query, filter]);

  async function toggle(a) {
    const status = a.status === "published" ? "draft" : "published";
    setBusy(a.slug); setError("");
    try {
      const res = await fetch("/api/admin/albums/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: a.slug, status }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAlbums((list) => list.map((x) => (x.slug === a.slug ? { ...x, status } : x)));
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, artist, slug" aria-label="Search albums" className={`${field} max-w-sm`} />
        <div role="tablist" aria-label="Status" className="flex gap-1 rounded-full border border-(--ink)/15 p-1">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
              className="rounded-full px-3.5 py-1.5 text-[12px] tracking-[0.04em] text-(--ink)/60 aria-selected:bg-(--ink) aria-selected:text-(--cream)">{label}</button>
          ))}
        </div>
        <span className="text-[12px] text-(--ink)/50 tabular-nums">{shown.length} shown</span>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-(--danger)/10 px-4 py-3 text-[13px] text-(--danger)">{error}</p>}

      <ul className="divide-y divide-(--ink)/10 border-y border-(--ink)/10">
        {shown.map((a) => (
          <li key={a.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 py-3 md:grid-cols-[56px_1fr_120px_110px_auto]">
            <span className="block size-14 overflow-hidden rounded-md" style={{ backgroundColor: a.cover_color || "#bbcbda" }}>
              {a.thumb_path && <img src={coverUrl(a.thumb_path)} alt="" loading="lazy" className="size-full object-cover" />}
            </span>
            <div className="min-w-0">
              <Link href={`/admin/albums/${encodeURIComponent(a.slug)}`} className="block truncate text-[15px] font-medium hover:underline">{a.title}</Link>
              <p className="truncate text-[12px] text-(--ink)/55">{a.artist_names} · <span className="font-mono">{a.slug}</span></p>
            </div>
            <span className="hidden text-[12px] text-(--ink)/55 md:block">{[a.format, a.release_year].filter(Boolean).join(" · ")}</span>
            <button type="button" onClick={() => toggle(a)} disabled={busy === a.slug} aria-pressed={a.status === "published"}
              title={a.status === "published" ? "Click to hide" : "Click to publish"}
              className="hidden items-center gap-2 justify-self-start rounded-full border border-(--ink)/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors hover:border-(--ink) disabled:opacity-50 md:inline-flex">
              <span className={`size-2 rounded-full ${a.status === "published" ? "bg-[#4f9d69]" : "bg-(--ink)/30"}`} />
              {a.status === "published" ? "Live" : "Hidden"}
            </button>
            <div className="flex gap-1.5 justify-self-end text-[12px]">
              <Link href={`/admin/albums/${encodeURIComponent(a.slug)}`} className="rounded-full px-3 py-1.5 hover:bg-(--ink)/6">Edit</Link>
              <Link href={`/admin/albums/cover?slug=${encodeURIComponent(a.slug)}`} className="hidden rounded-full px-3 py-1.5 hover:bg-(--ink)/6 sm:inline">Cover</Link>
              {a.status === "published" && <a href={`/album/${encodeURIComponent(a.slug)}`} target="_blank" rel="noreferrer" className="hidden rounded-full px-3 py-1.5 hover:bg-(--ink)/6 sm:inline">View ↗</a>}
            </div>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="py-16 text-center text-[14px] text-(--ink)/55">No albums match.</p>}
    </div>
  );
}
