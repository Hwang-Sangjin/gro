"use client";

// src/app/admin/albums/new/page.jsx

import { useEffect, useMemo, useState } from "react";
import { GENRES } from "@/lib/genres";

const FORMATS = ["LP", "2LP", "3LP", "EP", "7inch", "box"];

// "A | 제목 | 4:32" 한 줄씩 파싱. 시간은 생략 가능.
function parseTracks(text) {
  const rows = [];
  const errors = [];

  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [sideRaw, titleRaw, durRaw] = line.split("|").map((s) => s?.trim());
      const side = (sideRaw ?? "").toUpperCase();

      if (!/^[A-H]$/.test(side)) {
        errors.push(`${i + 1}번째 줄: 면(A~H)이 올바르지 않습니다`);
        return;
      }
      if (!titleRaw) {
        errors.push(`${i + 1}번째 줄: 곡 제목이 없습니다`);
        return;
      }

      let duration = null;
      if (durRaw) {
        const m = durRaw.match(/^(\d+):(\d{1,2})$/);
        if (!m) {
          errors.push(`${i + 1}번째 줄: 시간은 4:32 형식으로 적어주세요`);
          return;
        }
        duration = Number(m[1]) * 60 + Number(m[2]);
      }

      rows.push({ side, title: titleRaw, duration });
    });

  return { rows, errors };
}

const EMPTY = {
  slug: "",
  title: "",
  artists: "",
  releaseDate: "",
  format: "LP",
  label: "",
  catalogNo: "",
  youtubePlaylistId: "",
  isReissue: false,
};

export default function NewAlbumPage() {
  const [form, setForm] = useState(EMPTY);
  const [genres, setGenres] = useState([]);
  const [trackText, setTrackText] = useState("");
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // 관리자 키는 브라우저에만 보관
  useEffect(() => {
    setSecret(localStorage.getItem("grooves-admin-secret") ?? "");
  }, []);
  useEffect(() => {
    if (secret) localStorage.setItem("grooves-admin-secret", secret);
  }, [secret]);

  useEffect(() => {
    if (!cover) return setPreview(null);
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const parsed = useMemo(() => parseTracks(trackText), [trackText]);

  const set = (key) => (e) =>
    setForm((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const toggleGenre = (slug) =>
    setGenres((g) =>
      g.includes(slug) ? g.filter((x) => x !== slug) : [...g, slug],
    );

  async function submit(e) {
    e.preventDefault();
    setResult(null);

    if (parsed.errors.length) {
      setResult({ error: parsed.errors[0] });
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("secret", secret);
      fd.append("cover", cover);
      fd.append(
        "payload",
        JSON.stringify({
          ...form,
          artists: form.artists
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          genres,
          tracks: parsed.rows,
        }),
      );

      const res = await fetch("/api/admin/albums", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (!res.ok) {
        setResult({ error: json.error });
      } else {
        setResult({ ok: json });
        setForm(EMPTY);
        setGenres([]);
        setTrackText("");
        setCover(null);
      }
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
    // 사이트 공통 요소(Navbar, 디스크) 위를 덮고, Lenis 스크롤 가로채기를 막는다
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[1000] overflow-y-auto bg-neutral-50"
    >
      <main className="mx-auto max-w-3xl px-6 py-12 text-neutral-900">
        <h1 className="mb-1 text-2xl font-semibold">앨범 등록</h1>
        <p className="mb-8 text-sm text-neutral-500">
          같은 slug 로 다시 등록하면 기존 앨범이 갱신됩니다.
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>제목</label>
              <input
                className={field}
                value={form.title}
                onChange={set("title")}
                required
              />
            </div>
            <div>
              <label className={labelCls}>slug (URL)</label>
              <input
                className={field}
                value={form.slug}
                onChange={set("slug")}
                placeholder="jannabi-legend"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>아티스트 (쉼표로 구분)</label>
            <input
              className={field}
              value={form.artists}
              onChange={set("artists")}
              required
            />
          </div>

          <div>
            <label className={labelCls}>장르</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  type="button"
                  key={g.slug}
                  onClick={() => toggleGenre(g.slug)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${
                    genres.includes(g.slug)
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>발매일</label>
              <input
                type="date"
                className={field}
                value={form.releaseDate}
                onChange={set("releaseDate")}
                required
              />
            </div>
            <div>
              <label className={labelCls}>포맷</label>
              <select
                className={field}
                value={form.format}
                onChange={set("format")}
              >
                {FORMATS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>레이블</label>
              <input
                className={field}
                value={form.label}
                onChange={set("label")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>카탈로그 번호</label>
              <input
                className={field}
                value={form.catalogNo}
                onChange={set("catalogNo")}
              />
            </div>
            <div>
              <label className={labelCls}>YouTube 플레이리스트 ID</label>
              <input
                className={field}
                value={form.youtubePlaylistId}
                onChange={set("youtubePlaylistId")}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={form.isReissue}
              onChange={set("isReissue")}
            />
            재발매반
          </label>

          <div>
            <label className={labelCls}>커버 이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              className="text-sm"
              required
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="mt-3 h-32 w-32 rounded-md object-cover"
              />
            )}
          </div>

          <div>
            <label className={labelCls}>트랙</label>
            <textarea
              className={`${field} min-h-48 font-mono`}
              value={trackText}
              onChange={(e) => setTrackText(e.target.value)}
              placeholder={
                "A | 나의 기쁨 나의 노래 (Intro) | 1:36\nA | 투게더! | 3:42\nB | 전설 | 5:10"
              }
            />
            <p className="mt-2 text-xs text-neutral-500">
              한 줄에 한 곡. <code>면 | 제목 | 시간</code> 형식이고 시간은 생략
              가능해요. A·B면은 1번 LP, C·D면은 2번 LP로 자동 배정됩니다.
            </p>

            {parsed.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-600">
                {parsed.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
            {parsed.rows.length > 0 && parsed.errors.length === 0 && (
              <p className="mt-2 text-xs text-neutral-500">
                {parsed.rows.length}곡 인식됨 (
                {[...new Set(parsed.rows.map((t) => t.side))].join(", ")}면)
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "등록 중…" : "등록"}
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
            <span>
              {result.ok.slug} 등록 완료 — 트랙 {result.ok.trackCount}곡, 대표색{" "}
              {result.ok.coverColor}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
