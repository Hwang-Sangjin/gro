/* Crate 보기의 장르 칸막이 그림 (2026-11-21) — 그리드의 크래프트 칸막이(Digging.module.css .divider)와 같은 모습을 캔버스에 그림
   - face(card): 판 앞면 — 크래프트 판지 · 손때 · 닳은 모서리 · 고무 도장 · 장르 색 스티커 · 마커 손글씨
   - tab(card): 판 위로 솟은 탭 — 크래프트 + 다이모 라벨(검은 테이프 · 눌려 튀어나온 흰 글자)
   card = { head, count, tab, dot(css 색) } · 글꼴(Permanent Marker)이 늦게 오면 다시 그려야 하므로 onReady 로 알림 */

const KRAFT = "#c9a679";

function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// 크래프트 판지 바탕: 섬유 반점 · 큰 얼룩 · 손때 탄 가장자리
function kraft(g, w, h, seed) {
  const r = rand(seed);
  g.fillStyle = KRAFT; g.fillRect(0, 0, w, h);
  for (const [x, y, rx, a] of [[0.25, 0.3, 0.55, "rgba(255,240,210,.18)"], [0.8, 0.75, 0.5, "rgba(90,60,30,.12)"]]) {
    const gr = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, rx * Math.max(w, h));
    gr.addColorStop(0, a); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  const n = Math.round(w * h / 140);
  for (let i = 0; i < n; i++) {
    const dark = r() < 0.55;
    g.fillStyle = dark ? `rgba(95,65,35,${0.05 + r() * 0.12})` : `rgba(255,240,215,${0.05 + r() * 0.12})`;
    const s = 0.6 + r() * 1.8;
    g.fillRect(r() * w, r() * h, s * (r() < 0.2 ? 4 : 1), s);   // 가끔 가로로 긴 섬유
  }
}
function edges(g, w, h, round = true) {
  // 안쪽 그늘(손때) — 네 변을 따라
  const k = Math.min(w, h) * 0.06;
  for (const [x0, y0, x1, y1] of [[0, 0, 0, k], [0, h, 0, h - k], [0, 0, k, 0], [w, 0, w - k, 0]]) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, "rgba(80,52,25,.32)"); gr.addColorStop(1, "rgba(80,52,25,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  if (round) for (const x of [0, w]) {   // 아래 두 모서리: 닳아서 밝아진 자국
    const gr = g.createRadialGradient(x, h, 0, x, h, Math.min(w, h) * 0.16);
    gr.addColorStop(0, "rgba(255,238,205,.4)"); gr.addColorStop(1, "rgba(255,238,205,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}
// 글자 줄 나누기 (마커 글씨가 판 폭을 넘으면)
function lines(g, text, max) {
  const out = []; let cur = "";
  for (const word of text.split(" ")) {
    const t = cur ? `${cur} ${word}` : word;
    if (g.measureText(t).width > max && cur) { out.push(cur); cur = word; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

export function drawDividerFace(card, size = 1024) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), S = size / 100;   // S = 판 폭의 1%
  kraft(g, size, size, 7);
  edges(g, size, size);
  // 고무 도장 (왼쪽 위): 붉은 갈색 테두리 · 두 줄 · 살짝 기울고 군데군데 잉크가 덜 묻음
  //  도장은 따로 그린 뒤 얹음 (판 위에서 바로 지우면 크래프트까지 구멍이 났음)
  const st = document.createElement("canvas"), sg = st.getContext("2d");
  const font = `800 ${3.6 * S}px "Arial Narrow", "Roboto Condensed", system-ui, sans-serif`, gap = 0.8 * S, pad = 1.5 * S;
  sg.font = font;
  const trackedW = (t) => [...t].reduce((w, ch) => w + sg.measureText(ch).width + gap, -gap);   // 자간 포함 폭
  const lw = Math.max(trackedW("GROOVES"), trackedW("RECORD CRATE")) + pad * 2, lh = 11 * S;
  st.width = Math.ceil(lw + 2 * S); st.height = Math.ceil(lh + 2 * S);
  sg.translate(S, S);
  sg.font = font; sg.textBaseline = "top";
  sg.strokeStyle = sg.fillStyle = "rgba(132,42,32,.8)"; sg.lineWidth = 0.5 * S;
  sg.strokeRect(0, 0, lw, lh);
  const tracked = (t, x, y) => { let px = x; for (const ch of t) { sg.fillText(ch, px, y); px += sg.measureText(ch).width + gap; } };
  tracked("GROOVES", pad, 1.6 * S); tracked("RECORD CRATE", pad, 6 * S);
  sg.globalCompositeOperation = "destination-out";
  const r = rand(3);
  for (let i = 0; i < 140; i++) { sg.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.5})`; sg.beginPath(); sg.arc(r() * lw, r() * lh, 0.12 * S + r() * 0.35 * S, 0, 7); sg.fill(); }
  g.save();
  g.translate(8 * S, 9 * S); g.rotate(-0.07);
  g.drawImage(st, -S, -S);
  g.restore();
  // 장르 색 동그라미 스티커 (오른쪽 위)
  const cx = size - 12 * S, cy = 12 * S, rr = 3.4 * S;
  g.save();
  g.shadowColor = "rgba(0,0,0,.3)"; g.shadowBlur = 0.8 * S; g.shadowOffsetY = 0.3 * S;
  g.fillStyle = card.dot || "#bbcbda"; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = 0.4 * S; g.beginPath(); g.arc(cx, cy, rr - 0.4 * S, 0, 7); g.stroke();
  // 마커 손글씨: 장르 이름 (아래쪽) · 판 수
  g.save();
  g.fillStyle = "rgba(35,28,26,.92)";
  g.translate(8 * S, 92 * S); g.rotate(-0.045);
  g.textBaseline = "alphabetic";
  g.globalAlpha = 0.78;
  g.font = `400 ${4.6 * S}px "Permanent Marker", "Comic Sans MS", cursive`;
  g.fillText(card.count || "", 0, 0);
  g.globalAlpha = 0.92;
  g.font = `400 ${10 * S}px "Permanent Marker", "Comic Sans MS", cursive`;
  const ls = lines(g, card.head || "", 82 * S);
  ls.reverse().forEach((t, i) => g.fillText(t, 0, -(7 * S) - i * 10.5 * S));
  g.restore();
  return c;
}

// 탭: 크래프트 (위 두 모서리 둥글게) + 가운데 다이모 라벨
export function drawDividerTab(card, w = 512, h = 128) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), R = h * 0.3;
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, R); g.quadraticCurveTo(0, 0, R, 0); g.lineTo(w - R, 0); g.quadraticCurveTo(w, 0, w, R); g.lineTo(w, h); g.closePath();
  g.save(); g.clip();
  kraft(g, w, h, 11);
  edges(g, w, h, false);
  g.restore();
  // 다이모 테이프
  const label = (card.tab || "").toUpperCase();
  g.font = `700 ${h * 0.3}px "Arial Narrow", "Roboto Condensed", "Helvetica Neue", system-ui, sans-serif`;
  const sp = h * 0.05;
  let tw = 0; for (const ch of label) tw += g.measureText(ch).width + sp;
  tw = Math.min(tw - sp, w * 0.78);
  const th = h * 0.42, px = h * 0.14, x0 = (w - tw) / 2 - px, y0 = (h - th) / 2 + h * 0.04;
  g.save();
  g.translate(w / 2, y0 + th / 2); g.rotate(-0.025); g.translate(-w / 2, -(y0 + th / 2));
  g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = h * 0.03; g.shadowOffsetY = h * 0.015;
  const cut = th * 0.18;
  g.beginPath(); g.moveTo(x0 + cut, y0); g.lineTo(x0 + tw + 2 * px, y0); g.lineTo(x0 + tw + 2 * px - cut, y0 + th); g.lineTo(x0, y0 + th); g.closePath();
  const gr = g.createLinearGradient(0, y0, 0, y0 + th);
  gr.addColorStop(0, "#2a2a2c"); gr.addColorStop(0.55, "#111113"); gr.addColorStop(1, "#1b1b1d");
  g.fillStyle = gr; g.fill();
  g.shadowColor = "transparent";
  // 눌려 튀어나온 글자: 아래 그늘 · 위 하이라이트 · 흰 글자
  g.textBaseline = "middle";
  const draw = (dx, dy, color) => { g.fillStyle = color; let x = x0 + px + dx; for (const ch of label) { if (x > x0 + tw + px) break; g.fillText(ch, x, y0 + th / 2 + dy); x += g.measureText(ch).width + sp; } };
  draw(0, -1.2, "rgba(0,0,0,.9)");
  draw(0, 1.2, "rgba(255,255,255,.22)");
  draw(0, 0, "#f2f2ee");
  g.restore();
  return c;
}
