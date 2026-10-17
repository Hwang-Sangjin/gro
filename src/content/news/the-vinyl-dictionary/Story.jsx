"use client";
// Vinyl A to Z · Chapter 02 — "The Vinyl Dictionary"
// 히어로 → 01 형식(LP·EP·Single, 판 위 트랙 띠) → 02 크기(7·10·12인치 실제 비율) → 03 속도(33⅓·45·78 상대 회전, 같은 소리의 홈 길이) → 04 용어(사전) → 마무리
// 그림: 1화의 위에서 본 레코드 손그림 하나를 마스크로 써서 테마 색(--cover-art)으로 칠함
import { useEffect, useId, useRef, useState } from "react";
import Reveal, { RiseText } from "@/components/story/Reveal";

const DISC = "/images/news/what-is-vinyl/lathe-disc.webp";
const BODONI = "font-['Grooves_Bodoni',Georgia,serif] font-black";
const KR = "font-['Noto_Serif_KR',Georgia,serif]";
const LABEL = "font-sans text-[11px] font-semibold uppercase tracking-[0.28em]";
const PADX = "px-[clamp(20px,4vw,72px)]";
const WRAP = "mx-auto w-full max-w-[1240px]";
const SECTION = `${PADX} py-[clamp(72px,12svh,150px)]`;
const H2 = `${BODONI} text-[clamp(2.6rem,5vw,5.2rem)] leading-[0.9] tracking-[-0.03em]`;
const BODY = "text-[clamp(1.02rem,1.25vw,1.15rem)] font-medium leading-[1.9]";
const ACC = "text-(--accent)";
const SOFT = "rounded-sm bg-(--cover-bg)";

/* 손그림 레코드 한 장 (위에서 본 원). backed: 뒤에 바탕색 원을 깔아 겹친 판을 가림 */
function Disc({ className = "", style, label, backed = false }) {
  const id = `d${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 1 1" className={className} style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <mask id={id} maskContentUnits="objectBoundingBox" style={{ maskType: "alpha" }}>
        <image href={DISC} width="1" height="1" preserveAspectRatio="none" />
      </mask>
      {backed && <circle cx=".5" cy=".5" r=".5" className="fill-(--cream)" />}
      <rect width="1" height="1" mask={`url(#${id})`} className="fill-(--cover-art)" />
    </svg>
  );
}

/* 01 형식: 한 면의 곡 수만큼 홈 묶음(띠)을 그린 판. k = 판 크기 비율 */
function Tracks({ n, k = 1, label }) {
  const R = 48 * k, r0 = 15 * Math.max(k, 0.8), gap = n > 1 ? 1.6 : 0, band = (R - 2 - r0 - gap * (n - 1)) / n;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const outer = R - 2 - i * (band + gap);
    for (let g = 0; g < Math.max(3, Math.round(band / 1.6)); g++) rings.push(+(outer - g * 1.6).toFixed(2));
  }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} className="mx-auto w-[min(100%,250px)]">
      <g fill="none" className="stroke-(--cover-art)">
        <circle cx="50" cy="50" r={R} strokeWidth="1.6" />
        {rings.map((r, i) => <circle key={i} cx="50" cy="50" r={r} strokeWidth=".55" opacity=".75" />)}
      </g>
      <circle cx="50" cy="50" r={r0 - 1.5} opacity=".9" className="fill-(--cover-art)" />
      <circle cx="50" cy="50" r="1.4" className="fill-(--cover-bg)" />
      {n === 1 && <text x="50" y={50 - r0 / 2.6} textAnchor="middle" fontSize="5" fontWeight="700" fontFamily="sans-serif" className="fill-(--cover-bg)">A</text>}
    </svg>
  );
}

