"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { fetchRecentVinyls } from "@/lib/recent-vinyls";
import VinylShelf from "./VinylShelf";
import styles from "./NewVinylsSection.module.css";

export default function NewVinylsSection() {
  const headingRef = useRef(null);
  const [titleVisible, setTitleVisible] = useState(false);

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    if (!("IntersectionObserver" in window)) {
      setTitleVisible(true);
      return;
    }
    // PageShell owns the scroll viewport, not document.body.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setTitleVisible(true);
      observer.disconnect();
    }, { root: heading.closest(".page"), threshold: .3 });
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  const [active, setActive] = useState(0);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    async function load() {
      try {
        const albums = await fetchRecentVinyls(createClient(), controller.signal);
        if (controller.signal.aborted) return;
        setItems(albums);
        setActive(0);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    load();
    return () => controller.abort();
  }, [attempt]);

  const item = items[active] ?? items[0];
  return (
    <section className={styles.section} aria-labelledby="new-vinyls-title">
      <header ref={headingRef} className={styles.heading} data-revealed={titleVisible}>
        <h2 id="new-vinyls-title" className={styles.title}>
          <span className={styles.revealMask}><span className={styles.revealLine}>New <svg viewBox="-16 -16 32 32" aria-hidden="true"><path d="M0-15C1.5-4 4-1.5 15 0 4 1.5 1.5 4 0 15-1.5 4-4 1.5-15 0-4-1.5-1.5-4 0-15Z" fill="currentColor" /></svg></span></span>
          <span className={styles.revealMask}><span className={styles.revealLine}>Vinyls</span></span>
        </h2>
      </header>
      <div className={styles.stage} aria-busy={status === "loading"}>
        {status === "ready" && items.length > 0 ? (
          <VinylShelf items={items} onActiveChange={setActive} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 pt-40 text-center" role="status" aria-live="polite">
            <p>{status === "loading" ? "새로 등록된 바이닐을 불러오는 중…" : status === "error" ? "바이닐을 불러오지 못했어요." : "아직 공개된 바이닐이 없어요."}</p>
            {status === "error" && <button type="button" className="cursor-pointer rounded-full border border-current px-5 py-2 focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => setAttempt(value => value + 1)}>다시 시도</button>}
          </div>
        )}
      </div>
      {status === "ready" && item && <footer className={styles.footer}>
        <div aria-live="polite" aria-atomic="true">
          <span className={styles.counter}>{String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
          <strong className={styles.album}>{item.title}</strong>
          <span className={styles.artist}>{item.artist_names || "아티스트 미등록"}</span>
        </div>
        <span className={styles.hint}>Drag to explore ↔</span>
      </footer>}
    </section>
  );
}
