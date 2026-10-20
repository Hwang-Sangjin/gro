"use client";
// News — "Daniel Caesar, Pressed for Korea"
// 1 히어로(마블 판 세 장) → 2 왜 반가운지 → 3 세 장 (발매순, 판 사양 + 추천곡) → 4 구매 안내 → 5 Grooves 컬렉션 · 출처
// 사실 정보는 세컨드트랙 코리아 공지(인스타그램, 2026-10)와 발매 정보 기준
// 앨범 커버·링크는 Grooves DB(albums)에서 가져옴 — 없으면 마블 판만 보여줌
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";
import Reveal, { RiseText } from "@/components/story/Reveal";
import MarbleDisc from "@/components/story/MarbleDisc";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const SECTION = `${WRAP} py-[clamp(4rem,10vw,8rem)]`;
const SHOP = "https://secondtrack.kr";
const NOTICE = "https://www.instagram.com/p/DeeTEGigRZ5/";
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

// 발매 순서대로. disc: 마블 색 [많은 색, 중간, 적은 색]
const RECORDS = [
  {
    code: "ST0006R", title: "Pilgrim’s Paradise", slug: "daniel-caesar-pilgrims-paradise", year: 2015, kind: "EP",
    spec: ["180g 1LP", "블랙 & 화이트 마블", "싱글 재킷", "2P 인서트"],
    disc: ["#141113", "#ece7dc", "#5d5a58"], seed: 7,
    text: "이름이 알려지기 전, 토론토에서 낸 첫 EP. 가스펠과 블루스에 뿌리를 둔 목소리가 이미 또렷해요.",
    song: "Death & Taxes", why: "블루스 기타를 뜯으며 시작하는 발라드. 믿음과 사랑 사이를 오가는 가사가 초기 다니엘 시저의 색을 가장 잘 보여줘요.",
  },
  {
    code: "ST0004R", title: "Freudian", slug: "daniel-caesar-freudian", year: 2017, kind: "1st album",
    spec: ["180g 2LP", "블루, 그린 & 화이트 마블", "게이트폴드 재킷", "4P 인서트"],
    disc: ["#2f5fa8", "#3f8a5c", "#f2efe6"], seed: 3,
    text: "그를 세상에 알린 첫 정규 앨범. 가스펠 화성과 R&B가 섞인, 느리고 따뜻한 앨범이에요.",
    song: "Best Part (feat. H.E.R.)", why: "H.E.R.와 주고받는 듀엣. 기타 한 대로 시작해 둘의 목소리만으로 채워지는, 이 앨범에서 가장 사랑받은 곡이에요.",
  },
  {
    code: "ST0005R", title: "Case Study 01", slug: "daniel-caesar-case-study-01", year: 2019, kind: "2nd album",
    spec: ["180g 1LP", "블루, 레드 & 블랙 마블", "싱글 재킷", "2P 인서트"],
    disc: ["#1d3a86", "#141113", "#b8322a"], seed: 11,
    text: "Pharrell, Brandy, John Mayer 등이 함께한 두 번째 정규 앨범. 전작보다 실험적이고 그루브가 살아 있어요.",
    song: "Cyanide", why: "사랑을 독약에 빗댄 노래. 담백한 리듬 위로 흘러가는 목소리가 매력이고, 나중에 Koffee가 참여한 버전도 나왔어요.",
    note: "초기 목업보다 블루가 더 진하게 제작되어 목업 이미지가 바뀌었지만, 해외 발매반과 같은 제품이에요.",
  },
];

const low = (v) => String(v ?? "").toLowerCase().replace(/[’']/g, "").trim();

// Grooves DB 에 있는 다니엘 시저 앨범 전부 (공개된 것만, 발매순)
function useCaesar() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let off = false;
    createClient().from("albums")
      .select("slug, title, artist_names, thumb_path, cover_color, release_year")
      .eq("status", "published").ilike("artist_names", "%daniel caesar%")
      .then(({ data }) => {
        if (off || !data) return;
        setRows([...data].sort((a, b) => (a.release_year ?? 0) - (b.release_year ?? 0) || a.title.localeCompare(b.title)));
      }, () => {});
    return () => { off = true; };
  }, []);
  return rows;
}
const findRow = (rows, r) => rows.find((a) => a.slug === r.slug) ?? rows.find((a) => low(a.title) === low(r.title));

