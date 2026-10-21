// /lab/brick — 앨범 커버·내 사진을 32×32 브릭 모자이크로 (3D 판 + 색별 개수)
import PageShell from "@/components/layout/PageShell";
import BrickStudio from "@/components/brick/BrickStudio";

export const metadata = {
  title: "Brick · Lab · Grooves",
  description: "Turn an album cover or your own photo into a 32×32 brick mosaic and see how many bricks of each color you need.",
};

export default function BrickPage() {
  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0! [&>.page-content]:p-0!">
      <BrickStudio />
    </PageShell>
  );
}
