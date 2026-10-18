"use client";
// Picks — "Records for an Autumn Evening"
// 1 히어로(떨어지는 낙엽) → 2 일곱 장 (스크롤하면 슬리브에서 판이 빠져나오며 돎) → 3 한 장짜리 믹스테이프(A/B면) → 4 마무리
// 슬리브는 실제 앨범 커버 대신 글자로 만든 그림 (저작권 이미지 사용 안 함)
import { useRef } from "react";
import Link from "next/link";
import Reveal, { RiseText } from "@/components/story/Reveal";
import { seg, useScrollProgress } from "@/components/story/scroll";
import RequestDialog from "@/components/requests/RequestDialog";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";

const PICKS = [
  {
    time: "5:40 pm", artist: "Bill Evans Trio", album: "Portrait in Jazz", year: 1960, label: "Riverside",
    song: "Autumn Leaves", color: "#c8553d", ink: "#f4e7cd",
    text: "The obvious first pick, and still the right one. Evans, Scott LaFaro and Paul Motian play it less like a piano tune with a rhythm section and more like a three-way conversation.",
    listen: "LaFaro’s bass answering the piano instead of just walking under it.",
  },
  {
    time: "6:15 pm", artist: "Chet Baker", album: "Chet Baker Sings", year: 1954, label: "Pacific Jazz",
    song: "My Funny Valentine", color: "#e3b04b", ink: "#2a222a",
    text: "A voice so soft it sounds like it’s been left out in the cold. Put it on when the sun drops behind the buildings and the room goes blue.",
    listen: "How close the microphone is — every breath is part of the song.",
  },
  {
    time: "7:00 pm", artist: "Nick Drake", album: "Pink Moon", year: 1972, label: "Island",
    song: "Pink Moon", color: "#d9a3a0", ink: "#2a222a",
    text: "Under half an hour long and almost nothing on it — one voice, one guitar. It feels like a walk home on a short day.",
    listen: "The single piano part on the title track, the only overdub on the record.",
  },
  {
    time: "8:20 pm", artist: "Joni Mitchell", album: "Blue", year: 1971, label: "Reprise",
    song: "A Case of You", color: "#4f6d93", ink: "#f4e7cd",
    text: "Some records are warm. This one is honest, which in October feels like the same thing.",
    listen: "Joni’s Appalachian dulcimer, bright and plucky against James Taylor’s guitar.",
  },
  {
    time: "9:10 pm", artist: "Lee Moon-sae", album: "Lee Moon-sae 4", year: 1987, label: "",
    song: "When Autumn Comes (가을이 오면)", color: "#8a5a3c", ink: "#f4e7cd",
    text: "Written by Lee Young-hoon, whose songs defined the sound of Seoul in the late eighties. If Korea has an autumn anthem, it’s on this record.",
    listen: "The strings that swell in before the chorus, like wind through ginkgo trees.",
  },
  {
    time: "10:30 pm", artist: "Norah Jones", album: "Come Away with Me", year: 2002, label: "Blue Note",
    song: "Don’t Know Why", color: "#bbcbda", ink: "#2a222a",
    text: "Blanket music. A jazz label, a country heart, and a song by Jesse Harris that quietly won Record of the Year.",
    listen: "The piano left hand — unhurried, like it has nowhere else to be.",
  },
  {
    time: "11:50 pm", artist: "Bon Iver", album: "For Emma, Forever Ago", year: 2007, label: "",
    song: "Skinny Love", color: "#2a222a", ink: "#f4e7cd",
    text: "Recorded alone in a hunting cabin in Wisconsin. The last record of the night, for when autumn starts to feel like winter.",
    listen: "The hard, stamping strum — and the room you can hear around it.",
  },
];

// 결정적인 의사난수 (서버/클라이언트 같은 값 → 하이드레이션 어긋남 없음)
const rand = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const LEAF_COLORS = ["#c8553d", "#e3b04b", "#8a5a3c", "#d9793d", "#b4442f"];
function Leaves({ count = 16 }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {Array.from({ length: count }, (_, i) => {
        const size = 18 + rand(i, 2) * 30;
        return (
          <svg key={i} viewBox="0 0 40 40" className="absolute top-0 animate-[leaf-fall_linear_infinite]"
            style={{
              left: `${rand(i, 1) * 100}%`, width: size, height: size,
              animationDuration: `${11 + rand(i, 3) * 10}s`, animationDelay: `${-rand(i, 4) * 20}s`,
              "--drift": `${(rand(i, 5) - 0.3) * 22}vw`, "--turn": `${(rand(i, 6) > 0.5 ? 1 : -1) * (300 + rand(i, 7) * 400)}deg`,
              opacity: 0.55 + rand(i, 8) * 0.4,
            }}>
            {/* 단풍잎 */}
            {i % 2
              ? <path fill={LEAF_COLORS[i % LEAF_COLORS.length]} d="M20 2l3 8 6-4-1 8 8-1-5 6 7 3-8 3 3 7-8-3-2 7-3-6-3 6-2-7-8 3 3-7-8-3 7-3-5-6 8 1-1-8 6 4z" />
              : <path fill={LEAF_COLORS[i % LEAF_COLORS.length]} d="M20 3C31 10 33 24 20 34C7 24 9 10 20 3Z" />}
            <path d="M20 38V14" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
          </svg>
        );
      })}
    </div>
  );
}

