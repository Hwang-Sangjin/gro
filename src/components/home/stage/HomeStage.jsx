"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useIntro } from "@/components/intro/intro-context";
import { useCrate } from "@/components/crate/CrateProvider";
import { createClient } from "@/utils/supabase/client";
import { fetchRecentVinyls } from "@/lib/recent-vinyls";
import { coverUrl } from "@/lib/albums";
import { HOME_GENRES, GENRE_WAVE } from "./homeGenres";
import { NEWS_ART, NEWS_ACCENT } from "./newsArt";
import { createHomeEngine } from "./homeEngine";

/* Home 4개 섹션을 한 화면(100svh)에서 전환하는 스테이지.
   0 Hero → 1 New Vinyls → 2 Genre dial → 3 News
   - 마크업은 여기, 3D·섹션 전환·입력은 homeEngine.js
   - 페이지 사이 이동은 기존 Crate Flip (아래 가운데 핸들, 메뉴), 앨범 상세는 기존 커버 이동 전환 */

const POSTS = [
  { no: "01", category: "Reissues", date: "Oct 02", kicker: "재발매 소식", title: "다시 만나는 명반", art: "reissue", href: "/news/reissues" },
  { no: "02", category: "Vinyl Care", date: "Sep 28", kicker: "바이닐 관리법", title: "오래 듣기 위한 작은 습관", art: "care", href: "/news/care" },
  { no: "03", category: "Vinyl News", date: "Sep 21", kicker: "새로운 바이닐 소식", title: "지금, 바이닐의 새로운 이야기", art: "press", href: "/news/latest" },
];
const META = ["Records", "People", "Culture", "And a slower tomorrow"];

const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";
// News에 들어올 때 아래에서 차례로 떠오름 (#news에 is-in이 붙으면)
const NEWS_IN = "opacity-0 translate-y-5 transition-[opacity,translate] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] [#news.is-in_&]:translate-y-0 [#news.is-in_&]:opacity-100";
const delay = (k) => ({ transitionDelay: `${120 + k * 70}ms` });

// 앨범 상세에서 돌아오면 떠날 때의 섹션으로 (같은 세션 동안만)
const memory = { restore: false, section: 0, dial: 0, album: null };

// 장르별 대표 커버 3장 (Supabase, 장르마다 한 번만 조회)
const coverCache = new Map();
function getGenreCovers(slug) {
  if (!coverCache.has(slug)) {
    coverCache.set(slug, (async () => {
      const supabase = createClient();
      const { data: genre } = await supabase.from("genres").select("id").eq("slug", slug).maybeSingle();
      if (!genre?.id) return [];
      const { data } = await supabase.rpc("digging_page", { p_cursor_date: null, p_cursor_id: null, p_genre_id: genre.id, p_limit: 3 });
      return (data ?? []).map((a) => ({ url: coverUrl(a.thumb_path || a.cover_path), color: a.cover_color }));
    })().catch(() => []));
  }
  return coverCache.get(slug);
}

