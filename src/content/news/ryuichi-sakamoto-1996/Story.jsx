"use client";
// News — "Ryuichi Sakamoto, 1996" (30주년 2LP 재발매)
// 1 히어로(실제 커버 + 빠져나오는 판) → 2 발매 정보(YES24) → 3 아티스트(소개 · 연표 · 수상 · 영화 작업)
// → 4 앨범(소개 · 트리오 · 추천 4곡 + 오른쪽 아래 플레이어 · A–D면) → 5 Grooves 컬렉션 · 출처
// 영화 스틸·포스터는 쓰지 않음(저작권) — 장면은 글로 설명하고 그림은 사이트 톤의 SVG 로
// 내용은 2026-11-24 대화로 확정한 데이터 그대로. 발매 정보: 예스24 상품 페이지 · 앨범 정보: Milan Records 소개, 원반 크레딧
// 플레이어: 공식 "Ryuichi Sakamoto - Topic" 채널 음원. YouTube 약관상 플레이어는 보이게(최소 200×200) — Home 의 Now spinning 카드와 같은 자리·크기
import { MONOTON } from "@/lib/fonts";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Reveal, { RiseText } from "@/components/story/Reveal";
import Disc from "@/components/story/Disc";
import SleeveHero3D from "@/components/story/SleeveHero3D";
import { coverUrl } from "@/lib/albums";
import { ALBUM_SLUG, coverOf, useSakamoto } from "./album";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const SECTION = `${WRAP} py-[clamp(4rem,10vw,8rem)]`;
const LABEL = "text-[11px] font-medium uppercase tracking-[0.3em]";
const BUY = "https://www.yes24.com/product/goods/198037108";
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
// 평면 커버: 3D 가 뜨기 전 · 못 뜰 때(모션 줄이기, WebGL 없음) 보이는 모습. 커버 뒤로 판이 살짝 비침
function FlatSleeve({ row, loading }) {
  const src = coverOf(row);
  return (
    <div className="absolute inset-[13%_22%_13%_8%]">
      <Disc label="#e9e4da" className="absolute inset-[3%] size-[94%] translate-x-[24%]" />
      {src ? (
        <img src={src} alt="Ryuichi Sakamoto — 1996" loading="eager" decoding="async" draggable={false}
          className="absolute inset-0 size-full select-none rounded-[3px] object-cover shadow-[0_34px_70px_-30px_rgba(0,0,0,.65)]" style={{ background: row.cover_color || "#181818" }} />
      ) : loading ? <div className="absolute inset-0 rounded-[3px] bg-(--ink)/8" /> : null}
    </div>
  );
}
// Home Hero 와 같은 실제 같은 재킷 한 장 (3D) — 누르면 판이 빠져나와 돎
function Sleeve({ row, loading }) {
  const flat = <FlatSleeve row={row} loading={loading} />;
  if (!row) return <div className="relative mx-auto aspect-[6/5] w-full max-w-[640px]">{flat}</div>;
  return (
    <SleeveHero3D album={row} image={coverUrl(row.cover_path || row.thumb_path)} color={row.cover_color || "#181818"}
      fallback={flat} className="mx-auto aspect-[6/5] w-full max-w-[640px]" />
  );
}

