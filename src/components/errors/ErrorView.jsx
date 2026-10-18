"use client";
// 오류 화면 (DB를 못 읽었을 때 등) — 404처럼 사이트 안의 한 장으로: 헤더·종이 결 그대로, 다시 시도 / 홈으로
import { useEffect } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";

/** reset: Next 의 다시 시도 · title: 큰 제목 · back: { href, label } 두 번째 버튼 */
export default function ErrorView({ error, reset, title = "The needle skipped.", back = { href: "/", label: "Back home" }, ...rest }) {
  useEffect(() => { if (error) console.error(error); }, [error]);
  return (
    <PageShell footer={false} className="paper-textured overflow-hidden! [&>.page-content]:p-0! [&>.page-content]:min-h-0!">
      <div {...rest} className="grid h-svh place-items-center px-6 pt-(--ct-header-h,106px) text-center text-(--ink)">
        <div className="flex flex-col items-center animate-[crate-title_.8s_cubic-bezier(.22,1,.36,1)_both]">
          {/* 튄 바늘: 판 위에 비스듬히 걸린 톤암 */}
          <svg viewBox="0 0 120 120" className="mb-8 size-[clamp(88px,12vw,128px)]" aria-hidden="true">
            <circle cx="52" cy="64" r="44" fill="none" stroke="currentColor" strokeWidth="2.5" />
            {[34, 24, 14].map((r) => <circle key={r} cx="52" cy="64" r={r} fill="none" stroke="currentColor" strokeOpacity=".35" />)}
            <circle cx="52" cy="64" r="5" fill="#2d6a6a" />
            <circle cx="104" cy="14" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M104 20 L96 70 L80 86" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M74 80 l10 10" stroke="#2d6a6a" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <h1 className={`${SERIF} text-[clamp(2rem,4.4vw,3.6rem)] font-black leading-[1.02]`}>{title}</h1>
          <p className="mt-4 max-w-[42ch] text-[15px] leading-7 text-(--ink)/65">
            Something went wrong while loading this page. It’s usually a quick hiccup — give it another spin.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {reset && (
              <button type="button" onClick={() => reset()}
                className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
                Try again
              </button>
            )}
            <Link href={back.href}
              className="inline-flex min-h-12 items-center rounded-full border border-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
              {back.label}
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
