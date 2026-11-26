"use client";
// /lab/listening — 선반(책등)에서 판을 뽑아 바로 듣는 화면의 프로토타입
//  위: 무대 (왼쪽 판 정보 · 가운데 재킷 + 판 + 톤암 · 오른쪽 Now spinning 플레이어)
//  아래: 책등 선반 (가로로 훑기 · 누르면 뽑혀서 무대로)
//  소리: 방 턴테이블과 같은 YouTube 재생목록(roomMusic.js). 약관상 플레이어는 보여야 해서 오른쪽 카드에 둠
//  판은 최근 올린 순 (프로토타입이라 내 선반이 아니라 전체 앨범에서 가져옴)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { cached } from "@/lib/dataCache";
import { coverUrl } from "@/lib/albums";
import { createRoomMusic } from "@/components/roomtest/roomMusic";
import styles from "./Listening.module.css";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const LIMIT = 90;
const SWITCH_MS = 950;   // 판을 바꾸는 동안(재킷이 올라오고 판이 나옴) 바늘을 들어 둠
const FALLBACK = ["#2d6a6a", "#8a4b3a", "#c9a24b", "#4c404a", "#6b7f5e", "#b5533c", "#3d5a80", "#a8763e"];

const fetchAlbums = () => cached("lab-listening-v1", async () => {
  const { data, error } = await createClient()
    .from("albums")
    .select("id, slug, title, artist_names, cover_path, thumb_path, cover_color, youtube_playlist_id, release_year, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return data ?? [];
}, { valid: (rows) => rows?.length > 0 });

// 책등: 색(커버 대표색) · 글자색(밝기에 맞춰) · 두께와 키(앨범마다 조금씩 다르게)
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function spineOf(album) {
  const h = hash(String(album.id));
  const hex = /^#[0-9a-f]{6}$/i.test(album.cover_color || "") ? album.cover_color : FALLBACK[h % FALLBACK.length];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const light = (r * 299 + g * 587 + b * 114) / 1000 > 150;
  return { bg: hex, fg: light ? "#2a2228" : "#f4e7cd", w: 26 + (h % 5) * 4, h: 0.91 + ((h >> 4) % 4) * 0.03 };
}

export default function ListeningStudio() {
  const [albums, setAlbums] = useState(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const [want, setWant] = useState(false);          // 바늘을 내리고 싶음
  const [switching, setSwitching] = useState(false);
  const [music, setMusic] = useState({ playing: false, buffering: false, blocked: false, error: false });
  const hostRef = useRef(null), musicRef = useRef(null), shelfRef = useRef(null), timer = useRef(0);

  useEffect(() => {
    let alive = true;
    fetchAlbums().then((rows) => {
      if (!alive) return;
      setAlbums(rows);
      const first = rows.findIndex((a) => a.youtube_playlist_id);   // 소리 있는 판부터
      setIndex(Math.max(0, first));
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const album = albums?.[index] ?? null;
  const hasSound = !!album?.youtube_playlist_id;
  const spinning = want && hasSound && !switching;

  // 플레이어 (처음 틀 때 만들어짐)
  useEffect(() => {
    const m = createRoomMusic(hostRef.current, setMusic);
    musicRef.current = m;
    return () => { m.dispose(); musicRef.current = null; };
  }, []);
  const track = useMemo(() => (album ? { ...album, playlist: album.youtube_playlist_id } : null), [album]);
  useEffect(() => { musicRef.current?.set(track, spinning); }, [track, spinning]);

  const pick = useCallback((i, play = true) => {
    if (!albums?.length) return;
    const n = (i + albums.length) % albums.length;
    clearTimeout(timer.current);
    setIndex(n);
    if (play) setWant(true);
    setSwitching(true);
    timer.current = setTimeout(() => setSwitching(false), SWITCH_MS);
  }, [albums]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = useCallback(() => {
    if (!hasSound) return;
    if (music.blocked) { musicRef.current?.resume(); return; }
    setWant((w) => !w);
  }, [hasSound, music.blocked]);

  // 고른 책등이 선반 가운데로
  useEffect(() => {
    const shelf = shelfRef.current, el = shelf?.querySelector(`[data-i="${index}"]`);
    if (!shelf || !el) return;
    shelf.scrollTo({ left: el.offsetLeft - shelf.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
  }, [index, albums]);

  // 선반 위에서 세로 휠 = 가로로 훑기 (끝에 닿으면 페이지 스크롤로)
  useEffect(() => {
    const shelf = shelfRef.current;
    if (!shelf) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = shelf.scrollWidth - shelf.clientWidth;
      if ((e.deltaY < 0 && shelf.scrollLeft <= 0) || (e.deltaY > 0 && shelf.scrollLeft >= max - 1)) return;
      e.preventDefault();
      shelf.scrollLeft += e.deltaY;
    };
    shelf.addEventListener("wheel", onWheel, { passive: false });
    return () => shelf.removeEventListener("wheel", onWheel);
  }, [albums]);

  // ← → 다음 판 · Space 재생/멈춤
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, select, iframe")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); pick(index + 1, false); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); pick(index - 1, false); }
      else if (e.key === " " && !e.target.closest?.("button, a")) { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, pick, toggle]);

  const status = !album ? "" : !hasSound ? "No sound for this one yet"
    : music.error ? "Couldn’t load the sound"
    : music.blocked ? "Your browser paused it — press play"
    : switching && want ? "Changing the record…"
    : music.buffering ? "Finding the groove…"
    : spinning && music.playing ? "Now spinning"
    : spinning ? "Dropping the needle…" : "Needle up";
  const cover = album ? coverUrl(album.cover_path || album.thumb_path) : null;

  return (
    <div className={styles.root}>
      <section className={styles.stage} aria-label="Turntable">
        {/* 왼쪽: 판 정보 */}
        <div className={styles.info}>
          <p className={styles.kicker}>Lab · Listening shelf</p>
          {album ? (
            <div key={album.id} className={styles.infoIn}>
              <p className={styles.artist}>{album.artist_names}</p>
              <h1 className={`${SERIF} ${styles.title}`}>{album.title}</h1>
              <p className={styles.meta}>
                {album.release_year ? <span>{album.release_year}</span> : null}
                <span>LP</span>
                <span className="tabular-nums">{String(index + 1).padStart(2, "0")} / {String(albums.length).padStart(2, "0")}</span>
              </p>
              <div className={styles.actions}>
                <button type="button" className={styles.play} onClick={toggle} disabled={!hasSound} aria-pressed={spinning}>
                  {spinning && !music.blocked ? "Lift the needle" : "Drop the needle"}
                </button>
                <Link href={`/album/${album.slug}`} className={styles.more}>Album page <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          ) : (
            <p className={styles.meta} role="status">{failed ? "Couldn’t load the shelf. Please refresh." : "Loading the shelf…"}</p>
          )}
        </div>

        {/* 가운데: 재킷 + 판 + 톤암 */}
        <div className={styles.deck} data-spinning={spinning} data-switching={switching}>
          {album && (
            <>
              <button type="button" key={`d${album.id}`} className={styles.disc} onClick={toggle} disabled={!hasSound}
                aria-label={spinning ? "Lift the needle" : "Drop the needle"}>
                <span className={styles.discSpin}>
                  <span className={styles.label} style={{ backgroundColor: spineOf(album).bg, backgroundImage: cover ? `url("${coverUrl(album.thumb_path || album.cover_path)}")` : undefined }} />
                </span>
              </button>
              <div key={`c${album.id}`} className={styles.cover} style={{ backgroundColor: spineOf(album).bg }}>
                {cover && <img src={cover} alt={`${album.title} — ${album.artist_names}`} draggable={false} />}
              </div>
              <div className={styles.arm} aria-hidden="true">
                <span className={styles.armWeight} /><span className={styles.armBar} /><span className={styles.armHead} /><span className={styles.armPivot} />
              </div>
            </>
          )}
        </div>

        {/* 오른쪽: Now spinning (YouTube 플레이어는 보여야 함) */}
        <aside className={styles.player} aria-label="Now spinning">
          <p className={styles.playerHead}>
            <span className={styles.dot} data-on={spinning && music.playing} />
            <span role="status">{status}</span>
          </p>
          <div className={styles.screen}>
            <p className={styles.screenHint}>{hasSound ? "Sound plays here, from YouTube" : "No playlist on this record yet"}</p>
            <div ref={hostRef} className={styles.host} />
          </div>
          <p className={styles.playerFoot}>← → next record · Space play</p>
        </aside>
      </section>

      {/* 아래: 책등 선반 */}
      <section className={styles.shelfWrap} aria-label="Shelf">
        <div className={styles.shelfHead}>
          <span>Pull one from the shelf</span>
          <span className="tabular-nums">{albums ? `${albums.length} records · newest first` : ""}</span>
        </div>
        <div ref={shelfRef} className={styles.shelf} data-lenis-prevent>
          {albums?.map((a, i) => {
            const s = spineOf(a);
            return (
              <button key={a.id} type="button" data-i={i} className={styles.spine} aria-current={i === index}
                aria-label={`${a.title} — ${a.artist_names}`} onClick={() => pick(i)}
                style={{ "--bg": s.bg, "--fg": s.fg, "--w": `${s.w}px`, "--h": s.h }}>
                <span className={styles.spineText}><b>{a.title}</b><i>{a.artist_names}</i></span>
                {!a.youtube_playlist_id && <span className={styles.mute} title="No sound yet" />}
              </button>
            );
          })}
        </div>
        <div className={styles.board} aria-hidden="true" />
      </section>
    </div>
  );
}
