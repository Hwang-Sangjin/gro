// Grooves 지도 스타일 — OpenFreeMap 벡터 타일(OpenMapTiles 스키마) 위에 우리 색을 직접 칠함
// 팔레트 키 하나가 여러 레이어 색을 맡음 (PAINT 표). 조절 패널은 이 키들을 바꿔 setPaintProperty 로 바로 반영.

export const TILES = "https://tiles.openfreemap.org/planet";
export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
// 처음 화면: 레코드숍이 몰린 마포(합정·망원)~성수 띠가 한눈에
export const SEOUL = { center: [126.985, 37.548], zoom: 12 };
export const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// 확정 색 (2026-10, 조절 패널로 맞춘 뒤 고정). 라이트 = 크림 종이 + 잉크, 다크 = 브라운 바탕 + 크림 글자
// 원칙: 바탕은 조용하게(마커가 주인공), 도로만 땅과 확실히 구분
export const PALETTES = {
  light: {
    land: "#f4e7cd",      // 바탕 (--cream)
    landuse: "#eddcbc",   // 주거·상업 — 동네 결이 보일 만큼만 진하게
    park: "#dcdcb8",      // 공원·숲
    water: "#b4c6d6",     // 물
    building: "#e3cfaa",  // 건물
    road: "#fffaf0",      // 도로 안쪽 — 땅보다 확실히 밝게
    roadCase: "#cdb794",  // 도로 테두리
    rail: "#b3a491",      // 철도·경계
    label: "#4c404a",     // 글자 (--ink)
  },
  dark: {
    land: "#4c404a",
    landuse: "#50434e",
    park: "#4a4d45",
    water: "#36414f",
    building: "#574955",
    road: "#64585f",      // 분홍기를 뺀 회갈색
    roadCase: "#3b3139",
    rail: "#776a72",
    label: "#f4e7cd",
  },
};

const LABELS = ["label-city", "label-district", "label-place-minor", "label-road", "label-water", "label-waterway"];

// 팔레트 키 → [레이어 id, paint 속성] (테마가 바뀌면 스타일을 다시 불러오지 않고 이 색만 바꿈)
export const PAINT = {
  land: [["background", "background-color"], ...LABELS.map((l) => [l, "text-halo-color"])],
  landuse: [["landuse", "fill-color"]],
  park: [["park", "fill-color"], ["landcover", "fill-color"]],
  water: [["water", "fill-color"], ["waterway", "line-color"]],
  building: [["building", "fill-color"]],
  road: [["road-minor", "line-color"], ["road-mid", "line-color"], ["road-major", "line-color"]],
  roadCase: [["road-mid-case", "line-color"], ["road-major-case", "line-color"], ["building", "fill-outline-color"]],
  rail: [["rail", "line-color"], ["boundary", "line-color"]],
  label: LABELS.map((l) => [l, "text-color"]),
};

const NAME = ["coalesce", ["get", "name:ko"], ["get", "name"]];
const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const z = (...stops) => ["interpolate", ["exponential", 1.6], ["zoom"], ...stops];
const cls = (...v) => ["match", ["get", "class"], v, true, false];

