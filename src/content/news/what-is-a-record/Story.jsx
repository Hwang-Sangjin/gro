"use client";
// Vinyl A to Z · Chapter 01 — "What Is Vinyl?"
// 사이트 손그림(하늘색 연필선) 으로 만든 스크롤 스토리. 장면마다 sticky 로 붙어 있고, 스크롤 진행도(0→1)에 따라 움직임
// 히어로 → 01 What to know → 홈 확대 → 02 Made of PVC → 한 줄 선언 → 03 저장 → 03 재생 → 마무리 → (아래 Next story)
// 손그림이 아직 없는 자리는 ART 에 경로가 없으면 같은 느낌의 임시 SVG 스케치(선이 떨림)로 그림 — 그림이 생기면 ART 에 경로만 넣으면 됨
import { useEffect, useRef } from "react";
import Reveal, { RiseText } from "@/components/story/Reveal";

/* ───────── 그림 ───────── */
const GIF = {
  disc: "/images/grooves/title-vinyl.gif",
  crate: "/images/grooves/title-crate.gif",
  turntable: "/images/grooves/title-turntable.gif",
};
// 새 손그림 자리 (public/images/news/what-is-vinyl/… 에 넣고 경로 지정). null = 임시 스케치
const ART = {
  groove: null,    // Fig. 02 판 표면 + 돋보기
  wave: null,      // Fig. 03 홈의 두 벽 (가로로 긴 그림)
  pellets: null,   // Fig. 04 PVC 알갱이 더미
  lathe: null,     // Fig. 05 커팅 선반
  needle: null,    // Fig. 07 바늘 클로즈업
  speaker: null,   // Fig. 08 스피커
};

const BODONI = "font-['Grooves_Bodoni',Georgia,serif] font-black";
const KR = "font-['Noto_Serif_KR',Georgia,serif]";
const LABEL = "font-sans text-[11px] font-medium uppercase tracking-[0.28em]";
const RUST = "text-[#c8553d]";
const PADX = "px-[clamp(20px,4vw,72px)]";   // StoryShell 의 ← News 줄과 같은 여백
// 내용 틀: 넓은 화면에서도 ← News 줄과 같은 1500px 폭으로 가운데
const FRAME = "relative mx-auto h-full w-full max-w-[1500px]";
const H2 = `${BODONI} text-[clamp(2.6rem,5vw,5.2rem)] leading-[0.9] tracking-[-0.03em]`;
// 스크롤로 한 줄/한 단어씩 진해지는 글자 (JS 가 --o 를 바꿈)
const LIT = "[--o:.2] opacity-(--o)";

