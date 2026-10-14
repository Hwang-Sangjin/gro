"use client";
// /news — 스토리 목록: 큰 제목, 카테고리 탭(All / News / Vinyl A to Z / Picks), 맨 앞 글은 크게, 나머지는 카드
import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES, STORIES, categoryName, formatDate } from "@/content/news";
import StoryCover from "@/content/news/Covers";
import Reveal, { RiseText } from "@/components/story/Reveal";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const TABS = [{ key: "all", name: "All" }, ...CATEGORIES];

function Meta({ s }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/55">
      <span className="text-[#c8553d]">{categoryName(s.category)}</span>
      <span aria-hidden="true" className="h-px w-4 bg-current/50" />{formatDate(s.date)}
      <span aria-hidden="true" className="h-px w-4 bg-current/50" />{s.read}
    </p>
  );
}

export default function NewsIndex() {
  const [tab, setTab] = useState("all");
  // ?category=picks 로 바로 열기 (마운트 후에 읽음)
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("category");
    if (CATEGORIES.some((x) => x.key === c)) setTab(c);
  }, []);
  function pick(key) {
    setTab(key);
    const url = new URL(location.href);
    if (key === "all") url.searchParams.delete("category"); else url.searchParams.set("category", key);
    history.replaceState(history.state, "", url);
  }
  const list = STORIES.filter((s) => tab === "all" || s.category === tab);
  const [lead, ...rest] = list;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)] pb-24 pt-[clamp(8rem,12vw,11rem)] text-(--ink)">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-[clamp(0.5rem,2vw,2rem)]">
          <RiseText as="h1" lines={["News &", "Stories"]} className={`${SERIF} text-[clamp(4rem,11vw,11rem)] leading-[0.86]`} />
          {/* 제목 옆 움직이는 턴테이블 그림 (Digging·Collection 제목 옆 그림과 같은 계열) */}
          <Reveal delay={250} className="shrink-0 pb-[0.4em]">
            <img src="/images/grooves/title-turntable.gif" alt="" className="w-[clamp(84px,13vw,230px)]" />
          </Reveal>
        </div>
        <Reveal delay={300} className="max-w-xs pb-3 text-[14px] leading-6 text-(--ink)/70">
          News from the crates, the A to Z of how records work, and what to put on the platter next.
        </Reveal>
      </header>

      <Reveal delay={200} className="mt-10 border-y-[3px] border-(--ink) py-4">
        <div role="tablist" aria-label="Categories" className="flex flex-wrap items-baseline gap-x-[clamp(.6rem,1.2vw,1.4rem)] gap-y-1">
          {TABS.map((t, i) => {
            const n = t.key === "all" ? STORIES.length : STORIES.filter((s) => s.category === t.key).length;
            const on = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => pick(t.key)}
                className={`group/t relative ${SERIF} text-[clamp(1.4rem,2.4vw,2.6rem)] uppercase leading-[1.05] transition-colors duration-500 ${on ? "text-(--ink)" : "text-(--ink)/25 hover:text-(--ink)/70"}`}>
                <span className="relative">
                  {t.name}
                  <span aria-hidden="true" className={`absolute -bottom-[0.06em] left-0 h-[0.08em] min-h-[2px] bg-[#c8553d] transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${on ? "w-full" : "w-0 group-hover/t:w-full"}`} />
                </span>
                <sup className="ml-[.15em] align-[1.1em] font-sans text-[max(.3em,10px)] font-semibold tracking-normal">{n}</sup>
                {i < TABS.length - 1 && <span aria-hidden="true" className="ml-[clamp(.6rem,1.2vw,1.4rem)] font-normal text-(--ink)/20">/</span>}
              </button>
            );
          })}
        </div>
      </Reveal>

      <div key={tab}>
        {lead && (
          <Reveal className="mt-12">
            <Link href={`/news/${lead.slug}`} className="group grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-14">
              <StoryCover name={lead.cover} className="aspect-[4/3] rounded-sm transition-[scale] duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.015] [&_svg]:transition-transform [&_svg]:duration-[1200ms] group-hover:[&_svg]:scale-105" />
              <div>
                <Meta s={lead} />
                <h2 className={`${SERIF} mt-5 text-[clamp(2.6rem,5vw,5.2rem)] leading-[0.92]`}>
                  <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_3px] bg-left-bottom bg-no-repeat pb-1 transition-[background-size] duration-700 group-hover:bg-[length:100%_3px]">{lead.title}</span>
                </h2>
                <p className="mt-5 max-w-lg text-[16px] leading-7 text-(--ink)/75">{lead.dek}</p>
                <span className="mt-8 inline-flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.2em]">
                  Read story <span aria-hidden="true" className="transition-transform duration-500 group-hover:translate-x-1.5">→</span>
                </span>
              </div>
            </Link>
          </Reveal>
        )}

        {rest.length > 0 && (
          <ul className="mt-16 grid gap-x-10 gap-y-14 border-t border-(--ink)/15 pt-12 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s, i) => (
              <Reveal as="li" key={s.slug} delay={i * 120}>
                <Link href={`/news/${s.slug}`} className="group block">
                  <StoryCover name={s.cover} className="aspect-square rounded-sm [&_svg]:transition-transform [&_svg]:duration-[1200ms] [&_svg]:ease-[cubic-bezier(.22,1,.36,1)] group-hover:[&_svg]:scale-105" />
                  <div className="mt-5"><Meta s={s} /></div>
                  <h3 className={`${SERIF} mt-3 text-[clamp(1.7rem,2.4vw,2.4rem)] leading-[0.98]`}>{s.title}</h3>
                  <p className="mt-3 text-[14px] leading-6 text-(--ink)/70">{s.dek}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
