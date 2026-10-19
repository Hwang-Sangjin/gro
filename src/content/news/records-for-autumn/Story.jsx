"use client";
// Picks — "Records for an Autumn Evening"
// 1 히어로 → 2 일곱 장(모두 LP가 있는 앨범, 버튼은 YouTube · Grooves 앨범 페이지) (스크롤하면 슬리브에서 판이 빠져나오며 돎) → 3 한 장짜리 믹스테이프(A/B면) → 4 마무리(낙엽 더미)
// 낙엽은 페이지 전체에서 떨어지고(화면에 붙은 층), 마지막 섹션 바닥에 쌓여 있음
// 슬리브는 실제 앨범 커버 대신 글자로 만든 그림 (저작권 이미지 사용 안 함)
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Reveal, { RiseText } from "@/components/story/Reveal";
import { seg, useScrollProgress } from "@/components/story/scroll";
import RequestDialog from "@/components/requests/RequestDialog";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";

// slug: albums 테이블의 slug — 버튼이 /album/<slug> 로 연결됨
const PICKS = [
  {
    artist: "잔나비", album: "소곡집 I", year: 2020, label: "Peponi Music", slug: "jannabi-small-pieces-i",
    titles: ["소곡집 I", "소곡집 1", "소곡집1", "Jannabi's Small Pieces I", "Small Pieces I"],
    song: "가을밤에 든 생각", color: "#a63c2a", ink: "#f4e7cd",
    text: "다섯 곡을 묶은 작은 앨범의 첫 곡. 찬 바람이 처음 부는 밤, 지나간 계절을 돌아보는 마음을 담았어요. LP는 2020년 한정반으로 나왔어요.",
    listen: "후렴으로 갈수록 하나씩 더해지는 악기 — 밴드 소리가 천천히 차오르는 순간.",
  },
  {
    artist: "Laufey", album: "Typical of Me", year: 2021, label: "AWAL", slug: "laufey-typical-of-me",
    song: "Like the Movies", color: "#e8d5ad", ink: "#2a222a",
    text: "재즈 스탠더드를 듣고 자란 아이슬란드 싱어송라이터의 데뷔 EP. 'Like the Movies'는 영화 속 같은 사랑을 바라는 마음을 부드러운 기타 위에 노래해요.",
    listen: "기타 한 대 위로 낮게 깔리는 목소리 — 바로 옆에서 속삭이는 듯한 거리감.",
  },
  {
    artist: "Bill Evans Trio", album: "Waltz for Debby", year: 1962, label: "Riverside", slug: "bill-evans-trio-waltz-for-debby",
    song: "My Foolish Heart", color: "#2d6a6a", ink: "#f4e7cd",
    text: "1961년 뉴욕 빌리지 뱅가드 실황. 첫 곡 'My Foolish Heart'는 브러시와 피아노가 숨죽이듯 느리게 흘러가요. 열흘 뒤 베이시스트 스콧 라파로가 세상을 떠나, 이 트리오의 마지막 기록이 되었어요.",
    listen: "연주 뒤로 들리는 잔 부딪히는 소리와 객석의 웅성임.",
  },
  {
    artist: "Earth, Wind & Fire", album: "The Best of Earth, Wind & Fire, Vol. 1", year: 1978, label: "ARC/Columbia", slug: "earth-wind-and-fire-the-best-of-vol-1",
    song: "September", color: "#e3b04b", ink: "#2a222a",
    text: "첫 줄부터 9월 21일 밤을 기억하느냐고 묻는 노래. 정규 앨범이 아니라 이 베스트 앨범에 새 곡으로 처음 실렸어요. 잔잔한 판들 사이, 한 번 일어나 춤추는 시간.",
    listen: "곡을 여는 기타 리프, 터져 나오는 혼 섹션, 그리고 'ba-dee-ya'.",
  },
  {
    artist: "Kings of Convenience", album: "Riot on an Empty Street", year: 2004, label: "Astralwerks", slug: "kings-of-convenience-riot-on-an-empty-street",
    song: "Cayman Islands", color: "#6f8fb6", ink: "#f4e7cd",
    text: "노르웨이 베르겐의 두 친구가 만든 두 번째 앨범. 기타 두 대와 나지막한 화음만으로 선선한 바람 같은 곡을 만들어요.",
    listen: "두 사람의 목소리가 한 줄처럼 겹쳐지는 화음.",
  },
  {
    artist: "girl in red", album: "we fell in love in october", year: 2018, label: "World In Red", slug: "girl-in-red-we-fell-in-love-in-october",
    song: "we fell in love in october", color: "#c96a2c", ink: "#f4e7cd",
    text: "노르웨이의 싱어송라이터 girl in red가 2018년에 낸 싱글. 제목 그대로 10월에 시작된 사랑을 거친 기타와 목소리로 담았어요. 7인치 판을 뒤집으면 처음 녹음한 데모 버전이 있어요.",
    listen: "곡 끝까지 길게 이어지는 기타 — 사랑이 계속될 것 같은 여운.",
  },
  {
    artist: "Mitski", album: "The Land Is Inhospitable and So Are We", year: 2023, label: "Dead Oceans", slug: "mitski-the-land-is-inhospitable-and-so-are-we",
    song: "My Love Mine All Mine", color: "#4c404a", ink: "#f4e7cd",
    text: "미츠키의 일곱 번째 정규 앨범에서 가장 사랑받은 곡. 내가 떠난 뒤에도 사랑만은 달에 남겨 두고 싶다는 노래라, 마지막 판으로 두기 좋아요.",
    listen: "멀리서 울리는 페달 스틸 기타, 그리고 조용히 끝나는 마지막 소절.",
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
      if (heap[b] >= cap(b)) {
        // 가까운 곳부터 양옆으로 넓혀 가며 아직 덜 찬 자리를 찾음 (없으면 가장 낮은 자리)
        let found = -1, low = 0;
        for (let d = 1; d < bins() && found < 0; d++) {
          for (const c of [b - d, b + d]) if (c >= 0 && c < bins() && heap[c] < cap(c)) { found = c; break; }
        }
        if (found < 0) heap.forEach((h, i) => { if (h < heap[low]) low = i; });
        b = found >= 0 ? found : low;
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
    // 더미 크기가 바뀌면(창 크기·글꼴 로딩·화면 회전 등) 바닥 위치가 달라져 예전 잎이 공중에 뜸
    // → 높이 지도를 비우고, 쉬고 있는 잎을 아래 것부터 새 바닥 위에 다시 앉힘
    const relayout = () => {
      const oW = PW, oH = PH;
      resize();
      if (oW === PW && oH === PH) return;
      heap.fill(0);
      // 화면이 좁아졌으면 넘치는 잎은 위에 있는 것부터 치움
      const max = Math.floor(PW * PILE_MAX_PER_PX);
      if (piled.length > max) piled.sort((a, b) => b.y - a.y).splice(max).forEach((p) => p.el.remove());
      piled.filter((p) => p.rest).sort((a, b) => b.y - a.y).forEach((p) => { p.x = (p.x / (oW || 1)) * PW; land(p); });
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(pile);

    let raf = 0, last = performance.now(), sweep = 0;
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
      // 안전장치: 1초마다 쉬고 있는 잎 중 바닥보다 한참 떠 있는 것은 다시 떨어뜨림
      if ((sweep += dt) > 1) {
        sweep = 0;
        for (const p of piled) if (p.rest && p.y < surface(p.x) - p.s * 0.9) { lift(p); p.vy = 30; }
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

// Grooves DB 에서 커버 찾기 — slug 로 먼저, 없으면 제목(+아티스트)으로. 찾으면 실제 앨범 페이지 slug 도 돌려줌
function useCovers() {
  const [found, setFound] = useState({});
  useEffect(() => {
    let off = false;
    const supabase = createClient();
    const cols = "slug, title, artist_names, thumb_path, cover_color";
    const titles = PICKS.flatMap((p) => p.titles ?? [p.album]);
    Promise.all([
      supabase.from("albums").select(cols).eq("status", "published").in("slug", PICKS.map((p) => p.slug)),
      supabase.from("albums").select(cols).eq("status", "published").in("title", titles),
    ]).then(([a, b]) => {
      if (off) return;
      const rows = [...(a.data ?? []), ...(b.data ?? [])];
      const low = (v) => String(v ?? "").toLowerCase();
      const map = {};
      for (const p of PICKS) {
        const names = (p.titles ?? [p.album]).map(low);
        const hit = rows.find((r) => r.slug === p.slug)
          ?? rows.find((r) => names.includes(low(r.title)) && low(r.artist_names).includes(low(p.artist)))
          ?? rows.find((r) => names.includes(low(r.title)));
        if (hit?.thumb_path) map[p.album] = { src: coverUrl(hit.thumb_path), color: hit.cover_color, slug: hit.slug };
      }
      setFound(map);
    }).catch(() => {});
    return () => { off = true; };
  }, []);
  return found;
}

// 실제 앨범 커버 (Grooves DB 썸네일)
function Cover({ pick, src }) {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden rounded-[3px] bg-(--cover-bg) shadow-[0_30px_60px_-30px_rgba(0,0,0,.55)]">
      <img src={src} alt={`${pick.artist} — ${pick.album}`} loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover" />
    </div>
  );
}

// 글자로 만든 슬리브 (커버를 못 찾았을 때)
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
        <p className={`${SERIF} mt-3 break-keep text-[clamp(1.3rem,2.2vw,2rem)] leading-[0.98]`}>{pick.album}</p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.24em] opacity-70 tabular-nums">{pick.year}{pick.label ? ` · ${pick.label}` : ""}</p>
      </div>
    </div>
  );
}

function Pick({ pick, i, cover }) {
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
          <Disc label={cover?.color || pick.color} className="size-full" />
        </div>
        {cover ? <Cover pick={pick} src={cover.src} /> : <Sleeve pick={pick} n={i + 1} />}
      </div>

      <Reveal className={flip ? "md:order-1" : ""}>
        <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-(--accent) tabular-nums">
          <span className={`${SERIF} text-[15px] tracking-normal`}>No. {String(i + 1).padStart(2, "0")}</span>
          <span className="h-px w-8 bg-current" />{pick.year}
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
          <Link href={`/album/${cover?.slug ?? pick.slug}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--ink)/40 px-6 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--ink) hover:bg-(--ink)/5">
            Grooves에서 보기 <span aria-hidden="true">→</span>
          </Link>
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
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-(--ink)/45">{p.year}</span>
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
  const covers = useCovers();
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
            일곱 장의 앨범과 앨범마다 한 곡. 선선한 바람이 불기 시작할 때 꺼내 듣기 좋은 판들이에요. 모두 바이닐로 구할 수 있어요.
          </Reveal>
          <Reveal delay={700} as="p" className="mt-12 flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.3em] opacity-60">
            <span className="h-10 w-px animate-[scroll-cue_1.8s_ease-in-out_infinite] bg-current motion-reduce:animate-none" />Scroll
          </Reveal>
        </div>
      </section>

      {/* 2 일곱 장 */}
      <ol className="overflow-x-clip">
        {PICKS.map((pick, i) => <Pick key={pick.album} pick={pick} i={i} cover={covers[pick.album]} />)}
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
