// /lab/spin — 판 위에 둘러 놓을 프레임 만들기 + 판 한 장으로 굽기 (브라우저 전용: canvas 사용)
// - 데모(튀는 공) · 글자 · 올린 파일(GIF·움직이는 WebP/PNG·짧은 영상) → 같은 크기(S×S) 정사각 캔버스들
// - 파일은 네 모서리 색이 한 가지면 그 색을 배경으로 보고 지움 (초록·파랑 배경은 밝기 무시하고 색만 비교)
// - buildDisc: 프레임을 12시에서 시계 반대 방향으로 0,1,2… 배치 → 판이 시계 방향으로 한 칸 돌면 12시 자리에 다음 장이 옴

export const S = 256;   // 프레임 한 장(px)
export const D = 1000;  // 판 그림(px)
const R = D / 2;

export const RPM = { "33": 100 / 3, "45": 45 };
export const rpmLabel = (rpm) => (rpm === 45 ? "45" : "33⅓");

const make = (w = S, h = S) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};
const ink = (style) => (style === "black" ? "#f1e5cc" : "#3b3139");
const tone = (style) => (style === "black" ? "#7fc1bd" : "#2d6a6a");

/* 데모: 통통 튀는 공 한 번 */
export function demoFrames(n, style) {
  return Array.from({ length: n }, (_, k) => {
    const t = k / n, c = make(), g = c.getContext("2d");
    const ground = S * 0.82, h = S * 0.52, r = S * 0.12;
    const up = Math.sin(Math.PI * t);
    const y = ground - r - up * h;
    const squash = up < 0.14 ? 1 + (0.14 - up) * 2.6 : 1 - Math.min(0.12, (up - 0.14) * 0.2);
    g.fillStyle = style === "black" ? "rgba(127,193,189,.35)" : "rgba(0,0,0,.28)";
    g.beginPath(); g.ellipse(S / 2, ground + 4, r * (1.2 - up * 0.55), r * 0.22 * (1.2 - up * 0.55), 0, 0, 7); g.fill();
    g.fillStyle = ink(style);
    g.beginPath(); g.ellipse(S / 2, y + r * (1 - 1 / squash), r * squash, r / squash, 0, 0, 7); g.fill();
    g.fillStyle = tone(style);
    g.beginPath(); g.arc(S / 2 - r * 0.35 * squash, y - r * 0.3 / squash, r * 0.22, 0, 7); g.fill();
    return c;
  });
}

/* 글자: wave(물결) · spin(회전) · pulse(커졌다 작아짐) · type(한 글자씩) */
export function textFrames(n, { text, effect, font, style }) {
  const chars = [...(text.trim() || "SPIN")];
  const fam = font === "groove" ? "'Monoton','Black Han Sans'" : "'Black Han Sans','Monoton'";
  return Array.from({ length: n }, (_, k) => {
    const t = k / n, c = make(), g = c.getContext("2d");
    let size = S * 0.5;
    g.font = `${size}px ${fam}`;
    const w0 = chars.reduce((a, ch) => a + g.measureText(ch).width, 0);
    size = Math.min(size, (size * (S * 0.84)) / w0);
    g.font = `${size}px ${fam}`;
    const widths = chars.map((ch) => g.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0);
    g.textBaseline = "middle";
    g.translate(S / 2, S / 2);
    if (effect === "spin") g.rotate(t * Math.PI * 2);
    if (effect === "pulse") { const s = 0.62 + 0.38 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)); g.scale(s, s); }
    const shown = effect === "type" ? Math.floor(t * (chars.length + 3)) : chars.length;
    let x = -total / 2;
    chars.forEach((ch, i) => {
      const y = effect === "wave" ? -Math.sin((t - i / chars.length) * Math.PI * 2) * S * 0.16 : 0;
      if (i < shown) { g.fillStyle = effect === "wave" && i % 2 ? tone(style) : ink(style); g.fillText(ch, x, y); }
      x += widths[i];
    });
    if (effect === "type" && k % 2 === 0) {
      const cx = -total / 2 + widths.slice(0, Math.min(shown, chars.length)).reduce((a, b) => a + b, 0);
      g.fillStyle = tone(style); g.fillRect(cx + 2, -size * 0.38, size * 0.08, size * 0.76);
    }
    return c;
  });
}

