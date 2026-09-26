import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
export default function AlbumNotFound() {
  return <PageShell><div data-album-fallback className="flex flex-col items-start gap-5">
    <h1 className="text-3xl">공개된 앨범을 찾을 수 없어요.</h1>
    <Link href="/digging">← Digging으로 돌아가기</Link>
  </div></PageShell>;
}
