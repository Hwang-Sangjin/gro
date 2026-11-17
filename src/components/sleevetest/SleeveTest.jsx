"use client";
// /lab/sleeve-test — 새 Home Hero 1 · 2단계: 실제 같은 LP 재킷 줄 + 판 (임시, 메뉴에 없음)
//  좌우로 끌거나 ← → 로 넘김 (놓으면 가운데에 붙음) · 옆 재킷을 누르면 그리로 · 가운데 재킷을 누르면(또는 Space) 판이 나옴
//  마우스를 움직이면 가운데 재킷이 기울고 빛이 면 위를 흐름
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { fetchRecentVinyls } from "@/lib/recent-vinyls";
import { coverUrl } from "@/lib/albums";
import { markHomeReady } from "@/lib/homeReady";
import { useIntro } from "@/components/intro/intro-context";
import { createSleeveScene } from "./sleeveScene";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const loadImage = (src) => new Promise((done) => {
  if (!src) return done(null);
  const im = new Image();
  im.crossOrigin = "anonymous";
  im.onload = () => done(im); im.onerror = () => done(null);
  im.src = src;
});

export default function SleeveTest() {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [albums, setAlbums] = useState([]);
  const [index, setIndex] = useState(0);
  const [out, setOut] = useState(false);     // 열림 (가운데 재킷에서 판이 나온 상태)
  const [note, setNote] = useState("");
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 2200); return () => clearTimeout(t); }, [note]);
  const album = albums[index] ?? null;
  // 등장: 가운데와 양옆 커버가 준비되면(ready) 첫 로딩 화면을 걷고(markHomeReady), 걷힌 뒤(done) 재킷들이 나타남
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const { done } = useIntro();
  useEffect(() => {
    if (!ready || !done) return;
    sceneRef.current?.reveal();
    const t = setTimeout(() => setShown(true), 500);     // 글자 · 버튼은 재킷이 다가온 뒤에
    return () => clearTimeout(t);
  }, [ready, done]);

  useEffect(() => {
    const scene = createSleeveScene(hostRef.current, { onIndex: setIndex, onPull: setOut, onRecord: () => setNote("판을 눌렀어요 → 5단계에서 턴테이블로 내려가요") });
    sceneRef.current = scene;
    window.__sleeve = scene;     // 콘솔 확인용
    const failSafe = setTimeout(() => { setReady(true); markHomeReady(); }, 8000);     // 커버가 늦어도 8초 뒤에는 엶
    const ac = new AbortController();
    fetchRecentVinyls(createClient(), ac.signal).then(setAlbums).catch(() => {});
    return () => { clearTimeout(failSafe); ac.abort(); scene.dispose(); sceneRef.current = null; if (window.__sleeve === scene) delete window.__sleeve; };
  }, []);
  // 앨범 목록이 오면 줄을 만들고, 커버는 가운데에서 가까운 것부터 받아 입힘
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !albums.length) return;
    let off = false;
    scene.setAlbums(albums);
    const order = albums.map((_, i) => i).sort((a, b) => Math.abs(a - scene.st.target) - Math.abs(b - scene.st.target));
    (async () => {
      let n = 0;
      for (const i of order) {
        const img = await loadImage(coverUrl(albums[i].cover_path || albums[i].thumb_path));
        if (off) return;
        sceneRef.current?.setCover(i, img);
        // 가운데 + 양옆(가까운 3장)이 준비되면 화면을 엶. 나머지는 뒤에서 이어서 받음
        if (++n === Math.min(3, order.length)) { sceneRef.current?.frame(0); setReady(true); markHomeReady(); }
      }
    })();
    return () => { off = true; };
  }, [albums]);
  useEffect(() => {
    const onKey = (e) => {
      const scene = sceneRef.current; if (!scene) return;
      if (e.key === "ArrowRight") scene.step(1);
      else if (e.key === "ArrowLeft") scene.step(-1);
      else if (e.key === "Home") scene.go(0);
      else if (e.key === "End") scene.go(scene.items.length - 1);
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); scene.setPull(scene.st.pullTarget === 0); }
      else if (e.key === "Escape") scene.setPull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn = "pointer-events-auto rounded-full border border-current/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] transition-[color,background-color,opacity] hover:bg-(--ink) hover:text-(--cream) disabled:pointer-events-none disabled:opacity-25";
  return (
    <div className="relative h-svh w-full overflow-hidden text-(--ink)" style={{ background: "var(--cream)" }}>
      <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full" />
      <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-[var(--gutter)] pb-[clamp(1.25rem,4vh,2.75rem)] transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "translate-y-2 opacity-0"}`}>
        <button type="button" className={`${btn} ${out ? "invisible" : ""}`} disabled={index <= 0} onClick={() => sceneRef.current?.step(-1)} aria-label="Previous album">←</button>
        <div className="min-w-0 text-center" aria-live="polite">
          <p className={`mb-2 text-[11px] tracking-[0.08em] transition-opacity duration-300 ${note ? "opacity-80" : "opacity-0"}`} aria-hidden={!note}>{note || " "}</p>
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.3em] opacity-70">{album?.artist_names || "Loading"}</p>
          <p className={`${SERIF} mt-1 truncate text-[clamp(1.4rem,2.6vw,2.4rem)] leading-tight`}>{album?.title || "…"}</p>
          <button type="button" className={`${btn} mt-3`} disabled={!album} onClick={() => sceneRef.current?.setPull(!out)}>{out ? "Close" : "Open"}</button>
          <button type="button" className={`${btn} ml-2 mt-3`} onClick={() => sceneRef.current?.replay()}>Replay intro</button>
        </div>
        <button type="button" className={`${btn} ${out ? "invisible" : ""}`} disabled={index >= albums.length - 1} onClick={() => sceneRef.current?.step(1)} aria-label="Next album">→</button>
      </div>
    </div>
  );
}
