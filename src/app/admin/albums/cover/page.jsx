"use client";

// src/app/admin/albums/cover/page.jsx
// 커버만 교체하는 화면

import { useEffect, useState } from "react";

export default function ReplaceCoverPage() {
  const [secret, setSecret] = useState("");
  const [slug, setSlug] = useState("");
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(null);
  const [size, setSize] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setSecret(localStorage.getItem("grooves-admin-secret") ?? "");
  }, []);

  // 선택한 이미지의 실제 해상도를 미리 보여준다
  useEffect(() => {
    if (!cover) return (setPreview(null), setSize(null));
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
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("secret", secret);
      fd.append("slug", slug.trim());
      fd.append("cover", cover);
      const res = await fetch("/api/admin/albums/cover", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      setResult(res.ok ? { ok: json } : { error: json.error });
      if (res.ok) setCover(null);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900";
  const labelCls =
    "mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500";

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[1000] overflow-y-auto bg-neutral-50"
    >
      <main className="mx-auto max-w-xl px-6 py-12 text-neutral-900">
        <h1 className="mb-1 text-2xl font-semibold">커버 교체</h1>
        <p className="mb-8 text-sm text-neutral-500">
          트랙과 앨범 정보는 그대로 두고 커버 이미지만 바꿉니다.
        </p>

        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className={labelCls}>관리자 키</label>
            <input
              type="password"
              className={field}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelCls}>앨범 slug</label>
            <input
              className={field}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="frank-ocean-channel-orange"
              required
            />
          </div>

          <div>
            <label className={labelCls}>새 커버 (1000px 이상)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              className="text-sm"
              required
            />
            {preview && (
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt=""
                  className="h-32 w-32 rounded-md object-cover"
                />
                {size && (
                  <span
                    className={`text-sm ${tooSmall ? "text-red-600" : "text-neutral-500"}`}
                  >
                    {size.w} × {size.h}
                    {tooSmall && " — 너무 작아요"}
                  </span>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy || !cover || tooSmall}
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "교체 중…" : "교체"}
          </button>
        </form>

        {result?.error && (
          <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {result.error}
          </p>
        )}
        {result?.ok && (
          <div className="mt-6 flex items-center gap-3 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span
              className="h-5 w-5 rounded"
              style={{ background: result.ok.coverColor }}
            />
            <span>{result.ok.title} 커버 교체 완료</span>
          </div>
        )}
      </main>
    </div>
  );
}
