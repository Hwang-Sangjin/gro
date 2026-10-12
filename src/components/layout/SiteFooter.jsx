"use client";
// 사이트 공통 Footer — PageShell 맨 아래 (footer={false} 로 끌 수 있음)
// 잉크색 띠: 라이트 모드는 브라운 바탕 + 크림 글자, 다크 모드는 반대로 뒤집힘
import Link from "next/link";
import { NAV } from "@/components/crate/routes";
import useAuthUser from "@/lib/useAuthUser";
import { SITE } from "@/lib/site";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const HEAD = "text-[11px] font-medium uppercase tracking-[0.26em] text-(--cream)/55";
const LINK = "group/l inline-flex items-center py-1 text-[15px] text-(--cream)/85 transition-colors hover:text-(--cream)";

function FootLink({ href, children, external }) {
  const props = external ? { target: "_blank", rel: "noreferrer" } : {};
  const Tag = external || href.startsWith("mailto:") ? "a" : Link;
  return (
    <Tag href={href} {...props} className={LINK}>
      <span className="h-px w-0 bg-current transition-[width,margin] duration-300 group-hover/l:mr-2 group-hover/l:w-3" />
      {children}
    </Tag>
  );
}

export default function SiteFooter() {
  const user = useAuthUser();
  const year = new Date(`${SITE.legalUpdated}T12:00:00+09:00`).getFullYear();
  const toTop = (e) => e.currentTarget.closest(".page")?.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="site-footer relative isolate mt-auto overflow-hidden bg-(--ink) text-(--cream)">
      {/* 천천히 도는 판 (장식) */}
      <svg viewBox="0 0 200 200" aria-hidden="true" className="pointer-events-none absolute -right-[12vw] -top-[14vw] -z-10 size-[44vw] max-w-[620px] animate-[spin_14s_linear_infinite] opacity-[.07] motion-reduce:animate-none">
        {Array.from({ length: 18 }, (_, i) => <circle key={i} cx="100" cy="100" r={98 - i * 4} fill="none" stroke="currentColor" strokeWidth={i % 6 ? 0.6 : 1.4} />)}
        <circle cx="100" cy="100" r="22" fill="currentColor" />
      </svg>

      <div className="mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)] pt-[clamp(3.5rem,8vw,6.5rem)]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <p className={`${SERIF} text-[clamp(2rem,3.4vw,3.2rem)] leading-[0.95]`}>Slow down.<br />Listen closer.</p>
            <p className="mt-5 max-w-[32ch] text-[14px] leading-6 text-(--cream)/65">{SITE.tagline}</p>
          </div>

          <nav aria-label="Explore">
            <p className={HEAD}>Explore</p>
            <ul className="mt-4 grid">
              {NAV.map((item) => <li key={item.href}><FootLink href={item.href}>{item.label}</FootLink></li>)}
            </ul>
          </nav>

          <nav aria-label="You">
            <p className={HEAD}>You</p>
            <ul className="mt-4 grid">
              {user ? (
                <>
                  <li><FootLink href="/collection">My collection</FootLink></li>
                  <li><FootLink href="/account">Account</FootLink></li>
                </>
              ) : (
                <li><FootLink href="/login">Log in</FootLink></li>
              )}
              <li><FootLink href={`mailto:${SITE.email}`}>Contact</FootLink></li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <p className={HEAD}>Legal</p>
            <ul className="mt-4 grid">
              <li><FootLink href="/privacy">Privacy Policy</FootLink></li>
              <li><FootLink href="/terms">Terms of Service</FootLink></li>
            </ul>
          </nav>
        </div>

        {/* 큰 워드마크: 아래가 살짝 잘려 띠에 걸쳐 앉음 */}
        <div className="mt-[clamp(3rem,7vw,6rem)] flex items-end justify-between gap-6 border-t border-(--cream)/20 pt-5 text-[11px] uppercase tracking-[0.22em] text-(--cream)/60">
          <p className="tabular-nums">© {year} {SITE.name} · {SITE.city}</p>
          <button type="button" onClick={toTop} className="group/t inline-flex min-h-10 items-center gap-2 transition-colors hover:text-(--cream)">
            Back to top
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full border border-current/40 transition-transform duration-300 group-hover/t:-translate-y-1">↑</span>
          </button>
        </div>
        <p aria-hidden="true" className={`${SERIF} -mb-[0.04em] mt-4 select-none whitespace-nowrap text-center text-[clamp(5rem,23vw,24rem)] leading-[0.8] text-(--cream)`}>
          {SITE.name}
        </p>
      </div>
    </footer>
  );
}
