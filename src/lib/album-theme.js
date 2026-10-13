// Brand anchors stay consistent; only low-contrast backgrounds need correction.
const CREAM = "#f4e7cd";
const INK = "#4c404a";
export function normalizeHex(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value.toLowerCase() : "#bbcbda";
}
function channels(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function luminance(hex) {
  const c = channels(hex).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
export function contrastRatio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function mix(a, b, amount) {
  const target = channels(b);
  return "#" + channels(a).map((v, i) => Math.round(v + (target[i] - v) * amount).toString(16).padStart(2, "0")).join("");
}
export function getAlbumTheme(value) {
  const background = normalizeHex(value);
  let foreground = contrastRatio(CREAM, background) > contrastRatio(INK, background) ? CREAM : INK;
  if (contrastRatio(foreground, background) < 4.5) {
    const endpoint = contrastRatio("#000000", background) > contrastRatio("#ffffff", background) ? "#000000" : "#ffffff";
    const anchor = endpoint === "#000000" ? INK : CREAM;
    for (let step = 0; step <= 100; step++) {
      foreground = mix(anchor, endpoint, step / 100);
      if (contrastRatio(foreground, background) >= 4.5) break;
    }
  }
  let muted = foreground;
  for (let step = 1; step <= 25; step++) {
    const candidate = mix(foreground, background, step / 100);
    if (contrastRatio(candidate, background) < 4.5) break;
    muted = candidate;
  }
  return { background, foreground, muted };
}

// 앨범 페이지 Footer 색: 바탕은 앨범 배경 그라디언트의 맨 아래 색(커버 색 84% + 검정)과 이어지고,
// 슬리브는 그 바탕이 밝으면 브라운(INK), 어두우면 크림(CREAM). 슬리브 글자는 그 반대
export function getFooterPalette(value) {
  const bottom = mix(normalizeHex(value), "#000000", 0.16);
  const light = contrastRatio(INK, bottom) >= contrastRatio(CREAM, bottom);
  return { crate: bottom, sleeve: light ? INK : CREAM, text: light ? CREAM : INK };
}
