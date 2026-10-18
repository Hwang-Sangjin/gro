"use client";
// Picks — "Records for an Autumn Evening"
// 1 히어로 → 2 일곱 장 (스크롤하면 슬리브에서 판이 빠져나오며 돎) → 3 한 장짜리 믹스테이프(A/B면) → 4 마무리(낙엽 더미)
// 낙엽은 페이지 전체에서 떨어지고(화면에 붙은 층), 마지막 섹션 바닥에 쌓여 있음
// 슬리브는 실제 앨범 커버 대신 글자로 만든 그림 (저작권 이미지 사용 안 함)
import { useEffect, useRef } from "react";
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
    text: "가장 뻔한 첫 곡이지만 여전히 정답이에요. 빌 에번스, 스콧 라파로, 폴 모션은 이 곡을 피아노와 반주가 아니라 세 사람의 대화처럼 연주해요.",
    listen: "피아노 아래를 걷기만 하지 않고 피아노에 대답하는 라파로의 베이스.",
  },
  {
    time: "6:15 pm", artist: "Chet Baker", album: "Chet Baker Sings", year: 1954, label: "Pacific Jazz",
    song: "My Funny Valentine", color: "#e3b04b", ink: "#2a222a",
    text: "찬 바람 속에 놓아둔 것처럼 부드러운 목소리. 해가 건물 뒤로 넘어가고 방이 푸르스름해질 때 걸어 보세요.",
    listen: "마이크가 얼마나 가까운지 — 숨소리까지 노래의 일부예요.",
  },
  {
    time: "7:00 pm", artist: "Nick Drake", album: "Pink Moon", year: 1972, label: "Island",
    song: "Pink Moon", color: "#d9a3a0", ink: "#2a222a",
    text: "30분이 채 안 되는 길이에 담긴 건 거의 없어요. 목소리 하나, 기타 하나. 해가 짧은 날 집으로 걸어가는 기분이에요.",
    listen: "타이틀곡에 딱 한 번 들어가는 피아노 — 이 앨범의 유일한 오버더빙이에요.",
  },
  {
    time: "8:20 pm", artist: "Joni Mitchell", album: "Blue", year: 1971, label: "Reprise",
    song: "A Case of You", color: "#4f6d93", ink: "#f4e7cd",
    text: "따뜻한 음반도 있지만 이 음반은 솔직해요. 10월에는 그게 같은 말처럼 느껴져요.",
    listen: "제임스 테일러의 기타 위로 밝게 튕기는 조니의 애팔래치안 덜시머.",
  },
  {
    time: "9:10 pm", artist: "Lee Moon-sae", album: "Lee Moon-sae 4", year: 1987, label: "",
    song: "When Autumn Comes (가을이 오면)", color: "#8a5a3c", ink: "#f4e7cd",
    text: "1980년대 후반 서울의 소리를 만든 이영훈의 곡. 한국에 가을 노래가 하나 있다면 이 음반에 있어요.",
    listen: "후렴 앞에서 부풀어 오르는 현악 — 은행나무 사이로 부는 바람 같아요.",
  },
  {
    time: "10:30 pm", artist: "Norah Jones", album: "Come Away with Me", year: 2002, label: "Blue Note",
    song: "Don’t Know Why", color: "#bbcbda", ink: "#2a222a",
    text: "담요 같은 음악. 재즈 레이블, 컨트리의 마음, 그리고 조용히 그래미 올해의 레코드를 받은 제시 해리스의 곡.",
    listen: "서두르지 않는 피아노 왼손 — 더 갈 곳이 없다는 듯이.",
  },
  {
    time: "11:50 pm", artist: "Bon Iver", album: "For Emma, Forever Ago", year: 2007, label: "",
    song: "Skinny Love", color: "#2a222a", ink: "#f4e7cd",
    text: "위스콘신의 사냥 오두막에서 혼자 녹음한 앨범. 가을이 겨울처럼 느껴지기 시작할 때 듣는 오늘 밤의 마지막 음반.",
    listen: "세게 내리치는 스트럼, 그리고 그 주변으로 들리는 방의 울림.",
  },
];

