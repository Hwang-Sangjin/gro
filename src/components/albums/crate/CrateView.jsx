"use client";
// Crate 보기 — Digging · Collection(Owned / Wishlist) · 공개 컬렉션 공용
// 그리드 위에 화면을 덮는 3D 크레이트. 전환은 Grid / Crate 버튼으로만
//  - Grid → Crate: 화면에 보이는 그리드 판들이 차례로 날아와 크레이트에 꽂힘 (맨 앞 = 화면의 첫 판)
//  - Crate: 스크롤·드래그·키로 판이 끝없이 넘어감. 맨 앞 판을 누르면 앨범 상세로 (커버가 날아가는 전환)
//  - Crate → Grid: 맨 앞 판의 칸이 보이게 스크롤해 두고, 판들이 맨 앞부터 차례로 날아가 칸에 꽂힘
// 카드 정보는 그리드 DOM([data-album-card])에서 읽음 → 장르·탭·검색으로 걸러진 지금 그리드 그대로
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import { createClient } from "@/utils/supabase/client";
import useAuthUser from "@/lib/useAuthUser";
import { fetchMyKinds, setAlbumKind } from "@/lib/userAlbums";
import { setNowSpinning } from "@/lib/nowSpinning";
import { createRoomMusic } from "@/components/roomtest/roomMusic";
import CratePanel from "./CratePanel";
import SoundToggle from "@/components/albums/SoundToggle";
import { useCrate } from "@/components/crate/CrateProvider";
import { GENRE_ITEMS } from "@/components/albums/GenreBar";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const VIEWS = ["grid", "crate"];
const is3d = (v) => v === "crate" || v === "listen";
const SFX = false;   // 판 넘기는 효과음 (2026-11-27 뺌)
const LAST_KEY = "grooves:listen:last";   // 마지막으로 무대에 올린 판 (Listening 에 다시 들어오면 그 판부터)
const VIEW_ICON = {
  listen: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.4" /></>,
  grid: <path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z" />,
  crate: <path d="M2 5.5h12v8H2zM4.5 5.5v-3h7v3M6.5 2.5v3M9 2.5v3" />,
  list: <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />,
};
const storeKey = () => `grooves:crate:${location.pathname}`;
// 정보 패널에 쓰는 판 상세 (그리드 카드에는 제목 · 아티스트 · 색만 있음)
const DETAIL = "id, slug, release_year, format, rpm, description, youtube_playlist_id, album_genres(genres(name, slug)), tracks(count)";

/** Grid / Crate 스위치 (그리드 위·크레이트 위 같은 모양). views 로 보기를 더 넣을 수 있음 (List) */
export function ViewToggle({ view, onChange, className = "", views = VIEWS }) {
  const at = Math.max(0, views.indexOf(view));
  return (
    <div role="group" aria-label="View" className={`relative inline-flex shrink-0 rounded-full border border-(--ink)/30 p-[3px] ${className}`}>
      <span aria-hidden="true" className={`absolute inset-y-[3px] left-[3px] rounded-full bg-(--ink) transition-transform duration-500 ${EASE}`}
        style={{ width: `calc((100% - 6px) / ${views.length})`, transform: `translateX(${at * 100}%)` }} />
      {views.map((v) => (
        <button key={v} type="button" aria-pressed={view === v} aria-label={`${v} view`} onClick={() => onChange(v)}
          className={`relative z-[1] grid min-h-8 place-items-center rounded-full text-[11px] font-medium uppercase tracking-[0.2em] transition-colors duration-500 ${views.length > 2 ? "w-[4.6rem] max-md:w-10" : "w-[4.6rem]"} ${view === v ? "text-(--cream)" : "text-(--ink)"}`}>
          {/* 보기가 셋 이상이면 좁은 화면에서는 글자 대신 그림 (네 칸이 한 줄에 안 들어감) */}
          <span className={views.length > 2 ? "max-md:hidden" : ""}>{v}</span>
          {views.length > 2 && <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5 md:hidden" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">{VIEW_ICON[v]}</svg>}
        </button>
      ))}
    </div>
  );
}

