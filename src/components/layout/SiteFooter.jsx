"use client";
// 사이트 공통 Footer = "상자의 마지막 판" — PageShell 맨 아래 (footer={false} 로 끌 수 있음)
// - 맨 아래로 내려오면: 상자(앞판에 GROOVES 도장) 뒤에서 마지막 슬리브가 올라오며 앞으로 기울어 서고,
//   그 뒷면에 링크가 적혀 있음. 끝에 가까워지면 판이 슬리브의 반달 홈 뒤에서 위로 빠져나옴 (돌지 않음)
// - 판은 Home·앨범과 같은 3D 잉크 판 (AlbumVinyl = vinyl.glb + inkShaders). Footer 가 화면 근처일 때만 그림
// - "Back to top": 맨 위로 부드럽게 스크롤 (Home 은 Hero 로)
// - 진행도는 리렌더 없이 CSS 변수 --fp (0: Footer 윗변이 화면 바닥에 닿음 → 1: 페이지 끝)
// - 움직임 줄이기: 슬리브·판은 다 올라온 상태로 고정, Back to top 은 바로 맨 위로
// - 판 모델은 인트로 동안 미리 받아 둠 (lib/vinylModel). 3D 는 Footer 가 화면 두 개 거리 안에 오면 미리 그려 둠
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { NAV } from "@/components/crate/routes";
import useAuthUser from "@/lib/useAuthUser";
import { SITE } from "@/lib/site";

const AlbumVinyl = dynamic(() => import("@/components/album/AlbumVinyl"), { ssr: false });
const LABEL_B = "#bbcbda";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const HEAD = "text-[11px] font-medium uppercase tracking-[0.26em] text-(--cream)/55";
const LINK = "group/l inline-flex min-h-11 items-center py-1 md:min-h-0 text-[15px] text-(--cream)/85 transition-colors hover:text-(--cream)";
// --fp 의 a~b 구간을 0~1 로
const seg = (a, b) => `clamp(0, (var(--fp, 1) - ${a}) / ${b - a}, 1)`;
// 슬리브 윗변 가운데 반달 홈 (손가락 걸이) — 배경색과 상관없이 뚫려 보이게 마스크로
const NOTCH = "radial-gradient(ellipse clamp(46px, 6vw, 80px) 22px at 50% 0, transparent 97%, #000 100%)";

function FootLink({ href, children }) {
  const Tag = href.startsWith("mailto:") ? "a" : Link;
  return (
    <Tag href={href} className={LINK}>
      <span className="h-px w-0 bg-current transition-[width,margin] duration-300 group-hover/l:mr-2 group-hover/l:w-3" />
      {children}
    </Tag>
  );
}

