"use client";
// 스토리 한 편의 틀: 위에 ← News 와 분류·날짜, 본문(글마다 자유), 맨 아래 다음 글
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import StoryBody from "@/content/news/stories";
import StoryCover from "@/content/news/Covers";
import { categoryName, formatDate, nextStory } from "@/content/news";
import Reveal from "@/components/story/Reveal";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";

export default function StoryShell({ meta }) {
  const next = nextStory(meta.slug);
  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0! [&>.page-content]:p-0!">
      <article className="relative text-(--ink)">
        <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--ct-header-h,106px)+12px)] z-20 px-[clamp(20px,4vw,72px)]">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-[0.24em]">
            <Link href="/news" className="group pointer-events-auto inline-flex items-center gap-3">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-current/35 transition-[translate,background-color] duration-300 group-hover:-translate-x-1 group-hover:bg-current/10">
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
              </span>
              News
            </Link>
            <span className="hidden opacity-70 sm:block">{categoryName(meta.category)} · {formatDate(meta.date)} · {meta.read} read</span>
          </div>
        </div>

        <StoryBody slug={meta.slug} meta={meta} />

        {next && next.slug !== meta.slug && (
          <footer className="mx-auto max-w-[1500px] px-[clamp(20px,4vw,72px)] pb-24 pt-16">
            <Reveal className="border-t-[3px] border-(--ink) pt-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">Next story</p>
              <Link href={`/news/${next.slug}`} className="group mt-6 grid items-center gap-6 sm:grid-cols-[180px_1fr]">
                <StoryCover name={next.cover} className="aspect-square rounded-sm [&_svg]:transition-transform [&_svg]:duration-700 group-hover:[&_svg]:scale-105" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#c8553d]">{categoryName(next.category)}</p>
                  <p className={`${SERIF} mt-2 text-[clamp(2rem,4vw,3.6rem)] leading-[0.95]`}>{next.title} <span aria-hidden="true" className="inline-block transition-transform duration-500 group-hover:translate-x-2">→</span></p>
                </div>
              </Link>
            </Reveal>
          </footer>
        )}
      </article>
    </PageShell>
  );
}
