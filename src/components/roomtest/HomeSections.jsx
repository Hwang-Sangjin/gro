"use client";
// 새 Home 의 방 뒤 섹션들 (방 스테이지 위로 스크롤되어 올라옴)
//  New Vinyls(끝없이 끄는 앨범 갤러리 + 장르 필터, 크림) → News(잉크) → 늦은 밤의 방이 비치는 창(투명) → Footer(크림)
//  섹션 자체는 투명. 바탕색과 섹션 사이 전환(노이즈 경계)은 화면에 붙어 있는 캔버스가 그림 (inkWipe.js, RoomTest 스크롤 처리)
//   - data-bg: 그 섹션 바탕 (cream · ink · none = 뚫려서 방이 비침)
//   - 다음 색은 섹션보다 최대 45svh 먼저 올라옴 → 섹션마다 끝에 그만큼 빈 여백(GAP)을 둠 (앞 섹션의 글·그림 위로 번지지 않게)
import { memo, useEffect, useRef, useState } from "react";
import { cached } from "@/lib/dataCache";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";
import { GENRES } from "@/lib/genres";
import { getGenreCounts, hasRecords } from "@/lib/genreCounts";
import { GENRE_LOOK } from "@/components/home/stage/homeGenres";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import Reveal, { RiseText } from "@/components/story/Reveal";
import CursorWeight, { CW_FONT } from "@/components/motion/CursorWeight";
import StoryCover from "@/content/news/Covers";
import { STORIES, categoryName } from "@/content/news";
import SiteFooter from "@/components/layout/SiteFooter";
import DigGallery from "./DigGallery";
import { SLEEVE } from "./inkWipe";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const KICKER = "text-[11px] font-medium uppercase tracking-[0.3em]";

const GAP = <div aria-hidden="true" className="h-[45svh]" />;
// 방 → New Vinyls 앞 여백: 슬리브(SLEEVE.lift 만큼 먼저 올라옴)와 그 그림자가 방 완성 화면에서 딱 안 보이는 만큼만
//  예전엔 45svh 라 첫 0.45화면 동안 스크롤해도 아무것도 올라오지 않았음 → 지금은 첫 휠부터 슬리브가 올라옴
const LEAD = <div aria-hidden="true" style={{ height: `${(SLEEVE.lift + SLEEVE.shadow) * 100}svh` }} />;

// ── New Vinyls: 끝없이 끌어서 둘러보는 앨범 갤러리 (DigGallery) + 장르 필터 ─────────
// 제목·장르·안내는 갤러리 밖 위쪽에 고정. 갤러리는 화면 폭 전체, 가장자리 커버는 잘려 보임 (바깥에도 판이 이어지는 느낌)
const NV_COUNT = 30;
const NV_STAY = 2.2;    // New Vinyls 섹션 길이 (화면 높이 배수). 클수록 갤러리가 오래 화면에 머묾    // 갤러리에 펼칠 앨범 수 (최신순). 적으면 같은 판이 더 자주 반복됨
const NV_DRIFT = 0.5;   // 갤러리가 붙어 있는 동안 스크롤 1px 에 판들이 위로 흘러가는 거리 (Route 66 처럼 스크롤하면 늘 화면이 움직임)
// 갤러리 커버는 한 변이 160px 이하 → 작은 그림(thumb)으로 충분 (Digging 카드와 같음). 큰 원본 30장을 받지 않음
const toCard = (a) => ({ slug: a.slug, title: a.title, artist: a.artist_names || "", image: coverUrl(a.thumb_path || a.cover_path), color: a.cover_color || "#bbcbda" });
// 장르 slug(전체 = "") → 앨범 목록. 저장해 둔 것을 바로 쓰고 5분이 지났으면 뒤에서 새로 받아 둠 (dataCache.js — 새로 고쳐도 · 다음 방문에도 남음)
function fetchShelf(slug) {
  const key = slug ?? "";
  return cached("nv-shelf:" + key, (async () => {
    const supabase = createClient();
    if (!slug) {
      const { data } = await supabase.from("albums").select("slug, title, artist_names, cover_path, thumb_path, cover_color")
        .eq("status", "published").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(NV_COUNT);
      return (data ?? []).map(toCard);
    }
    const { data: genre } = await supabase.from("genres").select("id").eq("slug", slug).maybeSingle();
    if (!genre?.id) return [];
    const { data } = await supabase.rpc("digging_page", { p_cursor_date: null, p_cursor_id: null, p_genre_id: genre.id, p_limit: NV_COUNT });
    return (data ?? []).map(toCard);
  }), { valid: (list) => list?.length > 0 }).catch(() => []);
}

