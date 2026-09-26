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

  if (!valid) return <p className="text-sm text-[var(--album-muted)]">등록된 YouTube 재생목록이 없습니다.</p>;
  function toggle() {
    if (!requested) { setRequested(true); return; }
    if (status === "error") { setAttempt(value => value + 1); return; }
    if (status === "playing") player.current?.pauseVideo();
    else player.current?.playVideo();
  }
  return <section aria-label="앨범 듣기" className="flex flex-col gap-4">
    <h2 className="text-xs uppercase tracking-[.18em]">Listen to the album</h2>
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" onClick={toggle} disabled={status === "loading"}
        className="rounded-full border border-current px-6 py-3 text-sm disabled:opacity-50">
        {status === "loading" ? "연결 중…" : status === "playing" ? "Ⅱ 일시정지" : status === "error" ? "다시 연결" : "▶ 앨범 듣기"}
      </button>
      <a href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">YouTube에서 열기 ↗</a>
    </div>
    <p role="status" className="text-xs text-[var(--album-muted)]">
      {status === "error" ? "영상을 불러올 수 없어요. 다시 연결하거나 YouTube에서 열어주세요." : status === "blocked" ? "아래 YouTube 플레이어의 재생 버튼을 눌러주세요." : status === "playing" ? "재생 중 · 바이닐이 회전합니다" : status === "buffering" ? "버퍼링 중…" : "페이지 안에서 재생하면 바이닐이 함께 돌아갑니다."}
    </p>
    {requested ? <div ref={host} className="album-youtube-frame" /> :
      <button type="button" onClick={toggle} aria-label={`${albumTitle || "앨범"} YouTube 재생`}
        className="group relative flex aspect-video w-full items-center justify-center overflow-hidden border border-current/25 focus-visible:outline-2 focus-visible:outline-offset-4">
        {previewUrl && <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />}
        <span className="absolute inset-0 bg-black/35" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#f4e7cd] bg-[#4c404a] text-xl text-[#f4e7cd] transition-transform group-hover:scale-110" aria-hidden="true">▶</span>
      </button>}
    <p className="text-xs leading-relaxed text-[var(--album-muted)]">YouTube playlist · 재생 시 바이닐이 회전하며, 일시정지하면 멈춥니다.</p>
  </section>;
}
