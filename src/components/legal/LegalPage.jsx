"use client";
// 개인정보처리방침·이용약관 공용 틀: 제목 + 시행일 + (데스크톱) 왼쪽 목차 + 번호 붙은 조항
// 목차는 지금 읽는 조항을 따라 표시됨
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import { RiseText } from "@/components/story/Reveal";
import { formatDate } from "@/content/news";
import { SITE } from "@/lib/site";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const DOCS = [["/privacy", "Privacy Policy"], ["/terms", "Terms of Service"]];

export default function LegalPage({ path, title, intro, sections }) {
  const [active, setActive] = useState(sections[0]?.id);
  const body = useRef(null);

  useEffect(() => {
    const root = body.current?.closest(".page");
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.id);
    }, { root, rootMargin: "-20% 0px -65% 0px" });
    body.current.querySelectorAll("section[id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id), root = el?.closest(".page");
    if (!el || !root) return;
    root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 120, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0 [&>.page-content]:px-0 [&>.page-content]:pt-[calc(var(--ct-header-h,106px)+64px)]">
      <article className="mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)] text-(--ink)">
        <header className="border-b-[3px] border-(--ink) pb-8">
          <nav aria-label="Legal documents" className="flex gap-6 text-[11px] font-medium uppercase tracking-[0.26em]">
            {DOCS.map(([href, name]) => (
              <Link key={href} href={href} aria-current={href === path ? "page" : undefined}
                className="border-b border-transparent pb-1 opacity-50 transition-opacity hover:opacity-100 aria-[current=page]:border-current aria-[current=page]:opacity-100">{name}</Link>
            ))}
          </nav>
          <RiseText as="h1" lines={[title]} className={`${SERIF} mt-8 text-[clamp(3rem,8vw,7.5rem)] leading-[0.9]`} />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-[60ch] text-[16px] leading-7 text-(--ink)/80">{intro}</p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-(--ink)/55 tabular-nums">Effective {formatDate(SITE.legalUpdated)}</p>
          </div>
        </header>

        <div className="grid gap-10 pt-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-16">
          {/* 목차 */}
          <nav aria-label="Contents" className="lg:sticky lg:top-[calc(var(--ct-header-h,106px)+24px)] lg:self-start">
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-(--ink)/55">Contents</p>
            <ol className="mt-3 grid gap-0.5 text-[14px]">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={(e) => jump(e, s.id)} data-active={active === s.id}
                    className="flex gap-3 rounded-lg px-2 py-1.5 text-(--ink)/60 transition-colors hover:bg-(--ink)/5 hover:text-(--ink) data-[active=true]:bg-(--ink)/8 data-[active=true]:text-(--ink)">
                    <span className="w-5 shrink-0 tabular-nums opacity-60">{String(i + 1).padStart(2, "0")}</span>{s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div ref={body} className="max-w-[72ch]">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-32 border-b border-(--ink)/15 py-8 first:pt-0">
                <h2 className="flex items-baseline gap-4">
                  <span className="text-[12px] tabular-nums text-[#c8553d]">{String(i + 1).padStart(2, "0")}</span>
                  <span className={`${SERIF} text-[clamp(1.6rem,2.6vw,2.2rem)] leading-tight`}>{s.title}</span>
                </h2>
                <div className="mt-4 grid gap-4 text-[15px] leading-7 text-(--ink)/85 [&_a]:underline [&_a]:decoration-(--ink)/30 [&_a]:underline-offset-4 hover:[&_a]:decoration-(--ink) [&_b]:font-medium [&_b]:text-(--ink) [&_li]:pl-1 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5 [&_li::marker]:text-(--ink)/40">
                  {s.body}
                </div>
              </section>
            ))}
            <p className="py-8 text-[14px] leading-6 text-(--ink)/60">
              Questions? Write to <a href={`mailto:${SITE.email}`} className="underline underline-offset-4">{SITE.email}</a>.
            </p>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
