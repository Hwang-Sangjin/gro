"use client";
// 내 판: 소장(Owned) / 위시리스트(Wishlist) — Digging 과 같은 머리말·장르 바(GenreBar)·그리드(AlbumGrid)
// 탭·장르·검색·그리드는 ShelfBrowser (공개 컬렉션 /collection/<아이디> 와 같이 씀), 오른쪽 위 "Share" 로 공개 설정
import { useEffect, useState } from "react";
import Link from "next/link";

import PageShell from "@/components/layout/PageShell";
import ShelfBrowser from "@/components/collection/ShelfBrowser";
import ShareCollection from "@/components/collection/ShareCollection";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";
import useAuthUser, { profileOf } from "@/lib/useAuthUser";
import { fetchShelves } from "@/lib/userAlbums";
import shuffle from "@/lib/shuffle";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const EMPTY = {
  owned: { title: "Your shelf is empty", hint: "Tap ‘I own this’ on any album page to shelve it here." },
  wishlist: { title: "Start a wishlist", hint: "Tap ‘Add to wishlist’ on any album page to save it here." },
};

export default function Collection() {
  const user = useAuthUser();   // undefined = 확인 중
  const [shelves, setShelves] = useState(null);
  const [error, setError] = useState(false);
  const [titleRef, titleRevealed] = useReveal();

  useEffect(() => {
    if (!user) { setShelves(null); return; }
    let alive = true;
    setError(false);
    // 들어올 때마다 순서를 섞어서 (새로 발견하는 느낌으로)
    fetchShelves().then(s => { if (alive) setShelves({ owned: shuffle(s.owned), wishlist: shuffle(s.wishlist) }); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [user]);

  const name = profileOf(user).name;

  return (
    <PageShell className={`${styles.page} paper-textured`}>
      <header className={styles.header}>
        <div ref={titleRef} className={`${styles.titleRow} ${styles.titleReveal}`} data-revealed={titleRevealed}>
          <span className={styles.titleMask}><h1 className={`${styles.title} text-[clamp(2.25rem,8.6vw,10rem)]!`}>COLLECTION</h1></span>
          <img className={`${styles.mark} w-[clamp(84px,11vw,200px)]! ml-[clamp(0.25rem,1vw,1rem)]!`} src="/images/grooves/title-vinyl.gif" alt="" />
        </div>
      </header>

      {user === null ? (
        <div className="mt-6 flex flex-col items-start gap-6 border-t-[3px] border-(--ink) pt-10">
          <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>Log in to start your shelf</p>
          <p className="text-[15px] leading-7 text-(--ink)/70">Keep the records you own and the ones you want, all in one place.</p>
          <Link href="/login?next=/collection" className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
            Login
          </Link>
        </div>
      ) : (
        <ShelfBrowser
          shelves={shelves} error={error} errorText="Couldn’t load your shelves. Please refresh."
          label={name ? `${name}’s shelf` : "My shelf"} tablistLabel="My shelves"
          aside={user ? <ShareCollection user={user} /> : null}
          basePath="/collection" ready={user !== undefined}
          renderEmpty={(tab) => (
            <>
              <p className={`${SERIF} text-[clamp(1.75rem,3vw,2.5rem)] font-black leading-tight`}>{EMPTY[tab].title}</p>
              <p className="mt-3 text-[15px] leading-7 text-(--ink)/70">{EMPTY[tab].hint}</p>
              <Link href="/digging" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[13px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
                Start digging
              </Link>
            </>
          )}
        />
      )}
    </PageShell>
  );
}
