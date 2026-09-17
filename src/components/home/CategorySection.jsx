"use client";
import Link from "next/link";

// lib/genres 로 빠질 예정. 지금은 자리표시자
const GENRES = [
  "K-indie",
  "Indie",
  "Pop",
  "Rock",
  "Folk",
  "R&B/Soul",
  "Jazz",
  "City Pop",
  "Hip-hop",
  "Classical",
  "OST",
  "기타",
];

const toSlug = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9가-힣]+/g, "-");

export default function CategorySection() {
  return (
    <section className="home-panel">
      <div className="home-panel-head">
        <span className="home-label">03 — Category</span>
        <span className="home-label">{GENRES.length} genres</span>
      </div>

      <h2>장르로 파고들기.</h2>

      <ol className="home-genres">
        {GENRES.map((genre, i) => (
          <li key={genre}>
            <Link
              className="home-genre"
              href={`/digging?genre=${toSlug(genre)}`}
            >
              <span className="home-genre-no">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="home-genre-name">{genre}</span>
              <span className="home-genre-arrow">→</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
