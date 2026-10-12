"use client";
// Vinyl A to Z — "What Is a Record?"
// 1 히어로(도는 판) → 2 홈 확대(스크롤로 판에 파고들어 홈의 굴곡 = 소리) → 3 3D 바늘 매크로
// → 4 소리가 나오기까지(신호 흐름) → 5 짧은 역사(가로 타임라인) → 6 세 가지 속도 → 7 마무리
import { useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import ScrollScene from "@/components/story/ScrollScene";
import Reveal, { RiseText } from "@/components/story/Reveal";
import { seg } from "@/components/story/scroll";

const NeedleScene = dynamic(() => import("./NeedleScene"), { ssr: false });
const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
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

// 홈 확대에서 쓰는 소리 파형 (한 주기가 반복되게 두 번 그림 → 왼쪽으로 흘려 보냄)
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

function GrooveZoom() {
  const captions = [
    [0.02, 0.2, "Look closer.", "Under the gloss there are no tracks, no lines — just one groove."],
    [0.2, 0.42, "One spiral.", "It runs from the outer edge to the label, without a break. On one side of an LP, it’s roughly 450 metres long."],
    [0.46, 0.72, "The wiggles are the sound.", "When the music gets louder, the groove swings wider. Higher notes wiggle faster. The shape of the wall is the waveform."],
    [0.74, 1.01, "Two walls, two channels.", "The groove is V-shaped. In stereo, the inner wall carries the left channel and the outer wall the right — one needle reads both."],
  ];
  return (
    <ScrollScene height="460svh" aria-label="Zooming into the groove" innerClassName="grid place-items-center">
      {/* 판: 오른쪽 홈 쪽으로 파고듦 */}
      <div className="absolute inset-0 grid place-items-center" style={{ opacity: `calc(1 - ${seg(0.38, 0.47)})` }}>
        <RecordArt className="size-[min(78vh,86vw)] origin-[88%_50%] text-(--ink)"
          style={{ transform: `scale(calc(1 + ${seg(0.02, 0.44)} * 22))` }} />
      </div>

      {/* 확대된 홈: 흘러가는 파형 벽 두 줄 + 바늘 끝 */}
      <div className="absolute inset-0 grid place-items-center overflow-hidden" style={{ opacity: seg(0.4, 0.5) }}>
        <div className="relative h-[46vh] w-full" style={{ transform: `scaleY(calc(0.35 + ${seg(0.46, 0.7)} * 1.15))` }}>
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
          <path d="M28 242l2 18 2-18z" fill="#c8553d" />
        </svg>
        {/* 홈 단면 (V) — 왼쪽/오른쪽 채널 */}
        <div className="absolute bottom-[8vh] right-[clamp(20px,6vw,90px)] w-[min(240px,40vw)] text-center max-md:bottom-auto max-md:top-[calc(var(--ct-header-h,64px)+16px)]" style={{ opacity: seg(0.74, 0.8) }}>
          <svg viewBox="0 0 200 120" className="w-full" aria-hidden="true">
            <path d="M10 20h50l40 80 40-80h50" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M60 20l40 80" stroke="#4f6d93" strokeWidth="7" opacity=".85" /><path d="M140 20l-40 80" stroke="#c8553d" strokeWidth="7" opacity=".85" />
            <circle cx="100" cy="72" r="13" fill="var(--ink)" />
            <text x="58" y="72" fontSize="16" fontWeight="700" fill="#4f6d93">L</text><text x="134" y="72" fontSize="16" fontWeight="700" fill="#c8553d">R</text>
          </svg>
          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] opacity-70">Groove cross-section · 45°/45°</p>
        </div>
      </div>

      {/* 설명 글: 진행도에 따라 하나씩 */}
      {captions.map(([a, b, title, body]) => (
        <div key={title} className="pointer-events-none absolute bottom-[10vh] left-[clamp(20px,6vw,90px)] max-w-[min(440px,82vw)]" style={{ opacity: shown(a, b), transform: `translateY(calc((1 - ${seg(a, a + 0.06)}) * 24px))` }}>
          <p className={`${SERIF} text-[clamp(2rem,4vw,3.6rem)] leading-[0.95]`}>{title}</p>
          <p className="mt-3 rounded-xl bg-(--cream)/80 p-3 text-[15px] leading-7 backdrop-blur-[2px]">{body}</p>
        </div>
      ))}
    </ScrollScene>
  );
}

