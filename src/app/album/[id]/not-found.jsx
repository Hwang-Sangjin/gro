import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
export default function AlbumNotFound() {
  return <PageShell><div data-album-fallback className="flex flex-col items-start gap-5">
    <h1 className="text-3xl">This record isn’t in the crate.</h1>
    <Link href="/digging">← Back to Digging</Link>
  </div></PageShell>;
}