/* ───────── 임시 손그림 SVG: 같은 모양을 조금씩 흔들어 그린 4장을 170ms 마다 바꿔 '떨리는 연필선' (사이트 GIF 와 같은 박자) ───────── */
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const j = (v, a) => v + (rnd() - 0.5) * a;
function line(x1, y1, x2, y2, w = 2.2, a = 3, passes = 2) {
  let d = "";
  for (let p = 0; p < passes; p++) {
    const mx = (x1 + x2) / 2 + (rnd() - 0.5) * a * 1.4, my = (y1 + y2) / 2 + (rnd() - 0.5) * a * 1.4;
    d += `M${j(x1, a).toFixed(1)} ${j(y1, a).toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${j(x2, a).toFixed(1)} ${j(y2, a).toFixed(1)} `;
  }
  return `<path d="${d}" stroke-width="${w}"/>`;
}
function ellipse(cx, cy, rx, ry, rot = 0, w = 2.2, a = 3, passes = 2) {
  let d = "";
  for (let p = 0; p < passes; p++) {
    const n = 28, s = rnd() * Math.PI * 2, over = 0.15 + rnd() * 0.2;
    for (let i = 0; i <= n * (1 + over); i++) {
      const t = s + (i / n) * Math.PI * 2, x = Math.cos(t) * j(rx, a * 0.6), y = Math.sin(t) * j(ry, a * 0.6);
      const X = cx + x * Math.cos(rot) - y * Math.sin(rot), Y = cy + x * Math.sin(rot) + y * Math.cos(rot);
      d += (i ? "L" : "M") + X.toFixed(1) + " " + Y.toFixed(1) + " ";
    }
  }
  return `<path d="${d}" stroke-width="${w}"/>`;
}
function hatch(x, y, w, h, n = 10, ang = -0.9, sw = 1.6) {   // 빗금 음영
  let s = "";
  for (let i = 0; i < n; i++) {
    const px = x + (i / n) * w + rnd() * 6, py = y + h * (0.2 + rnd() * 0.6), L = h * (0.25 + rnd() * 0.35);
    s += line(px, py, px + Math.cos(ang) * L * 0.4, py + Math.sin(ang) * L, sw, 2, 1);
  }
  return s;
}
const SKETCH = {
  groove: { box: "0 0 400 300", draw: () => {
    let s = "";
    for (let i = 0; i < 9; i++) s += ellipse(250, 330, 260 - i * 18, 200 - i * 14, -0.15, i % 3 ? 1.6 : 2.6, 3, 1);
    s += ellipse(150, 120, 70, 70, 0, 3, 3, 2) + line(200, 170, 250, 225, 5, 3, 2);
    for (let i = 0; i < 4; i++) s += line(100, 95 + i * 18, 200, 105 + i * 18 + Math.sin(i) * 8, 1.6, 4, 1);
    return s;
  } },
  wave: { box: "0 0 1200 300", stretch: true, draw: () => {
    let s = "";
    for (const off of [-40, 40]) {
      let d = "";
      for (let p = 0; p < 2; p++) for (let x = 0; x <= 1200; x += 12) {
        const k = (x / 1200) * Math.PI * 2;
        const y = 150 + off + (Math.sin(k * 6 + p * 0.1) * 0.55 + Math.sin(k * 15) * 0.25 + Math.sin(k * 37) * 0.1) * 60 + (rnd() - 0.5) * 3;
        d += (x ? "L" : "M") + x + " " + y.toFixed(1) + " ";
      }
      s += `<path d="${d}" stroke-width="${off < 0 ? 3 : 2}"/>`;
    }
    return s;
  } },
  pellets: { box: "0 0 500 400", draw: () => {
    let s = "";
    const rows = [[250, 318, 7, 36], [250, 262, 6, 34], [250, 210, 4, 32], [250, 162, 3, 30], [250, 118, 1, 28]];
    for (const [cx, y, n, r] of rows) for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * r * 1.7 + (rnd() - 0.5) * 10, yy = y + (rnd() - 0.5) * 10, rot = (rnd() - 0.5) * 1.2;
      s += ellipse(x, yy, r * 0.62, r * 0.42, rot, 2, 2, 1) + line(x - r * 0.5, yy + 4, x - r * 0.45, yy + r * 0.55, 1.8, 2, 1) + line(x + r * 0.5, yy + 4, x + r * 0.45, yy + r * 0.55, 1.8, 2, 1);
      s += ellipse(x, yy, r * 0.32, r * 0.2, rot, 1.4, 2, 1);
      if (rnd() > 0.4) s += line(x - r * 0.35, yy + r * 0.5, x + r * 0.3, yy + r * 0.62, 1.4, 2, 1);
    }
    for (let i = 0; i < 6; i++) s += line(60 + i * 70, 350 + rnd() * 10, 110 + i * 70, 345 + rnd() * 10, 1.6, 4, 1);
    return s;
  } },
  lathe: { box: "0 0 520 380", draw: () => {
    let s = ellipse(240, 250, 190, 70, 0, 2.6, 3, 2) + ellipse(240, 250, 60, 22, 0, 2, 2, 2) + ellipse(240, 262, 190, 70, 0, 1.4, 3, 1);
    for (let i = 1; i < 6; i++) s += ellipse(240, 250, 60 + i * 24, 22 + i * 9, 0, 1.2, 2, 1);
    s += line(40, 80, 500, 80, 3, 3, 2) + line(40, 96, 500, 96, 1.6, 3, 1);
    s += line(330, 96, 330, 150, 2.4) + line(390, 96, 390, 150, 2.4) + line(330, 150, 390, 150, 2.4) + line(330, 96, 390, 96, 2);
    s += hatch(335, 105, 50, 40, 6);
    s += line(360, 150, 352, 208, 2.6) + line(352, 208, 350, 222, 3.4, 1, 1);
    for (let i = 0; i < 5; i++) s += line(400 + i * 8, 40 + i * 4, 420 + i * 8, 20 + i * 4, 1.4, 3, 1);
    return s;
  } },
  needle: { box: "0 0 500 500", draw: () => {
    let s = line(120, 110, 360, 110, 2.6) + line(120, 110, 150, 230, 2.6) + line(360, 110, 330, 230, 2.6) + line(150, 230, 330, 230, 2.6);
    s += hatch(160, 120, 160, 100, 10) + line(240, 230, 270, 320, 2.4) + line(270, 320, 268, 340, 3.6, 1);
    for (let i = 0; i < 6; i++) {
      let d = "";
      for (let x = 40; x <= 470; x += 14) d += (x > 40 ? "L" : "M") + x + " " + (350 + i * 22 + Math.sin(x * 0.05 + i) * 6 + (rnd() - 0.5) * 2).toFixed(1) + " ";
      s += `<path d="${d}" stroke-width="${i === 0 ? 2.6 : 1.4}"/>`;
    }
    return s;
  } },
  speaker: { box: "0 0 500 500", draw: () => {
    let s = line(140, 90, 320, 90, 2.6) + line(140, 90, 140, 420, 2.6) + line(320, 90, 320, 420, 2.6) + line(140, 420, 320, 420, 2.6);
    s += ellipse(230, 160, 34, 34, 0, 2.2) + ellipse(230, 300, 70, 70, 0, 2.6) + ellipse(230, 300, 34, 34, 0, 1.8) + ellipse(230, 300, 10, 10, 0, 2.4);
    s += hatch(146, 380, 168, 34, 9);
    for (let i = 0; i < 3; i++) s += `<path d="M${350 + i * 30} ${240 - i * 22} Q${385 + i * 36} 300 ${350 + i * 30} ${360 + i * 22}" stroke-width="${2.4 - i * 0.4}"/>`;
    return s;
  } },
};
const frames = {};   // kind → 4장 (한 번만 그림)
const framesOf = (kind) => frames[kind] ??= [0, 1, 2, 3].map((t) => { seed = 1 + t * 997 + kind.length * 131; return SKETCH[kind].draw(); });

