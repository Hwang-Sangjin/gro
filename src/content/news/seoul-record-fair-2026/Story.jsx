"use client";
// News — "Seoul Record Fair 2026" (15회)
// 1 히어로(카운트다운 + Pop-up crate) → 2 소개 → 3 장소·일시 → 4 입장 방식 → 5 15회 한정반(대표곡 YouTube)
// → 6 최초공개반·셀러 부스 → 7 온라인 판매 중인 한정반(앨범만) → 8 Grooves 컬렉션 → 9 공식 채널
// 사실 정보는 recordfair.kr 공지(2026-10-13·18 확인)와 지난 회차 기사 기준. 커버 이미지는 받는 대로 img 경로를 채움
import { useEffect, useRef, useState } from "react";
import Reveal, { RiseText } from "@/components/story/Reveal";
import Link from "next/link";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const SITE = "https://recordfair.kr/";
const DAYS = [
  ["2026-10-31T10:00:00+09:00", "2026-10-31T18:00:00+09:00"],
  ["2026-11-01T10:00:00+09:00", "2026-11-01T18:00:00+09:00"],
].map(([a, b]) => [Date.parse(a), Date.parse(b)]);
const PLACE = "PUBG 성수";
const MAP_QUERY = "펍지성수";   // 지도 검색은 한글 상호가 잘 잡힘
const ADDRESS_KO = "서울 성동구 왕십리로4길 5";

