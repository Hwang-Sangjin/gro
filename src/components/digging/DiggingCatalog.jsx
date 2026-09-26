"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { GENRES } from "@/lib/genres";
import DiggingGrid from "./DiggingGrid";
import useReveal from "./useReveal";
import styles from "./Digging.module.css";

export default function DiggingCatalog({ initial, genreId, genre }) {
  const [titleRef, titleRevealed] = useReveal();
  const [filtersRef, filtersRevealed] = useReveal();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const input = useRef(null);
  const trigger = useRef(null);
  const request = useRef(null);
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
      <nav ref={filtersRef} className={`${styles.filters} ${styles.filterReveal}`} data-revealed={filtersRevealed} aria-label="장르 필터">
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
