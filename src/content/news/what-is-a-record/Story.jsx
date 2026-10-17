"use client";
// Vinyl A to Z · Chapter 01 — "What Is Vinyl?"
// 사이트 손그림(하늘색 연필선) 으로 만든 섹션들. 보통 스크롤 + 가벼운 스크롤 연동 연출(고정 pin 없음)
// 03 재생: 왼쪽 글·단계는 따라 내려오고(sticky), 오른쪽 그림 4장이 지나가며 01→04 단계가 켜짐 (도는 판 · 떨리는 바늘 · 그려지는 신호 · 울리는 스피커)
// 연출: 히어로(제목 줄 단위로 올라옴 · 판 회전/패럴랙스) · 한 줄(세로선 → 제목 → 물결) · 03 저장(판이 돌고 커팅 헤드가 안쪽으로 · 홈 그려짐 · 칩 점등)
//       · Fig.03 파형 그려짐 · 마무리(톤암이 판 위로 내려앉음)
// 히어로 → 01 What to know → 홈 → 02 Made of PVC → 한 줄 → 03 저장 → 03 재생 → 마무리 → (아래 Next story)
// 손그림: 사이트 제목 GIF + public/images/news/what-is-vinyl/ (흰 배경을 지우고 #BBCBDA 단색으로 맞춘 webp)
import { useEffect, useRef } from "react";
import Reveal, { RiseText } from "@/components/story/Reveal";

/* ───────── 그림 ───────── */
const GIF = {
  disc: "/images/grooves/title-vinyl.gif",
  crate: "/images/grooves/title-crate.gif",
};
const IMG = Object.fromEntries([
  "lathe-body", "lathe-disc", "lathe-head", "tonearm", "pellets", "stylus", "speaker",
  "icon-wave", "icon-cut", "icon-record", "icon-grooves", "icon-needle", "icon-cable", "icon-speaker",
].map((n) => [n, `/images/news/what-is-vinyl/${n}.webp`]));

const BODONI = "font-['Grooves_Bodoni',Georgia,serif] font-black";
const KR = "font-['Noto_Serif_KR',Georgia,serif]";
const LABEL = "font-sans text-[11px] font-medium uppercase tracking-[0.28em]";
const RUST = "text-[#c8553d]";
const PADX = "px-[clamp(20px,4vw,72px)]";   // StoryShell 의 ← News 줄과 같은 여백
const WRAP = "mx-auto w-full max-w-[1240px]";
const SECTION = `${PADX} py-[clamp(72px,12svh,150px)]`;
const H2 = `${BODONI} text-[clamp(2.6rem,5vw,5.2rem)] leading-[0.9] tracking-[-0.03em]`;
const BODY = "text-[clamp(1.05rem,1.3vw,1.2rem)] font-medium leading-[1.85]";

// eslint-disable-next-line @next/next/no-img-element
const Gif = ({ src, alt = "", className = "" }) => <img src={src} alt={alt} draggable={false} className={`select-none ${className}`} />;
// 손그림 한 장 (webp). 움직일 때는 이 img 가 아니라 감싼 div 를 움직임
// eslint-disable-next-line @next/next/no-img-element
const Img = ({ name, alt = "", className = "" }) => <img src={IMG[name]} alt={alt} draggable={false} loading="lazy" decoding="async" className={`select-none ${className}`} />;

/* 커팅 선반: 본체 위 플래터에 래커 디스크(위에서 본 원을 납작하게 눌러 플래터 각도에 맞춤)가 돌고,
   커팅 헤드는 디스크 바깥에서 스크롤에 따라 안쪽으로. 위치 값은 lathe-body 그림의 플래터 윗면 기준(%) */
const PLATTER = { x: 51, y: 46.5, w: 58, squash: 0.34 };
const HEAD = { w: 15, tip: 0.41, h: 34 };   // 헤드 폭(본체 폭 %), 팁의 가로 위치(헤드 폭 비율), 헤드 높이(본체 높이 %)
function Lathe({ className = "" }) {
  return (
    <div className={`relative aspect-[1000/883] ${className}`}>
      <Img name="lathe-body" alt="래커 디스크를 깎는 커팅 선반 손그림" className="absolute inset-0 size-full" />
      <div className="absolute aspect-square" style={{ left: `${PLATTER.x}%`, top: `${PLATTER.y}%`, width: `${PLATTER.w}%`, transform: `translate(-50%,-50%) scaleY(${PLATTER.squash})` }}>
        <div data-fx-lathe-disc className="size-full"><Img name="lathe-disc" className="size-full" /></div>
      </div>
      <div data-fx-lathe-head className="absolute" style={{ width: `${HEAD.w}%`, top: `${PLATTER.y - HEAD.h}%`, left: `${PLATTER.x + PLATTER.w * 0.42 - HEAD.w * HEAD.tip}%` }}>
        <Img name="lathe-head" className="block w-full" />
      </div>
    </div>
  );
}

