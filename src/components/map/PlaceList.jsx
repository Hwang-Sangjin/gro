"use client";
// /lab/map 의 장소 목록 = "트랙리스트" (2026-11-22 다시 짬): 레코드 뒷면의 곡 목록처럼
//  동네 = 판의 면 (Side A 홍대 · Side B 이태원 …, 장소가 많은 동네부터), 장소 = 곡 (A1 · A2 …)
//  면 이름을 누르면 지도가 그 동네로 가고, 곡을 누르면 그 장소를 고름. 목록에 올리면 지도 마커가 떠오름
//  종류 필터 · Open now 는 지도 오른쪽 위의 칩으로 옮김 (MapFilters)
import { KINDS, AREA_ROMAN, kindOf, kindsOf } from "@/lib/places";
import { SERIF } from "@/components/lab/LabUI";

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

const CHIP = "inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-(--ink)/25 bg-(--cream) px-3.5 text-[12px] text-(--ink)/80 shadow-[0_6px_14px_-10px_rgba(0,0,0,.5)] transition-colors hover:border-(--ink) aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream)";

/** 종류 칩(색 점 = 마커의 라벨 색 → 범례를 겸함) + Open now. 장소가 없는 종류는 숨김 */
export function MapFilters({ kind, setKind, counts, total, openOnly, setOpenOnly, openCount, className = "" }) {
  const tabs = [{ key: "all", label: "All", n: total }, ...KINDS.map((k) => ({ ...k, n: counts[k.key] ?? 0 })).filter((k) => k.n > 0)];
  return (
    <div role="group" aria-label="Filter places" className={`flex gap-1.5 ${className}`}>
      {tabs.map((t) => (
        <button key={t.key} type="button" aria-pressed={kind === t.key} onClick={() => setKind(t.key)} className={CHIP}>
          {t.color && <span aria-hidden="true" className="size-2 rounded-full ring-1 ring-black/20" style={{ background: t.color }} />}
          {t.label}<span className="tabular-nums opacity-60">{t.n}</span>
        </button>
      ))}
      <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly(!openOnly)} className={`${CHIP} pl-2`}>
        <Disc color="#f4e7cd" spinning={openOnly || openCount > 0} className="size-[18px]" />
        Open now<span className="tabular-nums opacity-60">{openCount}</span>
      </button>
    </div>
  );
}

/**
 * sides: [{ area, letter, list: [장소] }] — 지금 조건에 맞는 장소만 (빈 면은 빠져 있음)
 * codes: slug → "A1" (조건이 바뀌어도 같은 번호) · focus: 지금 지도가 보고 있는 동네 · onFocus(area)
 */
export default function PlaceList({ sides, codes, focus, onFocus, selected, open = {}, onPick, onHover, loading, emptyText }) {
  if (loading) return <ul>{Array.from({ length: 5 }, (_, i) => <li key={i} className="my-2 h-10 animate-pulse bg-(--ink)/8" />)}</ul>;
  if (!sides.length) return <p className="break-keep py-5 text-[13px] leading-6 text-(--ink)/60">{emptyText}</p>;
  return (
    <ul onPointerLeave={() => onHover(null)} className="grid gap-4">
      {sides.map((side) => (
        <li key={side.area}>
          {/* 면 이름: 누르면 지도가 그 동네로 */}
          <button type="button" onClick={() => onFocus(side.area)} aria-pressed={focus === side.area}
            className="group/side flex w-full items-baseline gap-2.5 border-b border-(--ink)/40 pb-1.5 text-left">
            <span className="text-[10px] font-medium uppercase tracking-[0.26em] text-(--accent)">Side {side.letter}</span>
            <span className={`${SERIF} text-[1.2rem] leading-none transition-colors group-hover/side:text-(--accent) group-aria-pressed/side:text-(--accent)`}>{side.area}</span>
            {AREA_ROMAN[side.area] && <span className="text-[11px] tracking-[0.08em] text-(--ink)/50">{AREA_ROMAN[side.area]}</span>}
            <span aria-hidden="true" className="ml-auto text-[12px] text-(--ink)/40 transition-[translate,color] group-hover/side:translate-x-0.5 group-hover/side:text-(--accent)">→</span>
          </button>
          <ul>
            {side.list.map((p) => {
              const st = open[p.slug]?.state;
              return (
                <li key={p.slug} className="border-b border-dashed border-(--ink)/20">
                  <button type="button" onClick={() => onPick(p.slug)} onPointerEnter={() => onHover(p.slug)} onFocus={() => onHover(p.slug)} onBlur={() => onHover(null)}
                    aria-pressed={selected === p.slug}
                    className="group/row grid w-full grid-cols-[2rem_18px_minmax(0,1fr)_auto] items-center gap-2.5 py-2.5 text-left transition-colors aria-pressed:bg-(--ink)/6">
                    <span className="text-[11px] font-medium tabular-nums tracking-[0.1em] text-(--ink)/55 group-aria-pressed/row:text-(--accent)">{codes[p.slug]}</span>
                    <Disc color={kindOf(p.kind).color} spinning={st === "open"} />
                    <span className="min-w-0 transition-transform duration-300 group-hover/row:translate-x-1 motion-reduce:transition-none">
                      <span className="block truncate text-[14.5px] leading-tight">{p.name}</span>
                      <span className="block truncate text-[11px] text-(--ink)/55">{kindsOf(p).map((x) => kindOf(x).ko).join(" + ")}</span>
                    </span>
                    {st === "open" && <span className="pr-1 text-[10px] font-medium uppercase tracking-[0.16em] text-(--accent)">Open</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