// 판의 잉크색 = 지금 테마의 --ink (다크 모드면 크림 선). 테마가 바뀌면 다시 읽음
function useInk(ref, key) {
  const [ink, setInk] = useState("#4c404a");
  useEffect(() => {
    const read = () => {
      const v = ref.current && getComputedStyle(ref.current).getPropertyValue("--ink").trim();
      if (v) setInk(v);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [ref, key]);
  return ink;
}

// 스크롤 컨테이너: 보통 페이지(.page), Home 은 News 칸(#news, data-scroll-root)
const scrollerOf = (el) => el?.closest("[data-scroll-root]") ?? el?.closest(".page") ?? null;

// onSideA: "맨 위로" 대신 할 일 (Home 은 스테이지를 Hero 로 돌림)
// palette: 페이지가 색을 정할 때 (앨범 상세) { sleeve, text, crate } — 슬리브·글자·상자 앞판 색
export default function SiteFooter({ onSideA, palette }) {
  const user = useAuthUser();
  const year = new Date(`${SITE.legalUpdated}T12:00:00+09:00`).getFullYear();
  const root = useRef(null);
  const [near, setNear] = useState(false);      // 화면 근처에 오면 3D 판을 만듦 (페이지마다 WebGL 을 미리 띄우지 않게)
  const ink = useInk(root, palette?.sleeve);

  // 스크롤 진행도 → --fp, 화면에 있을 때만 판이 돎
  useEffect(() => {
    const el = root.current;
    const scroller = scrollerOf(el);
    if (!el || !scroller) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.setProperty("--fp", "1"); setNear(true); return; }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const box = el.getBoundingClientRect(), view = scroller.getBoundingClientRect();
      const top = box.top - view.top, vh = scroller.clientHeight;
      const p = Math.min(1, Math.max(0, (vh - top) / Math.max(1, box.height)));
      el.style.setProperty("--fp", p.toFixed(4));
      if (top < vh * 3) setNear(true);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(measure); };
    scroller.addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    measure();
    return () => { scroller.removeEventListener("scroll", queue); removeEventListener("resize", queue); cancelAnimationFrame(raf); };
  }, []);

  const toTop = () => {
    if (onSideA) { onSideA(); return; }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollerOf(root.current)?.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  };

  return (
    <footer ref={root} style={{
      ...(palette && { "--ink": palette.sleeve, "--cream": palette.text, "--crate-bg": palette.crate }),
      "--fp": 0, "--crate-h": "clamp(104px, 17vw, 270px)",
      // 판 지름 = 슬리브 너비의 80%, 올라오는 높이 = 지름의 30% → 그만큼 위 여백을 둬서 판이 잘리지 않게
      // 넓은 화면에서는 슬리브가 1500px 에서 멈춤 (그보다 좁으면 좌우 여백만 두고 꽉 참)
      "--gutter": "clamp(16px, 3vw, 56px)", "--disc": "calc((min(100vw, 1500px) - 2 * var(--gutter)) * 0.8)", "--rise": "0.3",
    }}
      className="site-footer group/footer relative isolate mt-auto overflow-hidden pt-[calc(var(--disc)*var(--rise)+clamp(1.5rem,4vw,3.5rem))] text-(--ink) [perspective:1600px]">

      {/* 상자 안 다른 판들의 윗부분 (마지막 판이 올라오면 그 앞을 가림) */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[var(--crate-h)] -z-10 mx-auto flex h-[clamp(3rem,6vw,5rem)] max-w-[1500px] items-end gap-[1.5%] px-[calc(var(--gutter)+clamp(12px,2vw,34px))]">
        {[["#2d6a6a", 92, 0], ["#4f6d93", 70, 3], ["#e3b04b", 100, -2], ["#bbcbda", 80, 2], ["#8a5a3c", 64, -3]].map(([c, h, r], i) => (
          <span key={i} className="flex-1 rounded-t-[3px]" style={{ backgroundColor: c, height: `${h}%`, rotate: `${r}deg` }} />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1500px] px-(--gutter)">
        {/* 마지막 슬리브: 상자 안에 잠겨 뒤로 누워 있다가 → 올라오며 앞으로 섬 */}
        <div className="relative origin-bottom will-change-transform"
          style={{ transform: `translateY(calc((1 - ${seg(0, 0.75)}) * 34%)) rotateX(calc((1 - ${seg(0, 0.75)}) * 16deg))` }}>
          {/* 반달 홈 뒤에서 위로 빠져나오는 판 — 슬리브 키에 맞춘 크기, 돌지 않음 */}
          <div aria-hidden="true"
            className="absolute left-1/2 top-0 -z-10 aspect-square w-(--disc)"
            style={{ translate: `-50% calc(${seg(0.45, 1)} * var(--rise) * -100%)` }}>
            {near && <AlbumVinyl ink={ink} label={LABEL_B} rpm={33.333} playing={false} dpr={[1, 1.5]} />}
          </div>

          <div style={{ WebkitMask: NOTCH, mask: NOTCH }} className="relative rounded-t-[10px] bg-(--ink) px-[clamp(20px,4vw,72px)] pb-[calc(var(--crate-h)+clamp(1.5rem,3vw,2.5rem))] pt-[clamp(2.75rem,6vw,5rem)] text-(--cream) shadow-[0_-30px_60px_-30px_rgba(0,0,0,.45)]">
            <p aria-hidden="true" className="absolute left-[clamp(20px,4vw,72px)] top-4 text-[10px] uppercase tracking-[0.3em] text-(--cream)/45 tabular-nums">Side B · The end</p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] md:gap-8">
              <div className="col-span-2 md:col-span-1">
                <p className={`${SERIF} text-[clamp(2rem,3.4vw,3.2rem)] leading-[0.95]`}>Slow down.<br />Listen closer.</p>
                <p className="mt-5 max-w-[32ch] text-[14px] leading-6 text-(--cream)/65">{SITE.tagline}</p>
              </div>
              <nav aria-label="Explore">
                <p className={HEAD}>Explore</p>
                <ul className="mt-4 grid">{NAV.map((item) => <li key={item.href}><FootLink href={item.href}>{item.label}</FootLink></li>)}</ul>
              </nav>
              <nav aria-label="You">
                <p className={HEAD}>You</p>
                <ul className="mt-4 grid">
                  {user ? (
                    <>
                      <li><FootLink href="/collection">My collection</FootLink></li>
                      <li><FootLink href="/account">Account</FootLink></li>
                    </>
                  ) : <li><FootLink href="/login">Log in</FootLink></li>}
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

            <div className="mt-[clamp(2.5rem,6vw,4.5rem)] flex flex-wrap items-center justify-between gap-4 border-t border-(--cream)/20 pt-5 text-[11px] uppercase tracking-[0.22em] text-(--cream)/60">
              <p className="tabular-nums">© {year} {SITE.name} · {SITE.city}</p>
              <button type="button" onClick={toTop}
                className="group/t inline-flex min-h-11 items-center gap-3 rounded-full border border-(--cream)/30 py-1 pl-5 pr-1.5 text-(--cream) transition-colors hover:border-(--cream) hover:bg-(--cream) hover:text-(--ink)">
                Back to top
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-(--cream) text-(--ink) transition-transform duration-500 [transform-style:preserve-3d] group-hover/t:[transform:rotateY(180deg)] group-hover/t:bg-(--ink) group-hover/t:text-(--cream)">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 13V3M4 7l4-4 4 4" /></svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 상자 앞판: 맨 아래, 슬리브 위를 덮음. GROOVES 도장 */}
      <div className="absolute inset-x-0 bottom-0 z-10 h-(--crate-h) border-t-[3px] border-(--ink) bg-(--crate-bg,var(--cream)) [box-shadow:0_-14px_30px_-18px_rgba(0,0,0,.35)]">
        <p aria-hidden="true" className={`${SERIF} relative mx-auto max-w-[1500px] select-none overflow-hidden whitespace-nowrap px-[clamp(16px,3vw,56px)] text-center text-[clamp(4.2rem,17vw,17rem)] leading-[0.9] text-(--ink) [-webkit-text-stroke:0]`}
          style={{ transform: `translateY(calc((1 - ${seg(0.2, 0.9)}) * 22%))` }}>
          {SITE.name}
        </p>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.3em] text-(--ink)/45">Crate No. 1 · Handle with care</p>
      </div>

    </footer>
  );
}
