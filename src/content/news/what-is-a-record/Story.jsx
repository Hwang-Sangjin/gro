"use client";
// Vinyl A to Z · Chapter 01 — "What Is Vinyl?"
// 히어로(위에서 본 3D 판) → 01 Vinyl이란? → 02 무엇으로 만들어질까? → 03 저장과 재생 → (아래 Next story)
// - 섹션마다 배경·글자색이 있고, 경계가 화면 가운데를 지나는 동안 이어서 바뀜 (헤더·위 ← News·아래 Next story까지 같이)
// - 휠·키 한 번에 한 섹션씩 넘어감 (Home 처럼). 화면보다 긴 섹션은 끝까지 보여 준 뒤 넘어감. 터치는 손가락 스크롤 그대로
// - 사진·영상 대신 3D: 01 비스듬한 판 클로즈업 · 02 1948 LP · 03 마스터 디스크(커팅) / 바늘 매크로(재생)
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Reveal, { RiseText } from "@/components/story/Reveal";

const AlbumVinyl = dynamic(() => import("@/components/album/AlbumVinyl"), { ssr: false });
const NeedleScene = dynamic(() => import("./NeedleScene"), { ssr: false });
// 3D 장면 카메라 위치 고정값 (0 = 판 위 비스듬히, 1 = 바늘 옆 매크로)
const WIDE = { current: 0.32 }, MACRO = { current: 0.9 };

const BODONI = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.02em]";
const KR = "font-['Noto_Serif_KR',Georgia,serif]";
const WRAP = "mx-auto w-full max-w-[1240px] px-[clamp(20px,5vw,80px)]";
// 섹션 여백: 위는 헤더 높이만큼 비우고 위아래 같은 여백 → 내용이 '헤더 아래 화면'의 가운데에 옴
const SECTION_PAD = "pt-[calc(var(--ct-header-h,106px)+clamp(16px,3vh,40px))] pb-[clamp(16px,3vh,40px)]";

