"use client";
// 앨범 카드 그리드 — Digging·Collection 공용
// 마우스를 올린 카드만 또렷하고 나머지는 흐려짐. 판(album)은 { id, slug, title, artist_names, thumb_path, cover_color }
import AlbumCard from "./AlbumCard";
import styles from "@/components/digging/Digging.module.css";

export default function AlbumGrid({ albums, className = "", ...rest }) {
  return (
    <div {...rest} className={`${styles.grid} [@media(hover:hover)_and_(pointer:fine)]:[&:has(>a:hover)>a:not(:hover)]:opacity-35 ${className}`}>
      {albums.map(album => <AlbumCard key={album.id} album={album} />)}
    </div>
  );
}
