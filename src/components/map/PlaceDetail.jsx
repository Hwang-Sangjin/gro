"use client";
// /lab/map 오른쪽 "02 — Detail"
// - 아무것도 안 골랐을 때: Now on (지금 열린·곧 열리는 페어·팝업) + 범례(종류별 개수)
// - 장소를 골랐을 때: 장소 카드 (영업시간은 요일별로, 오늘 줄 강조)
import Link from "next/link";
import { GENRES } from "@/lib/genres";
import { STORIES } from "@/content/news";
import { KINDS, kindOf, parseHours, isOnNow, kakaoDirections, naverSearch } from "@/lib/places";
import { SERIF, Reveal } from "@/components/lab/LabUI";

const genreName = (slug) => GENRES.find((g) => g.slug === slug)?.name ?? slug;
const fmt = (d) => (d ? d.slice(5).replace("-", ".") : "");
const KEY = "text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/50";
const pillBase = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 transition-colors";
const pill = `${pillBase} text-[11px] font-medium uppercase tracking-[0.16em]`;

export default function PlaceDetail({ place, places, counts, onPick, onClose }) {
  if (!place) return <NowOn places={places} counts={counts} onPick={onPick} />;
  const k = kindOf(place.kind);
  const hours = parseHours(place.hours ?? "");
  const story = place.news_slug ? STORIES.find((s) => s.slug === place.news_slug) : null;
  return (
    // key 가 바뀌면 다시 마운트 → 고를 때마다 한 줄씩 다시 올라옴
    <div key={place.slug} className="grid">
      <Reveal i={1} className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em]">
          <span className="size-2.5 rounded-full" style={{ background: k.color }} />{k.one}{place.area ? ` · ${place.area}` : ""}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full text-[18px] text-(--ink)/55 hover:bg-(--ink)/8 hover:text-(--ink)">×</button>
      </Reveal>
      <Reveal i={2} className="mt-2">
        <h2 className={`${SERIF} break-keep text-[clamp(1.8rem,2.4vw,2.3rem)] leading-[1.02]`}>{place.name}</h2>
        {place.name_en && place.name_en !== place.name && <p className="mt-1 text-[13px] text-(--ink)/55">{place.name_en}</p>}
      </Reveal>
      {place.note && <Reveal as="p" i={3} className="mt-4 break-keep text-[14px] leading-7 text-(--ink)/85">{place.note}</Reveal>}

      {place.kind === "event" && (place.starts_on || place.ends_on) && (
        <Reveal i={4} className="mt-4 border-y border-dashed border-(--ink)/25 py-3">
          <p className={KEY}>Dates</p>
          <p className={`${SERIF} mt-1 text-[1.4rem] leading-none`}>{fmt(place.starts_on)} – {fmt(place.ends_on)}</p>
          {isOnNow(place) && <p className="mt-2 text-[12px] font-medium text-(--accent)">지금 열려 있어요</p>}
        </Reveal>
      )}

      {hours.length > 0 && (
        <Reveal i={5} className="mt-4">
          <p className={KEY}>Hours</p>
          <ul className="mt-2">
            {hours.map((h, i) => (
              <li key={i} data-today={h.today}
                className="grid grid-cols-[64px_1fr] gap-3 border-b border-dashed border-(--ink)/20 py-1.5 text-[13px] text-(--ink)/75 data-[today=true]:font-medium data-[today=true]:text-(--ink)">
                <span className="flex items-center gap-1.5">{h.days ?? ""}{h.today && <span className="size-1.5 rounded-full bg-(--accent)" title="오늘" />}</span>
                <span className={h.closed ? "text-(--ink)/45" : ""}>{h.text}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {place.address && (
        <Reveal i={6} className="mt-4">
          <p className={KEY}>Address</p>
          <p className="mt-1 break-keep text-[13px] leading-6">{place.address}</p>
        </Reveal>
      )}

      {place.genres?.length > 0 && (
        <Reveal i={7} className="mt-4">
          <p className={KEY}>Good for</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {place.genres.map((g) => (
              <Link key={g} href={`/digging?genre=${g}`} className="rounded-full border border-(--ink)/25 px-3 py-1 text-[12px] transition-colors hover:border-(--ink) hover:bg-(--ink)/5">{genreName(g)}</Link>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal i={8} className="mt-5 grid grid-cols-2 gap-2 border-t-[3px] border-(--ink) pt-4">
        <a href={kakaoDirections(place)} target="_blank" rel="noreferrer" className={`${pill} bg-(--ink) text-(--cream) hover:bg-(--accent)`}>Kakao ↗︎</a>
        <a href={place.map_url || naverSearch(place)} target="_blank" rel="noreferrer" className={`${pill} border border-(--ink)/40 hover:border-(--ink)`}>Naver ↗︎</a>
        {place.instagram && <a href={`https://www.instagram.com/${place.instagram}/`} target="_blank" rel="noreferrer" className={`${pillBase} col-span-2 border border-(--ink)/25 text-[13px] hover:border-(--ink)`}>@{place.instagram}</a>}
        {place.website && <a href={place.website} target="_blank" rel="noreferrer" className={`${pill} col-span-2 border border-(--ink)/25 hover:border-(--ink)`}>Website ↗︎</a>}
      </Reveal>

      {story && (
        <Reveal i={9} className="mt-4">
          <Link href={`/news/${story.slug}`} className="group block border-b border-dashed border-(--ink)/25 py-3">
            <p className={KEY}>From News</p>
            <p className={`${SERIF} mt-1 text-[1.1rem] leading-tight group-hover:text-(--accent)`}>{story.title} →</p>
          </Link>
        </Reveal>
      )}
    </div>
  );
}

// 고르기 전: 지금·곧 열리는 행사 + 범례
function NowOn({ places, counts, onPick }) {
  const events = places.filter((p) => p.kind === "event").sort((a, b) => (a.starts_on ?? "").localeCompare(b.starts_on ?? "")).slice(0, 3);
  return (
    <div className="grid">
      <Reveal i={1}>
        <p className={KEY}>Now on</p>
        {events.length === 0 && <p className="mt-2 break-keep text-[13px] leading-6 text-(--ink)/60">지금 열린 페어·팝업은 없어요. 새 소식이 생기면 여기에 먼저 올라와요.</p>}
        <ul className="mt-2">
          {events.map((p) => (
            <li key={p.slug}>
              <button type="button" onClick={() => onPick(p.slug)} className="group grid w-full gap-1 border-b border-dashed border-(--ink)/25 py-3 text-left">
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-(--accent)">
                  {isOnNow(p) ? "Open now" : "Coming up"} · {fmt(p.starts_on)}–{fmt(p.ends_on)}
                </span>
                <span className={`${SERIF} text-[1.25rem] leading-tight group-hover:text-(--accent)`}>{p.name}</span>
                {p.area && <span className="text-[12px] text-(--ink)/55">{p.area}</span>}
              </button>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal i={2} className="mt-6">
        <p className={KEY}>Legend</p>
        <ul className="mt-2">
          {KINDS.map((k) => (
            <li key={k.key} className="flex items-center justify-between border-b border-dashed border-(--ink)/20 py-2 text-[13px]">
              <span className="flex items-center gap-2.5">
                <span className="grid size-5 place-items-center rounded-full bg-[#141113]"><span className="size-2 rounded-full" style={{ background: k.color }} /></span>
                {k.ko}
              </span>
              <span className={`${SERIF} text-[1.1rem] tabular-nums`}>{counts[k.key] ?? 0}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 break-keep text-[12px] leading-5 text-(--ink)/55">지도의 디스크를 누르거나 왼쪽 목록에서 고르면 여기에 자세한 정보가 떠요.</p>
      </Reveal>
    </div>
  );
}
