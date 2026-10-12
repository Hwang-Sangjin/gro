"use client";
// 앨범 등록·수정 폼 (관리자)
// - initial 이 없으면 새 앨범, 있으면 그 앨범 수정 (slug 고정, 커버는 바꿀 때만 올림)
// - 트랙은 "A | 제목 | 4:32" 한 줄씩. A·B면 = LP1, C·D면 = LP2 … 자동
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GENRES } from "@/lib/genres";
import { coverUrl } from "@/lib/albums";
import { parseTracks, FORMATS } from "@/lib/tracks";
import { requestCoverUrl } from "@/lib/requests";
import { field, labelCls, btnPrimary, btnGhost, card } from "./ui";

const mmss = (sec) => (sec == null ? "" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);

const fromAlbum = (a) => ({
  slug: a?.slug ?? "",
  title: a?.title ?? "",
  artists: (a?.artists ?? []).join(", "),
  releaseDate: a?.release_date ?? "",
  releaseYear: a?.release_year ? String(a.release_year) : "",
  format: a?.format ?? "LP",
  label: a?.label ?? "",
  catalogNo: a?.catalog_no ?? "",
  youtubePlaylistId: a?.youtube_playlist_id ?? "",
  isReissue: !!a?.is_reissue,
  description: a?.description ?? "",
  status: a?.status === "published" || !a ? "published" : "draft",
});
const tracksText = (a) => (a?.tracks ?? []).map((t) => [t.side, t.title, mmss(t.duration_sec)].filter(Boolean).join(" | ")).join("\n");

