"use client";
// /lab/map — 바이닐 장소 지도. 우리 색으로 칠한 서울 지도 (색은 lib/map/style.js 에 고정)
// 공개 장소(places, status = published)를 바이닐 디스크 마커로. 고른 장소는 ?place=<slug> 로 주소에 남아서 링크로 공유 가능
// 구성 (2026-11-22 다시 짬 — 예전: 1600px 안의 세 칸(목록 · 지도 · 상세)이라 넓은 화면에서 지도가 작고 양옆이 비었음)
//  - 지도가 헤더 아래 화면 전체. 나머지는 그 위에 뜬 종이 카드
//  - 왼쪽 카드: 제목 + 트랙리스트 (동네 = 면, 장소 = 곡 — PlaceList) · 오른쪽 위: 종류 칩 · Open now, 그 아래 고른 장소 카드
//  - 휴대폰: 제목 · 칩은 위쪽 띠, 트랙리스트는 아래에서 여닫는 시트, 장소 카드는 그 위로 올라오는 시트
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PLACE_FIELDS, AREA_ROMAN, isOver, kindOf, hasKind, openState } from "@/lib/places";
import PlaceList, { MapFilters, Disc } from "./PlaceList";
import PlaceDetail, { NowOn, upcomingEvents } from "./PlaceDetail";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/lib/theme";
import useLabReveal from "@/components/lab/useLabReveal";
import GrooveText from "@/components/lab/GrooveText";
import { SERIF, ShownCtx, Reveal } from "@/components/lab/LabUI";
import { PALETTES, PAINT, SEOUL, buildStyle, nightPalette, isNight } from "@/lib/map/style";
import { loadMaplibre, HANGUL_FONT, KOREA_BOUNDS, MAP_CONTROLS, MAP_CONTROLS_DARK } from "@/lib/map/maplibre";