function Needle3D() {
  const progress = useRef(0);
  const box = useRef({ current: 0 });
  const onProgress = useCallback((p) => { box.current.current = p; progress.current = p; }, []);
  const lines = [
    [0, 0.34, "Meet the stylus.", "A tiny diamond tip, a few hundredths of a millimetre across, rests in the groove with about two grams of weight."],
    [0.34, 0.68, "It follows every wiggle.", "As the record turns at 33⅓ revolutions a minute, the walls push the tip side to side — thousands of times a second."],
    [0.68, 1.01, "Motion becomes electricity.", "The tip’s cantilever moves a magnet or coil inside the cartridge, making a tiny voltage — just a few thousandths of a volt."],
  ];
  return (
    <ScrollScene height="360svh" onProgress={onProgress} aria-label="The needle in the groove" className="bg-[#17121a] text-[#f4e7cd]">
      <NeedleScene progress={box.current} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(23,18,26,.8))]" />
      {lines.map(([a, b, title, body]) => (
        <div key={title} className="pointer-events-none absolute left-[clamp(20px,6vw,90px)] top-1/2 max-w-[min(420px,84vw)] -translate-y-1/2 max-md:bottom-[7vh] max-md:top-auto max-md:translate-y-0" style={{ opacity: shown(a, b) }}>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#bbcbda]">The needle</p>
          <p className={`${SERIF} mt-3 text-[clamp(2.2rem,4.4vw,4rem)] leading-[0.95]`}>{title}</p>
          <p className="mt-4 text-[15px] leading-7 text-[#f4e7cd]/80">{body}</p>
        </div>
      ))}
    </ScrollScene>
  );
}

