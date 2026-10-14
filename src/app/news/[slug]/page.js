// /news/[slug] — 스토리 한 편 (본문은 src/content/news/<slug>/Story.jsx)
import { notFound } from "next/navigation";
import { STORIES, getStory } from "@/content/news";
import StoryShell from "@/components/news/StoryShell";

export function generateStaticParams() {
  return STORIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const s = getStory(slug);
  return s ? {
    title: `${s.title} · Grooves`, description: s.dek,
    // 스토리 전용 이미지는 News 개편 때 — 그때까지 사이트 대표 이미지 (openGraph 를 덮어쓰면 상위 이미지가 빠지므로 직접 지정)
    openGraph: { type: "article", siteName: "Grooves", title: s.title, description: s.dek, publishedTime: s.date, images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  } : {};
}

export default async function StoryPage({ params }) {
  const { slug } = await params;
  const meta = getStory(slug);
  if (!meta) notFound();
  return <StoryShell meta={meta} />;
}
