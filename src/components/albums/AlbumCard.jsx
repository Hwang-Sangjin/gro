"use client";
// 앨범 카드 한 장 — Digging·Collection 공용
// 누르면 커버가 앨범 상세로 날아가는 전환(AlbumTransitionProvider), 스크롤로 보이면 가운데 줄에서 펼쳐지며 등장

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import useReveal from "@/components/digging/useReveal";
import styles from "@/components/digging/Digging.module.css";
import { sleeveColors } from "@/components/album/sleeveDepth";
import { coverUrl } from "@/lib/albums";
import { isPeeled, subscribePeeled } from "./peeled";

const NEW_DAYS = 45;   // 들어온 지 이 날수 안이면 NEW IN

export default function AlbumCard({ album }) {
  // 스티커는 새로 들어온 판에만 (모든 카드에 붙으면 눈에 안 띔)
  const isNew = album.created_at && Date.now() - new Date(album.created_at).getTime() < NEW_DAYS * 864e5;
  // Crate 에서 스티커를 떼어 냈으면 여기서도 안 보임 (peeled.js)
  const peeled = useSyncExternalStore(subscribePeeled, () => isPeeled(album.slug), () => false);
  const sticker = isNew && !peeled ? { kind: "new", label: "New in" } : null;
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
  return (
    <Link prefetch={intent ? true : null} onPointerEnter={() => setIntent(true)} onFocus={() => setIntent(true)} data-crate-skip data-album-card data-album-title={album.title} data-album-artist={album.artist_names} data-album-slug={album.slug} data-album-color={album.cover_color || "#bbcbda"} data-album-image={failed ? undefined : src} onClick={open}
      // 두께 면 색 = 앨범 대표색보다 조금 진하게 (위 면은 덜, 오른쪽 면은 더 — 빛이 왼쪽 위에서 오는 느낌)
      style={{ "--sleeve-top": sleeveColors(album.cover_color).top, "--sleeve-side": sleeveColors(album.cover_color).side }}
      data-revealed={revealed} data-album-new={isNew ? "true" : undefined}
      className={`${styles.card} group relative [--sleeve-depth:1.3%] hover:z-10 hover:scale-[1.04] focus-visible:z-10 focus-visible:scale-[1.04] motion-reduce:transition-none`} href={`/album/${album.slug}`} aria-label={`${album.title} — ${album.artist_names}`}>
      <span ref={revealRef} className={styles.hitArea} data-revealed={revealed}>
        <span ref={art} data-album-source data-cover-slug={album.slug} data-cover-color={album.cover_color || "#bbcbda"} data-cover-image={failed ? undefined : src || undefined} className={styles.art}>
          {/* 호버하면 슬리브에 두께가 생김: 위·오른쪽 면이 비스듬히 솟아 종이 재킷 상자처럼 보임 */}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-0 h-0 w-full origin-bottom-left -skew-x-45 bg-[var(--sleeve-top)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:h-[var(--sleeve-depth)] group-focus-visible:h-[var(--sleeve-depth)] motion-reduce:transition-none" />
          <span aria-hidden="true" className="pointer-events-none absolute left-full top-0 h-full w-0 origin-top-left -skew-y-45 bg-[var(--sleeve-side)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-[var(--sleeve-depth)] group-focus-visible:w-[var(--sleeve-depth)] motion-reduce:transition-none" />
          <span className={styles.revealPanel} data-image-ready={loaded || failed || !src} style={{ backgroundColor: album.cover_color || "#bbcbda" }}>
          {src && !failed ? <img ref={imageRef} src={src} alt="" loading="lazy" decoding="async" /> : <span className={styles.placeholder} aria-hidden="true">G</span>}
          {/* 스티커: 새로 들어온 판 = NEW IN */}
          {/* 가장자리가 살짝 들려 있다가, 카드에 마우스를 올리면 떼어지듯 말려 올라감 (뒷면이 보임). 틀(stickerPeel)을 돌려 둔 방향이 떼어지는 방향 */}
          {sticker && (
            <span aria-hidden="true" className={styles.sticker} data-kind={sticker.kind}>
              <span className={styles.stickerPeel}>
                <span className={styles.stickerFace}><span>{sticker.label}</span></span>
                <span className={styles.stickerFlap} />
              </span>
            </span>
          )}
          </span>
        </span>
      </span>
      {/* 제목·아티스트: 커버가 거의 펼쳐질 즈음 아래에서 스르륵 올라옴 (줄마다 잘라 주는 틀 안에서) */}
      <span className={styles.caption}>
        <span className="-mt-[0.18em] block overflow-y-clip pb-[0.1em] pt-[0.18em]"><strong className="block translate-y-[110%] transition-[translate] delay-[420ms] duration-(--dur-enter) ease-groove group-data-[revealed=true]:translate-y-0 group-focus-visible:translate-y-0 motion-reduce:translate-y-0 motion-reduce:transition-none">{album.title}</strong></span>
        <span className="block overflow-y-clip"><span className="block translate-y-[110%] transition-[translate] delay-[510ms] duration-(--dur-enter) ease-groove group-data-[revealed=true]:translate-y-0 group-focus-visible:translate-y-0 motion-reduce:translate-y-0 motion-reduce:transition-none">{album.artist_names}{album.release_year ? <span className="tabular-nums opacity-70"> · {album.release_year}</span> : null}</span></span>
      </span>
    </Link>
  );
}