function NewVinyls({ albums }) {
  const [genre, setGenre] = useState(null);          // 고른 장르 (바로 바뀜)
  const [shown, setShown] = useState({ genre: null, list: null });   // 갤러리에 펼친 판 (사라진 뒤 바뀜)
  const [fading, setFading] = useState(false);
  const wanted = useRef(null);
  const [counts, setCounts] = useState(null);   // 장르별 판 수 — 0장인 장르는 버튼에서 뺌
  const transition = useAlbumTransition();
  const list = shown.list ?? albums;   // 전체 목록을 받기 전에는 최신 7장으로
  const look = shown.genre ? GENRE_LOOK[shown.genre] : null;
  const name = shown.genre ? GENRES.find((g) => g.slug === shown.genre)?.name : null;

  useEffect(() => {   // 전체(최신 30장)
    let off = false;
    getGenreCounts(createClient()).then((c) => { if (!off) setCounts(c); });
    fetchShelf(null).then((rows) => { if (!off && rows.length && wanted.current == null) setShown({ genre: null, list: rows }); });
    return () => { off = true; };
  }, []);
  // 장르를 바꾸면: 갤러리가 흐려지고(0.3s) → 그 장르 판으로 바뀐 뒤 다시 나타남
  function pick(slug) {
    if (slug === genre) return;
    setGenre(slug); wanted.current = slug; setFading(true);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 흐려지는 동안 새 목록과 커버 그림을 받아 둠 (그림을 다 받기 전에 나타나면 이전 커버가 잠깐 보였다가 바뀜). 그림은 최대 1.5초만 기다림
    const rows = fetchShelf(slug);
    const pics = rows.then((list) => Promise.race([
      Promise.all(list.map((a) => new Promise((done) => { const im = new Image(); im.onload = im.onerror = done; im.src = a.image; }))),
      new Promise((r) => setTimeout(r, 1500)),
    ]));
    Promise.all([rows, pics, new Promise((r) => setTimeout(r, reduced ? 0 : 300))]).then(([list]) => {
      if (wanted.current !== slug) return;
      setShown({ genre: slug, list });
      requestAnimationFrame(() => requestAnimationFrame(() => { if (wanted.current === slug) setFading(false); }));
    });
  }
  const open = (e, a, cover) => {
    if (!transition || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    transition.openAlbum({ slug: a.slug, color: a.color, imageUrl: a.image, source: cover });
  };

  return (
    // 섹션은 화면 높이의 NV_STAY 배: 그동안 제목·갤러리가 화면에 붙어 있어서 충분히 둘러본 뒤에야 다음 섹션(News)이 올라옴
    <section data-hs-section data-bg="cream" className="relative text-(--ink)" aria-labelledby="nv-title">
      <div data-nv-track style={{ height: `${NV_STAY * 100}svh` }}>
      {/* 화면 전체가 갤러리. 제목·장르·안내는 그 위에 작게 얹음 (레퍼런스처럼 넓게: 헤더 아래부터 화면 끝까지 판이 깔림) */}
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* 고른 장르 색이 옅게 번짐 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 transition-[opacity,background-color] duration-700"
          style={{ opacity: look ? 0.2 : 0, backgroundColor: look?.ink ?? "transparent", maskImage: "radial-gradient(120% 90% at 80% 100%, #000 0%, transparent 70%)", WebkitMaskImage: "radial-gradient(120% 90% at 80% 100%, #000 0%, transparent 70%)" }} />

        {/* 탐색 영역: 화면 전체 */}
        <div className="absolute inset-0 transition-opacity duration-300" style={{ opacity: fading ? 0 : 1 }}>
          {list.length
            ? <DigGallery key={shown.genre ?? "all"} albums={list} onOpen={open} scrollDrift={NV_DRIFT} />
            : <p className="px-[var(--gutter)] pt-[40svh] text-sm opacity-60">{name ? `No ${name} records in the crate yet.` : "Loading records…"}</p>}
        </div>

        {/* 위: 헤더 아래 한 줄 — 제목 · 장르 · 전체 보기. 판이 그 밑으로 지나가도 읽히게 바탕색이 아래로 옅어지는 띠 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 pt-[calc(var(--ct-header-h,106px)+0.25rem)]">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[calc(100%+3.5rem)]"
            style={{ background: "linear-gradient(to bottom, var(--cream) 0%, var(--cream) 72%, transparent 100%)" }} />
          <div className="relative flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 px-[var(--gutter)]">
            <div className="flex items-baseline gap-4">
              <RiseText as="h2" lines={["New Vinyls"]} className={`${SERIF} ink-grain text-[clamp(1.6rem,2.6vw,2.8rem)] font-black uppercase leading-none tracking-[-0.01em]`} />
              <Reveal as="p" delay={120} className={`${KICKER} opacity-55`}>{list.length ? (shown.genre ? `${list.length} record${list.length === 1 ? "" : "s"}` : `Latest ${list.length}`) : "Fresh in the crate"}</Reveal>
            </div>
            <Reveal delay={200} className="pointer-events-auto">
              <Link href={shown.genre ? `/digging?genre=${shown.genre}` : "/digging"} className={`${KICKER} group/dig border-b border-current/30 pb-1 transition-colors duration-300 hover:border-(--accent) hover:text-(--accent)`}>
                {shown.genre ? `Dig into ${name}` : "All records"} <span className="inline-block transition-transform duration-300 group-hover/dig:translate-x-1">→</span>
              </Link>
            </Reveal>
          </div>
          <Reveal delay={260} role="group" aria-label="Genre" className="pointer-events-auto relative mt-3 flex gap-x-1 gap-y-1 overflow-x-auto px-[calc(var(--gutter)-0.4rem)] [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden" data-lenis-prevent-touch>
            {[{ slug: null, name: "All" }, ...GENRES].filter((g) => hasRecords(counts, g.slug, genre)).map((g) => (
              <button key={g.slug ?? "all"} type="button" aria-pressed={genre === g.slug} onClick={() => pick(g.slug)}
                className="group/g shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] opacity-50 transition-opacity duration-300 hover:opacity-100 aria-pressed:opacity-100">
                <span aria-hidden="true">[ </span><span className="underline-offset-4 group-aria-pressed/g:underline">{g.name}</span><span aria-hidden="true"> ]</span>
              </button>
            ))}
          </Reveal>
        </div>

        {/* 아래: 짧은 설명 (장르를 고르면 그 장르 소개) */}
        <p className="pointer-events-none absolute bottom-[clamp(1rem,3vh,2rem)] left-[var(--gutter)] max-w-[36ch] text-[11px] leading-relaxed opacity-55">
          {look?.desc ?? "Records that just landed. Drag anywhere to dig through the pile, click a cover to open it."}
        </p>
      </div>
      </div>
      {GAP}
    </section>
  );
}

// ── News: 판 뒷면 트랙리스트 (Side B) ─────────────────────────────
// 한 줄 = 기사 하나: B1 · 제목(+ 첫 문장) · 카테고리 · 날짜 · 읽는 시간. 위 New Vinyls(그림 갤러리)와 대비되는 글자 중심 섹션
// 줄에 마우스를 올리면 그 기사 커버가 커서 옆에 떠서 따라오고, 줄은 살짝 밀리며 나머지 줄은 옅어짐 (마우스가 있는 기기에서만)
const NEWS_ROWS = 6;
// 마우스를 올린 줄의 커버: 커서와의 가로 거리(px) · 커서가 커버 높이의 어디쯤 오는지(0 위 … 1 아래) · 따라오는 속도(1 = 바로 붙음)
const NEWS_COVER = { gap: 32, anchorY: 0.5, follow: 0.25 };   // 보여 줄 기사 수 (최신순)
const NEWS_LIST = [...STORIES].sort((a, b) => b.date.localeCompare(a.date)).slice(0, NEWS_ROWS);
const shortDate = (d) => new Date(`${d}T12:00:00+09:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "Asia/Seoul" });

// 섹션에 들어왔는지 (화면 아래 30% 위로 올라왔을 때 한 번): 줄 긋기·제목 올라오기를 그때 시작
function useArrived(ref, margin = "0px 0px -30% 0px") {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { root: el.closest(".page"), rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return on;
}

function News() {
  const wrapRef = useRef(null), listRef = useRef(null), prevRef = useRef(null);
  const [active, setActive] = useState(-1);   // 커버를 띄운 줄 (-1 = 없음)
  const arrived = useArrived(wrapRef);
  const ease = "cubic-bezier(.22,1,.36,1)";
  const at = (ms) => ({ transitionDelay: arrived ? `${ms}ms` : "0ms" });

  // 커버 따라다니기
  //  - 줄 위에서 마우스가 움직이면(onPointerMove) 그 줄 커버를 켜고, 커서 좌표로 목표 자리를 정함 (aim)
  //  - 목록 밖으로 나가면(onPointerLeave) 끔
  //  - 마우스를 가만히 두고 스크롤하면 줄 쪽 이벤트가 안 오므로, 스크롤 때 마지막 커서 자리 아래 줄을 다시 찾음 (recheck)
  //  - 커버 상자는 목표를 향해 매 프레임 남은 거리의 FOLLOW 만큼 다가감 (follow)
  const m = useRef({ x: 0, y: 0, tx: 0, ty: 0, px: -1, py: -1, raf: 0, on: false, reduced: false });
  const follow = () => {
    const s = m.current, el = prevRef.current;
    s.raf = 0;
    if (!el) return;
    const k = s.reduced ? 1 : NEWS_COVER.follow;
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
    el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`;
    if (Math.abs(s.tx - s.x) > 0.3 || Math.abs(s.ty - s.y) > 0.3) s.raf = requestAnimationFrame(follow);
  };
  // 커서(화면 좌표) → 커버 목표 자리: 커서 오른쪽 NEWS_COVER.gap, 세로로는 커서가 커버 가운데 (오른쪽 끝에 닿으면 커서 왼쪽, 위아래는 화면 안)
  const aim = (cx, cy) => {
    const s = m.current, el = prevRef.current;
    if (!el) return;
    s.px = cx; s.py = cy;
    const w = el.offsetWidth, vw = window.innerWidth, vh = window.innerHeight, g = NEWS_COVER.gap;
    s.tx = cx + g + w > vw - 8 ? cx - g - w : cx + g;
    s.ty = Math.max(8, Math.min(vh - w - 8, cy - w * NEWS_COVER.anchorY));
    if (!s.on) { s.on = true; s.x = s.tx; s.y = s.ty; }   // 처음 뜰 때는 그 자리에서 바로
    if (!s.raf) s.raf = requestAnimationFrame(follow);
  };
  const onRow = (i) => (e) => { if (e.pointerType !== "mouse") return; aim(e.clientX, e.clientY); setActive(i); };
  const hide = () => { m.current.on = false; m.current.px = -1; setActive(-1); };
  useEffect(() => {
    const s = m.current, list = listRef.current;
    s.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scroller = list?.closest(".page");
    if (!scroller) return;
    let pending = 0;
    const recheck = () => {
      pending = 0;
      if (s.px < 0) return;
      const row = document.elementFromPoint(s.px, s.py)?.closest("[data-news-row]");
      if (row && list.contains(row)) { aim(s.px, s.py); setActive(Number(row.dataset.newsRow)); }
      else { s.on = false; setActive(-1); }
    };
    const onScroll = () => { if (!pending) pending = requestAnimationFrame(recheck); };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => { scroller.removeEventListener("scroll", onScroll); cancelAnimationFrame(pending); cancelAnimationFrame(s.raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section data-hs-section data-bg="ink" className="relative px-[var(--gutter)] text-(--cream)" aria-labelledby="news-title">
      {/* 헤더 밑 띠: Home 헤더는 투명이라 기사 줄이 메뉴 글자 밑으로 지나가면 겹쳐 읽힘 → 섹션 바탕색을 헤더 높이만큼 깔고 아래로 옅어지게 (New Vinyls 의 띠와 같은 방식) */}
      <div aria-hidden="true" className="pointer-events-none sticky top-0 z-10 -mx-[var(--gutter)] h-0">
        <div className="h-[calc(var(--ct-header-h,106px)+2rem)]" style={{ background: "linear-gradient(to bottom, var(--ink) 0%, var(--ink) 68%, transparent 100%)" }} />
      </div>
      {/* 가운데 한 단: 화면이 넓어도 줄이 너무 길어지지 않게 */}
      <div ref={wrapRef} className="mx-auto w-full max-w-[1080px] pt-[clamp(6rem,18vh,14rem)]">
        <div className="flex flex-col items-center pb-[clamp(2rem,5vh,3.5rem)] text-center">
          <Reveal as="p" className={`${KICKER} opacity-60`}>Side B · Journal</Reveal>
          {/* 제목: 굵은 글자가 커서 근처에서만 가늘어짐 (반대 방향) */}
          <RiseText as="h2" lines={[<CursorWeight key="t" text="News & Stories" rest={900} near={250} radius={300} />]} className={`${CW_FONT} mt-3 text-[clamp(2.4rem,5.6vw,6rem)] font-black uppercase leading-[0.9] tracking-[-0.015em]`} />
          <Reveal delay={200} className="mt-5"><Link href="/news" className={`${KICKER} border-b border-current/30 pb-1 transition-colors duration-300 hover:border-[#7fc1bd] hover:text-[#7fc1bd]`}>All news →</Link></Reveal>
        </div>

        {/* 트랙리스트 머리줄 (판 뒷면처럼) */}
        <div aria-hidden="true" className={`${KICKER} relative hidden grid-cols-[3.5rem_1fr_8rem_5rem_4.5rem] gap-x-5 pb-3 text-[10px] transition-opacity duration-700 md:grid`}
          style={{ opacity: arrived ? 0.45 : 0, ...at(150) }}>
          <span>No.</span><span>Title</span><span>Category</span><span>Date</span><span className="text-right">Time</span>
          <span className="absolute inset-x-0 bottom-0 h-px origin-left bg-current transition-transform duration-[1100ms]" style={{ transform: `scaleX(${arrived ? 1 : 0})`, transitionTimingFunction: ease, ...at(150) }} />
        </div>

        <ol ref={listRef} onPointerLeave={hide} className="relative">
          {NEWS_LIST.map((post, i) => {
            const d = 260 + i * 90;   // 줄마다 차례로
            return (
              <li key={post.slug} data-news-row={i} className="relative">
                <Link href={`/news/${post.slug}`} onPointerEnter={onRow(i)} onPointerMove={onRow(i)}
                  className={`group/row grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 py-[clamp(1rem,2.6vh,1.6rem)] transition-opacity duration-300 md:grid-cols-[3.5rem_1fr_8rem_5rem_4.5rem] md:gap-x-5 ${active >= 0 && active !== i ? "md:opacity-35" : ""}`}>
                  <span className={`${KICKER} text-[11px] tabular-nums transition-opacity duration-700`} style={{ opacity: arrived ? 0.6 : 0, ...at(d) }}>B{i + 1}</span>
                  <span className="min-w-0 transition-transform duration-500 ease-groove group-hover/row:translate-x-3 motion-reduce:transition-none motion-reduce:group-hover/row:translate-x-0">
                    {/* 제목: 줄 마스크 아래에서 올라옴 */}
                    <span className="block overflow-y-clip pb-[0.08em]">
                      <span className={`${SERIF} block text-[clamp(1.35rem,2.4vw,2.4rem)] leading-[1.08] tracking-[-0.01em] transition-[translate] duration-(--dur-enter-title) [word-break:keep-all] motion-reduce:transition-none`}
                        style={{ translate: arrived ? "0 0" : "0 110%", transitionTimingFunction: ease, ...at(d) }}>{post.title}</span>
                    </span>
                    {post.dek && <span lang="ko" className="mt-1.5 block max-w-[60ch] truncate text-[0.82rem] transition-opacity duration-700 max-md:hidden" style={{ opacity: arrived ? 0.55 : 0, ...at(d + 160) }}>{post.dek}</span>}
                  </span>
                  <span className={`${KICKER} hidden text-[10px] transition-opacity duration-700 md:block`} style={{ opacity: arrived ? 0.6 : 0, ...at(d + 120) }}>{categoryName(post.category)}</span>
                  <span className={`${KICKER} hidden text-[10px] tabular-nums transition-opacity duration-700 md:block`} style={{ opacity: arrived ? 0.6 : 0, ...at(d + 160) }}>{shortDate(post.date)}</span>
                  <span className={`${KICKER} text-right text-[10px] tabular-nums transition-opacity duration-700`} style={{ opacity: arrived ? 0.6 : 0, ...at(d + 200) }}>
                    {post.read ?? ""} <span aria-hidden="true" className="ml-1 inline-block transition-[translate,color] duration-300 group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5 group-hover/row:text-[#7fc1bd]">↗︎</span>
                  </span>
                </Link>
                {/* 줄 사이 선: 왼쪽에서 오른쪽으로 그어짐 */}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-left bg-current/20 transition-transform duration-[1100ms] motion-reduce:transition-none"
                  style={{ transform: `scaleX(${arrived ? 1 : 0})`, transitionTimingFunction: ease, ...at(d - 80) }} />
              </li>
            );
          })}

          {/* 마우스 옆에 뜨는 커버 (커버를 모두 겹쳐 두고 해당 줄 것만 보임). 화면 기준으로 고정
              바깥 상자는 위치(transform)만, 커지고 나타나는 건 안쪽 상자에서 — 한 상자에 scale 을 같이 주면 CSS 가 scale 을 먼저 적용해
              옮긴 거리까지 줄어들어 커서와 어긋났음 */}
          <div ref={prevRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-30 hidden w-[clamp(180px,14vw,240px)] md:block">
            <div className={`relative transition-[opacity,scale] duration-300 ease-groove motion-reduce:transition-none ${active >= 0 ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
              {NEWS_LIST.map((post, i) => (
                <StoryCover key={post.slug} name={post.cover}
                  className={`aspect-square rounded-sm shadow-[0_24px_48px_-20px_rgba(0,0,0,.6)] ${i === 0 ? "relative" : "absolute inset-0"} transition-opacity duration-200 ${active === i ? "opacity-100" : "opacity-0"}`} />
              ))}
            </div>
          </div>
        </ol>
      </div>

      <div aria-hidden="true" className="h-[clamp(4rem,10vh,8rem)]" />
      {GAP}
    </section>
  );
}

// ── 늦은 밤의 방 (투명한 창: 뒤에 붙어 있는 방 스테이지가 비침) + Footer ──
function Closing({ onTop }) {
  return (
    <>
      {/* 265svh: 방이 사진으로 올라와 화면 가득 커진 뒤 문구가 올라옴. data-hs-needle = 이 줄이 화면 가운데쯤 오면 바늘이 내려감 (RoomTest) */}
      <section data-hs-section data-bg="none" data-hs-night className="relative flex h-[265svh] flex-col items-center justify-end px-[var(--gutter)] pb-[62svh] text-center text-[#f4e7cd]">
        <Reveal as="p" className={`${KICKER} opacity-70`}>Still spinning · 33⅓ RPM</Reveal>
        <span data-hs-needle aria-hidden="true" className="block h-0" />
        {/* 문구 전체: 가늘게 있다가 커서가 가까이 오는 글자만 굵어짐 (가변 Hahmlet) */}
        <RiseText as="p" lines={[<CursorWeight key="a" text="Dust it off," />, <CursorWeight key="b" text="drop the needle." />]}
          className={`${CW_FONT} mt-4 text-[clamp(2rem,5vw,5.5rem)] leading-[1.08] tracking-[-0.02em]`} />
        <Reveal delay={350}>
          <Link href="/digging" className="group/dig mt-[clamp(1.5rem,4vh,3rem)] inline-flex items-center gap-2 rounded-full bg-[#f4e7cd] px-[clamp(1.5rem,1.8vw,2.5rem)] py-[clamp(0.75rem,1vw,1.25rem)] text-[clamp(11px,0.8vw,14px)] font-semibold uppercase tracking-[0.2em] text-[#4c404a] transition-[background-color,scale] duration-300 hover:bg-[#7fc1bd] active:scale-95">
            Start digging <span className="transition-transform duration-300 group-hover/dig:-translate-y-0.5 group-hover/dig:translate-x-0.5">↗︎</span>
          </Link>
        </Reveal>
      </section>
      <section data-hs-section data-bg="cream" className="relative text-(--ink)">
        <div aria-hidden="true" className="h-[clamp(4rem,8vw,7rem)]" />
        <SiteFooter onSideA={onTop} />
      </section>
    </>
  );
}

/** albums: 최신 7장 · posts: News 카드 3장 · onTop: Footer 의 "맨 위로"
 *  memo: 방 이야기 쪽 상태(Hero·진행도·목차)가 바뀌어도 갤러리·뉴스는 다시 그리지 않음 */
export default memo(function HomeSections({ albums, posts, onTop }) {
  return (
    <div className="relative z-10">
      {LEAD}
      <NewVinyls albums={albums} />
      <News />
      <Closing onTop={onTop} />
    </div>
  );
});