// 지금 시각 기준 상태: before(첫날 전) | open(열려 있음) | between(첫날 끝~둘째 날 전) | after(끝)
function fairState(now) {
  for (let i = 0; i < DAYS.length; i++) {
    const [open, close] = DAYS[i];
    if (now < open) return { kind: i === 0 ? "before" : "between", target: open, day: i + 1 };
    if (now < close) return { kind: "open", target: close, day: i + 1 };
  }
  return { kind: "after" };
}
function useNow(interval = 1000) {
  const [now, setNow] = useState(null);           // 서버 렌더에선 null → 하이드레이션 어긋남 없음
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

function Countdown() {
  const now = useNow();
  const s = now == null ? null : fairState(now);
  const left = s?.target ? Math.max(0, s.target - now) : 0;
  const parts = [
    ["Days", Math.floor(left / 864e5)],
    ["Hours", Math.floor(left / 36e5) % 24],
    ["Min", Math.floor(left / 6e4) % 60],
    ["Sec", Math.floor(left / 1e3) % 60],
  ];
  const head = !s ? " "
    : s.kind === "before" ? "Doors open in"
    : s.kind === "between" ? "Day 2 opens in"
    : s.kind === "open" ? `Open now · Day ${s.day} · closes in`
    : "That’s a wrap — see you next year";
  return (
    <div aria-live="off">
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em]">
        {s?.kind === "open" && <span className="size-2 animate-pulse rounded-full bg-(--accent)" />}{head}
      </p>
      {s?.kind !== "after" && (
        <div className="mt-3 flex gap-[clamp(.75rem,2vw,1.5rem)]">
          {parts.map(([k, v], i) => (
            <div key={k} className={i === 0 && s?.kind === "open" ? "hidden" : ""}>
              <p className={`${SERIF} text-[clamp(2.2rem,5vw,4rem)] leading-none tabular-nums`}>{s ? String(v).padStart(2, "0") : "--"}</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.24em] opacity-60">{k}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 히어로 오른쪽 Pop-up crate — 포인터가 지나가는 자리 아래에서 판이 튀어 올라 포인터 높이쯤에서 정점, 다시 떨어짐
// 손그림 판(lathe-disc)을 마스크로 칠함. 판은 직접 DOM 노드로 만들어 rAF로 움직임 (React 렌더 없음)
const DISC_SRC = "/images/news/what-is-vinyl/lathe-disc.webp";
const POP_COLORS = ["var(--ink)", "var(--accent)", "var(--cover-art)", "var(--ink)"];
const GRAVITY = 2600;        // px/s²
const POP_MAX = 30;          // 동시에 떠 있는 판 수 상한
function PopCrate({ className = "" }) {
  const box = useRef(null);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const el = box.current;
    const host = el.closest("section") ?? el;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTouch(window.matchMedia("(hover: none)").matches);
    let W = 0, H = 0;
    const measure = () => { const r = el.getBoundingClientRect(); W = r.width; H = r.height; };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const live = [];
    let ci = 0;
    const make = (d) => {
      const node = document.createElement("div");
      node.className = "pointer-events-none absolute left-0 top-0 rounded-full bg-(--cream) will-change-transform";
      node.style.width = node.style.height = `${d}px`;
      const art = document.createElement("div");
      art.className = "size-full";
      art.style.backgroundColor = POP_COLORS[ci++ % POP_COLORS.length];
      art.style.mask = art.style.webkitMask = `url(${DISC_SRC}) center / contain no-repeat`;
      node.appendChild(art);
      el.appendChild(node);
      return node;
    };
    const place = (p) => { p.node.style.transform = `translate3d(${p.x - p.d / 2}px, ${p.y - p.d / 2}px, 0) rotate(${p.a}deg)`; };
    const spawn = (x, peak) => {
      if (!W || !H) return;
      if (live.length >= POP_MAX) live.shift().node.remove();
      const d = Math.round(Math.min(Math.max(W * (0.24 + Math.random() * 0.2), 96), 300));
      const y0 = H + d / 2 + 4;
      const top = Math.min(Math.max(peak, d * 0.5 + 8), H - d * 0.35);
      const p = {
        node: make(d), d, y: y0,
        x: Math.min(Math.max(x, d * 0.3), W - d * 0.3),
        vy: -Math.sqrt(2 * GRAVITY * (y0 - top)),
        a: Math.random() * 360, va: (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 160),
      };
      place(p);
      live.push(p);
    };

    // 모션 줄이기: 상자 바닥에 판 몇 장만 걸쳐 둠
    if (reduce) {
      [[0.28, 0.82], [0.62, 0.74], [0.86, 0.9]].forEach(([fx, fy]) => {
        const d = Math.round(Math.min(Math.max(W * 0.36, 110), 300));
        const p = { node: make(d), d, x: W * fx, y: H * fy + d * 0.2, a: fx * 400 };
        place(p);
        live.push(p);
      });
      return () => { ro.disconnect(); live.forEach((p) => p.node.remove()); };
    }

    // 포인터: 일정 거리를 움직일 때마다 한 장, 클릭/탭하면 세 장
    let lastX = null, lastY = null, moved = 0, lastSpawn = 0, lastPointer = -1e9;
    const local = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onMove = (e) => {
      const [x, y] = local(e);
      if (x < -40 || x > W + 40) { lastX = null; return; }
      const now = performance.now();
      lastPointer = now;
      if (lastX != null) moved += Math.hypot(x - lastX, y - lastY);
      lastX = x; lastY = y;
      if (moved > 70 || (moved > 14 && now - lastSpawn > 160)) {
        spawn(x, y + (Math.random() - 0.5) * 60);
        moved = 0; lastSpawn = now;
      }
    };
    const onDown = (e) => {
      const [x, y] = local(e);
      if (x < -40 || x > W + 40) return;
      lastPointer = performance.now();
      for (let i = 0; i < 3; i++) spawn(x + (i - 1) * 50, y - 20 + i * 50);
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerdown", onDown, { passive: true });

    // 가만히 있으면 혼자서 가끔 튀어 오름
    const idle = setInterval(() => {
      if (visible && performance.now() - lastPointer > 2400) spawn(Math.random() * W, H * (0.2 + Math.random() * 0.45));
    }, 850);

    let visible = true, raf = 0, last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.vy += GRAVITY * dt;
        p.y += p.vy * dt;
        p.a += p.va * dt;
        if (p.vy > 0 && p.y - p.d / 2 > H) { p.node.remove(); live.splice(i, 1); continue; }
        place(p);
      }
      raf = visible ? requestAnimationFrame(tick) : 0;
    };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    });
    io.observe(el);
    raf = requestAnimationFrame(tick);
    spawn(W * 0.5, H * 0.35);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(idle);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onDown);
      live.forEach((p) => p.node.remove());
    };
  }, []);
  return (
    <div className={className} aria-hidden="true">
      <div ref={box} className="relative size-full overflow-hidden" />
      <p className="pointer-events-none absolute bottom-4 right-[clamp(20px,4vw,72px)] text-[10px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">
        Pop-up crate · {touch ? "탭해서" : "마우스를 움직여"} 디깅
      </p>
    </div>
  );
}

// 섹션 머리: 번호 라벨 + 큰 제목
function Head({ n, label, lines, children }) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:items-end">
      <div>
        <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent) tabular-nums">{n} — {label}</Reveal>
        <RiseText lines={lines} className={`${SERIF} mt-4 text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[0.9]`} />
      </div>
      {children && <Reveal delay={200} as="p" className="max-w-[46ch] text-[15px] leading-7 text-(--ink)/75 md:pb-2">{children}</Reveal>}
    </div>
  );
}
const SECTION = `${WRAP} py-[clamp(4rem,10vw,8rem)]`;

