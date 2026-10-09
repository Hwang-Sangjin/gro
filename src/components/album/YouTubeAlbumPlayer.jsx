"use client";
import { useEffect, useRef, useState } from "react";
import { loadYouTubeAPI } from "@/lib/youtube-player";

export default function YouTubeAlbumPlayer({ playlistId, previewUrl, albumTitle, onPlayingChange }) {
  const host = useRef(null);
  const player = useRef(null);
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("idle");
  const valid = typeof playlistId === "string" && /^[\w-]+$/.test(playlistId);

  useEffect(() => {
    if (!requested || !valid) return;
    let disposed = false;
    let instance;
    let readyTimeout;
    setStatus("loading");
    onPlayingChange(false);
    const fail = () => {
      if (disposed) return;
      clearTimeout(readyTimeout);
      setStatus("error");
      onPlayingChange(false);
    };
    loadYouTubeAPI().then(YT => {
      if (disposed || !host.current) return;
      const mount = document.createElement("div");
      host.current.replaceChildren(mount);
      instance = new YT.Player(mount, {
        width: "100%", height: "100%",
        playerVars: { listType: "playlist", list: playlistId, controls: 1,
          playsinline: 1, origin: window.location.origin },
        events: {
          onReady(event) {
            if (disposed) return;
            clearTimeout(readyTimeout);
            player.current = event.target;
            event.target.getIframe().title = "앨범 YouTube 플레이어";
            setStatus("ready");
            event.target.playVideo();
          },
          onStateChange(event) {
            if (disposed) return;
            const playing = event.data === 1;
            onPlayingChange(playing);
            setStatus(playing ? "playing" : event.data === 3 ? "buffering" : "ready");
          },
          onError: fail,
          onAutoplayBlocked() {
            if (disposed) return;
            setStatus("blocked");
            onPlayingChange(false);
          },
        },
      });
      readyTimeout = setTimeout(fail, 15000);
    }).catch(fail);
    return () => {
      disposed = true;
      clearTimeout(readyTimeout);
      instance?.destroy();
      player.current = null;
      onPlayingChange(false);
    };
  }, [requested, valid, playlistId, attempt, onPlayingChange]);

  if (!valid) return <section aria-label="앨범 듣기" className="flex flex-col gap-4">
    <h2 className="border-b border-current/25 pb-5 text-[11px] font-medium uppercase tracking-[.24em]">Listen</h2>
    <p className="text-[15px] text-[var(--album-muted)]">등록된 YouTube 재생목록이 없습니다.</p>
  </section>;
  function toggle() {
    if (!requested) { setRequested(true); return; }
    if (status === "error") { setAttempt(value => value + 1); return; }
    if (status === "playing") player.current?.pauseVideo();
    else player.current?.playVideo();
  }
  // 평소엔 문구 없음. 사용자가 알아야 할 때만 한 줄
  const notice = status === "error" ? "영상을 불러올 수 없어요. 다시 시도하거나 YouTube에서 열어주세요."
    : status === "blocked" ? "플레이어의 재생 버튼을 눌러주세요."
    : status === "buffering" ? "버퍼링 중…" : "";
  const label = status === "loading" ? "Connecting…" : status === "playing" ? "Pause" : status === "error" ? "Retry" : "Play";
  return <section aria-label="앨범 듣기" className="flex flex-col gap-6">
    <div className="flex items-end justify-between gap-4 border-b border-current/25 pb-5">
      <h2 className="text-[11px] font-medium uppercase tracking-[.24em]">Listen</h2>
      <a href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`} target="_blank" rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[.24em] text-[var(--album-muted)] transition-colors hover:text-current">
        YouTube
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-2.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" /></svg>
        <span className="sr-only">에서 열기 (새 창)</span>
      </a>
    </div>
    {requested ? <div ref={host} className="album-youtube-frame" /> :
      <button type="button" onClick={toggle} aria-label={`${albumTitle || "앨범"} 재생`}
        className="group relative flex aspect-video w-full items-center justify-center overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-4">
        {previewUrl && <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] transition-transform duration-700 group-hover:scale-110" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />}
        <span className="absolute inset-0 bg-black/40 transition-colors duration-500 group-hover:bg-black/30" />
        <span className="relative flex items-center gap-3 rounded-full border border-[#f4e7cd]/80 bg-[#f4e7cd]/10 py-3 pl-4 pr-6 text-[13px] font-medium uppercase tracking-[.2em] text-[#f4e7cd] backdrop-blur-sm transition-[background-color,scale] duration-300 group-hover:scale-105 group-hover:bg-[#f4e7cd]/20" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor"><path d="M4 2.5v11l9-5.5z" /></svg>
          Play album
        </span>
      </button>}
    {requested && <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={toggle} disabled={status === "loading"}
        className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-current/40 px-5 text-[13px] font-medium uppercase tracking-[.2em] transition-colors hover:border-current hover:bg-current/10 disabled:opacity-50">
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">{status === "playing" ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M4 2.5v11l9-5.5z" />}</svg>
        {label}
      </button>
      <p role="status" className="text-[13px] text-[var(--album-muted)]">{notice}</p>
    </div>}
  </section>;
}