/* 파일 → 프레임 목록 [{ c, dur(초) }] */
function contain(src, sw, sh) {
  const c = make(), g = c.getContext("2d"), s = Math.min(S / sw, S / sh);
  g.drawImage(src, (S - sw * s) / 2, (S - sh * s) / 2, sw * s, sh * s);
  return c;
}
const TYPES = { gif: "image/gif", webp: "image/webp", png: "image/png", apng: "image/apng" };
async function decodeAnimated(file) {
  if (!("ImageDecoder" in window)) throw new Error("이 브라우저는 움직이는 이미지를 프레임으로 나누지 못해요. Chrome·Edge에서 열거나 MP4로 올려 주세요.");
  const type = file.type || TYPES[file.name.split(".").pop().toLowerCase()] || "image/gif";
  const dec = new window.ImageDecoder({ data: await file.arrayBuffer(), type });
  await dec.tracks.ready;
  await dec.completed;
  const track = dec.tracks.selectedTrack || dec.tracks[0];
  if (!track) throw new Error("이 파일에서 프레임을 찾지 못했어요.");
  const count = Math.min(track.frameCount, 300);
  const list = [];
  for (let i = 0; i < count; i++) {
    const { image } = await dec.decode({ frameIndex: i });
    list.push({ c: contain(image, image.displayWidth, image.displayHeight), dur: (image.duration || 100000) / 1e6 });
    image.close();
  }
  dec.close();
  return list;
}
const once = (el, ev) => new Promise((ok, no) => {
  el.addEventListener(ev, ok, { once: true });
  el.addEventListener("error", () => no(new Error("영상을 읽지 못했어요.")), { once: true });
});
async function decodeVideo(file) {
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = URL.createObjectURL(file);
  try {
    await once(v, "loadeddata");
    const dur = Math.min(v.duration || 0, 4);   // 앞 4초만
    if (!dur) throw new Error("영상 길이를 읽지 못했어요.");
    const count = 48, list = [];
    for (let i = 0; i < count; i++) {
      v.currentTime = (i / count) * dur;
      await once(v, "seeked");
      list.push({ c: contain(v, v.videoWidth, v.videoHeight), dur: dur / count });
    }
    return list;
  } finally { URL.revokeObjectURL(v.src); }
}
export const isVideo = (file) => (file.type || "").startsWith("video") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
export async function decodeFile(file) {
  const video = isVideo(file);
  const list = video ? await decodeVideo(file) : await decodeAnimated(file);
  if (list.length < 2) throw new Error("움직이는 프레임이 한 장뿐이에요. 애니메이션 GIF·WebP나 영상을 올려 주세요.");
  return { list, total: list.reduce((a, f) => a + f.dur, 0), name: file.name, key: readKey(list[0].c) };
}

/* 네 모서리로 배경 판단: clear(이미 투명) · busy(여러 색) · solid(한 색 → 지울 수 있음) */
export function readKey(c) {
  const d = c.getContext("2d").getImageData(0, 0, S, S).data, pts = [];
  for (const [x0, y0] of [[2, 2], [S - 8, 2], [2, S - 8], [S - 8, S - 8]])
    for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 6; x++) {
      const i = (y * S + x) * 4;
      pts.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
    }
  const solid = pts.filter((p) => p[3] > 200);
  if (solid.length < pts.length * 0.5) return { kind: "clear" };
  const avg = [0, 1, 2].map((j) => solid.reduce((a, p) => a + p[j], 0) / solid.length);
  const spread = Math.max(...solid.map((p) => Math.hypot(p[0] - avg[0], p[1] - avg[1], p[2] - avg[2])));
  if (spread > 60) return { kind: "busy" };
  return { kind: "solid", rgb: avg.map(Math.round) };
}

