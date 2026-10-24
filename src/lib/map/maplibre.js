// MapLibre 를 브라우저에서만 불러오고 worker 위치를 한 번만 정함 (Lab Map · 관리자 장소 지도 공용)
// worker 파일은 predev/prebuild 가 public/maplibre/ 로 복사 (scripts/copy-maplibre-worker.mjs)
const WORKER = "/maplibre/maplibre-gl-worker.mjs";
export const HANGUL_FONT = "'Hahmlet', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
export const KOREA_BOUNDS = [[123.5, 32.5], [132.5, 39.5]];

// MapLibre 컨트롤(확대·축소, 출처 표기)을 사이트 톤으로 (다크 테마에선 아이콘을 뒤집음 — MAP_CONTROLS_DARK)
export const MAP_CONTROLS = [
  // MapLibre 기본 CSS 가 더 구체적이라 ! 로 덮음
  "[&_.maplibregl-ctrl-group]:rounded-none! [&_.maplibregl-ctrl-group]:border-2! [&_.maplibregl-ctrl-group]:border-(--ink)! [&_.maplibregl-ctrl-group]:bg-(--cream)! [&_.maplibregl-ctrl-group]:shadow-none!",
  "[&_.maplibregl-ctrl-group_button+button]:border-t-(--ink)/30!",
  "[&_.maplibregl-ctrl-attrib]:rounded-none! [&_.maplibregl-ctrl-attrib]:bg-(--cream)/85! [&_.maplibregl-ctrl-attrib]:text-[10px] [&_.maplibregl-ctrl-attrib]:text-(--ink)/70! [&_.maplibregl-ctrl-attrib_a]:text-(--ink)/70!",
].join(" ");
export const MAP_CONTROLS_DARK = "[&_.maplibregl-ctrl-icon]:invert [&_.maplibregl-ctrl-attrib-button]:invert";

let ready = null;
export function loadMaplibre() {
  ready ??= import("maplibre-gl").then((m) => {
    m.setWorkerUrl(new URL(WORKER, location.origin).href);
    return m;
  });
  return ready;
}
