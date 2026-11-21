"use client";
// 앨범 카드 그리드 — Digging·Collection 공용
// 마우스를 올린 카드만 또렷하고 나머지는 약간 옅어짐 (Digging.module.css .card). 판(album)은 { id, slug, title, artist_names, thumb_path, cover_color }
// (2026-11-20 마우스를 올린 앨범 색으로 배경을 바꾸는 효과를 해 보고 뺌 — 사용자: 배경은 원래 색이 나음)
import AlbumCard from "./AlbumCard";
import styles from "@/components/digging/Digging.module.css";

// lead: 카드 앞에 놓이는 칸 (Digging 의 장르 칸막이) · children: 카드 뒤에 붙는 것 (더 불러오는 동안의 빈 재킷 자리)
// (2026-11-22 새로 들어온 판을 두 칸짜리로 크게 두어 봤다가 뺌 — 사용자: 별로. 넓은 화면에서 한 장이 화면을 다 차지했음. 새 판은 Digging 의 "New in" 탭으로 따로 봄)
export default function AlbumGrid({ albums, className = "", lead = null, children, ...rest }) {
  return (
    <div {...rest} data-scroll-tilt="" className={`${styles.grid} ${className}`}>
      {lead}
      {albums.map(album => <AlbumCard key={album.id} album={album} />)}
      {children}
    </div>
  );
}
