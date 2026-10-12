"use client";
// 관리자 요청 목록
// - Add album: 앨범 등록 폼을 요청 내용으로 채워서 엶 → 등록하면 이 요청이 자동으로 "Added"
// - Link existing: 이미 있는 앨범이면 slug 만 넣어 "Added" 로
// - Decline: 이유(선택)를 남기고 반려 → 요청한 사람의 Request 창에 보임
import { useMemo, useState } from "react";
import Link from "next/link";
import { field, btnPrimary, btnGhost } from "./ui";
import { requestCoverUrl } from "@/lib/requests";
import { GENRES } from "@/lib/genres";
import { parseTracks } from "@/lib/tracks";

const GENRE_NAME = Object.fromEntries(GENRES.map((g) => [g.slug, g.name]));

const FILTERS = [["pending", "Waiting"], ["added", "Added"], ["declined", "Declined"], ["all", "All"]];
const DOT = { pending: "bg-[#d9b44a]", added: "bg-[#4f9d69]", declined: "bg-(--ink)/30" };
const when = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function RequestTable({ requests: initial }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState("pending");
  const [open, setOpen] = useState(null);      // { id, mode: "link" | "decline" }
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const counts = useMemo(() => rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] ?? 0) + 1 }), {}), [rows]);
  const shown = rows.filter((r) => filter === "all" || r.status === filter);

  async function update(r, body) {
    setBusy(r.id); setError("");
    try {
      const res = await fetch("/api/admin/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, ...body }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setRows((list) => list.map((x) => (x.id === r.id ? { ...x, ...json } : x)));
      setOpen(null); setText("");
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  }

  return (
    <div>
      <div role="tablist" aria-label="상태" className="mb-6 flex w-max gap-1 rounded-full border border-(--ink)/15 p-1">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
            className="rounded-full px-3.5 py-1.5 text-[12px] tracking-[0.04em] text-(--ink)/60 aria-selected:bg-(--ink) aria-selected:text-(--cream)">
            {label}{key !== "all" && <span className="ml-1.5 tabular-nums opacity-60">{counts[key] ?? 0}</span>}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-[#c8553d]/10 px-4 py-3 text-[13px] text-[#c8553d]">{error}</p>}

      <ul className="divide-y divide-(--ink)/10 border-y border-(--ink)/10">
        {shown.map((r) => {
          const who = r.profiles?.display_name || r.profiles?.email || "Member";
          const addHref = `/admin/albums/new?request=${r.id}`;   // 요청 내용 전체로 등록 폼을 채움
          const meta = [r.release_date || r.release_year, r.format, r.label, r.catalog_no].filter(Boolean);
          const trackRows = r.tracks ? parseTracks(r.tracks).rows : [];
          return (
            <li key={r.id} className="grid gap-3 py-5 md:grid-cols-[auto_1fr_auto] md:items-start md:gap-5">
              {r.cover_path
                ? <a href={requestCoverUrl(r.cover_path)} target="_blank" rel="noreferrer" title="Cover from the request" className="block size-20 overflow-hidden rounded-lg"><img src={requestCoverUrl(r.cover_path)} alt="" className="size-full object-cover" /></a>
                : <span aria-hidden="true" className="hidden size-20 place-items-center rounded-lg border border-dashed border-(--ink)/20 text-[10px] uppercase tracking-[0.12em] text-(--ink)/35 md:grid">No cover</span>}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`size-2 rounded-full ${DOT[r.status]}`} aria-hidden="true" />
                  <p className="text-[16px] font-medium">{r.title}</p>
                  <p className="text-[14px] text-(--ink)/65">— {r.artist}</p>
                </div>
                <p className="mt-1 text-[12px] text-(--ink)/50">{who}{r.profiles?.email && r.profiles?.display_name ? ` · ${r.profiles.email}` : ""} · {when(r.created_at)}</p>
                {r.link && <a href={r.link} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block max-w-full truncate text-[13px] underline underline-offset-4">{r.link}</a>}
                {r.note && <p className="mt-2 max-w-2xl whitespace-pre-line text-[13px] leading-6 text-(--ink)/75">{r.note}</p>}
                {(meta.length > 0 || r.genres?.length > 0 || r.youtube_playlist) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                    {r.genres?.map((g) => <span key={g} className="rounded-full border border-(--ink)/20 px-2 py-0.5">{GENRE_NAME[g] ?? g}</span>)}
                    {meta.length > 0 && <span className="text-(--ink)/60">{meta.join(" · ")}</span>}
                    {r.youtube_playlist && <a href={r.youtube_playlist.startsWith("http") ? r.youtube_playlist : `https://www.youtube.com/playlist?list=${r.youtube_playlist}`} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">YouTube ↗</a>}
                  </div>
                )}
                {trackRows.length > 0 && (
                  <details className="mt-2 text-[12px]">
                    <summary className="cursor-pointer text-(--ink)/65">{trackRows.length} tracks</summary>
                    <ol className="mt-2 max-w-xl space-y-0.5 font-mono text-[12px] text-(--ink)/75">
                      {trackRows.map((t, i) => <li key={i}>{t.side} · {t.title}{t.duration ? ` · ${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, "0")}` : ""}</li>)}
                    </ol>
                  </details>
                )}
                {r.status === "added" && r.album_slug && <p className="mt-2 text-[13px]">Added as <Link href={`/admin/albums/${encodeURIComponent(r.album_slug)}`} className="font-mono underline underline-offset-4">{r.album_slug}</Link></p>}
                {r.status === "declined" && <p className="mt-2 text-[13px] text-(--ink)/60">Declined{r.admin_note ? ` — “${r.admin_note}”` : ""}</p>}

                {open?.id === r.id && (
                  <form className="mt-4 flex max-w-xl flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); update(r, open.mode === "link" ? { status: "added", album_slug: text } : { status: "declined", admin_note: text }); }}>
                    <input autoFocus className={`${field} min-w-0 flex-1 ${open.mode === "link" ? "font-mono" : ""}`} value={text} onChange={(e) => setText(e.target.value)}
                      required={open.mode === "link"} placeholder={open.mode === "link" ? "existing-album-slug" : "Reason (optional, shown to the member)"} />
                    <button type="submit" disabled={busy === r.id} className={btnPrimary}>{open.mode === "link" ? "Mark added" : "Decline"}</button>
                    <button type="button" onClick={() => setOpen(null)} className={btnGhost}>Cancel</button>
                  </form>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {r.status === "pending" ? <>
                  <Link href={addHref} className={btnPrimary}>Add album</Link>
                  <button type="button" onClick={() => { setOpen({ id: r.id, mode: "link" }); setText(""); }} className={btnGhost}>Link existing</button>
                  <button type="button" onClick={() => { setOpen({ id: r.id, mode: "decline" }); setText(""); }} className={btnGhost}>Decline</button>
                </> : (
                  <button type="button" disabled={busy === r.id} onClick={() => update(r, { status: "pending" })} className={btnGhost}>Reopen</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="py-16 text-center text-[14px] text-(--ink)/55">{filter === "pending" ? "No requests waiting. The crate is all caught up." : "Nothing here yet."}</p>}
    </div>
  );
}
