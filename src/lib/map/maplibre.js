// MapLibre 를 브라우저에서만 불러오고 worker 위치를 한 번만 정함 (Lab Map · 관리자 장소 지도 공용)
// worker 파일은 predev/prebuild 가 public/maplibre/ 로 복사 (scripts/copy-maplibre-worker.mjs)
const WORKER = "/maplibre/maplibre-gl-worker.mjs";
export const HANGUL_FONT = "'Hahmlet', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
export const KOREA_BOUNDS = [[123.5, 32.5], [132.5, 39.5]];

let ready = null;
export function loadMaplibre() {
  ready ??= import("maplibre-gl").then((m) => {
    m.setWorkerUrl(new URL(WORKER, location.origin).href);
    return m;
  });
  return ready;
}
