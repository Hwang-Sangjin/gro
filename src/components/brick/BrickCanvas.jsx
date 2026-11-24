"use client";
// Brick 2D 판 — 32×32 칸을 평평한 브릭으로 그림 (네모 + 가운데 둥근 스터드, 위는 밝게 · 아래는 그림자)
// - 처음/새 이미지: 많은 색부터 브릭이 위에서 눌러 끼워지듯 톡 나타남 (새 이미지면 이전 그림 위에 덮임)
// - 보정만 바뀜: 색이 바뀐 칸만 다시 끼워짐
// - hover(팔레트 번호): 그 색 브릭만 살짝 떠오르고 나머지는 어두워짐
// - replay: { color: 번호 | null(전체), nonce } — 다시 끼우기
// - onHoverColor: 판 위에서 가리킨 칸의 색 번호 (밖으로 나가면 null)
import { useEffect, useRef } from "react";
import { PALETTE } from "@/lib/brick/palette";

const DROP = 0.38;          // 브릭 하나가 끼워지는 시간(초)
const PLATE = "#2b242b";    // 빈 판(아직 브릭이 없는 칸)
const GAP = "#191419";      // 칸 사이 홈
const easeOutBack = (t) => { const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const now = () => performance.now() / 1000;

// 색 순서대로 시작 시간 (counts = 많은 색부터). only: 그 색만 / changed: 바뀐 칸만
function schedule(cells, counts, t0, only = null, changed = null) {
  const n = cells.length;
  const start = new Float32Array(n);
  if (changed) { for (let i = 0; i < n; i++) start[i] = changed[i] ? t0 + Math.random() * 0.35 : -2; return start; }
  const groups = only == null ? counts : counts.filter((c) => c.index === only);
  const total = groups.reduce((s, g) => s + g.count, 0) || 1;
  const at = new Map();
  let t = t0;
  for (const g of groups) { const dur = 0.18 + 2.2 * (g.count / total); at.set(g.index, [t, dur]); t += dur; }
  for (let i = 0; i < n; i++) {
    const g = at.get(cells[i]);
    start[i] = g ? g[0] + Math.random() * g[1] * 0.9 : -2;   // -2 = 이미 끼워져 있음
  }
  return start;
}

// 한 칸 크기의 명암 그림 (색 없이 밝게/어둡게만) — 칸마다 색을 칠한 뒤 위에 얹음
function shadeTile(s) {
  const c = document.createElement("canvas");
  c.width = c.height = Math.max(1, Math.round(s));
  const g = c.getContext("2d");
  const w = c.width;
  // 위아래 빛: 위쪽 살짝 밝게, 아래쪽 살짝 어둡게
  const lin = g.createLinearGradient(0, 0, 0, w);
  lin.addColorStop(0, "rgba(255,255,255,.16)"); lin.addColorStop(0.35, "rgba(255,255,255,0)");
  lin.addColorStop(0.7, "rgba(0,0,0,0)"); lin.addColorStop(1, "rgba(0,0,0,.2)");
  g.fillStyle = lin; g.fillRect(0, 0, w, w);
  // 모서리: 위·왼쪽 밝은 선, 아래·오른쪽 어두운 선
  const e = Math.max(1, w * 0.035);
  g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(0, 0, w, e); g.fillRect(0, 0, e, w);
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(0, w - e, w, e); g.fillRect(w - e, 0, e, w);
  // 스터드
  const cx = w / 2, cy = w / 2, r = w * 0.3;
  const sh = g.createRadialGradient(cx + w * 0.05, cy + w * 0.08, r * 0.6, cx + w * 0.05, cy + w * 0.08, r * 1.35);
  sh.addColorStop(0, "rgba(0,0,0,.42)"); sh.addColorStop(1, "rgba(0,0,0,0)");
  // 그림자는 스터드 바깥에만 (스터드 윗면은 바탕 색 그대로 보이게)
  g.save(); g.beginPath(); g.rect(0, 0, w, w); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip("evenodd");
  g.fillStyle = sh; g.beginPath(); g.arc(cx + w * 0.05, cy + w * 0.08, r * 1.35, 0, Math.PI * 2); g.fill();
  g.restore();
  // 스터드 윗면: 왼쪽 위 밝게 → 오른쪽 아래 살짝 어둡게
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(0, 0, w, w);
  const top = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  top.addColorStop(0, "rgba(255,255,255,.2)"); top.addColorStop(0.55, "rgba(255,255,255,0)"); top.addColorStop(1, "rgba(0,0,0,.12)");
  g.fillStyle = top; g.fillRect(0, 0, w, w);
  g.restore();
  // 테두리: 왼쪽 위 빛, 오른쪽 아래 어두운 초승달
  g.lineWidth = Math.max(1, w * 0.035);
  const rim = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, "rgba(255,255,255,.55)"); rim.addColorStop(0.45, "rgba(255,255,255,.08)");
  rim.addColorStop(0.6, "rgba(0,0,0,.08)"); rim.addColorStop(1, "rgba(0,0,0,.42)");
  g.strokeStyle = rim; g.beginPath(); g.arc(cx, cy, r - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
  return c;
}

export default function BrickCanvas({ mosaic, sourceKey, hover = null, replay, n = 32, show = true, onHoverColor, className = "" }) {
  const wrap = useRef(null);
  const cv = useRef(null);
  const st = useRef(null);
  if (!st.current) st.current = {
    cells: null, under: new Int16Array(n * n).fill(-1), start: new Float32Array(n * n).fill(-1),
    lift: new Float32Array(n * n), dim: new Float32Array(n * n), hover: null,
    size: 0, dpr: 1, tile: null, raf: 0, lastKey: null, waiting: false, lastCell: -1,
  };
  const reduced = useRef(false);
  const kick = useRef(() => {});
  const showRef = useRef(show);
  showRef.current = show;

  // 그리기 + 움직임이 남아 있으면 다음 프레임
  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = st.current;
    const draw = () => {
      s.raf = 0;
      const c = cv.current;
      if (!c || !s.size) return;
      const g = c.getContext("2d");
      const W = c.width, cell = W / n, gap = Math.max(1, cell * 0.04);
      const t = now();
      const red = reduced.current;
      let busy = false;
      g.fillStyle = GAP; g.fillRect(0, 0, W, W);
      const drawBrick = (x, y, color, scale, alpha, lift) => {
        const sz = (cell - gap) * scale;
        const px = x + (cell - sz) / 2, py = y + (cell - sz) / 2;
        if (lift > 0.01) { g.globalAlpha = alpha * 0.45 * Math.min(1, lift); g.fillStyle = "#000"; g.fillRect(px + cell * 0.1 * lift, py + cell * 0.16 * lift, sz, sz); }
        g.globalAlpha = alpha;
        g.fillStyle = color; g.fillRect(px, py, sz, sz);
        g.drawImage(s.tile, px, py, sz, sz);
      };
      const order = [];   // 떠오른 칸은 나중에 (이웃 위에 그림자가 지게)
      for (let i = 0; i < n * n; i++) {
        const x = (i % n) * cell, y = Math.floor(i / n) * cell;
        const want = s.hover == null ? 0 : s.cells?.[i] === s.hover ? 1 : 0;
        const wd = s.hover == null || s.cells?.[i] === s.hover ? 0 : 0.6;
        if (red) { s.lift[i] = want; s.dim[i] = wd; }
        else { s.lift[i] += (want - s.lift[i]) * 0.2; s.dim[i] += (wd - s.dim[i]) * 0.16; }
        if (Math.abs(want - s.lift[i]) > 0.003 || Math.abs(wd - s.dim[i]) > 0.003) busy = true;
        if (s.lift[i] > 0.01) { order.push(i); continue; }
        drawCell(i, x, y);
      }
      for (const i of order) drawCell(i, (i % n) * cell, Math.floor(i / n) * cell);
      g.globalAlpha = 1;
      function drawCell(i, x, y) {
        const u = s.under[i];
        const start = s.start[i];
        const k = !s.cells ? 0 : start === -2 ? 1 : start < 0 ? 0 : Math.min(1, Math.max(0, (t - start) / DROP));
        if (k < 1) {
          drawBrick(x, y, u < 0 ? PLATE : PALETTE[u].hex, 1, 1, 0);
          if (start >= 0) busy = true;
        }
        if (k > 0) {
          const e = easeOutBack(k);
          const scale = 1 + (1 - e) * 0.55 + s.lift[i] * 0.07;
          drawBrick(x, y, PALETTE[s.cells[i]].hex, scale, Math.min(1, k * 2.5), Math.max(s.lift[i], (scale - 1) * 2.2));
          if (k >= 1 && start !== -2) { s.start[i] = -2; s.under[i] = s.cells[i]; }
        }
        const dim = s.dim[i];
        if (dim > 0.01) { g.globalAlpha = dim; g.fillStyle = GAP; g.fillRect(x, y, cell, cell); g.globalAlpha = 1; }
      }
      if (busy) s.raf = requestAnimationFrame(draw);
    };
    kick.current = () => { if (!s.raf) s.raf = requestAnimationFrame(draw); };

    const fit = () => {
      const el = wrap.current, c = cv.current;
      if (!el || !c) return;
      const size = Math.floor(el.clientWidth);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (size === s.size && dpr === s.dpr) return;
      s.size = size; s.dpr = dpr;
      c.width = c.height = Math.round(size * dpr);
      const cell = c.width / n;
      s.tile = shadeTile(cell - Math.max(1, cell * 0.04));
      kick.current();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current);
    fit();
    return () => { ro.disconnect(); cancelAnimationFrame(s.raf); s.raf = 0; };
  }, [n]);

  // 새 모자이크
  useEffect(() => {
    if (!mosaic) return;
    const s = st.current;
    const { cells, counts } = mosaic;
    const t = now();
    const red = reduced.current;
    const settled = () => new Float32Array(cells.length).fill(-2);
    if (s.lastKey === null) {
      s.waiting = !red && !showRef.current;
      s.start = red ? settled() : s.waiting ? new Float32Array(cells.length).fill(-1) : schedule(cells, counts, t + 0.35);
    } else if (s.lastKey !== sourceKey) {
      // 다른 이미지 → 지금 그림 위로 새 브릭이 덮임
      if (s.cells) for (let i = 0; i < cells.length; i++) if (s.start[i] === -2) s.under[i] = s.cells[i];
      s.start = red ? settled() : schedule(cells, counts, t + 0.05);
    } else {
      // 보정만 바뀜 → 바뀐 칸만
      const changed = s.cells ? cells.map((c, i) => (c !== s.cells[i] ? 1 : 0)) : null;
      if (s.cells) for (let i = 0; i < cells.length; i++) if (changed?.[i]) s.under[i] = s.cells[i];
      s.start = red ? settled() : schedule(cells, counts, t, null, changed);
    }
    if (red) s.under = Int16Array.from(cells);
    s.cells = cells;
    s.lastKey = sourceKey;
    kick.current();
  }, [mosaic]); // eslint-disable-line react-hooks/exhaustive-deps

  // 판이 나타나면 기다리던 브릭을 끼우기 시작
  useEffect(() => {
    const s = st.current;
    if (!show || !s.waiting || !s.cells || !mosaic) return;
    s.waiting = false;
    s.start = schedule(s.cells, mosaic.counts, now() + 0.45);
    kick.current();
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  // 다시 끼우기: 그 칸은 빈 판에서 다시 시작
  useEffect(() => {
    const s = st.current;
    if (!replay?.nonce || !mosaic || !s.cells || reduced.current) return;
    const start = schedule(s.cells, mosaic.counts, now() + 0.1, replay.color);
    for (let i = 0; i < start.length; i++) {
      if (replay.color != null && s.cells[i] !== replay.color) start[i] = s.start[i] === -2 ? -2 : s.start[i];
      else s.under[i] = -1;
    }
    s.start = start;
    kick.current();
  }, [replay?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { st.current.hover = hover; kick.current(); }, [hover]);

  const onMove = (e) => {
    const s = st.current;
    if (!onHoverColor || !s.cells || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * n), y = Math.floor(((e.clientY - r.top) / r.height) * n);
    const i = x >= 0 && y >= 0 && x < n && y < n ? y * n + x : -1;
    if (i === s.lastCell) return;
    s.lastCell = i;
    onHoverColor(i < 0 ? null : s.cells[i]);
  };

  return (
    <div ref={wrap} className={className}>
      <canvas ref={cv} role="img" aria-label={`${n}×${n} 브릭 모자이크`} onPointerMove={onMove}
        onPointerLeave={() => { st.current.lastCell = -1; onHoverColor?.(null); }}
        className="block size-full rounded-[4px] shadow-[0_24px_40px_-24px_rgba(0,0,0,.6),0_2px_0_rgba(0,0,0,.25)]" />
    </div>
  );
}
