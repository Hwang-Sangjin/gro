// 이미지 → N×N 브릭 모자이크 (팔레트 색 번호 배열 + 색별 개수)
// 1) 정사각형으로 잘라 N×N 으로 줄임 — 빛 세기(선형) 기준 평균이라 칸 색이 어두워지거나 탁해지지 않음
// 2) 밝기·대비·채도 보정 → OKLab 으로 옮기고 채도를 살짝 올림(브릭 색으로 옮기면 빠지는 만큼)
// 3) 가장 가까운 팔레트 색: OKLab 밝기 + 채도(빠지는 쪽을 무겁게) + 색상 → 회색 남발·색상 어긋남을 막음
// 4) 색 수 제한: 전체 오차를 가장 많이 줄이는 색부터 하나씩 고름 → 작아도 중요한 색(눈·입술·로고)이 남음
// 5) 디더링(선택): Floyd–Steinberg (OKLab 오차 확산)
// 결과에 colors(팔레트 hex) · trueColors(보정한 원래 색) · free(이 이미지에서 뽑은 색으로 칠한 판) 를 같이 담음
// 6) 자유 색: 팔레트 대신 이미지에서 k 색(기본 24)을 OKLab k-means 로 뽑아 칠함 — 원본에 가깝지만 실제 브릭 색은 아님
import { PALETTE } from "./palette";

const CHROMA_BOOST = 1.1;    // 맞추기 전에 채도를 올리는 정도
const W_HUE = 2;             // 색상(hue) 차이 가중치 — 분홍이 주황으로 가는 식의 어긋남을 막음
const W_LOSE = 1.6;          // 채도가 빠지는 쪽(회색으로 가는 쪽) 가중치
const W_GAIN = 0.8;          // 채도가 늘어나는 쪽 가중치

// sRGB(0..255) ↔ 선형
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v) => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055); };
const LIN = Float32Array.from({ length: 256 }, (_, i) => toLin(i));

function linToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToHex([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((v) => Math.round(toSrgb(v)).toString(16).padStart(2, "0")).join("");
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PALETTE_LAB = PALETTE.map((p) => { const [r, g, b] = hexRgb(p.hex); return linToOklab(LIN[r], LIN[g], LIN[b]); });
const PALETTE_C = PALETTE_LAB.map(([, a, b]) => Math.hypot(a, b));

// 칸 색(src) 과 팔레트 색(i) 의 거리 (제곱) — 밝기 + 채도(빠지면 더 무겁게) + 색상
function dist(src, i) {
  const p = PALETTE_LAB[i];
  const dL = src[0] - p[0], da = src[1] - p[1], db = src[2] - p[2];
  const dC = Math.hypot(src[1], src[2]) - PALETTE_C[i];
  const dH2 = Math.max(0, da * da + db * db - dC * dC);
  return dL * dL + (dC > 0 ? W_LOSE : W_GAIN) * dC * dC + W_HUE * dH2;
}
// 보정: brightness/contrast/saturation 은 -0.5..0.5 (0 = 그대로), sRGB 0..255 기준
function adjust([r, g, b], { brightness = 0, contrast = 0, saturation = 0 }) {
  const c = 1 + contrast, s = 1 + saturation, add = brightness * 255 * 0.5;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [r, g, b].map((v) => {
    v = gray + (v - gray) * s;
    v = (v - 128) * c + 128 + add;
    return Math.max(0, Math.min(255, v));
  });
}

// 소스 이미지(img + 정사각 crop {x,y,size})를 N×N 픽셀로 — 칸마다 8×8 을 선형 빛 기준으로 평균 → sRGB
export function sampleImage(img, crop, n = 32) {
  const big = document.createElement("canvas");
  big.width = big.height = n * 8;
  const g = big.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  const c = crop ?? { x: 0, y: 0, size: Math.min(img.naturalWidth, img.naturalHeight) };
  g.drawImage(img, c.x, c.y, c.size, c.size, 0, 0, n * 8, n * 8);
  const d = g.getImageData(0, 0, n * 8, n * 8).data;
  const out = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let r = 0, gg = 0, b = 0;
    for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
      const k = ((y * 8 + yy) * n * 8 + (x * 8 + xx)) * 4;
      r += LIN[d[k]]; gg += LIN[d[k + 1]]; b += LIN[d[k + 2]];
    }
    const o = (y * n + x) * 3;
    out[o] = toSrgb(r / 64); out[o + 1] = toSrgb(gg / 64); out[o + 2] = toSrgb(b / 64);
  }
  return out;
}

// 색 수 제한: 오차 합을 가장 많이 줄이는 색을 하나씩 더함 (탐욕법)
function pickColors(labs, k) {
  const P = PALETTE.length, n = labs.length;
  const D = new Float32Array(n * P);
  for (let i = 0; i < n; i++) for (let p = 0; p < P; p++) D[i * P + p] = dist(labs[i], p);
  const best = new Float32Array(n).fill(Infinity);
  const chosen = [];
  for (let step = 0; step < k; step++) {
    let pick = -1, pickSum = Infinity;
    for (let p = 0; p < P; p++) {
      if (chosen.includes(p)) continue;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Math.min(best[i], D[i * P + p]);
      if (sum < pickSum) { pickSum = sum; pick = p; }
    }
    chosen.push(pick);
    for (let i = 0; i < n; i++) best[i] = Math.min(best[i], D[i * P + pick]);
  }
  return chosen;
}

