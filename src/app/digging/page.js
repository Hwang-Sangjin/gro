import PageShell from "@/components/layout/PageShell";
import DiggingCatalog from "@/components/digging/DiggingCatalog";
import { publicClient } from "@/lib/publicSupabase";
import { fetchDiggingPage, newShuffleSeed } from "@/lib/albums";
import styles from "@/components/digging/Digging.module.css";

export const metadata = {
  title: "Digging · Grooves",
  description: "Dig through the crate — browse records by genre, listen, and add them to your shelf.",
  alternates: { canonical: "/digging" },
  openGraph: {
    type: "website", siteName: "Grooves", title: "Digging · Grooves",
    description: "Dig through the crate — browse records by genre, listen, and add them to your shelf.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

// 첫 화면(전체 장르, 섞은 순서)을 미리 만들어 캐시해 둠 → 헤더에서 누르면 미리 받아 둔 페이지로 바로 넘어감
// 섞는 순서는 10분마다 바뀜(그 사이엔 같은 순서). ?genre= 로 들어오면 화면에서 그 장르로 바로 바꿈 (DiggingCatalog)
export const revalidate = 600;

export default async function Digging() {
  const seed = newShuffleSeed();
  // 못 읽으면 빈 첫 화면 → 화면에서 바로 이어서 불러옴 (빌드·캐시가 오류로 멈추지 않게)
  const initial = await fetchDiggingPage(publicClient(), { seed })
    .catch(() => ({ items: [], cursor: null, hasMore: true, seed }));
  return (
    <PageShell className={`${styles.page} paper-textured`}>
      <DiggingCatalog initial={initial} genreId={null} genre={null} />
    </PageShell>
  );
}
