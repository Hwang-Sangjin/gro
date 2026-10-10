"use client";
/* Digging "Crate" 보기 — 그리드와 같은 앨범들을 3D 크레이트로.
   - 그리드 → 크레이트: 장르 바를 위에 붙인 뒤, 화면에 보이는 그리드 커버 자리에 3D 카드를 겹쳐 놓고(그리드 이미지는 숨김)
     카드들이 차례로 들려 크레이트 줄로 날아감
   - 크레이트 → 그리드: 맨 앞 판이 화면 위쪽에 오게 그리드를 스크롤해 두고, 판들이 각자 칸으로 날아가 내려앉음
   - 크레이트 중에는 페이지 스크롤을 잠그고 휠·드래그·←/→가 판을 넘김. Esc = 그리드로
   3D는 crateEngine.js (필요할 때 불러옴) */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import { coverUrl } from "@/lib/albums";

// 크레이트에서 앨범 상세로 갔다가 돌아오면 그 판이 맨 앞에 오도록
export const crateMemory = { slug: null };

const PAPER = "#f3e7cd", INK = "#4c404a";
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const f = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); const [r, g, b] = rgb(h).map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, k) => "#" + rgb(a).map((v, i) => Math.round((v + (rgb(b)[i] - v) * k) * 255).toString(16).padStart(2, "0")).join("");
// 제목 글자색 = 앨범 색. 배경과 대비가 모자라면 잉크 쪽으로
function accentFor(color) {
  const bg = mix(PAPER, color, 0.16);
  for (let k = 0; k <= 1.001; k += 0.05) { const c = mix(color, INK, k); if (contrast(c, bg) >= 3.2) return c; }
  return INK;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function DiggingCrate({ albums, view, setView, hasMore, loadMore, gridRef, onPhase }) {
  const stageRef = useRef(null);
  const proxyRef = useRef(null);
  const engineRef = useRef(null);
  const [mode, setMode] = useState("grid");       // grid | toCrate | crate | toGrid
  const [front, setFront] = useState(-1);
  const transition = useAlbumTransition();
  const albumsRef = useRef(albums); albumsRef.current = albums;
  const moreRef = useRef({ hasMore, loadMore }); moreRef.current = { hasMore, loadMore };
  const firstRef = useRef(true);

  const page = () => gridRef.current?.closest(".page");
  const bar = () => document.querySelector("[data-dig-bar]");
  const cardArt = (idx) => {
    const a = albumsRef.current[idx];
    return a ? gridRef.current?.querySelector(`[data-album-slug="${CSS.escape(a.slug)}"] [data-album-source]`) : null;
  };
  const rectOf = (idx) => {
    const el = cardArt(idx); if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight ? r : null;
  };

  // 페이지 스크롤 잠금 (Lenis 정지 + 네이티브 스크롤 막기)
  const lock = useCallback((on) => {
    const p = page(); if (!p) return;
    window.dispatchEvent(new Event(on ? "page-scroll:lock" : "page-scroll:unlock"));
    p.style.overflow = on ? "hidden" : "";
  }, []);
  // 장르 바를 헤더 아래에 붙임 (붙는 동안 바가 접히는 애니메이션까지 기다림)
  const stickBar = useCallback(async (smooth) => {
    const p = page(), b = bar(); if (!p || !b) return;
    const need = b.offsetTop - (parseFloat(getComputedStyle(b).top) || 0) + 1;
    if (p.scrollTop >= need) return;
    if (smooth) {
      const from = p.scrollTop, t0 = performance.now();
      while (true) {
        const k = Math.min(1, (performance.now() - t0) / 450);
        p.scrollTop = from + (need - from) * (1 - (1 - k) ** 3);
        if (k >= 1) break;
        await nextFrame();
      }
    } else p.scrollTop = need;
    await wait(smooth ? 520 : 40);
  }, []);
  const placeStage = useCallback(() => {
    const b = bar(), s = stageRef.current; if (!b || !s) return;
    const top = `${Math.max(0, b.getBoundingClientRect().bottom)}px`;
    s.style.top = top;
    page()?.style.setProperty("--crate-top", top);
  }, []);

  async function engine() {
    if (engineRef.current) return engineRef.current;
    const { createCrateEngine } = await import("./crateEngine");
    const e = createCrateEngine({
      container: stageRef.current,
      onFront: (i) => setFront(i),
      onBg: (hex) => {
        const p = page(), layer = p?.closest(".ct-page");
        if (hex === PAPER) { p?.style.removeProperty("--dig-paper"); layer?.style.removeProperty("--ct-header-bg"); }
        else { p?.style.setProperty("--dig-paper", hex); layer?.style.setProperty("--ct-header-bg", hex); }
      },
      onNeedMore: () => { const m = moreRef.current; if (m.hasMore) m.loadMore(); },
      onOpen: (idx, rect) => openAlbum(idx, rect),
    });
    e.setAlbums(toEngine(albumsRef.current));
    engineRef.current = e;
    return e;
  }
  const toEngine = (list) => list.map((a) => ({ key: a.id ?? a.slug, slug: a.slug, title: a.title, artist: a.artist_names, color: a.cover_color || "#bbcbda", image: coverUrl(a.thumb_path || a.cover_path) }));

  // 앨범 목록이 바뀌면(더 불러옴·검색) 엔진에도
  useEffect(() => { engineRef.current?.setAlbums(toEngine(albums)); }, [albums]);

  // 요청된 보기(view)와 지금 상태(mode)를 맞춤
  useEffect(() => {
    if (mode === "toCrate" || mode === "toGrid") return;
    if (view === "crate" && mode === "grid") enter(firstRef.current);
    else if (view === "grid" && mode === "crate") leave();
    firstRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mode]);

  async function enter(direct) {
    setMode("toCrate");
    onPhase?.(direct ? "crate" : "lifting");  // 먼저 그리드 글자(캡션)만 정리 — 이미지는 3D가 자리 잡을 때 숨김
    // 페이지 넘김(Crate Flip)·인트로 중엔 화면 위치가 기울어져 있어 잴 수 없음 → 끝날 때까지 기다림
    while (document.documentElement.dataset.crateTransition === "true" || document.querySelector(".preloader")) await wait(80);
    lock(true);
    await stickBar(!direct);
    placeStage();
    const e = await engine();
    if (direct) {
      const keep = crateMemory.slug ? albumsRef.current.findIndex((a) => a.slug === crateMemory.slug) : -1;
      await e.enterDirect(Math.max(0, keep));
    } else {
      // 화면에 보이는 첫 카드부터
      const list = albumsRef.current;
      let start = list.findIndex((_, i) => { const r = rectOf(i); return r && r.top > -r.height * 0.4; });
      if (start < 0) start = 0;
      await e.enterFromRects(start, rectOf, () => {
        if (gridRef.current) gridRef.current.dataset.phase = "crate";   // 같은 프레임에 바로 (React 반영을 기다리지 않음)
        onPhase?.("crate");
      });
    }
    setMode("crate");
  }

  async function leave() {
    const e = engineRef.current; if (!e) { setMode("grid"); return; }
    setMode("toGrid");
    const f = e.frontIndex();
    // 맨 앞 판이 화면 위쪽에 오게 그리드를 스크롤 (장르 바는 붙은 채로)
    const p = page(), b = bar(), el = cardArt(f);
    if (p && el) {
      const need = b ? b.offsetTop - (parseFloat(getComputedStyle(b).top) || 0) + 1 : 0;
      const barBottom = b ? b.getBoundingClientRect().bottom : 0;
      p.scrollTop = Math.max(need, p.scrollTop + el.getBoundingClientRect().top - barBottom - 28);
    }
    onPhase?.("leaving");
    await nextFrame();
    // 돌아온 뒤 캡션이 화면에 보이는 카드 순서대로 나타나게
    let k = 0;
    albumsRef.current.forEach((_, i) => { const el = cardArt(i)?.closest("[data-album-slug]"); if (el) el.style.setProperty("--k", rectOf(i) ? k++ : 0); });
    await e.exitToRects(rectOf);
    onPhase?.("grid");                       // 이미지 바로 보이고, 글자는 차례로 돌아옴
    lock(false);
    setFront(-1);
    setMode("grid");
  }

  function openAlbum(idx, rect) {
    const a = albumsRef.current[idx]; if (!a) return;
    crateMemory.slug = a.slug;
    const src = proxyRef.current;
    Object.assign(src.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    if (transition) {
      engineRef.current?.hideFront(true);
      transition.openAlbum({ slug: a.slug, color: a.cover_color, imageUrl: coverUrl(a.thumb_path || a.cover_path), source: src });
      setTimeout(() => engineRef.current?.hideFront(false), 1500);   // 이동이 취소된 경우 대비
    } else location.assign(`/album/${encodeURIComponent(a.slug)}`);
  }

  // 키보드 · 크기
  useEffect(() => {
    if (mode !== "crate") return;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, dialog")) return;
      if (["ArrowRight", "ArrowDown"].includes(e.key)) { engineRef.current?.step(1); e.preventDefault(); }
      if (["ArrowLeft", "ArrowUp"].includes(e.key)) { engineRef.current?.step(-1); e.preventDefault(); }
      if (e.key === "Escape") setView("grid");
    };
    const onResize = () => placeStage();
    addEventListener("keydown", onKey); addEventListener("resize", onResize);
    return () => { removeEventListener("keydown", onKey); removeEventListener("resize", onResize); };
  }, [mode, setView, placeStage]);

  // 정리
  useEffect(() => () => {
    engineRef.current?.dispose(); engineRef.current = null;
    const p = page(); p?.style.removeProperty("--dig-paper"); p?.closest(".ct-page")?.style.removeProperty("--ct-header-bg");
    if (p) p.style.overflow = "";
    window.dispatchEvent(new Event("page-scroll:unlock"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = mode !== "grid";
  const a = albums[front];
  const accent = a ? accentFor(a.cover_color || "#bbcbda") : INK;
  return (
    <>
      {/* 3D 무대: 장르 바 아래부터 화면 끝까지 */}
      <div ref={stageRef} data-lenis-prevent aria-hidden={!shown}
        className={`fixed inset-x-0 bottom-0 z-10 cursor-grab touch-none ${shown ? "" : "pointer-events-none invisible"}`} />
      {/* 맨 앞 앨범 정보 */}
      <div aria-live="polite"
        className={`pointer-events-none fixed inset-x-[clamp(22px,4vw,72px)] bottom-[clamp(1.25rem,5vh,3rem)] z-10 flex flex-col-reverse items-start gap-2 transition-opacity duration-500 md:flex-row md:items-end md:justify-between md:gap-6 ${mode === "crate" && a ? "opacity-100" : "opacity-0"}`}>
        <div className="relative h-[1.02em] w-full min-w-0 overflow-hidden font-['Grooves_Bodoni',Georgia,serif] text-[clamp(1.9rem,6vw,6.5rem)] font-black uppercase leading-none tracking-[-0.03em] md:flex-1" style={{ color: accent }}>
          {a && <span key={a.slug} className="absolute bottom-0 left-0 block animate-[crate-title_.9s_cubic-bezier(.22,1,.36,1)_both] truncate whitespace-nowrap pr-[0.1em]" style={{ maxWidth: "100%" }}>{a.title}</span>}
        </div>
        <div className="shrink-0 md:text-right">
          <p className="font-['Grooves_Bodoni',Georgia,serif] text-[clamp(1.6rem,2.6vw,2.6rem)] font-bold tabular-nums leading-none text-[#4c404a]">
            {String(front + 1).padStart(3, "0")}<span className="mx-2 opacity-40">/</span>{String(albums.length).padStart(3, "0")}{hasMore ? "+" : ""}
          </p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.24em]" style={{ color: accent }}>{a?.artist_names}</p>
        </div>
      </div>
      <p className={`pointer-events-none fixed right-[clamp(22px,4vw,72px)] z-10 hidden text-[10px] font-medium uppercase tracking-[0.3em] text-[#4c404a80] transition-opacity duration-500 [@media(pointer:fine)]:block ${mode === "crate" ? "opacity-100" : "opacity-0"}`}
        style={{ top: "calc(var(--crate-top, 160px) + 16px)" }}>Scroll · Drag · ← → · Esc</p>
      {/* 앨범 상세로 날아가는 전환의 출발점 (보이지 않는 상자) */}
      <div ref={proxyRef} aria-hidden="true" className="pointer-events-none fixed opacity-0" />
    </>
  );
}
