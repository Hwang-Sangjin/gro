"use client";
// 관리자 장소 목록: 검색(이름·동네·주소), 종류 필터, 지도에 보이기/숨기기(바로 반영)
import { useMemo, useState } from "react";
import Link from "next/link";
import { KINDS, kindOf } from "@/lib/places";
import { field } from "./ui";

export default function PlaceTable({ places: initial }) {
  const [places, setPlaces] = useState(initial);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [noPin, setNoPin] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return places.filter((p) => (kind === "all" || p.kind === kind) && (!noPin || p.lat == null) &&
      (!q || `${p.name} ${p.name_en ?? ""} ${p.area ?? ""} ${p.address ?? ""} ${p.slug}`.toLocaleLowerCase().includes(q)));
  }, [places, query, kind, noPin]);

  async function toggle(p) {
    const status = p.status === "published" ? "draft" : "published";
    setBusy(p.id); setError("");
    try {
      const res = await fetch("/api/admin/places/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPlaces((list) => list.map((x) => (x.id === p.id ? { ...x, status } : x)));
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, area, address" aria-label="Search places" className={`${field} max-w-sm`} />
        <div role="tablist" aria-label="Kind" className="flex flex-wrap gap-1 rounded-full border border-(--ink)/15 p-1">
          {[{ key: "all", label: "All" }, ...KINDS].map((k) => (
            <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} onClick={() => setKind(k.key)}
              className="rounded-full px-3.5 py-1.5 text-[12px] tracking-[0.04em] text-(--ink)/60 aria-selected:bg-(--ink) aria-selected:text-(--cream)">{k.label}</button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-[12px] text-(--ink)/65">
          <input type="checkbox" checked={noPin} onChange={(e) => setNoPin(e.target.checked)} className="size-4 accent-(--accent)" />
          No pin only ({places.filter((p) => p.lat == null).length})
        </label>
        <span className="text-[12px] text-(--ink)/50 tabular-nums">{shown.length} shown</span>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-(--danger)/10 px-4 py-3 text-[13px] text-(--danger)">{error}</p>}

      <ul className="divide-y divide-(--ink)/10 border-y border-(--ink)/10">
        {shown.map((p) => {
          const k = kindOf(p.kind);
          return (
            <li key={p.id} className="grid grid-cols-[14px_1fr_auto] items-center gap-4 py-3 md:grid-cols-[14px_1fr_140px_110px_auto]">
              <span className="size-3.5 rounded-full ring-2 ring-(--ink)/80" style={{ background: k.color }} title={k.ko} />
              <div className="min-w-0">
                <Link href={`/admin/places/${encodeURIComponent(p.slug)}`} className="block truncate text-[15px] font-medium hover:underline">{p.name}</Link>
                <p className="truncate text-[12px] text-(--ink)/55">
                  {p.lat == null && <span className="mr-2 rounded-full bg-(--danger)/12 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-(--danger)">No pin</span>}
                  {[k.ko, p.area, p.address].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="hidden text-[12px] text-(--ink)/55 md:block">{p.kind === "event" && (p.starts_on || p.ends_on) ? `${p.starts_on ?? ""} – ${p.ends_on ?? ""}` : ""}</span>
              <button type="button" onClick={() => toggle(p)} disabled={busy === p.id} aria-pressed={p.status === "published"}
                title={p.status === "published" ? "Click to hide" : "Click to show on the map"}
                className="hidden items-center gap-2 justify-self-start rounded-full border border-(--ink)/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors hover:border-(--ink) disabled:opacity-50 md:inline-flex">
                <span className={`size-2 rounded-full ${p.status === "published" ? "bg-[#4f9d69]" : "bg-(--ink)/30"}`} />
                {p.status === "published" ? "Live" : "Hidden"}
              </button>
              <Link href={`/admin/places/${encodeURIComponent(p.slug)}`} className="justify-self-end rounded-full px-3 py-1.5 text-[12px] hover:bg-(--ink)/6">Edit</Link>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="py-16 text-center text-[14px] text-(--ink)/55">{places.length ? "No places match." : "아직 등록한 장소가 없어요."}</p>}
    </div>
  );
}
