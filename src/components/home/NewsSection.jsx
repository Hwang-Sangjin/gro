"use client";
import Link from "next/link";

import VinylMark from "./VinylMark";

const POSTS = [
  {
    no: "01",
    category: "Reissues",
    kicker: "재발매 소식",
    title: "다시 만나는 명반",
    image: "/images/news/reissues.jpg",
    href: "/news/reissues",
  },
  {
    no: "02",
    category: "Vinyl Care",
    kicker: "바이닐 관리법",
    title: "오래 듣기 위한 작은 습관",
    image: "/images/news/care.jpg",
    href: "/news/care",
  },
  {
    no: "03",
    category: "Vinyl News",
    kicker: "새로운 바이닐 소식",
    title: "지금, 바이닐의 새로운 이야기",
    image: "/images/news/news.jpg",
    href: "/news/latest",
  },
];

const META = ["Records", "People", "Culture", "And a slower tomorrow"];

export default function NewsSection() {
  return (
    <section className="w-full px-[var(--gutter)] pt-[clamp(3rem,8vw,7rem)]">
      {/* ── 지면 헤더 ── */}
      <div className="flex items-baseline justify-between gap-6">
        <span className="text-[0.72rem] tracking-[0.22em] uppercase opacity-60">
          04 — Journal
        </span>
        <Link
          href="/news"
          className="group text-[0.72rem] tracking-[0.22em] uppercase opacity-60 transition-opacity hover:opacity-100"
        >
          All news{" "}
          <span className="inline-block transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            ↗
          </span>
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-x-[clamp(1.5rem,4vw,3.5rem)] gap-y-4">
        <h2 className="ink-grain text-[clamp(2.5rem,7vw,6rem)] leading-[0.9] font-black tracking-tight uppercase">
          News &amp; Stories
        </h2>

        <ul className="hidden border-l border-current/25 pl-[clamp(1rem,2vw,2rem)] text-[0.68rem] leading-[1.7] tracking-[0.16em] uppercase opacity-70 md:block">
          {META.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <p className="hidden text-[clamp(0.95rem,1.3vw,1.15rem)] leading-tight text-[var(--frame)] italic lg:block">
          Good
          <br />
          Music Lives
          <br />
          Longer.
        </p>
      </div>

      <hr className="mt-4 border-0 border-t-2 border-current/60" />

      {/* ── 기사 3편 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3">
        {POSTS.map((post, i) => (
          <article
            key={post.no}
            className={[
              "group flex flex-col gap-4 py-[clamp(1.5rem,3vw,2.5rem)]",
              i > 0
                ? "md:border-l md:border-current/20 md:pl-[clamp(1rem,2.5vw,2.5rem)]"
                : "",
              i < POSTS.length - 1 ? "md:pr-[clamp(1rem,2.5vw,2.5rem)]" : "",
            ].join(" ")}
          >
            <Link href={post.href} className="flex flex-col gap-4">
              <div className="aspect-[4/3] w-full overflow-hidden">
                <img
                  src={post.image}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
                />
              </div>

              <div className="flex items-baseline gap-2 text-[0.72rem] tracking-[0.18em] uppercase">
                <strong className="font-medium">{post.no}</strong>
                <span className="opacity-40">/</span>
                <span className="opacity-70">{post.category}</span>
              </div>

              <span className="block h-px w-8 bg-current/40" />

              <div className="flex flex-col gap-2">
                <span className="text-[0.9rem] opacity-70">{post.kicker}</span>
                <h3 className="text-[clamp(1.35rem,2.2vw,1.9rem)] leading-tight font-medium break-keep">
                  {post.title}
                </h3>
              </div>

              <span className="mt-2 inline-flex w-fit items-center gap-1.5 border-b border-[var(--accent-rust)] pb-1 text-[0.72rem] tracking-[0.18em] text-[var(--accent-rust)] uppercase">
                Read story
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </span>
            </Link>
          </article>
        ))}
      </div>

      <hr className="border-0 border-t-2 border-current/60" />

      {/* ── 아웃트로 ── */}
      <div className="flex flex-col items-center gap-7 py-[clamp(4rem,10vw,8rem)] text-center">
        <VinylMark className="h-[clamp(3.5rem,7vw,5.5rem)] w-auto" />

        <p className="text-[clamp(1.75rem,4.5vw,3.25rem)] leading-[1.25] font-medium break-keep">
          먼지를 털고,
          <br />
          바늘을 올릴 시간.
        </p>

        <Link
          href="/digging"
          className="group inline-flex items-center gap-2 rounded-full bg-[var(--page-fg)] px-8 py-4 text-[0.78rem] tracking-[0.18em] text-[var(--page-bg)] uppercase transition-opacity hover:opacity-85"
        >
          Start digging
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            ↗
          </span>
        </Link>
      </div>

      {/* ── 푸터 ── */}
      <footer className="flex items-center gap-5 border-t border-current/25 py-7 text-[0.78rem]">
        <span className="tracking-[0.14em] uppercase">Grooves</span>
        <span className="h-px flex-1 bg-current/25" />
        <span className="opacity-70 italic">Slow down. Listen closer.</span>
      </footer>
    </section>
  );
}
