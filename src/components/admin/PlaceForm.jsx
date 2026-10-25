"use client";
// 장소 등록·수정 폼 (Lab · Map) — 지도를 누르거나 핀을 끌어서 위치를 정하고, 나머지는 직접 입력
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { GENRES } from "@/lib/genres";
import { STORIES } from "@/content/news";
import { KINDS, AREAS, kindOf, slugify, naverSearch } from "@/lib/places";
import { field, labelCls, btnPrimary } from "./ui";

const MapPicker = dynamic(() => import("@/components/map/MapPicker"), { ssr: false, loading: () => <div className="h-[340px] animate-pulse rounded-xl bg-(--ink)/8" /> });

const EMPTY = { id: null, slug: "", name: "", name_en: "", kind: "shop", also: [], area: "", address: "", lat: null, lng: null, hours: "", instagram: "", website: "", map_url: "", note: "", genres: [], starts_on: "", ends_on: "", news_slug: "", status: "published" };
const fromPlace = (p) => (p ? { ...EMPTY, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? EMPTY[k] ?? ""])) } : EMPTY);

export default function PlaceForm({ initial = null }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [f, setF] = useState(() => fromPlace(initial));
  const [slugTouched, setSlugTouched] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key) => (e) => {
    const value = e.target.value;
    setF((x) => ({ ...x, [key]: value, ...(key === "name" && !slugTouched ? { slug: slugify(x.name_en || value) } : {}), ...(key === "name_en" && !slugTouched ? { slug: slugify(value || x.name) } : {}) }));
  };
  const toggleGenre = (slug) => setF((x) => ({ ...x, genres: x.genres.includes(slug) ? x.genres.filter((g) => g !== slug) : [...x.genres, slug] }));

  async function submit(e) {
    e.preventDefault();
    setResult(null); setBusy(true);
    try {
      const res = await fetch("/api/admin/places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult({ ok: json });
      if (editing) router.refresh();
      else { setF(EMPTY); setSlugTouched(false); }
    } catch (err) { setResult({ error: err.message }); } finally { setBusy(false); }
  }

  const kind = kindOf(f.kind);
  // 종류 여러 개: 누를 때마다 붙이거나 빼고, 맨 앞이 1번(대표). 하나는 꼭 남김
  const order = [f.kind, ...(f.also ?? [])].filter(Boolean);
  const toggleKind = (key) => setF((x) => {
    const cur = [x.kind, ...(x.also ?? [])].filter(Boolean);
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    if (!next.length) return x;
    return { ...x, kind: next[0], also: next.slice(1) };
  });
  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="p-name">Name</label>
            <input id="p-name" className={field} value={f.name} onChange={set("name")} required placeholder="김밥레코즈" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-name-en">English name (optional)</label>
            <input id="p-name-en" className={field} value={f.name_en} onChange={set("name_en")} placeholder="Gimbab Records" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-slug">Slug</label>
            <input id="p-slug" className={`${field} font-mono`} value={f.slug} onChange={(e) => { setSlugTouched(true); setF((x) => ({ ...x, slug: e.target.value })); }} required />
          </div>
          <div>
            <span className={labelCls}>Kind — 고른 순서대로 1, 2 (1번이 지도 색)</span>
            <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => {
                const n = order.indexOf(k.key) + 1;   // 0 = 안 고름
                return (
                  <button key={k.key} type="button" aria-pressed={n > 0} onClick={() => toggleKind(k.key)}
                    className="inline-flex items-center gap-2 rounded-full border border-(--ink)/20 py-2 pl-2.5 pr-3.5 text-[12px] aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream)">
                    {n > 0
                      ? <span className="grid size-[18px] place-items-center rounded-full text-[10px] font-medium text-white" style={{ background: k.color }}>{n}</span>
                      : <span className="m-[4px] size-2.5 rounded-full" style={{ background: k.color }} />}
                    {k.ko}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {order.includes("event") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="p-start">Starts</label>
              <input id="p-start" type="date" className={field} value={f.starts_on} onChange={set("starts_on")} />
            </div>
            <div>
              <label className={labelCls} htmlFor="p-end">Ends</label>
              <input id="p-end" type="date" className={field} value={f.ends_on} onChange={set("ends_on")} />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div>
            <label className={labelCls} htmlFor="p-area">Area</label>
            <input id="p-area" className={field} value={f.area} onChange={set("area")} list="p-areas" placeholder="성수" />
            <datalist id="p-areas">{AREAS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div>
            <label className={labelCls} htmlFor="p-address">Address</label>
            <input id="p-address" className={field} value={f.address} onChange={set("address")} placeholder="서울 성동구 …" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="p-hours">Hours</label>
            <input id="p-hours" className={field} value={f.hours} onChange={set("hours")} placeholder="화–일 13:00–21:00 · 월 휴무" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-ig">Instagram</label>
            <input id="p-ig" className={field} value={f.instagram} onChange={set("instagram")} placeholder="@handle 또는 링크" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-web">Website</label>
            <input id="p-web" type="url" className={field} value={f.website} onChange={set("website")} placeholder="https://" />
          </div>
          <div>
            <label className={labelCls} htmlFor="p-map">Map link (optional)</label>
            <input id="p-map" type="url" className={field} value={f.map_url} onChange={set("map_url")} placeholder="카카오맵·네이버지도 장소 링크" />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="p-note">One-line note (Grooves 톤)</label>
          <textarea id="p-note" rows={2} className={field} value={f.note} onChange={set("note")} placeholder="재즈·소울 중고반이 강해요. 주말 오후엔 사장님이 직접 판을 골라 틀어요." />
        </div>

        <div>
          <span className={labelCls}>Good for (genres)</span>
          <div className="flex flex-wrap gap-1.5">
            {GENRES.map((g) => (
              <button key={g.slug} type="button" aria-pressed={f.genres.includes(g.slug)} onClick={() => toggleGenre(g.slug)}
                className="rounded-full border border-(--ink)/20 px-3 py-1.5 text-[12px] aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream)">{g.name}</button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="p-news">Related News (optional)</label>
          <select id="p-news" className={field} value={f.news_slug} onChange={set("news_slug")}>
            <option value="">—</option>
            {STORIES.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
          </select>
        </div>
      </div>

      {/* 오른쪽: 위치 + 공개 + 저장 */}
      <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        <div>
          <span className={labelCls}>Location — 지도를 누르거나 핀을 끌어서</span>
          <MapPicker lat={Number(f.lat) || null} lng={Number(f.lng) || null} color={kind.color}
            onPick={({ lat, lng }) => setF((x) => ({ ...x, lat, lng }))} className="h-[340px]" />
          <p className="mt-2 flex items-baseline justify-between gap-3 text-[11px] text-(--ink)/55">
            <span className="font-mono">{f.lat && f.lng ? `${Number(f.lat).toFixed(5)}, ${Number(f.lng).toFixed(5)}` : "아직 핀이 없어요"}</span>
            {(f.address || f.name) && (
              <a href={naverSearch(f)} target="_blank" rel="noreferrer" className="shrink-0 underline-offset-4 hover:text-(--ink) hover:underline">네이버지도에서 찾아보기 ↗︎</a>
            )}
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-(--ink)/15 px-4 py-3 text-[13px]">
          <span><span className="font-medium">Show on the map</span><span className="block text-[12px] text-(--ink)/55">끄면 저장만 되고 지도에는 안 보여요</span></span>
          <input type="checkbox" checked={f.status === "published"} onChange={(e) => setF((x) => ({ ...x, status: e.target.checked ? "published" : "draft" }))} className="size-5 accent-(--accent)" />
        </label>
        <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Saving…" : editing ? "Save changes" : "Add place"}</button>
        {result?.error && <p role="alert" className="rounded-xl bg-(--danger)/10 px-4 py-3 text-[13px] text-(--danger)">{result.error}</p>}
        {result?.ok && (
          <p role="status" className="rounded-xl bg-(--accent)/10 px-4 py-3 text-[13px]">
            {editing ? "Saved." : "Added."} <span className="font-mono">{result.ok.slug}</span> · {result.ok.status === "published" ? "on the map" : "hidden"}
            {" "}<a href="/lab/map" className="underline underline-offset-4">Open map ↗︎</a>
          </p>
        )}
      </div>
    </form>
  );
}