/* 마무리: 판 위로 톤암이 내려앉음. 톤암 그림의 회전축(받침 원판)은 그림의 (82.4%, 35.5%) */
function Landing({ className = "" }) {
  return (
    <div className={`relative aspect-[10/8] ${className}`}>
      <div className="absolute aspect-square" style={{ left: "38%", top: "62%", width: "68%", transform: "translate(-50%,-50%) scaleY(.5)" }}>
        <div data-fx-outro-disc className="size-full"><Img name="lathe-disc" alt="레코드 판 손그림" className="size-full" /></div>
      </div>
      <div data-fx-tonearm className="absolute origin-[82.4%_35.5%]" style={{ left: "46.8%", top: "-0.7%", width: "55%" }}>
        <Img name="tonearm" alt="톤암 손그림" className="block w-full" />
      </div>
    </div>
  );
}

// Fig.03 홈의 두 벽 (소리처럼 조용했다 커졌다 하는 파형) — pathLength=1 이라 스크롤로 그려짐
const WAVE_UP = "M0 110 Q18 108 30 111 Q43 115 55 109 Q67 104 78 111 L91 106 L101 117 L113 97 L123 125 L136 88 L148 132 L161 77 L173 143 L185 101 Q198 92 210 111 Q227 119 242 108 Q257 103 272 112 Q290 115 307 109 Q324 106 338 111 L352 99 L363 124 L377 72 L389 148 L401 89 L414 130 L425 53 L439 163 L451 83 L465 135 L478 102 Q494 92 509 110 Q528 118 544 107 Q559 104 575 112 Q593 116 610 109 Q627 105 641 111 L655 102 L668 121 L680 91 L692 136 L706 65 L718 153 L730 95 L742 127 L756 81 L769 142 L783 105 Q800 98 815 111 Q833 116 849 108 Q864 105 879 112 L893 101 L905 120 L917 84 L929 139 L942 58 L955 159 L968 91 L981 132 L994 100 Q1010 93 1026 111 Q1044 116 1060 108 Q1075 105 1090 112 Q1105 115 1120 109 L1133 105 L1145 117 L1158 98 L1170 121 Q1185 105 1200 110";
const WAVE_DOWN = WAVE_UP.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_, x, y) => `${x} ${+y + 70}`);   // 아래 벽 = 위 벽을 70 내림
// groove. 밑줄 물결
const UNDERLINE = "M2 10 C8 5 14 4 20 10 S31 16 38 10 S50 3 57 9 S69 17 76 11 S88 4 95 9 S107 16 114 10 S126 3 133 9 S145 17 152 11 S164 5 171 10 S184 16 190 9 Q194 6 198 10";

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
      cut: q("cut"), cutPath: q("cut-path"), cutDot: q("cut-dot"), chips: qa("chip"), head: q("lathe-head"), lDisc: q("lathe-disc"),
      outro: q("outro"), arm: q("tonearm"), oDisc: q("outro-disc"),
      panels: qa("play-panel"), steps: qa("play-step"), pDisc: q("play-disc"), stylus: q("play-stylus"), sig: q("play-sig"), spk: q("play-speaker"),
    };
    let active = -1;
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
      // 헤드: 디스크 바깥(반지름 0.84)에서 안쪽(0.3)으로. 디스크는 늘 돎
      if (E.head) E.head.style.left = `${PLATTER.x + (PLATTER.w / 2) * (0.84 - 0.54 * k) - HEAD.w * HEAD.tip}%`;
      if (E.lDisc) E.lDisc.style.transform = `rotate(${time * 40}deg)`;

      // 마무리: 톤암이 바깥에서 돌아와 판 위로 내려앉고, 판은 늘 돎
      const o = reduced ? 1 : ease(enter(E.outro, 0.85, 0.3));
      if (E.arm) E.arm.style.transform = `rotate(${-24 * (1 - o)}deg)`;
      if (E.oDisc) E.oDisc.style.transform = `rotate(${time * 30}deg)`;

      // 03 재생: 화면 가운데에 가장 가까운 그림의 단계가 켜짐
      if (E.panels.length) {
        const mid = page.getBoundingClientRect().top + page.clientHeight / 2;
        let best = 0, bd = Infinity;
        E.panels.forEach((el, i) => { const r = el.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = i; } });
        if (best !== active) { active = best; E.steps.forEach((st, i) => { st.dataset.on = i === active; }); }
      }
      if (E.pDisc) E.pDisc.style.transform = `rotate(${time * 40}deg)`;
      if (E.stylus) E.stylus.style.transform = active === 1 && !reduced ? `translate(${Math.sin(time * 70) * 1.6}px, ${Math.cos(time * 53) * 1.2}px)` : "";
      E.sig?.style.setProperty("--d", (1 - (reduced ? 1 : ease(enter(E.sig, 0.85, 0.4)))).toFixed(4));
      if (E.spk) E.spk.style.transform = active === 3 && !reduced ? `scale(${1 + 0.025 * Math.abs(Math.sin(time * 7))})` : "";
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rootRef]);
}
// 그려지는 선: pathLength=1 인 path 에 --d(1→0) 로 dashoffset
const DRAW = "[&_path]:[stroke-dasharray:1] [&_path]:[stroke-dashoffset:var(--d,0)]";

