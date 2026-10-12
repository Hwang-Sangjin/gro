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
  return s ? { title: `${s.title} · Grooves`, description: s.dek } : {};
}

export default async function StoryPage({ params }) {
  const { slug } = await params;
  const meta = getStory(slug);
  if (!meta) notFound();
  return <StoryShell meta={meta} />;
}