const FORMATS = [
  { name: "LP", sub: "Long Play", n: 5, k: 1, spec: "12″ · 33⅓ RPM · 한 면 약 20분", text: "여러 곡을 담은 긴 형식의 음반으로, 주로 정규 앨범에 쓰인다. 보통 12인치 크기에 33⅓ RPM으로 재생하며, 한 면에 약 20분 안팎의 음악을 담는다.", alt: "한 면에 다섯 곡이 띠처럼 나뉜 LP" },
  { name: "EP", sub: "Extended Play", n: 3, k: 0.8, spec: "3~6곡 · 크기·속도 다양", text: "싱글보다 길고 정규 앨범보다는 짧은 음반이다. 보통 3~6곡을 담으며, 크기와 회전 속도는 음반마다 다르다.", alt: "한 면에 세 곡이 띠처럼 나뉜 EP" },
  { name: "Single", sub: "A-side · B-side", n: 1, k: 0.58, spec: "7″ · 45 RPM · 면마다 한 곡", text: "한두 곡을 중심으로 발매하는 음반이다. 대표적인 형태는 7인치 · 45 RPM으로, A면과 B면에 한 곡씩 담는 경우가 많다.", alt: "한 면에 한 곡이 담긴 7인치 싱글" },
];
const SIZES = [
  { v: "12", cm: "약 30cm", use: "LP, 12인치 싱글", w: 100 },
  { v: "10", cm: "약 25cm", use: "EP, 한정·특별 발매", w: 83.3 },
  { v: "7", cm: "약 18cm", use: "싱글", w: 58.3 },
];
// 1회전 시간: 33⅓ = 1.8s · 45 = 1.333s · 78 = 0.769s
const SPEEDS = [
  { rpm: "33⅓", rev: 1.8, use: "대부분의 LP" },
  { rpm: "45", rev: 1.3333, use: "7인치 싱글, 일부 12인치 음반" },
  { rpm: "78", rev: 0.7692, use: "1950년대까지 쓰인 셸락(Shellac) 음반" },
];
const TERMS = [
  ["Original Pressing", "n.", "음반이 처음 발매될 때 찍어 낸 판."],
  ["Reissue", "n.", "이전에 발매된 음반을 다시 찍어 낸 재발매반."],
  ["Remaster", "n.", "원래 녹음을 다시 다듬어 만든 버전."],
  ["180g", "adj.", "일반 레코드보다 두껍고 무거운 판. 휘어짐에 강하지만, 무게가 음질을 보장하지는 않는다."],
  ["Gatefold", "n.", "책처럼 펼쳐지는 재킷."],
];

/* 같은 소리를 33⅓ / 45 로 새긴 홈 — 45 는 같은 1초에 홈이 35% 더 길게 펼쳐짐 */
const sound = (x) => 30 + 20 * (0.55 * Math.sin(x * 0.09) + 0.3 * Math.sin(x * 0.23 + 1) + 0.15 * Math.sin(x * 0.61));
const groove = (stretch, t) => "M" + Array.from({ length: 301 }, (_, i) => `${i * 2} ${sound((i * 2) / stretch + t).toFixed(2)}`).join(" L");

function GrooveCompare() {
  const a = useRef(null), b = useRef(null);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      const r = a.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) return;   // 화면 밖이면 쉼
      const t = reduced ? 0 : ms / 20;
      a.current.setAttribute("d", groove(1, t));
      b.current.setAttribute("d", groove(1.35, t / 1.35));
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const strip = (ref, init) => (
    <svg viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true" className="h-16 w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path ref={ref} d={init} strokeWidth="3" vectorEffect="non-scaling-stroke" className="stroke-(--cover-art)" />
    </svg>
  );
  return (
    <figure>
      <div className="space-y-6">
        <div><p className={`${LABEL} mb-2 opacity-60`}>같은 1초 · 33⅓ RPM</p>{strip(a, groove(1, 0))}</div>
        <div><p className={`${LABEL} mb-2 ${ACC}`}>같은 1초 · 45 RPM — 홈이 35% 더 길다</p>{strip(b, groove(1.35, 0))}</div>
      </div>
      <figcaption className={`${LABEL} mt-4 opacity-50`}>Fig. 03 — Same sound, more room</figcaption>
    </figure>
  );
}

