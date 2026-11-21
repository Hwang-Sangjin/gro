"use client";
// 보기(Grid · Crate · List) 고르기 — Digging · Collection 공용
//  ① 기억: List 는 고른 채로 남음 — 앨범을 열었다가 돌아와도 List (Crate 는 CrateView 가 따로 기억함)
//  ② 전환: Grid ↔ List 를 커버가 제자리로 날아가며 넘어감 (coverFlight.js). Crate 가 끼면 3D 상자가 날림
//  (2026-11-22 네 번째 보기 Shelf — 3D 선반 — 를 넣었다가 뺌. 사용자: 별로)
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { collectCovers, startFlight } from "./coverFlight";

const viewKey = () => `grooves:view:${location.pathname}`;

/**
 * wrapRef: 그리드 · 목록이 그려지는 요소 (커버 자리를 여기서 읽음)
 * 돌려주는 것: view · setView(다음 보기) · arriving(커버가 날아오는 중 — 목록이 제 등장 움직임을 줄임)
 */
export default function useViewSwitch(wrapRef) {
  const [view, setViewState] = useState("grid");
  const [arriving, setArriving] = useState(false);
  const flight = useRef(null), viewRef = useRef("grid");

  // 돌아왔을 때: 기억해 둔 보기로 (서버 렌더와 어긋나지 않게 마운트 뒤에)
  useEffect(() => {
    let saved = null;
    try { saved = sessionStorage.getItem(viewKey()); } catch {}
    if (saved === "list") { viewRef.current = saved; setViewState(saved); }
  }, []);

  const setView = useCallback((next) => {
    const prev = viewRef.current;
    if (next === prev) return;
    try { if (next === "list") sessionStorage.setItem(viewKey(), next); else sessionStorage.removeItem(viewKey()); } catch {}
    flight.current?.f.cancel(); flight.current = null;
    // Crate 가 끼는 전환은 3D 상자가 맡음 → 여기서는 보기만 바꿈
    if (next !== "crate" && prev !== "crate") {
      const f = startFlight(collectCovers(wrapRef.current));
      if (f.slugs.size) flight.current = { f, to: next };
    }
    setArriving(!!flight.current);
    viewRef.current = next;
    setViewState(next);
  }, [wrapRef]);

  // 새 보기가 그려진 뒤: 허깨비들을 새 자리로 날려 보내고, 내려앉으면 진짜 커버를 보임
  useLayoutEffect(() => {
    const job = flight.current;
    if (!job || job.to !== view) return;
    const spots = collectCovers(wrapRef.current);
    const els = [...spots.values()].map((s) => s.el);
    for (const el of els) el.style.visibility = "hidden";
    job.f.to(new Map([...spots].map(([slug, s]) => [slug, { rect: s.rect }]))).then(() => {
      for (const el of els) el.style.visibility = "";
      if (flight.current === job) { flight.current = null; setArriving(false); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => () => flight.current?.f.cancel(), []);
  return { view, setView, arriving };
}
