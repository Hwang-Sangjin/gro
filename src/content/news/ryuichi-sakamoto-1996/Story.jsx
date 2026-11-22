"use client";
// News — "Ryuichi Sakamoto, 1996" (30주년 2LP 재발매)
// 1 히어로(실제 커버 + 빠져나오는 판, 판매 정보) → 2 세 대의 악기(트리오) → 3 곡과 영화(시네마스코프 프레임 + 자막)
// → 4 네 면(A–D) → 5 사카모토의 길(연표) → 6 구매 안내 → 7 Grooves 컬렉션 · 출처
// 영화 스틸·포스터는 쓰지 않음(저작권) — 장면은 글로 설명하고 그림은 사이트 톤의 SVG 로
// 사실 정보: 판매 공지(인스타그램, 2026-11), Milan Records 30주년 2LP 소개, 원반 크레딧(Wikipedia · 2026-11-22 확인)
import { MONOTON } from "@/lib/fonts";
import { useRef } from "react";
import Link from "next/link";
import { coverUrl } from "@/lib/albums";
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

function Head({ n, label, lines, children }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-end">
      <div>
        <Reveal as="p" className={`${LABEL} text-(--accent) tabular-nums`}>{n} — {label}</Reveal>
        <RiseText lines={lines} className={`${SERIF} mt-4 text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[0.9]`} />
      </div>
      {children && <Reveal delay={200} as="p" className="max-w-[46ch] break-keep text-[15px] leading-7 text-(--ink)/75 md:pb-2">{children}</Reveal>}
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

const FACTS = [["Price", "57,500원"], ["On sale", "11.9 — 재고 소진 시까지"], ["Ships", "12월 중순 발매 후"], ["Format", "2LP · 33⅓ RPM"]];

function Hero({ row, loading }) {
  return (
    <section className="relative overflow-hidden pb-[clamp(3rem,8vw,6rem)] pt-[calc(var(--ct-header-h,106px)+56px)]">
      <div className={`${WRAP} grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,600px)]`}>
        <div>
          <Reveal as="p" className={`${LABEL} text-(--accent)`}>News · Reissue · 30th Anniversary</Reveal>
          <RiseText as="h1" lines={["Ryuichi", "Sakamoto,", "1996"]} delay={120} className={`${MONOTON} mt-5 text-[clamp(2.4rem,5.6vw,5.6rem)] leading-[1.04]`} />
          <Reveal delay={450} as="p" className="mt-7 max-w-[44ch] break-keep text-[clamp(1rem,1.4vw,1.2rem)] leading-8 text-(--ink)/80">
            피아노 한 대, 첼로 한 대, 바이올린 한 대. 류이치 사카모토가 자신의 영화음악을 트리오로 다시 연주한 <i>1996</i>이 30주년을 맞아 2LP로 다시 나와요. 일본 밖에서 이 앨범이 바이닐로 나오는 건 처음이에요.
          </Reveal>
          <Reveal delay={600} as="dl" className="mt-9 grid max-w-[560px] grid-cols-2 border-t-[3px] border-(--ink) sm:grid-cols-4">
            {FACTS.map(([k, v]) => (
              <div key={k} className="border-b border-(--ink)/20 py-3 pr-3">
                <dt className="text-[10px] font-medium uppercase tracking-[0.26em] text-(--ink)/55">{k}</dt>
                <dd className="mt-1 break-keep text-[14px] font-semibold leading-6">{v}</dd>
              </div>
            ))}
          </Reveal>
        </div>
        <Reveal delay={300}><Sleeve row={row} loading={loading} /></Reveal>
      </div>
    </section>
  );
}

/* ───────────── 2 트리오 ───────────── */
const TRIO = [
  { inst: "Piano", who: "Ryuichi Sakamoto", note: "멜로디와 화성을 함께 쥐고, 원곡의 오케스트라와 신시사이저가 하던 일을 혼자 맡아요." },
  { inst: "Cello", who: "Jaques Morelenbaum", note: "브라질 출신 첼리스트. 낮은 선율로 곡의 바닥을 받치고, 때로는 멜로디를 넘겨받아요." },
  { inst: "Violin", who: "Everton Nelson 외", note: "대부분은 에버튼 넬슨이, 몇 곡은 데이비드 네이디언과 배리 핀클레어가 연주했어요." },
];
function Strings() {   // 세 줄: 위에서부터 피아노(건반) · 첼로(굵은 현) · 바이올린(가는 현)
  return (
    <svg viewBox="0 0 600 60" className="h-auto w-full text-(--ink)" aria-hidden="true">
      <path d="M0 30 C150 6 300 54 450 30 S600 30 600 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        className="[stroke-dasharray:900] [stroke-dashoffset:900] group-data-[seen=true]:[stroke-dashoffset:0] transition-[stroke-dashoffset] duration-[2200ms] ease-groove" />
    </svg>
  );
}
function Trio() {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="01" label="Piano trio" lines={["Three", "instruments"]}>
        <i>1996</i>은 영화를 위해 썼던 곡들을 피아노·첼로·바이올린 세 대로 다시 편곡한 앨범이에요. 큰 오케스트라가 빠지자 멜로디가 더 가깝게, 더 조용하게 들려요. 뉴욕의 라이트 트랙 스튜디오에서 녹음했고, 새로 쓴 곡 두 곡도 함께 실렸어요.
      </Head>
      <ul className="mt-14 grid gap-px overflow-hidden rounded-[6px] border-[3px] border-(--ink) bg-(--ink) md:grid-cols-3">
        {TRIO.map((t, i) => (
          <Reveal as="li" key={t.inst} delay={i * 140} className="group bg-(--cream) p-[clamp(1.25rem,2.6vw,2.25rem)]">
            <p className={`${LABEL} text-(--accent) tabular-nums`}>0{i + 1}</p>
            <p className={`${SERIF} mt-3 text-[clamp(2.2rem,3.6vw,3.4rem)] leading-[0.95]`}>{t.inst}</p>
            <div className="mt-4" style={{ opacity: 1 - i * 0.18 }}><Strings /></div>
            <p className="mt-3 text-[13px] font-semibold">{t.who}</p>
            <p className="mt-2 break-keep text-[14px] leading-7 text-(--ink)/70">{t.note}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/* ───────────── 3 곡과 영화 ───────────── */
// 장면 그림: 시네마스코프(2.39:1) 검은 프레임 안의 단순한 SVG — 영화 스틸 대신
const C = "#f4e7cd";
const MOTIF = {
  // 밤하늘 별 + 큰 별 하나 (크리스마스)
  stars: (
    <g fill={C}>
      {Array.from({ length: 46 }, (_, i) => <circle key={i} cx={(i * 53) % 240} cy={6 + ((i * 37) % 70)} r={i % 7 === 0 ? 0.9 : 0.45} opacity={0.3 + (i % 4) * 0.15} />)}
      <path d="M172 26l1.6 5 5 1.6-5 1.6-1.6 5-1.6-5-5-1.6 5-1.6z" className="origin-[172px_32px] animate-pulse" />
      <path d="M0 86 Q60 78 120 84 T240 80 V100 H0z" fill="#1d181b" />
    </g>
  ),
  // 비 (Rain)
  rain: (
    <g stroke={C} strokeLinecap="round">
      <g className="animate-[rain_0.9s_linear_infinite] motion-reduce:animate-none">
        {Array.from({ length: 60 }, (_, i) => <line key={i} x1={(i * 41) % 250 - 5} y1={((i * 29) % 120) - 20} x2={(i * 41) % 250 - 9} y2={((i * 29) % 120) - 8} strokeWidth=".5" opacity={0.25 + (i % 3) * 0.15} />)}
      </g>
      <path d="M96 86v-16a7 7 0 0 1 14 0v16" fill="none" strokeWidth=".8" opacity=".7" />
      <circle cx="103" cy="60" r="4" fill="none" strokeWidth=".8" opacity=".7" />
    </g>
  ),
  // 모래 언덕과 해 (The Sheltering Sky)
  dunes: (
    <g>
      <circle cx="168" cy="40" r="13" fill="#e3b04b" opacity=".9" />
      <path d="M0 72 Q50 54 100 70 T200 64 T240 68 V100 H0z" fill="#8a5a2b" />
      <path d="M0 84 Q70 70 130 84 T240 80 V100 H0z" fill="#5b3a1e" />
    </g>
  ),
  // 무대 조명과 마이크 (하이힐 — 가수 엄마)
  stage: (
    <g>
      <path d="M120 0 L84 92 H156z" fill={C} opacity=".12" />
      <path d="M120 40v44" stroke={C} strokeWidth=".8" />
      <rect x="117" y="32" width="6" height="10" rx="3" fill="#a83a2c" />
      <path d="M108 92h24" stroke={C} strokeWidth=".8" />
    </g>
  ),
  // 바람 부는 황야 (폭풍의 언덕)
  moor: (
    <g fill="none" stroke={C} strokeLinecap="round">
      <path d="M0 76 Q60 60 120 72 T240 66" strokeWidth=".8" />
      <path d="M0 86 Q80 74 160 84 T240 82" strokeWidth=".8" opacity=".6" />
      {[[30, 30], [80, 22], [140, 36], [190, 26]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q12 -5 24 0 t24 0`} strokeWidth=".6" opacity=".5" />)}
      <path d="M196 66v-10 M196 58l-5-6 M196 60l5-7" strokeWidth=".8" />
    </g>
  ),
  // 해와 연꽃 (리틀 부다)
  lotus: (
    <g>
      <circle cx="120" cy="44" r="18" fill="#e3b04b" opacity=".85" />
      <g fill="none" stroke={C} strokeWidth=".8">
        <path d="M120 86 C110 76 110 66 120 58 C130 66 130 76 120 86z" />
        <path d="M120 86 C104 82 96 72 98 64 C110 66 118 76 120 86z" />
        <path d="M120 86 C136 82 144 72 142 64 C130 66 122 76 120 86z" />
        <path d="M80 88h80" opacity=".5" />
      </g>
    </g>
  ),
  // 도시의 밤과 발코니 (바벨 — 도쿄)
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

const FILMS = [
  {
    motif: "stars", ko: "전장의 크리스마스", en: "Merry Christmas, Mr. Lawrence", year: 1983, dir: "오시마 나기사",
    tracks: [["B2", "Merry Christmas Mr. Lawrence"]],
    scene: "1942년 자바의 일본군 포로수용소. 사카모토는 이 영화의 음악을 맡으면서 수용소장 요노이 대위 역으로 직접 출연해, 포로 셀리어스 역의 데이비드 보위와 마주 섰어요.",
    cue: "전쟁이 끝나고 처형을 앞둔 하라 상사(기타노 다케시)가 찾아온 로렌스에게 웃으며 인사를 건네는 마지막 장면. 그 한마디 뒤로 이 주제가 흘러요.",
    sub: "“Merry Christmas, Mr. Lawrence.”",
    listen: "원곡의 반짝이는 신시사이저 대신 피아노가 멜로디를 쥐어요. 더 느리고, 더 쓸쓸해요.",
  },
  {
    motif: "rain", ko: "마지막 황제", en: "The Last Emperor", year: 1987, dir: "베르나르도 베르톨루치",
    tracks: [["A2", "Rain"], ["A4", "The Last Emperor"]],
    scene: "청나라의 마지막 황제 푸이의 일생. 사카모토는 데이비드 번, 쑹충(Cong Su)과 함께 음악을 맡아 아카데미 음악상을 받았고, 만주국의 아마카스 역으로 출연도 했어요.",
    cue: "“Rain”은 후궁 원슈가 푸이에게 이혼을 선언하고 그를 떠나는 장면의 곡이에요. 빗속으로 걸어 나가는 뒷모습 위로 현악이 쏟아져요.",
    sub: "♪ Rain",
    listen: "“Rain”은 바이올린과 첼로가 빗줄기처럼 쉬지 않고 몰아쳐요. 앨범에서 가장 숨 가쁜 곡이에요.",
  },
  {
    motif: "dunes", ko: "The Sheltering Sky", en: "The Sheltering Sky", year: 1990, dir: "베르나르도 베르톨루치",
    tracks: [["B4", "The Sheltering Sky"]],
    scene: "폴 볼스의 소설을 옮긴 영화. 서로에게 지친 미국인 부부(존 말코비치, 데브라 윙어)가 북아프리카의 사막 깊숙이 여행을 떠나요. 사카모토는 이 음악으로 골든글로브 음악상을 받았어요.",
    cue: "음악은 인물보다 풍경을 비출 때 크게 흘러요. 끝없는 모래 언덕과, 제목처럼 모든 걸 덮고 있는 넓은 하늘.",
    sub: "♪ The Sheltering Sky",
    listen: "첼로가 길게 끄는 첫 음부터 사막의 열기가 느껴져요. 트리오 편성이라 오히려 더 넓게 들려요.",
  },
  {
    motif: "stage", ko: "하이힐", en: "High Heels", year: 1991, dir: "페드로 알모도바르",
    tracks: [["C2", "High Heels (Main Theme)"]],
    scene: "오랜만에 마드리드로 돌아온 스타 가수 엄마와, 엄마의 그늘에서 자란 딸. 알모도바르다운 강렬한 색과 멜로드라마가 가득한 영화예요.",
    cue: "엄마와 딸 사이에 쌓인 원망과 그리움이 터져 나올 때마다, 탱고처럼 끈적한 주제가 따라붙어요.",
    sub: "♪ High Heels",
    listen: "피아노의 낮은 리듬 위로 바이올린이 유혹하듯 미끄러져요. 앨범에서 가장 ‘영화 같은’ 곡.",
  },
  {
    motif: "moor", ko: "폭풍의 언덕", en: "Wuthering Heights", year: 1992, dir: "피터 코스민스키",
    tracks: [["C4", "The Wuthering Heights"]],
    scene: "에밀리 브론테의 소설을 옮긴 영화(줄리엣 비노쉬, 랄프 파인즈). 바람 부는 요크셔 황야에서 캐서린과 히스클리프의 사랑이 집착으로 번져 가요.",
    cue: "황야를 휘젓는 바람처럼, 짧은 선율이 되풀이되며 점점 거세져요.",
    sub: "♪ The Wuthering Heights",
    listen: "첼로와 바이올린이 서로를 쫓듯 주고받아요. 두 사람의 관계처럼.",
  },
  {
    motif: "lotus", ko: "리틀 부다", en: "Little Buddha", year: 1993, dir: "베르나르도 베르톨루치",
    tracks: [["D2", "Acceptance (End Credits) – Little Buddha"]],
    scene: "티베트 승려들이 스승의 환생이라 믿는 미국 시애틀의 한 소년을 찾아와요. 그 이야기 사이로 젊은 싯다르타(키아누 리브스)가 깨달음에 이르는 이야기가 함께 펼쳐져요.",
    cue: "제목 그대로 엔딩 크레딧의 곡. 영화가 끝난 뒤 객석에 남는 고요함을 닮았어요.",
    sub: "♪ Acceptance",
    listen: "7분 반, 이 앨범에서 가장 긴 곡이에요. 서두르지 말고 끝까지.",
  },
  {
    motif: "city", ko: "바벨", en: "Babel", year: 2006, dir: "알레한드로 곤살레스 이냐리투",
    tracks: [["A3", "Bibo no Aozora"]],
    scene: "원래는 영화음악이 아니라 1995년 앨범 Smoochy에 실린 곡이에요. 10년 뒤 모로코·멕시코·도쿄를 잇는 영화 바벨에 쓰이면서, 영화음악처럼 더 널리 알려졌어요.",
    cue: "도쿄의 고층 아파트 발코니, 말없이 서로를 안는 아버지와 딸. 영화의 마지막에 이 곡이 흘러요.",
    sub: "♪ Bibo no Aozora",
    listen: "제목은 ‘아름다운 얼굴의 푸른 하늘’. 바이올린이 노래하듯 멜로디를 이끌어요.",
  },
];

function Frame({ motif, sub }) {
  return (
    <div className="relative overflow-hidden rounded-[3px] bg-[#141114] shadow-[0_30px_60px_-34px_rgba(0,0,0,.7)]">
      <svg viewBox="0 0 240 100" className="block h-auto w-full" aria-hidden="true">{MOTIF[motif]}</svg>
      {/* 시네마스코프 위아래 검은 띠 + 자막 */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[7%] bg-black" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[7%] bg-black" />
      <p aria-hidden="true" className="absolute inset-x-0 bottom-[11%] text-center font-['Hahmlet',serif] text-[clamp(11px,1.5vw,16px)] font-semibold text-[#f6e9a8] [text-shadow:0_1px_2px_#000]">{sub}</p>
    </div>
  );
}

function Film({ f, i }) {
  const flip = i % 2 === 1;
  return (
    <Reveal as="li" className="grid items-center gap-[clamp(2rem,5vw,5rem)] border-t border-(--ink)/20 py-[clamp(3.5rem,8vw,6.5rem)] md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className={flip ? "md:order-2" : ""}>
        <Frame motif={f.motif} sub={f.sub} />
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/55 tabular-nums">
          <span>{f.year}</span><span className="h-px w-6 bg-current/50" /><span lang="ko" className="normal-case tracking-normal">감독 {f.dir}</span>
        </p>
      </div>
      <div className={flip ? "md:order-1" : ""}>
        <p className={`${LABEL} flex flex-wrap gap-x-3 text-(--accent) tabular-nums`}>
          {f.tracks.map(([side, t]) => <span key={t}>{side} · {t}</span>)}
        </p>
        <h3 className={`${SERIF} mt-4 text-[clamp(2.2rem,4.4vw,4rem)] leading-[0.94]`}>{f.ko}</h3>
        {f.ko !== f.en && <p className="mt-2 text-[13px] italic text-(--ink)/55">{f.en}</p>}
        <p className="mt-5 max-w-[50ch] break-keep text-[16px] leading-8 text-(--ink)/85">{f.scene}</p>
        <div className="mt-6 max-w-[50ch] border-l-2 border-(--accent) pl-4">
          <p className="text-[12px] font-medium text-(--ink)">The scene</p>
          <p className="mt-1 break-keep text-[14px] leading-7 text-(--ink)/75">{f.cue}</p>
          <p className="mt-4 text-[12px] font-medium text-(--ink)">1996에서 들어 볼 것</p>
          <p className="mt-1 break-keep text-[14px] leading-7 text-(--ink)/75">{f.listen}</p>
        </div>
        <a href={yt(`Ryuichi Sakamoto ${f.tracks[0][1].replace(/\s*\(.*$/, "")} 1996`)} target="_blank" rel="noreferrer"
          className={`${PILL} mt-7 bg-(--ink) text-(--cream) hover:bg-(--accent)`}>
          YouTube에서 듣기 <span aria-hidden="true">↗︎</span>
        </a>
      </div>
    </Reveal>
  );
}

function Films() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="02" label="Scores & scenes" lines={["Music for", "the movies"]}>
        열여섯 곡 가운데 여덟 곡이 영화와 이어져 있어요. 영화가 나온 순서대로, 그 곡이 흐르는 장면과 이번 트리오 버전에서 귀 기울일 부분을 골랐어요.
      </Head>
      <ol className="mt-12 border-b border-(--ink)/20">
        {FILMS.map((f, i) => <Film key={f.en} f={f} i={i} />)}
      </ol>
    </section>
  );
}

/* ───────────── 4 네 면 ───────────── */
// 30주년 2LP 면 구성 (해외 판매처 공개 목록 기준). film: 영화와 이어진 곡
const SIDES = [
  ["A", [["A Day a Gorilla Gives a Banana", "새 곡"], ["Rain", "마지막 황제", 1], ["Bibo no Aozora", "바벨", 1], ["The Last Emperor", "마지막 황제", 1]]],
  ["B", [["1919", "새 곡"], ["Merry Christmas Mr. Lawrence", "전장의 크리스마스", 1], ["M.A.Y. in the Backyard", "1984 · 음악도감"], ["The Sheltering Sky", "The Sheltering Sky", 1]]],
  ["C", [["A Tribute to N.J.P.", "백남준에게"], ["High Heels (Main Theme)", "하이힐", 1], ["Aoneko no Torso", "1995 · Smoochy"], ["The Wuthering Heights", "폭풍의 언덕", 1]]],
  ["D", [["Parolibre", "1986 · Futurista"], ["Acceptance – Little Buddha", "리틀 부다", 1], ["Before Long", "1987 · Neo Geo"], ["Self Portrait", ""]]],
];
function Sides() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="03" label="Two records, four sides" lines={["Side A", "to Side D"]}>
        두 장의 판에 네 곡씩. 한 면만 먼저 듣는다면 B면을 권해요 — 전장의 크리스마스에서 The Sheltering Sky로 넘어가는 흐름이 이 앨범의 한가운데예요.
      </Head>
      <div className="mt-12 grid gap-x-[clamp(1.5rem,3vw,3rem)] gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
        {SIDES.map(([side, tracks], i) => (
          <Reveal key={side} delay={i * 120} className={`rounded-[6px] border-[3px] border-(--ink) p-5 ${side === "B" ? "bg-(--ink) text-(--cream)" : ""}`}>
            <div className="flex items-baseline justify-between">
              <p className={`${SERIF} text-[56px] leading-none`}>{side}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.26em] opacity-60">{i < 2 ? "Record 1" : "Record 2"}{side === "B" && " · Start here"}</p>
            </div>
            <ol className="mt-4">
              {tracks.map(([t, from, film], k) => (
                <li key={t} className="grid grid-cols-[22px_1fr] gap-2 border-t border-current/20 py-2.5">
                  <span className="pt-0.5 text-[11px] tabular-nums opacity-55">{k + 1}</span>
                  <span>
                    <span className="block text-[14px] font-semibold leading-6">{t}</span>
                    {from && <span className={`block text-[12px] leading-5 ${film ? "text-(--accent)" : "opacity-60"} ${side === "B" && film ? "text-[#7fc1bd]!" : ""}`}>{film ? "▸ " : ""}{from}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-10 grid gap-4 md:grid-cols-2">
        <p className="break-keep border-l-2 border-(--accent) pl-4 text-[14px] leading-7 text-(--ink)/75">
          <b className="text-(--ink)">C1 · A Tribute to N.J.P.</b> — N.J.P.는 비디오 아트의 아버지 백남준이에요. 사카모토는 그와 오래 교류했고, 1984년 앨범 <i>음악도감</i>에서 이 곡을 그에게 바쳤어요.
        </p>
        <p className="break-keep border-l-2 border-(--ink)/30 pl-4 text-[13px] leading-6 text-(--ink)/60">
          면 구성은 해외 판매처에 공개된 목록 기준이에요. 원래 CD의 16번 “Bring them home” 자리에 D면 마지막 곡 “Self Portrait”가 적혀 있어서, 실제 판에서 한 번 더 확인할 예정이에요.
        </p>
      </Reveal>
    </section>
  );
}

/* ───────────── 5 연표 ───────────── */
const LIFE = [
  ["1952", "도쿄에서 태어나요. 어려서부터 피아노와 작곡을 배우고, 도쿄예술대학에서 작곡을 공부해요."],
  ["1978", "첫 솔로 앨범 Thousand Knives. 같은 해 호소노 하루오미, 다카하시 유키히로와 Yellow Magic Orchestra(YMO)를 결성해 전자음악의 얼굴이 돼요."],
  ["1983", "전장의 크리스마스. 처음 맡은 영화음악이자, 배우로도 데뷔한 작품."],
  ["1988", "마지막 황제로 아카데미 음악상. 이후 베르톨루치와 The Sheltering Sky, 리틀 부다를 함께 해요."],
  ["1996", "뉴욕에서 트리오 앨범 1996을 녹음하고, 같은 해 트리오 월드 투어를 돌아요.", true],
  ["1999", "피아노 소품 “Energy Flow”가 일본에서 크게 히트하며 기악곡으로는 드문 기록을 남겨요."],
  ["2015", "인후암 치료로 쉬었다가 레버넌트의 음악으로 돌아와요."],
  ["2017", "async. 소리 그 자체에 귀 기울인, 말년의 대표작."],
  ["2023", "1월, 마지막 앨범 12. 3월 28일, 일흔한 살로 세상을 떠나요."],
];
function Life() {
  return (
    <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
      <div className={`${WRAP} py-[clamp(4rem,10vw,8rem)]`}>
        <Reveal as="p" className={`${LABEL} text-[#7fc1bd]`}>04 — A life in music</Reveal>
        <RiseText lines={["From YMO", "to 12"]} className={`${SERIF} mt-4 text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[0.9]`} />
        <ol className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {LIFE.map(([y, t, hi], i) => (
            <Reveal as="li" key={y} delay={(i % 3) * 120} className={`grid grid-cols-[84px_1fr] gap-4 border-t py-5 ${hi ? "border-[#7fc1bd]" : "border-(--cream)/20"}`}>
              <span className={`${SERIF} text-[30px] leading-none tabular-nums ${hi ? "text-[#7fc1bd]" : ""}`}>{y}</span>
              <span className="break-keep text-[14px] leading-7 text-(--cream)/80">{t}</span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ───────────── 6 구매 안내 ───────────── */
function Row({ k, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 border-b border-dashed border-(--ink)/25 py-4 sm:grid-cols-[150px_1fr]">
      <dt className="pt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/55">{k}</dt>
      <dd className="break-keep text-[16px] leading-7">{children}</dd>
    </div>
  );
}
function Buy({ row }) {
  return (
    <section className={SECTION}>
      <Head n="05" label="How to buy" lines={["Where &", "when"]}>
        1996년 일본에서만 나왔던 오리지널 2LP는 지금 중고 시장에서 비싼 값에 거래돼요. 이번 반은 원래 디자인 그대로, 바이닐에 맞게 새로 리마스터했어요.
      </Head>
      <Reveal className="mt-12 grid overflow-hidden rounded-[6px] border-[3px] border-(--ink) md:grid-cols-[1fr_260px]">
        <dl className="p-[clamp(1.25rem,3vw,2.5rem)]">
          <Row k="가격">57,500원</Row>
          <Row k="판매 기간">2026년 11월 9일부터 재고 소진 시까지</Row>
          <Row k="배송">2026년 12월 중순 발매 이후 순차 배송</Row>
          <Row k="구성">2LP · 33⅓ RPM · Milan Records 30주년 에디션</Row>
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
    </section>
  );
}

// 이번 반 말고 Grooves 에 있는 다른 사카모토 앨범 (생기면 자동으로 보임)
function MoreFrom({ rows }) {
  if (!rows.length) return null;
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="06" label="Also on Grooves" lines={["More from", "Sakamoto"]} />
      <ul className="mt-12 grid grid-cols-2 gap-x-[clamp(1rem,3vw,2.5rem)] gap-y-10 md:grid-cols-4">
        {rows.map((a) => (
          <li key={a.slug}>
            <Link href={`/album/${a.slug}`} className="group block">
              <div className="aspect-square overflow-hidden rounded-[3px]" style={{ background: a.cover_color || "var(--cover-bg)" }}>
                {a.thumb_path && <img src={coverUrl(a.thumb_path)} alt={`Ryuichi Sakamoto — ${a.title}`} loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover transition-transform duration-700 group-hover:scale-[1.04]" />}
              </div>
              <p className={`${SERIF} mt-4 text-[clamp(1.3rem,2vw,1.8rem)] leading-[1.05] group-hover:text-(--accent)`}>{a.title}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Story() {
  const rows = useSakamoto();
  const row = rows?.find((a) => a.slug === ALBUM_SLUG) ?? null;
  const others = (rows ?? []).filter((a) => a !== row);
  return (
    <>
      <style>{`@keyframes rain { from { transform: translateY(-14px) } to { transform: translateY(14px) } }`}</style>
      <Hero row={row} loading={rows === null} />
      <Trio />
      <Films />
      <Sides />
      <Life />
      <Buy row={row} />
      <MoreFrom rows={others} />
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
