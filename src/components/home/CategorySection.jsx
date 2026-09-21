"use client";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./CategorySection.module.css";

const GENRES = [
  { name: "K-indie", covers: ["k-indie-1", "k-indie-2", "k-indie-3"] },
  { name: "Indie", covers: ["indie-1", "indie-2", "indie-3"] },
  { name: "Pop", covers: ["pop-1", "pop-2", "pop-3"] },
  { name: "Rock", covers: ["rock-1", "rock-2", "rock-3"] },
  { name: "Folk", covers: ["folk-1", "folk-2", "folk-3"] },
  { name: "R&B/Soul", covers: ["soul-1", "soul-2", "soul-3"] },
  { name: "Jazz", covers: ["jazz-1", "jazz-2", "jazz-3"] },
  { name: "City Pop", covers: ["citypop-1", "citypop-2", "citypop-3"] },
  { name: "Hip-hop", covers: ["hiphop-1", "hiphop-2", "hiphop-3"] },
  { name: "Classical", covers: ["classical-1", "classical-2", "classical-3"] },
  { name: "OST", covers: ["ost-1", "ost-2", "ost-3"] },
  { name: "기타", covers: ["etc-1", "etc-2", "etc-3"] },
];
const toSlug = name => name.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9가-힣]+/g,"-");

function Cover({ id }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={styles.cover}>
      {failed ? <span className={styles.record} /> : (
        // Fixed dimensions preserve the loop length while images load or fail.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/images/covers/${id}.jpg`} alt="" width="80" height="80"
          loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
function Seed({ genre, measureRef }) {
  return (
    <div className={styles.seed} ref={measureRef}>
      {genre.covers.map(id => (
        <span className={styles.unit} key={id}>
          <span>{genre.name}</span><Cover id={id} />
        </span>
      ))}
    </div>
  );
}
function Marquee({ genre }) {
  const viewport = useRef(null);
  const seed = useRef(null);
  const [layout, setLayout] = useState({ count: 1, duration: 20, ready: false });
  useLayoutEffect(() => {
    let frame = 0;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const w = viewport.current?.getBoundingClientRect().width ?? 0;
        const unit = seed.current?.getBoundingClientRect().width ?? 0;
        if (!w || !unit) return;
        // Each half is wider than the viewport, with an extra seed as resize buffer.
        const count = Math.ceil(w / unit) + 1;
        const duration = count * unit / 60;
        setLayout(prev => prev.ready && prev.count === count && Math.abs(prev.duration-duration)<.01
          ? prev : { count, duration, ready: true });
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    observer.observe(seed.current);
    document.fonts.ready.then(measure);
    measure();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return (
    <div className={styles.marquee} ref={viewport} aria-hidden="true" data-ready={layout.ready}>
      <div className={styles.measure}><Seed genre={genre} measureRef={seed} /></div>
      {!layout.ready && <span className={styles.loadingLabel}>{genre.name}</span>}
      <div className={styles.track} style={{ "--marquee-duration": `${layout.duration}s` }}>
        {[0,1].map(copy => (
          <div className={styles.group} key={copy}>
            {Array.from({ length: layout.count }, (_,i) => <Seed genre={genre} key={i} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
export default function CategorySection() {
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const active = focused ?? hovered;
  return (
    <section className={styles.section} aria-labelledby="genre-heading">
      <header className={styles.header}><h2 id="genre-heading">Explore by genre</h2></header>
      <ol className={styles.list} onMouseLeave={() => setHovered(null)}>
        {GENRES.map((genre,i) => (
          <li key={genre.name} className={styles.row} data-active={active === i}
            onMouseEnter={() => setHovered(i)}>
            <Link className={styles.link} href={`/digging?genre=${toSlug(genre.name)}`}
              aria-label={`${genre.name} 장르 보기`}
              onFocus={() => setFocused(i)} onBlur={() => setFocused(null)}>
              <span className={styles.label} aria-hidden="true">{genre.name}</span>
              {active === i && <Marquee genre={genre} />}
            </Link>
          </li>
        ))}
      </ol>
      <div className={styles.scroll} aria-hidden="true">⌄<br />Scroll</div>
    </section>
  );
}
