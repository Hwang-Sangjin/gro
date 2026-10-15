"use client";
// Vinyl A to Z · Chapter 01 — "What Is Vinyl?"
// 1 히어로(위에서 본 3D 판) → 2 01 Vinyl이란?(스크롤로 판에 파고들어 홈의 굴곡 = 소리)
// → 3 02 무엇으로 만들어질까?(PVC · 1948 LP) → 4 03 저장(커팅 바늘이 홈을 새김)
// → 5 재생(3D 바늘 매크로) → 6 홈에서 소리까지(신호 흐름)
import { useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import ScrollScene from "@/components/story/ScrollScene";
import Reveal, { RiseText } from "@/components/story/Reveal";
import { seg } from "@/components/story/scroll";

const AlbumVinyl = dynamic(() => import("@/components/album/AlbumVinyl"), { ssr: false });
const NeedleScene = dynamic(() => import("./NeedleScene"), { ssr: false });
const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const KR = "font-['Noto_Serif_KR',Georgia,serif]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const RUST = "#c8553d";
// a~b 구간에서만 보이는 글 (앞뒤로 살짝 페이드)
const shown = (a, b) => `min(${seg(a, a + 0.05)}, calc(1 - ${seg(b - 0.05, b)}))`;

// 평면 판 그림 (홈은 조금씩 끊긴 동심원 — 첫 로딩 판과 같은 그림체)
function RecordArt({ className = "", label = "#bbcbda", style }) {
  const rings = Array.from({ length: 26 }, (_, i) => 190 - i * 5);
  return (
    <svg viewBox="0 0 400 400" className={className} style={style} aria-hidden="true">
      <circle cx="200" cy="200" r="196" fill="currentColor" opacity=".06" />
      {rings.map((r, i) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth={i % 7 === 0 ? 2.4 : 1.1}
          opacity={i % 7 === 3 ? 0.25 : 0.85} pathLength="1" strokeDasharray={`${0.93 + (i % 5) * 0.012} 1`} transform={`rotate(${i * 47} 200 200)`} />
      ))}
      <circle cx="200" cy="200" r="62" fill={label} />
      <circle cx="200" cy="200" r="62" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="200" cy="200" r="5" fill="var(--cream)" />
    </svg>
  );
}