// 글자 칸막이 (2026-11-27): 아티스트 A–Z 로 정렬해 볼 때, 레코드 가게처럼 이름 첫 글자가 바뀌는 자리에 칸막이를 꽂음 (Crate · Listen)
//  판이 아직 적어서(글자마다 한두 장) 몇 글자씩 묶음. 한글은 한 묶음, 숫자 · 기호는 #
const LETTER_GROUPS = [["A", "D"], ["E", "K"], ["L", "R"], ["S", "Z"]];
function letterOf(artist) {
  const ch = (artist || "").trim().charAt(0).toUpperCase();
  if (ch >= "A" && ch <= "Z") { const g = LETTER_GROUPS.find(([a, b]) => ch >= a && ch <= b); return `${g[0]}–${g[1]}`; }
  if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(ch)) return "ㄱ–ㅎ";
  return "#";
}
const LETTER_NOTE = (k) => (k === "#" ? "Numbers & symbols" : k === "ㄱ–ㅎ" ? "Korean names" : `Artists ${k.replace("–", " to ")}`);
function withLetters(cards) {
  const out = []; let prev = null, rows = 0;
  for (const c of cards) {
    if (!c.divider) {
      const k = letterOf(c.artist);
      if (k !== prev) {
        prev = k;
        out.push({ divider: true, row: rows++ % 2, letter: k, slug: `__letter_${k}_${out.length}`, art: null, image: null, head: k, count: LETTER_NOTE(k), tab: k, dot: "#4c404a", color: "#c9a679", title: k, artist: LETTER_NOTE(k) });
      }
    }
    out.push(c);
  }
  return out;
}
// 장르 칸막이 (2026-11-27 사용자 요청): 새로 들어온 판(New in)을 맨 앞에 따로 묶고, 나머지는 장르별로 묶어 묶음마다 칸막이를 꽂음
//  한 판은 한 곳에만 (여러 장르면 장르 바 순서에서 앞에 있는 장르). 묶음 안의 순서는 그리드 순서 그대로 (섞인 순 · 정렬한 순)
//  장르는 상세(details: slug → { album_genres })에서 옴 — 아직 못 받은 판은 Others
//  그리드 맨 앞의 "All records" 칸막이는 여기서는 뺌 (칸막이가 둘 겹침)
function withGroups(cards, details) {
  const albums = cards.filter((c) => !c.divider);
  const order = GENRE_ITEMS.filter((g) => g.slug);
  const groups = new Map([["__new", { label: "New in", dot: "#d9603b", items: [] }], ...order.map((g) => [g.slug, { label: g.name, dot: "#4c404a", items: [] }]), ["__others", { label: "Others", dot: "#4c404a", items: [] }]]);
  for (const c of albums) {
    if (c.isNew) { groups.get("__new").items.push(c); continue; }
    const mine = (details.get(c.slug)?.album_genres ?? []).map((g) => g.genres?.slug).filter(Boolean);
    groups.get(order.find((g) => mine.includes(g.slug))?.slug ?? "__others").items.push(c);
  }
  const out = []; let rows = 0;
  for (const [key, g] of groups) {
    if (!g.items.length) continue;
    const n = `${g.items.length} record${g.items.length === 1 ? "" : "s"}`;
    out.push({ divider: true, row: rows++ % 2, letter: g.label, slug: `__group_${key}`, art: null, image: null, head: g.label, count: n, tab: g.label, dot: g.dot, color: "#c9a679", title: g.label, artist: n }, ...g.items);
  }
  return out;
}
// mode: "letters" (아티스트 A–Z 로 볼 때) | "genre" (그 밖) | null (칸막이 없이 그리드 그대로)
function readCards(root, mode = null, details = null) {
  const cards = readCardsRaw(root);
  return mode === "letters" ? withLetters(cards) : mode === "genre" && details ? withGroups(cards, details) : cards;
}
function readCardsRaw(root) {
  if (!root) return [];
  const albums = [...root.querySelectorAll("[data-album-card]")].map((a) => ({
    slug: a.dataset.albumSlug, color: a.dataset.albumColor, image: a.dataset.albumImage || null,
    title: a.dataset.albumTitle || "", artist: a.dataset.albumArtist || "", isNew: a.dataset.albumNew === "true",
    art: a.querySelector("[data-album-source]"),
  })).filter((c) => c.slug && c.art);
  // List 보기 위에서 열 때: 줄([data-list-row])의 작은 커버가 날아가는 자리
  if (!albums.length) {
    return [...root.querySelectorAll("[data-list-row]")].map((a) => ({
      slug: a.dataset.albumSlug, color: a.dataset.albumColor, image: a.dataset.albumImage || null,
      title: a.dataset.albumTitle || "", artist: a.dataset.albumArtist || "", isNew: false,
      art: a.querySelector("[data-list-cover]"),
    })).filter((c) => c.slug && c.art);
  }
  // 장르 칸막이(Digging, [data-crate-divider]): 크레이트 맨 앞에도 꽂음 — 크래프트 판 + 위로 솟은 다이모 탭 (crateDivider.js)
  const d = root.querySelector("[data-crate-divider]"), art = d?.querySelector("[data-divider-art]");
  if (!d || !art || !albums.length) return albums;
  const dot = d.querySelector("[data-divider-dot]");
  return [{
    divider: true, slug: "__divider", art, image: null,
    head: d.dataset.head || "", count: d.dataset.count || "", tab: d.dataset.tab || "",
    dot: dot ? getComputedStyle(dot).backgroundColor : "#bbcbda",
    color: "#c9a679", title: d.dataset.head || "", artist: d.dataset.count || "",
  }, ...albums];
}

