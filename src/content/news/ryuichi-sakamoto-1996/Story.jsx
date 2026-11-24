"use client";
// News — "Ryuichi Sakamoto, 1996" (30주년 2LP 재발매)
// 1 히어로(실제 커버 + 빠져나오는 판) → 2 발매 정보 → 3 아티스트(소개 · 연표 · 영화 작업) → 4 앨범(트리오 · 먼저 들을 곡 · 대표곡 셋 · A–D면)
// → 5 Grooves 컬렉션 · 출처
// 영화 스틸·포스터는 쓰지 않음(저작권) — 장면은 글로 설명하고 그림은 사이트 톤의 SVG 로
// 사실 정보: 판매 공지(인스타그램, 2026-11), Milan Records 30주년 2LP 소개, 원반 크레딧(Wikipedia · 2026-11-22 확인)
import { MONOTON } from "@/lib/fonts";
import { useRef } from "react";
import Link from "next/link";
import Reveal, { RiseText } from "@/components/story/Reveal";
import Disc from "@/components/story/Disc";
import { seg, useScrollProgress } from "@/components/story/scroll";
import { ALBUM_SLUG, coverOf, useSakamoto } from "./album";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const SECTION = `${WRAP} py-[clamp(4rem,10vw,8rem)]`;
const LABEL = "text-[11px] font-medium uppercase tracking-[0.3em]";
const NOTICE = "https://www.instagram.com/p/Dfg9-GDTj8w/";
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const PILL = "inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors";
const MINT = "#7fc1bd";   // 잉크 바탕 위 강조색

function Head({ n, label, lines, dark, children }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:items-end">
      <div>
        <Reveal as="p" className={`${LABEL} tabular-nums ${dark ? "text-[#7fc1bd]" : "text-(--accent)"}`}>{n} — {label}</Reveal>
        <RiseText lines={lines} className={`${SERIF} mt-4 text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[0.9]`} />
      </div>
      {children && <Reveal delay={200} as="p" className={`max-w-[48ch] break-keep text-[15px] leading-7 md:pb-2 ${dark ? "text-(--cream)/75" : "text-(--ink)/75"}`}>{children}</Reveal>}
    </div>
  );
}

/* ───────────── 1 히어로 ───────────── */
// 커버(DB) 뒤에서 판이 오른쪽으로 반쯤 빠져나와 천천히 돎. 커버를 못 찾으면 판만
function Sleeve({ row, loading }) {
  const ref = useRef(null);
  useScrollProgress(ref, { mode: "pass" });
  const src = coverOf(row);
  return (
    <div ref={ref} style={{ "--p": 0 }} className="relative mx-auto aspect-square w-[min(66vw,460px)] lg:mr-[18%]">
      <div className="absolute inset-[3%] will-change-transform" style={{ transform: `translateX(calc((${src ? `0.22 + ${seg(0, 0.5)} * 0.1` : "0"}) * 100%))` }}>
        <Disc label="#e9e4da" className="size-full animate-spin [animation-duration:18s] motion-reduce:animate-none" />
      </div>
      {src ? (
        <Link href={`/album/${row.slug}`} aria-label="1996 — Grooves에서 보기"
          className="absolute inset-0 z-10 overflow-hidden rounded-[3px] shadow-[0_34px_70px_-30px_rgba(0,0,0,.65)]" style={{ background: row.cover_color || "#181818" }}>
          <img src={src} alt="Ryuichi Sakamoto — 1996" loading="eager" decoding="async" draggable={false} className="size-full select-none object-cover" />
        </Link>
      ) : loading ? <div className="absolute inset-0 z-10 rounded-[3px] bg-(--ink)/8" /> : null}
    </div>
  );
}