function Sketch({ kind, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = framesOf(kind);
    let t = 0, id = 0;
    el.innerHTML = f[0];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // 화면에 보일 때만 떨림
    const io = new IntersectionObserver(([e]) => {
      clearInterval(id);
      if (e.isIntersecting) id = setInterval(() => { el.innerHTML = f[++t % 4]; }, 170);
    }, { root: el.closest(".page") });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(id); };
  }, [kind]);
  const k = SKETCH[kind];
  return (
    <svg ref={ref} viewBox={k.box} preserveAspectRatio={k.stretch ? "none" : undefined} aria-hidden="true"
      fill="none" stroke="#bbcbda" strokeLinecap="round" strokeLinejoin="round" className={className} />
  );
}

// 손그림 한 장: ART 에 경로가 있으면 그 그림, 없으면 임시 스케치
function Art({ kind, alt = "", className = "" }) {
  // eslint-disable-next-line @next/next/no-img-element
  return ART[kind] ? <img src={ART[kind]} alt={alt} className={`object-contain ${className}`} /> : <Sketch kind={kind} className={className} />;
}
// eslint-disable-next-line @next/next/no-img-element
const Gif = ({ src, alt = "", className = "", ...rest }) => <img src={src} alt={alt} draggable={false} className={`select-none ${className}`} {...rest} />;

/* ───────── 스크롤 연출 ───────── */
const clamp = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => 1 - Math.pow(1 - t, 3);

// 커팅 바늘이 새기는 홈 (0~500 × 0~60)
const CUT_N = 200;
const CUT = Array.from({ length: CUT_N + 1 }, (_, i) => {
  const x = (i / CUT_N) * 500, k = (x / 500) * Math.PI * 2;
  return [x, 30 + (Math.sin(k * 7) * 0.5 + Math.sin(k * 19 + 1) * 0.3 + Math.sin(k * 47) * 0.15) * 22];
});
const PLAY_CAPS = ["Fig. 06 — Turntable", "Fig. 07 — Stylus in the groove", "Fig. 08 — Speaker"];