// 섹션 색 (라이트 / 다크 테마). bg 바탕 · fg 글자 · ac 강조
const PALETTE = {
  light: [
    { bg: "#f4e7cd", fg: "#4c404a", ac: "#c8553d" },   // 히어로: 크림
    { bg: "#dfe6e8", fg: "#3d3440", ac: "#c8553d" },   // 01: 옅은 하늘
    { bg: "#ead7b4", fg: "#4c404a", ac: "#b4472f" },   // 02: 모래
    { bg: "#17121a", fg: "#f4e7cd", ac: "#e0674c" },   // 03: 밤
    { bg: "#f4e7cd", fg: "#4c404a", ac: "#c8553d" },   // 글 끝(아래 Next story): 다시 크림
  ],
  dark: [
    { bg: "#4c404a", fg: "#f4e7cd", ac: "#e0674c" },
    { bg: "#3a4148", fg: "#f4e7cd", ac: "#e0674c" },
    { bg: "#51432f", fg: "#f4e7cd", ac: "#e98a5f" },
    { bg: "#17121a", fg: "#f4e7cd", ac: "#e0674c" },
    { bg: "#4c404a", fg: "#f4e7cd", ac: "#e0674c" },   // 글 끝
  ],
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const smooth = (t) => t * t * (3 - 2 * t);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* 섹션 색 이어 바꾸기 + 섹션 단위 스크롤 */
function useSectionStage(rootRef) {
  useEffect(() => {
    const root = rootRef.current, page = root?.closest(".page"), layer = root?.closest(".ct-page");
    if (!root || !page) return;
    const sections = [...root.querySelectorAll("[data-section]")];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const H = () => page.clientHeight;
    const top = (s) => s.offsetTop;   // .page-content 안의 위치 = 스크롤 위치

    /* 색: 경계마다 0→1 (경계가 화면 가운데를 지나는 동안) */
    const KEYS = ["--bg", "--fg", "--ink", "--cream", "--paper-surface", "--story-accent"];
    const paint = () => {
      const pal = (document.documentElement.dataset.theme === "dark" ? PALETTE.dark : PALETTE.light).map((p) => ({ bg: hex(p.bg), fg: hex(p.fg), ac: hex(p.ac) }));
      const probe = page.scrollTop + H() * 0.5;
      let { bg, fg, ac } = pal[0];
      // 경계: 각 섹션의 시작, 마지막은 글 끝(아래 Next story 가 시작하는 곳) — 거기서 다시 기본 색으로
      const edges = [...sections.slice(1).map(top), root.offsetTop + root.offsetHeight];
      for (let j = 1; j <= edges.length; j++) {
        const k = smooth(Math.min(1, Math.max(0, (probe - (edges[j - 1] - H() * 0.3)) / (H() * 0.6))));
        if (k <= 0) break;
        const L = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
        bg = L(bg, pal[j].bg); fg = L(fg, pal[j].fg); ac = L(ac, pal[j].ac);
      }
      const css = (c) => `rgb(${c.map(Math.round).join(",")})`;
      const B = css(bg), F = css(fg);
      // 페이지 전체(종이 결·← News·Next story)와 헤더가 같이 바뀜
      page.style.setProperty("--bg", B); page.style.setProperty("--paper-surface", B); page.style.setProperty("--cream", B);
      page.style.setProperty("--fg", F); page.style.setProperty("--ink", F);
      page.style.setProperty("--story-accent", css(ac));
      layer?.style.setProperty("--ct-header-bg", B); layer?.style.setProperty("--ct-header-fg", F);
    };

    /* 섹션 단위 스크롤 */
    let anim = 0, quietUntil = 0;
    const scrollToY = (y) => {
      y = Math.max(0, Math.min(y, page.scrollHeight - H()));
      const set = (v) => page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: v } }));
      cancelAnimationFrame(anim);
      if (reduced) { set(y); return; }
      const y0 = page.scrollTop, d = y - y0, dur = Math.min(1400, 700 + Math.abs(d) * 0.35), t0 = performance.now();
      const step = (now) => {
        const u = Math.min(1, (now - t0) / dur);
        set(y0 + d * easeIO(u));
        if (u < 1) anim = requestAnimationFrame(step);
        else { anim = 0; quietUntil = performance.now() + 450; }   // 트랙패드 관성으로 한 번 더 넘어가지 않게
      };
      anim = requestAnimationFrame(step);
    };
    const indexAt = () => { let i = 0; sections.forEach((s, j) => { if (top(s) <= page.scrollTop + 4) i = j; }); return i; };
    const step = (dir) => {
      const i = indexAt(), s = sections[i], bottom = top(s) + s.offsetHeight, y = page.scrollTop;
      if (dir > 0) {
        // 긴 섹션: 남은 부분이 아래 여백(140px)보다 많으면 한 화면 더 읽기
        if (y + H() < bottom - 140) return scrollToY(Math.min(bottom - H(), y + H() * 0.85));
        if (i < sections.length - 1) return scrollToY(top(sections[i + 1]));
        return scrollToY(root.offsetTop + root.offsetHeight - (layer?.querySelector(".ct-navbar")?.offsetHeight ?? 106) - 24);   // 마지막 섹션 다음: 아래 Next story 가 화면 위에 오게 (그 아래는 보통 스크롤)
      }
      if (y > bottom - 4 && i === sections.length - 1) return scrollToY(top(s));   // Next story 에서 위로
      if (y > top(s) + 140) return scrollToY(Math.max(top(s), y - H() * 0.85));
      if (i > 0) { const p = sections[i - 1]; scrollToY(Math.max(top(p), top(p) + p.offsetHeight - H())); }
    };
    const onWheel = (e) => {
      if (e.ctrlKey || document.documentElement.dataset.crateTransition === "true") return;
      e.preventDefault(); e.stopPropagation();   // 페이지 Lenis 대신 여기서 섹션 단위로
      if (anim || performance.now() < quietUntil) { if (!anim) quietUntil = performance.now() + 120; return; }
      if (Math.abs(e.deltaY) < 3) return;
      step(Math.sign(e.deltaY));
    };
    const onKey = (e) => {
      if (e.defaultPrevented || e.target.closest?.("input,textarea,select,[contenteditable=true],.navbar")) return;
      if (!root.closest(".ct-page")?.isConnected || root.closest("[inert]")) return;
      const down = ["ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
      const up = ["ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
      if (!down && !up) return;
      e.preventDefault();
      if (!anim) step(down ? 1 : -1);
    };

    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
    const themeObs = new MutationObserver(paint);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    root.addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey);
    page.addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    paint();
    return () => {
      cancelAnimationFrame(anim); cancelAnimationFrame(raf); themeObs.disconnect();
      root.removeEventListener("wheel", onWheel);
      removeEventListener("keydown", onKey);
      page.removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      for (const k of KEYS) page.style.removeProperty(k);
      layer?.style.removeProperty("--ct-header-bg"); layer?.style.removeProperty("--ct-header-fg");
    };
  }, [rootRef]);
}