const CHAIN = [
  ["Stylus", "Reads the groove’s wiggles as movement."],
  ["Cartridge", "Turns that movement into a tiny electrical signal."],
  ["Phono preamp", "Boosts it — and restores the bass that was cut and the treble that was boosted when the record was made (the RIAA curve)."],
  ["Amplifier", "Makes the signal strong enough to drive speakers."],
  ["Speakers", "Push the air, and the wiggle becomes sound again."],
];
function SignalChain() {
  return (
    <section className={`${WRAP} py-[clamp(5rem,12vw,10rem)]`}>
      <RiseText lines={["From groove", "to sound"]} className={`${SERIF} text-[clamp(3rem,7vw,7rem)] leading-[0.9]`} />
      <ol className="relative mt-14 grid gap-10 md:grid-cols-5 md:gap-6">
        {/* 흐르는 신호선 */}
        <svg className="absolute left-0 top-[26px] hidden h-2 w-full md:block" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden="true">
          <line x1="0" y1="1" x2="100" y2="1" stroke="#c8553d" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 8" className="animate-[signal-flow_1.6s_linear_infinite] motion-reduce:animate-none" />
        </svg>
        {CHAIN.map(([name, text], i) => (
          <Reveal as="li" key={name} delay={i * 140} className="relative">
            <span className={`${SERIF} relative z-10 grid size-[54px] place-items-center rounded-full border-2 border-(--ink) bg-(--cream) text-[22px]`}>{i + 1}</span>
            <p className={`${SERIF} mt-5 text-[26px] leading-none`}>{name}</p>
            <p className="mt-3 text-[14px] leading-6 text-(--ink)/75">{text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

const HISTORY = [
  ["1877", "The phonograph", "Thomas Edison records sound on tinfoil wrapped around a turning cylinder — and plays it back.", "cyl"],
  ["1887", "The flat disc", "Emile Berliner patents the gramophone. Discs are flat, so they can be stamped out by the thousand.", 10],
  ["1910s–50s", "The 78 era", "Brittle shellac discs spin at about 78 rpm and hold three to five minutes a side.", 10],
  ["1948", "The long player", "Columbia launches the 12-inch vinyl LP at 33⅓ rpm — over twenty minutes a side. The album is born.", 12],
  ["1949", "The single", "RCA Victor answers with the 7-inch 45 — one song a side, made for jukeboxes.", 7],
  ["1958", "Stereo", "Stereo LPs arrive: two channels cut into the two walls of a single groove.", 12],
  ["1982", "Enter the CD", "Compact discs go on sale. Over the next decade, vinyl nearly disappears from the shops.", "cd"],
  ["2008", "Record Store Day", "Independent shops start an annual day of exclusive pressings — and the queues return.", 12],
  ["2020s", "The comeback", "In the US, vinyl out-earns CDs in 2020 for the first time since the 1980s.", 12],
];
function Disc({ kind }) {
  if (kind === "cyl") return <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true"><ellipse cx="60" cy="30" rx="34" ry="10" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M26 30v60c0 6 15 10 34 10s34-4 34-10V30" fill="none" stroke="currentColor" strokeWidth="2" />{[42, 54, 66, 78].map((y) => <path key={y} d={`M26 ${y}c0 6 15 10 34 10s34-4 34-10`} fill="none" stroke="currentColor" opacity=".4" />)}</svg>;
  if (kind === "cd") return <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true"><defs><linearGradient id="cdg" x1="0" x2="1"><stop offset="0" stopColor="#bbcbda" /><stop offset=".5" stopColor="#f4e7cd" /><stop offset="1" stopColor="#c8553d" stopOpacity=".6" /></linearGradient></defs><circle cx="60" cy="60" r="44" fill="url(#cdg)" opacity=".7" /><circle cx="60" cy="60" r="8" fill="var(--cream)" stroke="currentColor" /></svg>;
  const r = { 7: 26, 10: 38, 12: 46 }[kind];
  return <svg viewBox="0 0 120 120" className="size-24" aria-hidden="true"><circle cx="60" cy="60" r={r} fill="currentColor" opacity=".9" />{[0.8, 0.62, 0.45].map((k) => <circle key={k} cx="60" cy="60" r={r * k} fill="none" stroke="var(--cream)" opacity=".25" />)}<circle cx="60" cy="60" r={r * 0.3} fill="#bbcbda" /></svg>;
}
function History() {
  return (
    <ScrollScene height={`${HISTORY.length * 55}svh`} aria-label="A short history" innerClassName="flex flex-col justify-center">
      <div className={`${WRAP} mb-8 flex items-end justify-between gap-6`}>
        <p className={`${SERIF} text-[clamp(2.6rem,6vw,6rem)] leading-[0.9]`}>A short history</p>
        <p className="hidden pb-2 text-[12px] uppercase tracking-[0.24em] opacity-60 tabular-nums sm:block">1877 → today</p>
      </div>
      {/* 가로로 흐르는 타임라인: 스크롤하면 왼쪽으로 */}
      <div className="relative">
        <div className="absolute inset-x-0 top-[48px] h-px bg-(--ink)/25" />
        <ol className="flex w-max gap-[clamp(2rem,5vw,5rem)] pl-[clamp(20px,6vw,90px)] pr-[30vw] will-change-transform"
          style={{ transform: "translateX(calc((100vw - 100%) * var(--p)))" }}>
          {HISTORY.map(([year, title, text, kind]) => (
            <li key={year} className="w-[min(78vw,340px)] shrink-0">
              <span className="relative z-10 block size-[14px] translate-y-[41px] rounded-full border-2 border-(--ink) bg-(--cream)" />
              <p className={`${SERIF} mt-[60px] text-[clamp(2.6rem,4vw,4rem)] leading-none text-[#c8553d]`}>{year}</p>
              <div className="mt-4 flex items-start gap-4">
                <span className="shrink-0 text-(--ink)"><Disc kind={kind} /></span>
                <div>
                  <p className={`${SERIF} text-[24px] leading-tight`}>{title}</p>
                  <p className="mt-2 text-[14px] leading-6 text-(--ink)/75">{text}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </ScrollScene>
  );
}

const SPEEDS = [
  ["33⅓", "12-inch LP", "Long play: a whole side of an album.", 1.8, "size-[min(64vw,300px)]"],
  ["45", "7-inch single", "One song a side, punchy and loud.", 4 / 3, "size-[min(40vw,170px)]"],
  ["78", "10-inch shellac", "The old standard, heavy and brittle.", 60 / 78, "size-[min(52vw,230px)]"],
];
function Speeds() {
  return (
    <section className={`${WRAP} py-[clamp(5rem,12vw,10rem)]`}>
      <RiseText lines={["Three speeds"]} className={`${SERIF} text-[clamp(3rem,7vw,7rem)] leading-[0.9]`} />
      <p className="mt-4 max-w-xl text-[15px] leading-7 text-(--ink)/75">Revolutions per minute. Each disc below is turning at its real speed.</p>
      <div className="mt-14 grid items-end gap-12 md:grid-cols-3">
        {SPEEDS.map(([rpm, name, text, sec, size], i) => (
          <Reveal key={rpm} delay={i * 150} className="flex flex-col items-center text-center">
            <span className={`${size} text-(--ink)`}>
              <RecordArt className="size-full animate-spin motion-reduce:animate-none" style={{ animationDuration: `${sec}s` }} label={["#bbcbda", "#e3b04b", "#c8553d"][i]} />
            </span>
            <p className={`${SERIF} mt-6 text-[clamp(3rem,5vw,4.6rem)] leading-none`}>{rpm}<span className="ml-1 font-sans text-[14px] font-medium tracking-[0.2em]">RPM</span></p>
            <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.22em] text-[#c8553d]">{name}</p>
            <p className="mt-2 max-w-[24ch] text-[14px] leading-6 text-(--ink)/70">{text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function Story() {
  return (
    <>
      {/* 1 히어로 */}
      <section className={`${WRAP} grid min-h-svh items-center gap-10 pb-16 pt-[calc(var(--ct-header-h,106px)+90px)] md:grid-cols-[1.1fr_1fr]`}>
        <div>
          <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-[#c8553d]">Vinyl A to Z · No. 01</Reveal>
          <RiseText as="h1" lines={["What is", "a record?"]} delay={120} lineClassName="whitespace-nowrap" className={`${SERIF} mt-5 text-[clamp(3.6rem,8.4vw,9rem)] leading-[0.86]`} />
          <Reveal delay={500} as="p" className="mt-8 max-w-md text-[17px] leading-8 text-(--ink)/80">
            A single spiral, about half a kilometre long, that wiggles exactly like sound. Drop a needle in it and the plastic sings. Here’s how — and how we got here.
          </Reveal>
          <Reveal delay={700} as="p" className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] opacity-60">
            <span className="h-10 w-px animate-[scroll-cue_1.8s_ease-in-out_infinite] bg-current motion-reduce:animate-none" />Scroll
          </Reveal>
        </div>
        <Reveal delay={250} className="justify-self-center text-(--ink)">
          <RecordArt className="size-[min(70vw,520px)] animate-[spin_1.8s_linear_infinite] motion-reduce:animate-none" />
        </Reveal>
      </section>

      {/* 2 홈 확대 */}
      <GrooveZoom />
      {/* 3 3D 바늘 */}
      <Needle3D />
      {/* 4 신호 흐름 */}
      <SignalChain />
      {/* 5 역사 */}
      <History />
      {/* 6 속도 */}
      <Speeds />

      {/* 7 마무리 */}
      <section className={`${WRAP} pb-10 pt-[clamp(3rem,8vw,6rem)] text-center`}>
        <RiseText lines={["Now you know", "what’s spinning."]} className={`${SERIF} text-[clamp(2.6rem,6vw,6rem)] leading-[0.92]`} />
        <Reveal delay={300}>
          <Link href="/digging" className="mt-10 inline-flex min-h-12 items-center rounded-full bg-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--cream) transition-colors hover:bg-[#c8553d]">Start digging</Link>
        </Reveal>
      </section>
    </>
  );
}