// 판 (홈 + 라벨)
function Disc({ label, className = "", style }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <circle cx="100" cy="100" r="99" fill="#1b1619" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx="100" cy="100" r={94 - i * 3.6} fill="none" stroke="#f4e7cd" strokeWidth=".6" opacity={i % 5 === 2 ? 0.05 : 0.14} />
      ))}
      <path d="M100 6a94 94 0 0 1 80 46" fill="none" stroke="#fff" strokeWidth="10" opacity=".05" />
      <circle cx="100" cy="100" r="31" fill={label} />
      <circle cx="100" cy="100" r="3" fill="#1b1619" />
    </svg>
  );
}

// 글자로 만든 슬리브
function Sleeve({ pick, n }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between overflow-hidden rounded-[3px] p-[7%] shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)]"
      style={{ backgroundColor: pick.color, color: pick.ink }}>
      <svg viewBox="0 0 100 100" className="absolute -right-[18%] -top-[18%] w-[70%] opacity-20" aria-hidden="true">
        {[48, 40, 32, 24, 16].map((r) => <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="1.2" />)}
      </svg>
      <p className="relative text-[11px] font-medium uppercase tracking-[0.28em] opacity-80">{pick.artist}</p>
      <div className="relative">
        <p className={`${SERIF} text-[clamp(4rem,9vw,8rem)] leading-[0.8] opacity-90`}>{String(n).padStart(2, "0")}</p>
        <p className={`${SERIF} mt-3 text-[clamp(1.5rem,2.6vw,2.3rem)] leading-[0.95]`}>{pick.album}</p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.24em] opacity-70 tabular-nums">{pick.year}{pick.label ? ` · ${pick.label}` : ""}</p>
      </div>
    </div>
  );
}

function Pick({ pick, i, onRequest }) {
  const ref = useRef(null);
  useScrollProgress(ref, { mode: "pass" });
  const flip = i % 2 === 1;
  const dir = flip ? -1 : 1;
  const q = encodeURIComponent(`${pick.artist} ${pick.song.replace(/\s*\(.*\)$/, "")}`);
  return (
    <li ref={ref} style={{ "--p": 0 }} className={`${WRAP} grid items-center gap-[clamp(2.5rem,6vw,6rem)] py-[clamp(4rem,10vw,8rem)] md:grid-cols-2`}>
      {/* 슬리브 + 빠져나오는 판 */}
      <div className={`relative mx-auto aspect-square w-[min(68vw,440px)] ${flip ? "md:order-2 md:mr-0" : "md:ml-0"}`}>
        <div className="absolute inset-[3%] will-change-transform"
          style={{ transform: `translateX(calc(${seg(0.12, 0.42)} * ${dir * 34}%)) rotate(calc(var(--p) * ${dir * 420}deg))` }}>
          <Disc label={pick.color} className="size-full" />
        </div>
        <Sleeve pick={pick} n={i + 1} />
      </div>

      <Reveal className={flip ? "md:order-1" : ""}>
        <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-(--accent) tabular-nums">
          <span className={`${SERIF} text-[15px] tracking-normal`}>No. {String(i + 1).padStart(2, "0")}</span>
          <span className="h-px w-8 bg-current" />{pick.time}
        </p>
        <p className="mt-6 text-[13px] font-medium uppercase tracking-[0.22em] text-(--ink)/70">{pick.artist}</p>
        <h2 className={`${SERIF} mt-2 text-[clamp(2.6rem,5vw,4.8rem)] leading-[0.9]`}>{pick.album}</h2>
        <p className="mt-6 flex items-center gap-3 text-[15px]">
          <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
            {[0, 1, 2].map((b) => <span key={b} className="w-[3px] origin-bottom animate-eq bg-(--accent) motion-reduce:animate-none" style={{ height: "100%", animationDelay: `${b * -0.3}s` }} />)}
          </span>
          <span><span className="text-(--ink)/60">Play</span> <span className="font-medium">“{pick.song}”</span></span>
        </p>
        <p className="mt-5 max-w-[46ch] text-[16px] leading-8 text-(--ink)/85">{pick.text}</p>
        <p className="mt-5 max-w-[46ch] border-l-2 border-(--accent) pl-4 text-[14px] leading-7 text-(--ink)/70">
          <span className="font-medium uppercase tracking-[0.18em] text-[11px] text-(--ink)">Listen for · </span>{pick.listen}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
            Hear it <span aria-hidden="true">↗︎</span>
          </a>
          <button type="button" onClick={() => onRequest(pick)}
            className="inline-flex min-h-11 items-center rounded-full border border-(--ink)/40 px-6 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--ink) hover:bg-(--ink)/5">
            Request on Grooves
          </button>
        </div>
      </Reveal>
    </li>
  );
}

