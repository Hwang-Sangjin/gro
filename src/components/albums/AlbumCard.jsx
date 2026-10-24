"use client";
// 앨범 카드 한 장 — Digging·Collection 공용
// 누르면 커버가 앨범 상세로 날아가는 전환(AlbumTransitionProvider), 스크롤로 보이면 가운데 줄에서 펼쳐지며 등장

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";
import { sleeveColors } from "@/components/album/sleeveDepth";
import { coverUrl } from "@/lib/albums";

export default function AlbumCard({ album }) {
  const transition = useAlbumTransition();
  function open(event) {
    if (!transition || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    transition.openAlbum({ slug: album.slug, color: album.cover_color,
      imageUrl: failed ? null : src, source: art.current });
  }
  const [failed, setFailed] = useState(false);
  const src = coverUrl(album.thumb_path);
  const art = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const imageRef = useRef(null);
  // A server-rendered cached image may finish before React attaches onLoad.
  useEffect(() => {
    const image = imageRef.current;
    if (!image || !src) return;
    let cancelled = false;
    const complete = () => {
      if (cancelled) return;
      if (image.naturalWidth > 0) setLoaded(true);
      else setFailed(true);
    };
    const error = () => { if (!cancelled) setFailed(true); };
    image.addEventListener("load", complete);
    image.addEventListener("error", error);
    if (image.complete) complete();
    return () => {
      cancelled = true;
      image.removeEventListener("load", complete);
      image.removeEventListener("error", error);
    };
  }, [src]);
  // Expand the color panel even while the network is still loading the image.
  // 같이 보이기 시작한 카드끼리 화면 순서대로 (useReveal stagger)
  const [revealRef, revealed] = useReveal({ stagger: true });
  // 마우스를 올리면 상세 페이지를 통째로 미리 받아 둠 → 누른 뒤 커버가 바로 날아감 (뷰포트 기본 prefetch 는 부분만)
  const [intent, setIntent] = useState(false);
  function move(event) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    art.current?.style.setProperty("--rx", `${-y * 7}deg`);
    art.current?.style.setProperty("--ry", `${x * 7}deg`);
  }
  function reset() {
    art.current?.style.setProperty("--rx", "0deg");
    art.current?.style.setProperty("--ry", "0deg");
  }
  return (
    <Link prefetch={intent ? true : null} onPointerEnter={() => setIntent(true)} onFocus={() => setIntent(true)} data-crate-skip data-album-card data-album-title={album.title} data-album-artist={album.artist_names} data-album-slug={album.slug} data-album-color={album.cover_color || "#bbcbda"} data-album-image={failed ? undefined : src} onClick={open}
      // 두께 면 색 = 앨범 대표색보다 조금 진하게 (위 면은 덜, 오른쪽 면은 더 — 빛이 왼쪽 위에서 오는 느낌)
      style={{ "--sleeve-top": sleeveColors(album.cover_color).top, "--sleeve-side": sleeveColors(album.cover_color).side }}
      data-revealed={revealed}
      className={`${styles.card} group relative [--sleeve-depth:1.3%] [transition:opacity_500ms_ease-in-out_100ms,scale_500ms_cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:scale-[1.04] focus-visible:z-10 focus-visible:scale-[1.04] motion-reduce:transition-none`} href={`/album/${album.slug}`} aria-label={`${album.title} — ${album.artist_names}`}>
      <span ref={revealRef} className={styles.hitArea} data-revealed={revealed} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
        <span ref={art} data-album-source className={styles.art}>
          {/* 호버하면 슬리브에 두께가 생김: 위·오른쪽 면이 비스듬히 솟아 종이 재킷 상자처럼 보임 */}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-0 h-0 w-full origin-bottom-left -skew-x-45 bg-[var(--sleeve-top)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:h-[var(--sleeve-depth)] group-focus-visible:h-[var(--sleeve-depth)] motion-reduce:transition-none" />
          <span aria-hidden="true" className="pointer-events-none absolute left-full top-0 h-full w-0 origin-top-left -skew-y-45 bg-[var(--sleeve-side)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-[var(--sleeve-depth)] group-focus-visible:w-[var(--sleeve-depth)] motion-reduce:transition-none" />
          <span className={styles.revealPanel} data-image-ready={loaded || failed || !src} style={{ backgroundColor: album.cover_color || "#bbcbda" }}>
          {src && !failed ? <img ref={imageRef} src={src} alt="" loading="lazy" decoding="async" /> : <span className={styles.placeholder} aria-hidden="true">G</span>}
          </span>
        </span>
      </span>
      {/* 제목·아티스트: 커버가 거의 펼쳐질 즈음 아래에서 스르륵 올라옴 (줄마다 잘라 주는 틀 안에서) */}
      <span className={styles.caption}>
        <span className="block overflow-y-clip pb-[0.1em]"><strong className="block translate-y-[110%] transition-[translate] delay-[420ms] duration-700 ease-groove group-data-[revealed=true]:translate-y-0 group-focus-visible:translate-y-0 motion-reduce:translate-y-0 motion-reduce:transition-none">{album.title}</strong></span>
        <span className="block overflow-y-clip"><span className="block translate-y-[110%] transition-[translate] delay-[510ms] duration-700 ease-groove group-data-[revealed=true]:translate-y-0 group-focus-visible:translate-y-0 motion-reduce:translate-y-0 motion-reduce:transition-none">{album.artist_names}</span></span>
      </span>
    </Link>
  );
}
