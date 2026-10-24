"use client";
// 관리자 장소 지도: 클릭하거나 핀을 끌어서 위치를 정함. 값이 밖에서 바뀌면(카카오 검색) 그 자리로 날아감
import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/lib/theme";
import { PALETTES, PAINT, SEOUL, buildStyle } from "@/lib/map/style";
import { loadMaplibre, HANGUL_FONT, KOREA_BOUNDS } from "@/lib/map/maplibre";

const has = (v) => Number.isFinite(v) && v !== 0;

export default function MapPicker({ lat, lng, color = "#2d6a6a", onPick, className = "" }) {
  const theme = useTheme() === "dark" ? "dark" : "light";
  const box = useRef(null);
  const map = useRef(null);
  const pin = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const start = useRef({ lat, lng, theme });

  useEffect(() => {
    let gone = false;
    (async () => {
      const { Map, Marker, NavigationControl } = await loadMaplibre();
      if (gone || !box.current) return;
      const s = start.current;
      const placed = has(s.lat) && has(s.lng);
      const m = new Map({
        container: box.current,
        style: buildStyle(PALETTES[s.theme]),
        center: placed ? [s.lng, s.lat] : SEOUL.center,
        zoom: placed ? 16 : SEOUL.zoom,
        minZoom: 6, maxZoom: 19, maxBounds: KOREA_BOUNDS,
        dragRotate: false, pitchWithRotate: false, touchPitch: false,
        localIdeographFontFamily: HANGUL_FONT,
        attributionControl: { compact: true },
      });
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      // 핀: 작은 바이닐 디스크 (라벨 색 = 장소 종류 색)
      const el = document.createElement("div");
      el.className = "size-6 rounded-full bg-[#141113] shadow-[0_3px_8px_rgba(0,0,0,.45)] grid place-items-center cursor-grab";
      el.innerHTML = '<span class="size-2.5 rounded-full ring-2 ring-[#141113]" data-label></span>';
      el.querySelector("[data-label]").style.background = color;
      const mk = new Marker({ element: el, draggable: true }).setLngLat(placed ? [s.lng, s.lat] : SEOUL.center);
      if (placed) mk.addTo(m);
      mk.on("dragend", () => { const p = mk.getLngLat(); pick.current?.({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) }); });
      m.on("click", (e) => {
        mk.setLngLat(e.lngLat).addTo(m);
        pick.current?.({ lat: +e.lngLat.lat.toFixed(6), lng: +e.lngLat.lng.toFixed(6) });
      });
      map.current = m; pin.current = mk;
    })();
    return () => { gone = true; map.current?.remove(); map.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 밖에서 좌표가 바뀌면(검색 결과 고름) 핀을 옮기고 그쪽으로
  useEffect(() => {
    const m = map.current, mk = pin.current;
    if (!m || !mk || !has(lat) || !has(lng)) return;
    const cur = mk.getLngLat();
    if (Math.abs(cur.lat - lat) < 1e-6 && Math.abs(cur.lng - lng) < 1e-6 && mk._map) return;
    mk.setLngLat([lng, lat]).addTo(m);
    m.flyTo({ center: [lng, lat], zoom: Math.max(m.getZoom(), 16), duration: 900 });
  }, [lat, lng]);

  // 종류가 바뀌면 핀 라벨 색
  useEffect(() => {
    const dot = pin.current?.getElement().querySelector("[data-label]");
    if (dot) dot.style.background = color;
  }, [color]);

  // 테마
  useEffect(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;
    for (const [key, targets] of Object.entries(PAINT)) for (const [layer, prop] of targets) if (m.getLayer(layer)) m.setPaintProperty(layer, prop, PALETTES[theme][key]);
  }, [theme]);

  return <div ref={box} data-lenis-prevent className={`overflow-hidden rounded-xl border border-(--ink)/20 ${className}`} />;
}
