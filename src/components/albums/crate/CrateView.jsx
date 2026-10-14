"use client";
// Crate 보기 — Digging · Collection(Owned / Wishlist) · 공개 컬렉션 공용
// 그리드 위에 화면을 덮는 3D 크레이트. 전환은 Grid / Crate 버튼으로만
//  - Grid → Crate: 화면에 보이는 그리드 판들이 차례로 날아와 크레이트에 꽂힘 (맨 앞 = 화면의 첫 판)
//  - Crate: 스크롤·드래그·키로 판이 끝없이 넘어감. 맨 앞 판을 누르면 앨범 상세로 (커버가 날아가는 전환)
//  - Crate → Grid: 맨 앞 판의 칸이 보이게 스크롤해 두고, 판들이 맨 앞부터 차례로 날아가 칸에 꽂힘
// 카드 정보는 그리드 DOM([data-album-card])에서 읽음 → 장르·탭·검색으로 걸러진 지금 그리드 그대로
import { useCallback, useEffect, useRef, useState } from "react";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif]";
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const storeKey = () => `grooves:crate:${location.pathname}`;

/** Grid / Crate 스위치 (그리드 위·크레이트 위 같은 모양) */
export function ViewToggle({ view, onChange, className = "" }) {
  return (
    <div role="group" aria-label="View" className={`relative inline-flex shrink-0 rounded-full border border-(--ink)/30 p-[3px] ${className}`}>
      <span aria-hidden="true" className={`absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-(--ink) transition-transform duration-500 ${EASE} ${view === "crate" ? "translate-x-full" : ""}`} />
      {["grid", "crate"].map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => onChange(v)}
          className={`relative z-[1] min-h-8 w-[4.6rem] rounded-full text-[11px] font-medium uppercase tracking-[0.2em] transition-colors duration-500 ${view === v ? "text-(--cream)" : "text-(--ink)"}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

function readCards(root) {
  if (!root) return [];
  return [...root.querySelectorAll("[data-album-card]")].map((a) => ({
    slug: a.dataset.albumSlug, color: a.dataset.albumColor, image: a.dataset.albumImage || null,
    title: a.dataset.albumTitle || "", artist: a.dataset.albumArtist || "",
    art: a.querySelector("[data-album-source]"),
  })).filter((c) => c.slug && c.art);
}

/**
 * gridRef: 그리드 카드들을 감싼 요소 · view / onViewChange: 'grid' | 'crate' (페이지가 상태를 가짐)
 * title: 크레이트 왼쪽 위 큰 글자 (예: DIGGING, OWNED)
 */
export default function CrateView({ gridRef, view, onViewChange, title }) {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const sourceRef = useRef(null);
  const cardsRef = useRef([]);
  const [shown, setShown] = useState(false);        // 덮개가 있음 (전환 중 포함)
  const [front, setFront] = useState(null);         // { i, n, title, artist, color }
  const transition = useAlbumTransition();
  const modeRef = useRef("grid");

  const page = () => hostRef.current?.closest(".page");
  const lockPage = (on) => page()?.dispatchEvent(new Event(on ? "page:lock" : "page:unlock"));

  const engine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    const { createCrateEngine } = await import("./crateEngine");
    if (!hostRef.current) return null;
    engineRef.current = createCrateEngine({
      host: hostRef.current,
      onFront: (i, c) => setFront({ i, n: cardsRef.current.length, title: c.title, artist: c.artist, color: c.color, slug: c.slug }),
      onOpen: (i, rect) => openAlbum(i, rect),
      onSettled: (m) => {
        if (m === "grid") { setShown(false); lockPage(false); }
      },
    });
    return engineRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAlbum(i, rect) {
    const c = cardsRef.current[i];
    if (!c) return;
    try { sessionStorage.setItem(storeKey(), JSON.stringify({ view: "crate", slug: c.slug })); } catch {}
    const src = sourceRef.current;
    Object.assign(src.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    if (transition) transition.openAlbum({ slug: c.slug, color: c.color, imageUrl: c.image, source: src });
    else location.assign(`/album/${encodeURIComponent(c.slug)}`);
  }

  // 보기 바뀜 → 전환
  useEffect(() => {
    let alive = true;
    (async () => {
      if (view === modeRef.current) return;
      const eng = await engine();
      if (!alive || !eng) return;
      if (view === "crate") {
        const cards = readCards(gridRef.current);
        if (!cards.length) { onViewChange("grid"); return; }
        cardsRef.current = cards;
        // 화면에 보이는 첫 판 (헤더 아래)
        const topLine = (hostRef.current.getBoundingClientRect().top || 0) + 80;
        const start = Math.max(0, cards.findIndex((c) => c.art.getBoundingClientRect().bottom > topLine));
        modeRef.current = "crate";
        setShown(true); lockPage(true);
        eng.setFog(getComputedStyle(page() || document.body).backgroundColor);
        eng.toCrate(cards, start);
      } else {
        if (eng.busy) return;
        modeRef.current = "grid";
        try { sessionStorage.removeItem(storeKey()); } catch {}
        // 맨 앞 판의 칸이 화면 위쪽에 오도록 페이지를 옮긴 뒤 날려 보냄
        const c = cardsRef.current[eng.front];
        const pg = page();
        if (c?.art && pg) {
          const r = c.art.getBoundingClientRect(), pr = pg.getBoundingClientRect();
          const top = Math.max(0, pg.scrollTop + r.top - pr.top - Math.min(220, pr.height * 0.25));
          pg.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top } }));
        }
        requestAnimationFrame(() => requestAnimationFrame(() => eng.toGrid()));
      }
    })();
    return () => { alive = false; };
  }, [view, engine, gridRef, onViewChange]);

  // 앨범 상세에서 돌아오면: 떠날 때 크레이트였으면 그 판을 맨 앞에 두고 바로 크레이트로
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(storeKey()) || "null"); } catch {}
    if (saved?.view !== "crate") return;
    let done = false;
    const tryOpen = async () => {
      const cards = readCards(gridRef.current);
      const i = cards.findIndex((c) => c.slug === saved.slug);
      if (done || i < 0) return false;
      done = true;
      const eng = await engine();
      if (!eng) return true;
      cardsRef.current = cards;
      modeRef.current = "crate";
      setShown(true); lockPage(true);
      eng.setFog(getComputedStyle(page() || document.body).backgroundColor);
      eng.toCrate(cards, i, { instant: true });
      onViewChange("crate");
      return true;
    };
    const mo = new MutationObserver(() => { tryOpen(); });
    if (gridRef.current) mo.observe(gridRef.current, { childList: true, subtree: true });
    tryOpen();
    const t = setTimeout(() => { mo.disconnect(); if (!done) try { sessionStorage.removeItem(storeKey()); } catch {} }, 5000);
    return () => { mo.disconnect(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc → 그리드
  useEffect(() => {
    if (view !== "crate") return;
    const esc = (e) => { if (e.key === "Escape") onViewChange("grid"); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [view, onViewChange]);

  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; lockPage(false); }, []);

  return (
    <>
      <div ref={hostRef} data-lenis-prevent data-crate-ignore tabIndex={view === "crate" ? 0 : -1}
        aria-hidden={!shown} aria-label={shown ? `${title} crate. Scroll or use the arrow keys to dig; press Enter to open the front record.` : undefined}
        role={shown ? "region" : undefined}
        className={`fixed inset-0 z-[25] isolate touch-none outline-none ${shown ? "visible" : "invisible pointer-events-none"} ${view === "crate" ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ "--crate-m": 1 }}>
        {/* 바탕: 그리드와 같은 종이(페이지 색 + 종이 결) — 헤더와 이어짐. 그리드로 갈수록 투명해져 아래 그리드가 드러남 */}
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ opacity: "calc(1 - var(--crate-m))" }}>
          <div className="absolute inset-0 bg-(--bg)" />
          <div className="absolute inset-0 bg-(--paper-surface,var(--bg)) bg-(image:--paper-texture-image) bg-repeat bg-blend-soft-light opacity-(--paper-texture-opacity) [background-size:var(--paper-texture-size)_var(--paper-texture-size)]" />
        </div>
        {/* 글자: 크레이트를 떠나자마자 빠지고, 돌아오면 판들이 거의 다 꽂힐 때 나타남 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-[clamp(16px,4vw,56px)] pb-[clamp(20px,5vh,48px)] pt-[calc(var(--ct-header-h,106px)+0.5rem)] text-(--ink)"
          style={{ opacity: "max(0, 1 - var(--crate-m) * 5)" }}>
          <div className="flex items-start justify-between gap-4 max-md:flex-col-reverse max-md:gap-3">
            <p className={`${SERIF} min-w-0 text-[clamp(2.25rem,6vw,5.75rem)] font-black uppercase leading-[0.86] tracking-[-0.02em]`}>{title}</p>
            <div className="pointer-events-auto flex flex-col items-end gap-3 max-md:self-end">
              <ViewToggle view={view} onChange={onViewChange} />
              <p className="hidden text-right text-[11px] uppercase leading-5 tracking-[0.24em] text-(--ink)/55 md:block">Scroll · Drag · ← → to dig<br />Click the front record to open</p>
            </div>
          </div>
          {front && (
            <div className="flex items-end justify-between gap-6 max-md:flex-col-reverse max-md:items-start max-md:gap-2">
              <p key={front.slug} className={`${SERIF} min-w-0 flex-1 truncate text-[clamp(1.9rem,5.6vw,6rem)] font-black uppercase leading-none tracking-[-0.02em] animate-[crate-title_.8s_cubic-bezier(.22,1,.36,1)_both]`}
                style={{ color: `color-mix(in oklab, ${front.color || "var(--ink)"} 55%, var(--ink))` }}>{front.title}</p>
              <div className="shrink-0 text-right max-md:text-left">
                <p className={`${SERIF} text-[clamp(1.6rem,3vw,2.75rem)] font-bold tabular-nums leading-none`}>{String(front.i + 1).padStart(3, "0")} / {String(front.n).padStart(3, "0")}</p>
                <p className="mt-2 max-w-[22rem] truncate text-[12px] uppercase tracking-[0.24em] text-(--ink)/70">{front.artist}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 앨범 상세로 날아가는 커버의 출발점 (맨 앞 판 자리에 맞춰 둠) */}
      <div ref={sourceRef} aria-hidden="true" className="pointer-events-none fixed z-[26]" />
    </>
  );
}