function useScenes(rootRef) {
  useEffect(() => {
    const root = rootRef.current, page = root?.closest(".page");
    if (!root || !page) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = (s) => root.querySelector(s), qa = (s) => [...root.querySelectorAll(s)];
    const scene = Object.fromEntries(qa("[data-scene]").map((s) => [s.dataset.scene, s]));
    const E = {
      heroDisc: q("[data-hero-disc]"), heroTitle: q("[data-hero-title]"), pars: qa("[data-par]"),
      zDisc: q("[data-zoom-disc]"), zWave: q("[data-zoom-wave]"), zQuote: q("[data-zoom-quote]"), zCap: q("[data-zoom-cap]"),
      lines: qa("[data-lines] > *"), stats: q("[data-stats]"), pellets: q("[data-pellets]"), pvcDisc: q("[data-pvc-disc]"), pvcCap: q("[data-pvc-cap]"),
      vline: q("[data-vline]"), words: qa("[data-words] > *"), sub: q("[data-sub]"),
      cutpath: q("[data-cutpath]"), cuttip: q("[data-cuttip]"), flow: qa("[data-flow] [data-chip]"),
      pText: q("[data-play-text]"), pStage: q("[data-play-stage]"), pArt: qa("[data-play-art]"), pCap: q("[data-play-cap]"), chain: qa("[data-chain] > li"),
      mask: q("[data-mask]"), oDisc: q("[data-outro-disc]"), next: q("[data-next]"),
    };
    let H = page.clientHeight, pageTop = page.getBoundingClientRect().top;
    const onResize = () => { H = page.clientHeight; pageTop = page.getBoundingClientRect().top; };
    // 장면 진행도: 장면 맨 위가 화면 맨 위에 닿을 때 0, 장면 끝이 화면 아래에 닿을 때 1
    const progress = (el) => { const r = el.getBoundingClientRect(); return clamp(-(r.top - pageTop) / Math.max(1, r.height - H)); };
    const style = (el, k, v) => { if (el) el.style[k] = v; };
    let cap = -1, raf = 0;

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (!root.isConnected || root.closest("[inert]")) return;
      const spin = reduced ? 0 : t * 0.006;
      const narrow = innerWidth < 768;

      // 히어로: 판이 돌며 작아져 오른쪽 아래로, 제목은 위로
      const h = progress(scene.hero);
      style(E.heroDisc, "transform", `translate(${h * 18}vw, calc(-50% + ${h * 30}vh)) rotate(${spin + h * 90}deg) scale(${1 - 0.45 * ease(h)})`);
      style(E.heroTitle, "transform", `translateY(${-h * 26}vh)`);
      style(E.heroTitle, "opacity", 1 - seg(h, 0.4, 0.8));

      // 01 콜라주: 그림마다 다른 속도
      const kr = scene.know.getBoundingClientRect(), kp = (H - (kr.top - pageTop)) / (kr.height + H);
      E.pars.forEach((f) => { f.style.transform = `translateY(${(kp - 0.5) * parseFloat(f.dataset.par) * H * 2}px)`; });

      // 홈 확대: 판이 화면 밖까지 커지며 사라지고 홈의 두 벽이 나타남
      const z = progress(scene.zoom);
      style(E.zDisc, "transform", `rotate(${spin * 0.5}deg) scale(${1 + 2.6 * ease(seg(z, 0.05, 0.42))})`);
      style(E.zDisc, "opacity", 1 - seg(z, 0.22, 0.38));
      style(E.zWave, "opacity", seg(z, 0.32, 0.48));
      style(E.zWave, "transform", `translateY(-50%) scaleY(${0.4 + 0.6 * ease(seg(z, 0.35, 0.65))})`);
      style(E.zQuote, "opacity", seg(z, 0.6, 0.72));
      style(E.zCap, "opacity", seg(z, 0.6, 0.72) * 0.55);

      // 02 PVC: 한 줄씩 진해지고, 끝에서 알갱이 → 판
      const pv = progress(scene.pvc);
      E.lines.forEach((l, i) => { const a = 0.04 + i * 0.1; l.style.setProperty("--o", (0.2 + 0.8 * seg(pv, a, a + 0.12)).toFixed(3)); });
      style(E.stats, "opacity", seg(pv, 0.78, 0.88));
      const m = ease(seg(pv, 0.7, 0.9));
      style(E.pellets, "opacity", 1 - m); style(E.pellets, "transform", `scale(${1 - 0.25 * m})`);
      style(E.pvcDisc, "opacity", m); style(E.pvcDisc, "transform", `rotate(${spin}deg) scale(${0.7 + 0.3 * m})`);
      if (E.pvcCap) E.pvcCap.dataset.on = m > 0.5;

      // 한 줄 선언: 세로선이 내려오고 단어가 차례로
      const sy = progress(scene.say);
      style(E.vline, "transform", `scaleY(${ease(seg(sy, 0.02, 0.3))})`);
      E.words.forEach((w, i) => { const a = 0.28 + i * 0.12; w.style.setProperty("--o", (0.12 + 0.88 * seg(sy, a, a + 0.1)).toFixed(3)); });
      style(E.sub, "opacity", seg(sy, 0.8, 0.9));

      // 03 저장: 커팅 바늘이 홈을 새김, 흐름 칩이 차례로 켜짐
      const k = ease(seg(progress(scene.cut), 0.15, 0.85)), n = Math.max(1, Math.round(k * CUT_N));
      E.cutpath?.setAttribute("d", "M" + CUT.slice(0, n + 1).map((p) => p.join(" ")).join(" L"));
      E.cuttip?.setAttribute("cx", CUT[n][0]); E.cuttip?.setAttribute("cy", CUT[n][1]);
      E.flow.forEach((c, i) => { c.dataset.on = k > i / 3 + 0.05; });

      // 03 재생: 턴테이블이 아래에서 올라옴 → 옆으로 비켜서며 글 → 바늘 → 스피커
      const pl = progress(scene.play);
      const up = 1 - ease(seg(pl, 0, 0.2)), side = ease(seg(pl, 0.25, 0.45));
      style(E.pStage, "transform", narrow
        ? `translateY(${up * 100 + side * 24}vh) scale(${1 - side * 0.4})`
        : `translate(${side * 25}%, ${up * 100}vh) scale(${1 - side * 0.12})`);
      style(E.pText, "opacity", seg(pl, 0.38, 0.5));
      const stage = pl < 0.62 ? 0 : pl < 0.8 ? 1 : 2;
      E.pArt.forEach((a, i) => { a.style.opacity = i === stage ? 1 : 0; });
      if (stage !== cap && E.pCap) { cap = stage; E.pCap.textContent = PLAY_CAPS[stage]; }
      E.chain.forEach((c, i) => { c.style.opacity = 0.25 + 0.75 * seg(pl, 0.48 + i * 0.11, 0.55 + i * 0.11); });

      // 마무리: 화면보다 큰 글자가 작아지며 제자리, 판이 위에
      const ot = progress(scene.outro);
      style(E.mask, "transform", `scale(${1 + 6 * Math.pow(1 - ease(seg(ot, 0, 0.65)), 1.6)})`);
      style(E.oDisc, "opacity", seg(ot, 0.6, 0.75));
      style(E.oDisc, "transform", `translateY(-24svh) rotate(${spin}deg) scale(.5)`);
      style(E.next, "opacity", seg(ot, 0.7, 0.82));
    };
    raf = requestAnimationFrame(frame);
    addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, [rootRef]);
}