const cbcr = (r, g, b) => [-0.1687 * r - 0.3313 * g + 0.5 * b, 0.5 * r - 0.4187 * g - 0.0813 * b];
function keyed(src, key, tol) {
  const c = make(), g = c.getContext("2d");
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, S, S), d = img.data;
  const [kr, kg, kb] = key.rgb, [kcb, kcr] = cbcr(kr, kg, kb);
  const chroma = Math.hypot(kcb, kcr) > 28;
  const dom = kg >= kr && kg >= kb ? 1 : kb >= kr ? 2 : 0;
  const soft = tol * 0.6 + 10;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    let dist;
    if (chroma) { const [cb, cr] = cbcr(r, gg, b); dist = Math.hypot(cb - kcb, cr - kcr) * 1.6; }
    else dist = Math.hypot(r - kr, gg - kg, b - kb);
    const a = Math.min(1, Math.max(0, (dist - tol) / soft));
    d[i + 3] = Math.round(d[i + 3] * a);
    if (chroma && dist < tol * 3) {   // 가장자리에 남는 배경색 기운 빼기
      const ch = [r, gg, b], others = ch.filter((_, j) => j !== dom);
      ch[dom] = Math.min(ch[dom], Math.max(...others));
      d[i] = ch[0]; d[i + 1] = ch[1]; d[i + 2] = ch[2];
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* 올린 파일에서 n장을 시간 기준으로 고르게 */
export function fileFrames(raw, n, { key, tol }) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const at = (k / n) * raw.total;
    let acc = 0, idx = 0;
    while (idx < raw.list.length - 1 && acc + raw.list[idx].dur <= at) { acc += raw.list[idx].dur; idx++; }
    const src = raw.list[idx].c;
    out.push(key && raw.key.kind === "solid" ? keyed(src, raw.key, tol) : src);
  }
  return out;
}

/* 판 한 장 굽기 (target 캔버스에 D×D) */
export function buildDisc(target, frames, { style, rpm }) {
  const g = target.getContext("2d");
  g.clearRect(0, 0, D, D);
  const black = style === "black";
  g.save(); g.translate(R, R);
  const base = g.createRadialGradient(0, 0, 40, 0, 0, R);
  if (black) { base.addColorStop(0, "#1d191c"); base.addColorStop(1, "#0f0d0f"); }
  else { base.addColorStop(0, "#fbf3e2"); base.addColorStop(1, "#ecdcba"); }
  g.fillStyle = base; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
  for (let r = 172; r < R - 8; r += 3.2) {   // 홈
    const strong = r % 9.6 < 3.2;
    g.strokeStyle = black ? `rgba(255,255,255,${strong ? 0.05 : 0.025})` : `rgba(76,64,74,${strong ? 0.07 : 0.035})`;
    g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
  }
  g.strokeStyle = black ? "rgba(255,255,255,.12)" : "rgba(76,64,74,.25)"; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, R - 3, 0, 7); g.stroke();
  // 프레임: 칸 크기는 둘레 간격과 띠 폭이 같아지는 반지름에서 가장 큼
  const n = frames.length, k = Math.sin(Math.PI / n) * 0.94;
  const rc = (R - 30) / (1 + k), s = Math.min(2 * rc * k, 2 * (R - 30 - rc));
  frames.forEach((f, i) => {
    g.save(); g.rotate((-i * 2 * Math.PI) / n); g.translate(0, -rc);
    g.drawImage(f, -s / 2, -s / 2, s, s);
    g.restore();
  });
  // 라벨
  g.fillStyle = black ? "#2d6a6a" : "#4c404a";
  g.beginPath(); g.arc(0, 0, 150, 0, 7); g.fill();
  g.strokeStyle = "rgba(243,231,205,.35)"; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 138, 0, 7); g.stroke();
  g.fillStyle = "#f3e7cd"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "52px 'Monoton', Georgia, serif"; g.fillText("Grooves", 0, -24);
  g.font = "600 15px 'Hahmlet', Georgia, serif";
  g.fillText(`${rpmLabel(rpm)} RPM · ${n} FRAMES`, 0, 34);
  g.fillText("SIDE A · SPIN", 0, 58);
  g.globalCompositeOperation = "destination-out";   // 스핀들 구멍
  g.beginPath(); g.arc(0, 0, 11, 0, 7); g.fill();
  g.restore();
}

/* 검은 판 위 고정 반사광 (판이 돌아도 빛은 그대로) */
export function makeSheen() {
  const c = make(D, D), g = c.getContext("2d");
  if (g.createConicGradient) {
    const cg = g.createConicGradient(-Math.PI / 4, R, R);
    [[0, 0], [0.08, 0.1], [0.16, 0], [0.5, 0], [0.58, 0.07], [0.66, 0], [1, 0]].forEach(([p, a]) => cg.addColorStop(p, `rgba(255,255,255,${a})`));
    g.fillStyle = cg; g.beginPath(); g.arc(R, R, R, 0, 7); g.arc(R, R, 156, 0, 7, true); g.fill();
  }
  return c;
}
