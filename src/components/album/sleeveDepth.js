// 앨범 슬리브 두께 (Digging 호버 · 앨범 이동 전환 · 앨범 상세가 함께 씀)
// 커버 한 변 대비 비율이라, 커버가 커지거나 작아지는 동안에도 같은 비율로 두께가 따라감
export const SLEEVE_DEPTH = "1.3%";

// 위 면은 대표색보다 조금, 오른쪽 면은 더 진하게 (빛이 왼쪽 위에서 오는 느낌)
export function sleeveColors(color) {
  const c = color || "#bbcbda";
  return {
    top: `color-mix(in oklab, ${c} 82%, #000)`,
    side: `color-mix(in oklab, ${c} 64%, #000)`,
  };
}

// DOM으로 두께 면 두 개를 만듦 (앨범 이동 전환 오버레이용)
export function createSleeveFaces(color, depth = SLEEVE_DEPTH) {
  const { top, side } = sleeveColors(color);
  const topFace = document.createElement("span");
  Object.assign(topFace.style, {
    position: "absolute", left: "0", bottom: "100%", width: "100%", height: depth,
    transformOrigin: "0 100%", transform: "skewX(-45deg)", backgroundColor: top, pointerEvents: "none",
  });
  const sideFace = document.createElement("span");
  Object.assign(sideFace.style, {
    position: "absolute", left: "100%", top: "0", width: depth, height: "100%",
    transformOrigin: "0 0", transform: "skewY(-45deg)", backgroundColor: side, pointerEvents: "none",
  });
  return [topFace, sideFace];
}
