"use client";
// 앨범 카드 그리드 — Digging·Collection 공용
// 마우스를 올린 카드만 또렷하고 나머지는 약간 옅어짐 (Digging.module.css .card). 판(album)은 { id, slug, title, artist_names, thumb_path, cover_color }
// (2026-11-20 마우스를 올린 앨범 색으로 배경을 바꾸는 효과를 해 보고 뺌 — 사용자: 배경은 원래 색이 나음)
import AlbumCard from "./AlbumCard";
import styles from "@/components/digging/Digging.module.css";

// lead: 카드 앞에 놓이는 칸 (Digging 의 장르 칸막이) · children: 카드 뒤에 붙는 것 (더 불러오는 동안의 빈 재킷 자리)
export default function AlbumGrid({ albums, className = "", lead = null, children, ...rest }) {
  return (
    <div {...rest} data-scroll-tilt="" className={`${styles.grid} ${className}`}>
      {lead}
      {albums.map(album => <AlbumCard key={album.id} album={album} />)}
      {children}
    </div>
  );
}