// 03 재생 4단계 — 원고 문장을 단계별로 나눔
const PLAY = [
  { label: "레코드의 홈", icon: "icon-grooves", cap: "Fig. 06 — The groove turns", text: <>턴테이블에서 <b className="font-bold">레코드</b>가 회전한다.</> },
  { label: "바늘의 진동", icon: "icon-needle", cap: "Fig. 07 — Stylus in the groove", text: <><b className="font-bold">바늘(Stylus)</b>이 홈의 굴곡을 따라 진동한다.</> },
  { label: "전기 신호", icon: "icon-cable", cap: "Fig. 08 — Vibration becomes a signal", text: <>이 진동은 <b className="font-bold">카트리지(Cartridge)</b>를 통해 전기 신호로 바뀐다.</> },
  { label: "스피커", icon: "icon-speaker", cap: "Fig. 09 — Out of the speaker", text: <>신호는 <b className="font-bold">앰프와 스피커</b>를 거쳐 음악으로 재생된다.</> },
];

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
    {items.map(([c, icon], i) => (
      <li key={c} className="contents">
        {i > 0 && <span aria-hidden="true" className={RUST}>→</span>}
        {/* 스크롤에 맞춰 차례로 켜짐 */}
        <span data-fx-chip className="inline-flex items-center gap-2 rounded-full border border-(--ink)/35 py-1.5 pl-2.5 pr-5 transition-colors duration-500 data-[on=true]:border-(--ink) data-[on=true]:bg-(--ink) data-[on=true]:text-(--cream)">
          <Img name={icon} className="size-8 object-contain" />{c}
        </span>
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
          <svg data-fx-wave viewBox="0 30 1200 230" preserveAspectRatio="none" role="img" aria-label="홈의 두 벽이 소리처럼 굴곡진 손그림"
            fill="none" stroke="#BBCBDA" strokeLinecap="round" strokeLinejoin="round" className={`h-[clamp(140px,22svh,240px)] w-[106%] max-w-none ${DRAW}`}>
            <path pathLength="1" d={WAVE_UP} strokeWidth="3" vectorEffect="non-scaling-stroke" />
            <path pathLength="1" d={WAVE_DOWN} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
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
            <Img name="pellets" alt="납작한 원통 모양 PVC 알갱이 더미 손그림" className="w-full" />
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
                <path data-fx-say-wave pathLength="1" d={UNDERLINE}
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
            <Lathe className="w-full" />
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
            <Chips label="기록 과정" items={[["음악 신호", "icon-wave"], ["홈 제작", "icon-cut"], ["바이닐 레코드", "icon-record"]]} />
          </div>
        </div>
      </section>

      {/* ── 03 재생: 왼쪽 글·단계(sticky) + 오른쪽 그림 4장 ── */}
      <section aria-label="03 음악을 재생할 때" className={SECTION}>
        <div className={`${WRAP} grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] md:gap-16`}>
          <div className="md:sticky md:top-[calc(var(--ct-header-h,106px)+6svh)] md:self-start">
            <Head label="03 — Playback · 음악을 재생할 때" title="A groove becomes sound." />
            <ol aria-label="재생 과정" className="mt-9 max-w-[34rem] border-t-[3px] border-(--ink) max-md:hidden">
              {PLAY.map((st, i) => (
                // 오른쪽에서 지금 보이는 그림의 단계가 켜짐
                <li key={st.label} data-fx-play-step className="group/step grid grid-cols-[2.8rem_minmax(0,1fr)_3.4rem] items-center gap-4 border-b border-(--ink)/15 py-4 opacity-35 transition-opacity duration-500 data-[on=true]:opacity-100">
                  <span className={`${BODONI} text-[1.7rem] leading-none transition-colors duration-500 group-data-[on=true]/step:text-[#c8553d]`}>0{i + 1}</span>
                  <div>
                    <p className="text-[15px] font-bold">{st.label}</p>
                    <p className="mt-1 text-[15px] font-medium leading-7">{st.text}</p>
                  </div>
                  <Img name={st.icon} className="h-12 w-full object-contain" />
                </li>
              ))}
            </ol>
          </div>
          <div className="md:space-y-[4svh]">
            {PLAY.map((st, i) => (
              <figure key={st.label} data-fx-play-panel className="flex flex-col items-center justify-center py-8 md:min-h-[76svh]">
                {/* 모바일: 단계 글이 그림 위에 */}
                <div className="mb-6 w-full md:hidden">
                  <p className={`${BODONI} text-[1.6rem] leading-none ${RUST}`}>0{i + 1} <span className="ml-1 font-['Noto_Serif_KR',Georgia,serif] text-[15px] font-bold text-(--ink)">{st.label}</span></p>
                  <p className="mt-2 text-[15px] font-medium leading-7">{st.text}</p>
                </div>
                {i === 0 && (
                  // 도는 판 (위에서 본 원을 눌러 비스듬히)
                  <div className="w-[min(100%,540px)]"><div className="-my-[22%] [transform:scaleY(.56)]">
                    <div data-fx-play-disc><Img name="lathe-disc" alt="회전하는 레코드 손그림" className="block w-full" /></div>
                  </div></div>
                )}
                {i === 1 && (
                  // 홈 속 바늘 — 이 단계일 때 떨림. 그림 오른쪽 끝(잘린 톤암)은 흐리게
                  <div data-fx-play-stylus className="w-[min(100%,560px)]">
                    <Img name="stylus" alt="카트리지 아래 바늘이 V자 홈에 앉은 손그림" className="block w-full [mask-image:linear-gradient(to_right,#000_78%,transparent)]" />
                  </div>
                )}
                {i === 2 && (
                  // 케이블 + 그려지는 신호 파형
                  <div className="flex w-[min(100%,560px)] items-center gap-3">
                    <Img name="icon-cable" alt="케이블 손그림" className="w-[26%] shrink-0" />
                    <svg data-fx-play-sig viewBox="0 40 1200 140" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="#BBCBDA" strokeLinecap="round" strokeLinejoin="round"
                      className={`h-[clamp(110px,16svh,170px)] min-w-0 flex-1 ${DRAW}`}>
                      <path pathLength="1" d={WAVE_UP} strokeWidth="3" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                )}
                {i === 3 && (
                  // 스피커 — 이 단계일 때 둥둥 울림
                  <div data-fx-play-speaker className="w-[min(100%,460px)] origin-[38%_62%]">
                    <Img name="speaker" alt="소리를 내는 스피커 손그림" className="block w-full" />
                  </div>
                )}
                <figcaption className={`${LABEL} mt-6 text-center opacity-50`}>{st.cap}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── 마무리 ── */}
      <section data-fx-outro aria-label="Vinyl A to Z" className={`${SECTION} text-center`}>
        <Landing className="mx-auto w-[min(86vw,520px)]" />
        <p className={`${BODONI} mt-6 text-[clamp(3.4rem,10vw,10rem)] leading-none tracking-[-0.04em]`}>Vinyl A to Z</p>
        <p className={`${LABEL} mt-12 opacity-55`}>Next — Chapter 02</p>
        <p className={`${BODONI} mt-3 text-[clamp(1.6rem,2.6vw,2.4rem)] tracking-[-0.02em]`}>How a Turntable Works</p>
        <p className={`${LABEL} mt-3 opacity-55`}>Coming soon</p>
      </section>
    </div>
  );
}