export default function MapStudio() {
  const shown = useLabReveal();
  const theme = useTheme() === "dark" ? "dark" : "light";
  const [failed, setFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [places, setPlaces] = useState(null);      // null = 불러오는 중
  const [kind, setKind] = useState("all");
  const [focus, setFocus] = useState(null);        // 트랙리스트에서 고른 동네 (지도가 그 동네로 감 — 목록을 거르지는 않음)
  const [listOpen, setListOpen] = useState(false); // 휴대폰: 트랙리스트 시트
  const [labels, setLabels] = useState(true);      // 마커 이름표를 늘 보일지 (줌을 많이 빼면 숨김)
  const leftRef = useRef(null), rightRef = useRef(null);
  const [selected, setSelected] = useState(null);  // slug
  const [hover, setHover] = useState(null);        // slug
  const [openOnly, setOpenOnly] = useState(false); // 지금 영업 중인 곳만
  const [now, setNow] = useState(() => new Date()); // 1분마다 → 영업 중 다시 계산
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const markers = useRef(new Map());               // "p:<slug>" | "c:<cluster id>" → { marker, el }
  const [markerTick, setMarkerTick] = useState(0); // 마커를 새로 만든 뒤 표시(고름·영업 중)를 다시 칠하려고

  // 밤(서울 18시–6시)엔 지도가 조금 어두워짐 — 1분마다 now 가 바뀌며 다시 판정
  const night = isNight(now);
  const palette = useMemo(() => (night ? nightPalette(PALETTES[theme], theme) : PALETTES[theme]), [theme, night]);
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
      m.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      m.touchZoomRotate.disableRotation();
      // 지도의 "가운데"를 카드에 가리지 않는 자리로: 넓은 화면은 양옆 카드만큼, 좁은 화면은 위 띠 · 아래 시트만큼 여백을 둠
      const pad = () => {
        const wide = matchMedia("(min-width: 1024px)").matches;
        m.setPadding(wide
          ? { left: (leftRef.current?.offsetWidth ?? 320) + 32, right: (rightRef.current?.offsetWidth ?? 340) + 32, top: 24, bottom: 24 }
          : { left: 0, right: 0, top: 120, bottom: 64 });
      };
      pad(); m.jumpTo({ center: SEOUL.center, zoom: SEOUL.zoom });
      m.on("resize", pad);
      m.on("zoom", () => setLabels(m.getZoom() >= 10.4));
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
  // 트랙리스트: 동네 = 면 (장소가 많은 동네부터 A · B · C …), 장소 = 곡 (A1 · A2 …). 번호는 전체 기준이라 필터를 바꿔도 그대로
  const album = useMemo(() => {
    const by = new Map();
    for (const p of all) { const a = p.area || "기타"; if (!by.has(a)) by.set(a, []); by.get(a).push(p); }
    const sides = [...by].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ko"))
      .map(([area, list], i) => ({ area, letter: String.fromCharCode(65 + (i % 26)), list }));
    const codes = {};
    for (const sd of sides) sd.list.forEach((p, i) => { codes[p.slug] = `${sd.letter}${i + 1}`; });
    return { sides, codes };
  }, [all]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  // 지금 영업 중인지 (판이 돌고 있으면 영업 중)
  const open = useMemo(() => Object.fromEntries(all.map((p) => [p.slug, openState(p, now)])), [all, now]);
  const openCount = Object.values(open).filter((o) => o.state === "open").length;
  const shownPlaces = useMemo(() => all.filter((p) => (kind === "all" || hasKind(p, kind))
    && (!openOnly || open[p.slug]?.state === "open")), [all, kind, openOnly, open]);
  const sides = useMemo(() => { const on = new Set(shownPlaces.map((p) => p.slug)); return album.sides.map((sd) => ({ ...sd, list: sd.list.filter((p) => on.has(p.slug)) })).filter((sd) => sd.list.length); }, [album, shownPlaces]);
  const events = useMemo(() => upcomingEvents(all), [all]);
  const counts = useMemo(() => Object.fromEntries(["shop", "bar", "listening", "event"].map((k) => [k, all.filter((p) => hasKind(p, k)).length])), [all]);
  const place = all.find((p) => p.slug === selected) ?? null;

  // 고르기: 지도 이동 + 주소에 남기기
  const pick = useCallback((slug) => { setListOpen(false); setSelected((cur) => (cur === slug ? cur : slug)); }, []);
  useEffect(() => {
    const url = new URL(location.href);
    if (selected) url.searchParams.set("place", selected); else url.searchParams.delete("place");
    history.replaceState(history.state, "", url);
    const p = all.find((x) => x.slug === selected);
    const m = map.current;
    if (p && m && mapReady) {
      m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15), duration: 900, essential: false });
      ripple(m, p, kindOf(p.kind).color);   // 판을 올리는 순간처럼 마커에서 홈이 퍼짐
    }
  }, [selected, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 처음 한 번: 올라온 장소가 모두 보이게 지도를 맞춤 (예전: 서울 한가운데 고정 → 서쪽 장소가 왼쪽 카드 밑에 들어갔음)
  const fitted = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (fitted.current || !m || !mapReady || !places?.length) return;
    fitted.current = true;
    if (new URLSearchParams(location.search).get("place")) return;
    const lngs = places.map((p) => p.lng), lats = places.map((p) => p.lat);
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 64, maxZoom: 13.5, duration: 0 });
  }, [places, mapReady]);

  // 면(동네) 이름을 누르면: 지도가 그 동네의 장소들이 한눈에 들어오게 가고, 동네 이름이 Monoton 줄무늬로 크게 잠깐 뜸
  const [flash, setFlash] = useState(null);
  const flashTimer = useRef(0);
  const focusArea = (area) => {
    setFocus(area); setListOpen(false);
    const f = { area, key: Date.now() };
    setFlash(f);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash((cur) => (cur?.key === f.key ? null : cur)), 2300);
    const m = map.current, pts = all.filter((p) => (p.area || "기타") === area).map((p) => [p.lng, p.lat]);
    if (!m || !mapReady || !pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 15.5, duration: 900 });
  };
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // 마커 + 클러스터: 보이는 장소를 GeoJSON(클러스터 켬)으로 넣고, 지도가 그린 결과대로 HTML 마커를 맞춤
  // 가까이 모인 곳은 줌을 빼면 "판 더미 + 숫자" 로 묶이고, 누르면 풀리는 줌까지 들어감 (줌 14 넘으면 항상 낱개)
  const placeBySlug = useRef(new Map());
  placeBySlug.current = new Map(shownPlaces.map((p) => [p.slug, p]));
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    let Marker = null;
    const sync = () => {
      if (!Marker || !m.getSource("places") || !m.isSourceLoaded("places")) return;
      const want = new Map();
      for (const f of m.querySourceFeatures("places")) {
        const pr = f.properties;
        if (pr.cluster) want.set(`c:${pr.cluster_id}`, { cluster: pr, at: f.geometry.coordinates });
        else if (placeBySlug.current.has(pr.slug)) want.set(`p:${pr.slug}`, { slug: pr.slug });
      }
      for (const [key, it] of markers.current) if (!want.has(key)) { it.marker.remove(); markers.current.delete(key); }
      let added = false;
      for (const [key, w] of want) {
        if (markers.current.has(key)) continue;
        let el, at;
        if (w.cluster) {
          el = clusterMarker(w.cluster.point_count);
          at = w.at;
          el.addEventListener("click", async (e) => {
            e.stopPropagation();
            const z = await m.getSource("places").getClusterExpansionZoom(w.cluster.cluster_id);
            m.easeTo({ center: at, zoom: z + 0.4, duration: 700 });
          });
        } else {
          const p = placeBySlug.current.get(w.slug);
          el = discMarker(p, kindOf(p.kind).color);
          at = [p.lng, p.lat];
          el.addEventListener("click", (e) => { e.stopPropagation(); pickRef.current(p.slug); });
          el.addEventListener("pointerenter", () => setHover(p.slug));
          el.addEventListener("pointerleave", () => setHover(null));
        }
        markers.current.set(key, { marker: new Marker({ element: el, anchor: "center" }).setLngLat(at).addTo(m), el });
        added = true;
      }
      if (added) setMarkerTick((t) => t + 1);
    };
    (async () => {
      ({ Marker } = await loadMaplibre());
      const data = { type: "FeatureCollection", features: shownPlaces.map((p) => ({ type: "Feature", properties: { slug: p.slug }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) };
      const src = m.getSource("places");
      if (src) src.setData(data);
      else {
        m.addSource("places", { type: "geojson", data, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 });
        // 보이지 않는 점 레이어 — 이게 있어야 지도가 places 소스를 계산함
        m.addLayer({ id: "places-anchor", type: "circle", source: "places", paint: { "circle-radius": 0, "circle-opacity": 0 } });
      }
      sync();
    })();
    m.on("render", sync);
    return () => { m.off("render", sync); };
  }, [shownPlaces, mapReady]);

  // 고른 것·올린 것 표시 (디스크가 커지고 돌고, 이름표가 뜸)
  useEffect(() => {
    for (const [key, { el }] of markers.current) {
      if (!key.startsWith("p:")) continue;
      const slug = key.slice(2);
      el.dataset.on = String(slug === selected);
      el.dataset.open = String(open[slug]?.state === "open");
      el.dataset.hot = String(slug === hover);
      const k = placeBySlug.current.get(slug)?.kind;
      el.dataset.glow = String(night && open[slug]?.state === "open" && (k === "bar" || k === "listening"));
      el.style.zIndex = slug === selected ? "3" : slug === hover ? "2" : "";
    }
  }, [selected, hover, open, markerTick, night]);


  // 테마가 바뀌면 칠만 다시 (스타일 전체를 다시 불러오지 않음)
  useEffect(() => { if (map.current && ready.current) paint(map.current, palette); }, [palette]);

  const CARD = "border-t-[3px] border-(--ink) bg-(--cream)/95 shadow-[0_22px_44px_-26px_rgba(0,0,0,.6)] backdrop-blur-[2px]";
  const filters = { kind, setKind, counts, total: all.length, openOnly, setOpenOnly, openCount };
  const emptyText = !all.length ? "아직 지도에 올라온 장소가 없어요." : openOnly ? "지금 문을 연 곳이 없어요. Open now 를 끄면 모든 장소가 보여요." : "이 조건에 맞는 장소가 없어요.";

  return (
    <ShownCtx.Provider value={shown}>
      {/* 무대: 헤더 아래 화면 전체가 지도 */}
      <div className="relative mt-[var(--ct-header-h,106px)] h-[calc(100svh-var(--ct-header-h,106px))] min-h-[520px] w-full overflow-hidden border-t-2 border-(--ink) text-(--ink)">
        {/* 지도 — 가운데 세로선에서 양옆으로 펼쳐지며 등장 (Digging 커버 리빌과 같은 문법) */}
        <section aria-label="Map" data-on={shown}
          className="absolute inset-0 [clip-path:inset(0_50%_0_50%)] transition-[clip-path] duration-300 ease-[cubic-bezier(.22,1,.36,1)] data-[on=true]:[clip-path:inset(0)] data-[on=true]:duration-[1000ms] data-[on=true]:delay-150 motion-reduce:transition-none">
          {/* maplibre 가 컨테이너에 position:relative 를 덮어써서, 위치는 바깥 div 가 잡고 지도는 그 안을 꽉 채움 */}
          <div className="absolute inset-0" style={{ background: palette.land }}>
            <div ref={box} data-labels={labels} data-lenis-prevent data-crate-ignore
              className={`size-full max-lg:[&_.maplibregl-ctrl-bottom-right]:bottom-14 ${MAP_CONTROLS} ${theme === "dark" ? MAP_CONTROLS_DARK : ""}`} />
          </div>
          {flash && (
            <div key={flash.key} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3] grid place-items-center animate-[area-flash_2.2s_ease_forwards] motion-reduce:hidden">
              <div className="grid place-items-center gap-2 rounded-full bg-[radial-gradient(closest-side,var(--cream)_35%,transparent)] px-16 py-10 text-(--ink)">
                <GrooveText className="text-[clamp(2.6rem,6vw,5.4rem)] leading-none">{AREA_ROMAN[flash.area] ?? flash.area}</GrooveText>
                {AREA_ROMAN[flash.area] && <span className="text-[14px] font-medium tracking-[0.3em]">{flash.area}</span>}
              </div>
            </div>
          )}
          {/* 종이 결 — 페이지와 같은 결·같은 섞기(soft-light)로 지도도 인쇄물처럼 */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--paper-texture-image) bg-[length:var(--paper-texture-size)_var(--paper-texture-size)] opacity-(--paper-texture-opacity) mix-blend-soft-light" />
          {failed && (
            <p role="status" className="absolute inset-x-4 bottom-20 z-[6] mx-auto max-w-md bg-(--cream) px-4 py-3 text-[13px] text-(--ink)/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,.5)]">지도 타일을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
          )}
        </section>

        {/* 왼쪽 카드: 제목 + 트랙리스트. 휴대폰: 제목은 위쪽 띠 · 트랙리스트는 아래 시트 (이 상자는 자리만 잡음) */}
        <div ref={leftRef} className={`pointer-events-none absolute inset-0 z-[4] lg:inset-y-4 lg:left-4 lg:right-auto lg:flex lg:w-[clamp(290px,23vw,360px)] lg:flex-col lg:border-t-[3px] lg:border-(--ink) lg:bg-(--cream)/95 lg:shadow-[0_22px_44px_-26px_rgba(0,0,0,.6)] lg:backdrop-blur-[2px]`}>
          <header className="pointer-events-auto max-lg:absolute max-lg:inset-x-0 max-lg:top-0 max-lg:bg-(--cream)/94 max-lg:px-4 max-lg:pb-2.5 max-lg:pt-3 max-lg:shadow-[0_14px_24px_-20px_rgba(0,0,0,.6)] lg:px-5 lg:pt-4">
            <Reveal i={0} className="flex items-baseline justify-between gap-3">
              <p className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Lab · Map</p>
              <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.16em] text-(--ink)/55">Seoul · 37.55° N</p>
            </Reveal>
            <Reveal i={1}><GrooveText as="h1" className="mt-1 text-[clamp(1.9rem,2.7vw,3rem)] leading-[1.02] max-lg:text-[1.7rem]">Dig the city.</GrooveText></Reveal>
            <Reveal as="p" i={2} className="mt-2 break-keep text-[13px] leading-6 text-(--ink)/75 max-lg:hidden">레코드숍, LP 바, 리스닝룸을 한 장의 지도에서 찾아요.</Reveal>
            {/* 휴대폰: 필터 칩이 제목 아래에 한 줄로 (옆으로 밀어 봄) */}
            <MapFilters {...filters} className="mt-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:hidden" />
          </header>

          <section aria-label="Places" data-open={listOpen}
            className="pointer-events-auto group/list flex min-h-0 flex-col max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-[18px] max-lg:bg-(--cream) max-lg:shadow-[0_-18px_40px_-22px_rgba(0,0,0,.6)] lg:mt-4 lg:flex-1">
            {/* 머리: 넓은 화면은 제목 줄, 휴대폰은 시트를 여닫는 버튼 */}
            <button type="button" onClick={() => setListOpen((v) => !v)} aria-expanded={listOpen}
              className="flex w-full items-baseline justify-between gap-3 border-y border-(--ink)/40 px-5 py-2.5 text-left max-lg:border-t-0 max-lg:px-4 max-lg:py-3.5 lg:pointer-events-none">
              <span className="flex items-baseline gap-2.5">
                <span className={`${SERIF} text-[1.15rem] leading-none`}>Tracklist</span>
                <span className="text-[11px] tracking-[0.04em] text-(--ink)/55">{places ? `${shownPlaces.length} place${shownPlaces.length === 1 ? "" : "s"} · ${openCount} open now` : "…"}</span>
              </span>
              <span aria-hidden="true" className="text-[12px] text-(--ink)/60 transition-transform group-data-[open=true]/list:rotate-180 lg:hidden">▲</span>
            </button>
            <div data-lenis-prevent data-crate-ignore
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-3 max-lg:hidden max-lg:max-h-[52svh] max-lg:px-4 max-lg:group-data-[open=true]/list:block">
              <PlaceList sides={sides} codes={album.codes} focus={focus} onFocus={focusArea} selected={selected} open={open}
                onPick={pick} onHover={setHover} loading={places === null} emptyText={emptyText} />
            </div>
            <p className="flex items-center gap-2 border-t border-dashed border-(--ink)/25 px-5 py-2.5 text-[11px] text-(--ink)/60 max-lg:hidden">
              <Disc color="#f4e7cd" spinning className="size-4" /> 돌고 있는 판 = 지금 영업 중
              {night && <span className="ml-auto inline-flex items-center gap-1 uppercase tracking-[0.16em]"><span aria-hidden="true">☾</span> After dark</span>}
            </p>
          </section>
        </div>

        {/* 오른쪽 위: 필터 칩 · 그 아래 고른 장소 카드 (고르기 전에는 열린 · 곧 열리는 행사가 있을 때만) */}
        <div ref={rightRef} className="pointer-events-none absolute right-4 top-4 bottom-24 z-[4] flex w-[clamp(300px,24vw,360px)] flex-col items-end gap-3 max-lg:hidden">
          <Reveal i={2} className="pointer-events-auto"><MapFilters {...filters} className="flex-wrap justify-end" /></Reveal>
          {(place || events.length > 0) && (
            <section aria-label="Place detail" aria-live="polite" data-lenis-prevent data-crate-ignore
              className={`pointer-events-auto min-h-0 w-full overflow-y-auto overscroll-contain px-5 pb-5 pt-4 ${CARD} animate-[sheet-up_.45s_cubic-bezier(.22,1,.36,1)] motion-reduce:animate-none`} key={place ? "place" : "now"}>
              {place ? <PlaceDetail place={place} open={open} code={album.codes[place.slug]} onClose={() => setSelected(null)} /> : <NowOn events={events} onPick={pick} />}
            </section>
          )}
        </div>

        {/* 휴대폰: 장소를 고르면 화면 아래에서 올라오는 시트 (트랙리스트 시트 위) */}
        {place && (
          <>
            <button type="button" aria-label="Close detail" onClick={() => setSelected(null)} className="fixed inset-0 z-30 bg-black/25 lg:hidden" />
            <section aria-label="Place detail" aria-live="polite" data-lenis-prevent data-crate-ignore
              className="fixed inset-x-0 bottom-0 z-40 max-h-[72svh] overflow-y-auto overscroll-contain rounded-t-[18px] bg-(--cream) px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_-20px_rgba(0,0,0,.55)] animate-[sheet-up_.45s_cubic-bezier(.22,1,.36,1)] lg:hidden">
              <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-(--ink)/25" />
              <PlaceDetail place={place} open={open} code={album.codes[place.slug]} onClose={() => setSelected(null)} />
            </section>
          </>
        )}
      </div>
    </ShownCtx.Provider>
  );
}

