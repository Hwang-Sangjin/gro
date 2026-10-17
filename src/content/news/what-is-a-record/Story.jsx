"use client";
// Vinyl A to Z · Chapter 01 — "What Is Vinyl?"
// 사이트 손그림(하늘색 연필선) 으로 만든 섹션들. 보통 스크롤 + 가벼운 스크롤 연동 연출(고정 pin 없음)
// 연출: 히어로(제목 줄 단위로 올라옴 · 판 회전/패럴랙스) · 한 줄(세로선 → 제목 → 물결) · 03 저장(커팅 헤드 · 홈 그려짐 · 칩 점등) · Fig.03 파형 그려짐
// 히어로 → 01 What to know → 홈 → 02 Made of PVC → 한 줄 → 03 저장 → 03 재생 → 마무리 → (아래 Next story)
// 손그림이 아직 없는 자리는 ART 에 경로가 없으면 같은 느낌의 임시 SVG 스케치 — 그림이 생기면 ART 에 경로만 넣으면 됨
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
const WRAP = "mx-auto w-full max-w-[1240px]";
const SECTION = `${PADX} py-[clamp(72px,12svh,150px)]`;
const H2 = `${BODONI} text-[clamp(2.6rem,5vw,5.2rem)] leading-[0.9] tracking-[-0.03em]`;
const BODY = "text-[clamp(1.05rem,1.3vw,1.2rem)] font-medium leading-[1.85]";

