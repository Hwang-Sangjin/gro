"use client";
// /lab/map — 바이닐 장소 지도. 우리 색으로 칠한 서울 지도 (색은 lib/map/style.js 에 고정)
// 공개 장소(places, status = published)를 바이닐 디스크 마커로. 왼쪽 01 Places(필터·목록) · 오른쪽 02 Detail
// 고른 장소는 ?place=<slug> 로 주소에 남아서 링크로 공유 가능
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PLACE_FIELDS, AREA_ROMAN, isOver, kindOf, openState } from "@/lib/places";
import PlaceList from "./PlaceList";
import PlaceDetail from "./PlaceDetail";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/lib/theme";
import useLabReveal from "@/components/lab/useLabReveal";
import GrooveText from "@/components/lab/GrooveText";
import { SERIF, ShownCtx, Heading } from "@/components/lab/LabUI";
import { PALETTES, PAINT, SEOUL, buildStyle, nightPalette, isNight } from "@/lib/map/style";
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
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  // 지금 영업 중인지 (판이 돌고 있으면 영업 중)
  const open = useMemo(() => Object.fromEntries(all.map((p) => [p.slug, openState(p, now)])), [all, now]);
  const openCount = Object.values(open).filter((o) => o.state === "open").length;
  const shownPlaces = useMemo(() => all.filter((p) => (kind === "all" || p.kind === kind) && (area === "all" || p.area === area)
    && (!openOnly || open[p.slug]?.state === "open")), [all, kind, area, openOnly, open]);
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
    if (p && m && mapReady) {
      m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15), duration: 900, essential: false });
      ripple(m, p, kindOf(p.kind).color);   // 판을 올리는 순간처럼 마커에서 홈이 퍼짐
    }
  }, [selected, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // 동네를 고르면 지도 위에 동네 이름이 Monoton 줄무늬로 크게 잠깐
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (area === "all") return;
    const f = { area, key: Date.now() };
    setFlash(f);
    const t = setTimeout(() => setFlash((cur) => (cur?.key === f.key ? null : cur)), 2300);
    return () => clearTimeout(t);
  }, [area]);

  // 동네를 고르면 그 동네 장소들이 한눈에
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || area === "all") return;
    const pts = shownPlaces.map((p) => [p.lng, p.lat]);
    if (!pts.length) return;
    const lngs = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 90, maxZoom: 15.5, duration: 900 });
  }, [area, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <ShownCtx.Provider value={shown}>
      <div className="mx-auto w-full max-w-[1600px] px-[clamp(16px,3.2vw,44px)] pb-16 pt-[calc(var(--ct-header-h,106px)+14px)] text-(--ink)">
        {/* 제목 줄 — Brick 과 같은 틀 */}
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-[3px] border-(--ink) pb-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <GrooveText as="h1" className="text-[clamp(2.1rem,4vw,3.6rem)] leading-[1.05]">Dig the city.</GrooveText>
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
              {/* 커서: 지도 위에선 톤암, 판(마커) 위에선 바늘이 내려앉은 톤암 (사이트 원형 커서는 여기서 숨김 — data-own-cursor) */}
              <div className="absolute inset-0" data-own-cursor style={{ background: palette.land, "--arm": ARM_CURSOR, "--arm-down": ARM_DOWN_CURSOR }}>
                <div ref={box} data-lenis-prevent data-crate-ignore className={`size-full ${MAP_CONTROLS} ${theme === "dark" ? MAP_CONTROLS_DARK : ""} [&_.maplibregl-canvas-container.maplibregl-interactive]:[cursor:var(--arm)]! [&_.maplibregl-canvas-container.maplibregl-interactive:active]:cursor-grabbing! [&_[data-place]]:[cursor:var(--arm-down)]!`} />
              </div>
              {night && (
                <span className="pointer-events-none absolute left-3 top-3 z-[2] inline-flex items-center gap-1.5 bg-(--cream)/85 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-(--ink)/80">
                  <span aria-hidden="true">☾</span> After dark
                </span>
              )}
              {flash && (
                <div key={flash.key} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3] grid place-items-center animate-[area-flash_2.2s_ease_forwards] motion-reduce:hidden">
                  <div className="grid place-items-center gap-2 rounded-full bg-[radial-gradient(closest-side,var(--cream)_35%,transparent)] px-16 py-10 text-(--ink)">
                    <GrooveText className="text-[clamp(2.6rem,6vw,5.4rem)] leading-none">{AREA_ROMAN[flash.area] ?? flash.area}</GrooveText>
                    {AREA_ROMAN[flash.area] && <span className="text-[14px] font-medium tracking-[0.3em]">{flash.area}</span>}
                  </div>
                </div>
              )}
              {/* 종이 결 — 페이지와 같은 결·같은 섞기(soft-light)로 지도도 인쇄물처럼 */}
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-(image:--paper-texture-image) bg-[length:var(--paper-texture-size)_var(--paper-texture-size)] opacity-(--paper-texture-opacity) mix-blend-soft-light`} />
              {failed && (
                <p role="status" className="absolute inset-x-4 bottom-4 bg-(--cream) px-4 py-3 text-[13px] text-(--ink)/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,.5)]">지도 타일을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
              )}
            </div>
          </section>

          {/* 오른쪽: 상세 — 모바일에선 지도 바로 아래 (DOM 순서), 큰 화면에선 오른쪽 */}
          {/* 모바일: 장소를 고르면 화면 아래에서 올라오는 시트 (지도 위). 큰 화면에선 오른쪽 칸 그대로 */}
          {place && <button type="button" aria-label="Close detail" onClick={() => setSelected(null)} className="fixed inset-0 z-30 bg-black/25 lg:hidden" />}
          <section aria-label="Place detail" aria-live="polite" data-sheet={Boolean(place)} data-lenis-prevent data-crate-ignore
            className="lg:order-3 max-lg:data-[sheet=true]:fixed max-lg:data-[sheet=true]:inset-x-0 max-lg:data-[sheet=true]:bottom-0 max-lg:data-[sheet=true]:z-40 max-lg:data-[sheet=true]:max-h-[72svh] max-lg:data-[sheet=true]:overflow-y-auto max-lg:data-[sheet=true]:overscroll-contain max-lg:data-[sheet=true]:rounded-t-[18px] max-lg:data-[sheet=true]:bg-(--cream) max-lg:data-[sheet=true]:px-5 max-lg:data-[sheet=true]:pb-[calc(24px+env(safe-area-inset-bottom))] max-lg:data-[sheet=true]:pt-3 max-lg:data-[sheet=true]:shadow-[0_-18px_40px_-20px_rgba(0,0,0,.55)] max-lg:data-[sheet=true]:animate-[sheet-up_.45s_cubic-bezier(.22,1,.36,1)]">
            {place && <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded-full bg-(--ink)/25 lg:hidden" />}
            <Heading n="02" title="Detail" />
            <PlaceDetail place={place} places={all} counts={counts} open={open} onPick={pick} onClose={() => setSelected(null)} />
          </section>

          {/* 왼쪽: 장소 목록 */}
          <section aria-label="Places" className="lg:order-1">
            <Heading n="01" title="Places" note={places ? `${shownPlaces.length} on the map` : ""} />
            <PlaceList places={shownPlaces} all={all} kind={kind} setKind={setKind} area={area} setArea={setArea} areas={areas}
              selected={selected} open={open} openOnly={openOnly} setOpenOnly={setOpenOnly} openCount={openCount} onPick={pick} onHover={setHover} loading={places === null} />
          </section>
        </div>
      </div>
    </ShownCtx.Provider>
  );
}

// 마커: 작은 바이닐 디스크 (라벨 색 = 종류). maplibre 가 바깥 요소의 transform 으로 위치를 잡아서
// 크기·회전은 안쪽 요소에. data-on(고름) / data-hot(올림)에 따라 커지고 이름표가 뜸. data-open(지금 영업 중)이면 판이 돎
function discMarker(p, color) {
  const el = document.createElement("button");
  el.type = "button";
  el.dataset.place = p.slug;
  el.setAttribute("aria-label", p.name);
  el.className = "group block cursor-pointer";
  el.innerHTML = `
    <span class="pointer-events-none absolute left-1/2 top-1/2 size-[72px] rounded-full opacity-0 transition-opacity duration-700 group-data-[glow=true]:opacity-100 group-data-[glow=true]:animate-[glow-breathe_3.2s_ease-in-out_infinite]" style="transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,178,96,.6) 0%,rgba(255,140,60,.2) 42%,transparent 70%)"></span>
    <span class="relative grid size-7 place-items-center rounded-full bg-[#141113] shadow-[0_4px_10px_-2px_rgba(0,0,0,.55)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110 group-data-[hot=true]:scale-125 group-data-[on=true]:scale-[1.4]">
      <span class="absolute inset-0 rounded-full group-data-[open=true]:animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none!" style="background:conic-gradient(from 0deg,transparent 0 18%,rgba(255,255,255,.22) 24%,transparent 30% 68%,rgba(255,255,255,.14) 74%,transparent 80%)"></span>
      <span class="absolute inset-[4px] rounded-full border border-white/10"></span>
      <span class="relative size-2.5 rounded-full ring-2 ring-[#141113]" style="background:${color}"></span>
    </span>
    <span class="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap bg-(--cream) px-2.5 py-1 text-[12px] font-medium text-(--ink) opacity-0 shadow-[0_6px_14px_-8px_rgba(0,0,0,.6)] transition-opacity duration-200 group-data-[hot=true]:opacity-100 group-data-[on=true]:opacity-100"></span>`;
  el.lastElementChild.textContent = p.name;   // 이름은 textContent 로 (HTML 로 해석되지 않게)
  return el;
}

// 톤암 커서 (32px, 바늘 끝 = 4,28). 크림 테두리 위에 잉크 선이라 밝은·어두운 지도 둘 다에서 보임
const armSvg = (down) => `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'>
<g fill='none' stroke-linecap='round' stroke-linejoin='round'>
<path d='M25 6 L${down ? "11 21" : "12 19"}' stroke='%23f4e7cd' stroke-width='5'/><path d='M25 6 L${down ? "11 21" : "12 19"}' stroke='%232a222a' stroke-width='2'/>
</g>
<circle cx='25' cy='6' r='4' fill='%23f4e7cd' stroke='%232a222a' stroke-width='1.6'/><circle cx='25' cy='6' r='1.3' fill='%232a222a'/>
<g transform='rotate(${down ? 40 : 18} ${down ? 8 : 9} ${down ? 24 : 22})'><rect x='${down ? 4.5 : 5.5}' y='${down ? 20.5 : 18.5}' width='7' height='7' rx='1.2' fill='%23f4e7cd' stroke='%232a222a' stroke-width='1.6'/></g>
<path d='M${down ? "6 25.5 L4 28" : "7 24.5 L5 27"}' stroke='%232a222a' stroke-width='1.6' stroke-linecap='round'/>
${down ? "<path d='M1.5 30.5 A6 3 0 0 1 9 30' fill='none' stroke='%232a222a' stroke-width='1' stroke-opacity='.6'/>" : ""}
</svg>`.replace(/\n/g, "").replace(/"/g, "'");
const ARM_CURSOR = `url("data:image/svg+xml;utf8,${armSvg(false)}") 5 27, grab`;
const ARM_DOWN_CURSOR = `url("data:image/svg+xml;utf8,${armSvg(true)}") 4 28, pointer`;

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