// 마커: 작은 바이닐 디스크 (라벨 색 = 종류). maplibre 가 바깥 요소의 transform 으로 위치를 잡아서
// 크기·회전은 안쪽 요소에. data-on(고름) / data-hot(올림)에 따라 커짐. data-open(지금 영업 중)이면 판이 돎
// 이름표는 늘 보임 (2026-11-22 — 예전에는 올리거나 골라야 떴음). 지도를 많이 빼면(지도 상자의 data-labels=false) 숨김
function discMarker(p, color) {
  const el = document.createElement("button");
  el.type = "button";
  el.dataset.place = p.slug;
  el.setAttribute("aria-label", p.name);
  el.className = "group block cursor-pointer";
  // 2번 종류부터: 판 가장자리에 작은 색 점 (예: 레코드숍 + 리스닝룸)
  const extra = (p.also ?? []).slice(0, 2).map((k, i) => `<span class="absolute ${i ? "-bottom-0.5 -right-0.5" : "-right-0.5 -top-0.5"} size-[9px] rounded-full ring-2 ring-[#141113]" style="background:${kindOf(k).color}"></span>`).join("");
  el.innerHTML = `
    <span class="pointer-events-none absolute left-1/2 top-1/2 size-[72px] rounded-full opacity-0 transition-opacity duration-700 group-data-[glow=true]:opacity-100 group-data-[glow=true]:animate-[glow-breathe_3.2s_ease-in-out_infinite]" style="transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,178,96,.6) 0%,rgba(255,140,60,.2) 42%,transparent 70%)"></span>
    <span class="relative grid size-9 place-items-center rounded-full bg-[#141113] shadow-[0_5px_12px_-2px_rgba(0,0,0,.6)] ring-1 ring-white/25 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110 group-data-[hot=true]:scale-[1.2] group-data-[on=true]:scale-[1.35]">
      <span class="absolute inset-0 rounded-full group-data-[open=true]:animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none!" style="background:conic-gradient(from 0deg,transparent 0 18%,rgba(255,255,255,.22) 24%,transparent 30% 68%,rgba(255,255,255,.14) 74%,transparent 80%)"></span>
      <span class="absolute inset-[5px] rounded-full border border-white/12"></span>
      <span class="relative size-3.5 rounded-full ring-2 ring-[#141113]" style="background:${color}"></span>
      ${extra}
    </span>
    <span class="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap bg-(--cream) px-2.5 py-1 text-[12px] font-medium text-(--ink) opacity-0 ring-1 ring-(--ink)/20 shadow-[0_6px_14px_-8px_rgba(0,0,0,.6)] transition-opacity duration-200 [[data-labels=true]_&]:opacity-90 group-data-[hot=true]:opacity-100 group-data-[on=true]:opacity-100"></span>`;
  el.lastElementChild.textContent = p.name;   // 이름은 textContent 로 (HTML 로 해석되지 않게)
  return el;
}

