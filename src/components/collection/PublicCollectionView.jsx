"use client";
// 공개 컬렉션 화면 — 내 Collection 과 같은 머리말·탭·장르 바·그리드, 읽기 전용
import { useMemo } from "react";
import Link from "next/link";
import SplitTitle from "@/components/digging/SplitTitle";

import PageShell from "@/components/layout/PageShell";
import ShelfBrowser from "@/components/collection/ShelfBrowser";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const EMPTY = { owned: "No records on this shelf yet", wishlist: "Nothing on the wishlist yet" };

export default function PublicCollectionView({ data }) {
  const [titleRef, titleRevealed] = useReveal();
  // created_at 은 "선반에 담은 날" → added_at 으로 옮김. 그대로 두면 카드가 "새로 들어온 판"으로 읽어 모든 카드에 NEW IN 스티커가 붙었음
  const shelves = useMemo(() => {
    const shelved = (list) => (list ?? []).map(({ created_at, ...album }) => ({ ...album, added_at: created_at }));
    return { owned: shelved(data.owned), wishlist: shelved(data.wishlist) };
  }, [data]);
  return (
    <PageShell className={`${styles.page} paper-textured`}>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><SplitTitle text="COLLECTION" className="text-[clamp(2rem,6.4vw,7.4rem)]!" /></span>
          <img className={`${styles.mark} w-[clamp(84px,11vw,200px)]! ml-[clamp(0.25rem,1vw,1rem)]!`} src="/images/grooves/title-vinyl.gif" alt="" />
        </div>
      </header>
      <ShelfBrowser
        shelves={shelves} error={false}
        label={`@${data.handle}’s shelf`} tablistLabel={`@${data.handle}’s shelves`}
        aside={<Link href="/collection" className="shrink-0 underline-offset-4 hover:text-(--ink) hover:underline">Start your own ↗︎</Link>}
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
