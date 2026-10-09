"use client";
import { SLEEVE_DEPTH, sleeveColors } from "./sleeveDepth";

import { useEffect, useRef, useState } from "react";
import { useIntro } from "@/components/intro/intro-context";
import YouTubeAlbumPlayer from "./YouTubeAlbumPlayer";
import Link from "next/link";
import { getAlbumTheme } from "@/lib/album-theme";
import PageShell from "@/components/layout/PageShell";
import dynamic from "next/dynamic";

const AlbumVinyl = dynamic(() => import("./AlbumVinyl"), { ssr: false });

// Presentational only: complete URLs and camelCase props come from the page.
export default function AlbumDetailView({ album }) {
  const art = useRef(null);
  const { done } = useIntro();
  const [discReady, setDiscReady] = useState(false);
  useEffect(() => {
    setDiscReady(false);
    if (!done) return;
    let frame = 0;
    let settleFrame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      if (document.documentElement.dataset.crateTransition === "true" || document.documentElement.dataset.albumTransition === "true") return;
      frame = requestAnimationFrame(() => {
        settleFrame = requestAnimationFrame(() => setDiscReady(true));
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-crate-transition", "data-album-transition"] });
    check();
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame); observer.disconnect(); };
  }, [done, album.slug]);
  function tilt(event) {
    if (event.pointerType === "touch" || !discReady || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    art.current?.style.setProperty("--cover-rx", `${-y * 7}deg`);
    art.current?.style.setProperty("--cover-ry", `${x * 7}deg`);
  }
  function resetTilt() {
    art.current?.style.setProperty("--cover-rx", "0deg");
    art.current?.style.setProperty("--cover-ry", "0deg");
  }
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedSide, setSelectedSide] = useState(null);
  const sides = [...new Set((album.tracks || []).map(track => `${track.discNo}:${track.side}`))];
  const activeSide = sides.includes(selectedSide) ? selectedSide : sides[0];
  const visibleTracks = (album.tracks || []).filter(track => `${track.discNo}:${track.side}` === activeSide);
  const theme = getAlbumTheme(album.coverColor);
  const color = theme.background;
  const ink = theme.foreground;
  const sleeve = sleeveColors(album.coverColor);
  useEffect(() => {
    const layer = art.current?.closest(".ct-page");
    layer?.style.setProperty("--ct-header-bg", color);
    layer?.style.setProperty("--ct-header-fg", ink);
    return () => {
      layer?.style.removeProperty("--ct-header-bg");
      layer?.style.removeProperty("--ct-header-fg");
    };
  }, [ink, color]);
  return (
    <PageShell className="album-detail-page">
      <div className="album-detail-surface" style={{ backgroundColor: color, color: ink, "--album-muted": theme.muted }}> 
        <div className="mx-auto w-full max-w-[1200px]">
        <Link href="/digging" className="mb-8 inline-block text-sm underline-offset-4 hover:underline">← Digging</Link>
        <div className="album-listening-stage">
          <div data-album-cover={album.slug} className="album-listening-cover relative aspect-square" onPointerMove={tilt} onPointerLeave={resetTilt} onPointerCancel={resetTilt}>
            <div ref={art} className="album-cover-tilt absolute inset-0 shadow-2xl" style={{ backgroundColor: color }}>
            {/* 슬리브 두께 (Digging·이동 전환과 같은 비율·색) */}
            <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-0 w-full origin-bottom-left -skew-x-45" style={{ height: SLEEVE_DEPTH, backgroundColor: sleeve.top }} />
            <span aria-hidden="true" className="pointer-events-none absolute left-full top-0 h-full origin-top-left -skew-y-45" style={{ width: SLEEVE_DEPTH, backgroundColor: sleeve.side }} />
            <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center border border-current/20 text-sm">커버 이미지가 없습니다</div>
            {album.thumbUrl && <img src={album.thumbUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />}
            {album.coverUrl && !failed && <img src={album.coverUrl} alt={`${album.title} 앨범 커버`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: loaded ? 1 : 0 }} />}
            </div>
            </div>
          </div>
          <div className="album-record-slide" data-ready={discReady} aria-hidden="true"
            style={{ transform: discReady ? "translateX(0)" : "translateX(-85.185185%)" }}>
          {/* Home과 같은 잉크 3D 판. 재생하면 앨범 RPM으로 돎 */}
          <div className="absolute inset-0" data-playing={playing}>
            <AlbumVinyl ink={ink} label={album.coverColor || color}
              rpm={[33, 45, 78].includes(album.rpm) ? album.rpm : 33.333} playing={playing} />
          </div>
          </div>
        </div>
        <div className="album-detail-columns mt-12 grid items-start gap-12 border-t border-current/25 pt-8 md:grid-cols-[1.15fr_1fr] md:gap-16">
          <div className="flex min-w-0 flex-col gap-8">
            <section aria-label="앨범 정보" className="flex flex-col gap-4">
              <p className="text-xs uppercase tracking-[.2em]">{[album.format, album.releaseYear].filter(Boolean).join(" · ")}</p>
            <h1 data-album-heading tabIndex={-1} className="album-detail-title break-words text-4xl leading-tight outline-none md:text-6xl">{album.title}</h1>
            <p className="font-serif text-2xl">{album.artistNames || "아티스트 정보가 없습니다"}</p>
            {album.label && <p className="text-sm text-[var(--album-muted)]">Label — {album.label}</p>}
            {album.description && <p className="max-w-xl whitespace-pre-line text-sm leading-7 text-[var(--album-muted)]">{album.description}</p>}
            </section>
            <section aria-label="앨범 수록곡">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-current/25 pb-4">
                <h2 className="text-xs uppercase tracking-[.18em]">Tracklist</h2>
                <div className="flex flex-wrap gap-2" aria-label="LP 면 선택">
                  {sides.map(side => <button key={side} type="button" aria-pressed={side === activeSide}
                    onClick={() => setSelectedSide(side)}
                    className="rounded-full border border-current/30 px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
                    style={side === activeSide ? { backgroundColor: ink, color } : undefined}>
                    {new Set((album.tracks || []).map(track => track.discNo)).size > 1 ? `LP ${side.split(":")[0]} · ` : ""}SIDE {side.split(":")[1]}
                  </button>)}
                </div>
              </div>
              {album.tracks?.length ? <ol className="divide-y divide-current/15">
                {visibleTracks.map(track => <li key={`${track.discNo}-${track.side}-${track.position}`} className="flex items-baseline gap-4 py-3 text-sm">
                  <span className="w-8 shrink-0 text-[var(--album-muted)]">{track.side}{track.position}</span>
                  <span className="min-w-0 flex-1 break-words">{track.title}</span>
                  <span className="shrink-0 tabular-nums text-[var(--album-muted)]">{track.durationSec == null ? "—" : `${Math.floor(track.durationSec / 60)}:${String(track.durationSec % 60).padStart(2, "0")}`}</span>
                </li>)}
              </ol> : <p className="text-sm text-[var(--album-muted)]">{album.tracksUnavailable ? "수록곡을 불러오지 못했어요." : "등록된 수록곡이 없습니다."}</p>}
            </section>
          </div>
          <div className="min-w-0">
            <YouTubeAlbumPlayer key={album.slug} playlistId={album.youtubePlaylistId} previewUrl={album.thumbUrl || album.coverUrl} albumTitle={album.title} onPlayingChange={setPlaying} />
          </div>
        </div>
        </div>
      </div>
    </PageShell>
  );
}
