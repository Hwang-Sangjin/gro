"use client";
// 올린 사진을 정사각형으로 자르기 — 끌어서 위치, 슬라이더로 확대. 결과: 원본 픽셀 기준 { x, y, size }
import { useEffect, useRef, useState } from "react";

const VIEW = 300;   // 미리보기 한 변(px)

export default function CropDialog({ img, onCancel, onDone }) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const base = Math.min(w, h);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: (w - base) / 2, y: (h - base) / 2 });
  const drag = useRef(null);
  const size = base / zoom;
  const clampPos = (p, s = size) => ({ x: Math.min(w - s, Math.max(0, p.x)), y: Math.min(h - s, Math.max(0, p.y)) });
  // 확대할 때 가운데를 기준으로
  const zoomTo = (z) => {
    const s0 = size, s1 = base / z;
    setPos((p) => clampPos({ x: p.x + (s0 - s1) / 2, y: p.y + (s0 - s1) / 2 }, s1));
    setZoom(z);
  };
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);
  const scale = VIEW / size;   // 원본 px → 화면 px

  return (
    <div role="dialog" aria-modal="true" aria-label="Crop image" className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className="w-full max-w-[380px] rounded-[6px] border-[3px] border-(--ink) bg-(--cream) p-5 text-(--ink) shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-(--accent)">Crop</p>
        <p className="mt-1 text-[14px] text-(--ink)/70">끌어서 위치를 맞추고, 아래에서 확대해요. 32×32 판에 들어갈 정사각형이에요.</p>
        <div
          className="relative mx-auto mt-4 cursor-grab touch-none overflow-hidden rounded-[3px] bg-(--ink)/10 active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, p: pos }; }}
          onPointerMove={(e) => { const d = drag.current; if (!d) return; setPos(clampPos({ x: d.p.x - (e.clientX - d.x) / scale, y: d.p.y - (e.clientY - d.y) / scale })); }}
          onPointerUp={() => { drag.current = null; }}
        >
          <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none"
            style={{ width: w * scale, height: h * scale, left: -pos.x * scale, top: -pos.y * scale }} />
          {/* 32칸 격자 */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.18)_1px,transparent_1px)] bg-[length:calc(100%/32)_calc(100%/32)]" />
        </div>
        <label className="mt-4 flex items-center gap-3 text-[12px] uppercase tracking-[0.18em]">
          Zoom
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => zoomTo(Number(e.target.value))} className="flex-1 accent-(--accent)" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-(--ink)/40 px-5 text-[12px] font-medium uppercase tracking-[0.16em]">Cancel</button>
          <button type="button" onClick={() => onDone({ x: pos.x, y: pos.y, size })} className="min-h-11 rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.16em] text-(--cream) hover:bg-(--accent)">Use this</button>
        </div>
      </div>
    </div>
  );
}