export default function AlbumForm({ initial = null, prefill = null, requestId = null }) {
  const editing = !!initial;
  const router = useRouter();
  // 새 앨범인데 요청에서 넘어왔으면 제목·아티스트·slug 를 채워 둠
  const [form, setForm] = useState(() => {
    if (initial) return fromAlbum(initial);
    const base = fromAlbum(null);
    if (!prefill) return base;
    const keep = (v, d) => (v == null || v === "" ? d : v);
    return {
      ...base,
      title: keep(prefill.title, ""), artists: (prefill.artists ?? []).join(", "), slug: keep(prefill.slug, ""),
      releaseDate: keep(prefill.releaseDate, ""), releaseYear: keep(prefill.releaseYear, ""), format: keep(prefill.format, base.format),
      label: keep(prefill.label, ""), catalogNo: keep(prefill.catalogNo, ""), youtubePlaylistId: keep(prefill.youtubePlaylistId, ""),
      description: keep(prefill.description, ""),
    };
  });
  // 요청자가 올린 커버 (새 파일을 고르지 않으면 이걸로 등록)
  const [requestCover, setRequestCover] = useState(prefill?.requestCoverPath ?? null);
  const [genres, setGenres] = useState(initial?.genres ?? prefill?.genres ?? []);
  const [trackText, setTrackText] = useState(() => (initial ? tracksText(initial) : prefill?.tracks ?? ""));
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!cover) return setPreview(null);
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const parsed = useMemo(() => parseTracks(trackText), [trackText]);
  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value, ...(key === "releaseDate" && value ? { releaseYear: value.slice(0, 4) } : {}) }));
  };
  const toggleGenre = (slug) => setGenres((g) => (g.includes(slug) ? g.filter((x) => x !== slug) : [...g, slug]));

  async function submit(e) {
    e.preventDefault();
    setResult(null);
    if (parsed.errors.length) return setResult({ error: parsed.errors[0] });
    setBusy(true);
    try {
      const fd = new FormData();
      if (cover) fd.append("cover", cover);
      fd.append("payload", JSON.stringify({
        ...form,
        releaseYear: Number(form.releaseYear) || null,
        artists: form.artists.split(",").map((s) => s.trim()).filter(Boolean),
        genres,
        requestCoverPath: !cover && requestCover ? requestCover : null,
        tracks: parsed.rows,
      }));
      const res = await fetch("/api/admin/albums", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // 요청에서 시작한 등록이면 그 요청을 "Added" 로 (요청한 사람이 바로 들으러 갈 수 있게)
      let linked = false;
      if (!editing && requestId) {
        const r = await fetch("/api/admin/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(requestId), status: "added", album_slug: json.slug }) });
        linked = r.ok;
      }
      setResult({ ok: { ...json, linked } });
      setCover(null);
      if (editing) router.refresh();
      else { setForm(fromAlbum(null)); setGenres([]); setTrackText(""); }
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  const currentCover = initial?.thumb_path ? coverUrl(initial.thumb_path) : requestCover ? requestCoverUrl(requestCover) : null;

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="f-title">Title</label>
            <input id="f-title" className={field} value={form.title} onChange={set("title")} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="f-slug">Slug (URL)</label>
            <input id="f-slug" className={`${field} font-mono`} value={form.slug} onChange={set("slug")} placeholder="jannabi-legend" required readOnly={editing}
              title={editing ? "The slug is the page address, so it can’t change while editing" : undefined} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="f-artists">Artists (comma separated)</label>
          <input id="f-artists" className={field} value={form.artists} onChange={set("artists")} required />
        </div>

        <div>
          <span className={labelCls}>Genres</span>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button type="button" key={g.slug} onClick={() => toggleGenre(g.slug)} aria-pressed={genres.includes(g.slug)}
                className="rounded-full border border-(--ink)/25 px-3 py-1.5 text-[13px] transition-colors hover:border-(--ink) aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream)">
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="f-date">Release date</label>
            <input id="f-date" type="date" className={field} value={form.releaseDate} onChange={set("releaseDate")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="f-year">Year</label>
            <input id="f-year" inputMode="numeric" pattern="\d{4}" className={field} value={form.releaseYear} onChange={set("releaseYear")} required />
          </div>
          <div>
            <label className={labelCls} htmlFor="f-format">Format</label>
            <select id="f-format" className={field} value={form.format} onChange={set("format")}>
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor="f-label">Label</label>
            <input id="f-label" className={field} value={form.label} onChange={set("label")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="f-cat">Catalog no.</label>
            <input id="f-cat" className={field} value={form.catalogNo} onChange={set("catalogNo")} />
          </div>
          <div>
            <label className={labelCls} htmlFor="f-yt">YouTube playlist</label>
            <input id="f-yt" className={field} value={form.youtubePlaylistId} onChange={set("youtubePlaylistId")} placeholder="Link or ID" />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="f-desc">Description</label>
          <textarea id="f-desc" className={`${field} min-h-24`} value={form.description} onChange={set("description")} />
        </div>

        <div>
          <label className={labelCls} htmlFor="f-tracks">Tracks</label>
          <textarea id="f-tracks" className={`${field} min-h-56 font-mono text-[13px]`} value={trackText} onChange={(e) => setTrackText(e.target.value)}
            placeholder={"A | Intro | 1:36\nA | Together | 3:42\nB | Legend | 5:10"} />
          <p className="mt-2 text-[12px] text-(--ink)/55">One per line: <code>side | title | time</code> (time optional). A·B → LP1, C·D → LP2.</p>
          {parsed.errors.length > 0 && <ul className="mt-2 space-y-1 text-[12px] text-[#c8553d]">{parsed.errors.map((err) => <li key={err}>{err}</li>)}</ul>}
          {parsed.rows.length > 0 && parsed.errors.length === 0 && (
            <p className="mt-2 text-[12px] text-(--ink)/55">{parsed.rows.length} tracks ({[...new Set(parsed.rows.map((t) => t.side))].join(", ")})</p>
          )}
        </div>
      </div>

      {/* 오른쪽: 커버 · 공개 상태 · 저장 */}
      <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
        <div className={`${card} p-4`}>
          <span className={labelCls}>Cover {editing && <span className="normal-case tracking-normal opacity-70">(optional)</span>}</span>
          <div className="relative aspect-square overflow-hidden rounded-lg bg-(--ink)/8" style={{ backgroundColor: !preview && initial?.cover_color ? initial.cover_color : undefined }}>
            {(preview || currentCover) && <img src={preview || currentCover} alt="" className="size-full object-cover" />}
          </div>
          <input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} required={!editing && !requestCover}
            className="mt-3 w-full text-[12px] file:mr-3 file:rounded-full file:border file:border-(--ink)/30 file:bg-transparent file:px-3 file:py-1.5 file:text-[12px] file:text-(--ink)" />
          {requestCover && !cover && (
            <p className="mt-2 flex items-center justify-between gap-2 text-[11px] text-(--ink)/60">
              Using the cover from the request.
              <button type="button" onClick={() => setRequestCover(null)} className="underline underline-offset-4">Don’t use</button>
            </p>
          )}
          <p className="mt-2 text-[11px] text-(--ink)/50">Min 500×500. The cover color is picked automatically.</p>
        </div>

        <div className={`${card} p-4`}>
          <label className={labelCls} htmlFor="f-status">Visibility</label>
          <select id="f-status" className={field} value={form.status} onChange={set("status")}>
            <option value="published">Published — on the site</option>
            <option value="draft">Hidden — draft</option>
          </select>
          <label className="mt-4 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={form.isReissue} onChange={set("isReissue")} className="accent-(--ink)" />
            Reissue
          </label>
        </div>

        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Saving…" : editing ? "Save changes" : "Create album"}</button>
        {editing && form.status === "published" && (
          <a href={`/album/${encodeURIComponent(form.slug)}`} target="_blank" rel="noreferrer" className={`${btnGhost} w-full`}>View on site ↗</a>
        )}

        {result?.error && <p role="alert" className="rounded-xl bg-[#c8553d]/10 px-4 py-3 text-[13px] text-[#c8553d]">{result.error}</p>}
        {result?.ok && (
          <div role="status" className="flex items-start gap-3 rounded-xl bg-[#4f9d69]/12 px-4 py-3 text-[13px]">
            {result.ok.coverColor && <span className="mt-0.5 size-4 shrink-0 rounded" style={{ background: result.ok.coverColor }} />}
            <span>
              {editing ? "Saved" : "Created"} · {result.ok.trackCount} tracks
              {!editing && <> · <Link href={`/admin/albums/${encodeURIComponent(result.ok.slug)}`} className="underline underline-offset-4">Edit {result.ok.slug}</Link></>}
              {result.ok.linked && <> · request #{requestId} marked added</>}
            </span>
          </div>
        )}
      </aside>
    </form>
  );
}
