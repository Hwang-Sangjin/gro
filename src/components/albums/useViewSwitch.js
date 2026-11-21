"use client";
// 보기(Grid · Crate · List · Shelf) 고르기 — Digging · Collection 공용
//  ① 기억: List 는 고른 채로 남고, Shelf 는 거기서 앨범을 열었다가 돌아오면 다시 열림 (Crate 는 CrateView 가 따로 기억함)
//  ② 전환: Grid ↔ List ↔ Shelf 사이를 커버가 제자리로 날아가며 넘어감 (coverFlight.js). Crate 가 끼면 3D 상자가 날림
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { collectCovers, startFlight } from "./coverFlight";

export const viewKey = () => `grooves:view:${location.pathname}`;
export const shelfKey = () => `grooves:shelf:${location.pathname}`;   // Shelf 에서 연 판 (돌아오면 그 판을 꺼내 둠)
const SHELF_OUT = 520;   // Shelf 를 떠날 때 무대가 옅어지는 시간(ms) — 그동안 ShelfView 를 남겨 둠

/**
 * wrapRef: 그리드 · 목록이 그려지는 요소 (커버 자리를 여기서 읽음)
 * 돌려주는 것
 *   view · setView(다음 보기)
 *   arriving: 커버가 날아오는 중 (목록이 제 등장 움직임을 줄임)
 *   shelfOn: ShelfView 를 그릴지 (떠나는 동안 잠깐 더) · shelfLeaving: 떠나는 중 (옅어짐)
 *   shelfApi: ShelfView 에 넘길 ref — 선반이 준비되면 { rects(), hold(slugs), release() } 를 채움
 */
export default function useViewSwitch(wrapRef) {
  const [view, setViewState] = useState("grid");
  const [arriving, setArriving] = useState(false);
  const [shelfLeaving, setShelfLeaving] = useState(false);
  const shelfApi = useRef(null);
  const flight = useRef(null), viewRef = useRef("grid"), leaveTimer = useRef(0);

  // 돌아왔을 때: 기억해 둔 보기로 (서버 렌더와 어긋나지 않게 마운트 뒤에)
  useEffect(() => {
    let saved = null;
    try { saved = sessionStorage.getItem(viewKey()); if (saved === "shelf") sessionStorage.removeItem(viewKey()); } catch {}
    if (saved === "list" || saved === "shelf") { viewRef.current = saved; setViewState(saved); }
  }, []);

  const setView = useCallback((next) => {
    const prev = viewRef.current;
    if (next === prev) return;
    try { if (next === "list") sessionStorage.setItem(viewKey(), next); else sessionStorage.removeItem(viewKey()); } catch {}
    flight.current?.f.cancel(); flight.current = null;
    clearTimeout(leaveTimer.current);
    let leaving = false;
    // Crate 가 끼는 전환은 3D 상자가 맡음 → 여기서는 보기만 바꿈
    if (next !== "crate" && prev !== "crate") {
      const f = startFlight(prev === "shelf" ? shelfApi.current?.rects() ?? new Map() : collectCovers(wrapRef.current));
      if (f.slugs.size) {
        flight.current = { f, to: next };
        if (prev === "shelf") {   // 선반은 옅어지며 물러나고, 날아가는 판은 선반에서 뺌
          shelfApi.current?.hold(f.slugs);
          leaving = true;
          leaveTimer.current = setTimeout(() => setShelfLeaving(false), SHELF_OUT);
        }
      }
    }
    setArriving(!!flight.current);
    setShelfLeaving(leaving);
    viewRef.current = next;
    setViewState(next);
  }, [wrapRef]);

  // 새 보기가 그려진 뒤: 허깨비들을 새 자리로 날려 보내고, 내려앉으면 진짜 커버를 보임
  useLayoutEffect(() => {
    const job = flight.current;
    if (!job || job.to !== view) return;
    let alive = true, raf = 0;
    const finish = () => { if (flight.current === job) { flight.current = null; setArriving(false); } };
    if (view === "shelf") {
      // 선반(3D)이 준비되면 책등 자리를 받아서 그리로. 그동안 그 판들은 선반에서 숨겨 둠
      const t0 = performance.now();
      const wait = () => {
        if (!alive) return;
        const api = shelfApi.current;
        if (!api) {
          if (performance.now() - t0 > 6000) { job.f.cancel(); finish(); } else raf = requestAnimationFrame(wait);
          return;
        }
        api.hold(job.f.slugs);
        const target = new Map([...api.rects()].map(([slug, s]) => [slug, { rect: s.rect, thin: true }]));
        job.f.to(target).then(() => { shelfApi.current?.release(); finish(); });
      };
      wait();
    } else {
      const spots = collectCovers(wrapRef.current);
      const els = [...spots.values()].map((s) => s.el);
      for (const el of els) el.style.visibility = "hidden";
      job.f.to(new Map([...spots].map(([slug, s]) => [slug, { rect: s.rect }]))).then(() => {
        for (const el of els) el.style.visibility = "";
        finish();
      });
    }
    return () => { alive = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => () => { flight.current?.f.cancel(); clearTimeout(leaveTimer.current); }, []);
  return { view, setView, arriving, shelfOn: view === "shelf" || shelfLeaving, shelfLeaving, shelfApi };
}
