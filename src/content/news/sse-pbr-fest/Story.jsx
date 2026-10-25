"use client";
// News — "SSE PBR FEST" (쎄 프로젝트 팝업 & 페스티벌, DDP SHOWROOM, 2026.10.31 – 11.23)
// 1 히어로(공식 포스터의 글자 쌓기를 글자로 + 카운트다운) → 2 페스티벌 소개 + 포스터 → 3 장소·일시(티켓) → 4 입장 방식
// → 5 세 개의 존 → 6 김현창 바이닐 발매 → 7 일정(달력 + 날짜별 상세) → 8 알아두기
// 이 글은 포스터의 색·글자(Rubik 900 + 한글은 함렛)를 따르고, 바탕·글자색·다크 모드 반전은 사이트 토큰(--cream/--ink)을 그대로 씀
// 포스터 5색은 라이트·다크 모두 같고, 색 위 글자는 고정 잉크(--sse-on)
import "@fontsource/rubik/700.css";
import "@fontsource/rubik/900.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import Reveal from "@/components/story/Reveal";
import { RELEASES, findRow, coverOf, useKimHyunchang } from "./albums";
import { CAL_DAYS, CLOSE_AT, EVENTS, EVENT_DAYS, OPEN_AT, RUN_FROM, RUN_TO, TYPES, typesOn, weekdayOf } from "./events";

const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const SECTION = `${WRAP} py-[clamp(4rem,10vw,8rem)]`;
const DISPLAY = "font-['Rubik','Hahmlet',sans-serif] font-black";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.3em]";
const VARS = { "--sse-y": "#f5dc92", "--sse-p": "#bba2cc", "--sse-g": "#6bbd82", "--sse-t": "#29b6b9", "--sse-k": "#f4b5c8", "--sse-on": "#2a222a" };
const SITE = "https://sse-record.com";
const MAP_QUERY = encodeURIComponent("동대문디자인플라자");
const BTN = "inline-flex min-h-11 items-center gap-2 rounded-full border-[3px] border-(--ink) px-6 text-[13px] font-bold tracking-[0.04em] transition-colors hover:bg-(--ink) hover:text-(--cream)";

