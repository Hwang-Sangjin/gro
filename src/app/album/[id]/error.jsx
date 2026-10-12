"use client";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
export default function AlbumError({ reset }) {
  return <PageShell><div data-album-fallback className="flex flex-col items-start gap-5">
    <h1 className="text-3xl">Couldn’t load this record.</h1>
    <button onClick={reset} className="rounded-full border border-current px-5 py-2">Try again</button>
    <Link href="/digging">← Back to Digging</Link>
  </div></PageShell>;
}