export function buildStyle(p) {
  return {
    version: 8,
    name: "Grooves",
    glyphs: GLYPHS,
    sources: { omt: { type: "vector", url: TILES } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": p.land } },
      { id: "landuse", type: "fill", source: "omt", "source-layer": "landuse",
        filter: cls("residential", "commercial", "retail", "industrial", "school", "university", "hospital"),
        paint: { "fill-color": p.landuse, "fill-opacity": z(10, 0.4, 14, 1) } },
      { id: "landcover", type: "fill", source: "omt", "source-layer": "landcover",
        filter: cls("wood", "grass", "farmland", "wetland"), paint: { "fill-color": p.park, "fill-opacity": 0.8 } },
      { id: "park", type: "fill", source: "omt", "source-layer": "park", paint: { "fill-color": p.park } },
      { id: "water", type: "fill", source: "omt", "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "fill-color": p.water } },
      { id: "waterway", type: "line", source: "omt", "source-layer": "waterway",
        filter: ["!=", ["get", "brunnel"], "tunnel"], paint: { "line-color": p.water, "line-width": z(10, 0.6, 16, 3) } },
      { id: "building", type: "fill", source: "omt", "source-layer": "building", minzoom: 14,
        paint: { "fill-color": p.building, "fill-outline-color": p.roadCase, "fill-opacity": z(14, 0, 15, 1) } },
      { id: "rail", type: "line", source: "omt", "source-layer": "transportation", minzoom: 12,
        filter: ["all", cls("rail", "transit"), ["!=", ["get", "brunnel"], "tunnel"]],
        paint: { "line-color": p.rail, "line-width": z(12, 0.6, 18, 2), "line-dasharray": [3, 2] } },
      // 도로: 테두리 먼저 깔고 안쪽을 위에. 작은 길은 테두리 없이 얇게
      { id: "road-minor", type: "line", source: "omt", "source-layer": "transportation", minzoom: 13,
        filter: cls("minor", "service"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.road, "line-width": z(13, 0.6, 18, 9) } },
      { id: "road-mid-case", type: "line", source: "omt", "source-layer": "transportation", minzoom: 11,
        filter: cls("secondary", "tertiary"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.roadCase, "line-width": z(11, 1.2, 18, 16) } },
      { id: "road-mid", type: "line", source: "omt", "source-layer": "transportation", minzoom: 11,
        filter: cls("secondary", "tertiary"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.road, "line-width": z(11, 0.6, 18, 13) } },
      { id: "road-major-case", type: "line", source: "omt", "source-layer": "transportation",
        filter: cls("motorway", "trunk", "primary"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.roadCase, "line-width": z(8, 0.8, 18, 22) } },
      { id: "road-major", type: "line", source: "omt", "source-layer": "transportation",
        filter: cls("motorway", "trunk", "primary"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": p.road, "line-width": z(8, 0.4, 18, 18) } },
      { id: "boundary", type: "line", source: "omt", "source-layer": "boundary",
        filter: ["<=", ["get", "admin_level"], 4], paint: { "line-color": p.rail, "line-width": 1, "line-dasharray": [2, 2], "line-opacity": 0.6 } },
      // 글자: 한국어 이름 우선. 한글은 브라우저 글꼴(함렛)로 그림 — MapLibre localIdeographFontFamily
      { id: "label-water", type: "symbol", source: "omt", "source-layer": "water_name",
        layout: { "text-field": NAME, "text-font": FONT, "text-size": 12, "text-letter-spacing": 0.2 },
        paint: { "text-color": p.label, "text-opacity": 0.6, "text-halo-color": p.land, "text-halo-width": 1.4 } },
      { id: "label-road", type: "symbol", source: "omt", "source-layer": "transportation_name", minzoom: 14,
        layout: { "symbol-placement": "line", "text-field": NAME, "text-font": FONT, "text-size": z(14, 10, 18, 13) },
        paint: { "text-color": p.label, "text-opacity": 0.75, "text-halo-color": p.land, "text-halo-width": 1.6 } },
      // 강 이름은 waterway 줄기에 들어 있어서 강을 따라 흐르게
      { id: "label-waterway", type: "symbol", source: "omt", "source-layer": "waterway", minzoom: 10,
        filter: cls("river"),
        layout: { "symbol-placement": "line", "symbol-spacing": 420, "text-field": NAME, "text-font": FONT, "text-size": z(10, 12, 15, 16), "text-letter-spacing": 0.4 },
        paint: { "text-color": p.label, "text-opacity": 0.55, "text-halo-color": p.land, "text-halo-width": 1.4 } },
      // 동·마을 (줌을 당기면)
      { id: "label-place-minor", type: "symbol", source: "omt", "source-layer": "place", minzoom: 13,
        filter: cls("quarter", "neighbourhood"),
        layout: { "text-field": NAME, "text-font": FONT, "text-size": z(13, 11, 17, 14), "text-padding": 6 },
        paint: { "text-color": p.label, "text-opacity": 0.7, "text-halo-color": p.land, "text-halo-width": 1.6 } },
      // 구·큰 동네 — 이 지도의 기준 단위라 일찍 보이게
      { id: "label-district", type: "symbol", source: "omt", "source-layer": "place", minzoom: 10.5, maxzoom: 15,
        filter: cls("borough", "suburb"),
        layout: { "text-field": NAME, "text-font": FONT_BOLD, "text-size": z(10.5, 11, 14, 15), "text-letter-spacing": 0.06, "text-padding": 8 },
        paint: { "text-color": p.label, "text-opacity": 0.85, "text-halo-color": p.land, "text-halo-width": 1.8 } },
      // 도시 이름은 멀리서 볼 때만 (서울 안으로 들어오면 숨김)
      { id: "label-city", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 10.5,
        filter: cls("city", "town"),
        layout: { "text-field": NAME, "text-font": FONT_BOLD, "text-size": z(6, 12, 10, 18), "text-letter-spacing": 0.08 },
        paint: { "text-color": p.label, "text-halo-color": p.land, "text-halo-width": 2 } },
    ],
  };
}
