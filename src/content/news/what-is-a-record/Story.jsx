"use client";
// Vinyl A to Z · Chapter 01 — "What Is Vinyl?"
// 히어로(도는 판 영상) → 01 Vinyl이란? → 02 무엇으로 만들어질까? → 03 저장과 재생 → 마무리
// - 섹션마다 배경·글자색이 있고, 경계가 화면 가운데를 지나는 동안 이어서 바뀜 (헤더·위 ← News·아래 Next story까지 같이)
// - 휠·키 한 번에 한 섹션씩 넘어감 (Home 처럼). 화면보다 긴 섹션은 끝까지 보여 준 뒤 넘어감. 터치는 손가락 스크롤 그대로
// - 사진·영상 자리는 점선 박스 (public/news/what-is-a-record/ 에 넣고 <img>/<video> 로 교체)
import { useEffect, useRef } from "react";
import Link from "next/link";
import Reveal, { RiseText } from "@/components/story/Reveal";

const BODONI = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.02em]";
const KR = "font-['Noto_Serif_KR',Georgia,serif]";
const WRAP = "mx-auto w-full max-w-[1240px] px-[clamp(20px,5vw,80px)]";
const MEDIA = "/news/what-is-a-record";

// 섹션 색 (라이트 / 다크 테마). bg 바탕 · fg 글자 · ac 강조
const PALETTE = {
  light: [
    { bg: "#f4e7cd", fg: "#4c404a", ac: "#c8553d" },   // 히어로: 크림
    { bg: "#dfe6e8", fg: "#3d3440", ac: "#c8553d" },   // 01: 옅은 하늘
    { bg: "#ead7b4", fg: "#4c404a", ac: "#b4472f" },   // 02: 모래
    { bg: "#17121a", fg: "#f4e7cd", ac: "#e0674c" },   // 03: 밤
    { bg: "#f4e7cd", fg: "#4c404a", ac: "#c8553d" },   // 마무리: 다시 크림 (아래 Next story 와 이어짐)
  ],
  dark: [
    { bg: "#4c404a", fg: "#f4e7cd", ac: "#e0674c" },
    { bg: "#3a4148", fg: "#f4e7cd", ac: "#e0674c" },
    { bg: "#51432f", fg: "#f4e7cd", ac: "#e98a5f" },
    { bg: "#17121a", fg: "#f4e7cd", ac: "#e0674c" },
    { bg: "#4c404a", fg: "#f4e7cd", ac: "#e0674c" },
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
      for (let j = 1; j < sections.length; j++) {
        const k = smooth(Math.min(1, Math.max(0, (probe - (top(sections[j]) - H() * 0.3)) / (H() * 0.6))));
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
        return scrollToY(root.offsetTop + root.offsetHeight - 24);   // 마지막 섹션 다음: 아래 Next story 가 화면 위에 오게 (그 아래는 보통 스크롤)
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

/* 영상: 화면 근처에서만 받아 재생, 벗어나면 멈춤 */
function useVideos(rootRef) {
  useEffect(() => {
    const root = rootRef.current, page = root?.closest(".page");
    if (!root) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((es) => es.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (v.dataset.src && !v.getAttribute("src")) { v.src = v.dataset.src; v.load(); }
        if (!reduced) v.play().catch(() => {});
      } else v.pause();
    }), { root: page, rootMargin: "50% 0px" });
    root.querySelectorAll("video").forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [rootRef]);
}

// 사진·영상 자리 (점선 박스). 자료가 오면 children 으로 <img>/<video>
function Slot({ ratio, label, dark = false, children, className = "" }) {
  return (
    <figure className={className}>
      <div className={`relative overflow-hidden rounded-[4px] ${ratio} ${children ? "" : "outline-[1.5px] outline-dashed -outline-offset-[1.5px] outline-current/35 bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,currentColor_7%,transparent)_0_12px,transparent_12px_24px)]"} ${dark ? "bg-[#0b0a0b]" : ""}`}>
        {children}
      </div>
      <figcaption className="mt-2.5 text-[11px] uppercase tracking-[0.24em] text-(--ink)/50">{label}</figcaption>
    </figure>
  );
}

const Num = ({ n }) => <p className={`${BODONI} text-[clamp(4rem,9vw,8rem)] leading-none text-(--story-accent)`}>{n}</p>;
const Chip = ({ children, end }) => (
  <li className={`rounded-full px-4 py-2 ${end ? "bg-(--ink) font-semibold text-(--cream)" : "border border-(--ink)/40"}`}>{children}</li>
);
const Arrow = () => <li aria-hidden="true" className="text-(--story-accent)">→</li>;

export default function Story() {
  const root = useRef(null);
  useSectionStage(root);
  useVideos(root);

  return (
    <div ref={root} className={`${KR} text-(--ink)`}>
      {/* 한글 본문용 명조 (이 글에서만 불러옴) */}
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap" />

      {/* ── 히어로 ── */}
      <section data-section aria-label="What Is Vinyl?" className="flex min-h-svh items-center pb-16 pt-[calc(var(--ct-header-h,106px)+80px)]">
        <div className={`${WRAP} grid items-center gap-12 md:grid-cols-[1fr_1.05fr]`}>
          <div>
            <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--story-accent)">Vinyl A to Z · Chapter 01</Reveal>
            <RiseText as="h1" lines={["What Is", "Vinyl?"]} delay={120} lineClassName="whitespace-nowrap" className={`${BODONI} mt-5 text-[clamp(3.4rem,8vw,8.4rem)] leading-[0.86]`} />
            <Reveal delay={400} as="p" className="mt-6 text-[clamp(1.4rem,2.6vw,2.2rem)] font-black">바이닐이란 무엇인가?</Reveal>
            <Reveal delay={550} as="p" className="mt-6 max-w-md text-[16px] leading-8 text-(--ink)/75">
              소리를 홈의 굴곡으로 새기고, 바늘로 그 굴곡을 다시 읽어 소리로 되돌리는 음반. 바이닐이 무엇이고, 어떻게 음악을 담는지 알아봅니다.
            </Reveal>
          </div>
          <Reveal delay={250}>
            <Slot ratio="aspect-[4/3]" dark label="Turntable · 33⅓ rpm">
              {/* 10.6초 끊김 없는 반복(판 5바퀴 남짓) · 960×720 · 1.2MB. 포스터가 먼저 보이고 영상이 이어받음 */}
              <video src={`${MEDIA}/hero.mp4`} poster={`${MEDIA}/hero-poster.webp`} autoPlay muted loop playsInline preload="auto"
                aria-hidden="true" className="absolute inset-0 size-full object-cover" />
            </Slot>
          </Reveal>
        </div>
      </section>

      {/* ── 01 Vinyl이란? ── */}
      <section data-section aria-label="01 Vinyl이란?" className="flex min-h-svh items-center py-24">
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
            <Slot ratio="aspect-[4/5] max-h-[70svh]" label="Photo · 레코드 표면, 나선형 홈 클로즈업 (4:5)" />
          </Reveal>
        </div>
      </section>

      {/* ── 02 무엇으로 만들어질까? ── */}
      <section data-section aria-label="02 Vinyl은 무엇으로 만들어질까?" className="flex min-h-svh items-center py-24">
        <div className={WRAP}>
          <div className="flex flex-wrap items-end gap-x-6">
            <Reveal><Num n="02" /></Reveal>
            <Reveal as="h2" delay={100} className="mt-2 text-[clamp(2rem,4vw,3.4rem)] font-black leading-tight md:pb-3">Vinyl은 무엇으로 만들어질까?</Reveal>
          </div>
          <div className="mt-10 grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
            <Reveal delay={150} className="grid grid-cols-2 gap-4 self-start">
              <Slot className="col-span-2" ratio="aspect-video" label="Photo · 레코드 프레스 공정 (16:9)" />
              <Slot ratio="aspect-[4/3]" label="Photo · PVC 펠릿" />
              <Slot ratio="aspect-[4/3]" label="Photo · 1948 Columbia LP" />
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
      <section data-section aria-label="03 Vinyl은 어떻게 음악을 저장하고 재생할까?" className="flex min-h-svh items-center py-24">
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
              <Slot className="mt-4" ratio="aspect-video" label="Video · 커팅 선반이 마스터 디스크에 홈을 새기는 장면 (16:9)" />
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
              <Slot className="mt-4" ratio="aspect-video" label="Video · 홈을 따라가는 바늘 매크로 (16:9)" />
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

      {/* ── 마무리 ── */}
      <section data-section aria-label="Sound becomes a groove" className="flex min-h-svh flex-col items-center justify-center py-24 text-center">
        <div className={WRAP}>
          <RiseText as="p" lines={["Sound becomes a groove.", "A groove becomes sound."]} lineClassName="sm:whitespace-nowrap [&:last-child]:text-(--story-accent)"
            className={`${BODONI} text-[clamp(2.2rem,6vw,6rem)] leading-[0.98]`} />
          <Reveal delay={400} className="mt-12 flex flex-wrap justify-center gap-3">
            <Link href="/digging" className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--cream) transition-colors hover:bg-(--story-accent)">
              Start digging
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
