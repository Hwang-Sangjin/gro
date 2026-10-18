"use client";
// 공개 컬렉션 화면 — 내 Collection 과 같은 머리말·탭·장르 바·그리드, 읽기 전용
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";
import ShelfBrowser from "@/components/collection/ShelfBrowser";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const EMPTY = { owned: "No records on this shelf yet", wishlist: "Nothing on the wishlist yet" };

export default function PublicCollectionView({ data }) {
  const [titleRef, titleRevealed] = useReveal();
  const shelves = { owned: data.owned, wishlist: data.wishlist };
  return (
    <PageShell className={`${styles.page} paper-textured`}>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><h1 className={`${styles.title} text-[clamp(2.25rem,8.6vw,10rem)]!`}>COLLECTION</h1></span>
          <img className={`${styles.mark} w-[clamp(84px,11vw,200px)]! ml-[clamp(0.25rem,1vw,1rem)]!`} src="/images/grooves/title-vinyl.gif" alt="" />
        </div>
      </header>
      <ShelfBrowser
        shelves={shelves} error={false}
        label={`@${data.handle}’s shelf`} tablistLabel={`@${data.handle}’s shelves`}
        aside={<Link href="/collection" className="shrink-0 underline-offset-4 hover:text-(--ink) hover:underline">Start your own ↗</Link>}
        basePath={`/collection/${data.handle}`}
        renderEmpty={(tab) => (
          <>
            <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>{EMPTY[tab]}</p>
            <Link href="/digging" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
              Start digging
            </Link>
          </>
        )}
      />
    </PageShell>
  );
}
