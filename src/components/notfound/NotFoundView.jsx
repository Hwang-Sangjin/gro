"use client";
// 404 — 가운데 '0' 자리에 3D 잉크 판(AlbumVinyl)이 화면 아래에서 올라와 양옆 '4'와 함께 "404"가 됨
// 사이트 안에서 오면 다른 페이지처럼 페이지 넘김 전환, 주소로 바로 오면 인트로(로딩)가 끝난 뒤 등장
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";
import { useIntro } from "@/components/intro/intro-context";

const AlbumVinyl = dynamic(() => import("@/components/album/AlbumVinyl"), { ssr: false });
const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export default function NotFoundView() {
  const { done } = useIntro();
  const [show, setShow] = useState(false);
  // 첫 그림이 그려진 뒤에 켜야 아래에서 올라오는 전환이 보임
  useEffect(() => {
    if (!done) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    return () => cancelAnimationFrame(id);
  }, [done]);

  // 숫자 '4': 아래에서 스르륵 올라옴 (부모가 잘라 줌)
  const four = (delay) => (
    <span aria-hidden="true" className="block overflow-y-clip pb-[0.04em]">
      <span className={`block transition-transform duration-[1100ms] ${EASE} motion-reduce:transition-none ${show ? "translate-y-0" : "translate-y-[110%]"}`}
        style={{ transitionDelay: `${delay}ms` }}>4</span>
    </span>
  );

  return (
    <PageShell footer={false} className="paper-textured">
      <main className="flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-[calc(var(--ct-header-h,106px)+2rem)] text-center text-(--ink)">
        <h1 className="sr-only">Page not found (404)</h1>

        {/* 4 · 판 · 4 */}
        <div className={`${SERIF} flex items-center justify-center gap-[0.04em] text-[clamp(8rem,30vw,26rem)] font-black leading-[0.86] tracking-[-0.04em]`}>
          {four(900)}
          {/* 판: 화면 아래에서 올라와 '0'이 됨 — 글자 높이에 맞춘 크기, 33⅓ RPM으로 돎 */}
          <span aria-hidden="true"
            className={`relative block aspect-square w-[0.86em] shrink-0 transition-[translate,opacity] duration-[1500ms] ${EASE} motion-reduce:transition-none ${show ? "translate-y-0 opacity-100" : "translate-y-[100vh] opacity-0"}`}
            style={{ transitionDelay: "500ms" }}>
            <AlbumVinyl ink="#4f6d93" label="#bbcbda" rpm={33.333} playing={show} dpr={[1, 1.5]} />
          </span>
          {four(1050)}
        </div>

        <div className={`mt-[clamp(1.5rem,4vh,3rem)] flex flex-col items-center transition-[opacity,translate] duration-700 ${EASE} motion-reduce:transition-none ${show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
          style={{ transitionDelay: "1400ms" }}>
          <p className={`${SERIF} text-[clamp(1.6rem,3vw,2.6rem)] font-black leading-tight`}>This record isn’t in the crate.</p>
          <p className="mt-3 max-w-[40ch] text-[15px] leading-7 text-(--ink)/65">The page you’re looking for was moved, sold out, or never pressed.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-[#c8553d]">
              Back home
            </Link>
            <Link href="/digging" className="inline-flex min-h-12 items-center rounded-full border border-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
              Dig the crate
            </Link>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