function useNow(interval = 1000) {
  const [now, setNow] = useState(null);   // 서버 렌더에선 null → 하이드레이션 어긋남 없음
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

/* ───────────── 1 히어로 ───────────── */
// 포스터의 층층이 쌓인 글자. 줄마다 같은 너비로 맞춤(textLength) + 둥근 모서리(stroke-linejoin)
const STACK = [
  ["PBR", 476, 373, "var(--sse-y)"],
  ["POP-UP", 242, 577, "var(--sse-p)"],
  ["BOOK", 325, 841, "var(--sse-g)"],
  ["RECORD", 242, 1045, "var(--sse-t)"],
  ["LIVE&TALK", 160, 1189, "var(--sse-k)"],
];
function Stack() {
  return (
    <svg viewBox="0 0 1000 1200" aria-hidden="true" className="my-[clamp(6px,1vw,12px)] block h-auto w-full">
      {STACK.map(([w, fs, y, c]) => (
        <text key={w} x="8" y={y} fontSize={fs} textLength="984" lengthAdjust="spacingAndGlyphs" strokeWidth="14" strokeLinejoin="round"
          className="font-['Rubik','Hahmlet',sans-serif] font-black [paint-order:stroke]" style={{ fill: c, stroke: c }}>{w}</text>
      ))}
    </svg>
  );
}

function Countdown() {
  const now = useNow();
  const left = now == null ? 0 : Math.max(0, OPEN_AT - now);
  const open = now != null && now >= OPEN_AT && now < CLOSE_AT;
  const over = now != null && now >= CLOSE_AT;
  const parts = [["Days", Math.floor(left / 864e5), "bg-(--sse-y)"], ["Hours", Math.floor(left / 36e5) % 24, "bg-(--sse-p)"], ["Min", Math.floor(left / 6e4) % 60, "bg-(--sse-g)"], ["Sec", Math.floor(left / 1e3) % 60, "bg-(--sse-t)"]];
  const head = now == null ? " " : open ? "Now open · 11.23까지" : over ? "Thanks for coming" : "Opens in";
  return (
    <div aria-live="off" className="flex flex-wrap items-center gap-3">
      <p className={`${LABEL} mr-1 flex items-center gap-2 !tracking-[0.2em]`}>
        {open && <span className="size-2 animate-pulse rounded-full bg-(--accent)" />}{head}
      </p>
      {!open && !over && parts.map(([k, v, bg]) => (
        <div key={k} className={`min-w-[76px] rounded-[22px] px-3.5 pb-2 pt-2.5 text-center text-(--sse-on) ${bg}`}>
          <p className={`${DISPLAY} text-[34px] leading-[1.05] tabular-nums`}>{now == null ? "--" : String(v).padStart(2, "0")}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em]">{k}</p>
        </div>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section className={`${WRAP} pb-[clamp(3rem,7vw,6rem)] pt-[calc(var(--ct-header-h,106px)+56px)]`}>
      <Reveal as="p" className={`${LABEL} text-(--accent)`}>News · Pop-up &amp; Festival</Reveal>
      <div className="mt-5 grid items-end gap-x-[clamp(2rem,5vw,5rem)] gap-y-10 lg:grid-cols-[minmax(0,880px)_minmax(0,1fr)]">
        <h1 aria-label="SSE POP-UP & FESTIVAL, PBR. POP-UP, BOOK, RECORD, LIVE & TALK">
          <div aria-hidden="true" className={`${DISPLAY} flex justify-between px-[clamp(6px,1.6vw,18px)] text-[clamp(13px,2.2vw,22px)] leading-none`}>
            <span>SSE</span><span>POP-UP</span><span>&amp;</span><span>FESTIVAL</span>
          </div>
          <Reveal delay={150}><Stack /></Reveal>
          <div aria-hidden="true" className={`${DISPLAY} grid grid-cols-[1fr_auto_1fr] items-center px-[clamp(6px,1.6vw,18px)] text-[clamp(13px,2.2vw,22px)] leading-tight`}>
            <span>10.31–11.23, 2026</span>
            <span className="block size-[clamp(56px,9vw,92px)] overflow-hidden rounded-full bg-white"><img src="/images/news/sse-pbr-fest/mascot.webp" alt="" className="size-full object-cover" /></span>
            <span className="text-right">DDP SHOWROOM</span>
          </div>
        </h1>
        <div className="flex flex-col gap-7 lg:pb-8">
          <Reveal as="p" delay={200} className="break-keep font-['Hahmlet',serif] text-[clamp(1.6rem,3vw,2.5rem)] font-black leading-[1.2]">쎄 프로젝트 18년의 아카이브,<br />동대문에서 한 달간</Reveal>
          <Reveal delay={300}><Countdown /></Reveal>
          <Reveal delay={350}>
            <p className="max-w-[56ch] break-keep text-[17px] leading-8 text-(--ink)/90">시각예술 전문 출판사이자 독립 음반 레이블 쎄 프로젝트가 아트북과 진, 피지컬 음반을 한자리에 모아 팝업과 페스티벌로 엽니다. 라이브와 토크, 워크샵, 사인회가 한 달 가까이 이어져요.</p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="프로그램 키워드">
              {[["POP-UP", "bg-(--sse-p)"], ["BOOK", "bg-(--sse-g)"], ["RECORD", "bg-(--sse-t)"], ["LIVE & TALK", "bg-(--sse-k)"], ["WORKSHOP", "bg-(--sse-y)"]].map(([t, bg]) => (
                <li key={t} className={`${DISPLAY} rounded-full px-3.5 py-1.5 text-[13px] tracking-[0.04em] text-(--sse-on) ${bg}`}>{t}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────── 공통: 섹션 머리 ───────────── */
function Head({ n, label, title, bg, children }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-end">
      <div>
        <Reveal as="p" className={`${LABEL} text-(--accent) tabular-nums`}>{n} — {label}</Reveal>
        <Reveal as="h2" delay={100} className={`${DISPLAY} mt-4 inline-block rounded-[clamp(20px,3vw,40px)] px-[clamp(18px,2.6vw,36px)] pb-[.12em] pt-[.06em] text-[clamp(2.4rem,6vw,5.6rem)] uppercase leading-[1.02] tracking-[-0.01em] text-(--sse-on) ${bg}`}>{title}</Reveal>
      </div>
      {children && <Reveal delay={200} as="p" className="max-w-[46ch] break-keep text-[15px] leading-7 text-(--ink)/90 md:pb-2">{children}</Reveal>}
    </div>
  );
}

/* ───────────── 2 페스티벌 + 포스터 ───────────── */
const PAIRS = [
  ["POP-UP", "18년의 아카이브를 한자리에 모은 팝업 공간"],
  ["BOOK", "독립 발행해 온 진과 아트북 아카이브 전시"],
  ["RECORD", "바이닐, 카세트테이프, CD를 턴테이블 청음 부스에서"],
  ["LIVE & TALK", "국내 대표 인디 뮤지션의 라이브와 음악평론가 토크"],
  ["WORKSHOP", "아티스트 워크샵과 사인회"],
];
function About() {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="01" label="The festival" title="The festival" bg="bg-(--sse-y)">무엇을 하는 행사인지, 다섯 가지 키워드로.</Head>
      <div className="mt-12 grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)] md:gap-16">
        <div>
          <Reveal as="p" className="max-w-[62ch] break-keep text-[clamp(1.05rem,1.5vw,1.2rem)] leading-8">그동안 발매해 온 아트북과 진, 피지컬 음반을 직접 보고 듣는 아카이브 전시에 국내 인디 뮤지션들의 라이브와 토크, 아티스트 워크샵과 사인회가 더해져요.</Reveal>
          <ul className="mt-8">
            {PAIRS.map(([k, v], i) => (
              <Reveal as="li" key={k} delay={i * 70} className="grid grid-cols-[110px_1fr] gap-4 border-t-2 border-(--ink) py-4">
                <b className={`${DISPLAY} pt-0.5 text-[13px] tracking-[0.04em]`}>{k}</b>
                <span className="break-keep text-[15px] leading-7">{v}</span>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal as="figure" delay={150} className="max-md:max-w-[360px]">
          <img src="/images/news/sse-pbr-fest/poster.webp" alt="SSE PBR FEST 공식 포스터. 노랑 PBR, 보라 POP-UP, 초록 BOOK, 청록 RECORD, 분홍 LIVE&TALK가 층층이 쌓여 있다." width="1000" height="1333" loading="lazy" decoding="async" className="block h-auto w-full rounded-[20px] bg-white" />
          <figcaption className="mt-3 text-[12px] leading-5 text-(--ink)/55">Official poster · 이미지 제공 쎄 프로젝트(SSE PROJECT)</figcaption>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── 3 장소·일시 ───────────── */
function Row({ k, children, sub }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-4 border-b-2 border-(--sse-on)/15 py-3.5 last:border-b-0 sm:grid-cols-[130px_1fr]">
      <dt className={`${DISPLAY} pt-0.5 text-[13px] tracking-[0.04em]`}>{k}</dt>
      <dd className="break-keep text-[16px] leading-7">{children}{sub && <small className="block text-[15px] opacity-70">{sub}</small>}</dd>
    </div>
  );
}
function Venue() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="02" label="Where & when" title="Where & when" bg="bg-(--sse-p)">기간과 운영시간, 오시는 길과 주차.</Head>
      <Reveal className="mt-12 rounded-[clamp(24px,3vw,36px)] bg-(--sse-p) p-[clamp(1.25rem,3vw,2.25rem)] pb-[clamp(.5rem,1.5vw,1rem)] text-(--sse-on)">
        <div className="flex items-start justify-between gap-4 border-b-[3px] border-dashed border-(--sse-on)/50 pb-5">
          <div>
            <p className={`${DISPLAY} text-[12px] uppercase tracking-[0.12em]`}>Admit one</p>
            <p className={`${DISPLAY} mt-1 text-[clamp(1.25rem,2.6vw,1.7rem)] leading-tight`}>SSE POP-UP &amp; FESTIVAL<br />《SSE PBR FEST》</p>
          </div>
          <span className={`${DISPLAY} shrink-0 -rotate-6 rounded-full bg-(--sse-on) px-5 py-3 text-[28px] leading-none text-(--sse-p)`}>FREE</span>
        </div>
        <dl>
          <Row k="기간">2026. 10. 31(토) — 11. 23(월)</Row>
          <Row k="운영시간" sub="공연 및 별도 프로그램이 있는 경우 진행에 따라 추가 운영">10:00 — 19:00</Row>
          <Row k="장소" sub="동대문디자인플라자 디자인랩 1층">DDP SHOWROOM</Row>
          <Row k="가는 길">동대문역사문화공원역 1번 출구 → 디자인랩 D1 입구 → 엘리베이터로 1층</Row>
          <Row k="주차">DDP 주차장 1시간 4,800원 (5분당 400원), 1일 최대 5만원</Row>
          <Row k="주최">sba(서울경제진흥원)</Row>
          <Row k="주관">HUS</Row>
          <Row k="협력">오디오 테크니카(Audio-Technica), 비아크(b.arc), 수관기피, 루트 게이트(ROOT GATE)</Row>
        </dl>
      </Reveal>
      <Reveal delay={100} className="mt-5 flex flex-wrap gap-3">
        <a href={`https://map.naver.com/p/search/${MAP_QUERY}`} target="_blank" rel="noreferrer" className={BTN}>네이버 지도 <span aria-hidden="true">↗︎</span></a>
        <a href={`https://map.kakao.com/?q=${MAP_QUERY}`} target="_blank" rel="noreferrer" className={BTN}>카카오맵 <span aria-hidden="true">↗︎</span></a>
      </Reveal>
    </section>
  );
}

/* ───────────── 4 입장 방식 ───────────── */
const STEPS = [
  ["sse-record.com에서 예매", "티켓 예매는 sse-record.com에서 진행해요. 회원가입 시 본인인증이 필요해요."],
  ["10월 26일(월) 정오 12시 오픈", "티켓 구매는 이날 낮 12시부터 열려요."],
  ["동대문역사문화공원역 1번 출구로", "디자인랩 D1 입구에서 엘리베이터를 타고 1층으로 올라가요."],
  ["프로그램은 더해질 수 있어요", "행사 중간에 새 프로그램이 추가될 수 있고, 일부 워크샵은 재료비가 포함돼요."],
];
function Entry() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="03" label="Getting in" title="Getting in" bg="bg-(--sse-g)">모든 공연은 무료예요. 티켓은 미리 받아두세요.</Head>
      <ol className="mt-12 grid gap-x-12 md:grid-cols-2">
        {STEPS.map(([t, d], i) => (
          <Reveal as="li" key={t} delay={(i % 2) * 90} className="grid grid-cols-[56px_1fr] items-start gap-4 border-t-2 border-(--ink) py-5">
            <span className={`${DISPLAY} grid size-12 place-items-center rounded-full bg-(--sse-g) text-[22px] text-(--sse-on)`}>{i + 1}</span>
            <div>
              <p className="break-keep font-['Hahmlet',serif] text-[18px] font-black leading-snug">{t}</p>
              <p className="mt-1 break-keep text-[15px] leading-7 text-(--ink)/90">{d}</p>
            </div>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-8"><a href={SITE} target="_blank" rel="noreferrer" className={`${BTN} border-(--sse-g) bg-(--sse-g) text-(--sse-on) hover:border-(--ink)`}>티켓 예매하기 <span aria-hidden="true">↗︎</span></a></Reveal>
    </section>
  );
}

/* ───────────── 5 세 개의 존 ───────────── */
const ZONES = [
  { z: "ZONE 01", t: "BOOK", k: "아카이브 전시 존", d: "쎄 프로젝트가 18년간 독립적으로 발행해 온 진(Zine)과 아트북(Book) 전시.", tags: ["ZINE", "ART BOOK"], bg: "bg-(--sse-g)" },
  { z: "ZONE 02 · VINYL", t: "RECORD", k: "리스닝 존", d: "쎄 프로젝트가 기획·제작한 바이닐과 카세트테이프, CD를 턴테이블 청음 부스에서 들어볼 수 있어요.", tags: ["VINYL", "CASSETTE", "CD", "LISTENING BOOTH"], bg: "bg-(--sse-t)" },
  { z: "ZONE 03", t: "PICK-UP", k: "픽업 존", d: "피지컬 음반, 단행본 도서, 페스티벌 한정 굿즈를 현장에서 판매해요.", tags: ["VINYL", "CASSETTE", "CD", "BOOK", "GOODS"], bg: "bg-(--sse-k)", note: "피지컬 음반을 현장에서 구매하면 10%의 결제 수수료가 추가돼요." },
];
function Floor() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="04" label="On the floor" title="On the floor" bg="bg-(--sse-t)">행사 기간 내내 열려 있는 세 개의 존.</Head>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {ZONES.map((z, i) => (
          <Reveal as="article" key={z.t} delay={i * 110} className={`flex flex-col gap-2.5 rounded-[clamp(24px,3vw,32px)] p-[clamp(1.25rem,2.4vw,1.75rem)] text-(--sse-on) ${z.bg}`}>
            <p className={`${DISPLAY} text-[12px] tracking-[0.1em]`}>{z.z}</p>
            <p className={`${DISPLAY} text-[clamp(2.2rem,4.4vw,2.9rem)] leading-[.95] tracking-[-0.02em]`}>{z.t}</p>
            <p className="font-['Hahmlet',serif] text-[16px] font-black leading-snug">{z.k}</p>
            <p className="break-keep text-[15.5px] leading-6">{z.d}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">{z.tags.map((t) => <li key={t} className={`${DISPLAY} rounded-full bg-white/55 px-2.5 py-0.5 text-[11px] tracking-[0.06em]`}>{t}</li>)}</ul>
            {z.note && <p className="mt-1 break-keep border-t-2 border-dashed border-(--sse-on)/50 pt-2.5 text-[14.5px] leading-6">{z.note}</p>}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────── 6 김현창 바이닐 ───────────── */
function Disc({ className = "" }) {
  return (
    <span aria-hidden="true" className={`relative block shrink-0 rounded-full shadow-[0_0_0_3px_#2a222a] [background:repeating-radial-gradient(circle,#161616_0_2px,#2a2a2a_2px_4px)] ${className}`}>
      <span className="absolute inset-[34%] rounded-full bg-(--sse-y)" />
    </span>
  );
}
const SPEC = [["사양", "45 RPM · 180g"], ["컬러", "Galaxy Deep Green + Bone white / Orange + White"], ["구성", "싱글 재킷, 2p 인서트"], ["프레싱", "체코(Czech)"]];
const SALE = [
  { d: "10.26", w: "MON", t: "1차 판매 시작", p: "낮 12시부터 sse-record.com에서 판매해요.", bg: "bg-(--sse-k) border-(--sse-k) text-(--sse-on)" },
  { d: "11.07", w: "SAT", t: "발매 기념 공연에서 수령", p: "DDP SHOWROOM 픽업 존에서 오전 10시부터 받을 수 있어요.", bg: "bg-(--sse-t) border-(--sse-t) text-(--sse-on)" },
  { d: "11월 중순", w: "", t: "일반 판매", p: "구체적인 일정은 추후 공지돼요.", bg: "border-(--ink)" },
];
function Vinyl() {
  const rows = useKimHyunchang();
  return (
    <section id="vinyl" className={`${SECTION} pt-0`}>
      <Head n="05" label="Vinyl" title="Vinyl" bg="bg-(--sse-p)">이번 행사의 바이닐 발매. 김현창의 두 장.</Head>
      <Reveal as="p" className="mt-12 max-w-[62ch] break-keep text-[clamp(1.05rem,1.5vw,1.2rem)] leading-8">김현창의 EP 《마침내 우리가 화원이 되기를》과 정규 1집 《살아서 슬퍼야지, 그렇게 선명히 너를 사랑해야지》가 바이닐로 발매돼요.</Reveal>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {RELEASES.map((r, i) => {
          const row = findRow(rows, r), img = coverOf(row);
          const inner = (
            <>
              {img
                ? <img src={img} alt="" loading="lazy" decoding="async" draggable={false} className="size-[clamp(96px,12vw,132px)] shrink-0 rounded-[6px] object-cover shadow-[0_10px_18px_-8px_rgba(0,0,0,.5)]" style={{ background: row.cover_color || "#888" }} />
                : <Disc className="size-[clamp(72px,9vw,92px)]" />}
              <div>
                <p className={`${DISPLAY} text-[12px] tracking-[0.1em]`}>{r.kind}</p>
                <p className="mt-1 break-keep font-['Hahmlet',serif] text-[clamp(1.15rem,1.6vw,1.35rem)] font-black leading-snug">{r.title}</p>
                <p className="mt-1 text-[15px] font-bold">김현창</p>
                {row && <p className={`${DISPLAY} mt-3 text-[12px] tracking-[0.08em]`}>Grooves에서 보기 <span aria-hidden="true" className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span></p>}
              </div>
            </>
          );
          const cls = `group flex items-center gap-5 rounded-[clamp(24px,3vw,32px)] p-[clamp(1.25rem,2.4vw,1.75rem)] text-(--sse-on) ${r.bg}`;
          return (
            <Reveal key={r.title} delay={i * 110}>
              {row ? <Link href={`/album/${row.slug}`} aria-label={`${r.title} — Grooves에서 보기`} className={`${cls} transition-transform duration-300 hover:-translate-y-0.5`}>{inner}</Link> : <div className={cls}>{inner}</div>}
            </Reveal>
          );
        })}
      </div>
      <Reveal as="dl" className="mt-4 rounded-[clamp(24px,3vw,28px)] bg-(--ink)/[0.07] px-[clamp(1.25rem,2.4vw,1.75rem)] py-2">
        {SPEC.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] gap-4 border-b border-(--ink)/20 py-3.5 last:border-b-0 sm:grid-cols-[130px_1fr]">
            <dt className={`${DISPLAY} pt-0.5 text-[13px] tracking-[0.04em]`}>{k}</dt>
            <dd className="break-keep text-[16px] leading-7">{v}</dd>
          </div>
        ))}
      </Reveal>
      <ol className="mt-4 grid gap-3.5 md:grid-cols-3">
        {SALE.map((s, i) => (
          <Reveal as="li" key={s.t} delay={i * 90} className={`rounded-[clamp(24px,3vw,28px)] border-[3px] p-[clamp(1.1rem,2vw,1.4rem)] ${s.bg}`}>
            <p className={`${DISPLAY} text-[clamp(1.9rem,3.4vw,2.5rem)] leading-none tracking-[-0.02em]`}>{s.d}{s.w && <small className="ml-1.5 text-[13px] tracking-[0.04em]">{s.w}</small>}</p>
            <p className="mt-2.5 break-keep font-['Hahmlet',serif] text-[16px] font-black leading-snug">{s.t}</p>
            <p className="mt-1 break-keep text-[15px] leading-6 opacity-80">{s.p}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal className="mt-3.5 flex items-start gap-3.5 rounded-[24px] bg-(--ink)/[0.07] px-5 py-4 text-[15.5px] leading-6">
        <b className={`${LABEL} mt-0.5 shrink-0 rounded-full bg-(--ink) px-3 py-0.5 !tracking-[0.1em] text-(--cream)`}>NOTE</b>
        <span className="break-keep">구매 수량은 1인 2개까지예요. 발매 기념 공연 티켓은 바이닐과 별도로 예매해야 하고, 공연 티켓도 10월 26일 낮 12시에 열려요.</span>
      </Reveal>
    </section>
  );
}

/* ───────────── 7 일정: 달력 + 날짜별 상세 ───────────── */
const dayBg = (ts) => (ts.length === 1 ? TYPES[ts[0]].c : `linear-gradient(135deg,${TYPES[ts[0]].c} 50%,${TYPES[ts[1]].c} 50%)`);
const hasVinyl = (key) => EVENTS.some((e) => e.d === key && e.v);
const CHIP = "inline-flex min-h-9 items-center gap-2 rounded-full border-[3px] border-(--ink) px-4 text-[13px] font-black transition-colors";

function Schedule() {
  const [sel, setSel] = useState(EVENT_DAYS[0]);
  const [filter, setFilter] = useState("all");
  // 오늘 이후 첫 프로그램 날짜를 기본 선택 (서버 렌더와 달라지지 않게 마운트 뒤에)
  useEffect(() => {
    const t = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);   // KST 오늘
    const next = EVENT_DAYS.find((d) => d >= t);
    if (next) setSel(next);
  }, []);
  const idx = EVENT_DAYS.indexOf(sel);
  const [y, m, d] = sel.split("-").map(Number);
  const items = EVENTS.filter((e) => e.d === sel);
  const goVinyl = () => document.getElementById("vinyl")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="06" label="Schedule" title="Schedule" bg="bg-(--sse-k)">지금까지 공개된 {EVENT_DAYS.length}일의 프로그램이에요. 색이 칠해진 날짜를 누르면 그날의 일정이 아래에 나와요.</Head>

      <Reveal className="mt-12 flex items-center gap-5 rounded-[28px] bg-(--sse-g) px-[clamp(1.1rem,2.4vw,1.6rem)] py-5 text-(--sse-on)">
        <Disc className="size-14" />
        <div>
          <p className="break-keep font-['Hahmlet',serif] text-[18px] font-black leading-snug">바이닐이 궁금하다면 11월 7일</p>
          <p className="mt-1 break-keep text-[15.5px] leading-6">김현창 바이닐 발매 라이브와 사인회가 오후 3시와 6시, 두 번 열려요. 리스닝 존의 청음 부스와 함께 들러보기 좋아요.</p>
          <button type="button" onClick={() => { setSel("2026-11-07"); setFilter("all"); }} className="mt-2.5 inline-flex min-h-9 items-center rounded-full border-[3px] border-(--sse-on) px-4 text-[13px] font-black transition-colors hover:bg-(--sse-on) hover:text-white">11월 7일 일정 보기 →</button>
        </div>
      </Reveal>

      <div role="group" aria-label="프로그램 종류 필터" className="mt-8 flex flex-wrap gap-2">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`${CHIP} ${DISPLAY} aria-pressed:bg-(--ink) aria-pressed:text-(--cream)`}>All <small className="opacity-60">{EVENTS.length}</small></button>
        {Object.entries(TYPES).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(filter === k ? "all" : k)} className={`${CHIP} ${DISPLAY} aria-pressed:bg-(--ink) aria-pressed:text-(--cream)`}>
            <i className="size-3 rounded-full" style={{ background: t.c }} />{t.n} <small className="opacity-60">{EVENTS.filter((e) => e.k.includes(k)).length}</small>
          </button>
        ))}
      </div>

      <div className="-mx-1 mt-5 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[340px] grid-cols-7 gap-1.5" aria-label="일정 캘린더">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((w) => <div key={w} className={`${DISPLAY} pb-1 text-center text-[11px] tracking-[0.08em] text-(--ink)/55`}>{w}</div>)}
          {CAL_DAYS.map((x, i) => {
            const ts = typesOn(x.key), inRun = x.key >= RUN_FROM && x.key <= RUN_TO;
            const lab = i === 0 || x.d === 1 || x.key === RUN_FROM ? (x.m === 10 ? "OCT" : "NOV") : " ";
            const base = `${DISPLAY} relative flex min-h-14 flex-col justify-between rounded-2xl p-1.5 text-left text-base leading-none md:min-h-20 md:rounded-[22px] md:p-2 md:text-xl`;
            if (!ts.length) return (
              <div key={x.key} className={`${base} ${inRun ? "bg-(--ink)/[0.07]" : "opacity-30"}`}>
                <small className="block min-h-[9px] text-[9px] font-bold tracking-[0.1em] text-(--ink)/55">{lab}</small>{x.d}
              </div>
            );
            const match = filter === "all" || ts.includes(filter);
            return (
              <button key={x.key} type="button" onClick={() => setSel(x.key)} aria-pressed={x.key === sel}
                aria-label={`${x.m}월 ${x.d}일, ${ts.map((t) => TYPES[t].n).join(" · ")}${hasVinyl(x.key) ? ", 바이닐 발매" : ""}`}
                style={{ background: dayBg(ts) }}
                className={`${base} cursor-pointer text-(--sse-on) transition-[translate,opacity] duration-200 hover:-translate-y-0.5 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--ink) ${x.key === sel ? "outline outline-[3px] outline-offset-[3px] outline-(--ink)" : ""} ${match ? "" : "opacity-25"}`}>
                <small className="block min-h-[9px] text-[9px] font-bold tracking-[0.1em] opacity-80">{lab}</small>
                {x.d}
                <span className="hidden text-[9px] font-black uppercase leading-[1.15] tracking-[0.06em] md:block">{ts.map((t) => TYPES[t].a).join("·")}</span>
                {hasVinyl(x.key) && <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-[#2a222a] shadow-[inset_0_0_0_3px_#2a222a,inset_0_0_0_6px_var(--sse-y)] md:right-2 md:top-2 md:size-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <div key={sel} aria-live="polite" className="mt-5 rounded-[clamp(24px,3vw,32px)] bg-(--ink)/[0.07] px-[clamp(1.1rem,2.6vw,1.6rem)] pb-2 pt-5 transition-[opacity,translate] duration-300 starting:translate-y-1.5 starting:opacity-0 motion-reduce:transition-none">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b-[3px] border-dashed border-(--ink)/60 pb-3.5">
          <b className={`${DISPLAY} text-[clamp(3.2rem,6vw,4rem)] leading-none tracking-[-0.03em]`}>{d}</b>
          <span className={`${DISPLAY} text-[12px] uppercase tracking-[0.08em] text-(--ink)/60`}>{m}월 · {weekdayOf(sel)} · {idx + 1} / {EVENT_DAYS.length}</span>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={idx === 0} onClick={() => setSel(EVENT_DAYS[idx - 1])} className={`${CHIP} ${DISPLAY} min-h-8 px-3.5 text-[12px] enabled:hover:bg-(--ink) enabled:hover:text-(--cream) disabled:opacity-30`}>← PREV</button>
            <button type="button" disabled={idx === EVENT_DAYS.length - 1} onClick={() => setSel(EVENT_DAYS[idx + 1])} className={`${CHIP} ${DISPLAY} min-h-8 px-3.5 text-[12px] enabled:hover:bg-(--ink) enabled:hover:text-(--cream) disabled:opacity-30`}>NEXT →</button>
          </div>
        </div>
        {items.map((e) => (
          <div key={e.h} className="grid gap-1.5 border-t-2 border-(--ink)/20 py-[18px] first:border-t-0 md:grid-cols-[110px_minmax(0,1fr)] md:gap-x-6">
            <p className={`${DISPLAY} text-xl leading-snug tabular-nums`}>{e.t.map((t) => <span key={t} className="block">{t}</span>)}</p>
            <div>
              <p className="break-keep font-['Hahmlet',serif] text-xl font-black leading-snug [text-wrap:balance]">{e.h}</p>
              {e.p && <p className="mt-1 text-[15.5px] leading-6 text-(--ink)/90">{e.p}</p>}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {e.k.map((t) => <span key={t} className={`${DISPLAY} rounded-full px-3 py-0.5 text-[11px] uppercase tracking-[0.06em] text-(--sse-on)`} style={{ background: TYPES[t].c }}>{TYPES[t].n}</span>)}
                {e.v && <button type="button" onClick={goVinyl} className={`${DISPLAY} rounded-full bg-(--sse-on) px-3 py-0.5 text-[11px] uppercase tracking-[0.06em] text-(--sse-y)`}>Vinyl release ↑</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Reveal className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 rounded-[28px] bg-(--sse-y) px-[clamp(1.25rem,2.6vw,1.75rem)] py-5 text-(--sse-on)">
        <b className={`${DISPLAY} text-[clamp(2rem,4vw,2.6rem)] uppercase leading-none tracking-[-0.02em]`}>and more</b>
        <p className="break-keep text-[15.5px] leading-6">이 밖에도 프로그램이 더 추가될 예정이에요. 새 소식이 나오면 이 글에 이어서 올릴게요.</p>
      </Reveal>
    </section>
  );
}

/* ───────────── 8 알아두기 + 마무리 ───────────── */
const NOTES = [
  "모든 공연은 무료로 진행돼요.",
  "행사 중간에 새로운 프로그램이 추가될 수 있어요.",
  "일부 워크샵은 재료비가 포함돼요.",
  "피지컬 음반을 현장에서 구매하면 10%의 결제 수수료가 추가돼요.",
  "티켓 예매는 sse-record.com에서 진행해요. 회원가입 시 본인인증이 필요해요.",
];
function Notes() {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="07" label="Good to know" title="Good to know" bg="bg-(--sse-y)" />
      <ul className="mt-12 max-w-3xl">
        {NOTES.map((n, i) => (
          <Reveal as="li" key={n} delay={i * 60} className="relative break-keep border-t-2 border-(--ink) py-3.5 pl-8 text-[15px] leading-7">
            <span aria-hidden="true" className="absolute left-0.5 top-[22px] size-3 rounded-full bg-(--sse-y)" />{n}
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function Closing() {
  return (
    <section className={`${WRAP} flex flex-col items-center pb-10 pt-[clamp(1rem,4vw,3rem)] text-center`}>
      <Reveal className="size-20 overflow-hidden rounded-full bg-white"><img src="/images/news/sse-pbr-fest/mascot.webp" alt="쎄 프로젝트 마스코트" className="size-full object-cover" loading="lazy" /></Reveal>
      <Reveal delay={150} as="p" className={`${DISPLAY} mt-6 text-[clamp(2.2rem,5vw,4.4rem)] uppercase leading-[0.95] tracking-[-0.02em]`}>See you at DDP</Reveal>
      <Reveal delay={300} as="p" className="mx-auto mt-5 max-w-md break-keep text-[15px] leading-6 text-(--ink)/85">주최 측 공지를 기준으로 정리했어요. 일정은 바뀔 수 있으니 최신 소식은 sse-record.com에서 확인하세요.</Reveal>
      <Reveal delay={400} className="mt-8"><a href={SITE} target="_blank" rel="noreferrer" className={BTN}>sse-record.com <span aria-hidden="true">↗︎</span></a></Reveal>
      <p className="mt-10 text-[11px] text-(--ink)/45">포스터·마스코트 © 쎄 프로젝트(SSE PROJECT)</p>
    </section>
  );
}

export default function Story() {
  return (
    <div style={VARS} className="font-bold">
      <Hero />
      <About />
      <Venue />
      <Entry />
      <Floor />
      <Vinyl />
      <Schedule />
      <Notes />
      <Closing />
    </div>
  );
}
