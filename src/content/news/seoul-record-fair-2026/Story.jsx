"use client";
// News — "Seoul Record Fair 2026" (15회)
// 1 히어로: 실시간 카운트다운 + 오른쪽 Pop-up crate(마우스 따라 판이 아래에서 튀어 오름) → 2 상자 넘기기(스크롤로 판이 한 장씩 앞으로 넘어감) → 3 티켓(일시·장소·지도)
// → 4 페어 한정반 띠 → 5 디깅 팁(우리 의견) → 6 공식 사이트
// 사실 정보는 recordfair.kr 에서 확인한 것만 (2026-10-13 기준)
import { useEffect, useRef, useState } from "react";
import Reveal, { RiseText } from "@/components/story/Reveal";
import ScrollScene from "@/components/story/ScrollScene";
import Marquee from "@/components/story/Marquee";
import { seg } from "@/components/story/scroll";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const SITE = "https://recordfair.kr/";
const DAYS = [
  ["2026-10-31T10:00:00+09:00", "2026-10-31T18:00:00+09:00"],
  ["2026-11-01T10:00:00+09:00", "2026-11-01T18:00:00+09:00"],
].map(([a, b]) => [Date.parse(a), Date.parse(b)]);
const PLACE = "펍지성수";
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
        Pop-up crate · {touch ? "tap" : "move"} to dig
      </p>
    </div>
  );
}

