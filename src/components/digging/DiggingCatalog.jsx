"use client";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { GENRES } from "@/lib/genres";
import DiggingGrid from "./DiggingGrid";
import useReveal from "./useReveal";
import styles from "./Digging.module.css";

// 장르를 바꾸면 이 컴포넌트가 새로 만들어지므로, 직전 알약 위치를 기억해 두고 거기서부터 미끄러지게 함
let lastPill = null;

/* 장르 알약: 선택된 장르 뒤에 깔린 하늘색 알약이 마우스를 따라 미끄러지고, 손을 떼면 선택된 장르로 돌아감 */
function useGenrePill(navRef, deps) {
  const pillRef = useRef(null);
  useLayoutEffect(() => {
    const nav = navRef.current, pill = pillRef.current;
    if (!nav || !pill) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const place = (el, animate = true) => {
      if (!el || el.offsetParent === null) { pill.style.opacity = "0"; return; }
      const r = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      pill.style.transition = animate && !reduced ? "" : "none";
      pill.style.opacity = "1";
      pill.style.transform = `translate(${r.x}px, ${r.y}px)`;
      pill.style.width = `${r.w}px`;
      pill.style.height = `${r.h}px`;
      if (el.matches("[aria-current=page], [data-active=true]")) lastPill = r;
    };
    const active = () => nav.querySelector("[aria-current=page]:not([hidden] *), button[data-active=true]") || nav.querySelector("a");
    // 직전 위치에서 시작해 새 장르로 미끄러짐
    if (lastPill) {
      pill.style.transition = "none";
      Object.assign(pill.style, { opacity: "1", transform: `translate(${lastPill.x}px, ${lastPill.y}px)`, width: `${lastPill.w}px`, height: `${lastPill.h}px` });
      void pill.offsetWidth;
    }
    place(active(), !!lastPill);
    const over = (e) => { const el = e.target.closest?.("a, button"); if (el && nav.contains(el)) place(el); };
    const leave = () => place(active());
    const resize = () => place(active(), false);
    nav.addEventListener("pointerover", over);
    nav.addEventListener("pointerleave", leave);
    nav.addEventListener("focusin", over);
    nav.addEventListener("focusout", leave);
    window.addEventListener("resize", resize);
    return () => {
      nav.removeEventListener("pointerover", over);
      nav.removeEventListener("pointerleave", leave);
      nav.removeEventListener("focusin", over);
      nav.removeEventListener("focusout", leave);
      window.removeEventListener("resize", resize);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return pillRef;
}

export default function DiggingCatalog({ initial, genreId, genre }) {
  const [titleRef, titleRevealed] = useReveal();
  const [filtersRef, filtersRevealed] = useReveal();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const input = useRef(null);
  const trigger = useRef(null);
  const request = useRef(null);
  const navRef = useRef(null);
  const pillRef = useGenrePill(navRef, [genre, more, filtersRevealed]);
  function closeSearch() { setQuery(""); setOpen(false); trigger.current?.focus(); }
  return (
    <>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><h1 className={styles.title}>DIGGING</h1></span>
          {/* Existing transparent brand asset; no new artwork dependency. */}
          <img className={styles.mark} src="/images/grooves/vinyl-mark.png" alt="" />
        </div>
        <div className={styles.actions}>
          <button className={styles.request} onClick={() => request.current?.showModal()}>+ Request</button>
          <span className={styles.separator} aria-hidden="true" />
          <div className={styles.search} data-open={open}>
            <button ref={trigger} type="button" className={styles.iconButton} aria-label="앨범 검색" aria-expanded={open} aria-controls="digging-search" onClick={() => { setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/></svg>
            </button>
            <div className={styles.searchField} inert={!open}>
              <input id="digging-search" ref={input} type="search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape") closeSearch(); }} placeholder="앨범, 아티스트 검색" aria-label="앨범명 또는 아티스트" />
              <button type="button" className={styles.iconButton} onClick={closeSearch} aria-label="검색 닫기">×</button>
            </div>
          </div>
        </div>
      </header>
      {/* 스크롤해도 장르 줄은 헤더 아래에 붙어 있음 */}
      <nav ref={(el) => { filtersRef.current = el; navRef.current = el; }} className={`${styles.filters} ${styles.filterReveal} sticky top-[calc(var(--ct-header-h,106px)-3px)] z-20 bg-[var(--dig-paper,#f3e7cd)] transition-colors duration-[800ms]`} data-revealed={filtersRevealed} aria-label="장르 필터">
        <span ref={pillRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 -z-0 rounded-full bg-[#bbcbda] opacity-0 transition-[transform,width,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" />
        <Link href="/digging" scroll={false} aria-current={!genre ? "page" : undefined}>All</Link>
        {GENRES.slice(0, 8).map((g, i) => <Link style={{ "--reveal-order": i + 1 }} key={g.slug} href={`/digging?genre=${g.slug}`} scroll={false} aria-current={genre === g.slug ? "page" : undefined}>{g.name}</Link>)}
        <button style={{ "--reveal-order": 9 }} type="button" aria-expanded={more} aria-controls="digging-more" data-active={GENRES.slice(8).some(g => g.slug === genre)} onClick={() => setMore(!more)}>More {more ? "−" : "+"}</button>
        <div id="digging-more" className={styles.more} hidden={!more}>
          {GENRES.slice(8).map(g => <Link key={g.slug} href={`/digging?genre=${g.slug}`} scroll={false} aria-current={genre === g.slug ? "page" : undefined}>{g.name}</Link>)}
        </div>
      </nav>
      <DiggingGrid initial={initial} genreId={genreId} query={query} />
      <dialog ref={request} className={styles.dialog}>
        <h2>Request a record</h2>
        <p>앨범 등록 요청 기능을 준비하고 있어요.</p>
        <form method="dialog"><button className={styles.request}>닫기</button></form>
      </dialog>
    </>
  );
}