export default function Story() {
  // 02 크기: 저절로 12 → 10 → 7 을 돌다가, 누르면 멈춤
  const [size, setSize] = useState("12");
  const auto = useRef(true);
  useEffect(() => {
    const id = setInterval(() => { if (auto.current) setSize((s) => SIZES[(SIZES.findIndex((x) => x.v === s) + 1) % 3].v); }, 2600);
    return () => clearInterval(id);
  }, []);
  const pick = (v) => { auto.current = false; setSize(v); };
  // 03 속도: 기본 4배 느리게, 버튼으로 실제 속도
  const [real, setReal] = useState(false);

  return (
    <div className={`${KR} overflow-x-clip text-(--ink) [word-break:keep-all]`}>
      <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;900&display=swap" />

      {/* ── 히어로 ── */}
      <section aria-label="The Vinyl Dictionary" className={`flex min-h-svh items-center ${PADX} pb-[6svh] pt-[calc(var(--ct-header-h,106px)+60px)]`}>
        <div className={`${WRAP} grid items-center gap-10 md:grid-cols-2`}>
          <div>
            <Reveal as="p" className={`${LABEL} ${ACC}`}>Vinyl A to Z · Chapter 02</Reveal>
            <RiseText as="h1" lines={["The Vinyl", "Dictionary"]} delay={120} className={`${BODONI} mt-5 text-[clamp(3.4rem,7.6vw,8.2rem)] leading-[0.86] tracking-[-0.035em]`} />
            <Reveal as="p" delay={400} className="mt-7 text-[clamp(1.15rem,1.6vw,1.4rem)] font-semibold">바이닐을 이해하기 위한 기본 용어</Reveal>
            <Reveal as="p" delay={480} className={`${BODY} mt-5 max-w-[34rem] opacity-85`}>
              Chapter 01에서 바이닐이 무엇이고 어떻게 소리를 저장하고 재생하는지 살펴봤다면, Chapter 02에서는 레코드를 고르고 재생할 때 가장 자주 만나는 세 가지를 정리한다. 세 가지는 서로 관련이 있지만 각각 다른 것을 가리킨다.
            </Reveal>
            {/* 세 갈래 바로가기 */}
            <Reveal as="nav" delay={560} aria-label="이 글의 세 갈래" className="mt-9 grid max-w-[34rem] grid-cols-3 border-t-[3px] border-(--ink)">
              {[["01", "형식", "LP · EP · Single", "formats"], ["02", "크기", "7 · 10 · 12인치", "sizes"], ["03", "속도", "33⅓ · 45 · 78", "rpm"]].map(([n, k, d, id], i) => (
                <a key={id} href={`#${id}`} className={`py-4 ${i < 2 ? "border-r border-(--ink)/15 pr-3" : ""} ${i ? "pl-3" : ""}`}>
                  <span className={`${BODONI} block text-[1.5rem] ${ACC}`}>{n}</span>
                  <span className="mt-1 block text-[15px] font-bold">{k}</span>
                  <span className="block text-[13px] opacity-70">{d}</span>
                </a>
              ))}
            </Reveal>
          </div>
          {/* 크기가 다른 판 세 장이 겹쳐 천천히 돎 */}
          <div className="relative mx-auto aspect-square w-full max-w-[540px]" aria-hidden="true">
            <Disc className="absolute left-0 top-0 w-full animate-spin [animation-duration:40s] motion-reduce:animate-none" />
            <Disc className="absolute -bottom-[10%] -right-[8%] w-[83%] animate-spin opacity-90 [animation-duration:28s] motion-reduce:animate-none" />
            <Disc className="absolute -bottom-[16%] -left-[12%] w-[58%] animate-spin opacity-80 [animation-duration:18s] motion-reduce:animate-none" />
          </div>
        </div>
      </section>

      {/* ── 01 형식 ── */}
      <section id="formats" aria-label="01 음반의 형식" className={`${SECTION} scroll-mt-[var(--ct-header-h,106px)]`}>
        <div className={WRAP}>
          <Reveal as="p" className={`${LABEL} ${ACC}`}>01 — Record Formats · 음반의 형식</Reveal>
          <Reveal as="h2" delay={80} className={`${H2} mt-5`}>LP, EP, Single.</Reveal>
          <Reveal as="p" delay={160} className={`${BODY} mt-6 max-w-[40rem] opacity-85`}>판 위의 홈은 곡과 곡 사이에 작은 틈을 두고 이어진다. 그래서 레코드를 비스듬히 보면 곡의 수만큼 띠가 보인다.</Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FORMATS.map((f, i) => (
              <Reveal as="article" key={f.name} delay={i * 120} className={`${SOFT} p-7`}>
                <Tracks n={f.n} k={f.k} label={f.alt} />
                <p className={`${BODONI} mt-6 text-[3.2rem] leading-none`}>{f.name}</p>
                <p className={`${LABEL} mt-2 opacity-60`}>{f.sub}</p>
                <p className="mt-4 text-[16px] font-medium leading-[1.85]">{f.text}</p>
                <p className={`${LABEL} mt-5 ${ACC}`}>{f.spec}</p>
              </Reveal>
            ))}
          </div>
          <Reveal as="blockquote" className="mt-14 max-w-[46rem] border-l-[3px] border-(--accent) pl-6 text-[clamp(1.3rem,2.2vw,1.9rem)] font-black leading-[1.5]">
            LP · EP · Single은 레코드의 크기가 아니라 음악을 <span className={ACC}>어떤 규모로 발매하는지</span>를 나타내는 말이다. 그래서 12인치 싱글, 10인치 EP처럼 다양한 조합이 있다.
          </Reveal>
        </div>
      </section>

      {/* ── 02 크기 ── */}
      <section id="sizes" aria-label="02 레코드의 크기" className={`${SECTION} scroll-mt-[var(--ct-header-h,106px)]`}>
        <div className={`${WRAP} grid items-center gap-12 md:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] md:gap-16`}>
          {/* 실제 비율(7:10:12)로 겹친 판 — 고른 크기만 진하게 + 지름 점선 */}
          <Reveal as="figure" className="max-md:order-2">
            <div className="relative mx-auto aspect-square w-[min(100%,540px)]">
              {SIZES.map((s) => (
                <Disc key={s.v} backed={s.v !== "12"} label={s.v === size ? `${s.v}인치 레코드` : undefined}
                  className="absolute inset-0 m-auto transition-opacity duration-500" style={{ width: `${s.w}%`, opacity: s.v === size ? 1 : 0.22 }} />
              ))}
              <span aria-hidden="true" className="absolute inset-x-0 top-1/2 mx-auto block h-0 border-t-2 border-dashed border-(--accent) transition-[width] duration-500"
                style={{ width: `${SIZES.find((s) => s.v === size).w}%` }} />
            </div>
            <figcaption className={`${LABEL} mt-4 text-center opacity-50`}>Fig. 02 — Drawn to scale</figcaption>
          </Reveal>
          <div>
            <Reveal as="p" className={`${LABEL} ${ACC}`}>02 — Record Sizes · 레코드의 크기</Reveal>
            <Reveal as="h2" delay={80} className={`${H2} mt-5`}>7, 10, 12.</Reveal>
            <Reveal as="p" delay={160} className={`${BODY} mt-6 opacity-85`}>레코드의 크기는 지름을 인치(inch)로 나타낸다. 레코드가 클수록 홈을 새길 수 있는 면적이 넓어 더 많은 음악을 담을 수 있다. 다만 실제 수록 시간은 회전 속도와 홈 사이의 간격에 따라서도 달라진다.</Reveal>
            <Reveal delay={220} role="tablist" aria-label="레코드 크기" className="mt-8 border-t-[3px] border-(--ink)">
              {SIZES.map((s) => (
                <button key={s.v} type="button" role="tab" aria-selected={s.v === size} onClick={() => pick(s.v)}
                  className="grid min-h-11 w-full cursor-pointer grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-4 border-b border-(--ink)/15 py-4 text-left opacity-40 transition-opacity hover:opacity-70 aria-selected:opacity-100">
                  <span className={`${BODONI} text-[2.4rem] leading-none`}>{s.v}″</span>
                  <span><b className="block text-[16px]">{s.cm}</b><span className="text-[15px] opacity-80">{s.use}</span></span>
                </button>
              ))}
            </Reveal>
            {/* 팁: 45 어댑터 */}
            <Reveal as="aside" delay={280} className={`${SOFT} mt-8 flex items-center gap-5 p-5`}>
              <span aria-hidden="true" className="relative w-20 shrink-0">
                <Disc className="block w-full" />
                <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
                <circle cx="50" cy="50" r="15" className="fill-(--cover-bg)" />
                <g className="origin-center animate-spin [animation-duration:5.3s] [transform-box:fill-box] motion-reduce:animate-none">
                  <circle cx="50" cy="50" r="14" fill="none" strokeWidth="3" className="stroke-(--accent)" />
                  <path d="M50 36v28M36 50h28" strokeWidth="3" className="stroke-(--accent)" />
                </g>
                </svg>
              </span>
              <p className="text-[15px] font-medium leading-[1.8]"><b className={`${LABEL} ${ACC} block pb-1`}>Tip</b>7인치 싱글 중에는 가운데 구멍이 큰 음반이 있다. 이때는 턴테이블 축에 끼우는 <b>45 어댑터</b>가 필요하다.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 03 속도 ── */}
      <section id="rpm" aria-label="03 레코드의 회전 속도" className={`${SECTION} scroll-mt-[var(--ct-header-h,106px)]`}>
        <div className={WRAP}>
          <Reveal as="p" className={`${LABEL} ${ACC}`}>03 — RPM · 레코드의 회전 속도</Reveal>
          <Reveal delay={80} className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <h2 className={H2}>33⅓, 45, 78.</h2>
            <button type="button" aria-pressed={real} onClick={() => setReal((v) => !v)}
              className={`${LABEL} min-h-11 cursor-pointer rounded-full border-2 border-(--ink) px-5 transition-colors aria-pressed:bg-(--ink) aria-pressed:text-(--cream)`}>
              {real ? "천천히 보기" : "실제 속도로 보기"}
            </button>
          </Reveal>
          <Reveal as="p" delay={160} className={`${BODY} mt-6 max-w-[40rem] opacity-85`}>RPM(Revolutions Per Minute)은 레코드가 1분 동안 몇 바퀴 도는지를 나타낸다. 세 판은 서로의 속도 비율 그대로 돈다.</Reveal>
          <div className="mt-12 grid grid-cols-3 gap-[clamp(12px,3vw,48px)]" style={{ "--slow": real ? 1 : 4 }}>
            {SPEEDS.map((s, i) => (
              <Reveal as="figure" key={s.rpm} delay={i * 120} className="text-center">
                <Disc label={`${s.rpm} RPM 으로 도는 레코드`} className="mx-auto w-full max-w-[300px] animate-spin motion-reduce:animate-none"
                  style={{ animationDuration: `calc(${s.rev}s * var(--slow))` }} />
                <p className={`${BODONI} mt-5 text-[clamp(2.2rem,5vw,4rem)] leading-none`}>{s.rpm}</p>
                <p className="mt-3 text-[clamp(13px,1.3vw,16px)] font-bold">{s.use}</p>
              </Reveal>
            ))}
          </div>

          <div className="mt-20 grid items-center gap-10 md:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] md:gap-16">
            <div>
              <Reveal as="h3" className={`${BODONI} text-[clamp(2rem,3.6vw,3.4rem)] leading-[0.95] tracking-[-0.02em]`}>Faster spins,<br />finer grooves.</Reveal>
              <Reveal as="p" delay={100} className={`${BODY} mt-6 opacity-85`}>빠르게 돌수록 같은 시간 동안 바늘이 지나가는 홈이 길어져 소리를 더 세밀하게 담을 수 있지만, 한 면에 담을 수 있는 시간은 줄어든다. 그래서 음질을 중시하는 일부 LP는 <b>45 RPM</b>으로 만든다.</Reveal>
            </div>
            <Reveal delay={160}><GrooveCompare /></Reveal>
          </div>

          <Reveal as="aside" className={`${SOFT} mt-16 grid gap-3 p-7 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center`}>
            <p className={`${BODONI} text-[2.6rem] leading-none ${ACC}`}>78</p>
            <p className="text-[16px] font-medium leading-[1.85]">같은 크기의 레코드라도 회전 속도가 다를 수 있으므로, 라벨이나 재킷에 표시된 속도에 맞춰 재생해야 한다. 78 RPM 음반은 바이닐이 아닌 <b>셸락</b>으로 만들어져 전용 바늘이 필요하고, 요즘 턴테이블 상당수는 78 RPM을 지원하지 않는다.</p>
          </Reveal>
        </div>
      </section>

      {/* ── 04 용어 (사전) ── */}
      <section aria-label="04 알아두면 좋은 용어" className={SECTION}>
        <div className={WRAP}>
          <Reveal as="p" className={`${LABEL} ${ACC}`}>04 — 알아두면 좋은 용어</Reveal>
          <Reveal as="h2" delay={80} className={`${H2} mt-5`}>More words.</Reveal>
          <dl className="mt-12 grid border-t-[3px] border-(--ink) md:grid-cols-2 md:gap-x-16">
            {TERMS.map(([t, pos, d], i) => (
              <Reveal key={t} delay={(i % 2) * 100} className="border-b border-(--ink)/15 py-7">
                <dt className="flex items-baseline gap-3"><span className={`${BODONI} text-[2rem] leading-none`}>{t}</span><i className="text-[15px] opacity-55">{pos}</i></dt>
                <dd className="mt-3 text-[16px] font-medium leading-[1.85]">{d}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 마무리 ── */}
      <section aria-label="정리" className={`${PADX} pb-[clamp(72px,12svh,140px)] pt-[clamp(48px,8svh,96px)] text-center`}>
        <Reveal as="p" className={`${BODONI} mx-auto max-w-[60rem] text-[clamp(2.2rem,5.4vw,5rem)] leading-[1.05] tracking-[-0.03em]`}>
          <span className={ACC}>Format</span>, <span className={ACC}>size</span> and <span className={ACC}>speed</span> are three different things.
        </Reveal>
        <Reveal as="p" delay={100} className="mx-auto mt-8 max-w-[38rem] text-[clamp(1.05rem,1.35vw,1.25rem)] font-semibold leading-[1.9]">
          LP · EP · Single은 형식, 7 · 10 · 12인치는 크기, 33⅓ · 45 · 78은 속도. 세 가지를 구분하면 음반 정보가 한눈에 읽힌다.
        </Reveal>
        <Reveal delay={160} className="mx-auto mt-16 max-w-[34rem] border-t-[3px] border-(--ink) pt-6">
          <p className={`${LABEL} opacity-55`}>Next — Chapter 03</p>
          <p className={`${BODONI} mt-3 text-[clamp(1.8rem,3vw,2.6rem)]`}>Inside the Record</p>
          <p className="mt-3 text-[15px] font-medium leading-[1.8] opacity-80">레코드를 가까이 들여다보며 Groove, Label, Run-in, Run-out 등 각 부분의 이름과 역할을 알아본다.</p>
          <p className={`${LABEL} mt-4 opacity-55`}>Coming soon</p>
        </Reveal>
      </section>
    </div>
  );
}