function Mixtape() {
  const sides = [["A", PICKS.slice(0, 4)], ["B", PICKS.slice(4)]];
  return (
    <section className={`${WRAP} py-[clamp(4rem,10vw,8rem)]`}>
      <Reveal className="mx-auto max-w-[920px] rounded-[4px] border-[3px] border-(--ink) p-[clamp(1.5rem,4vw,3rem)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-(--ink) pb-5">
          <p className={`${SERIF} text-[clamp(2.2rem,5vw,4rem)] leading-[0.9]`}>The autumn tape</p>
          <p className="text-[11px] uppercase tracking-[0.26em] text-(--ink)/60">One song from each · in order</p>
        </div>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          {sides.map(([side, list], s) => (
            <ol key={side} start={s * 4 + 1}>
              <li className="mb-3 text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Side {side}</li>
              {list.map((p, j) => (
                <li key={p.song} className="flex items-baseline gap-4 border-b border-(--ink)/15 py-3">
                  <span className="w-6 shrink-0 text-[12px] tabular-nums text-(--ink)/50">{side}{j + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{p.song}</span>
                    <span className="block truncate text-[13px] text-(--ink)/60">{p.artist}</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-(--ink)/45">{p.time}</span>
                </li>
              ))}
            </ol>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default function Story() {
  const request = useRef(null);
  const onRequest = (p) => request.current?.open({ title: p.album, artist: p.artist, releaseYear: p.year });
  return (
    <>
      {/* 1 히어로 */}
      <section className="relative grid min-h-svh place-items-center overflow-hidden pb-16 pt-[calc(var(--ct-header-h,106px)+80px)]">
        <Leaves />
        <div className={`${WRAP} relative text-center`}>
          <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Picks · Autumn 2026</Reveal>
          <RiseText as="h1" lines={["Records for an", "autumn evening"]} delay={120} className={`${SERIF} mt-6 text-[clamp(2.9rem,10vw,10rem)] leading-[0.86]`} />
          <Reveal delay={500} as="p" className="mx-auto mt-8 max-w-xl text-[17px] leading-8 text-(--ink)/80">
            Seven albums — and the one song from each — for the hours between golden light and lights out. Start at sunset, flip the last one near midnight.
          </Reveal>
          <Reveal delay={700} as="p" className="mt-12 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] opacity-60">
            <span className="h-10 w-px animate-[scroll-cue_1.8s_ease-in-out_infinite] bg-current motion-reduce:animate-none" />Scroll
          </Reveal>
        </div>
      </section>

      {/* 2 일곱 장 */}
      <ol className="overflow-x-clip">
        {PICKS.map((pick, i) => <Pick key={pick.album} pick={pick} i={i} onRequest={onRequest} />)}
      </ol>

      {/* 3 믹스테이프 */}
      <Mixtape />

      {/* 4 마무리 */}
      <section className={`${WRAP} pb-10 pt-[clamp(2rem,6vw,4rem)] text-center`}>
        <RiseText lines={["Got one we missed?"]} className={`${SERIF} text-[clamp(2.4rem,5.5vw,5.4rem)] leading-[0.92]`} />
        <Reveal delay={250} as="p" className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-(--ink)/75">Tell us the record that sounds like autumn to you — we might add it to the crates.</Reveal>
        <Reveal delay={400} className="mt-9 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => request.current?.open()} className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--cream) transition-colors hover:bg-(--accent)">Request a record</button>
          <Link href="/digging" className="inline-flex min-h-12 items-center rounded-full border border-(--ink)/40 px-8 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors hover:border-(--ink)">Start digging</Link>
        </Reveal>
      </section>
      <RequestDialog ref={request} />
    </>
  );
}
