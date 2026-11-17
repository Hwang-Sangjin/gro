"use client";
// 앨범 카드 그리드 — Digging·Collection 공용
// 마우스를 올린 카드만 또렷하고 나머지는 약간 옅어짐 (Digging.module.css .card). 판(album)은 { id, slug, title, artist_names, thumb_path, cover_color }
import AlbumCard from "./AlbumCard";
import styles from "@/components/digging/Digging.module.css";

// children: 카드 뒤에 붙는 것 (더 불러오는 동안의 빈 재킷 자리)
export default function AlbumGrid({ albums, className = "", children, ...rest }) {
  return (
    <div {...rest} data-scroll-tilt="" className={`${styles.grid} ${className}`}>
      {albums.map(album => <AlbumCard key={album.id} album={album} />)}
      {children}
    </div>
  );
}
