"use client";
import { useState } from "react";
import Link from "next/link";

// lib/genres 로 빠질 예정. covers 는 /public/images/covers/*.jpg 기준
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

const toSlug = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9가-힣]+/g, "-");

// 이름 → 커버 → 이름 → 커버 … 한 세트. 트랙은 이걸 두 번 이어 붙인다
function MarqueeSet({ genre }) {
  return (
    <div className="flex shrink-0 items-center gap-[clamp(1.5rem,4vw,4rem)] pr-[clamp(1.5rem,4vw,4rem)]">
      {genre.covers.map((cover, i) => (
        <div
          key={`${cover}-${i}`}
          className="flex shrink-0 items-center gap-[clamp(1.5rem,4vw,4rem)]"
        >
          <span className="text-[clamp(1.75rem,4.2vw,3.5rem)] leading-none font-medium lowercase">
            {genre.name}
          </span>
          {/* 커버가 없으면 이 img 대신 빈 사각형이 보인다 */}
          <img
            src={`/images/covers/${cover}.jpg`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="h-[clamp(3rem,7vh,5.5rem)] w-[clamp(3rem,7vh,5.5rem)] shrink-0 object-cover"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function CategorySection() {
  const [hovered, setHovered] = useState(null);

  return (
    <section className="relative flex h-[100svh] w-full flex-col overflow-hidden">
      <span className="absolute top-[calc(var(--navbar-h)*0.42)] left-[var(--gutter)] z-10 text-[0.72rem] tracking-[0.22em] uppercase opacity-55">
        Explore by genre
      </span>

      <ol
        className="flex flex-1 flex-col pt-[var(--navbar-h)] pb-14"
        onMouseLeave={() => setHovered(null)}
      >
        {GENRES.map((genre, i) => {
          const active = hovered === i;

          return (
            <li
              key={genre.name}
              onMouseEnter={() => setHovered(i)}
              className={[
                "group relative flex flex-1 items-center overflow-hidden",
                "border-t border-current/12 last:border-b",
                "transition-colors duration-500 ease-out",
                active
                  ? "bg-[var(--frame)] text-[var(--ink)]"
                  : "bg-transparent",
              ].join(" ")}
            >
              <Link
                href={`/digging?genre=${toSlug(genre.name)}`}
                className="absolute inset-0 z-10"
                aria-label={`${genre.name} 장르 보기`}
              />

              {/* 평상시 — 가운데 이름 하나 */}
              <span
                className={[
                  "w-full text-center text-[clamp(1.75rem,4.2vw,3.5rem)] leading-none font-medium lowercase",
                  "transition-opacity duration-300 ease-out",
                  active ? "opacity-0" : "opacity-100",
                ].join(" ")}
              >
                {genre.name}
              </span>

              {/* hover — 이 줄만 마운트되어 흐른다 */}
              {active && (
                <div className="pointer-events-none absolute inset-0 flex items-center">
                  <div className="flex w-max animate-marquee will-change-transform">
                    <MarqueeSet genre={genre} />
                    <MarqueeSet genre={genre} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 text-[0.7rem] tracking-[0.22em] uppercase opacity-50">
        <span aria-hidden="true">⌄</span>
        <span>Scroll</span>
      </div>
    </section>
  );
}