// 2 소개
function About() {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="01" label="The fair" lines={["A festival", "for the record"]} />
      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {[
          ["Since 2011", "2011년에 시작한 국내 최초의 음반 중심 음악 축제. 올해로 열다섯 번째예요."],
          ["Round & Round", "라운드앤라운드가 주최하고 운영해요. 해마다 장소를 옮기고, 그해만의 한정반을 새로 만들어요."],
          ["A read on vinyl", "신보, 재발매반, 중고반이 한자리에 모여요. 여기서 무엇이 팔리는지가 국내 바이닐 시장의 흐름을 보여줘요."],
        ].map(([t, d], i) => (
          <Reveal key={t} delay={i * 110} className="border-t border-(--ink)/25 pt-5">
            <p className={`${SERIF} text-[clamp(1.8rem,2.6vw,2.4rem)] leading-none`}>{t}</p>
            <p className="mt-4 max-w-[38ch] text-[15px] leading-7 text-(--ink)/75">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Row({ k, children }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 border-b border-dashed border-(--ink)/25 py-4 sm:grid-cols-[150px_1fr]">
      <dt className="pt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/55">{k}</dt>
      <dd className="text-[16px] leading-7">{children}</dd>
    </div>
  );
}
// 3 장소·일시 (티켓 모양)
function Venue() {
  const q = encodeURIComponent(MAP_QUERY);
  return (
    <section className={SECTION}>
      <Head n="02" label="Where & when" lines={["PUBG", "Seongsu"]}>
        게임 배틀그라운드의 세계관을 담은 성수동 복합문화공간이에요. 작년에도 이곳에서 열렸고, 야외 놀이터부터 실내 여러 층까지 건물 전체를 썼어요.
      </Head>
      <Reveal className="relative mt-12 grid overflow-hidden rounded-[6px] border-[3px] border-(--ink) md:grid-cols-[1fr_260px]">
        <dl className="p-[clamp(1.25rem,3vw,2.5rem)]">
          <Row k="일시">2026년 10월 31일(토) – 11월 1일(일)</Row>
          <Row k="시간">10:00 – 18:00 <span className="text-(--ink)/60">(이틀 모두)</span></Row>
          <Row k="장소">{PLACE}</Row>
          <Row k="주소">{ADDRESS_KO}</Row>
          <Row k="가는 길">성동구 성수동. 지도에서 지하철·버스 경로를 확인하세요. 주변 주차가 여유롭지 않아 대중교통이 편해요.</Row>
        </dl>
        {/* 티켓 꼬리 (점선으로 뜯는 부분) */}
        <div className="relative flex flex-col justify-between gap-6 border-t-[3px] border-dashed border-(--ink) bg-(--ink) p-[clamp(1.25rem,3vw,2rem)] text-(--cream) md:border-l-[3px] md:border-t-0">
          <span aria-hidden="true" className="absolute -left-[14px] -top-[14px] hidden size-[26px] rounded-full border-[3px] border-(--ink) bg-(--cream) md:block" />
          <span aria-hidden="true" className="absolute -bottom-[14px] -left-[14px] hidden size-[26px] rounded-full border-[3px] border-(--ink) bg-(--cream) md:block" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">Admit one digger</p>
            <p className={`${SERIF} mt-3 text-[64px] leading-[0.8]`}>15</p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.24em] opacity-70">Seoul Record Fair</p>
          </div>
          <div className="grid gap-2">
            <a href={`https://map.naver.com/p/search/${q}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between rounded-full border border-(--cream)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--cream) hover:text-(--ink)">Naver Map <span aria-hidden="true">↗</span></a>
            <a href={`https://map.kakao.com/?q=${q}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-between rounded-full border border-(--cream)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:bg-(--cream) hover:text-(--ink)">Kakao Map <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// 4 입장 방식
const ENTRY = [
  ["Free entry", "입장료는 없어요. 들어와서 고르고, 마음에 드는 판을 들고 나가면 돼요."],
  ["Morning slots", "이틀 모두 10시·11시 입장은 사전예약제이고, 10월 13일 기준 매진이에요. 예약 시간대 입장이 끝나면 누구나 들어갈 수 있어요."],
  ["Limited records", "한정반은 1인 1매. 날마다 수량이 따로 배분되고, 별도의 한정반 부스에서 판매해요."],
  ["Missed out?", "페어가 끝난 뒤 남은 물량은 공식 홈페이지에서 온라인으로 판매해요."],
];
function Entry() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="03" label="Getting in" lines={["How entry", "works"]}>
        세부 시간은 바뀔 수 있어요. 최신 안내는 공식 홈페이지를 확인하세요.
      </Head>
      <ol className="mt-12 grid gap-px overflow-hidden rounded-[6px] border-[3px] border-(--ink) bg-(--ink) sm:grid-cols-2 lg:grid-cols-4">
        {ENTRY.map(([t, d], i) => (
          <Reveal as="li" key={t} delay={i * 90} className="bg-(--cream) p-[clamp(1.25rem,2.4vw,2rem)]">
            <p className="text-[12px] tabular-nums text-(--accent)">{String(i + 1).padStart(2, "0")}</p>
            <p className={`${SERIF} mt-3 text-[clamp(1.7rem,2.4vw,2.2rem)] leading-none`}>{t}</p>
            <p className="mt-4 text-[14px] leading-6 text-(--ink)/75">{d}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

// 앨범 커버: 이미지가 있으면 그대로, 없으면 손그림 판 + 제목으로 자리만 잡음
function Cover({ img, artist, title, className = "" }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-[3px] bg-(--cover-bg) ${className}`}>
      {img ? (
        <img src={img} alt={`${artist} — ${title}`} loading="lazy" className="size-full object-cover" />
      ) : (
        <>
          <div aria-hidden="true" className="absolute -bottom-[22%] -right-[22%] size-[86%] bg-(--cover-art) [mask:url(/images/news/what-is-vinyl/lathe-disc.webp)_center/contain_no-repeat]" />
          <div className="relative p-[9%]">
            <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-(--accent)">{artist}</p>
            <p className={`${SERIF} mt-2 text-[clamp(1.1rem,1.8vw,1.6rem)] leading-[0.95]`}>{title}</p>
          </div>
        </>
      )}
    </div>
  );
}

// 5 15회 한정반 — 대표곡은 YouTube 검색 링크 (공식 영상 주소가 정해지면 교체)
const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
const LIMITED = [
  {
    artist: "Lim Hyun-jung", ko: "임현정", title: "[4] A Year Out… In The Island", img: null,
    text: "20년 넘게 영화와 드라마에 쓰여 온 노래가 담긴 2003년 앨범. 바이닐로는 처음 발매돼요.",
    spec: ["2LP · 180g", "게이트폴드 재킷", "인서트"], price: "55,000원", run: "700매 · 하루 350매",
    track: "사랑은 봄비처럼…이별은 겨울비처럼", href: yt("임현정 사랑은 봄비처럼 이별은 겨울비처럼"),
  },
  {
    artist: "Sultan of the Disco", ko: "술탄 오브 더 디스코", title: "Easy Listening for Love +", img: null,
    text: "가장 최근 앨범인 2019년작이 처음으로 바이닐이 돼요. 2020년 싱글과 그 연주곡을 더해 총 10곡을 담았어요.",
    spec: ["LP · 180g 검정반", "게이트폴드 재킷", "디자인 이너슬리브"], price: "49,000원", run: "700매 · 하루 350매",
    track: "Waiting For Your Calling Back", href: yt("술탄 오브 더 디스코 Waiting For Your Calling Back"),
  },
  {
    artist: "Bronze", ko: "브론즈", title: "Aquarium", img: null,
    text: "BSK, 미노이, 루나, 유키카, 후디가 참여하고 나가이 히로시가 그림을 그린 두 번째 정규 앨범. 바이닐 발매 5주년을 맞아 검정반으로 다시 찍었어요.",
    spec: ["LP · 180g 검정반", "싱글 재킷", "인서트"], price: "44,500원", run: "500매 · 하루 250매",
    track: "Aquarium", href: yt("브론즈 Bronze Aquarium"),
  },
];
function Limited() {
  return (
    <section className={`${SECTION} border-t-[3px] border-(--ink)`}>
      <Head n="04" label="Fair-only pressings" lines={["Made for", "the fair"]}>
        15회 페어를 위해 만든 한정반으로, 현장 한정반 부스에서 먼저 판매해요. 줄 서기 전에 미리 들어보세요.
      </Head>
      <div className="mt-14 grid gap-12">
        {LIMITED.map((r, i) => (
          <Reveal key={r.title} className="grid items-start gap-8 border-t border-(--ink)/25 pt-8 md:grid-cols-[minmax(0,360px)_1fr] md:gap-14">
            <Cover img={r.img} artist={r.artist} title={r.title} />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/55 tabular-nums">{String(i + 1).padStart(2, "0")} · {r.artist}</p>
              <p className="mt-3 text-[clamp(2rem,4vw,3.4rem)] font-black leading-[1.05] tracking-[-0.02em]">{r.ko}</p>
              <p className="mt-2 text-[clamp(1.1rem,1.6vw,1.35rem)] font-medium">{r.title}</p>
              <p className="mt-5 max-w-[52ch] text-[15px] leading-7 text-(--ink)/75">{r.text}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {r.spec.map((t) => <li key={t} className="rounded-full border border-(--ink)/30 px-3 py-1 text-[12px]">{t}</li>)}
              </ul>
              <p className="mt-5 text-[14px] tabular-nums"><b className="font-medium">{r.price}</b> <span className="text-(--ink)/60">· {r.run}</span></p>
              <a href={r.href} target="_blank" rel="noreferrer" className="group mt-7 inline-flex min-h-12 items-center gap-4 rounded-full bg-(--ink) py-2 pl-2 pr-6 text-(--cream) transition-colors hover:bg-(--accent)">
                <span className="grid size-9 place-items-center rounded-full bg-(--cream) text-(--ink)" aria-hidden="true">
                  <svg viewBox="0 0 12 12" className="size-3 translate-x-px fill-current"><path d="M2 1l9 5-9 5z" /></svg>
                </span>
                <span className="text-left">
                  <span className="block text-[10px] uppercase tracking-[0.26em] opacity-70">YouTube에서 듣기</span>
                  <span className="block text-[14px] font-medium">{r.track}</span>
                </span>
              </a>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// 6 최초공개반 · 셀러 부스
function Floor() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="05" label="On the floor" lines={["More to", "dig through"]} />
      <div className="mt-12 grid gap-px overflow-hidden rounded-[6px] border-[3px] border-(--ink) bg-(--ink) md:grid-cols-2">
        <Reveal className="bg-(--accent) p-[clamp(1.5rem,3.4vw,3rem)] text-(--cream)">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] opacity-80">최초공개반</p>
          <p className={`${SERIF} mt-4 text-[clamp(2rem,3.4vw,3.2rem)] leading-[0.92]`}>Out here first</p>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-7 opacity-90">페어에서 처음으로 판매하는 음반이에요. 신보, 처음 바이닐로 나오는 앨범, 재발매반까지 해마다 수십 종이 나와요. 나중에 매장에 풀리는 것도 있지만, 여기서만 만날 수 있는 것도 있어요.</p>
        </Reveal>
        <Reveal delay={120} className="bg-(--cream) p-[clamp(1.5rem,3.4vw,3rem)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">셀러 부스</p>
          <p className={`${SERIF} mt-4 text-[clamp(2rem,3.4vw,3.2rem)] leading-[0.92]`}>Crates, everywhere</p>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-7 text-(--ink)/75">레이블, 레코드숍, 컬렉터들이 나란히 부스를 열어요.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {["신보", "중고반", "해외 레이블", "음악 서적", "음향기기"].map((t) => <li key={t} className="rounded-full border border-(--ink)/30 px-3 py-1 text-[12px]">{t}</li>)}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

// 7 온라인 판매 중인 한정반 — 앨범만
const ONLINE = [
  ["김현철", "32℃ 여름"],
  ["김현철", "횡계에서 돌아오는 저녁"],
  ["김현철", "그대안의 블루 (OST)"],
  ["김현철", "네온 속으로 노을지다 (OST)"],
  ["김도언", "Damage"],
  ["노이즈가든", "…But Not For Sale"],
  ["머드 더 스튜던트", "Field Trip"],
  ["다브다", "Yonder EP"],
  ["김상희", "Sings Tom Jones & Burt Bacharach"],
  ["김상희", "Love Story"],
].map(([artist, title]) => ({ artist, title, img: null }));
function Online() {
  return (
    <section className={`${SECTION} pt-0`}>
      <Head n="06" label="Can’t make it?" lines={["Still on", "the shelf"]}>
        지난 페어에서 만든 한정반 중 아직 온라인 샵에서 살 수 있는 앨범들이에요.
      </Head>
      <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {ONLINE.map((r, i) => (
          <Reveal as="li" key={r.title} delay={(i % 5) * 70}>
            <Cover img={r.img} artist={r.artist} title={r.title} />
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-(--ink)/55">{r.artist}</p>
            <p className="mt-1 text-[15px] font-medium leading-snug">{r.title}</p>
          </Reveal>
        ))}
      </ul>
      <Reveal className="mt-10">
        <a href={SITE} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 border-b-2 border-(--ink) text-[12px] font-medium uppercase tracking-[0.2em] transition-colors hover:border-(--accent) hover:text-(--accent)">recordfair.kr에서 구매하기 <span aria-hidden="true">↗</span></a>
      </Reveal>
    </section>
  );
}

// 8 Grooves 컬렉션 연결
function Bring() {
  return (
    <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
      <div className={`${WRAP} grid gap-8 py-[clamp(3.5rem,8vw,6rem)] md:grid-cols-[1fr_auto] md:items-end`}>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--cream)/60">페어가 끝나고</p>
          <RiseText lines={["Brought one", "home?"]} className={`${SERIF} mt-4 text-[clamp(2.8rem,6.4vw,6rem)] leading-[0.9]`} />
          <p className="mt-5 max-w-[46ch] text-[15px] leading-7 text-(--cream)/75">Grooves 컬렉션에 자리를 만들어 주세요. 어디서 찾았는지, 얼마에 샀는지, 처음 걸었을 때 어떤 소리였는지까지 남길 수 있어요.</p>
        </div>
        <Link href="/collection" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--cream) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--ink) transition-colors hover:bg-(--accent) hover:text-(--cream)">Open Collection <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}

export default function Story() {
  return (
    <>
      {/* 1 히어로: 카운트다운 + Pop-up crate */}
      <section className="relative min-h-svh touch-pan-y overflow-hidden pb-16 pt-[calc(var(--ct-header-h,106px)+56px)]">
        <PopCrate className="absolute inset-y-0 right-0 w-[min(54vw,960px)] max-md:inset-x-0 max-md:top-auto max-md:h-[44svh] max-md:w-auto" />
        <div className={`${WRAP} relative z-10`}>
          <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">News · Fair</Reveal>
          <p aria-hidden="true" className={`${SERIF} mt-2 text-[clamp(7rem,16vw,15rem)] leading-[0.78] text-transparent [-webkit-text-stroke:2px_var(--ink)]`}>
            <span className="inline-block animate-[sheet-up_1.2s_cubic-bezier(.22,1,.36,1)_both]">15</span>
          </p>
          <RiseText as="h1" lines={["Seoul", "Record Fair"]} delay={150} lineClassName="whitespace-nowrap" className={`${SERIF} -mt-[0.35em] text-[clamp(3.2rem,7vw,7rem)] leading-[0.88]`} />
          <Reveal delay={450} as="p" className="mt-6 text-[clamp(1.1rem,2vw,1.5rem)] font-medium tabular-nums">2026. 10. 31 – 11. 1 · PUBG 성수</Reveal>
          <Reveal delay={650} className="mt-7 w-fit rounded-[6px] bg-(--cream)/85 p-4 backdrop-blur-sm">
            <Countdown />
          </Reveal>
        </div>
      </section>

      <About />
      <Venue />
      <Entry />
      <Limited />
      <Floor />
      <Online />
      <Bring />

      {/* 9 공식 채널 */}
      <section className={`${WRAP} pb-10 pt-[clamp(3rem,8vw,6rem)] text-center`}>
        <RiseText lines={["See you", "in the crates."]} className={`${SERIF} text-[clamp(2.6rem,6vw,6rem)] leading-[0.92]`} />
        <Reveal delay={300} as="p" className="mx-auto mt-5 max-w-md text-[14px] leading-6 text-(--ink)/65">주최 측 공지를 기준으로 정리했어요. 일정은 바뀔 수 있으니 최신 소식은 공식 채널에서 확인하세요.</Reveal>
        <Reveal delay={400} className="mt-9 flex flex-wrap justify-center gap-3">
          <a href={SITE} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--cream) transition-colors hover:bg-(--accent)">recordfair.kr <span aria-hidden="true">↗</span></a>
          <a href="https://x.com/roundx2" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors hover:border-(--accent) hover:text-(--accent)">X · @roundx2 <span aria-hidden="true">↗</span></a>
        </Reveal>
        <p className="mt-10 text-[11px] text-(--ink)/45">포스터 © 서울레코드페어</p>
      </section>
    </>
  );
}
