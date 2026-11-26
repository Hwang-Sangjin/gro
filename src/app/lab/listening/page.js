// /lab/listening — 프로토타입: 책등 선반에서 판을 뽑으면 그 자리(무대)에서 돌며 소리가 남
//  Collection 과 듣기를 한 화면에 합치면 어떤지 보려는 실험 (실제 Collection 은 그대로)
import PageShell from "@/components/layout/PageShell";
import ListeningStudio from "@/components/listening/ListeningStudio";

export const metadata = {
  title: "Listening · Lab · Grooves",
  description: "Pull a record from the shelf and drop the needle.",
  robots: { index: false },
};

export default function ListeningPage() {
  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0! [&>.page-content]:p-0!">
      <ListeningStudio />
    </PageShell>
  );
}