/* 3D 장면은 화면 근처(위아래 한 화면)에 왔을 때만 띄우고, 멀어지면 내림 */
function Near({ className = "", children }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { root: el.closest(".page"), rootMargin: "100% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className}>{on && children}</div>;
}

const Num = ({ n }) => <p className={`${BODONI} text-[clamp(4rem,9vw,8rem)] leading-none text-(--story-accent)`}>{n}</p>;
const Chip = ({ children, end }) => (
  <li className={`rounded-full px-4 py-2 ${end ? "bg-(--ink) font-semibold text-(--cream)" : "border border-(--ink)/40"}`}>{children}</li>
);
const Arrow = () => <li aria-hidden="true" className="text-(--story-accent)">→</li>;

export default function Story() {
  const root = useRef(null);
  useSectionStage(root);

  return (
    <div ref={root} className={`${KR} text-(--ink)`}>
      {/* 한글 본문용 명조 (이 글에서만 불러옴) */}
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap" />

      {/* ── 히어로: 제목 + 크게 도는 3D 판 ── */}
      <section data-section aria-label="What Is Vinyl?" className={`flex min-h-svh items-center ${SECTION_PAD}`}>
        <div className="mx-auto grid w-full max-w-[1680px] items-center gap-[clamp(28px,4vw,72px)] px-[clamp(20px,4vw,72px)] md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.5fr)]">
          <div className="max-md:order-2">
            <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--story-accent)">Vinyl A to Z · Chapter 01</Reveal>
            <RiseText as="h1" lines={["What Is", "Vinyl?"]} delay={120} lineClassName="whitespace-nowrap" className={`${BODONI} mt-5 text-[clamp(3.2rem,6.2vw,7.6rem)] leading-[0.86]`} />
            <Reveal delay={400} as="p" className="mt-6 text-[clamp(1.35rem,2.2vw,2rem)] font-black">바이닐이란 무엇인가?</Reveal>
            <Reveal delay={550} as="p" className="mt-5 max-w-sm text-[16px] leading-8 text-(--ink)/75">
              소리를 홈의 굴곡으로 새기고, 바늘로 그 굴곡을 다시 읽어 소리로 되돌리는 음반. 바이닐이 무엇이고, 어떻게 음악을 담는지 알아봅니다.
            </Reveal>
          </div>
          <Reveal delay={200} className="flex justify-center max-md:order-1">
            {/* Home 과 같은 3D 잉크 판 — 위에서 내려다본 정면으로 33⅓ RPM 으로 계속 돎. 검정 판 */}
            <div className="relative aspect-square w-[min(100%,calc(100svh-var(--ct-header-h,106px)-6rem))]">
              <AlbumVinyl ink="#171217" label="#2a222a" rpm={33.333} playing tilt={90} dpr={[1, 1.5]} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 01 Vinyl이란? ── */}
      <section data-section aria-label="01 Vinyl이란?" className={`flex min-h-svh items-center ${SECTION_PAD}`}>
        <div className={`${WRAP} grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-20`}>
          <div className="self-center">
            <Reveal><Num n="01" /></Reveal>
            <Reveal as="h2" delay={100} className="mt-2 text-[clamp(2rem,4vw,3.4rem)] font-black leading-tight">Vinyl이란?</Reveal>
            <Reveal delay={200} className="mt-8 space-y-5 text-[17px] leading-8 text-(--ink)/80">
              <p>바이닐 레코드(Vinyl Record)는 <b className="font-semibold text-(--ink)">PVC(폴리염화비닐)</b>라는 플라스틱 소재로 만든 아날로그 음반이다.</p>
              <p>레코드 표면에는 미세한 <b className="font-semibold text-(--ink)">홈(Groove)</b>이 나선형으로 새겨져 있으며, 이 홈에 음악의 소리 정보가 기록되어 있다.</p>
            </Reveal>
            <Reveal as="blockquote" delay={300} className="mt-10 border-l-[3px] border-(--story-accent) pl-5 text-[clamp(1.2rem,1.9vw,1.6rem)] font-semibold leading-relaxed">
              디지털 음원과 달리 소리를 <span className="text-(--story-accent)">물리적인 홈의 굴곡</span>으로 기록하고 재생한다.
            </Reveal>
          </div>
          <Reveal delay={150} className="self-center">
            <figure>
              {/* 3D 판을 비스듬히 눕혀 크게 — 박스 밖으로 넘치게 키워 홈과 빛줄기가 흐르는 가장자리만 보임 */}
              <Near className="relative aspect-[4/5] max-h-[70svh] overflow-hidden rounded-[4px]">
                <div className="absolute -left-[10%] top-[-35%] aspect-square w-[190%]">
                  <AlbumVinyl ink="#171217" label="#2a222a" rpm={33.333} playing tilt={58} dpr={[1, 1.5]} />
                </div>
              </Near>
              <figcaption className="mt-2.5 text-[11px] uppercase tracking-[0.24em] text-(--ink)/50">Groove · 나선형으로 이어진 하나의 홈</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ── 02 무엇으로 만들어질까? ── */}
      <section data-section aria-label="02 Vinyl은 무엇으로 만들어질까?" className={`flex min-h-svh items-center ${SECTION_PAD}`}>
        <div className={WRAP}>
          <div className="flex flex-wrap items-end gap-x-6">
            <Reveal><Num n="02" /></Reveal>
            <Reveal as="h2" delay={100} className="mt-2 text-[clamp(2rem,4vw,3.4rem)] font-black leading-tight md:pb-3">Vinyl은 무엇으로 만들어질까?</Reveal>
          </div>
          <div className="mt-10 grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
            <Reveal delay={150} className="self-center">
              {/* 1948 LP: 붉은 라벨의 검정 판이 33⅓ RPM 으로 */}
              <Near className="relative mx-auto aspect-square w-[min(100%,520px)]">
                <AlbumVinyl ink="#171217" label="#c8553d" rpm={33.333} playing dpr={[1, 1.5]} />
              </Near>
              <p className="mt-2 text-center text-[11px] uppercase tracking-[0.24em] text-(--ink)/50">1948 · Columbia LP · 33⅓ rpm · Microgroove</p>
            </Reveal>
            <div>
              <Reveal delay={200} className="space-y-4 text-[16px] leading-8 text-(--ink)/80">
                <p>바이닐 레코드는 주로 <b className="font-semibold text-(--ink)">PVC(Polyvinyl Chloride, 폴리염화비닐)</b> 계열 소재로 제작된다.</p>
                <p>PVC는 비교적 유연하고 내구성이 있는 플라스틱으로, 소리 정보를 담는 미세한 홈을 정밀하게 만들기에 적합하다.</p>
                <p>1948년 컬럼비아 레코드가 발표한 현대적인 LP는 PVC 계열 소재와 <b className="font-semibold text-(--ink)">미세한 홈(Microgroove)</b> 기술을 활용해 한 면에 약 20분 이상의 음악을 담을 수 있었다.</p>
                <p>오늘날에도 PVC 계열 소재는 바이닐 레코드 제작에 널리 사용되고 있다.</p>
              </Reveal>
              <Reveal as="dl" delay={300} className="mt-8 grid grid-cols-3 border-t-[3px] border-(--ink)">
                {[["Year", "1948"], ["Per side", <>20<span key="m" className="text-[.45em]">+min</span></>], ["Material", "PVC"]].map(([k, v], i) => (
                  <div key={k} className={`py-5 ${i ? "border-l border-(--ink)/20 pl-3" : "pr-3"}`}>
                    <dt className="text-[10px] uppercase tracking-[0.24em] text-(--ink)/55">{k}</dt>
                    <dd className={`${BODONI} mt-2 text-[clamp(1.9rem,3.2vw,2.8rem)] leading-none`}>{v}</dd>
                  </div>
                ))}
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 저장과 재생 ── */}
      <section data-section aria-label="03 Vinyl은 어떻게 음악을 저장하고 재생할까?" className={`flex min-h-svh items-center ${SECTION_PAD}`}>
        <div className={WRAP}>
          <div className="grid items-end gap-6 md:grid-cols-[1.1fr_1fr]">
            <div>
              <Reveal><Num n="03" /></Reveal>
              <Reveal as="h2" delay={100} className="mt-2 text-[clamp(2rem,4vw,3.2rem)] font-black leading-tight">Vinyl은 어떻게 음악을<br className="hidden sm:block" /> 저장하고 재생할까?</Reveal>
            </div>
            <Reveal as="p" delay={200} className="text-[16px] leading-8 text-(--ink)/75">바이닐은 음악을 홈의 미세한 굴곡으로 기록하고, 그 굴곡을 다시 읽어서 소리로 재생하는 방식으로 작동한다.</Reveal>
          </div>

          {/* 흐르는 홈 (소리 = 굴곡) + 가운데 바늘 */}
          <Reveal delay={250} className="relative my-10 h-20 overflow-hidden" aria-hidden="true">
            <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="absolute inset-y-0 left-0 h-full w-[200%] animate-[groove-run_8s_linear_infinite] motion-reduce:animate-none">
              <path id="wiv-wave" d="M0 60 C 40 20, 80 100, 120 60 S 200 30, 240 60 S 300 95, 340 60 S 400 10, 440 60 S 520 110, 560 60 S 620 40, 660 60 S 720 85, 760 60 S 820 15, 860 60 S 940 105, 980 60 S 1040 35, 1080 60 S 1160 90, 1200 60" fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              <use href="#wiv-wave" x="1200" />
              <path d="M0 36 H2400 M0 84 H2400" stroke="currentColor" strokeOpacity=".15" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute inset-y-0 left-1/2 w-px bg-(--story-accent)" />
            <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-(--story-accent) px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-[#17121a]">Needle</span>
          </Reveal>

          <div className="grid gap-14 md:grid-cols-2 md:gap-12">
            <Reveal as="article" delay={300}>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#bbcbda]">Recording · 음악을 저장할 때</p>
              <Near className="relative mt-4 aspect-video overflow-hidden rounded-[4px] bg-[#0f0b10]">
                <NeedleScene progress={WIDE} ink="224,103,76" label="#f4e7cd" head="#bbcbda" className="absolute inset-0" />
              </Near>
              <p className="mt-2.5 text-[11px] uppercase tracking-[0.24em] text-(--ink)/50">Master disc · 커팅 바늘이 홈을 새김</p>
              <div className="mt-5 space-y-3 text-[15px] leading-7 text-(--ink)/80">
                <p>음악의 신호에 맞춰 특수한 <b className="font-semibold text-(--ink)">커팅 바늘</b>이 움직이며 마스터 디스크에 미세한 홈을 새긴다.</p>
                <p>이 홈을 PVC 음반에 복제하여 우리가 사용하는 바이닐 레코드를 만든다.</p>
              </div>
              <ol aria-label="기록 과정" className="mt-6 flex flex-wrap items-center gap-2 text-[13px]">
                <Chip>음악 신호</Chip><Arrow /><Chip>홈 제작</Chip><Arrow /><Chip end>바이닐 레코드</Chip>
              </ol>
            </Reveal>
            <Reveal as="article" delay={420}>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#bbcbda]">Playback · 음악을 재생할 때</p>
              <Near className="relative mt-4 aspect-video overflow-hidden rounded-[4px] bg-[#0f0b10]">
                <NeedleScene progress={MACRO} ink="244,231,205" label="#2a222a" head="#c8553d" className="absolute inset-0" />
              </Near>
              <p className="mt-2.5 text-[11px] uppercase tracking-[0.24em] text-(--ink)/50">Stylus · 홈을 따라 진동하는 바늘</p>
              <div className="mt-5 space-y-3 text-[15px] leading-7 text-(--ink)/80">
                <p>턴테이블에서 레코드가 회전하면 <b className="font-semibold text-(--ink)">바늘(Stylus)</b>이 홈의 굴곡을 따라 진동한다.</p>
                <p>이 진동은 <b className="font-semibold text-(--ink)">카트리지(Cartridge)</b>를 통해 전기 신호로 변환되고, 앰프와 스피커를 거쳐 음악으로 재생된다.</p>
              </div>
              <ol aria-label="재생 과정" className="mt-6 flex flex-wrap items-center gap-2 text-[13px]">
                <Chip>레코드의 홈</Chip><Arrow /><Chip>바늘의 진동</Chip><Arrow /><Chip>전기 신호</Chip><Arrow /><Chip end>스피커</Chip>
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

    </div>
  );
}