/* ───────── 임시 손그림 SVG (연필선 느낌으로 살짝 흔들린 선) ───────── */
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
  wave: { box: "0 0 1200 300", stretch: true, draw: () => {
    let s = "";
    for (const off of [-40, 40]) {
      let d = "";
      for (let p = 0; p < 2; p++) for (let x = 0; x <= 1200; x += 12) {
        const k = (x / 1200) * Math.PI * 2;
        const y = 150 + off + (Math.sin(k * 6 + p * 0.1) * 0.55 + Math.sin(k * 15) * 0.25 + Math.sin(k * 37) * 0.1) * 60 + (rnd() - 0.5) * 3;
        d += (x ? "L" : "M") + x + " " + y.toFixed(1) + " ";
      }
      s += `<path pathLength="1" d="${d}" stroke-width="${off < 0 ? 3 : 2}"/>`;   // pathLength=1 → 스크롤로 그려짐
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
    for (let i = 0; i < 5; i++) s += line(440 + i * 8, 40 + i * 4, 460 + i * 8, 20 + i * 4, 1.4, 3, 1);
    return s;
  } },
  // 커팅 헤드 (레일을 따라 안쪽으로 움직임)
  latheHead: { box: "0 0 520 380", draw: () => {
    let s = line(330, 96, 330, 150, 2.4) + line(390, 96, 390, 150, 2.4) + line(330, 150, 390, 150, 2.4) + line(330, 96, 390, 96, 2);
    s += hatch(335, 105, 50, 40, 6);
    return s + line(360, 150, 352, 208, 2.6) + line(352, 208, 350, 222, 3.4, 1, 1);
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
const drawn = {};   // kind → SVG 내용 (seed 고정이라 서버·브라우저가 같은 그림)
const drawOf = (kind) => drawn[kind] ??= (seed = 1 + kind.length * 131, SKETCH[kind].draw());

function Sketch({ kind, className = "", ...rest }) {
  const k = SKETCH[kind];
  return (
    <svg viewBox={k.box} preserveAspectRatio={k.stretch ? "none" : undefined} aria-hidden="true"
      fill="none" stroke="#bbcbda" strokeLinecap="round" strokeLinejoin="round" className={className} {...rest}
      dangerouslySetInnerHTML={{ __html: drawOf(kind) }} />
  );
}
// 커팅 선반: 판 + 레일은 고정, 헤드는 안쪽으로, 판 가장자리의 붉은 점이 돌며 회전을 보여 줌
function Lathe({ className = "" }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (ART.lathe) return <img src={ART.lathe} alt="커팅 선반 손그림" className={`object-contain ${className}`} />;
  return (
    <svg viewBox={SKETCH.lathe.box} aria-hidden="true" fill="none" stroke="#bbcbda" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <g dangerouslySetInnerHTML={{ __html: drawOf("lathe") }} />
      <circle data-fx-lathe-dot r="5" fill="#c8553d" stroke="none" cx="390" cy="250" />
      <g data-fx-lathe-head dangerouslySetInnerHTML={{ __html: drawOf("latheHead") }} />
    </svg>
  );
}

// 손그림 한 장: ART 에 경로가 있으면 그 그림, 없으면 임시 스케치
function Art({ kind, alt = "", className = "" }) {
  // eslint-disable-next-line @next/next/no-img-element
  return ART[kind] ? <img src={ART[kind]} alt={alt} className={`object-contain ${className}`} /> : <Sketch kind={kind} className={className} />;
}
// eslint-disable-next-line @next/next/no-img-element
const Gif = ({ src, alt = "", className = "" }) => <img src={src} alt={alt} draggable={false} className={`select-none ${className}`} />;

// 커팅 바늘이 새긴 홈 (0~500 × 0~60)
const CUT = Array.from({ length: 201 }, (_, i) => {
  const x = (i / 200) * 500, k = (x / 500) * Math.PI * 2;
  return [x, 30 + (Math.sin(k * 7) * 0.5 + Math.sin(k * 19 + 1) * 0.3 + Math.sin(k * 47) * 0.15) * 22];
});
const CUT_PATH = "M" + CUT.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");

/* ───────── 스크롤 연동 연출 (pin 없음 — 보통 스크롤 중 화면 위치에 따라 0→1) ───────── */
const clamp = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = (t) => 1 - Math.pow(1 - t, 3);

function useScrollFx(rootRef) {
  useEffect(() => {
    const root = rootRef.current, page = root?.closest(".page");
    if (!root || !page) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = (k) => root.querySelector(`[data-fx-${k}]`), qa = (k) => [...root.querySelectorAll(`[data-fx-${k}]`)];
    const E = {
      hero: q("hero"), heroDisc: q("hero-disc"),
      wave: q("wave"),
      say: q("say"), sayLine: q("say-line"), sayWave: q("say-wave"),
      cut: q("cut"), cutPath: q("cut-path"), cutDot: q("cut-dot"), chips: qa("chip"), head: q("lathe-head"), lDot: q("lathe-dot"),
    };
    // 요소 위가 화면 높이의 a 지점에 올 때 0, b 지점에 올 때 1 (a > b, 화면 비율)
    const enter = (el, a, b) => {
      if (!el) return 0;
      const H = page.clientHeight, top = el.getBoundingClientRect().top - page.getBoundingClientRect().top;
      return clamp((H * a - top) / (H * (a - b)));
    };
    let raf = 0;
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (!root.isConnected || root.closest("[inert]")) return;
      const time = reduced ? 0 : t / 1000;

      // 히어로: 판이 늘 천천히 돌고, 스크롤하면 더 돌며 살짝 내려감
      const h = reduced ? 0 : enter(E.hero, 0, -1);
      if (E.heroDisc) E.heroDisc.style.transform = `translateY(${h * 14}%) rotate(${time * 6 + h * 90}deg)`;

      // Fig.03 파형: 스크롤에 맞춰 왼쪽부터 그려지고 옆으로 살짝 흐름
      const w = reduced ? 1 : enter(E.wave, 1, 0.3);
      if (E.wave) { E.wave.style.setProperty("--d", (1 - ease(w)).toFixed(4)); E.wave.style.transform = `translateX(${-w * 4}%)`; }

      // 한 줄: 세로선이 자라 내려옴 → 닿으면 제목이 올라옴 → groove 아래 물결이 그려짐
      const sy = reduced ? 1 : enter(E.say, 0.95, 0.2);
      if (E.sayLine) E.sayLine.style.transform = `scaleY(${ease(seg(sy, 0.05, 0.5))})`;
      if (E.say) E.say.dataset.on = sy > 0.5;
      E.sayWave?.style.setProperty("--d", (1 - ease(seg(sy, 0.62, 0.95))).toFixed(4));

      // 03 저장: 커팅 헤드가 안쪽으로, 홈이 그려지며 붉은 점이 따라감, 칩이 차례로 켜짐
      const k = reduced ? 1 : ease(seg(enter(E.cut, 0.95, 0.05), 0.2, 0.95));
      E.cutPath?.style.setProperty("--d", (1 - k).toFixed(4));
      const [cx, cy] = CUT[Math.round(k * 200)];
      E.cutDot?.setAttribute("cx", cx); E.cutDot?.setAttribute("cy", cy);
      E.chips.forEach((c, i) => { c.dataset.on = k > i / 3 + 0.05; });
      E.head?.setAttribute("transform", `translate(${60 - 110 * k} 0)`);
      if (E.lDot) { const a = time * 1.6; E.lDot.setAttribute("cx", 240 + Math.cos(a) * 150); E.lDot.setAttribute("cy", 250 + Math.sin(a) * 56); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rootRef]);
}
// 그려지는 선: pathLength=1 인 path 에 --d(1→0) 로 dashoffset
const DRAW = "[&_path]:[stroke-dasharray:1] [&_path]:[stroke-dashoffset:var(--d,0)]";

const Head = ({ label, title, className = "" }) => (
  <div className={className}>
    <p className={`${LABEL} ${RUST}`}>{label}</p>
    <h2 className={`${H2} mt-5`}>{title}</h2>
  </div>
);
const Fig = ({ children, caption, className = "" }) => (
  <figure className={className}>
    {children}
    <figcaption className={`${LABEL} mt-2 text-center opacity-50`}>{caption}</figcaption>
  </figure>
);
const Chips = ({ label, items }) => (
  <ol aria-label={label} className="mt-7 flex flex-wrap items-center gap-2.5 text-[14px]">
    {items.map((c, i) => (
      <li key={c} className="contents">
        {i > 0 && <span aria-hidden="true" className={RUST}>→</span>}
        {/* 스크롤에 맞춰 차례로 켜짐 */}
        <span data-fx-chip className="rounded-full border border-(--ink)/35 px-5 py-2.5 transition-colors duration-500 data-[on=true]:border-(--ink) data-[on=true]:bg-(--ink) data-[on=true]:text-(--cream)">{c}</span>
      </li>
    ))}
  </ol>
);

/* ───────── 본문 ───────── */
export default function Story() {
  const root = useRef(null);
  useScrollFx(root);
  return (
    <div ref={root} className={`${KR} text-(--ink) [word-break:keep-all]`}>
      {/* 한글 본문용 명조 (이 글에서만 불러옴) */}
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;900&display=swap" />

      {/* ── 히어로 ── */}
      <section data-fx-hero aria-label="What Is Vinyl?" className={`flex min-h-svh items-center ${PADX} pb-[6svh] pt-[calc(var(--ct-header-h,106px)+60px)]`}>
        <div className={`${WRAP} grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12`}>
          <div>
            <Reveal as="p" className={`${LABEL} ${RUST}`}>Vinyl A to Z · Chapter 01</Reveal>
            {/* 제목: 줄 단위로 마스크 아래에서 올라옴 */}
            <RiseText as="h1" lines={["What Is", "Vinyl?"]} delay={120} className={`${BODONI} mt-5 text-[clamp(3.6rem,8vw,8.6rem)] leading-[0.86] tracking-[-0.035em]`} />
            <Reveal as="p" delay={450} className="mt-7 max-w-md text-[clamp(1.1rem,1.5vw,1.35rem)] font-semibold leading-relaxed">
              바이닐이란 무엇인가 — 소리를 홈으로 새기고, 그 홈을 다시 소리로 되돌리는 음반에 대하여.
            </Reveal>
          </div>
          {/* 판: 늘 천천히 돌고 스크롤에 따라 더 돎. GIF 는 꼭 div 를 움직일 것 (img 에 transform 을 주면 Chrome 이 프레임을 잘라 그림) */}
          <div className="mx-auto w-full max-w-[640px]">
            <div data-fx-hero-disc className="will-change-transform"><Gif src={GIF.disc} className="block w-full" /></div>
          </div>
        </div>
      </section>

      {/* ── 01 What to know ── */}
      <section aria-label="01 Vinyl이란?" className={SECTION}>
        <div className={`${WRAP} grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)] md:gap-16`}>
          <div>
            <Head label="01 — Vinyl이란?" title="What to know" />
            <ol className="mt-10 max-w-[36rem] border-t-[3px] border-(--ink) max-md:mt-7">
              {[
                <>바이닐 레코드(Vinyl Record)는 <b className="font-bold">PVC(폴리염화비닐)</b>라는 플라스틱 소재로 만든 아날로그 음반이다.</>,
                <>레코드 표면에는 미세한 <b className="font-bold">홈(Groove)</b>이 나선형으로 새겨져 있고, 이 홈에 음악의 소리 정보가 기록되어 있다.</>,
                <>디지털 음원과 달리, 소리를 <b className="font-bold">물리적인 홈의 굴곡</b>으로 기록하고 재생한다.</>,
              ].map((t, i) => (
                <li key={i} className="grid grid-cols-[2.6rem_minmax(0,1fr)] gap-3 border-b border-(--ink)/15 py-6 max-md:py-4">
                  <span className={`${BODONI} pt-0.5 text-[1.5rem] leading-none ${RUST}`}>0{i + 1}</span>
                  <p className={BODY}>{t}</p>
                </li>
              ))}
            </ol>
          </div>
          <Fig caption="Fig. 01 — The collection" className="mx-auto w-full max-w-[560px] max-md:max-w-[340px]">
            <Gif src={GIF.crate} alt="꽂혀 있는 레코드 손그림" className="-mb-4 w-full" />
          </Fig>
        </div>
      </section>

      {/* ── 홈: 큰 판 + 홈의 굴곡 ── */}
      <section aria-label="홈의 굴곡" className={SECTION}>
        <div className={`${WRAP} grid items-center gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] md:gap-16`}>
          <Fig caption="Fig. 02 — One spiral, end to end" className="mx-auto w-full max-w-[640px]">
            <Gif src={GIF.disc} alt="레코드 판 손그림" className="w-full" />
          </Fig>
          <blockquote className="text-[clamp(1.5rem,2.6vw,2.4rem)] font-black leading-[1.4]">
            <span className={`${BODONI} text-[1.5em] leading-none ${RUST}`}>“</span>디지털 음원과 달리, 소리를 <span className={RUST}>물리적인 홈의 굴곡</span>으로 기록하고 재생한다.
          </blockquote>
        </div>
        <Fig caption="Fig. 03 — The wiggles are the sound" className={`${WRAP} mt-[clamp(48px,8svh,96px)] overflow-x-clip`}>
          {ART.wave
            ? <Art kind="wave" alt="홈의 굴곡 손그림" className="h-[clamp(140px,22svh,240px)] w-full" />
            : <Sketch data-fx-wave kind="wave" className={`h-[clamp(140px,22svh,240px)] w-[106%] max-w-none ${DRAW}`} />}
        </Fig>
      </section>

      {/* ── 02 Made of PVC ── */}
      <section aria-label="02 Vinyl은 무엇으로 만들어질까?" className={SECTION}>
        <div className={`${WRAP} grid items-center gap-10 md:grid-cols-2 md:gap-16`}>
          <div>
            <Head label="02 — Vinyl은 무엇으로 만들어질까?" title="Made of PVC." />
            <div className={`${BODY} mt-9 max-w-[34rem] space-y-4`}>
              <p>바이닐 레코드는 주로 <b className="font-bold">PVC(Polyvinyl Chloride, 폴리염화비닐)</b> 계열 소재로 제작된다. 비교적 유연하고 내구성이 있어, 소리를 담는 미세한 홈을 정밀하게 만들기에 적합하다.</p>
              <p>1948년 컬럼비아 레코드의 LP는 PVC와 <b className="font-bold">미세한 홈(Microgroove)</b>으로 한 면에 약 20분 이상의 음악을 담았다.</p>
              <p className={`font-semibold ${RUST}`}>오늘날에도 바이닐은 PVC로 만든다.</p>
            </div>
            <dl className="mt-10 grid max-w-[34rem] grid-cols-3 border-t-[3px] border-(--ink) pt-5">
              {[["Year", "1948"], ["Per side", <>20<span key="m" className="text-[.4em]">+min</span></>], ["Groove", "Micro"]].map(([k, v]) => (
                <div key={k}><dt className={`${LABEL} opacity-55`}>{k}</dt><dd className={`${BODONI} mt-2 text-[clamp(1.9rem,3vw,2.5rem)] leading-none`}>{v}</dd></div>
              ))}
            </dl>
          </div>
          <Fig caption="Fig. 04 — PVC pellets" className="mx-auto w-full max-w-[560px]">
            <Art kind="pellets" alt="PVC 알갱이 손그림" className="aspect-[5/4] w-full" />
          </Fig>
        </div>
      </section>

      {/* ── 한 줄 ── */}
      <section data-fx-say aria-label="Sound becomes a groove" className={`group ${SECTION} text-center`}>
        {/* 세로선이 바늘대처럼 자라 내려오고, 닿으면 제목이 올라옴 */}
        <span data-fx-say-line aria-hidden="true" className="mx-auto block h-[clamp(60px,10svh,120px)] w-px origin-top bg-(--ink)/50" />
        <p className={`${BODONI} mt-10 overflow-y-clip pb-[.12em] text-[clamp(2.8rem,7vw,7.4rem)] leading-[0.95] tracking-[-0.035em]`}>
          <span className="block translate-y-[110%] transition-transform duration-[1000ms] ease-[cubic-bezier(.22,1,.36,1)] group-data-[on=true]:translate-y-0 motion-reduce:translate-y-0">
            Sound becomes a{" "}
            <span className={`relative inline-block ${RUST}`}>
              groove.
              {/* groove 아래 물결이 그려짐 */}
              <svg aria-hidden="true" viewBox="0 0 200 20" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-[.18em] h-[.2em] w-full overflow-visible">
                <path data-fx-say-wave pathLength="1" d="M2 10 Q 14 2 26 10 T 50 10 T 74 10 T 98 10 T 122 10 T 146 10 T 170 10 T 194 10"
                  fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="[stroke-dasharray:1] [stroke-dashoffset:var(--d,1)]" />
              </svg>
            </span>
          </span>
        </p>
        <p className="mt-7 text-[clamp(1rem,1.3vw,1.2rem)] font-semibold opacity-0 transition-opacity delay-300 duration-700 group-data-[on=true]:opacity-100 motion-reduce:opacity-100">소리는 어떻게 홈이 될까.</p>
      </section>

      {/* ── 03 저장 ── */}
      <section data-fx-cut aria-label="03 음악을 저장할 때" className={SECTION}>
        <div className={`${WRAP} grid items-center gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] md:gap-16`}>
          <Fig caption="Fig. 05 — Cutting lathe" className="mx-auto w-full max-w-[600px] max-md:order-2">
            <Lathe className="aspect-[52/38] w-full" />
          </Fig>
          <div>
            <Head label="03 — Recording · 음악을 저장할 때" title="Cut into the master." />
            <p className={`${BODY} mt-8 max-w-[34rem]`}>
              음악의 신호에 맞춰 특수한 <b className="font-bold">커팅 바늘</b>이 움직이며 마스터 디스크에 미세한 홈을 새긴다. 이 홈을 PVC 음반에 복제하여 우리가 사용하는 바이닐 레코드를 만든다.
            </p>
            <svg className="mt-8 h-[60px] w-full max-w-[34rem]" viewBox="0 0 500 60" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 30 H500" stroke="currentColor" strokeOpacity=".18" />
              <path data-fx-cut-path d={CUT_PATH} pathLength="1" fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" className="[stroke-dasharray:1] [stroke-dashoffset:var(--d,0)]" />
              <circle data-fx-cut-dot r="4" fill="#c8553d" cx="500" cy="30" />
            </svg>
            <Chips label="기록 과정" items={["음악 신호", "홈 제작", "바이닐 레코드"]} />
          </div>
        </div>
      </section>

      {/* ── 03 재생 ── */}
      <section aria-label="03 음악을 재생할 때" className={SECTION}>
        <div className={`${WRAP} grid items-center gap-10 md:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)] md:gap-16`}>
          <div>
            <Head label="03 — Playback · 음악을 재생할 때" title="A groove becomes sound." />
            <p className={`${BODY} mt-8 max-w-[34rem]`}>
              턴테이블에서 레코드가 회전하면 <b className="font-bold">바늘(Stylus)</b>이 홈의 굴곡을 따라 진동한다. 이 진동은 <b className="font-bold">카트리지(Cartridge)</b>를 통해 전기 신호로 바뀌고, 앰프와 스피커를 거쳐 음악으로 재생된다.
            </p>
            <ol aria-label="재생 과정" className="mt-9 grid max-w-[34rem] grid-cols-4 gap-3 border-t-[3px] border-(--ink) pt-5">
              {["레코드의 홈", "바늘의 진동", "전기 신호", "스피커"].map((c, i) => (
                <li key={c}>
                  <p className={`${BODONI} text-[clamp(1.4rem,2.2vw,1.9rem)] leading-none ${i === 3 ? RUST : ""}`}>0{i + 1}</p>
                  <p className="mt-2 text-[13px] font-medium">{c}</p>
                </li>
              ))}
            </ol>
          </div>
          <Fig caption="Fig. 06 — Turntable" className="mx-auto w-full max-w-[600px]">
            <Gif src={GIF.turntable} alt="턴테이블 손그림" className="w-full" />
          </Fig>
        </div>
        <div className={`${WRAP} mt-[clamp(40px,7svh,88px)] grid grid-cols-2 gap-6 md:gap-16`}>
          <Fig caption="Fig. 07 — Stylus in the groove" className="mx-auto w-full max-w-[420px]">
            <Art kind="needle" alt="홈 위의 바늘 손그림" className="aspect-square w-full" />
          </Fig>
          <Fig caption="Fig. 08 — Speaker" className="mx-auto w-full max-w-[420px]">
            <Art kind="speaker" alt="스피커 손그림" className="aspect-square w-full" />
          </Fig>
        </div>
      </section>

      {/* ── 마무리 ── */}
      <section aria-label="Vinyl A to Z" className={`${SECTION} text-center`}>
        <Gif src={GIF.disc} className="mx-auto w-[min(60vw,300px)]" />
        <p className={`${BODONI} mt-4 text-[clamp(3.4rem,10vw,10rem)] leading-none tracking-[-0.04em]`}>Vinyl A to Z</p>
        <p className={`${LABEL} mt-12 opacity-55`}>Next — Chapter 02</p>
        <p className={`${BODONI} mt-3 text-[clamp(1.6rem,2.6vw,2.4rem)] tracking-[-0.02em]`}>How a Turntable Works</p>
        <p className={`${LABEL} mt-3 opacity-55`}>Coming soon</p>
      </section>
    </div>
  );
}