export default function HomeStage() {
  const hostRef = useRef(null);
  const sourceRef = useRef(null);
  const engineRef = useRef(null);
  const { done } = useIntro();
  // crate 값(busy 등)이 바뀔 때마다 엔진을 다시 만들지 않도록 ref로 최신 값만 참조
  const crate = useCrate();
  const crateRef = useRef(crate);
  crateRef.current = crate;
  const doneRef = useRef(done);
  doneRef.current = done;

  // 엔진 생성 · 정리
  useEffect(() => {
    let cancelled = false;
    const initialSection = memory.restore ? memory.section : 0;
    const initialDial = memory.restore ? memory.dial : 0;
    const frontSlug = memory.restore ? memory.album : null;
    memory.restore = false;

    const openAlbum = ({ slug, color, imageUrl, rect }) => {
      if (!slug) return;
      memory.restore = true;
      memory.album = slug;
      // 기존 커버 이동 전환의 출발점: 화면에 보이는 3D 커버 위치에 투명 상자를 둠
      const source = sourceRef.current;
      Object.assign(source.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      const { bridge, go } = crateRef.current;
      if (bridge.current.openAlbum) bridge.current.openAlbum({ slug, color, imageUrl, source });
      else go(`/album/${encodeURIComponent(slug)}`);
    };

    createHomeEngine({
      root: hostRef.current,
      modelUrl: "/models/vinyl.glb",
      dracoPath: "/draco/",
      genres: HOME_GENRES,
      genreWave: GENRE_WAVE,
      getGenreCovers,
      introDone: doneRef.current,
      initialSection,
      initialDial,
      onSectionChange: (n) => { memory.section = n; },
      onOpenAlbum: openAlbum,
    }).then((engine) => {
      if (cancelled) { engine.dispose(); return; }
      engineRef.current = engine;
      // 모델을 불러오는 사이에 인트로가 끝났을 수 있음
      engine.setIntroDone(doneRef.current);
      memory.section = initialSection;
      loadAlbums(engine);
    }, (error) => console.error("Home stage could not start", error));

    async function loadAlbums(engine) {
      try {
        const rows = await fetchRecentVinyls(createClient());
        if (cancelled) return;
        engine.setAlbums(rows.map((a) => ({
          slug: a.slug, title: a.title, artist: a.artist_names || "",
          image: coverUrl(a.cover_path || a.thumb_path), color: a.cover_color || "#bbcbda",
        })), { frontSlug });
      } catch (error) {
        if (!cancelled) console.error("New vinyls could not load", error);
      }
    }

    return () => {
      cancelled = true;
      const engine = engineRef.current;
      if (engine) {
        memory.dial = engine.dialIndex;
        engine.dispose();
      }
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { if (done) engineRef.current?.setIntroDone(true); }, [done]);

  return (
    <div
      ref={hostRef}
      data-home-stage
      data-crate-ignore
      data-lenis-prevent
      className="absolute inset-x-0 bottom-0 top-[var(--ct-header-h,106px)] touch-pan-y overflow-hidden text-[var(--hs-text,#4c404a)] [&.custom-cursor]:cursor-none [&.custom-cursor_*]:cursor-none!"
    >
      {/* 3D 캔버스는 homeEngine이 이 안에 만듦 */}
      <div id="hs-canvas" className="absolute inset-0" />

      {/* 01 — Hero */}
      <h1 id="title" className={`pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center ${SERIF} text-[12.5vw] font-black leading-none tracking-[-0.02em] will-change-transform`} aria-label="Grooves">
        {"Grooves".split("").map((ch, i) => <span key={i} aria-hidden="true" className="inline-block origin-bottom">{ch}</span>)}
      </h1>

      {/* 02 — New Vinyls (판 위 3D 앨범 링) */}
      <section id="new-vinyls" className="pointer-events-none absolute inset-0" aria-labelledby="nv-title">
        <div id="nv-head" className="absolute inset-x-0 top-[clamp(0.75rem,3vh,2.5rem)] flex items-start justify-between px-6 opacity-0 sm:px-[8vw]">
          <h2 id="nv-title" className={`${SERIF} text-[clamp(3rem,6.4vw,8.5rem)] font-black uppercase leading-[0.86] tracking-[-0.02em]`}>
            <span className="nv-line block">New <span className="align-[0.5em] text-[0.55em] text-[var(--hs-ink3d)]" aria-hidden="true">✦</span></span>
            <span className="nv-line block">Vinyls</span>
          </h2>
          <Link href="/digging" className={`pointer-events-auto mt-6 border-b border-[var(--hs-text)] pb-1 ${SERIF} text-lg sm:text-xl`}>Browse all ↗</Link>
        </div>
        <div id="nv-caption" className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] text-center opacity-0" aria-live="polite">
          <p className="text-[11px] uppercase tracking-[0.42em] text-[var(--hs-ink3d)]">Fresh finds · Slow listening</p>
          <p id="nv-artist" className={`mt-2 ${SERIF} text-[clamp(1.25rem,1.6vw,2rem)] font-black uppercase tracking-wide`} />
          <p id="nv-album" className={`${SERIF} text-[clamp(1.125rem,1.3vw,1.6rem)]`} />
          <p id="nv-hint" className="mt-2 text-xs text-[var(--hs-muted)] opacity-0">커버를 한 번 더 누르면 앨범 상세로 · 바깥을 누르거나 Esc로 닫기</p>
        </div>
      </section>

      {/* 03 — Genre dial: 화면 왼쪽에 반쯤 걸친 원형 다이얼. 바늘(3시)에 온 장르가 선택됨 */}
      <div id="gd" className="pointer-events-none invisible absolute inset-0 opacity-0" role="region" aria-label="장르 다이얼">
        <svg id="gd-svg" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <circle id="gd-hit" fill="transparent" className="pointer-events-auto touch-none" />
        </svg>
        <div id="gd-labels" className="absolute inset-0" />
        <div id="gd-panel" className="pointer-events-auto absolute w-[min(clamp(34rem,40vw,52rem),calc(100vw-3rem))]">
          <p className="text-[clamp(11px,0.75vw,14px)] uppercase tracking-[0.42em] text-[var(--hs-genre)] transition-colors duration-500">Explore by genre · <span id="gd-count-idx" className="tabular-nums" /></p>
          <h2 id="gd-name" aria-live="polite" className={`mt-3 ${SERIF} text-[clamp(2.75rem,6.4vw,8.5rem)] font-black uppercase leading-[0.9] tracking-[-0.01em]`} />
          <p id="gd-desc" className={`mt-4 max-w-[clamp(28rem,32vw,40rem)] ${SERIF} text-[clamp(1.125rem,1.45vw,1.9rem)] leading-snug`} />
          <div id="gd-covers" className="mt-[clamp(1.5rem,2.5vh,2.5rem)] flex h-[clamp(7rem,12vw,15rem)] items-end" />
          <a id="gd-link" href="/digging" className={`mt-6 inline-block border-b border-[var(--hs-genre)] pb-1 transition-colors duration-500 ${SERIF} text-[clamp(1.125rem,1.4vw,1.75rem)]`} />
        </div>
      </div>

      {/* 04 — News & Stories: 다시 크림. 판은 오른쪽 칸(news-disc)으로 옮겨 와 턴테이블처럼 비스듬히 돎.
           화면보다 길면 이 안에서 스크롤 (맨 위에서 위로 스크롤하면 Genre dial로) */}
      <div id="news" data-lenis-prevent className="invisible absolute inset-0 overflow-y-auto overscroll-contain opacity-0" role="region" aria-labelledby="news-title">
        <div className="mx-auto flex min-h-full w-full max-w-[min(120rem,100%)] flex-col px-6 pb-3 pt-[clamp(1rem,3.5vh,3rem)] sm:px-10 lg:px-[5vw]">
          <div className="my-auto grid grid-cols-1 items-center gap-x-[4vw] lg:grid-cols-[minmax(0,1fr)_clamp(14rem,18vw,25rem)]">
            <div>
              <div className={`${NEWS_IN} flex items-baseline justify-between text-[clamp(10px,0.7vw,13px)] font-medium uppercase tracking-[0.24em]`} style={delay(0)}>
                <p className="text-[var(--hs-muted)]">Journal <span className="mx-2" style={{ color: NEWS_ACCENT }}>✦</span> Vol. 04</p>
                <Link href="/news" className="group/all inline-flex items-center gap-1">All news <span className="transition-transform duration-300 group-hover/all:-translate-y-0.5 group-hover/all:translate-x-0.5">↗</span></Link>
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-x-7 gap-y-3 border-b border-[var(--hs-text)] pb-4">
                <h2 id="news-title" className="min-w-0 overflow-x-visible overflow-y-clip pb-[0.04em]">
                  <span className="ink-grain block translate-y-full text-[clamp(2.4rem,4vw,6rem)] font-black uppercase leading-[0.86] whitespace-nowrap tracking-[-0.045em] transition-[translate] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] [#news.is-in_&]:translate-y-0">News&nbsp;&amp;&nbsp;Stories</span>
                </h2>
                <ul className={`${NEWS_IN} mb-1 hidden shrink-0 list-none border-l border-[var(--hs-line)] pl-4 text-[clamp(9px,0.62vw,12px)] font-medium uppercase leading-[1.7] tracking-[0.2em] text-[var(--hs-muted)] sm:block`} style={delay(1)}>
                  {META.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
              <div className="border-b border-[var(--hs-text)]">
                <div className="grid grid-cols-1 md:-mx-[clamp(1.5rem,1.8vw,2.5rem)] md:grid-cols-3">
                  {POSTS.map((post, i) => (
                    <article key={post.no} data-cursor="read" style={delay(2 + i)}
                      className={`${NEWS_IN} group relative flex flex-col py-[clamp(1.5rem,3vh,2.75rem)] md:px-[clamp(1.5rem,1.8vw,2.5rem)] ${i > 0 ? "border-t border-[var(--hs-line)] md:border-l md:border-t-0" : ""}`}>
                      <Link href={post.href} className="absolute inset-0 z-[1]" aria-label={`${post.kicker}: ${post.title}`} />
                      <div className="relative aspect-[16/10] overflow-hidden bg-[#eadcc2]">
                        <svg viewBox="0 10 400 275" className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" aria-hidden="true"
                          dangerouslySetInnerHTML={{ __html: `${NEWS_ART[post.art]()}<text x="200" y="274" text-anchor="middle" font-family="Grooves Bodoni, Georgia, serif" font-size="9" letter-spacing="3.5" fill="#4c404a" opacity=".75">GROOVES JOURNAL</text>` }} />
                      </div>
                      <p className="mt-[clamp(1rem,1.6vh,1.5rem)] flex items-center gap-2 text-[clamp(10px,0.72vw,13px)] font-medium uppercase tracking-[0.2em]">
                        <span className="font-semibold tabular-nums">{post.no}</span><span className="text-[var(--hs-muted)]">/</span><span>{post.category}</span>
                        <span className="ml-auto tabular-nums text-[var(--hs-muted)]">{post.date}</span>
                      </p>
                      <span className="mt-3 block h-px w-6 bg-[var(--hs-text)] opacity-40 transition-all duration-500 group-hover:w-14 group-hover:bg-[#c8553d] group-hover:opacity-100" />
                      <p className="mt-3 text-[clamp(12px,0.85vw,15px)] text-[var(--hs-muted)]">{post.kicker}</p>
                      <h3 className="mt-1 text-[clamp(1.05rem,1.55vw,2.1rem)] font-medium leading-snug tracking-[-0.02em] [word-break:keep-all]">{post.title}</h3>
                      <span className="mt-[clamp(1rem,1.6vh,1.5rem)] inline-flex w-fit items-center gap-1 border-b border-current pb-0.5 text-[clamp(10px,0.72vw,13px)] font-medium uppercase tracking-[0.2em] text-[#c8553d]">Read story <span className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">↗</span></span>
                    </article>
                  ))}
                </div>
              </div>
            </div>
            <aside className={`${NEWS_IN} order-last mt-10 flex flex-col items-center justify-center lg:order-none lg:mt-0`} style={delay(5)} aria-label="지금 도는 판">
              <div id="news-disc" className="aspect-square w-[min(15rem,62vw)] lg:w-full" aria-hidden="true" />
              <p className="mt-2 font-[Georgia,serif] text-[clamp(1.1rem,1.6vw,2rem)] italic">Beyond the grooves.</p>
              <p className="mt-1 text-[clamp(10px,0.7vw,13px)] uppercase tracking-[0.24em] text-[var(--hs-muted)]">Now spinning · 33⅓ rpm</p>
            </aside>
          </div>

          <div className={`${NEWS_IN} mt-[clamp(1.5rem,3.5vh,3.5rem)] flex flex-col items-center text-center`} style={delay(6)}>
            <svg className="h-[clamp(2.5rem,3.5vw,4rem)] w-auto" viewBox="0 0 96 40" fill="none" aria-hidden="true">
              <path d="M14 14c.8 3.2 1.6 4 4.8 4.8-3.2.8-4 1.6-4.8 4.8-.8-3.2-1.6-4-4.8-4.8 3.2-.8 4-1.6 4.8-4.8Z" fill="#c8553d" />
              <ellipse cx="60" cy="20" rx="28" ry="10.5" transform="rotate(-14 60 20)" stroke="#c8553d" strokeWidth="1" />
              <ellipse cx="60" cy="20" rx="21" ry="7.6" transform="rotate(-14 60 20)" fill="#a9c1db" />
              <ellipse cx="60" cy="20" rx="15" ry="5.4" transform="rotate(-14 60 20)" stroke="#8fb0d4" strokeWidth=".6" />
              <ellipse cx="60" cy="20" rx="5.4" ry="2.1" transform="rotate(-14 60 20)" fill="#c8553d" />
            </svg>
            <p className="mt-2 text-[clamp(1.45rem,2.8vw,3.6rem)] font-medium leading-[1.28] tracking-[-0.03em] [word-break:keep-all]">먼지를 털고,<br />바늘을 올릴 시간.</p>
            <Link href="/digging" className="group/dig mt-[clamp(1.25rem,2.5vh,2.25rem)] inline-flex items-center gap-2 rounded-full bg-[var(--hs-text)] px-[clamp(1.5rem,1.8vw,2.5rem)] py-[clamp(0.75rem,1vw,1.25rem)] text-[clamp(11px,0.8vw,14px)] font-semibold uppercase tracking-[0.2em] text-[var(--hs-paper)] transition-[background-color,scale] duration-300 hover:bg-[#c8553d] active:scale-95">
              Start digging <span className="transition-transform duration-300 group-hover/dig:-translate-y-0.5 group-hover/dig:translate-x-0.5">↗</span>
            </Link>
          </div>

          {/* 가운데는 비워 둠: 사이트 공용 Flip the crate 핸들이 이 선 위에 놓임 */}
          <footer className={`${NEWS_IN} mt-[clamp(1.5rem,3vh,3rem)] flex min-h-11 items-center gap-4 text-[clamp(10px,0.72vw,13px)] uppercase tracking-[0.22em]`} style={delay(7)}>
            <span className="font-semibold">Grooves</span>
            <span className="h-px flex-1 bg-[var(--hs-line)]" />
            <span className="w-40 shrink-0" aria-hidden="true" />
            <span className="h-px flex-1 bg-[var(--hs-line)]" />
            <span className="hidden font-[Georgia,serif] text-[clamp(0.875rem,1vw,1.15rem)] normal-case italic tracking-normal sm:inline">Slow down. Listen closer.</span>
          </footer>
        </div>
      </div>

      {/* 앨범 상세로 갈 때 커버 이동 전환의 출발 상자 (화면의 3D 커버 위치) */}
      <div ref={sourceRef} data-album-source className="pointer-events-none fixed" aria-hidden="true" />
      <p id="hs-err" className="absolute inset-x-4 top-1/2 hidden text-center text-sm" />

      {/* 커스텀 커서 (마우스에서만): 바깥 래퍼는 위치(JS), 안쪽은 크기·모양(CSS transition) */}
      <div id="cursor-ring" className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-300" aria-hidden="true">
        <div className="-translate-x-1/2 -translate-y-1/2">
          <div id="cursor-shape" style={{ transform: "scale(0.32)" }} className="relative h-[88px] w-[88px] rounded-full border border-[var(--hs-ink3d)] transition-[transform,background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
            <svg id="cursor-tick" className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300" viewBox="0 0 88 88" fill="none">
              <circle cx="44" cy="44" r="40" stroke="var(--hs-ink3d)" strokeWidth="0.8" strokeDasharray="1.5 5" />
              <line x1="44" y1="2" x2="44" y2="11" stroke="var(--hs-ink3d)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span id="cursor-label" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-pre text-center text-[11px] font-medium uppercase leading-[1.35] tracking-[0.14em] text-[var(--hs-text)] tabular-nums opacity-0 transition-opacity duration-300" />
        </div>
      </div>
      <div id="cursor-dot" className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-200" aria-hidden="true">
        <div className="h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--hs-text)] ring-1 ring-[var(--hs-paper)]" />
      </div>
    </div>
  );
}
