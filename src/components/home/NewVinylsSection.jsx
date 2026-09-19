"use client";
import { useState } from "react";

import VinylShelf from "./VinylShelf";

const ITEMS = [
  { id: 1, title: "Soft Hours", artist: "Marian Vale", color: "#c4573a" },
  { id: 2, title: "Blue Notes", artist: "The Lanes", color: "#7fa3c7" },
  { id: 3, title: "After Sunset", artist: "Noa Hill", color: "#c4573a" },
  { id: 4, title: "Slow Motion", artist: "Kite & Co", color: "#4a6b8a" },
  { id: 5, title: "Midnight Tides", artist: "Aera", color: "#7fa3c7" },
  { id: 6, title: "Orbit Always", artist: "Pale Signal", color: "#2f3a4a" },
  { id: 7, title: "Quiet Places", artist: "Hallim", color: "#c4573a" },
];

// 목업의 4각 별
function Star({ className }) {
  return (
    <svg viewBox="-16 -16 32 32" className={className} aria-hidden="true">
      <path
        d="M0-15C1.5-4 4-1.5 15 0 4 1.5 1.5 4 0 15-1.5 4-4 1.5-15 0-4-1.5-1.5-4 0-15Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function NewVinylsSection() {
  const [active, setActive] = useState(0);
  const item = ITEMS[active] ?? ITEMS[0];

  return (
    <section className="relative flex h-[100svh] w-full flex-col overflow-hidden">
      {/* 타이틀 — 3D 위에 떠 있되 드래그를 막지 않는다 */}
      <div className="pointer-events-none absolute top-[calc(var(--navbar-h)*0.55)] left-[var(--gutter)] z-10">
        <h2 className="ink-grain text-[clamp(3rem,8.5vw,9rem)] leading-[0.92] font-black tracking-tight uppercase">
          <span className="flex items-center gap-[0.18em]">
            New
            <Star className="h-[0.3em] w-[0.3em] text-[color:var(--frame)]" />
          </span>
          <span className="block">Vinyls</span>
        </h2>
      </div>

      {/* 3D 진열대 — 섹션 전체를 채운다 */}
      <div className="absolute inset-0 z-0">
        <VinylShelf items={ITEMS} onActiveChange={setActive} />
      </div>

      {/* 하단 좌: 현재 앨범 / 하단 중앙: 드래그 힌트 */}
      <div className="pointer-events-none absolute inset-x-[var(--gutter)] bottom-8 z-10 flex items-end justify-between gap-8">
        <div>
          <span className="block text-[0.75rem] tracking-[0.14em] opacity-60">
            {String(active + 1).padStart(2, "0")} /{" "}
            {String(ITEMS.length).padStart(2, "0")}
          </span>
          <strong className="mt-1 block text-[1.15rem] font-medium">
            {item.title}
          </strong>
          <span className="block text-[0.85rem] opacity-60">{item.artist}</span>
        </div>

        <span className="absolute left-1/2 -translate-x-1/2 text-[0.7rem] tracking-[0.22em] uppercase opacity-55">
          Drag to explore ↗
        </span>

        <span aria-hidden="true" className="w-24" />
      </div>
    </section>
  );
}