// 소리 파형 (한 주기가 반복되게 두 번 그림 → 왼쪽으로 흘려 보냄)
function wavePath(width, height, seed = 1) {
  const pts = [];
  for (let x = 0; x <= width; x += 6) {
    const k = x / width * Math.PI * 2;
    const y = Math.sin(k * 6 + seed) * 0.5 + Math.sin(k * 15 + seed * 2) * 0.28 + Math.sin(k * 41) * 0.12 + Math.sin(k * 2) * 0.35;
    pts.push(`${x},${(height / 2 + y * height * 0.32).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}
const WAVE = wavePath(1200, 200);

// 장 표시 (예: 01 — Vinyl이란?)
function Chapter({ n, children, className = "" }) {
  return (
    <p className={`flex items-baseline gap-3 text-[11px] font-medium uppercase tracking-[0.3em] ${className}`}>
      <span className={`${SERIF} text-[15px] tracking-normal`} style={{ color: RUST }}>{n}</span>
      <span className="h-px w-8 self-center bg-current opacity-40" />
      <span className={`${KR} normal-case tracking-[0.04em]`}>{children}</span>
    </p>
  );
}

/* ── 01 Vinyl이란? — 판에 파고들어 홈의 굴곡 = 소리 ── */
function GrooveZoom() {
  const captions = [
    [0.02, 0.24, "Look closer.", "바이닐 레코드(Vinyl Record)는 PVC(폴리염화비닐)라는 플라스틱 소재로 만든 아날로그 음반이다."],
    [0.24, 0.48, "One spiral.", "레코드 표면에는 미세한 홈(Groove)이 나선형으로 새겨져 있으며, 이 홈에 음악의 소리 정보가 기록되어 있다."],
    [0.52, 1.01, "The wiggles are the sound.", "디지털 음원과 달리, 바이닐은 소리를 물리적인 홈의 굴곡으로 기록하고 재생한다."],
  ];
  return (
    <ScrollScene height="420svh" aria-label="01 Vinyl이란?" innerClassName="grid place-items-center">
      <div className="absolute inset-x-0 top-[calc(var(--ct-header-h,106px)+20px)] z-10">
        <Chapter n="01" className={WRAP}>Vinyl이란?</Chapter>
      </div>
      {/* 판: 오른쪽 홈 쪽으로 파고듦 */}
      <div className="absolute inset-0 grid place-items-center" style={{ opacity: `calc(1 - ${seg(0.38, 0.47)})` }}>
        <RecordArt className="size-[min(78vh,86vw)] origin-[88%_50%] text-(--ink)"
          style={{ transform: `scale(calc(1 + ${seg(0.02, 0.44)} * 22))` }} />
      </div>

      {/* 확대된 홈: 흘러가는 파형 벽 두 줄 + 바늘 끝 */}
      <div className="absolute inset-0 grid place-items-center overflow-hidden" style={{ opacity: seg(0.4, 0.5) }}>
        <div className="relative h-[46vh] w-full" style={{ transform: `scaleY(calc(0.35 + ${seg(0.5, 0.75)} * 1.15))` }}>
          {[-1, 1].map((side) => (
            <svg key={side} viewBox="0 0 1200 200" preserveAspectRatio="none" className="absolute inset-x-0 h-full w-[200%] animate-[groove-run_7s_linear_infinite] motion-reduce:animate-none"
              style={{ top: `${side * 9}%` }} aria-hidden="true">
              <path d={WAVE} fill="none" stroke="currentColor" strokeWidth={side < 0 ? 3 : 2} vectorEffect="non-scaling-stroke" opacity={side < 0 ? 0.95 : 0.55} />
              <path d={WAVE} transform="translate(1200 0)" fill="none" stroke="currentColor" strokeWidth={side < 0 ? 3 : 2} vectorEffect="non-scaling-stroke" opacity={side < 0 ? 0.95 : 0.55} />
            </svg>
          ))}
        </div>
        {/* 바늘 */}
        <svg viewBox="0 0 60 260" className="absolute left-1/2 top-[6vh] h-[44vh] -translate-x-1/2 animate-[needle-buzz_.09s_linear_infinite] motion-reduce:animate-none" aria-hidden="true">
          <rect x="22" y="0" width="16" height="190" fill="var(--ink)" opacity=".9" />
          <path d="M14 190h32l-10 52h-12z" fill="var(--ink)" />
          <path d="M28 242l2 18 2-18z" fill={RUST} />
        </svg>
      </div>

      {/* 설명 글: 진행도에 따라 하나씩 */}
      {captions.map(([a, b, title, body]) => (
        <div key={title} className="pointer-events-none absolute bottom-[10vh] left-[clamp(20px,6vw,90px)] max-w-[min(460px,84vw)]" style={{ opacity: shown(a, b), transform: `translateY(calc((1 - ${seg(a, a + 0.06)}) * 24px))` }}>
          <p className={`${SERIF} text-[clamp(2rem,4vw,3.6rem)] leading-[0.95]`}>{title}</p>
          <p className={`${KR} mt-3 rounded-xl bg-(--cream)/85 p-3.5 text-[15px] leading-7 backdrop-blur-[2px]`}>{body}</p>
        </div>
      ))}
    </ScrollScene>
  );
}

/* ── 02 무엇으로 만들어질까? ── */
function Material() {
  return (
    <section className={`${WRAP} grid items-center gap-[clamp(3rem,6vw,6rem)] py-[clamp(6rem,14vw,11rem)] md:grid-cols-[1.1fr_1fr]`}>
      <div>
        <Reveal><Chapter n="02">Vinyl은 무엇으로 만들어질까?</Chapter></Reveal>
        <RiseText lines={["Made of", "PVC."]} className={`${SERIF} mt-6 text-[clamp(3.4rem,8vw,8rem)] leading-[0.88]`} />
        <Reveal delay={200} className={`${KR} mt-8 max-w-xl space-y-4 text-[16px] leading-8 text-(--ink)/80`}>
          <p>바이닐 레코드는 주로 <b className="font-semibold text-(--ink)">PVC(Polyvinyl Chloride, 폴리염화비닐)</b> 계열 소재로 제작된다.</p>
          <p>PVC는 비교적 유연하고 내구성이 있는 플라스틱으로, 소리 정보를 담는 미세한 홈을 정밀하게 만들기에 적합하다.</p>
          <p>오늘날에도 PVC 계열 소재는 바이닐 레코드 제작에 널리 사용되고 있다.</p>
        </Reveal>
      </div>
      {/* 1948 LP: 돌아가는 판 + 숫자 */}
      <Reveal delay={150} className="relative">
        <div className="relative mx-auto aspect-square w-[min(100%,460px)] text-(--ink)">
          <RecordArt className="size-full animate-[spin_1.8s_linear_infinite] motion-reduce:animate-none" label={RUST} />
          <div className="absolute inset-0 grid place-items-center">
            <p className={`${SERIF} text-[clamp(1.2rem,2.2vw,1.7rem)] leading-none text-[#f4e7cd]`}>1948</p>
          </div>
        </div>
        <p className={`${KR} mx-auto mt-8 max-w-md text-center text-[15px] leading-7 text-(--ink)/75`}>
          1948년 컬럼비아 레코드가 발표한 현대적인 LP는 PVC 계열 소재와 <b className="font-semibold text-(--ink)">미세한 홈(Microgroove)</b> 기술로 한 면에 약 20분 이상의 음악을 담을 수 있었다.
        </p>
        <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 border-t-[3px] border-(--ink) text-center">
          {[["Year", "1948"], ["Per side", "20+"], ["Material", "PVC"]].map(([k, v], i) => (
            <div key={k} className={`py-4 ${i ? "border-l border-(--ink)/20" : ""}`}>
              <dt className="text-[10px] uppercase tracking-[0.24em] text-(--ink)/55">{k}</dt>
              <dd className={`${SERIF} mt-2 text-[clamp(1.8rem,3vw,2.6rem)] leading-none`}>{v}{k === "Per side" && <span className="text-[.45em]">min</span>}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}

/* ── 03 저장: 커팅 바늘이 음악 신호에 맞춰 홈을 새김 ── */
function Cutting() {
  return (
    <section className="overflow-hidden py-[clamp(6rem,14vw,11rem)]">
      <div className={WRAP}>
        <Reveal><Chapter n="03">Vinyl은 어떻게 음악을 저장하고 재생할까?</Chapter></Reveal>
        <RiseText lines={["Sound becomes", "a groove."]} className={`${SERIF} mt-6 text-[clamp(3.2rem,7.4vw,7.6rem)] leading-[0.88]`} />
        <Reveal delay={200} as="p" className={`${KR} mt-8 max-w-2xl text-[16px] leading-8 text-(--ink)/80`}>
          바이닐은 음악을 홈의 미세한 굴곡으로 기록하고, 그 굴곡을 다시 읽어서 소리로 재생하는 방식으로 작동한다.
        </Reveal>
      </div>

      {/* 커팅: 오른쪽은 아직 매끈한 판, 커팅 바늘을 지나면 왼쪽으로 굴곡진 홈이 생겨 흘러감 */}
      <Reveal delay={250} className="relative mt-[clamp(3rem,6vw,5rem)] h-[clamp(140px,22vw,240px)] text-(--ink)" aria-hidden="true">
        <div className="absolute inset-y-0 left-0 right-1/2 overflow-hidden">
          {[-1, 1].map((side) => (
            <svg key={side} viewBox="0 0 1200 200" preserveAspectRatio="none" className="absolute inset-x-0 h-full w-[400%] animate-[groove-run_7s_linear_infinite] motion-reduce:animate-none"
              style={{ top: `${side * 8}%` }}>
              <path d={WAVE} fill="none" stroke="currentColor" strokeWidth={side < 0 ? 3 : 2} vectorEffect="non-scaling-stroke" opacity={side < 0 ? 0.95 : 0.5} />
              <path d={WAVE} transform="translate(1200 0)" fill="none" stroke="currentColor" strokeWidth={side < 0 ? 3 : 2} vectorEffect="non-scaling-stroke" opacity={side < 0 ? 0.95 : 0.5} />
            </svg>
          ))}
        </div>
        <div className="absolute inset-y-[42%] left-1/2 right-0 border-y border-current opacity-30" />
        {/* 커팅 바늘 */}
        <svg viewBox="0 0 60 260" className="absolute bottom-1/2 left-1/2 h-[120%] -translate-x-1/2 translate-y-[14%] animate-[needle-buzz_.09s_linear_infinite] motion-reduce:animate-none">
          <rect x="22" y="0" width="16" height="190" fill="currentColor" opacity=".9" />
          <path d="M14 190h32l-10 52h-12z" fill="currentColor" />
          <path d="M28 242l2 18 2-18z" fill={RUST} />
        </svg>
        <span className="absolute left-1/2 top-0 ml-6 text-[11px] uppercase tracking-[0.24em]" style={{ color: RUST }}>Cutting stylus</span>
      </Reveal>

      <div className={`${WRAP} mt-[clamp(3rem,6vw,5rem)] grid gap-10 md:grid-cols-[1fr_1fr]`}>
        <Reveal className={`${KR} space-y-4 text-[16px] leading-8 text-(--ink)/80`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">Recording · 음악을 저장할 때</p>
          <p>음악의 신호에 맞춰 특수한 <b className="font-semibold text-(--ink)">커팅 바늘</b>이 움직이며 마스터 디스크에 미세한 홈을 새긴다.</p>
          <p>이 홈을 PVC 음반에 복제하여 우리가 사용하는 바이닐 레코드를 만든다.</p>
        </Reveal>
        <Reveal delay={150} as="ol" aria-label="기록 과정" className={`${KR} flex flex-wrap items-center gap-2 self-end text-[14px] md:justify-end`}>
          {["음악 신호", "홈 제작", "바이닐 레코드"].map((t, i, all) => (
            <li key={t} className="flex items-center gap-2">
              <span className={`rounded-full px-4 py-2 ${i === all.length - 1 ? "bg-(--ink) font-semibold text-(--cream)" : "border border-(--ink)/40"}`}>{t}</span>
              {i < all.length - 1 && <span aria-hidden="true" style={{ color: RUST }}>→</span>}
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ── 재생: 3D 바늘 매크로 ── */
function Needle3D() {
  const progress = useRef(0);
  const box = useRef({ current: 0 });
  const onProgress = useCallback((p) => { box.current.current = p; progress.current = p; }, []);
  const lines = [
    [0, 0.34, "Drop the needle.", "턴테이블에서 레코드가 회전하면, 바늘(Stylus)이 홈 속으로 내려앉는다."],
    [0.34, 0.68, "It follows every wiggle.", "바늘은 홈의 굴곡을 따라 진동한다. 음악이 새겨진 모양 그대로."],
    [0.68, 1.01, "Motion becomes electricity.", "이 진동은 카트리지(Cartridge)를 통해 전기 신호로 변환된다."],
  ];
  return (
    <ScrollScene height="360svh" onProgress={onProgress} aria-label="Playback · 음악을 재생할 때" className="bg-[#17121a] text-[#f4e7cd]">
      <NeedleScene progress={box.current} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(23,18,26,.8))]" />
      {lines.map(([a, b, title, body]) => (
        <div key={title} className="pointer-events-none absolute left-[clamp(20px,6vw,90px)] top-1/2 max-w-[min(440px,84vw)] -translate-y-1/2 max-md:bottom-[7vh] max-md:top-auto max-md:translate-y-0" style={{ opacity: shown(a, b) }}>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#bbcbda]">Playback · 음악을 재생할 때</p>
          <p className={`${SERIF} mt-3 text-[clamp(2.2rem,4.4vw,4rem)] leading-[0.95]`}>{title}</p>
          <p className={`${KR} mt-4 text-[15px] leading-7 text-[#f4e7cd]/80`}>{body}</p>
        </div>
      ))}
    </ScrollScene>
  );
}

/* ── 홈에서 소리까지 ── */
const CHAIN = [
  ["Groove", "레코드의 홈", "음악이 굴곡으로 새겨진 나선형 홈."],
  ["Stylus", "바늘의 진동", "바늘이 홈의 굴곡을 따라 진동한다."],
  ["Cartridge", "전기 신호", "카트리지가 진동을 전기 신호로 바꾼다."],
  ["Amp · Speakers", "스피커", "앰프와 스피커를 거쳐 다시 음악이 된다."],
];
function SignalChain() {
  return (
    <section className={`${WRAP} py-[clamp(5rem,12vw,10rem)]`}>
      <RiseText lines={["A groove", "becomes sound."]} className={`${SERIF} text-[clamp(3rem,7vw,7rem)] leading-[0.9]`} />
      <Reveal delay={150} as="p" className={`${KR} mt-5 text-[15px] text-(--ink)/65`}>재생 과정 · 레코드의 홈 → 바늘의 진동 → 전기 신호 → 스피커</Reveal>
      <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
        {/* 흐르는 신호선 */}
        <svg className="absolute left-0 top-[26px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden="true">
          <line x1="0" y1="1" x2="100" y2="1" stroke={RUST} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 8" className="animate-[signal-flow_1.6s_linear_infinite] motion-reduce:animate-none" />
        </svg>
        {CHAIN.map(([name, ko, text], i) => (
          <Reveal as="li" key={name} delay={i * 140} className="relative">
            <span className={`${SERIF} relative z-10 grid size-[54px] place-items-center rounded-full border-2 border-(--ink) bg-(--cream) text-[22px]`}>{i + 1}</span>
            <p className={`${SERIF} mt-5 text-[26px] leading-none`}>{name}</p>
            <p className={`${KR} mt-2 text-[15px] font-semibold`}>{ko}</p>
            <p className={`${KR} mt-2 text-[14px] leading-6 text-(--ink)/75`}>{text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

export default function Story() {
  return (
    <div className="text-(--ink)">
      {/* 한글 본문용 명조 (이 글에서만 불러옴) */}
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap" />

      {/* 1 히어로: 제목 + 위에서 내려다본 3D 판 (검정, 33⅓ rpm) */}
      <section className={`${WRAP} grid min-h-svh items-center gap-10 pb-16 pt-[calc(var(--ct-header-h,106px)+80px)] md:grid-cols-[1fr_1.1fr]`}>
        <div className="max-md:order-2">
          <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em]" style={{ color: RUST }}>Vinyl A to Z · Chapter 01</Reveal>
          <RiseText as="h1" lines={["What Is", "Vinyl?"]} delay={120} lineClassName="whitespace-nowrap" className={`${SERIF} mt-5 text-[clamp(3.6rem,8.4vw,9rem)] leading-[0.86]`} />
          <Reveal delay={400} as="p" className={`${KR} mt-6 text-[clamp(1.35rem,2.4vw,2.1rem)] font-black`}>바이닐이란 무엇인가?</Reveal>
          <Reveal delay={550} as="p" className={`${KR} mt-5 max-w-md text-[16px] leading-8 text-(--ink)/75`}>
            소리를 홈의 굴곡으로 새기고, 바늘로 그 굴곡을 다시 읽어 소리로 되돌리는 음반. 바이닐이 무엇이고, 어떻게 음악을 담는지 알아봅니다.
          </Reveal>
          <Reveal delay={700} as="p" className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] opacity-60">
            <span className="h-10 w-px animate-[scroll-cue_1.8s_ease-in-out_infinite] bg-current motion-reduce:animate-none" />Scroll
          </Reveal>
        </div>
        <Reveal delay={250} className="flex justify-center max-md:order-1">
          <div className="relative aspect-square w-[min(100%,calc(100svh-var(--ct-header-h,106px)-8rem),640px)]">
            <AlbumVinyl ink="#171217" label="#2a222a" rpm={33.333} playing tilt={90} dpr={[1, 1.5]} />
          </div>
        </Reveal>
      </section>

      <GrooveZoom />
      <Material />
      <Cutting />
      <Needle3D />
      <SignalChain />
    </div>
  );
}