function Hero({ row, loading }) {
  return (
    <section className="relative overflow-hidden pb-[clamp(3rem,8vw,6rem)] pt-[calc(var(--ct-header-h,106px)+56px)]">
      <div className={`${WRAP} grid items-center gap-x-10 gap-y-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)]`}>
        <div>
          <Reveal as="p" className={`${LABEL} text-(--accent)`}>News · Reissue · 30th Anniversary</Reveal>
          <RiseText as="h1" lines={["Ryuichi", "Sakamoto,", "1996"]} delay={120} className={`${MONOTON} mt-5 text-[clamp(2.4rem,5.6vw,5.6rem)] leading-[1.04]`} />
          <Reveal delay={450} as="p" className="mt-7 max-w-[44ch] break-keep text-[clamp(1rem,1.4vw,1.2rem)] leading-8 text-(--ink)/80">
            류이치 사카모토가 자신의 영화음악을 피아노·첼로·바이올린 트리오로 다시 연주한 <i>1996</i>이 30주년을 맞아 2LP로 다시 나와요. 일본 밖에서 이 앨범이 바이닐로 나오는 건 처음이에요.
          </Reveal>
          <Reveal delay={600} as="p" className="mt-7 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-y-[3px] border-(--ink) py-2 text-[13px] font-semibold">
            <span>84,400원</span><span className="h-px w-5 bg-(--ink)/40" /><span>12.11 발매</span><span className="h-px w-5 bg-(--ink)/40" /><span>180g 2LP</span>
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
  ["First in the West", "일본 밖에서 처음 나오는 바이닐(과 카세트)이에요."],
  ["Remastered", "바이닐에 맞게 새로 리마스터했어요."],
  ["Original design", "1996년의 커버와 디자인을 그대로 살렸어요."],
];
function Release({ row }) {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="01" label="Release" lines={["On sale", "now"]}>
        12월 11일 발매 예정인 예약 상품이에요. 지금 예스24에서 주문할 수 있어요.
      </Head>
      <Reveal className="mt-12 grid overflow-hidden rounded-[6px] border-[3px] border-(--ink) md:grid-cols-[1fr_280px]">
        <dl className="p-[clamp(1.25rem,3vw,2.5rem)]">
          <Row k="가격">84,400원</Row>
          <Row k="발매일">2026년 12월 11일 <span className="text-(--ink)/55">(예약 판매)</span></Row>
          <Row k="구성">180g 2LP · 33⅓ RPM · 16곡</Row>
          <Row k="레이블">Milan Records · 30th Anniversary Edition</Row>
        </dl>
        <div className="flex flex-col justify-between gap-6 border-t-[3px] border-dashed border-(--ink) bg-(--ink) p-[clamp(1.25rem,3vw,2rem)] text-(--cream) md:border-l-[3px] md:border-t-0">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">30th Anniversary</p>
            <p className={`${SERIF} mt-3 text-[64px] leading-[0.85]`}>1996<br /><span className="text-[28px]">→ 2026</span></p>
          </div>
          <div className="grid gap-2">
            <a href={BUY} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between rounded-full bg-(--cream) px-5 text-[12px] font-semibold uppercase tracking-[0.16em] text-(--ink) transition-colors hover:bg-[#7fc1bd]">예스24에서 구매하기 <span aria-hidden="true">↗︎</span></a>
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
      <Reveal className="mt-10 rounded-[6px] bg-(--ink)/6 p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em]">Before you buy</p>
        <ul className="mt-2 grid gap-1 break-keep text-[14px] leading-7 text-(--ink)/70">
          <li>· 톤암·무게 조절이 안 되는 일체형 보급형 오디오에서는 일부 트랙이 튈 수 있어요. 대부분 판 불량이 아니라 수평·침압 설정 때문이에요.</li>
          <li>· 기기 때문에 생기는 재생 문제는 반품·교환이 안 되니, 톤암 조절이 되는 턴테이블을 권해요.</li>
        </ul>
      </Reveal>
    </section>
  );
}

/* ───────────── 3 아티스트 ───────────── */
const LIFE = [
  ["1952", "1월 17일 도쿄 출생. 도쿄예술대학에서 작곡을 공부해요."],
  ["1978", "Yellow Magic Orchestra(YMO) 결성, 첫 솔로 앨범 Thousand Knives."],
  ["1983", "전장의 크리스마스. 첫 영화음악이자 배우로도 출연한 작품."],
  ["1988", "마지막 황제로 아카데미 음악상. 이후 뉴욕에서 활동해요."],
  ["2014", "인후암 진단. 레버넌트(2015), async(2017)로 돌아와요."],
  ["2023", "1월 마지막 앨범 12, 3월 28일 별세.", true],
];
const AWARDS = [
  ["1984", "영국 아카데미(BAFTA) 음악상", "전장의 크리스마스"],
  ["1988", "아카데미 음악상", "마지막 황제 · 데이비드 번, 쑹충과 공동"],
  ["1988", "골든글로브 음악상", "마지막 황제"],
  ["1989", "그래미 영화음악 앨범상", "마지막 황제"],
  ["1991", "골든글로브 음악상", "The Sheltering Sky · 리처드 호로위츠와 공동"],
  ["2018", "대종상 · 영평상 음악상", "남한산성"],
];
// [연도, 영화, 감독, 대표곡, 1996 수록 면, 덧붙임]
const FILMS = [
  ["1983", "전장의 크리스마스", "오시마 나기사", "Merry Christmas Mr. Lawrence", "B2"],
  ["1987", "마지막 황제", "베르나르도 베르톨루치", "The Last Emperor · Rain", "A4 · A2"],
  ["1990", "The Sheltering Sky", "베르나르도 베르톨루치", "The Sheltering Sky", "B4"],
  ["1991", "하이힐", "페드로 알모도바르", "High Heels", "C2"],
  ["1992", "폭풍의 언덕", "피터 코스민스키", "The Wuthering Heights", "C4"],
  ["1993", "리틀 부다", "베르나르도 베르톨루치", "Acceptance", "D2"],
  ["2006", "바벨", "알레한드로 곤살레스 이냐리투", "Bibo no Aozora", "A3"],
  ["2015", "레버넌트", "알레한드로 곤살레스 이냐리투", null, null],
  ["2017", "남한산성", "황동혁", null, null, "그가 음악을 맡은 첫 한국 영화"],
  ["2023", "괴물", "고레에다 히로카즈", null, null, "그의 마지막 영화음악"],
];
function Artist() {
  return (
    <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
      <div className={`${WRAP} py-[clamp(4rem,10vw,8rem)]`}>
        <Head n="02" label="The artist" lines={["Who was", "Sakamoto"]} dark>
          전자음악 밴드 YMO로 시작해, 영화음악으로 세계에 이름을 알린 작곡가이자 피아니스트. 영화에 배우로 출연하기도 했고, 오랫동안 뉴욕에서 활동했어요. 2023년 3월 28일 일흔한 살로 세상을 떠났고, 그해 1월 낸 <i>12</i>가 마지막 앨범이 되었어요.
        </Head>

        <ol className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {LIFE.map(([y, t, hi], i) => (
            <Reveal as="li" key={y} delay={(i % 3) * 120} className={`grid grid-cols-[76px_1fr] gap-4 border-t py-5 ${hi ? "border-[#7fc1bd]" : "border-(--cream)/20"}`}>
              <span className={`${SERIF} text-[28px] leading-none tabular-nums ${hi ? "text-[#7fc1bd]" : ""}`}>{y}</span>
              <span className="break-keep text-[14px] leading-7 text-(--cream)/80">{t}</span>
            </Reveal>
          ))}
        </ol>

        <Reveal as="p" className={`${LABEL} mt-16 text-(--cream)/60`}>Awards</Reveal>
        <ul className="mt-5 grid gap-x-10 border-b border-(--cream)/20 sm:grid-cols-2 lg:grid-cols-3">
          {AWARDS.map(([y, prize, work], i) => (
            <Reveal as="li" key={prize + y} delay={(i % 3) * 100} className="grid grid-cols-[52px_1fr] gap-3 border-t border-(--cream)/20 py-4">
              <span className="pt-0.5 text-[13px] tabular-nums text-(--cream)/55">{y}</span>
              <span>
                <span className="block text-[15px] font-semibold leading-6">{prize}</span>
                <span className="block break-keep text-[13px] leading-6 text-(--cream)/65">{work}</span>
              </span>
            </Reveal>
          ))}
        </ul>

        <Reveal as="p" className={`${LABEL} mt-16 text-(--cream)/60`}>Film scores</Reveal>
        <ul className="mt-5 grid gap-px overflow-hidden rounded-[6px] border border-(--cream)/20 bg-(--cream)/20 sm:grid-cols-2 lg:grid-cols-5">
          {FILMS.map(([y, title, dir, track, on, note], i) => (
            <Reveal as="li" key={title} delay={(i % 5) * 80} className="flex flex-col bg-(--ink) p-5">
              <p className="flex items-center justify-between text-[12px] tabular-nums text-(--cream)/55">
                <span>{y}</span>
                {on && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-(--ink)" style={{ background: MINT }}>1996 · {on}</span>}
              </p>
              <p className={`${SERIF} mt-3 text-[22px] leading-[1.1]`}>{title}</p>
              <p className="mt-1 text-[12px] text-(--cream)/55">{dir}</p>
              {track && <p className="mt-3 text-[13px] leading-6 text-(--cream)/85">♪ {track}</p>}
              {note && <p className="mt-3 break-keep text-[13px] leading-6 text-(--cream)/70">{note}</p>}
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
  // 도쿄의 밤 빌딩과 발코니 난간 (바벨)
  city: (
    <g>
      {[[20, 40, 22], [46, 28, 18], [68, 50, 26], [150, 34, 20], [174, 22, 24], [202, 46, 22]].map(([x, h, w], i) => (
        <g key={i}><rect x={x} y={100 - h - 14} width={w} height={h + 14} fill="#2a2a33" />
          {Array.from({ length: 6 }, (_, k) => <rect key={k} x={x + 3 + (k % 3) * 6} y={100 - h - 8 + Math.floor(k / 3) * 8} width="2" height="3" fill="#e3b04b" opacity={(i + k) % 3 ? 0.2 : 0.8} />)}
        </g>
      ))}
      <path d="M100 70h44 M100 70v18 M144 70v18 M106 70v18 M112 70v18 M118 70v18 M124 70v18 M130 70v18 M136 70v18" stroke={C} strokeWidth=".6" opacity=".7" />
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

// 추천 4곡. v: 공식 "Ryuichi Sakamoto - Topic" 채널 영상 ID
const PICKS = [
  {
    motif: "stars", side: "B2", track: "Merry Christmas Mr. Lawrence", film: "전장의 크리스마스 · 1983", sub: "“Merry Christmas, Mr. Lawrence.”", v: "1OZDaRhHHyM",
    scene: "처형을 앞둔 하라 상사가 로렌스에게 웃으며 인사를 건네는 마지막 장면.",
    listen: "신시사이저 대신 피아노가 멜로디를 쥐어 더 느리고 쓸쓸해요.",
  },
  {
    motif: "rain", side: "A2", track: "Rain", film: "마지막 황제 · 1987", sub: "♪ Rain", v: "PY5LQQlvWLE",
    scene: "후궁 원슈가 푸이를 떠나 빗속으로 걸어 나가는 장면.",
    listen: "현이 빗줄기처럼 몰아치는, 앨범에서 가장 숨 가쁜 곡.",
  },
  {
    motif: "dunes", side: "B4", track: "The Sheltering Sky", film: "The Sheltering Sky · 1990", sub: "♪ The Sheltering Sky", v: "5kY57A4DYO8",
    scene: "북아프리카 사막, 끝없는 모래 언덕과 넓은 하늘.",
    listen: "첼로가 길게 끄는 첫 음부터 사막의 열기가 느껴져요.",
  },
  {
    motif: "city", side: "A3", track: "Bibo no Aozora", film: "바벨 · 2006", sub: "♪ Bibo no Aozora", v: "wku3rL_Tf4A",
    scene: "도쿄의 발코니에서 아버지와 딸이 서로를 안는 마지막 장면.",
    listen: "바이올린이 노래하듯 멜로디를 이끌어요.",
  },
];

function Pick({ p, i, playing, onPlay }) {
  const on = playing === p.v;
  return (
    <Reveal as="li" delay={(i % 2) * 140}>
      <button type="button" onClick={() => onPlay(on ? null : p)} aria-label={`${p.track} ${on ? "멈추기" : "재생"}`} className="group relative block w-full text-left">
        <Frame motif={p.motif} sub={p.sub} />
        <span aria-hidden="true" className={`absolute right-3 top-[12%] grid size-11 place-items-center rounded-full text-(--ink) shadow-lg transition-[scale,background-color] duration-300 group-hover:scale-110 ${on ? "bg-[#7fc1bd]" : "bg-(--cream)"}`}>
          {on ? <svg viewBox="0 0 16 16" className="size-4" fill="currentColor"><rect x="4" y="3" width="3" height="10" /><rect x="9" y="3" width="3" height="10" /></svg>
            : <svg viewBox="0 0 16 16" className="ml-0.5 size-4" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>}
        </span>
      </button>
      <p className={`${LABEL} mt-5 text-(--accent) tabular-nums`}>{p.side} · {p.film}</p>
      <h4 className={`${SERIF} mt-2 text-[clamp(1.6rem,2.4vw,2.2rem)] leading-[1.02]`}>{p.track}</h4>
      <p className="mt-3 break-keep text-[14px] leading-7 text-(--ink)/80">{p.scene}</p>
      <p className="mt-1 break-keep text-[14px] leading-7 text-(--ink)/60">{p.listen}</p>
    </Reveal>
  );
}

// 오른쪽 아래 플레이어 (Home 의 Now spinning 카드와 같은 자리·크기). 누른 곡만 틀고, 닫으면 멈춤
function Player({ pick, onClose }) {
  const [shown, setShown] = useState(null);
  useEffect(() => { if (pick) setShown(pick); }, [pick]);
  const p = pick ?? shown;
  return (
    <div role="region" aria-label="재생 중" aria-hidden={!pick}
      className={`fixed bottom-[4.5rem] right-[clamp(16px,3vw,40px)] z-40 w-[216px] overflow-hidden rounded-xl bg-[#15111a]/90 text-[#f4e7cd] shadow-[0_24px_48px_-20px_rgba(0,0,0,.7)] ring-1 ring-white/10 backdrop-blur-md transition-[opacity,translate] duration-500 ease-groove motion-reduce:transition-none ${pick ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
      <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[#7fc1bd]">Now playing · 1996</p>
          <p className="mt-1 truncate text-[13px] font-semibold">{p?.track}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="플레이어 닫기" className="grid size-7 shrink-0 place-items-center rounded-full text-[#f4e7cd]/70 transition-colors hover:bg-white/10 hover:text-[#f4e7cd]">
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <div className="px-2 pb-2">
        {pick && (
          <iframe key={pick.v} title={`${pick.track} — YouTube`} width="200" height="200"
            src={`https://www.youtube-nocookie.com/embed/${pick.v}?autoplay=1&playsinline=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
            className="block h-[200px] w-[200px] rounded-md bg-black" />
        )}
      </div>
    </div>
  );
}

// 30주년 2LP 면 구성. [곡, 출처, 영화면 1]
const SIDES = [
  ["A", [["A Day a Gorilla Gives a Banana", "새로 쓴 곡"], ["Rain", "마지막 황제", 1], ["Bibo no Aozora", "바벨", 1], ["The Last Emperor", "마지막 황제", 1]]],
  ["B", [["1919", "새로 쓴 곡"], ["Merry Christmas Mr. Lawrence", "전장의 크리스마스", 1], ["M.A.Y. in the Backyard", ""], ["The Sheltering Sky", "The Sheltering Sky", 1]]],
  ["C", [["A Tribute to N.J.P.", "백남준에게"], ["High Heels (Main Theme)", "하이힐", 1], ["Aoneko no Torso", ""], ["The Wuthering Heights", "폭풍의 언덕", 1]]],
  ["D", [["Parolibre", ""], ["Acceptance – Little Buddha", "리틀 부다", 1], ["Before Long", ""], ["Self Portrait", ""]]],
];

function Album() {
  const [pick, setPick] = useState(null);
  return (
    <section className={SECTION}>
      <Head n="03" label="The album" lines={["Three", "instruments"]}>
        영화를 위해 썼던 곡들을 피아노·첼로·바이올린 트리오로 다시 편곡한 앨범이에요. 전 세계 많은 사람들이 작곡가이자 피아니스트인 사카모토를 처음 만난 앨범이기도 해요. 오케스트라가 빠지자 멜로디가 더 가깝고 조용하게 들려요. 뉴욕 라이트 트랙 스튜디오에서 녹음했고, 당시 새로 쓴 “A Day a Gorilla Gives a Banana”와 “1919”가 함께 실렸어요.
      </Head>

      <Reveal as="ul" className="mt-12 grid grid-cols-3 border-y-[3px] border-(--ink)">
        {TRIO.map(([inst, who], i) => (
          <li key={inst} className={`py-5 ${i ? "border-l border-(--ink)/20 pl-[clamp(.75rem,2vw,1.5rem)]" : ""}`}>
            <p className={`${SERIF} text-[clamp(1.6rem,3vw,2.6rem)] leading-none`}>{inst}</p>
            <p className="mt-2 text-[13px] text-(--ink)/65">{who}</p>
          </li>
        ))}
      </Reveal>
      <p className="mt-3 text-[12px] text-(--ink)/50">일부 곡의 바이올린은 David Nadien, Barry Finclair가 연주했어요.</p>

      <div className="mt-20 flex flex-wrap items-end justify-between gap-4">
        <Reveal as="p" className={`${LABEL} text-(--ink)/55`}>Four to start with · Scores &amp; scenes</Reveal>
        <Reveal as="p" className="text-[13px] text-(--ink)/55">▶ 를 누르면 오른쪽 아래에서 공식 음원이 재생돼요.</Reveal>
      </div>
      <ul className="mt-6 grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-14 md:grid-cols-2">
        {PICKS.map((p, i) => <Pick key={p.v} p={p} i={i} playing={pick?.v} onPlay={setPick} />)}
      </ul>

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
          <b className="text-(--ink)">C1 · A Tribute to N.J.P.</b> — N.J.P.는 비디오 아트의 아버지 백남준이에요. 사카모토는 1984년 앨범 <i>음악도감</i>에서 이 곡을 그에게 바쳤어요.
        </p>
        <p className="break-keep border-l-2 border-(--ink)/30 pl-4 text-[14px] leading-7 text-(--ink)/65">
          이번 재발매반의 마지막 곡은 원래 CD의 “Bring them home” 대신 “Self Portrait”예요.
        </p>
      </Reveal>

      <Player pick={pick} onClose={() => setPick(null)} />
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
      <p className={`${WRAP} pb-10 pt-8 text-center text-[11px] text-(--ink)/45`}>발매 정보 출처: 예스24. 앨범 정보: Milan Records 30주년 에디션 소개, 원반 크레딧. 발매 일정과 가격은 바뀔 수 있으니 판매처를 확인하세요. 영화 장면 그림은 Grooves가 그린 일러스트예요.</p>
    </>
  );
}
