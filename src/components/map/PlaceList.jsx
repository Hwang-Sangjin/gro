"use client";
// /lab/map 왼쪽 "01 — Places": 종류(세리프 + 슬래시, Brick 의 Albums / Upload 와 같은 문법) · 동네 칩 · 목록
// 목록에 올리면 지도 마커가 떠오르고, 누르면 고름
import { KINDS, kindOf } from "@/lib/places";
import { SERIF, Reveal } from "@/components/lab/LabUI";

// 작은 판 — 지금 영업 중이면 돎 (지도 마커와 같은 문법)
export function Disc({ color, spinning, className = "size-[18px]" }) {
  return (
    <span className={`relative grid shrink-0 place-items-center rounded-full bg-[#141113] ${className}`} title={spinning ? "지금 영업 중" : undefined}>
      <span aria-hidden="true" className={`absolute inset-0 rounded-full ${spinning ? "animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none" : ""}`}
        style={{ background: "conic-gradient(from 0deg,transparent 0 18%,rgba(255,255,255,.28) 24%,transparent 30% 68%,rgba(255,255,255,.18) 74%,transparent 80%)" }} />
      <span className="relative size-[38%] rounded-full" style={{ background: color }} />
    </span>
  );
}

const FADE = "[mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]";

export default function PlaceList({ places, all, kind, setKind, area, setArea, areas, selected, open = {}, openOnly, setOpenOnly, openCount = 0, onPick, onHover, loading }) {
  const tabs = [{ key: "all", label: "All" }, ...KINDS];
  return (
    <>
      <Reveal i={1} role="tablist" aria-label="Kind" className="flex flex-wrap items-baseline gap-y-1">
        {tabs.map((t, i) => {
          const n = t.key === "all" ? all.length : all.filter((p) => p.kind === t.key).length;
          return (
            <span key={t.key} className="flex items-baseline">
              <button type="button" role="tab" aria-selected={kind === t.key} onClick={() => setKind(t.key)}
                className={`${SERIF} min-h-8 border-b-[3px] border-transparent text-[1.25rem] leading-none text-(--ink)/35 transition-colors hover:text-(--ink)/70 aria-selected:border-(--accent) aria-selected:text-(--ink)`}>
                {t.label}<sup className="ml-0.5 text-[10px] font-normal tracking-normal text-(--ink)/45">{n}</sup>
              </button>
              {i < tabs.length - 1 && <span aria-hidden="true" className="mx-2 text-[1rem] text-(--ink)/20">/</span>}
            </span>
          );
        })}
      </Reveal>

      {/* 지금 영업 중인 곳만 — 판이 도는 칩 */}
      <Reveal i={2} className="mt-3">
        <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)}
          className="inline-flex items-center gap-2 rounded-full border border-(--ink)/25 py-1 pl-1.5 pr-3 text-[12px] text-(--ink)/75 transition-colors hover:border-(--ink) aria-pressed:border-(--accent) aria-pressed:bg-(--accent) aria-pressed:text-(--cream)">
          <Disc color="#f4e7cd" spinning={openOnly || openCount > 0} className="size-[18px]" />
          Open now <span className="tabular-nums opacity-70">{openCount}</span>
        </button>
      </Reveal>
      {areas.length > 1 && (
        <Reveal i={2} className="mt-2 flex flex-wrap gap-1.5">
          {["all", ...areas].map((a) => (
            <button key={a} type="button" aria-pressed={area === a} onClick={() => setArea(a)}
              className="rounded-full border border-(--ink)/25 px-3 py-1 text-[12px] text-(--ink)/70 transition-colors hover:border-(--ink) aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream)">
              {a === "all" ? "모든 동네" : a}
            </button>
          ))}
        </Reveal>
      )}

      <Reveal as="ul" i={3} data-lenis-prevent data-crate-ignore onPointerLeave={() => onHover(null)}
        className={`${FADE} mt-3 max-h-[min(52svh,560px)] overflow-y-auto overscroll-contain pb-6 max-lg:max-h-[42svh]`}>
        {loading && Array.from({ length: 6 }, (_, i) => <li key={i} className="my-2 h-11 animate-pulse bg-(--ink)/8" />)}
        {!loading && places.length === 0 && (
          <li className="py-6 break-keep text-[13px] leading-6 text-(--ink)/55">{!all.length ? "아직 지도에 올라온 장소가 없어요." : openOnly ? "지금 문을 연 곳이 없어요. Open now 를 끄면 모든 장소가 보여요." : "이 조건에 맞는 장소가 없어요."}</li>
        )}
        {places.map((p) => {
          const k = kindOf(p.kind);
          return (
            <li key={p.slug} className="border-b border-dashed border-(--ink)/25">
              <button type="button" onClick={() => onPick(p.slug)} onPointerEnter={() => onHover(p.slug)} onFocus={() => onHover(p.slug)} onBlur={() => onHover(null)}
                aria-pressed={selected === p.slug}
                className="grid w-full grid-cols-[18px_1fr] items-center gap-3 border-l-[3px] border-transparent py-2.5 pl-2.5 text-left transition-colors hover:border-(--accent) aria-pressed:border-(--accent)">
                <Disc color={k.color} spinning={open[p.slug]?.state === "open"} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] leading-tight">{p.name}</span>
                  <span className="block truncate text-[11px] text-(--ink)/50">{[k.ko, p.area].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          );
        })}
      </Reveal>
    </>
  );
}