function Head({ n, label, lines, children }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-end">
      <div>
        <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent) tabular-nums">{n} — {label}</Reveal>
        <RiseText lines={lines} className={`${SERIF} mt-4 text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[0.9]`} />
      </div>
      {children && <Reveal delay={200} as="p" className="max-w-[46ch] break-keep text-[15px] leading-7 text-(--ink)/75 md:pb-2">{children}</Reveal>}
    </div>
  );
}

// 한 장: 왼쪽 판(천천히 돎) + 오른쪽 정보
// 커버가 있으면 슬리브 뒤로 판이 반쯤 빠져나온 모양, 없으면 판만
function Record({ r, i, row }) {
  const flip = i % 2 === 1;
  const spin = "block w-full animate-spin drop-shadow-[0_24px_30px_rgba(0,0,0,.28)] [animation-duration:18s] motion-reduce:animate-none";
  return (
    <Reveal as="li" className="grid items-center gap-[clamp(2rem,5vw,5rem)] border-t border-(--ink)/20 py-[clamp(3rem,7vw,6rem)] md:grid-cols-[minmax(0,520px)_1fr]">
      {row?.thumb_path ? (
        <div className={`relative mx-auto aspect-[1.4/1] w-[min(86vw,520px)] ${flip ? "md:order-2" : ""}`}>
          <div className={`absolute top-[4%] w-[66%] ${flip ? "left-0" : "right-0"}`}>
            <MarbleDisc colors={r.disc} seed={r.seed} className={spin} />
          </div>
          <Link href={`/album/${row.slug}`} aria-label={`${r.title} — Grooves에서 보기`}
            className={`absolute top-[2%] z-10 aspect-square w-[70%] overflow-hidden rounded-[3px] shadow-[0_30px_60px_-28px_rgba(0,0,0,.6)] transition-transform duration-500 hover:-translate-y-1 ${flip ? "right-0" : "left-0"}`}
            style={{ background: row.cover_color || "var(--cover-bg)" }}>
            <img src={coverUrl(row.thumb_path)} alt={`Daniel Caesar — ${row.title}`} loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover" />
          </Link>
        </div>
      ) : (
        <div className={`relative mx-auto w-[min(72vw,400px)] ${flip ? "md:order-2" : ""}`}>
          <MarbleDisc colors={r.disc} seed={r.seed} className={spin} />
        </div>
      )}
      <div className={flip ? "md:order-1" : ""}>
        <p className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-(--accent) tabular-nums">
          <span>{r.code}</span><span className="h-px w-8 bg-current" /><span>{r.year} · {r.kind}</span>
        </p>
        <h3 className={`${SERIF} mt-4 text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.92]`}>{r.title}</h3>
        <p className="mt-5 max-w-[48ch] break-keep text-[16px] leading-8 text-(--ink)/85">{r.text}</p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {r.spec.map((t) => <li key={t} className="rounded-full border border-(--ink)/30 px-3 py-1 text-[12px]">{t}</li>)}
        </ul>
        {r.note && <p className="mt-3 max-w-[52ch] break-keep text-[12px] leading-6 text-(--ink)/55">* {r.note}</p>}
        <div className="mt-7 max-w-[48ch] border-l-2 border-(--accent) pl-4">
          <p className="text-[12px] font-medium text-(--ink)">추천 곡 · <span className="text-[15px]">“{r.song}”</span></p>
          <p className="mt-2 break-keep text-[14px] leading-7 text-(--ink)/70">{r.why}</p>
        </div>
        <div className="mt-7 flex flex-wrap gap-2">
          <a href={yt(`Daniel Caesar ${r.song.replace(/\s*\(.*\)$/, "")}`)} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
            YouTube에서 듣기 <span aria-hidden="true">↗︎</span>
          </a>
          {row && (
            <Link href={`/album/${row.slug}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--accent) hover:bg-(--accent) hover:text-(--cream)">
              Grooves에서 보기 <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function Row({ k, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 border-b border-dashed border-(--ink)/25 py-4 sm:grid-cols-[150px_1fr]">
      <dt className="pt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/55">{k}</dt>
      <dd className="break-keep text-[16px] leading-7">{children}</dd>
    </div>
  );
}

// 이번 발매 말고 Grooves 에 있는 다른 앨범들
function MoreFrom({ rows }) {
  if (!rows.length) return null;
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="04" label="Also on Grooves" lines={["More from", "Daniel Caesar"]}>
        이번 국내반 말고도 Grooves에 등록된 다니엘 시저의 앨범들이에요. 눌러서 트랙과 판 정보를 볼 수 있어요.
      </Head>
      <ul className="mt-12 grid grid-cols-2 gap-x-[clamp(1rem,3vw,2.5rem)] gap-y-10 md:grid-cols-4">
        {rows.map((a) => (
          <li key={a.slug}>
            <Link href={`/album/${a.slug}`} className="group block">
              <div className="aspect-square overflow-hidden rounded-[3px] shadow-[0_24px_44px_-26px_rgba(0,0,0,.55)]" style={{ background: a.cover_color || "var(--cover-bg)" }}>
                {a.thumb_path && <img src={coverUrl(a.thumb_path)} alt={`Daniel Caesar — ${a.title}`} loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover transition-transform duration-700 group-hover:scale-[1.04]" />}
              </div>
              <p className={`${SERIF} mt-4 text-[clamp(1.3rem,2vw,1.8rem)] leading-[1.05] group-hover:text-(--accent)`}>{a.title}</p>
              {a.release_year && <p className="mt-1 text-[12px] tabular-nums text-(--ink)/55">{a.release_year}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Story() {
  const rows = useCaesar();
  const featured = RECORDS.map((r) => findRow(rows, r));
  const others = rows.filter((a) => !featured.includes(a));
  return (
    <>
      {/* 1 히어로 */}
      <section className="relative overflow-hidden pb-[clamp(3rem,8vw,6rem)] pt-[calc(var(--ct-header-h,106px)+56px)]">
        <div className={`${WRAP} grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]`}>
          <div>
            <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">News · Release</Reveal>
            <RiseText as="h1" lines={["Daniel Caesar,", "pressed for Korea"]} delay={120} className={`${SERIF} mt-5 text-[clamp(3rem,7vw,7rem)] leading-[0.88]`} />
            <Reveal delay={450} as="p" className="mt-7 max-w-[44ch] break-keep text-[clamp(1rem,1.4vw,1.2rem)] leading-8 text-(--ink)/80">
              세컨드트랙이 다니엘 시저의 세 장을 국내에서 정식 LP로 발매해요. Pilgrim’s Paradise, Freudian, Case Study 01 — 모두 마블 컬러 180g 판이에요.
            </Reveal>
          </div>
          {/* 세 장이 부채꼴로 겹쳐 천천히 돎 */}
          <Reveal delay={300} className="relative mx-auto aspect-square w-[min(86vw,540px)]" aria-hidden="true">
            {RECORDS.map((r, i) => (
              <div key={r.code} className="absolute w-[62%]" style={{ left: `${4 + i * 17}%`, top: `${30 - i * 14}%`, zIndex: 3 - i }}>
                <MarbleDisc colors={r.disc} seed={r.seed} className="block w-full animate-spin drop-shadow-[0_20px_26px_rgba(0,0,0,.3)] motion-reduce:animate-none" style={{ animationDuration: `${22 + i * 6}s`, animationDirection: i % 2 ? "reverse" : "normal" }} />
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 2 왜 반가운지 */}
      <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
        <Head n="01" label="Finally here" lines={["No more", "import prices"]}>
          그동안 다니엘 시저의 LP는 해외 수입반으로만 구할 수 있어서, 국내에서는 훨씬 비싼 값을 치러야 했어요. 올해 중순 세컨드트랙의 글로벌 리테일 파트너를 통해 해외에 먼저 유통된 판이, 이번에 국내에서도 정식으로 발매돼요.
        </Head>
      </section>

      {/* 3 세 장 */}
      <section className={`${SECTION} pt-0`}>
        <Head n="02" label="Three records" lines={["One song", "from each"]}>
          발매된 순서대로 소개해요. 판마다 먼저 들어볼 곡을 하나씩 골랐어요.
        </Head>
        <ol className="mt-12 border-b border-(--ink)/20">
          {RECORDS.map((r, i) => <Record key={r.code} r={r} i={i} row={featured[i]} />)}
        </ol>
      </section>

      {/* 4 구매 안내 */}
      <section className={`${SECTION} pt-0`}>
        <Head n="03" label="How to buy" lines={["Where &", "when"]} />
        <Reveal className="mt-12 grid overflow-hidden rounded-[6px] border-[3px] border-(--ink) md:grid-cols-[1fr_260px]">
          <dl className="p-[clamp(1.25rem,3vw,2.5rem)]">
            <Row k="온라인 판매">10월 16일(금) 오전 10시부터</Row>
            <Row k="배송">11월 말부터 순차 배송</Row>
            <Row k="구매처">세컨드트랙 코리아 <span className="text-(--ink)/60">(secondtrack.kr)</span></Row>
            <Row k="수량">이미 제작된 수량을 판매해 일부 타이틀은 조기 품절될 수 있어요. 품절되더라도 추가 생산으로 수요에 맞춰 공급하는 것을 목표로 한대요.</Row>
          </dl>
          <div className="flex flex-col justify-between gap-6 border-t-[3px] border-dashed border-(--ink) bg-(--ink) p-[clamp(1.25rem,3vw,2rem)] text-(--cream) md:border-l-[3px] md:border-t-0">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Second Track Korea</p>
              <p className={`${SERIF} mt-3 text-[44px] leading-[0.9]`}>ST0004R–<br />ST0006R</p>
            </div>
            <div className="grid gap-2">
              <a href={SHOP} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between rounded-full border border-(--cream)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--cream) hover:text-(--ink)">secondtrack.kr <span aria-hidden="true">↗︎</span></a>
              <a href={NOTICE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between rounded-full border border-(--cream)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--cream) hover:text-(--ink)">공지 보기 <span aria-hidden="true">↗︎</span></a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 5 Grooves 에 있는 다른 앨범 */}
      <MoreFrom rows={others} />

      {/* 6 Grooves 컬렉션 */}
      <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
        <div className={`${WRAP} grid gap-8 py-[clamp(3.5rem,8vw,6rem)] md:grid-cols-[1fr_auto] md:items-end`}>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--cream)/60">When it arrives</p>
            <RiseText lines={["Give it a place", "on your shelf"]} className={`${SERIF} mt-4 text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.95]`} />
            <p className="mt-5 max-w-[46ch] break-keep text-[15px] leading-7 text-(--cream)/75">판이 도착하면 Grooves 컬렉션에 올려 두세요. 어떤 색 마블이 나왔는지까지 남겨 둘 수 있어요.</p>
          </div>
          <Link href="/collection" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--cream) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--ink) transition-colors hover:bg-(--accent) hover:text-(--cream)">Open Collection <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <p className={`${WRAP} pb-10 pt-8 text-center text-[11px] text-(--ink)/45`}>발매 정보 출처: 세컨드트랙 코리아 공지. 판매·배송 일정은 바뀔 수 있으니 공식 채널을 확인하세요.</p>
    </>
  );
}