/* ───────── 본문 ───────── */
export default function Story() {
  const root = useRef(null);
  useScenes(root);

  return (
    <div ref={root} className={`${KR} text-(--ink)`}>
      {/* 한글 본문용 명조 (이 글에서만 불러옴) */}
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap" />

      {/* ── 히어로: 크게 도는 판 손그림 ── */}
      <section data-scene="hero" aria-label="What Is Vinyl?" className="relative h-[200svh]">
        <div className={`sticky top-0 h-svh overflow-hidden ${PADX}`}>
          <div className={FRAME}>
          <Gif data-hero-disc src={GIF.disc} style={{ transform: "translateY(-50%)" }} className="absolute right-[-4%] top-1/2 w-[min(62%,900px)] will-change-transform max-md:right-[-30%] max-md:top-[68%] max-md:w-[110vw]" />
          <div data-hero-title className={`relative pt-[calc(var(--ct-header-h,106px)+clamp(72px,11vh,130px))]`}>
            <Reveal as="p" className={`${LABEL} ${RUST}`}>Vinyl A to Z · Chapter 01</Reveal>
            <RiseText as="h1" lines={["What Is", "Vinyl?"]} delay={120} className={`${BODONI} mt-5 text-[clamp(3.8rem,9vw,10rem)] leading-[0.86] tracking-[-0.035em]`} />
            <Reveal as="p" delay={500} className="mt-7 max-w-md text-[clamp(1.1rem,1.5vw,1.35rem)] font-semibold leading-relaxed">
              바이닐이란 무엇인가 — 소리를 홈으로 새기고, 그 홈을 다시 소리로 되돌리는 음반에 대하여.
            </Reveal>
          </div>
          <p className={`${LABEL} absolute bottom-8 left-0 opacity-60`}>Scroll</p>
          </div>
        </div>
      </section>

      {/* ── 01 What to know: 왼쪽 글, 오른쪽 손그림 콜라주 ── */}
      <section data-scene="know" aria-label="01 Vinyl이란?" className={`relative ${PADX} pb-[12vh] pt-[6vh]`}>
        <div className="mx-auto grid max-w-[1500px] gap-14 border-t-[3px] border-(--ink) pt-10 md:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
          <div className="md:sticky md:top-[calc(var(--ct-header-h,106px)+8vh)] md:self-start">
            <p className={`${LABEL} ${RUST}`}>01 — Vinyl이란?</p>
            <h2 className={`${H2} mt-5`}>What to know</h2>
            <ul className="mt-10 max-w-[30rem] space-y-6 text-[17px] leading-[1.9]">
              {[
                <>바이닐 레코드(Vinyl Record)는 <b className="font-semibold">PVC(폴리염화비닐)</b>라는 플라스틱 소재로 만든 아날로그 음반이다.</>,
                <>레코드 표면에는 미세한 <b className="font-semibold">홈(Groove)</b>이 나선형으로 새겨져 있고, 이 홈에 음악의 소리 정보가 기록되어 있다.</>,
                <>디지털 음원과 달리, 소리를 <b className="font-semibold">물리적인 홈의 굴곡</b>으로 기록하고 재생한다.</>,
              ].map((t, i) => (
                <Reveal as="li" key={i} delay={i * 120} className="flex gap-4"><span className={RUST}>ㆍ</span><span>{t}</span></Reveal>
              ))}
            </ul>
          </div>
          <div className="relative h-[130svh] max-md:h-[90svh]">
            <figure data-par="-0.1" className="absolute right-0 top-0 w-[72%]">
              <Gif src={GIF.crate} alt="꽂혀 있는 레코드 손그림" className="w-full" />
              <figcaption className={`${LABEL} mt-1 opacity-50`}>Fig. 01 — The collection</figcaption>
            </figure>
            <figure data-par="0.12" className="absolute bottom-[2%] left-0 w-[52%]">
              <Art kind="groove" alt="판 표면의 홈을 돋보기로 본 손그림" className="aspect-[4/3] w-full" />
              <figcaption className={`${LABEL} mt-1 opacity-50`}>Fig. 02 — One spiral, end to end</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── 홈 확대: 판 속으로 들어가 굴곡진 홈이 됨 ── */}
      <section data-scene="zoom" aria-label="홈 확대" className="relative h-[240svh]">
        <div className="sticky top-0 grid h-svh place-items-center overflow-hidden">
          <Gif data-zoom-disc src={GIF.disc} className="absolute w-[min(70vw,820px)] will-change-transform max-md:w-[92vw]" />
          <div data-zoom-wave style={{ transform: "translateY(-50%)" }} className="absolute left-0 top-1/2 h-[46svh] w-full opacity-0">
            <Art kind="wave" alt="홈의 굴곡 손그림" className="size-full" />
          </div>
          <div className={`pointer-events-none absolute inset-0 ${PADX}`}><div className={FRAME}>
          <blockquote data-zoom-quote className={`absolute bottom-[10svh] left-0 max-w-[34rem] pr-5 text-[clamp(1.4rem,2.6vw,2.4rem)] font-black leading-[1.35] opacity-0`}>
            <span className={`${BODONI} text-[1.5em] leading-none ${RUST}`}>“</span>디지털 음원과 달리, 소리를 <span className={RUST}>물리적인 홈의 굴곡</span>으로 기록하고 재생한다.
          </blockquote>
          <p data-zoom-cap className={`${LABEL} absolute right-0 top-[calc(var(--ct-header-h,106px)+80px)] opacity-0 md:bottom-[10svh] md:top-auto`}>Fig. 03 — The wiggles are the sound</p>
          </div></div>
        </div>
      </section>

      {/* ── 02 Made of PVC: 오른쪽 그림 고정, 왼쪽 글은 한 줄씩 진해짐 ── */}
      <section data-scene="pvc" aria-label="02 Vinyl은 무엇으로 만들어질까?" className="relative h-[300svh]">
        <div className={`sticky top-0 h-svh overflow-hidden ${PADX} pt-[var(--ct-header-h,106px)]`}>
        <div className={`${FRAME} grid items-center gap-6 md:grid-cols-2 md:gap-10`}>
          <div className="relative z-10 max-md:order-2 max-md:self-start">
            <p className={`${LABEL} ${RUST}`}>02 — Vinyl은 무엇으로 만들어질까?</p>
            <h2 className={`${H2} mt-5`}>Made of PVC.</h2>
            <div data-lines className="mt-9 max-w-[32rem] space-y-1 text-[clamp(1rem,1.35vw,1.25rem)] leading-[1.85] max-md:mt-5">
              <p className={LIT}>바이닐 레코드는 주로 PVC(Polyvinyl Chloride,</p>
              <p className={LIT}>폴리염화비닐) 계열 소재로 제작된다.</p>
              <p className={LIT}>비교적 유연하고 내구성이 있어,</p>
              <p className={LIT}>소리를 담는 미세한 홈을 정밀하게 만들기에 적합하다.</p>
              <p className={LIT}>1948년 컬럼비아 레코드의 LP는 PVC와 미세한 홈(Microgroove)으로</p>
              <p className={LIT}>한 면에 약 20분 이상의 음악을 담았다.</p>
              <p className={`${LIT} font-semibold ${RUST}`}>오늘날에도 바이닐은 PVC로 만든다.</p>
            </div>
            <dl data-stats className="mt-10 grid max-w-[32rem] grid-cols-3 border-t-[3px] border-(--ink) pt-5 opacity-0 max-md:mt-6">
              {[["Year", "1948"], ["Per side", <>20<span key="m" className="text-[.4em]">+min</span></>], ["Groove", "Micro"]].map(([k, v]) => (
                <div key={k}><dt className={`${LABEL} opacity-55`}>{k}</dt><dd className={`${BODONI} mt-2 text-[clamp(1.9rem,3vw,2.5rem)] leading-none`}>{v}</dd></div>
              ))}
            </dl>
          </div>
          <div className="relative grid h-[70svh] place-items-center max-md:order-1 max-md:h-[30svh]">
            {/* 알갱이 더미 → (스크롤) → 판 한 장 */}
            <div data-pellets className="absolute w-[min(100%,620px)]"><Art kind="pellets" alt="PVC 알갱이 손그림" className="aspect-[5/4] w-full" /></div>
            <Gif data-pvc-disc src={GIF.disc} className="absolute w-[min(90%,560px)] opacity-0 max-md:h-full max-md:w-auto" />
            <p data-pvc-cap className={`${LABEL} group absolute bottom-2 left-2 opacity-55`}>
              <span className="group-data-[on=true]:hidden">Fig. 04 — PVC pellets</span>
              <span className="hidden group-data-[on=true]:inline">Fig. 04 — …become a record</span>
            </p>
          </div>
        </div>
        </div>
      </section>

      {/* ── 한 줄 선언 ── */}
      <section data-scene="say" aria-label="Sound becomes a groove" className="relative h-[220svh]">
        <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
          <span data-vline style={{ transform: "scaleY(0)" }} className="absolute left-1/2 top-0 h-[36svh] w-px origin-top bg-(--ink)/50" />
          <p data-words className={`${BODONI} mt-[16svh] text-[clamp(2.8rem,7vw,7.4rem)] leading-[0.95] tracking-[-0.035em]`}>
            <span className={LIT}>Sound</span> <span className={LIT}>becomes</span> <span className={LIT}>a</span> <span className={`${LIT} ${RUST}`}>groove.</span>
          </p>
          <p data-sub className="mt-7 text-[clamp(1rem,1.3vw,1.2rem)] font-semibold opacity-0">소리는 어떻게 홈이 될까.</p>
        </div>
      </section>

      {/* ── 03 저장: 커팅 선반 + 새겨지는 홈 + 흐름 칩 ── */}
      <section data-scene="cut" aria-label="03 음악을 저장할 때" className="relative h-[240svh]">
        <div className={`sticky top-0 h-svh overflow-hidden ${PADX} pt-[var(--ct-header-h,106px)]`}>
        <div className={`${FRAME} grid items-center gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] md:gap-10`}>
          <figure className="relative grid place-items-center max-md:h-[28svh]">
            <Art kind="lathe" alt="커팅 선반 손그림" className="aspect-[52/38] w-[min(100%,640px)] max-md:h-full max-md:w-auto" />
            <figcaption className={`${LABEL} absolute bottom-0 left-0 opacity-55`}>Fig. 05 — Cutting lathe</figcaption>
          </figure>
          <div className="max-md:self-start">
            <p className={`${LABEL} ${RUST}`}>03 — Recording · 음악을 저장할 때</p>
            <h2 className={`${BODONI} mt-5 text-[clamp(2.4rem,4.6vw,4.8rem)] leading-[0.92] tracking-[-0.03em]`}>Cut into the master.</h2>
            <p className="mt-7 max-w-[32rem] text-[clamp(1rem,1.25vw,1.15rem)] leading-[1.9] max-md:mt-4">
              음악의 신호에 맞춰 특수한 <b className="font-semibold">커팅 바늘</b>이 움직이며 마스터 디스크에 미세한 홈을 새긴다. 이 홈을 PVC 음반에 복제하여 우리가 사용하는 바이닐 레코드를 만든다.
            </p>
            <svg className="mt-8 h-[60px] w-full max-w-[32rem] max-md:mt-4" viewBox="0 0 500 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 30 H500" stroke="currentColor" strokeOpacity=".18" />
              <path data-cutpath fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
              <circle data-cuttip r="4" fill="#c8553d" cx="0" cy="30" />
            </svg>
            <ol data-flow aria-label="기록 과정" className="mt-6 flex flex-wrap items-center gap-2.5 text-[14px]">
              {["음악 신호", "홈 제작", "바이닐 레코드"].map((c, i) => (
                <li key={c} className="contents">
                  {i > 0 && <span aria-hidden="true" className={RUST}>→</span>}
                  <span data-chip className="rounded-full border border-(--ink)/35 px-5 py-2.5 transition-colors duration-500 data-[on=true]:bg-(--ink) data-[on=true]:text-(--cream)">{c}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        </div>
      </section>

      {/* ── 03 재생: 턴테이블이 올라와 가운데 → 옆으로 비켜서며 글 → 바늘 → 스피커 ── */}
      <section data-scene="play" aria-label="03 음악을 재생할 때" className="relative h-[340svh]">
        <div className={`sticky top-0 h-svh overflow-hidden ${PADX}`}>
          <div className={FRAME}>
          <div data-play-text className={`absolute inset-y-0 left-0 z-10 flex w-1/2 items-center pr-6 opacity-0 max-md:inset-x-0 max-md:bottom-auto max-md:top-[calc(var(--ct-header-h,106px)+16px)] max-md:w-full`}>
            <div className="max-w-[30rem]">
              <p className={`${LABEL} ${RUST}`}>03 — Playback · 음악을 재생할 때</p>
              <h2 className={`${BODONI} mt-5 text-[clamp(2.2rem,4.6vw,4.8rem)] leading-[0.92] tracking-[-0.03em] max-md:mt-3`}>A groove becomes sound.</h2>
              <p className="mt-7 text-[clamp(.95rem,1.25vw,1.15rem)] leading-[1.9] max-md:mt-3">
                턴테이블에서 레코드가 회전하면 <b className="font-semibold">바늘(Stylus)</b>이 홈의 굴곡을 따라 진동한다. 이 진동은 <b className="font-semibold">카트리지(Cartridge)</b>를 통해 전기 신호로 바뀌고, 앰프와 스피커를 거쳐 음악으로 재생된다.
              </p>
              <ol data-chain aria-label="재생 과정" className="mt-9 grid grid-cols-4 gap-3 border-t-[3px] border-(--ink) pt-5 max-md:mt-4 max-md:pt-3">
                {["레코드의 홈", "바늘의 진동", "전기 신호", "스피커"].map((c, i) => (
                  <li key={c} className="opacity-25">
                    <p className={`${BODONI} text-[clamp(1.4rem,2.2vw,1.9rem)] leading-none`}>0{i + 1}</p>
                    <p className="mt-2 text-[13px] max-md:text-[12px]">{c}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div data-play-stage style={{ transform: "translateY(100vh)" }} className="absolute inset-0 grid place-items-center will-change-transform">
            <div className="relative aspect-square w-[min(78svh,82vw,46rem)]">
              <Gif data-play-art src={GIF.turntable} alt="턴테이블 손그림" className="absolute inset-0 size-full" />
              <div data-play-art className="absolute inset-0 opacity-0"><Art kind="needle" alt="홈 위의 바늘 손그림" className="size-full" /></div>
              <div data-play-art className="absolute inset-0 opacity-0"><Art kind="speaker" alt="스피커 손그림" className="size-full" /></div>
            </div>
            <p data-play-cap className={`${LABEL} absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-55`}>{PLAY_CAPS[0]}</p>
          </div>
          </div>
        </div>
      </section>

      {/* ── 마무리: 화면보다 큰 글자가 작아지며 제자리 ── */}
      <section data-scene="outro" aria-label="Vinyl A to Z" className="relative h-[260svh]">
        <div className="sticky top-0 grid h-svh place-items-center overflow-hidden">
          <Gif data-outro-disc src={GIF.disc} className="absolute w-[min(46vw,520px)] opacity-0 max-md:w-[80vw]" />
          <p data-mask className={`${BODONI} relative whitespace-nowrap text-[clamp(3.4rem,11vw,12rem)] leading-none tracking-[-0.04em] will-change-transform`}>Vinyl A to Z</p>
          <div data-next className="absolute inset-x-0 bottom-[12svh] flex flex-col items-center gap-3 px-6 text-center opacity-0">
            <p className={`${LABEL} opacity-55`}>Next — Chapter 02</p>
            <p className={`${BODONI} text-[clamp(1.6rem,2.6vw,2.4rem)] tracking-[-0.02em]`}>How a Turntable Works</p>
            <p className={`${LABEL} opacity-55`}>Coming soon</p>
          </div>
        </div>
      </section>
    </div>
  );
}
