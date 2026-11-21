"use client";
// Collection 그리드의 첫 칸: 손글씨 메모가 적힌 크래프트 판지 (Digging 의 장르 칸막이와 같은 물건 — Digging.module.css .divider)
//  탭(다이모 라벨): Owned / Wishlist (장르를 골랐으면 장르 이름)
//  마커 손글씨: 판 수 · 가장 많은 장르("mostly Indie") · 가장 최근에 담은 판("+ The Bends")
//  Crate 보기에서는 이 판지가 상자 맨 앞에 꽂힘 (CrateView 가 data-crate-divider 를 읽음)
import "@fontsource/permanent-marker/400.css";
import { GENRE_ITEMS, lineOf } from "@/components/albums/GenreBar";
import styles from "@/components/digging/Digging.module.css";

const nameOf = (slug) => GENRE_ITEMS.find((g) => g.slug === slug)?.name ?? null;

/**
 * albums: 지금 보여 주는 판들 (탭 · 장르로 거른 것) · latest: 그 가운데 가장 최근에 담은 판
 * tab: "Owned" | "Wishlist" · genre: 고른 장르 slug (없으면 전체) · leaving: 그리드가 접히는 중 (글씨가 지워짐)
 */
export default function ShelfNote({ albums, latest, tab, genre = null, leaving = false }) {
  const n = albums.length;
  // 가장 많은 장르 (전체를 볼 때만 · 판이 셋 이상일 때만 — 한두 장으로 "mostly" 는 어색함)
  let top = null;
  if (!genre && n >= 3) {
    const count = {};
    for (const a of albums) for (const g of a.genres ?? []) count[g] = (count[g] ?? 0) + 1;
    top = Object.keys(count).sort((a, b) => count[b] - count[a])[0] ?? null;
  }
  const head = `${n} record${n === 1 ? "" : "s"}`;
  const line = genre ? `in ${tab}` : top ? `mostly ${nameOf(top)}` : tab === "Wishlist" ? "still looking" : "and counting";
  const label = genre ? nameOf(genre) ?? tab : tab;
  return (
    <div aria-hidden="true" className={styles.divider} style={{ "--divider": lineOf(genre ?? top) }}
      data-crate-divider data-crate-ignore data-leaving={leaving} data-tab={label} data-head={head} data-count={line}>
      <span className={styles.dividerTab}>
        <span className={styles.dymo}>{label}</span>
      </span>
      <span className={styles.dividerCard} data-divider-art>
        <span className={styles.dividerStamp}>Grooves<br />Home shelf</span>
        <span className={styles.dividerDot} data-divider-dot />
        <span className={styles.dividerHand}>
          <span className={styles.dividerName}>{head}</span>
          <span className={styles.dividerCount}>{line}</span>
          {latest && <span className={`${styles.dividerCount} ${styles.dividerLatest}`}>+ {latest.title}</span>}
        </span>
      </span>
    </div>
  );
}
