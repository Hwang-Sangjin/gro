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
const DISC_SWAP_MS = 650; // LP 교체: 판이 슬리브로 들어가는 시간
const AlbumGrainient = dynamic(() => import("./AlbumGrainient"), { ssr: false });

// ── 등장 애니메이션 (커버 이동 전환이 끝난 뒤 show) ──
const EASE = "ease-[cubic-bezier(.22,1,.36,1)]";
// 글자가 마스크 아래에서 올라옴 (Home 제목과 같은 방식)
function Rise({ show, delay = 0, className = "", children }) {
  return (
    <span className={`block overflow-y-clip pb-[.1em] ${className}`}>
      <span data-show={show} style={{ transitionDelay: show ? `${delay}ms` : "0ms" }}
        className={`block transition-transform duration-[1100ms] ${EASE} data-[show=false]:translate-y-[110%] motion-reduce:transition-none motion-reduce:data-[show=false]:translate-y-0`}>
        {children}
      </span>
    </span>
  );
}
// 살짝 떠오르며 나타남
function Fade({ show, delay = 0, className = "", children }) {
  return (
    <div data-show={show} style={{ transitionDelay: show ? `${delay}ms` : "0ms" }}
      className={`transition-[opacity,translate] duration-[900ms] ${EASE} data-[show=false]:translate-y-4 data-[show=false]:opacity-0 motion-reduce:transition-none motion-reduce:data-[show=false]:translate-y-0 ${className}`}>
      {children}
    </div>
  );
}
const duration = sec => sec == null ? "—" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

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
  const [sidePicked, setSidePicked] = useState(false); // 첫 등장 이후 사이드를 바꿨는지 (트랙 행 지연 계산용)
  const sides = [...new Set((album.tracks || []).map(track => `${track.discNo}:${track.side}`))];
  const activeSide = sides.includes(selectedSide) ? selectedSide : sides[0];
  const visibleTracks = (album.tracks || []).filter(track => `${track.discNo}:${track.side}` === activeSide);
  // 사이드 → 판 상태. 같은 LP 안에서 몇 번째 면인지로 앞(0)/뒤(1)
  const activeDisc = activeSide?.split(":")[0] ?? null;
  const activeFace = activeSide ? Math.max(0, sides.filter(side => side.split(":")[0] === activeDisc).indexOf(activeSide)) % 2 : 0;
  // 화면의 판: 같은 LP면 바로 face만 바꿔 뒤집고, 다른 LP면 슬리브에 넣었다가(swapping) 가려진 순간 바꿔 다시 꺼냄
  const [shownDisc, setShownDisc] = useState({ disc: activeDisc, face: activeFace, snap: true });
  const [swapping, setSwapping] = useState(false);
  useEffect(() => {
    if (shownDisc.disc === activeDisc) {
      setSwapping(false);
      if (shownDisc.face !== activeFace) setShownDisc({ disc: activeDisc, face: activeFace, snap: false });
      return;
    }
    setSwapping(true);
    const swap = setTimeout(() => setShownDisc({ disc: activeDisc, face: activeFace, snap: true }), DISC_SWAP_MS);
    return () => clearTimeout(swap);
  }, [activeDisc, activeFace, shownDisc.disc, shownDisc.face]);
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
    <PageShell className="album-detail-page paper-textured">
      {/* 배경: 커버 색 위에 커버·판 뒤 은은한 빛 + 아래로 갈수록 살짝 어두워짐. 맨 위는 헤더와 같은 단색이라 이음새가 없음 */}
      <div className="album-detail-surface relative isolate" style={{
        backgroundColor: color, color: ink, "--album-muted": theme.muted,
        backgroundImage: `radial-gradient(ellipse min(62vw, 900px) 480px at 50% 470px, color-mix(in oklab, ${color} 84%, #fff) 0%, color-mix(in oklab, ${color} 94%, #fff) 38%, transparent 72%), linear-gradient(to bottom, ${color} 0, ${color} 360px, color-mix(in oklab, ${color} 84%, #000) 100%)`,
      }}>
        {/* 움직이는 그레인 그라디언트 (커버 색 3톤). 커버 이동 전환이 끝난 뒤 켜짐.
            화면 크기 캔버스가 페이지 안에서 sticky로 따라다니고, 헤더 아래에서 서서히 나타남 */}
        {discReady && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
            <AlbumGrainient color={color} ink={ink} image={album.thumbUrl || album.coverUrl} className="sticky top-0 h-svh w-full [mask-image:linear-gradient(to_bottom,transparent_0,transparent_90px,#000_300px)]" />
          </div>
        )}
        {/* 종이 질감 (Home·Digging·헤더와 같은 이미지·세기) */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-(image:--paper-texture-image) bg-[length:var(--paper-texture-size)_var(--paper-texture-size)] bg-repeat opacity-(--paper-texture-opacity) mix-blend-soft-light" />
        <div className="mx-auto w-full max-w-[1200px]">
        <Fade show={discReady} className="mb-10">
          <Link href="/digging" className="group inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[.24em] focus-visible:outline-2 focus-visible:outline-offset-4">
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-current/35 transition-[translate,background-color] duration-300 group-hover:-translate-x-1 group-hover:bg-current/10">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
            </span>
            <span className="relative py-1">
              Back to Digging
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-right scale-x-0 bg-current transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
            </span>
          </Link>
        </Fade>
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
            style={{
              transform: discReady && !swapping ? "translateX(0)" : "translateX(-85.185185%)",
              // LP 교체 때 들어가는 동작은 짧게, 나오는 동작은 원래 속도(1.15s)로
              transitionDuration: swapping ? `${DISC_SWAP_MS}ms` : undefined,
            }}>
          {/* Home과 같은 잉크 3D 판. 재생하면 앨범 RPM으로 돎 */}
          <div className="absolute inset-0" data-playing={playing}>
            <AlbumVinyl ink={ink} label={album.coverColor || color}
              rpm={[33, 45, 78].includes(album.rpm) ? album.rpm : 33.333} playing={playing}
              face={shownDisc.face} snap={shownDisc.snap} />
          </div>
          </div>
        </div>
        <div className="album-detail-columns mt-14 md:mt-20">
          {/* 구분선이 왼쪽에서 그어짐 */}
          <span aria-hidden="true" data-show={discReady}
            className={`block h-px origin-left bg-current/25 transition-transform duration-[1200ms] ${EASE} data-[show=false]:scale-x-0 motion-reduce:transition-none`} />
          <div className="grid items-start gap-16 pt-10 md:grid-cols-[1.2fr_1fr] md:gap-20 md:pt-12">
          <div className="flex min-w-0 flex-col gap-16">
            <section aria-label="앨범 정보">
              <Fade show={discReady} delay={150}>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[.24em] text-[var(--album-muted)]">
                  {[album.format, album.releaseYear, album.label].filter(Boolean).map((item, i) => (
                    <span key={i} className="flex items-center gap-3">{i > 0 && <span aria-hidden="true" className="h-px w-4 bg-current/50" />}{item}</span>
                  ))}
                </p>
              </Fade>
              <h1 data-album-heading tabIndex={-1} className="album-detail-title mt-5 break-words text-[clamp(44px,6.4vw,96px)] leading-[.92] outline-none">
                <Rise show={discReady} delay={220}>{album.title}</Rise>
              </h1>
              <p className="mt-4 text-[clamp(20px,2vw,28px)] font-medium tracking-[-.015em]">
                <Rise show={discReady} delay={340}>{album.artistNames || "아티스트 정보가 없습니다"}</Rise>
              </p>
              {album.description && <Fade show={discReady} delay={460}>
                <p className="mt-6 max-w-xl whitespace-pre-line text-[15px] leading-7 text-[var(--album-muted)]">{album.description}</p>
              </Fade>}
            </section>
            <Fade show={discReady} delay={520}>
            <section aria-label="앨범 수록곡">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-current/25 pb-5">
                <div className="flex items-baseline gap-4">
                  <h2 className="text-[11px] font-medium uppercase tracking-[.24em]">Tracklist</h2>
                  {visibleTracks.length > 0 && <span className="text-[11px] uppercase tracking-[.18em] tabular-nums text-[var(--album-muted)]">
                    {visibleTracks.length} tracks · {duration(visibleTracks.reduce((sum, track) => sum + (track.durationSec || 0), 0))}
                  </span>}
                </div>
                {sides.length > 1 && <div className="flex flex-wrap gap-2" aria-label="LP 면 선택">
                  {sides.map(side => {
                    const [disc, face] = side.split(":");
                    const multi = new Set((album.tracks || []).map(track => track.discNo)).size > 1;
                    return <button key={side} type="button" aria-pressed={side === activeSide}
                      onClick={() => { setSelectedSide(side); setSidePicked(true); }}
                      className="min-h-10 rounded-full border border-current/30 px-4 text-[13px] tracking-[.04em] transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-4"
                      style={side === activeSide ? { backgroundColor: ink, color, borderColor: ink } : undefined}>
                      {multi && <span className="mr-1.5 opacity-60">LP{disc}</span>}Side {face}
                    </button>;
                  })}
                </div>}
              </div>
              {album.tracks?.length ? <ol key={activeSide}>
                {visibleTracks.map((track, i) => <li key={`${track.discNo}-${track.side}-${track.position}`}
                  className={`group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 border-b border-current/15 py-5 ${discReady ? "animate-track-in motion-reduce:animate-none" : "opacity-0"}`}
                  style={{ animationDelay: `${(sidePicked ? 0 : 700) + i * 70}ms` }}>
                  <span className="text-[13px] tabular-nums text-[var(--album-muted)] transition-colors group-hover:text-current">{track.side}{track.position}</span>
                  <span className="min-w-0 break-words text-[clamp(17px,1.45vw,21px)] leading-snug tracking-[-.01em] transition-transform duration-300 group-hover:translate-x-1">{track.title}</span>
                  <span className="text-[13px] tabular-nums text-[var(--album-muted)]">{duration(track.durationSec)}</span>
                </li>)}
              </ol> : <p className="pt-5 text-[15px] text-[var(--album-muted)]">{album.tracksUnavailable ? "수록곡을 불러오지 못했어요." : "등록된 수록곡이 없습니다."}</p>}
            </section>
            </Fade>
          </div>
          <Fade show={discReady} delay={620} className="min-w-0">
            <YouTubeAlbumPlayer key={album.slug} playlistId={album.youtubePlaylistId} previewUrl={album.thumbUrl || album.coverUrl} albumTitle={album.title} onPlayingChange={setPlaying} />
          </Fade>
          </div>
        </div>
        </div>
      </div>
    </PageShell>
  );
}
