"use client";
// 커버만 교체: slug + 새 이미지 → 트랙·아티스트·장르는 그대로, 대표색은 새로 뽑음
import { useEffect, useState } from "react";
import Link from "next/link";
import { field, labelCls, btnPrimary, card } from "./ui";

export default function CoverForm({ initialSlug = "" }) {
  const [slug, setSlug] = useState(initialSlug);
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(null);
  const [size, setSize] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // 고른 이미지의 실제 해상도를 미리 보여 줌
  useEffect(() => {
    if (!cover) { setPreview(null); setSize(null); return; }
    const url = URL.createObjectURL(cover);
    setPreview(url);
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  const tooSmall = size && Math.min(size.w, size.h) < 500;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("slug", slug.trim());
      fd.append("cover", cover);
      const res = await fetch("/api/admin/albums/cover", { method: "POST", body: fd });
      const json = await res.json();
      setResult(res.ok ? { ok: json } : { error: json.error });
      if (res.ok) setCover(null);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-8 sm:grid-cols-[1fr_260px]">
      <div className="space-y-6">
        <div>
          <label className={labelCls} htmlFor="c-slug">Album slug</label>
          <input id="c-slug" className={`${field} font-mono`} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="jannabi-legend" required />
          <p className="mt-2 text-[12px] text-(--ink)/55">Tracks, artists and genres stay as they are. The cover color is re-picked.</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="c-file">New cover</label>
          <input id="c-file" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} required
            className="w-full text-[12px] file:mr-3 file:rounded-full file:border file:border-(--ink)/30 file:bg-transparent file:px-3 file:py-1.5 file:text-[12px] file:text-(--ink)" />
          {size && <p className={`mt-2 text-[12px] ${tooSmall ? "text-[#c8553d]" : "text-(--ink)/55"}`}>{size.w}×{size.h}{tooSmall && " — needs at least 500px"}</p>}
        </div>
        <button type="submit" disabled={busy || !cover || tooSmall} className={btnPrimary}>{busy ? "Replacing…" : "Replace cover"}</button>
        {result?.error && <p role="alert" className="rounded-xl bg-[#c8553d]/10 px-4 py-3 text-[13px] text-[#c8553d]">{result.error}</p>}
        {result?.ok && (
          <p role="status" className="flex items-center gap-3 rounded-xl bg-[#4f9d69]/12 px-4 py-3 text-[13px]">
            <span className="size-4 rounded" style={{ background: result.ok.coverColor }} />
            {result.ok.title} — cover replaced · <Link href={`/admin/albums/${encodeURIComponent(slug.trim())}`} className="underline underline-offset-4">Edit album</Link>
          </p>
        )}
      </div>
      <div className={`${card} aspect-square overflow-hidden p-0`}>
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[12px] text-(--ink)/40">Preview</span>}
      </div>
    </form>
  );
}
