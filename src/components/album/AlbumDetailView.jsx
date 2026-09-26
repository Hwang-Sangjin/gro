"use client";

import { useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";

function foreground(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex.slice(1) : "bbcbda";
  const channels = [0, 2, 4].map(i => {
    const v = parseInt(value.slice(i, i + 2), 16) / 255;
    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? "#171717" : "#ffffff";
}

// Presentational only: complete URLs and camelCase props come from the page.
export default function AlbumDetailView({ album }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const color = album.coverColor || "#bbcbda";
  return (
    <PageShell className="album-detail-page">
      <div className="album-detail-surface" style={{ backgroundColor: color, color: foreground(color) }}>
        <Link href="/digging" className="mb-8 inline-block text-sm underline-offset-4 hover:underline">← Digging</Link>
        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <div data-album-cover={album.slug} className="relative aspect-square w-full max-w-[560px] overflow-hidden shadow-2xl" style={{ backgroundColor: color }}>
            <div className="absolute inset-0 flex items-center justify-center border border-current/20 text-sm">커버 이미지가 없습니다</div>
            {album.thumbUrl && <img src={album.thumbUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />}
            {album.coverUrl && !failed && <img src={album.coverUrl} alt={`${album.title} 앨범 커버`} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: loaded ? 1 : 0 }} />}
          </div>
          <div className="flex flex-col gap-6 md:pt-6">
            <p className="text-xs uppercase tracking-[.2em]">{[album.format, album.releaseYear].filter(Boolean).join(" · ")}</p>
            <h1 data-album-heading tabIndex={-1} className="text-4xl leading-tight outline-none md:text-6xl">{album.title}</h1>
            <p className="text-xl opacity-80">{album.artistNames || "아티스트 정보가 없습니다"}</p>
            {album.label && <p className="text-sm opacity-70">Label — {album.label}</p>}
            {album.description && <p className="max-w-xl whitespace-pre-line text-base leading-relaxed opacity-85">{album.description}</p>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
