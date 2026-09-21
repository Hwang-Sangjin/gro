"use client";
import { useState } from "react";
import Link from "next/link";
import VinylMark from "./VinylMark";
import styles from "./NewsSection.module.css";

const POSTS = [
  { no: "01", category: "Reissues", kicker: "재발매 소식", title: "다시 만나는 명반", image: "/images/news/reissues.jpg", href: "/news/reissues" },
  { no: "02", category: "Vinyl Care", kicker: "바이닐 관리법", title: "오래 듣기 위한 작은 습관", image: "/images/news/care.jpg", href: "/news/care" },
  { no: "03", category: "Vinyl News", kicker: "새로운 바이닐 소식", title: "지금, 바이닐의 새로운 이야기", image: "/images/news/news.jpg", href: "/news/latest" },
];
const META = ["Records", "People", "Culture", "And a slower tomorrow"];

function NewsImage({ src }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.image}>
      {/* Always-present fallback prevents a broken icon or blank loading area. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.placeholder} src="/images/news/placeholder.svg" alt="" aria-hidden="true" width="960" height="720" />
      {src && !failed && (
        // Adjacent article title supplies the link's accessible name.
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.photo} src={src} alt="" aria-hidden="true"
          width="960" height="720" loading="lazy" decoding="async"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
    </div>
  );
}
export default function NewsSection() {
  return (
    <section className={styles.section} aria-labelledby="news-heading">
      <div className={styles.container}>
        <div className={styles.topline}>
          <span>04 — Journal</span><Link href="/news">All news ↗</Link>
        </div>
        <div className={styles.heading}>
          <h2 id="news-heading" className="ink-grain">News &amp; Stories</h2>
          <ul className={styles.meta}>{META.map(line => <li key={line}>{line}</li>)}</ul>
          <p className={styles.motto}>Good<br />Music Lives<br />Longer.</p>
        </div>
        <div className={styles.grid}>
          {POSTS.map(post => (
            <article key={post.no} className={styles.article}>
              <Link href={post.href} className={styles.story}>
                <NewsImage key={post.image} src={post.image} />
                <div className={styles.category}><strong>{post.no}</strong><span>/</span>{post.category}</div>
                <span className={styles.rule} />
                <div className={styles.copy}><span>{post.kicker}</span><h3>{post.title}</h3></div>
                <span className={styles.read}>Read story ↗</span>
              </Link>
            </article>
          ))}
        </div>
        <div className={styles.outro}>
          <VinylMark className={styles.mark} />
          <p>먼지를 털고,<br />바늘을 올릴 시간.</p>
          <Link href="/digging" className={styles.button}>Start digging ↗</Link>
        </div>
        <footer className={styles.footer}><span>Grooves</span><span className={styles.footerLine} /><span>Slow down. Listen closer.</span></footer>
      </div>
    </section>
  );
}
