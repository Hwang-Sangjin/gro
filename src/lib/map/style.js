// Grooves 지도 스타일 — OpenFreeMap 벡터 타일(OpenMapTiles 스키마) 위에 우리 색을 직접 칠함
// 팔레트 키 하나가 여러 레이어 색을 맡음 (PAINT 표). 조절 패널은 이 키들을 바꿔 setPaintProperty 로 바로 반영.

export const TILES = "https://tiles.openfreemap.org/planet";
export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const SEOUL = { center: [126.99, 37.55], zoom: 11.6 };
export const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// 사이트 토큰에서 고른 색. 라이트 = 크림 종이 + 잉크, 다크 = 브라운 바탕 + 크림 글자 (사이트 테마와 같이 뒤집힘)
export const PALETTES = {
  light: {
    land: "#f4e7cd",      // 바탕 (--cream)
    landuse: "#eedfc2",   // 주거·상업 지역 — 바탕보다 아주 살짝 진하게
    park: "#dfdcbc",      // 공원·숲
    water: "#bbcbda",     // 물 (사이트 frame 색)
    building: "#e6d4b1",  // 건물
    road: "#fbf4e4",      // 도로 안쪽
    roadCase: "#d8c4a2",  // 도로 테두리
    rail: "#a8998c",      // 철도
    label: "#4c404a",     // 글자 (--ink)
  },
  dark: {
    land: "#4c404a",
    landuse: "#514450",
    park: "#4d4f47",
    water: "#3a4553",
    building: "#5a4c57",
    road: "#6b5b67",
    roadCase: "#3e343d",
    rail: "#7d6f78",
    label: "#f4e7cd",
  },
};

// 팔레트 키 → [레이어 id, paint 속성]
export const PAINT = {
  land: [["background", "background-color"], ["label-place-major", "text-halo-color"], ["label-place-minor", "text-halo-color"], ["label-road", "text-halo-color"], ["label-water", "text-halo-color"]],
  landuse: [["landuse", "fill-color"]],
  park: [["park", "fill-color"], ["landcover", "fill-color"]],
  water: [["water", "fill-color"], ["waterway", "line-color"]],
  building: [["building", "fill-color"]],
  road: [["road-minor", "line-color"], ["road-mid", "line-color"], ["road-major", "line-color"]],
  roadCase: [["road-mid-case", "line-color"], ["road-major-case", "line-color"], ["building", "fill-outline-color"]],
  rail: [["rail", "line-color"], ["boundary", "line-color"]],
  label: [["label-place-major", "text-color"], ["label-place-minor", "text-color"], ["label-road", "text-color"], ["label-water", "text-color"]],
};

// 패널에 보이는 이름 (한국어)
export const KEYS = [
  ["land", "땅"], ["landuse", "주거·상업"], ["park", "공원·숲"], ["water", "물"],
  ["building", "건물"], ["road", "도로"], ["roadCase", "도로 테두리"], ["rail", "철도·경계"], ["label", "글자"],
];

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
      { id: "label-place-minor", type: "symbol", source: "omt", "source-layer": "place", minzoom: 11,
        filter: cls("suburb", "quarter", "neighbourhood"),
        layout: { "text-field": NAME, "text-font": FONT, "text-size": z(11, 11, 16, 15), "text-padding": 6 },
        paint: { "text-color": p.label, "text-opacity": 0.8, "text-halo-color": p.land, "text-halo-width": 1.6 } },
      { id: "label-place-major", type: "symbol", source: "omt", "source-layer": "place",
        filter: cls("city", "town"),
        layout: { "text-field": NAME, "text-font": FONT_BOLD, "text-size": z(6, 12, 12, 20), "text-letter-spacing": 0.08 },
        paint: { "text-color": p.label, "text-halo-color": p.land, "text-halo-width": 2 } },
    ],
  };
}