function Hero({ row, loading }) {
  return (
    <section className="relative overflow-hidden pb-[clamp(3rem,8vw,6rem)] pt-[calc(var(--ct-header-h,106px)+56px)]">
      <div className={`${WRAP} grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)]`}>
        <div>
          <Reveal as="p" className={`${LABEL} text-(--accent)`}>News · Reissue · 30th Anniversary</Reveal>
          <RiseText as="h1" lines={["Ryuichi", "Sakamoto,", "1996"]} delay={120} className={`${MONOTON} mt-5 text-[clamp(2.4rem,5.6vw,5.6rem)] leading-[1.04]`} />
          <Reveal delay={450} as="p" className="mt-7 max-w-[44ch] break-keep text-[clamp(1rem,1.4vw,1.2rem)] leading-8 text-(--ink)/80">
            류이치 사카모토가 자신의 영화음악을 피아노·첼로·바이올린 트리오로 다시 연주한 <i>1996</i>이 30주년을 맞아 2LP로 다시 나와요. 일본 밖에서 이 앨범이 바이닐로 나오는 건 처음이에요.
          </Reveal>
          <Reveal delay={600} as="p" className="mt-7 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-y-[3px] border-(--ink) py-2 text-[13px] font-semibold">
            <span>57,500원</span><span className="h-px w-5 bg-(--ink)/40" /><span>12월 중순 발매</span><span className="h-px w-5 bg-(--ink)/40" /><span>2LP</span>
          </Reveal>
        </div>
        <Reveal delay={300}><Sleeve row={row} loading={loading} /></Reveal>
      </div>
    </section>
  );
}

