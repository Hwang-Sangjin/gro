"use client";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
export default function AlbumError({ reset }) {
  return <PageShell><div data-album-fallback className="flex flex-col items-start gap-5">
    <h1 className="text-3xl">앨범을 불러오지 못했어요.</h1>
    <button onClick={reset} className="rounded-full border border-current px-5 py-2">다시 시도</button>
    <Link href="/digging">← Digging으로 돌아가기</Link>
  </div></PageShell>;
}
