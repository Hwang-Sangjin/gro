// 방 턴테이블 음악 (D, 2026-11-19): 지금 턴테이블에 올라간 앨범의 YouTube 재생목록을 틂
//  RoomTest 가 매 프레임 set(album, play) 를 부름 — 판이 돌고 바늘이 내려가 있을 때만 play=true
//  YouTube 이용 약관: 플레이어를 숨기고 소리만 틀 수 없음(보이는 크기 최소 200×200) → host 는 화면의 "Now spinning" 카드 안에 있음
//  처음 틀 때 플레이어를 만듦(그 전엔 YouTube 스크립트도 받지 않음). 브라우저가 자동 재생을 막으면 onState({ blocked: true })
import { loadYouTubeAPI } from "@/lib/youtube-player";

const validList = (id) => (typeof id === "string" && /^[\w-]+$/.test(id) ? id : null);

/** @param {HTMLElement} host  @param {(s: { album: any, active: boolean, playing: boolean, buffering: boolean, blocked: boolean, error: boolean }) => void} onState */
export function createRoomMusic(host, onState) {
  let player = null, ready = false, creating = false, disposed = false;
  let album = null, list = null, want = false, loaded = null;
  const state = { album: null, active: false, playing: false, buffering: false, blocked: false, error: false };
  const emit = (patch) => { Object.assign(state, patch); onState?.({ ...state }); };

  const sync = () => {
    if (!ready || !player) return;
    if (want && list) {
      if (loaded !== list) { loaded = list; player.loadPlaylist({ list, listType: "playlist" }); }
      else player.playVideo();
    } else if (player.getPlayerState?.() === 1 || player.getPlayerState?.() === 3) player.pauseVideo();
  };
  const ensure = () => {
    if (player || creating || !host) return;
    creating = true;
    loadYouTubeAPI().then((YT) => {
      if (disposed) return;
      const mount = document.createElement("div");
      host.replaceChildren(mount);
      loaded = list;
      player = new YT.Player(mount, {
        width: "200", height: "200",
        playerVars: { listType: "playlist", list, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady(e) {
            if (disposed) return;
            ready = true;
            e.target.getIframe().title = "Now spinning";
            if (want) e.target.playVideo();
          },
          onStateChange(e) { if (!disposed) emit({ playing: e.data === 1, buffering: e.data === 3, blocked: false, error: false }); },
          onError() { if (!disposed) emit({ error: true, playing: false }); },
          onAutoplayBlocked() { if (!disposed) emit({ blocked: true, playing: false }); },
        },
      });
    }).catch(() => { creating = false; emit({ error: true }); });
  };

  return {
    /** album: { title, artist, playlist, ... } | null · play: 판이 돌고 바늘이 내려가 있음 */
    set(nextAlbum, play) {
      const nextList = validList(nextAlbum?.playlist);
      const changed = nextAlbum !== album;
      album = nextAlbum; list = nextList; want = !!(play && nextList);
      if (want) ensure();
      // 카드: 한 번 틀기 시작했으면(플레이어가 있으면) 판을 멈춰도 남겨 둠 (다시 틀 수 있게). 재생목록이 없는 판이면 숨김
      emit({ album, active: !!nextList && (want || !!player), ...(changed ? { error: false, blocked: false } : null) });
      sync();
    },
    /** 사용자가 직접 누른 재생 (자동 재생이 막혔을 때: 클릭 안에서 바로 playVideo) */
    resume() { if (ready && player) { player.playVideo(); emit({ blocked: false }); } },
    /** 플레이어를 없앰 (카드 닫기) */
    stop() {
      want = false;
      player?.destroy(); player = null; ready = false; creating = false; loaded = null;
      host?.replaceChildren();
      emit({ active: false, playing: false, buffering: false });
    },
    dispose() { disposed = true; player?.destroy(); player = null; },
  };
}