/* ───────────── 2 발매 정보 ───────────── */
function Row({ k, children }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-4 border-b border-dashed border-(--ink)/25 py-4 sm:grid-cols-[140px_1fr]">
      <dt className="pt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/55">{k}</dt>
      <dd className="break-keep text-[16px] leading-7">{children}</dd>
    </div>
  );
}
const WHY = [
  ["First on vinyl", "일본 밖에서 처음 나오는 LP. 1996년 일본 한정 2LP는 지금 중고로만, 비싼 값에 거래돼요."],
  ["Remastered", "바이닐에 맞게 새로 리마스터했어요."],
  ["Original design", "1996년의 커버와 디자인을 그대로 살렸어요."],
];
function Release({ row }) {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="01" label="Release" lines={["On sale", "now"]}>
        지금 예약 판매 중이고, 판은 12월 중순 발매 뒤에 도착해요. 재고가 떨어지면 판매가 끝나요.
      </Head>
      <Reveal className="mt-12 grid overflow-hidden rounded-[6px] border-[3px] border-(--ink) md:grid-cols-[1fr_280px]">
        <dl className="p-[clamp(1.25rem,3vw,2.5rem)]">
          <Row k="가격">57,500원</Row>
          <Row k="판매 기간">2026년 11월 9일부터 재고 소진 시까지</Row>
          <Row k="배송">2026년 12월 중순 발매 이후 순차 배송</Row>
          <Row k="구성">2LP · 33⅓ RPM · 16곡</Row>
          <Row k="레이블">Milan Records · 30th Anniversary Edition</Row>
        </dl>
        <div className="flex flex-col justify-between gap-6 border-t-[3px] border-dashed border-(--ink) bg-(--ink) p-[clamp(1.25rem,3vw,2rem)] text-(--cream) md:border-l-[3px] md:border-t-0">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">30th Anniversary</p>
            <p className={`${SERIF} mt-3 text-[64px] leading-[0.85]`}>1996<br /><span className="text-[28px]">→ 2026</span></p>
          </div>
          <div className="grid gap-2">
            <a href={NOTICE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between rounded-full border border-(--cream)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--cream) hover:text-(--ink)">판매 공지 보기 <span aria-hidden="true">↗︎</span></a>
            {row && <Link href={`/album/${row.slug}`} className="inline-flex min-h-11 items-center justify-between rounded-full border border-(--cream)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--cream) hover:text-(--ink)">Grooves에서 보기 <span aria-hidden="true">→</span></Link>}
          </div>
        </div>
      </Reveal>
      <ul className="mt-8 grid gap-6 md:grid-cols-3">
        {WHY.map(([k, t], i) => (
          <Reveal as="li" key={k} delay={i * 120} className="border-l-2 border-(--accent) pl-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em]">{k}</p>
            <p className="mt-1 break-keep text-[14px] leading-7 text-(--ink)/70">{t}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/* ───────────── 3 아티스트 ───────────── */
const LIFE = [
  ["1952", "1월 17일 도쿄에서 태어나요. 도쿄예술대학에서 작곡을 공부해요."],
  ["1978", "호소노 하루오미, 다카하시 유키히로와 Yellow Magic Orchestra(YMO) 결성. 같은 해 첫 솔로 앨범 Thousand Knives."],
  ["1983", "전장의 크리스마스로 첫 영화음악을 맡고, 배우로도 출연해요."],
  ["1988", "마지막 황제로 아카데미 음악상. 이후 뉴욕으로 옮겨 오래 활동해요."],
  ["2014", "인후암 진단. 치료를 마치고 레버넌트(2015)와 async(2017)로 돌아와요."],
  ["2023", "1월, 마지막 앨범 12. 직장암 투병 끝에 3월 28일, 일흔한 살로 세상을 떠나요.", true],
];
// 영화 작업. on: 1996 에 실린 곡
const FILMS = [
  ["1983", "전장의 크리스마스", "오시마 나기사", "음악과 함께 요노이 대위 역으로 출연. 데이비드 보위와 함께.", "B2"],
  ["1987", "마지막 황제", "베르나르도 베르톨루치", "데이비드 번, 쑹충과 함께 아카데미 음악상.", "A2 · A4"],
  ["1990", "The Sheltering Sky", "베르나르도 베르톨루치", "골든글로브 음악상.", "B4"],
  ["1991", "하이힐", "페드로 알모도바르", "알모도바르의 멜로드라마.", "C2"],
  ["1992", "폭풍의 언덕", "피터 코스민스키", "에밀리 브론테 원작.", "C4"],
  ["1993", "리틀 부다", "베르나르도 베르톨루치", "베르톨루치와의 세 번째 작업.", "D2"],
  ["2006", "바벨", "알레한드로 곤살레스 이냐리투", "1995년 곡 Bibo no Aozora가 쓰였어요.", "A3"],
  ["2015", "레버넌트", "알레한드로 곤살레스 이냐리투", "투병 뒤 돌아와 맡은 영화음악.", null],
  ["2017", "남한산성", "황동혁", "그가 음악을 맡은 한국 영화.", null],
  ["2023", "괴물", "고레에다 히로카즈", "그의 마지막 영화음악.", null],
];
function Artist() {
  return (
    <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
      <div className={`${WRAP} py-[clamp(4rem,10vw,8rem)]`}>
        <Head n="02" label="The artist" lines={["Who was", "Sakamoto"]} dark>
          전자음악 밴드 YMO의 멤버로 시작해, 영화음악으로 세계에 이름을 알린 작곡가이자 피아니스트. 2023년 3월 세상을 떠났고, 그해 1월 낸 <i>12</i>가 마지막 앨범이 되었어요.
        </Head>

        <ol className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {LIFE.map(([y, t, hi], i) => (
            <Reveal as="li" key={y} delay={(i % 3) * 120} className={`grid grid-cols-[76px_1fr] gap-4 border-t py-5 ${hi ? "border-[#7fc1bd]" : "border-(--cream)/20"}`}>
              <span className={`${SERIF} text-[28px] leading-none tabular-nums ${hi ? "text-[#7fc1bd]" : ""}`}>{y}</span>
              <span className="break-keep text-[14px] leading-7 text-(--cream)/80">{t}</span>
            </Reveal>
          ))}
        </ol>

        <Reveal as="p" className={`${LABEL} mt-16 text-(--cream)/60`}>Film scores</Reveal>
        <ul className="mt-5 grid gap-px overflow-hidden rounded-[6px] border border-(--cream)/20 bg-(--cream)/20 sm:grid-cols-2 lg:grid-cols-5">
          {FILMS.map(([y, title, dir, note, on], i) => (
            <Reveal as="li" key={title} delay={(i % 5) * 80} className="flex flex-col bg-(--ink) p-5">
              <p className="flex items-center justify-between text-[12px] tabular-nums text-(--cream)/55">
                <span>{y}</span>
                {on && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-(--ink)" style={{ background: MINT }}>1996 · {on}</span>}
              </p>
              <p className={`${SERIF} mt-3 text-[22px] leading-[1.1]`}>{title}</p>
              <p className="mt-1 text-[12px] text-(--cream)/55">{dir}</p>
              <p className="mt-3 break-keep text-[13px] leading-6 text-(--cream)/75">{note}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── 4 앨범 ───────────── */
const TRIO = [
  ["Piano", "Ryuichi Sakamoto"],
  ["Cello", "Jaques Morelenbaum"],
  ["Violin", "Everton Nelson 외"],
];

// 장면 그림: 시네마스코프(2.39:1) 검은 프레임 안의 단순한 SVG — 영화 스틸 대신
const C = "#f4e7cd";
const MOTIF = {
  stars: (
    <g fill={C}>
      {Array.from({ length: 46 }, (_, i) => <circle key={i} cx={(i * 53) % 240} cy={6 + ((i * 37) % 70)} r={i % 7 === 0 ? 0.9 : 0.45} opacity={0.3 + (i % 4) * 0.15} />)}
      <path d="M172 26l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6z" className="origin-[172px_32px] animate-pulse" />
      <path d="M0 86 Q60 78 120 84 T240 80 V100 H0z" fill="#1d181b" />
    </g>
  ),
  rain: (
    <g stroke={C} strokeLinecap="round">
      <g className="animate-[rain_0.9s_linear_infinite] motion-reduce:animate-none">
        {Array.from({ length: 60 }, (_, i) => <line key={i} x1={(i * 41) % 250 - 5} y1={((i * 29) % 120) - 20} x2={(i * 41) % 250 - 9} y2={((i * 29) % 120) - 8} strokeWidth=".5" opacity={0.25 + (i % 3) * 0.15} />)}
      </g>
      <path d="M96 86v-16a7 7 0 0 1 14 0v16" fill="none" strokeWidth=".8" opacity=".7" />
      <circle cx="103" cy="60" r="4" fill="none" strokeWidth=".8" opacity=".7" />
    </g>
  ),
  dunes: (
    <g>
      <circle cx="168" cy="40" r="13" fill="#e3b04b" opacity=".9" />
      <path d="M0 72 Q50 54 100 70 T200 64 T240 68 V100 H0z" fill="#8a5a2b" />
      <path d="M0 84 Q70 70 130 84 T240 80 V100 H0z" fill="#5b3a1e" />
    </g>
  ),
};
function Frame({ motif, sub }) {
  return (
    <div className="relative overflow-hidden rounded-[3px] bg-[#141114] shadow-[0_30px_60px_-34px_rgba(0,0,0,.7)]">
      <svg viewBox="0 0 240 100" className="block h-auto w-full" aria-hidden="true">{MOTIF[motif]}</svg>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[7%] bg-black" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[7%] bg-black" />
      <p aria-hidden="true" className="absolute inset-x-0 bottom-[11%] text-center font-['Hahmlet',serif] text-[clamp(10px,1.2vw,14px)] font-semibold text-[#f6e9a8] [text-shadow:0_1px_2px_#000]">{sub}</p>
    </div>
  );
}

// 대표곡 셋 (영화 장면과 함께)
const KEY = [
  {
    motif: "stars", side: "B2", track: "Merry Christmas Mr. Lawrence", film: "전장의 크리스마스 · 1983", sub: "“Merry Christmas, Mr. Lawrence.”",
    scene: "처형을 앞둔 하라 상사(기타노 다케시)가 로렌스에게 웃으며 인사를 건네는 마지막 장면에 흐르는 주제.",
    listen: "반짝이던 신시사이저 대신 피아노가 멜로디를 쥐어요. 더 느리고, 더 쓸쓸해요.",
  },
  {
    motif: "rain", side: "A2", track: "Rain", film: "마지막 황제 · 1987", sub: "♪ Rain",
    scene: "후궁 원슈가 푸이에게 이혼을 선언하고 빗속으로 걸어 나가는 장면의 곡.",
    listen: "바이올린과 첼로가 빗줄기처럼 쉬지 않고 몰아쳐요. 앨범에서 가장 숨 가쁜 곡.",
  },
  {
    motif: "dunes", side: "B4", track: "The Sheltering Sky", film: "The Sheltering Sky · 1990", sub: "♪ The Sheltering Sky",
    scene: "지친 미국인 부부가 떠난 북아프리카 사막. 끝없는 모래 언덕과 넓은 하늘 위로 흐르는 주제.",
    listen: "첼로가 길게 끄는 첫 음부터 사막의 열기가 느껴져요.",
  },
];

// 30주년 2LP 면 구성 (해외 판매처 공개 목록 기준). [곡, 출처, 영화면 1]
const SIDES = [
  ["A", [["A Day a Gorilla Gives a Banana", "새로 쓴 곡"], ["Rain", "마지막 황제", 1], ["Bibo no Aozora", "1995 Smoochy · 바벨", 1], ["The Last Emperor", "마지막 황제", 1]]],
  ["B", [["1919", "새로 쓴 곡"], ["Merry Christmas Mr. Lawrence", "전장의 크리스마스", 1], ["M.A.Y. in the Backyard", "1984 음악도감"], ["The Sheltering Sky", "The Sheltering Sky", 1]]],
  ["C", [["A Tribute to N.J.P.", "1984 음악도감 · 백남준에게"], ["High Heels (Main Theme)", "하이힐", 1], ["Aoneko no Torso", "1995 Smoochy"], ["The Wuthering Heights", "폭풍의 언덕", 1]]],
  ["D", [["Parolibre", "1986 Futurista"], ["Acceptance – Little Buddha", "리틀 부다", 1], ["Before Long", "1987 Neo Geo"], ["Self Portrait", ""]]],
];

function Album() {
  const first = KEY[0];
  return (
    <section className={SECTION}>
      <Head n="03" label="The album" lines={["Three", "instruments"]}>
        <i>1996</i>은 영화를 위해 썼던 곡들을 피아노·첼로·바이올린 트리오로 다시 편곡한 앨범이에요. 큰 오케스트라가 빠지자 멜로디가 더 가깝게, 더 조용하게 들려요. 뉴욕에서 녹음했고, 새로 쓴 곡 두 곡도 함께 실렸어요.
      </Head>

      {/* 트리오 세 명 */}
      <Reveal as="ul" className="mt-12 grid grid-cols-3 border-y-[3px] border-(--ink)">
        {TRIO.map(([inst, who], i) => (
          <li key={inst} className={`py-5 ${i ? "border-l border-(--ink)/20 pl-[clamp(.75rem,2vw,1.5rem)]" : ""}`}>
            <p className={`${SERIF} text-[clamp(1.6rem,3vw,2.6rem)] leading-none`}>{inst}</p>
            <p className="mt-2 text-[13px] text-(--ink)/65">{who}</p>
          </li>
        ))}
      </Reveal>

      {/* 하나만 듣는다면 */}
      <Reveal className="mt-16 grid items-center gap-[clamp(2rem,5vw,4rem)] rounded-[6px] border-[3px] border-(--ink) p-[clamp(1.25rem,3vw,2.5rem)] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Frame motif={first.motif} sub={first.sub} />
        <div>
          <p className={`${LABEL} text-(--accent)`}>Listen first · {first.side}</p>
          <h3 className={`${SERIF} mt-3 text-[clamp(2rem,3.6vw,3.4rem)] leading-[0.95]`}>{first.track}</h3>
          <p className="mt-2 text-[13px] text-(--ink)/55">{first.film}</p>
          <p className="mt-5 max-w-[46ch] break-keep text-[15px] leading-7 text-(--ink)/80">
            하나만 듣는다면 이 곡. 사카모토를 가장 널리 알린 멜로디라, 원곡과 트리오 버전을 나란히 들어 보면 이 앨범이 무엇을 바꿨는지 바로 들려요.
          </p>
          <a href={yt("Ryuichi Sakamoto Merry Christmas Mr. Lawrence 1996")} target="_blank" rel="noreferrer" className={`${PILL} mt-6 bg-(--ink) text-(--cream) hover:bg-(--accent)`}>
            YouTube에서 듣기 <span aria-hidden="true">↗︎</span>
          </a>
        </div>
      </Reveal>

      {/* 대표곡 셋 */}
      <Reveal as="p" className={`${LABEL} mt-20 text-(--ink)/55`}>Scores &amp; scenes</Reveal>
      <ul className="mt-5 grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-12 md:grid-cols-2">
        {KEY.slice(1).map((k, i) => (
          <Reveal as="li" key={k.track} delay={i * 140}>
            <Frame motif={k.motif} sub={k.sub} />
            <p className={`${LABEL} mt-5 text-(--accent) tabular-nums`}>{k.side} · {k.film}</p>
            <h4 className={`${SERIF} mt-2 text-[clamp(1.5rem,2.2vw,2rem)] leading-[1.02]`}>{k.track}</h4>
            <p className="mt-3 break-keep text-[14px] leading-7 text-(--ink)/80">{k.scene}</p>
            <p className="mt-2 break-keep text-[14px] leading-7 text-(--ink)/60">{k.listen}</p>
          </Reveal>
        ))}
      </ul>

      {/* A–D면 */}
      <Reveal as="p" className={`${LABEL} mt-20 text-(--ink)/55`}>Tracklist · 2LP</Reveal>
      <div className="mt-5 grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
        {SIDES.map(([side, tracks], i) => (
          <Reveal key={side} delay={i * 100} className="border-t-[3px] border-(--ink) pt-3">
            <div className="flex items-baseline justify-between">
              <p className={`${SERIF} text-[44px] leading-none`}>{side}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-(--ink)/55">{i < 2 ? "Record 1" : "Record 2"}</p>
            </div>
            <ol className="mt-3">
              {tracks.map(([t, from, film], k) => (
                <li key={t} className="grid grid-cols-[20px_1fr] gap-2 border-t border-(--ink)/15 py-2.5">
                  <span className="pt-0.5 text-[11px] tabular-nums text-(--ink)/50">{k + 1}</span>
                  <span>
                    <span className="block text-[14px] font-semibold leading-6">{t}</span>
                    {from && <span className={`block text-[12px] leading-5 ${film ? "text-(--accent)" : "text-(--ink)/55"}`}>{film ? "▸ 영화 " : ""}{from}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-8 grid gap-4 md:grid-cols-2">
        <p className="break-keep border-l-2 border-(--accent) pl-4 text-[14px] leading-7 text-(--ink)/75">
          <b className="text-(--ink)">C1 · A Tribute to N.J.P.</b> — N.J.P.는 비디오 아트의 아버지 백남준이에요. 사카모토는 그와 함께 작업했고, 1984년 앨범 <i>음악도감</i>에서 이 곡을 그에게 바쳤어요.
        </p>
        <p className="break-keep border-l-2 border-(--ink)/30 pl-4 text-[13px] leading-6 text-(--ink)/60">
          면 구성은 해외 판매처에 공개된 목록 기준이에요. 원래 CD의 마지막 곡 “Bring them home” 자리에 D면 “Self Portrait”가 적혀 있어서, 실제 판에서 한 번 더 확인할 예정이에요.
        </p>
      </Reveal>
    </section>
  );
}

export default function Story() {
  const rows = useSakamoto();
  const row = rows?.find((a) => a.slug === ALBUM_SLUG) ?? null;
  return (
    <>
      <style>{`@keyframes rain { from { transform: translateY(-14px) } to { transform: translateY(14px) } }`}</style>
      <Hero row={row} loading={rows === null} />
      <Release row={row} />
      <Artist />
      <Album />
      <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
        <div className={`${WRAP} grid gap-8 py-[clamp(3.5rem,8vw,6rem)] md:grid-cols-[1fr_auto] md:items-end`}>
          <div>
            <p className={`${LABEL} text-(--cream)/60`}>When it arrives</p>
            <RiseText lines={["A quiet record", "for December"]} className={`${SERIF} mt-4 text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.95]`} />
            <p className="mt-5 max-w-[46ch] break-keep text-[15px] leading-7 text-(--cream)/75">판이 도착하면 Grooves 컬렉션에 올려 두세요. 어느 면을 가장 많이 들었는지도 남겨 둘 수 있어요.</p>
          </div>
          <Link href="/collection" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--cream) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--ink) transition-colors hover:bg-(--accent) hover:text-(--cream)">Open Collection <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <p className={`${WRAP} pb-10 pt-8 text-center text-[11px] text-(--ink)/45`}>판매 정보 출처: 판매 공지(인스타그램). 앨범 정보: Milan Records 30주년 에디션 소개, 원반 크레딧. 판매·배송 일정은 바뀔 수 있으니 공식 채널을 확인하세요. 영화 장면 그림은 Grooves가 그린 일러스트예요.</p>
    </>
  );
}
