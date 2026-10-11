"use client";
// 앨범 상세 맨 위 "← Back to Digging / Collection" — 앨범을 연 목록으로 돌아감
import Link from "next/link";
import { useAlbumOrigin } from "@/lib/albumOrigin";

export default function AlbumBackLink({ slug, className = "" }) {
  const { href, label } = useAlbumOrigin(slug);
  return (
    <Link href={href} className={`group inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-[.24em] focus-visible:outline-2 focus-visible:outline-offset-4 ${className}`}>
      <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-current/35 transition-[translate,background-color] duration-300 group-hover:-translate-x-1 group-hover:bg-current/10">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13 8H3M7 4 3 8l4 4" /></svg>
      </span>
      <span className="relative py-1">
        Back to {label}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-right scale-x-0 bg-current transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100" />
      </span>
    </Link>
  );
}