/**
 * gridRef: 그리드 카드들을 감싼 요소 · view / onViewChange: 'grid' | 'crate' | 'listen' (페이지가 상태를 가짐. 'grid' = 3D 가 아닌 보기)
 * flat: 3D 를 닫으면 돌아갈 보기의 이름 ('grid' | 'list') — 덮개 안의 전환 버튼에 그 이름으로 나옴
 * dividers: 칸막이를 무엇으로 나눌지 — "letters" (아티스트 A–Z 순으로 볼 때 이름 첫 글자) | "genre" (New in + 장르별) | null
 * title: 크레이트 왼쪽 위 큰 글자 (예: DIGGING, OWNED)
 * total: 이 목록의 전체 판 수 (그리드가 아직 다 받지 못했어도 번호 옆에 전체 수를 보여 주려고). 없으면 지금 꽂힌 수
 */
export default function CrateView({ gridRef, view, onViewChange, title, total = null, flat = "grid", dividers = null }) {
  const groupRef = useRef(dividers);
  useEffect(() => { groupRef.current = dividers; });
  const [marks, setMarks] = useState([]);   // 글자 칸막이들 [{ i, label }] — 위쪽의 바로 가기 줄
  const putCards = (cards) => { cardsRef.current = cards; setMarks(cards.flatMap((c, i) => (c.letter ? [{ i, label: c.letter }] : []))); };
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const sourceRef = useRef(null);
  const cardsRef = useRef([]);
  const [shown, setShown] = useState(false);        // 덮개가 있음 (전환 중 포함)
  const [front, setFront] = useState(null);         // { i, n, title, artist, color }
  const transition = useAlbumTransition();
  const router = useRouter();
  const user = useAuthUser();
  const sfx = useCrate()?.sfx;   // 판을 넘길 때의 소리 (소리를 켰을 때만 남)

  // ── 정보 패널: 상자에 꽂힌 판들의 상세를 한 번에 받아 둠 (판을 넘길 때마다 묻지 않게)
  const details = useRef(new Map());                // slug → 상세 (못 받았으면 null)
  const [, bump] = useState(0);
  // 2LP · 게이트폴드 · 박스는 Listen 선반에서 책등이 더 두꺼움 (포맷은 상세에서 옴)
  const syncThick = () => {
    const thick = [];
    for (const [slug, d] of details.current) if (d && /(\b[2-9]\s*x?\s*LP\b|gatefold|box|게이트)/i.test(`${d.format || ""}`)) thick.push(slug);
    engineRef.current?.setThick(thick);
  };
  const loadDetails = useCallback(async (cards) => {
    const want = cards.filter((c) => !c.divider && !details.current.has(c.slug)).map((c) => c.slug);
    if (!want.length) { syncThick(); return; }
    for (const slug of want) details.current.set(slug, undefined);   // 받는 중 (같은 판을 두 번 묻지 않게)
    try {
      for (let i = 0; i < want.length; i += 60) {
        const { data, error } = await createClient().from("albums").select(DETAIL).eq("status", "published").in("slug", want.slice(i, i + 60));
        if (error) throw error;
        for (const row of data ?? []) details.current.set(row.slug, row);
      }
    } catch { for (const slug of want) if (details.current.get(slug) === undefined) details.current.delete(slug); }
    syncThick();
    bump((n) => n + 1);
  }, []);

  // 비닐 주름 지도를 페이지가 한가할 때 미리 만들어 둠 → Crate 를 처음 열 때 날아가는 재킷에 비닐이 툭 생기지 않게 (2026-11-23)
  useEffect(() => {
    const go = () => import("../sleeveFx").then((m) => m.prewarmWraps()).catch(() => {});
    const id = window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 3000 }) : setTimeout(go, 1500);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  // ── 내 선반: 로그인했으면 한 번 받아 둠 (앨범 id → owned | wishlist)
  const [kinds, setKinds] = useState(null);
  useEffect(() => {
    if (!is3d(view) || !user || kinds) return;
    let alive = true;
    fetchMyKinds().then((m) => { if (alive) setKinds(m); }).catch(() => {});
    return () => { alive = false; };
  }, [view, user, kinds]);
  useEffect(() => { if (!user) setKinds(null); }, [user]);

  // ── 듣기: Home 의 "Now spinning" 카드와 같은 작은 플레이어 (YouTube 약관상 플레이어는 보여야 함 → 카드 안에)
  const musicHostRef = useRef(null), musicRef = useRef(null), playingRef = useRef(null);
  const [music, setMusic] = useState({ album: null, active: false, playing: false, buffering: false, blocked: false, error: false });
  const stopMusic = useCallback(() => { wantRef.current = false; musicRef.current?.stop(); playingRef.current = null; setNowSpinning(null); }, []);
  useEffect(() => () => { musicRef.current?.dispose(); musicRef.current = null; if (playingRef.current) setNowSpinning(null); }, []);
  // 엔진은 한 번 만들고 계속 씀 → 전환 함수는 늘 최신 것을 ref 로 읽음
  // (앨범 상세에서 돌아오는 페이지 넘김 중에 엔진이 만들어지면 그때의 '전환 중' 상태가 굳어 클릭이 막히던 문제)
  const transitionRef = useRef(transition);
  const openRef = useRef(null);
  useEffect(() => { transitionRef.current = transition; });
  const modeRef = useRef("grid");
  const [mode3d, setMode3d] = useState("crate");   // 덮개가 지금 어느 3D 보기인지 (글자 층의 자리가 다름)
  const autoRef = useRef(null), listenRef = useRef(null);

  const page = () => hostRef.current?.closest(".page");
  const lockPage = (on) => page()?.dispatchEvent(new Event(on ? "page:lock" : "page:unlock"));

  const engine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    const { createCrateEngine } = await import("./crateEngine");
    if (!hostRef.current) return null;
    // 불러오는 사이에 다른 호출이 먼저 만들었으면 그것을 씀 (2026-11-27: 처음 여는 동안 보기를 한 번 더 바꾸면 엔진이 두 개 만들어져
    //  캔버스 두 장이 겹쳐 그려졌음 — 선반이 어긋난 채 두 줄로 보임)
    if (engineRef.current) return engineRef.current;
    engineRef.current = createCrateEngine({
      host: hostRef.current,
      // 번호 · 전체 수는 판만 셈 (칸막이는 빼고). 칸막이가 앞이면 번호 대신 판 수만
      onFront: (i, c, picked) => {
        // 손으로 넘길 때만 소리 (그리드에서 날아와 꽂히는 동안은 조용히)
        //  (2026-11-27 사용자 요청으로 효과음을 뺌 — SFX 를 true 로 하면 다시 남. 소리 버튼도 같이 숨김)
        if (SFX && modeRef.current !== "grid" && !engineRef.current?.busy) sfx?.current?.play("flip");
        if (modeRef.current === "listen" && !c.divider) { try { sessionStorage.setItem(LAST_KEY, c.slug); } catch {} }
        if (picked) autoRef.current = c.slug;   // Listening 에서 책등을 눌러 올린 판은 바로 틂
        // 번호 · 전체 수는 판만 셈 (칸막이들은 빼고)
        const list = cardsRef.current, before = list.slice(0, i).filter((x) => !x.divider).length;
        setFront({ i: before, n: list.filter((x) => !x.divider).length, letter: c.letter || null, divider: !!c.divider, title: c.title, artist: c.artist, color: c.color, slug: c.slug, isNew: !!c.isNew });
      },
      onOpen: (i, rect) => openRef.current?.(i, rect),
      onPeel: () => { if (SFX) sfx?.current?.play("flip"); },   // 스티커가 떼어지는 소리
      onToggle: () => listenRef.current?.(),      // Listening: 턴테이블을 누름
      onSettled: (m) => {
        if (m === "grid") { setShown(false); lockPage(false); }
      },
    });
    return engineRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAlbum(i, rect) {
    const c = cardsRef.current[i];
    if (!c || c.divider) return;   // 칸막이는 열 앨범이 없음
    try { sessionStorage.setItem(storeKey(), JSON.stringify({ view: modeRef.current === "listen" ? "listen" : "crate", slug: c.slug })); } catch {}
    stopMusic();   // 상세 페이지에는 그 앨범의 플레이어가 따로 있음
    const src = sourceRef.current;
    Object.assign(src.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    const transition = transitionRef.current;
    if (transition) transition.openAlbum({ slug: c.slug, color: c.color, imageUrl: c.image, source: src });
    else location.assign(`/album/${encodeURIComponent(c.slug)}`);
  }

  useEffect(() => { openRef.current = openAlbum; });

  // 보기 바뀜 → 전환
  useEffect(() => {
    let alive = true;
    (async () => {
      if (view === modeRef.current) return;
      const eng = await engine();
      if (!alive || !eng) return;
      if (is3d(view) && modeRef.current !== "grid") {
        // Crate ↔ Listening: 같은 판들이 자리만 바꿈 (소리는 그대로)
        if (eng.busy) return;
        if (view === "listen" ? eng.crateToListen() : eng.listenToCrate()) { modeRef.current = view; setMode3d(view); }
      } else if (is3d(view)) {
        const grouped = groupRef.current === "genre";
        // 장르로 묶으려면 판들의 장르(상세)가 먼저 있어야 함
        if (grouped) { await loadDetails(readCardsRaw(gridRef.current)); if (!alive) return; }
        const cards = readCards(gridRef.current, groupRef.current, details.current);
        if (!cards.length) { onViewChange(flat); return; }
        putCards(cards); loadDetails(cards);
        // 화면에 보이는 첫 판 (헤더 아래). 장르로 묶었으면 순서가 그리드와 달라 맨 앞부터
        const topLine = (hostRef.current.getBoundingClientRect().top || 0) + 80;
        const start = grouped ? 0 : Math.max(0, cards.findIndex((c) => c.art && c.art.getBoundingClientRect().bottom > topLine));
        modeRef.current = view; setMode3d(view);
        setShown(true); lockPage(true);
        eng.setFog(getComputedStyle(page() || document.body).backgroundColor);
        if (view === "listen") {
          let last = null;
          try { last = sessionStorage.getItem(LAST_KEY); } catch {}
          eng.toListen(cards, start, { slug: last });
        } else eng.toCrate(cards, start);
      } else {
        if (eng.busy) return;
        modeRef.current = "grid";
        stopMusic();   // 플레이어 카드는 상자 안에 있음 → 상자를 떠나면 소리도 멈춤
        try { sessionStorage.removeItem(storeKey()); } catch {}
        // 맨 앞 판(Listening 은 선반 왼쪽 끝 판)의 칸이 화면 위쪽에 오도록 페이지를 옮긴 뒤 날려 보냄
        const c = cardsRef.current[eng.anchor];
        const pg = page();
        if (c?.art && pg) {
          const r = c.art.getBoundingClientRect(), pr = pg.getBoundingClientRect();
          const top = Math.max(0, pg.scrollTop + r.top - pr.top - Math.min(220, pr.height * 0.25));
          pg.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top } }));
        }
        requestAnimationFrame(() => requestAnimationFrame(() => eng.toGrid()));
      }
    })();
    return () => { alive = false; };
  }, [view, flat, engine, gridRef, onViewChange, loadDetails, stopMusic]);

  // 앨범 상세에서 돌아오면: 떠날 때 크레이트였으면 그 판을 맨 앞에 두고 바로 크레이트로
  useEffect(() => {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(storeKey()) || "null"); } catch {}
    if (!is3d(saved?.view)) return;
    let done = false;
    const tryOpen = async () => {
      if (done || !readCardsRaw(gridRef.current).some((c) => c.slug === saved.slug)) return false;
      done = true;
      const eng = await engine();
      if (!eng) return true;
      if (groupRef.current === "genre") await loadDetails(readCardsRaw(gridRef.current));
      const cards = readCards(gridRef.current, groupRef.current, details.current);
      const i = Math.max(0, cards.findIndex((c) => c.slug === saved.slug));
      putCards(cards); loadDetails(cards);
      modeRef.current = saved.view; setMode3d(saved.view);
      setShown(true); lockPage(true);
      eng.setFog(getComputedStyle(page() || document.body).backgroundColor);
      if (saved.view === "listen") eng.toListen(cards, Math.max(0, i - 3), { instant: true, slug: saved.slug });
      else eng.toCrate(cards, i, { instant: true });
      onViewChange(saved.view);
      return true;
    };
    const mo = new MutationObserver(() => { tryOpen(); });
    if (gridRef.current) mo.observe(gridRef.current, { childList: true, subtree: true });
    tryOpen();
    const t = setTimeout(() => { mo.disconnect(); if (!done) try { sessionStorage.removeItem(storeKey()); } catch {} }, 5000);
    return () => { mo.disconnect(); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 크레이트에 있는 동안 그리드에 판이 더 붙으면(다음 묶음) 크레이트 뒤에도 이어 꽂음
  //  예전: 크레이트는 들어올 때 그리드에 있던 판(첫 묶음 24장)만 담아서, 39장인데 "003 / 024" 로 나오고 25번째부터는 볼 수 없었음
  useEffect(() => {
    if (!is3d(view) || !gridRef.current) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      const eng = engineRef.current;
      if (!eng || modeRef.current === "grid") return;
      if (groupRef.current === "genre") {
        // 장르로 묶었을 땐 새 판이 제 묶음 안으로 들어가야 함 → 뒤에 붙이지 않고 통째로 다시 묶음 (보던 판은 그대로 보이게 엔진이 맞춤)
        const raw = readCardsRaw(gridRef.current), count = (list) => list.filter((c) => !c.divider).length;
        if (count(raw) <= count(cardsRef.current)) return;
        loadDetails(raw).then(() => {
          const apply = () => {
            const e = engineRef.current;
            if (!e || modeRef.current === "grid" || groupRef.current !== "genre") return;
            const next = withGroups(readCardsRaw(gridRef.current), details.current);
            if (count(next) <= count(cardsRef.current)) return;
            if (e.replace(next)) putCards(next); else requestAnimationFrame(apply);   // 움직이는 중이면 끝난 뒤에
          };
          apply();
        });
        return;
      }
      const cards = readCards(gridRef.current, groupRef.current, details.current);
      if (cards.length <= cardsRef.current.length) return;
      if (eng.busy) { raf = requestAnimationFrame(sync); return; }   // 날아오는 중이면 끝난 뒤에
      // 이미 꽂힌 판은 그대로 두고(같은 물체) 새 판만 뒤에
      const next = [...cardsRef.current, ...cards.slice(cardsRef.current.length)];
      if (eng.extend(next)) { putCards(next); loadDetails(next); }
    };
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(sync); });
    mo.observe(gridRef.current, { childList: true, subtree: true });
    sync();
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, [view, gridRef, loadDetails]);

  // Esc → 그리드
  useEffect(() => {
    if (!is3d(view)) return;
    const esc = (e) => { if (e.key === "Escape") onViewChange(flat); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [view, flat, onViewChange]);

  useEffect(() => () => { engineRef.current?.dispose(); engineRef.current = null; lockPage(false); }, []);

  // ── 정보 패널의 값 · 버튼
  const info = front && !front.divider ? details.current.get(front.slug) : null;
  const kind = info && kinds ? kinds.get(info.id) ?? null : null;
  const listening = !!front && music.playing && playingRef.current?.slug === front.slug;
  // Listen: 맨 앞 판을 틂. 이미 그 판이면 멈춤 · 다시 재생
  const listen = () => {
    if (!front || !info?.youtube_playlist_id || !musicHostRef.current) return;
    musicRef.current ??= createRoomMusic(musicHostRef.current, setMusic);
    if (playingRef.current?.slug === front.slug) { wantRef.current = !music.playing; musicRef.current.set(playingRef.current, !music.playing); return; }
    playingRef.current = { slug: front.slug, title: front.title, artist: front.artist, playlist: info.youtube_playlist_id };
    wantRef.current = true;
    musicRef.current.set(playingRef.current, true);
    setNowSpinning({ slug: front.slug, title: front.title, artist: front.artist });
  };
  useEffect(() => { listenRef.current = listen; });
  // Listening: 턴테이블의 판 · 바늘은 "이 판을 지금 틀고 있음"을 따라감
  //  바늘은 "멈췄을 때"와 "판을 바꿀 때"만 들림 (2026-11-27 사용자 요청). 다음 곡으로 넘어가거나 YouTube 에서 구간을 옮기면
  //  잠깐 '재생 중이 아님'이 되는데 (끝남 → 불러오는 중 → 재생), 그때마다 바늘이 들렸다 내려왔음 → 1.6초 넘게 이어질 때만 멈춘 것으로 봄
  //  우리 버튼 · 판을 눌러 멈춘 것(wantRef = false)은 바로 반영
  const [spin, setSpin] = useState(false);
  const wantRef = useRef(false);
  useEffect(() => {
    if (listening) { setSpin(true); return; }
    if (!wantRef.current) { setSpin(false); return; }
    const t = setTimeout(() => setSpin(false), 1600);
    return () => clearTimeout(t);
  }, [listening, front?.slug]);
  //  (2026-11-27 고침: 판을 바꾼 뒤 노래는 나오는데 바늘이 올라가 있었음 — "지금 트는 판이 이 판인지"(playingRef)를 판이 바뀌는 순간에만 봐서,
  //   곧이어 새 판을 틀기 시작해도 다시 보지 않았음 → 그릴 때마다 계산해 값이 바뀌면 엔진에 알림)
  const spinning = spin && !!front && playingRef.current?.slug === front.slug;
  useEffect(() => { engineRef.current?.setPlaying(spinning); }, [spinning]);
  // Listening: Now spinning 카드는 선반 오른쪽 끝에 놓임 → 그만큼 선반을 비움
  useEffect(() => { engineRef.current?.setCardSpace(music.active); }, [music.active]);
  // Listening 에서 책등을 눌러 올린 판: 상세(재생목록)가 도착하면 바로 틂
  useEffect(() => {
    if (mode3d !== "listen" || !front || autoRef.current !== front.slug || info === undefined) return;
    autoRef.current = null;
    if (!info?.youtube_playlist_id || !musicHostRef.current) return;
    wantRef.current = true;
    musicRef.current ??= createRoomMusic(musicHostRef.current, setMusic);
    playingRef.current = { slug: front.slug, title: front.title, artist: front.artist, playlist: info.youtube_playlist_id };
    musicRef.current.set(playingRef.current, true);
    setNowSpinning({ slug: front.slug, title: front.title, artist: front.artist });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode3d, front?.slug, info]);
  const togglePlay = () => {
    const m = musicRef.current, a = playingRef.current;
    if (!m || !a) return;
    wantRef.current = music.blocked ? true : !music.playing;
    if (music.blocked) m.resume(); else m.set(a, !music.playing);
  };
  // 선반에 담기 · 빼기 (상세 페이지의 버튼과 같은 규칙: 한 판은 한 칸에만, 로그인 전이면 로그인으로)
  const shelve = async (next) => {
    if (!info || user === undefined) return;
    if (!user) { router.push(`/login?next=${encodeURIComponent(location.pathname)}`); return; }
    const prev = kinds?.get(info.id) ?? null, target = prev === next ? null : next;
    const put = (v) => setKinds((m) => { const n = new Map(m ?? []); if (v) n.set(info.id, v); else n.delete(info.id); return n; });
    put(target);   // 먼저 화면에 반영, 실패하면 되돌림
    try { await setAlbumKind(user.id, info.id, target); } catch { put(prev); }
  };

  return (
    <>
      <div ref={hostRef} data-no-select data-lenis-prevent data-crate-ignore tabIndex={is3d(view) ? 0 : -1} data-mode={mode3d}
        aria-hidden={!shown} aria-label={!shown ? undefined : mode3d === "listen" ? `${title} listening shelf. Pick a record from the shelf with the arrow keys; press Space to play.` : `${title} crate. Scroll or use the arrow keys to dig; press Enter to open the front record.`}
        role={shown ? "region" : undefined}
        className={`fixed inset-0 z-[25] isolate touch-none outline-none ${shown ? "visible" : "invisible pointer-events-none"} ${view === "crate" ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ "--crate-m": 1, "--crate-gut": "clamp(16px, 4vw, 56px)", "--crate-panel": "clamp(260px, 28vw, 380px)", "--crate-gap": "clamp(24px, 3vw, 56px)" }}>
        {/* 바탕: 그리드와 같은 종이(페이지 색 + 종이 결) — 헤더와 이어짐. 그리드로 갈수록 투명해져 아래 그리드가 드러남 */}
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ opacity: "calc(1 - var(--crate-m))" }}>
          <div className="absolute inset-0 bg-(--bg)" />
          <div className="absolute inset-0 bg-(--paper-surface,var(--bg)) bg-(image:--paper-texture-image) bg-repeat bg-blend-soft-light opacity-(--paper-texture-opacity) [background-size:var(--paper-texture-size)_var(--paper-texture-size)]" />
        </div>
        {/* 글자: 크레이트를 떠나자마자 빠지고, 돌아오면 판들이 거의 다 꽂힐 때 나타남 (CratePanel) */}
        <CratePanel spinning={spinning} cardUp={music.active} marks={marks} onJump={(i) => engineRef.current?.goTo(i)} label={title} front={front} total={total} info={info} kind={kind} listening={listening} mode={mode3d}
          toggle={<ViewToggle view={is3d(view) ? view : flat} onChange={onViewChange} views={[flat, "crate", "listen"]} className="bg-(--bg) shadow-[0_1px_8px_rgb(0_0_0/0.12)]" />} sound={SFX ? <SoundToggle /> : null}
          onOpen={() => engineRef.current?.openFront()} onListen={listen} onShelf={shelve} />
        {/* 듣기 카드 ("Now spinning"): Listen 을 누르면 오른쪽 아래에 뜸. 판을 넘겨도 남고, 상자를 떠나면 닫힘 (좁은 화면에서는 쓰지 않음) */}
        <div role="region" aria-label="Now spinning" inert={!music.active}
          className={`absolute right-[var(--crate-gut)] z-10 w-[200px] cursor-auto overflow-hidden rounded-xl bg-[#15111a]/90 text-[#f4e7cd] shadow-[0_24px_48px_-20px_rgba(0,0,0,.7)] ring-1 ring-white/10 backdrop-blur-md transition-[opacity,translate,bottom] duration-500 ${EASE} motion-reduce:transition-none ${mode3d === "listen" ? "bottom-[calc(var(--listen-board,24px)+8px)]" : "bottom-[clamp(3rem,8vh,4.5rem)] max-[819px]:hidden"} ${music.active ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}>
          <div ref={musicHostRef} className="size-[200px] bg-black [&_iframe]:block [&_iframe]:size-full" />
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-medium uppercase tracking-[0.24em] opacity-60" aria-live="polite">
                {music.error ? "Couldn’t load" : music.blocked ? "Press play" : music.buffering ? "Loading…" : music.playing ? "Now spinning" : "Paused"}
              </p>
              <p className="truncate text-[13px] leading-snug">{music.album?.title}</p>
              <p className="truncate text-[11px] opacity-60">{music.album?.artist}</p>
            </div>
            <button type="button" aria-label={music.playing ? "Pause" : "Play"} onClick={togglePlay}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f4e7cd] text-[#15111a] transition-[background-color,scale] duration-300 hover:bg-[#7fc1bd] active:scale-95">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">{music.playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M4.5 2.5v11l9-5.5z" />}</svg>
            </button>
            <button type="button" aria-label="Close player" onClick={stopMusic}
              className="grid size-9 shrink-0 place-items-center rounded-full text-[#f4e7cd]/70 transition-colors hover:text-[#f4e7cd]">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
            </button>
          </div>
        </div>
      </div>
      {/* 앨범 상세로 날아가는 커버의 출발점 (맨 앞 판 자리에 맞춰 둠) */}
      <div ref={sourceRef} aria-hidden="true" className="pointer-events-none fixed z-[26]" />
    </>
  );
}
