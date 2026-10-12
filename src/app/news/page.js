// /news — News & Stories (스토리는 코드로 만든 글: src/content/news)
import PageShell from "@/components/layout/PageShell";
import NewsIndex from "@/components/news/NewsIndex";

export const metadata = {
  title: "News & Stories · Grooves",
  description: "Vinyl news, the A to Z of records, and picks for what to play next.",
};

export default function News() {
  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0 [&>.page-content]:p-0">
      <NewsIndex />
    </PageShell>
  );
}
