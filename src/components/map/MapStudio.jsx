"use client";
// /lab/map — 바이닐 장소 지도. 우리 색으로 칠한 서울 지도 (색은 lib/map/style.js 에 고정)
// 다음 단계: 장소 데이터 → 마커 · 왼쪽 목록(01 Places) · 오른쪽 상세(02 Detail)
import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/lib/theme";
import useLabReveal from "@/components/lab/useLabReveal";
import { SERIF, ShownCtx, Reveal, Heading } from "@/components/lab/LabUI";
import { PALETTES, PAINT, SEOUL, buildStyle } from "@/lib/map/style";

const WORKER = "/maplibre/maplibre-gl-worker.mjs";
const HANGUL_FONT = "'Hahmlet', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

// MapLibre 컨트롤(확대·축소, 출처 표기)을 사이트 톤으로 (다크 테마에선 아이콘을 뒤집음 — DARK_CONTROLS)
const CONTROLS = [
  // MapLibre 기본 CSS 가 더 구체적이라 ! 로 덮음
  "[&_.maplibregl-ctrl-group]:rounded-none! [&_.maplibregl-ctrl-group]:border-2! [&_.maplibregl-ctrl-group]:border-(--ink)! [&_.maplibregl-ctrl-group]:bg-(--cream)! [&_.maplibregl-ctrl-group]:shadow-none!",
  "[&_.maplibregl-ctrl-group_button+button]:border-t-(--ink)/30!",
  "[&_.maplibregl-ctrl-attrib]:rounded-none! [&_.maplibregl-ctrl-attrib]:bg-(--cream)/85! [&_.maplibregl-ctrl-attrib]:text-[10px] [&_.maplibregl-ctrl-attrib]:text-(--ink)/70! [&_.maplibregl-ctrl-attrib_a]:text-(--ink)/70!",
].join(" ");
const DARK_CONTROLS = "[&_.maplibregl-ctrl-icon]:invert [&_.maplibregl-ctrl-attrib-button]:invert";

export default function MapStudio() {
  const shown = useLabReveal();
  const theme = useTheme() === "dark" ? "dark" : "light";
  const [failed, setFailed] = useState(false);
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);

  const palette = PALETTES[theme];
  const latest = useRef(palette);
  latest.current = palette;

  // 지도 만들기 (브라우저에서만 maplibre 불러옴)
  useEffect(() => {
    let gone = false;
    (async () => {
      const { Map, NavigationControl, setWorkerUrl } = await import("maplibre-gl");
      setWorkerUrl(new URL(WORKER, location.origin).href);   // public/maplibre/ (scripts/copy-maplibre-worker.mjs)
      if (gone || !box.current) return;
      const m = new Map({
        container: box.current,
        style: buildStyle(latest.current),
        center: SEOUL.center, zoom: SEOUL.zoom,
        minZoom: 6, maxZoom: 18,
        maxBounds: [[123.5, 32.5], [132.5, 39.5]],   // 한반도 남쪽 둘레
        dragRotate: false, pitchWithRotate: false, touchPitch: false,
        localIdeographFontFamily: HANGUL_FONT,
        attributionControl: { compact: true },
        fadeDuration: 200,
      });
      m.addControl(new NavigationControl({ showCompass: false }), "top-right");
      m.touchZoomRotate.disableRotation();
      m.on("load", () => { ready.current = true; paint(m, latest.current); });
      m.on("error", (e) => { if (String(e?.error?.message || "").match(/fetch|network|Failed/i)) setFailed(true); });
      map.current = m;
    })();
    return () => { gone = true; ready.current = false; map.current?.remove(); map.current = null; };
  }, []);

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
                <div ref={box} data-lenis-prevent data-crate-ignore className={`size-full ${CONTROLS} ${theme === "dark" ? DARK_CONTROLS : ""}`} />
              </div>
              {/* 종이 결 — 페이지와 같은 결·같은 섞기(soft-light)로 지도도 인쇄물처럼 */}
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-(image:--paper-texture-image) bg-[length:var(--paper-texture-size)_var(--paper-texture-size)] opacity-(--paper-texture-opacity) mix-blend-soft-light`} />
              {failed && (
                <p role="status" className="absolute inset-x-4 bottom-4 bg-(--cream) px-4 py-3 text-[13px] text-(--ink)/80 shadow-[0_8px_20px_-12px_rgba(0,0,0,.5)]">지도 타일을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
              )}
            </div>
          </section>

          {/* 왼쪽: 장소 (3단계에서 채움) */}
          <section aria-label="Places" className="lg:order-1">
            <Heading n="01" title="Places" note="준비 중" />
            <Reveal i={1} className="grid gap-3 py-2 text-[13px] leading-6 text-(--ink)/65">
              <p className="break-keep">레코드숍, LP 바·카페, 리스닝룸, 페어·팝업을 여기에서 고르게 될 거예요.</p>
              <ul className="grid gap-1.5">
                {["Shops", "Bars", "Listening", "Events"].map((t) => (
                  <li key={t} className={`${SERIF} border-b border-dashed border-(--ink)/25 pb-1.5 text-[1.3rem] leading-none text-(--ink)/35`}>{t}</li>
                ))}
              </ul>
            </Reveal>
          </section>

          {/* 오른쪽: 상세 (아무것도 안 고르면 Now on — 지금 열린 페어·팝업 + 범례, 장소를 고르면 장소 카드) */}
          <section aria-label="Place detail" className="lg:order-3">
            <Heading n="02" title="Detail" note="준비 중" />
            <Reveal i={1} className="grid gap-3 py-2 text-[13px] leading-6 text-(--ink)/65">
              <p className="break-keep">지도에서 장소를 고르면 주소, 영업시간, 잘 맞는 장르와 한 줄 소개가 여기에 떠요. 고르기 전에는 지금 열린 페어·팝업을 보여 줄 거예요.</p>
            </Reveal>
          </section>
        </div>
      </div>
    </ShownCtx.Provider>
  );
}

function paint(m, p) {
  for (const [key, targets] of Object.entries(PAINT)) {
    for (const [layer, prop] of targets) {
      if (m.getLayer(layer)) m.setPaintProperty(layer, prop, p[key]);
    }
  }
}