// 칠하기: 각 칸을 고른 색(allowed: labOf 의 번호들) 중 가장 가까운 색으로. 디더링이면 OKLab 오차를 이웃 칸에 나눠 줌
function paint(labs, n, allowed, labOf, d, dither) {
  const near = (lab) => { let best = allowed[0], bd = Infinity; for (const i of allowed) { const v = d(lab, i); if (v < bd) { bd = v; best = i; } } return best; };
  const cells = new Uint8Array(n * n);
  if (!dither) { for (let i = 0; i < n * n; i++) cells[i] = near(labs[i]); return cells; }
  const err = labs.map((l) => l.slice());
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, want = err[i], got = near(want);
    cells[i] = got;
    const e = want.map((v, k) => (v - labOf[got][k]) * 0.75);   // 0.75: 너무 거칠지 않게
    const push = (xx, yy, w) => { if (xx < 0 || xx >= n || yy >= n) return; const t = err[yy * n + xx]; for (let k = 0; k < 3; k++) t[k] += e[k] * w; };
    push(x + 1, y, 7 / 16); push(x - 1, y + 1, 3 / 16); push(x, y + 1, 5 / 16); push(x + 1, y + 1, 1 / 16);
  }
  return cells;
}

// 자유 색: 이 이미지에서 k 색을 직접 뽑음 (OKLab k-means). 시작점은 고정된 난수라 보정을 바꿔도 색이 덜 흔들림
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
function kmeans(labs, k) {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = labs.length;
  const cs = [labs[Math.floor(rnd() * n)].slice()];
  const dd = new Float32Array(n).fill(Infinity);
  while (cs.length < k) {   // k-means++: 이미 고른 색에서 먼 칸일수록 뽑힐 확률이 큼
    const last = cs[cs.length - 1];
    let sum = 0;
    for (let i = 0; i < n; i++) { dd[i] = Math.min(dd[i], d2(labs[i], last)); sum += dd[i]; }
    if (sum <= 1e-9) break;
    let r = rnd() * sum, i = 0;
    while (i < n - 1 && (r -= dd[i]) > 0) i++;
    cs.push(labs[i].slice());
  }
  const asg = new Int32Array(n);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < n; i++) { let b = 0, bd = Infinity; for (let j = 0; j < cs.length; j++) { const v = d2(labs[i], cs[j]); if (v < bd) { bd = v; b = j; } } asg[i] = b; }
    const acc = cs.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) { const a = acc[asg[i]]; a[0] += labs[i][0]; a[1] += labs[i][1]; a[2] += labs[i][2]; a[3]++; }
    acc.forEach((a, j) => { if (a[3]) cs[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  return cs;
}
export const FREE_DEFAULT = 24;

// pixels(sampleImage 결과) →
//   { cells, counts: [{index, count}] (많은 순), colors(팔레트 hex), trueColors(보정한 원래 색 hex),
//     free: { cells, counts, colors, swatches: [{name, hex}] } — 이미지에서 뽑은 색 }
export function buildMosaic(pixels, n = 32, { brightness = 0, contrast = 0, saturation = 0, dither = false, maxColors = 0 } = {}) {
  const labs = [];
  for (let i = 0; i < n * n; i++) {
    const [r, g, b] = adjust([pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]], { brightness, contrast, saturation });
    const [L, A, B] = linToOklab(LIN[Math.round(r)], LIN[Math.round(g)], LIN[Math.round(b)]);
    labs.push([L, A * CHROMA_BOOST, B * CHROMA_BOOST]);
  }
  const allowed = maxColors > 0 && maxColors < PALETTE.length ? pickColors(labs, maxColors) : PALETTE.map((_, i) => i);
  const cells = paint(labs, n, allowed, PALETTE_LAB, dist, dither);

  const fk = kmeans(labs, maxColors > 0 ? maxColors : FREE_DEFAULT);
  const fcells = paint(labs, n, fk.map((_, i) => i), fk, (lab, i) => d2(lab, fk[i]), dither);
  const fhex = fk.map(oklabToHex);
  return {
    cells, counts: countCells(cells),
    colors: Array.from(cells, (c) => PALETTE[c].hex),
    trueColors: labs.map(oklabToHex),
    free: { cells: fcells, counts: countCells(fcells), colors: Array.from(fcells, (c) => fhex[c]), swatches: fhex.map((hex) => ({ name: hex.toUpperCase(), hex })) },
  };
}

export function countCells(cells) {
  const m = new Map();
  for (const c of cells) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m].map(([index, count]) => ({ index, count })).sort((a, b) => b.count - a.count);
}