// 고를 때 마커 자리에서 레코드 홈 세 겹이 퍼졌다 사라짐 (지도 좌표에 붙어서 flyTo 동안 같이 움직임)
async function ripple(m, p, color) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { Marker } = await loadMaplibre();
  const el = document.createElement("div");
  el.className = "pointer-events-none relative size-0";
  el.innerHTML = [0, 1, 2].map((i) => `<span class="absolute left-1/2 top-1/2 size-24 rounded-full border-2 opacity-0 animate-[groove-ripple_1.5s_cubic-bezier(.22,1,.36,1)_forwards]" style="border-color:${color};animation-delay:${i * 180}ms"></span>`).join("");
  const mk = new Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(m);
  setTimeout(() => mk.remove(), 2100);
}

// 클러스터: 판 세 장이 겹친 더미 + 개수
function clusterMarker(count) {
  const el = document.createElement("button");
  el.type = "button";
  el.dataset.place = "cluster";
  el.setAttribute("aria-label", `${count} places — zoom in`);
  el.className = "group block cursor-pointer";
  el.innerHTML = `
    <span class="relative block size-11 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110">
      <span class="absolute inset-0 translate-x-[7px] -translate-y-[3px] rounded-full bg-[#141113] opacity-60"></span>
      <span class="absolute inset-0 translate-x-[3.5px] -translate-y-[1.5px] rounded-full bg-[#141113] opacity-80"></span>
      <span class="absolute inset-0 grid place-items-center rounded-full bg-[#141113] text-[13px] font-medium tabular-nums text-[#f4e7cd] shadow-[0_6px_14px_-4px_rgba(0,0,0,.6)]">
        <span class="absolute inset-[5px] rounded-full border border-white/10"></span>
        <span class="absolute inset-[10px] rounded-full border border-white/10"></span>
        <span class="relative"></span>
      </span>
    </span>`;
  el.querySelector("span > span:last-child > span:last-child").textContent = String(count);
  return el;
}

function paint(m, p) {
  for (const [key, targets] of Object.entries(PAINT)) {
    for (const [layer, prop] of targets) {
      if (m.getLayer(layer)) m.setPaintProperty(layer, prop, p[key]);
    }
  }
}
