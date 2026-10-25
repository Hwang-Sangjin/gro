"use client";
// /lab/map — 바이닐 장소 지도. 우리 색으로 칠한 서울 지도 (색은 lib/map/style.js 에 고정)
// 공개 장소(places, status = published)를 바이닐 디스크 마커로. 왼쪽 01 Places(필터·목록) · 오른쪽 02 Detail
// 고른 장소는 ?place=<slug> 로 주소에 남아서 링크로 공유 가능
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PLACE_FIELDS, isOver, kindOf } from "@/lib/places";
import PlaceList from "./PlaceList";
import PlaceDetail from "./PlaceDetail";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/lib/theme";
import useLabReveal from "@/components/lab/useLabReveal";
import { SERIF, ShownCtx, Heading } from "@/components/lab/LabUI";
import { PALETTES, PAINT, SEOUL, buildStyle } from "@/lib/map/style";
import { loadMaplibre, HANGUL_FONT, KOREA_BOUNDS, MAP_CONTROLS, MAP_CONTROLS_DARK } from "@/lib/map/maplibre";



export default function MapStudio() {
  const shown = useLabReveal();
  const theme = useTheme() === "dark" ? "dark" : "light";
  const [failed, setFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [places, setPlaces] = useState(null);      // null = 불러오는 중
  const [kind, setKind] = useState("all");
  const [area, setArea] = useState("all");
  const [selected, setSelected] = useState(null);  // slug
  const [hover, setHover] = useState(null);        // slug
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const markers = useRef(new Map());               // slug → { marker, el }

  const palette = PALETTES[theme];
  const latest = useRef(palette);
  latest.current = palette;

  // 지도 만들기 (브라우저에서만 maplibre 불러옴)
  useEffect(() => {
    let gone = false;
    (async () => {
      const { Map, NavigationControl } = await loadMaplibre();
      if (gone || !box.current) return;
      const m = new Map({
        container: box.current,
        style: buildStyle(latest.current),
        center: SEOUL.center, zoom: SEOUL.zoom,
        minZoom: 6, maxZoom: 18,
        maxBounds: KOREA_BOUNDS,   // 한반도 남쪽 둘레
        dragRotate: false, pitchWithRotate: false, touchPitch: false,
        localIdeographFontFamily: HANGUL_FONT,
        attributionControl: { compact: true },
        fadeDuration: 200,
      });
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.touchZoomRotate.disableRotation();
      m.on("load", () => { ready.current = true; paint(m, latest.current); setMapReady(true); });
      // 빈 곳을 누르면 고른 것 해제 (마커를 누른 건 제외)
      m.on("click", (e) => { if (!e.originalEvent?.target?.closest?.("[data-place]")) setSelected(null); });
      m.on("error", (e) => { if (String(e?.error?.message || "").match(/fetch|network|Failed/i)) setFailed(true); });
      map.current = m;
    })();
    return () => { gone = true; ready.current = false; markers.current.clear(); map.current?.remove(); map.current = null; };
  }, []);

  // 공개 장소 불러오기 (끝난 행사·핀 없는 곳은 뺌) + 주소의 ?place= 로 시작
  useEffect(() => {
    let off = false;
    createClient().from("places").select(PLACE_FIELDS).eq("status", "published").not("lat", "is", null).order("name")
      .then(({ data }) => {
        if (off) return;
        const list = (data ?? []).filter((p) => !isOver(p));
        setPlaces(list);
        const want = new URLSearchParams(location.search).get("place");
        if (want && list.some((p) => p.slug === want)) setSelected(want);
      }, () => { if (!off) setPlaces([]); });
    return () => { off = true; };
  }, []);

  const all = places ?? [];
  const areas = useMemo(() => {
    const n = {};
    for (const p of all) if (p.area) n[p.area] = (n[p.area] ?? 0) + 1;
    return Object.keys(n).sort((a, b) => n[b] - n[a]);
  }, [all]);
  const shownPlaces = useMemo(() => all.filter((p) => (kind === "all" || p.kind === kind) && (area === "all" || p.area === area)), [all, kind, area]);
  const counts = useMemo(() => Object.fromEntries(["shop", "bar", "listening", "event"].map((k) => [k, all.filter((p) => p.kind === k).length])), [all]);
  const place = all.find((p) => p.slug === selected) ?? null;

  // 고르기: 지도 이동 + 주소에 남기기
  const pick = useCallback((slug) => setSelected((cur) => (cur === slug ? cur : slug)), []);
  useEffect(() => {
    const url = new URL(location.href);
    if (selected) url.searchParams.set("place", selected); else url.searchParams.delete("place");
    history.replaceState(history.state, "", url);
    const p = all.find((x) => x.slug === selected);
    const m = map.current;
    if (p && m && mapReady) m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15), duration: 900, essential: false });
  }, [selected, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 동네를 고르면 그 동네 장소들이 한눈에
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || area === "all") return;
    const pts = shownPlaces.map((p) => [p.lng, p.lat]);
    if (!pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 90, maxZoom: 15.5, duration: 900 });
  }, [area, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 마커: 보이는 장소만. 새로 생긴 건 만들고, 빠진 건 지움
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    (async () => {
      const { Marker } = await loadMaplibre();
      const want = new Set(shownPlaces.map((p) => p.slug));
      for (const [slug, it] of markers.current) if (!want.has(slug)) { it.marker.remove(); markers.current.delete(slug); }
      for (const p of shownPlaces) {
        if (markers.current.has(p.slug)) continue;
        const el = discMarker(p, kindOf(p.kind).color);
        el.addEventListener("click", (e) => { e.stopPropagation(); pick(p.slug); });
        el.addEventListener("pointerenter", () => setHover(p.slug));
        el.addEventListener("pointerleave", () => setHover(null));
        const marker = new Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(m);
        markers.current.set(p.slug, { marker, el });
      }
    })();
  }, [shownPlaces, mapReady, pick]);

  // 고른 것·올린 것 표시 (디스크가 커지고 돌고, 이름표가 뜸)
  useEffect(() => {
    for (const [slug, { el }] of markers.current) {
      el.dataset.on = String(slug === selected);
      el.dataset.hot = String(slug === hover);
      el.style.zIndex = slug === selected ? "3" : slug === hover ? "2" : "";
    }
  }, [selected, hover, shownPlaces]);


  // 테마가 바뀌면 칠만 다시 (스타일 전체를 다시 불러오지 않음)
  useEffect(() => { if (map.current && ready.current) paint(map.current, palette); }, [palette]);

  return (
    <ShownCtx.Provider value={shown}>
      <div className="mx-auto w-full max-w-[1600px] px-[clamp(16px,3.2vw,44px)] pb-16 pt-[calc(var(--ct-header-h,106px)+14px)] text-(--ink)">
        {/* 제목 줄 — Brick 과 같은 틀 */}
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-[3px] border-(--ink) pb-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <h1 className={`${SERIF} text-[clamp(2.2rem,4.2vw,3.8rem)] leading-[0.95]`}>Dig the city.</h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Lab · Map</p>
          </div>
          <p className="max-w-[46ch] break-keep text-[13px] leading-6 text-(--ink)/70 max-md:hidden">레코드숍, LP 바, 리스닝룸을 한 장의 지도에서 찾아요.</p>
          <p className="text-right text-[11px] uppercase tracking-[0.2em] text-(--ink)/65">
            <span className={`${SERIF} mr-3 text-[clamp(1.4rem,2.2vw,2rem)] normal-case tracking-normal text-(--ink)`}>Seoul</span>
            37.55° N · 126.99° E
          </p>
        </header>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)_280px] lg:items-start">
          {/* 가운데: 지도 — 가운데 세로선에서 양옆으로 펼쳐지며 등장 (Digging 커버 리빌과 같은 문법) */}
          <section aria-label="Map" className="lg:order-2">
            <div data-on={shown}
              className="relative h-[clamp(420px,calc(100svh-250px),900px)] border-2 border-(--ink) [clip-path:inset(0_50%_0_50%)] transition-[clip-path] duration-300 ease-[cubic-bezier(.22,1,.36,1)] data-[on=true]:[clip-path:inset(-2px)] data-[on=true]:duration-[1000ms] data-[on=true]:delay-150 motion-reduce:transition-none">
              {/* maplibre 가 컨테이너에 position:relative 를 덮어써서, 위치는 바깥 div 가 잡고 지도는 그 안을 꽉 채움 */}
              <div className="absolute inset-0" style={{ background: palette.land }}>
                <div ref={box} data-lenis-prevent data-crate-ignore className={`size-full ${MAP_CONTROLS} ${theme === "dark" ? MAP_CONTROLS_DARK : ""}`} />
              </div>
              {/* 종이 결 — 페이지와 같은 결·같은 섞기(soft-light)로 지도도 인쇄물처럼 */}
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-(image:--paper-texture-image) bg-[length:var(--paper-texture-size)_var(--paper-texture-size)] opacity-(--paper-texture-opacity) mix-blend-soft-light`} />
              {failed && (
                <p role="status" className="absolute inset-x-4 bottom-4 bg-(--cream) px-4 py-3 text-[13px] text-(--ink)/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,.5)]">지도 타일을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
              )}
            </div>
          </section>

          {/* 오른쪽: 상세 — 모바일에선 지도 바로 아래 (DOM 순서), 큰 화면에선 오른쪽 */}
          <section aria-label="Place detail" aria-live="polite" className="lg:order-3">
            <Heading n="02" title="Detail" />
            <PlaceDetail place={place} places={all} counts={counts} onPick={pick} onClose={() => setSelected(null)} />
          </section>

          {/* 왼쪽: 장소 목록 */}
          <section aria-label="Places" className="lg:order-1">
            <Heading n="01" title="Places" note={places ? `${shownPlaces.length} on the map` : ""} />
            <PlaceList places={shownPlaces} all={all} kind={kind} setKind={setKind} area={area} setArea={setArea} areas={areas}
              selected={selected} onPick={pick} onHover={setHover} loading={places === null} />
          </section>
        </div>
      </div>
    </ShownCtx.Provider>
  );
}

// 마커: 작은 바이닐 디스크 (라벨 색 = 종류). maplibre 가 바깥 요소의 transform 으로 위치를 잡아서
// 크기·회전은 안쪽 요소에. data-on(고름) / data-hot(올림)에 따라 커지고, 고르면 홈 빛이 돌고 이름표가 뜸
function discMarker(p, color) {
  const el = document.createElement("button");
  el.type = "button";
  el.dataset.place = p.slug;
  el.setAttribute("aria-label", p.name);
  el.className = "group block cursor-pointer";
  el.innerHTML = `
    <span class="relative grid size-7 place-items-center rounded-full bg-[#141113] shadow-[0_4px_10px_-2px_rgba(0,0,0,.55)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110 group-data-[hot=true]:scale-125 group-data-[on=true]:scale-[1.4]">
      <span class="absolute inset-0 rounded-full group-data-[on=true]:animate-[spin_1.8s_linear_infinite]" style="background:conic-gradient(from 0deg,transparent 0 18%,rgba(255,255,255,.22) 24%,transparent 30% 68%,rgba(255,255,255,.14) 74%,transparent 80%)"></span>
      <span class="absolute inset-[4px] rounded-full border border-white/10"></span>
      <span class="relative size-2.5 rounded-full ring-2 ring-[#141113]" style="background:${color}"></span>
    </span>
    <span class="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap bg-(--cream) px-2.5 py-1 text-[12px] font-medium text-(--ink) opacity-0 shadow-[0_6px_14px_-8px_rgba(0,0,0,.6)] transition-opacity duration-200 group-data-[hot=true]:opacity-100 group-data-[on=true]:opacity-100"></span>`;
  el.lastElementChild.textContent = p.name;   // 이름은 textContent 로 (HTML 로 해석되지 않게)
  return el;
}

function paint(m, p) {
  for (const [key, targets] of Object.entries(PAINT)) {
    for (const [layer, prop] of targets) {
      if (m.getLayer(layer)) m.setPaintProperty(layer, prop, p[key]);
    }
  }
}