// 2 상자 넘기기: 스크롤하면 앞의 판이 한 장씩 앞으로 넘어가고 뒤의 판이 보임
const CRATE = [
  ["Two days", "Saturday 31 October and Sunday 1 November.", "#2d6a6a", "#f4e7cd"],
  ["10 to 6", "Doors at 10:00, last digging at 18:00, both days.", "#e3b04b", "#2a222a"],
  ["Seongsu", "This year the fair sets up at PUBG Seongsu, in Seongdong-gu.", "#4f6d93", "#f4e7cd"],
  ["Fair-only", "Limited pressings made for the fair, sold through its official shop.", "#bbcbda", "#2a222a"],
  ["No. 15", "Fifteen editions of crates, queues and needle drops.", "#2a222a", "#f4e7cd"],
];
function CrateFlip() {
  const n = CRATE.length;
  const step = 0.84 / (n - 1);
  return (
    <ScrollScene height="420svh" aria-label="Flip through the fair" innerClassName="grid place-items-center">
      <div className="absolute inset-x-0 top-[calc(var(--ct-header-h,106px)+28px)] px-5 text-center">
        <p className={`${SERIF} text-[clamp(1.6rem,3vw,2.6rem)] leading-none`}>Flip through the fair</p>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-6 text-(--ink)/70">The 15th Seoul Record Fair takes over Seongsu for a weekend of crates, fair-only pressings and people who still love the needle drop.</p>
      </div>
      <div className="relative mt-[12vh] aspect-square w-[min(74vw,50vh,480px)] [perspective:1400px]">
        {/* 상자 */}
        <div className="absolute -inset-x-[6%] bottom-[-10%] top-[54%] z-30 rounded-b-[6px] border-[3px] border-t-0 border-(--ink) bg-(--cream) shadow-[0_-18px_30px_-20px_rgba(0,0,0,.35)]">
          <p className="absolute inset-x-0 bottom-[14%] text-center text-[11px] font-medium uppercase tracking-[0.34em] tabular-nums">Grooves · Crate 15</p>
        </div>
        {CRATE.map(([title, text, bg, ink], i) => {
          const a = 0.06 + i * step, b = a + step * 0.85;
          const last = i === n - 1;   // 마지막 판은 넘기지 않고 남김
          return (
            <div key={title} className="absolute inset-0 origin-bottom will-change-transform"
              style={{
                zIndex: 20 - i,
                transform: last ? `translateY(${i * 2.2}%) translateZ(${-i * 4}px)` : `translateY(${i * 2.2}%) rotateX(calc(${seg(a, b)} * -96deg)) translateZ(${-i * 4}px)`,
                opacity: last ? 1 : `calc(1 - ${seg(b - 0.02, b + 0.02)})`,
              }}>
              <div className="size-full rounded-[3px] p-[7%] shadow-[0_20px_40px_-24px_rgba(0,0,0,.6)]" style={{ backgroundColor: bg, color: ink }}>
                <p className="text-[11px] font-medium uppercase tracking-[0.3em] opacity-75 tabular-nums">{String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</p>
                <p className={`${SERIF} mt-[4%] text-[clamp(2.2rem,5.4vw,4.4rem)] leading-[0.88]`}>{title}</p>
                <p className="mt-2 max-w-[30ch] text-[clamp(12px,1.6vw,15px)] leading-[1.5] opacity-85">{text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollScene>
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
function Ticket() {
  const q = encodeURIComponent(PLACE);
  return (
    <section className={`${WRAP} py-[clamp(4rem,10vw,8rem)]`}>
      <RiseText lines={["Plan your", "visit"]} className={`${SERIF} text-[clamp(3rem,7vw,7rem)] leading-[0.9]`} />
      <Reveal className="relative mt-12 grid overflow-hidden rounded-[6px] border-[3px] border-(--ink) md:grid-cols-[1fr_260px]">
        <dl className="p-[clamp(1.25rem,3vw,2.5rem)]">
          <Row k="Dates">Sat 31 Oct – Sun 1 Nov 2026</Row>
          <Row k="Hours">10:00 – 18:00 <span className="text-(--ink)/60">(both days)</span></Row>
          <Row k="Venue">PUBG Seongsu <span className="text-(--ink)/60">· {PLACE}</span></Row>
          <Row k="Address">5 Wangsimni-ro 4-gil, Seongdong-gu, Seoul<br /><span className="text-(--ink)/60">{ADDRESS_KO}</span></Row>
          <Row k="Entry">Free timed reservations were offered for the 10:00 and 11:00 slots on both days — all showing <b className="font-medium">sold out</b> as of 13 Oct. Check the official site for the latest on entry.</Row>
          <Row k="Organised by">Seoul Record Fair Committee · run by Round &amp; Round · supported by PUBG Seongsu and Gear Lounge</Row>
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

const PRESSINGS = [["Kim Hyun-chul", "김현철"], ["Kim Do-eon", "김도언"], ["Kim Sang-hee", "김상희"], ["Noizegarden", "노이즈가든"]];
function Pressings() {
  const items = PRESSINGS.map(([en, ko]) => (
    <span key={en} className="inline-flex items-baseline gap-3"><span className={SERIF}>{en}</span><span className="text-[0.4em] font-medium tracking-normal opacity-70">{ko}</span></span>
  ));
  return (
    <section className="overflow-hidden border-y-[3px] border-(--ink) bg-(--accent) py-10 text-(--cream)">
      <div className={`${WRAP} mb-6 flex flex-wrap items-end justify-between gap-4`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.3em]">Fair-only pressings</p>
        <p className="max-w-md text-[14px] leading-6 opacity-90">Limited records released for the fair, on sale through the official shop. Artists include:</p>
      </div>
      <Marquee items={items} speed={30} className="text-[clamp(3rem,8vw,7rem)] leading-[1.05]" />
      <Marquee items={items} speed={38} reverse className="mt-2 text-[clamp(3rem,8vw,7rem)] leading-[1.05] text-transparent [-webkit-text-stroke:1.5px_#f4e7cd]" />
    </section>
  );
}

const TIPS = [
  ["Go early", "The first hours are when the rare stuff moves. The morning slots booked out first for a reason."],
  ["Bring a tote", "Twelve-inch records don’t fit in a backpack. A sturdy tote — or two — saves your arms and the corners."],
  ["Check before you pay", "Slide the record out. Look for scratches under the light, warps from the side, and seam splits on the sleeve."],
  ["Set a budget", "Decide it before the first crate. Then leave a little room for the one you didn’t know you were looking for."],
  ["Ask the seller", "Most diggers behind the table love to talk. Ask what they’d take home — it’s the best search engine in the room."],
];
function Tips() {
  return (
    <section className={`${WRAP} py-[clamp(4rem,10vw,8rem)]`}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <RiseText lines={["Digging", "tips"]} className={`${SERIF} text-[clamp(3rem,7vw,7rem)] leading-[0.9]`} />
        <p className="pb-2 text-[11px] uppercase tracking-[0.26em] text-(--ink)/55">From the Grooves crew</p>
      </div>
      <ol className="mt-10 border-t-[3px] border-(--ink)">
        {TIPS.map(([title, text], i) => (
          <Reveal as="li" key={title} delay={i * 90} className="group grid gap-2 border-b border-(--ink)/20 py-6 sm:grid-cols-[80px_minmax(0,320px)_1fr] sm:items-baseline sm:gap-8">
            <span className="text-[12px] tabular-nums text-(--accent)">{String(i + 1).padStart(2, "0")}</span>
            <p className={`${SERIF} text-[clamp(1.8rem,3vw,2.6rem)] leading-none transition-transform duration-500 group-hover:translate-x-2`}>{title}</p>
            <p className="max-w-[52ch] text-[15px] leading-7 text-(--ink)/75">{text}</p>
          </Reveal>
        ))}
      </ol>
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
          <Reveal delay={450} as="p" className="mt-6 text-[clamp(1.1rem,2vw,1.5rem)] font-medium tabular-nums">31 Oct – 1 Nov 2026 · PUBG Seongsu</Reveal>
          <Reveal delay={650} className="mt-7 w-fit rounded-[6px] bg-(--cream)/85 p-4 backdrop-blur-sm">
            <Countdown />
          </Reveal>
        </div>
      </section>

      <CrateFlip />
      <Ticket />
      <Pressings />
      <Tips />

      {/* 6 공식 사이트 */}
      <section className={`${WRAP} pb-10 pt-[clamp(2rem,6vw,4rem)] text-center`}>
        <RiseText lines={["See you", "in the crates."]} className={`${SERIF} text-[clamp(2.6rem,6vw,6rem)] leading-[0.92]`} />
        <Reveal delay={300} as="p" className="mx-auto mt-5 max-w-md text-[14px] leading-6 text-(--ink)/65">Details as published by the organisers on 13 Oct 2026. Plans can change — the official site has the final word. Poster artwork © Seoul Record Fair.</Reveal>
        <Reveal delay={400}>
          <a href={SITE} target="_blank" rel="noreferrer" className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full bg-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--cream) transition-colors hover:bg-(--accent)">recordfair.kr <span aria-hidden="true">↗</span></a>
        </Reveal>
      </section>
    </>
  );
}