// 결정적인 의사난수 (서버/클라이언트 같은 값 → 하이드레이션 어긋남 없음)
const rand = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
// 잎 그림: 투명 배경 webp (단풍·일본단풍·미국풍나무·은행·참나무·피나무·벚나무·갈잎). 단풍과 은행이 조금 더 자주 나오게
const LEAF_DIR = "/images/news/records-for-autumn/leaves/";
const LEAF_SET = [["maple", 5, 3], ["palmatum", 3, 2], ["star", 5, 2], ["ginkgo", 3, 3], ["oak", 4, 1], ["heart", 3, 1], ["cherry", 3, 1], ["oval", 3, 1]];   // [종류, 장수, 비중]
const LEAF_POOL = LEAF_SET.flatMap(([k, n, w]) => Array.from({ length: n * w }, (_, i) => `${LEAF_DIR}${k}-${(i % n) + 1}.webp`));
const leafOf = (i) => LEAF_POOL[Math.floor(rand(i, 9) * LEAF_POOL.length)];

// ── 낙엽 시스템 ─────────────────────────────────────────────
// 떨어지는 잎: 화면에 붙은(sticky) 층에서 떨어짐. 마지막 섹션("Got one we missed?")의 바닥이 화면에 들어오면
// 그 바닥(쌓인 더미의 표면)에 닿는 잎은 멈춰서 더미에 쌓임. 바닥이 아직 화면 밖이면 그냥 지나가서 위에서 다시 떨어짐.
// 쌓인 잎: 마우스를 움직이면 근처 잎이 튀어 올랐다가 다시 내려앉음(클릭·탭하면 더 넓게).
// 잎은 직접 DOM 노드로 만들고 rAF 로 움직임 (React 렌더 없음)
const FALLING = 24, BIN = 14, G = 1100;
const PRESEED_PER_PX = 1 / 7, PILE_MAX_PER_PX = 1 / 4.2;   // 화면 폭에 비례 (넓은 화면일수록 많이)
function useLeaves(fallRef, pileRef) {
  useEffect(() => {
    const fall = fallRef.current, pile = pileRef.current;
    if (!fall || !pile) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let k = 0;
    const pick = () => leafOf(k++);
    const skin = (el, src) => { el.style.backgroundImage = `url(${src})`; };
    const node = (host, size, src) => {
      const el = document.createElement("div");
      el.className = "pointer-events-none absolute left-0 top-0 bg-contain bg-center bg-no-repeat will-change-transform";
      el.style.width = el.style.height = `${size}px`;
      skin(el, src);
      host.appendChild(el);
      return el;
    };

    // 더미 높이(구간별) — 가운데가 높은 둔덕 모양으로만 쌓이게 상한을 둠
    let PW = pile.clientWidth, PH = pile.clientHeight, heap = [];
    const bins = () => Math.max(1, Math.ceil(PW / BIN));
    const binOf = (x) => Math.min(bins() - 1, Math.max(0, Math.floor(x / BIN)));
    const cap = (b) => 16 + PH * 0.74 * (0.5 + 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (b + 0.5) / bins()))), 0.8));   // 가장자리까지 쌓이고 가운데가 조금 더 높게
    const resize = () => { PW = pile.clientWidth; PH = pile.clientHeight; const n = bins(); while (heap.length < n) heap.push(0); heap.length = n; };
    resize();
    const surface = (x) => PH - heap[binOf(x)];
    // 꽉 찬 구간이면 옆으로 미끄러져 낮은 곳에 앉음
    const settleX = (x) => {
      let b = binOf(x);
      for (let i = 0; i < 6 && heap[b] >= cap(b); i++) {
        const l = Math.max(0, b - 1), r = Math.min(bins() - 1, b + 1);
        b = heap[l] <= heap[r] ? l : r;
      }
      return Math.min(PW - 4, Math.max(4, (b + Math.random()) * BIN));
    };

    const piled = [];   // { el, x, y, s, a, vx, vy, va, rest }
    const place = (p) => { p.el.style.transform = `translate3d(${(p.x - p.s / 2).toFixed(1)}px, ${(p.y - p.s * 0.62).toFixed(1)}px, 0) rotate(${p.a.toFixed(1)}deg)`; };
    const land = (p) => {
      p.x = settleX(p.x);
      const b = binOf(p.x);
      p.y = PH - heap[b];
      heap[b] += p.s * 0.42;
      if (b > 0) heap[b - 1] += p.s * 0.18;
      if (b < bins() - 1) heap[b + 1] += p.s * 0.18;
      p.rest = true; p.vx = p.vy = p.va = 0;
      place(p);
    };
    const lift = (p) => {
      const b = binOf(p.x);
      heap[b] = Math.max(0, heap[b] - p.s * 0.42);
      if (b > 0) heap[b - 1] = Math.max(0, heap[b - 1] - p.s * 0.18);
      if (b < bins() - 1) heap[b + 1] = Math.max(0, heap[b + 1] - p.s * 0.18);
      p.rest = false;
    };
    const addPiled = (x, a, s, look) => {
      if (piled.length >= PW * PILE_MAX_PER_PX) return false;
      const p = { el: node(pile, s, look), x, y: 0, s, a, vx: 0, vy: 0, va: 0, rest: false };
      piled.push(p); land(p);
      return true;
    };
    // 처음부터 어느 정도 쌓여 있게
    for (let i = 0; i < PW * PRESEED_PER_PX; i++) addPiled(Math.random() * PW, Math.random() * 360, 28 + Math.random() * 30, pick());
    if (reduce) return () => { piled.forEach((p) => p.el.remove()); };

    // 떨어지는 잎
    const falling = [];
    const spawn = (f, first) => {
      const W = fall.clientWidth, H = fall.clientHeight;
      f.s = 26 + Math.random() * 32;
      f.x0 = Math.random() * W; f.y = first ? Math.random() * H : -60 - Math.random() * 200;
      f.vy = 45 + Math.random() * 45; f.amp = 20 + Math.random() * 40; f.w = 0.6 + Math.random() * 0.9; f.ph = Math.random() * 6.28;
      f.a = Math.random() * 360; f.va = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 90);
      f.look = pick();
      skin(f.el, f.look);
      f.el.style.width = f.el.style.height = `${f.s}px`;
    };
    for (let i = 0; i < FALLING; i++) { const f = { el: node(fall, 30, pick()), t: 0 }; spawn(f, true); falling.push(f); }

    // 마우스: 근처에 쉬고 있는 잎을 걷어참
    let px = null, py = null, lastT = 0;
    const kick = (x, y, R, pvx, pvy) => {
      for (const p of piled) {
        const dx = p.x - x, dy = (p.y - p.s * 0.3) - y, d = Math.hypot(dx, dy);
        if (d > R) continue;
        if (p.rest) lift(p);
        const f = 1 - d / R;
        p.vx = (dx / (d || 1)) * (120 + 380 * f) + pvx * 0.35 + (Math.random() - 0.5) * 80;
        p.vy = -(220 + 520 * f) + Math.min(0, pvy * 0.3) - Math.random() * 120;
        p.va = (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 500);
      }
    };
    const local = (e) => { const r = pile.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const near = (y) => y > -PH * 1.2 && y < PH + 30;   // 더미 근처(위로 조금 여유)에서만 반응
    const onMove = (e) => {
      const [x, y] = local(e), now = performance.now();
      if (!near(y)) { px = py = null; return; }
      if (px != null) {
        const dt = Math.max(16, now - lastT) / 1000, vx = (x - px) / dt, vy = (y - py) / dt;
        if (Math.hypot(vx, vy) > 60) kick(x, y, 46 + Math.min(40, Math.hypot(vx, vy) / 40), vx, vy);
      }
      px = x; py = y; lastT = now;
    };
    const onLeave = () => { px = py = null; };
    const onDown = (e) => { const [x, y] = local(e); if (near(y)) kick(x, y, 110, 0, -400); };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });
    const ro = new ResizeObserver(resize);
    ro.observe(pile);

    let raf = 0, last = performance.now();
    const tick = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const fr = fall.getBoundingClientRect(), pr = pile.getBoundingClientRect();
      const groundVisible = pr.bottom <= window.innerHeight + 40 && pr.bottom > fr.top;
      for (const f of falling) {
        f.t += dt; f.y += f.vy * dt; f.a += f.va * dt;
        const x = f.x0 + Math.sin(f.t * f.w + f.ph) * f.amp;
        // 화면 좌표 → 더미 좌표로 바꿔 바닥(더미 표면)에 닿았는지 확인
        const lx = x + fr.left - pr.left, ly = f.y + fr.top - pr.top;
        if (groundVisible && lx > 0 && lx < PW && ly >= surface(lx)) {
          if (!addPiled(lx, f.a, f.s, f.look)) { /* 더미가 가득 차면 그냥 사라짐 */ }
          spawn(f, false);
          continue;
        }
        if (f.y > fr.height + 60) { spawn(f, false); continue; }
        f.el.style.transform = `translate3d(${(x - f.s / 2).toFixed(1)}px, ${(f.y - f.s / 2).toFixed(1)}px, 0) rotate(${f.a.toFixed(1)}deg)`;
      }
      for (const p of piled) {
        if (p.rest) continue;
        p.vy += G * dt; p.vx *= 1 - 1.6 * dt; p.va *= 1 - 1.2 * dt;
        if (p.vy > 140) p.vy -= (p.vy - 140) * 4 * dt;          // 잎이라 천천히 내려앉음
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
        if (p.x < 6) { p.x = 6; p.vx = Math.abs(p.vx) * 0.4; }
        if (p.x > PW - 6) { p.x = PW - 6; p.vx = -Math.abs(p.vx) * 0.4; }
        if (p.vy > 0 && p.y >= surface(p.x)) land(p); else place(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      ro.disconnect();
      falling.forEach((f) => f.el.remove());
      piled.forEach((p) => p.el.remove());
    };
  }, [fallRef, pileRef]);
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
          <span><span className="text-(--ink)/60">추천 곡</span> <span className="font-medium">“{pick.song}”</span></span>
        </p>
        <p className="mt-5 max-w-[46ch] break-keep text-[16px] leading-8 text-(--ink)/85">{pick.text}</p>
        <p className="mt-5 max-w-[46ch] break-keep border-l-2 border-(--accent) pl-4 text-[14px] leading-7 text-(--ink)/70">
          <span className="text-[12px] font-medium text-(--ink)">들어볼 포인트 · </span>{pick.listen}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
            YouTube에서 듣기 <span aria-hidden="true">↗︎</span>
          </a>
          <button type="button" onClick={() => onRequest(pick)}
            className="inline-flex min-h-11 items-center rounded-full border border-(--ink)/40 px-6 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--ink) hover:bg-(--ink)/5">
            Grooves에 요청하기
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
          <p className="text-[11px] uppercase tracking-[0.26em] text-(--ink)/60">앨범마다 한 곡 · 순서대로</p>
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
  const fallRef = useRef(null), pileRef = useRef(null);
  useLeaves(fallRef, pileRef);
  const onRequest = (p) => request.current?.open({ title: p.album, artist: p.artist, releaseYear: p.year });
  return (
    <div className="relative">
      <div ref={fallRef} aria-hidden="true" className="pointer-events-none sticky top-0 z-0 -mb-[100svh] h-svh overflow-hidden" />
      <div className="relative z-10">
      {/* 1 히어로 */}
      <section className="relative grid min-h-svh place-items-center overflow-hidden pb-16 pt-[calc(var(--ct-header-h,106px)+80px)]">
        <div className={`${WRAP} relative text-center`}>
          <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Picks · Autumn 2026</Reveal>
          <RiseText as="h1" lines={["Records for an", "autumn evening"]} delay={120} className={`${SERIF} mt-6 text-[clamp(2.9rem,10vw,10rem)] leading-[0.86]`} />
          <Reveal delay={500} as="p" className="mx-auto mt-8 max-w-xl text-[17px] leading-8 text-(--ink)/80">
            일곱 장의 앨범과 앨범마다 한 곡. 금빛 노을부터 불을 끄는 시간까지 함께할 음반들이에요. 해 질 녘에 시작해서 자정 무렵 마지막 판을 뒤집으세요.
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
      <section data-no-select className={`${WRAP} relative pb-[clamp(11rem,20vw,15rem)] pt-[clamp(2rem,6vw,4rem)] text-center`}>
        {/* 낙엽 더미: 글 폭과 상관없이 화면 전체 폭. 바닥(아래)만 자르고 위로 튀는 잎은 보이게 */}
        <div ref={pileRef} aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[clamp(9rem,17vw,12rem)] w-screen -translate-x-1/2 [clip-path:inset(-100vh_0_0_0)]" />
        <RiseText lines={["Got one we missed?"]} className={`${SERIF} text-[clamp(2.4rem,5.5vw,5.4rem)] leading-[0.92]`} />
        <Reveal delay={250} as="p" className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-(--ink)/75">당신에게 가을처럼 들리는 음반을 알려주세요. 크레이트에 추가될지도 몰라요.</Reveal>
        <Reveal delay={400} className="mt-9 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => request.current?.open()} className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--cream) transition-colors hover:bg-(--accent)">앨범 요청하기</button>
          <Link href="/digging" className="inline-flex min-h-12 items-center rounded-full border border-(--ink)/40 px-8 text-[12px] font-medium uppercase tracking-[0.2em] transition-colors hover:border-(--ink)">디깅 시작하기</Link>
        </Reveal>
      </section>
      </div>
      <RequestDialog ref={request} />
    </div>
  );
}
