// 이미지 → N×N 브릭 모자이크 (팔레트 색 번호 배열 + 색별 개수)
// 1) 정사각형으로 잘라 N×N 으로 줄임  2) 밝기·대비·채도 보정  3) Lab 색공간에서 CIEDE2000 으로 가장 가까운 색
// 4) 색 수 제한: 많이 쓰인 색만 남기고 다시 칠함  5) 디더링(선택): Floyd–Steinberg (Lab 오차 확산)
import { PALETTE } from "./palette";

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function rgbToLab([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
// CIEDE2000 색 차이
function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h = (b, a) => { if (!a && !b) return 0; const v = Math.atan2(b, a) / rad; return v < 0 ? v + 360 : v; };
  const h1 = h(b1, a1p), h2 = h(b2, a2p);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hb = h1 + h2;
  if (C1p * C2p) { hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2; }
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

export const PALETTE_RGB = PALETTE.map((p) => hexRgb(p.hex));
const PALETTE_LAB = PALETTE_RGB.map(rgbToLab);

function nearest(lab, allowed) {
  let best = allowed[0], bd = Infinity;
  for (const i of allowed) { const d = de2000(lab, PALETTE_LAB[i]); if (d < bd) { bd = d; best = i; } }
  return best;
}

// 보정: brightness/contrast/saturation 은 -1..1 (0 = 그대로)
function adjust([r, g, b], { brightness = 0, contrast = 0, saturation = 0 }) {
  const c = 1 + contrast, s = 1 + saturation, add = brightness * 255 * 0.5;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [r, g, b].map((v) => {
    v = gray + (v - gray) * s;
    v = (v - 128) * c + 128 + add;
    return Math.max(0, Math.min(255, v));
  });
}

// 소스 이미지(img + 정사각 crop {x,y,size})를 N×N 픽셀로 (브라우저 캔버스 평균)
export function sampleImage(img, crop, n = 32) {
  const big = document.createElement("canvas");
  big.width = big.height = n * 8;   // 먼저 크게 줄였다가 칸마다 평균 → 브라우저 축소보다 고르게
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
      r += d[k]; gg += d[k + 1]; b += d[k + 2];
    }
    const o = (y * n + x) * 3;
    out[o] = r / 64; out[o + 1] = gg / 64; out[o + 2] = b / 64;
  }
  return out;
}

// pixels(sampleImage 결과) → { cells: Uint8Array(n*n, 팔레트 번호), counts: [{index, count}] (많은 순) }
export function buildMosaic(pixels, n = 32, { brightness = 0, contrast = 0, saturation = 0, dither = false, maxColors = 0 } = {}) {
  const labs = [];
  for (let i = 0; i < n * n; i++) labs.push(rgbToLab(adjust([pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]], { brightness, contrast, saturation })));
  const all = PALETTE.map((_, i) => i);
  const paint = (allowed) => {
    const cells = new Uint8Array(n * n);
    if (!dither) { for (let i = 0; i < n * n; i++) cells[i] = nearest(labs[i], allowed); return cells; }
    const err = labs.map((l) => l.slice());
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, want = err[i], got = nearest(want, allowed);
      cells[i] = got;
      const e = want.map((v, k) => (v - PALETTE_LAB[got][k]) * 0.75);   // 0.75: 너무 거칠지 않게
      const push = (xx, yy, w) => { if (xx < 0 || xx >= n || yy >= n) return; const t = err[yy * n + xx]; for (let k = 0; k < 3; k++) t[k] += e[k] * w; };
      push(x + 1, y, 7 / 16); push(x - 1, y + 1, 3 / 16); push(x, y + 1, 5 / 16); push(x + 1, y + 1, 1 / 16);
    }
    return cells;
  };
  let cells = paint(all);
  if (maxColors > 0) {
    const used = countCells(cells);
    if (used.length > maxColors) cells = paint(used.slice(0, maxColors).map((u) => u.index));
  }
  return { cells, counts: countCells(cells) };
}

export function countCells(cells) {
  const m = new Map();
  for (const c of cells) m.set(c, (m.get(c) ?? 0) + 1);
  return [...m].map(([index, count]) => ({ index, count })).sort((a, b) => b.count - a.count);
}
