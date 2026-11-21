// /lab/map — 레코드숍·LP 바·리스닝룸 지도 (MapLibre + OpenFreeMap, Grooves 색으로 칠한 타일)
import PageShell from "@/components/layout/PageShell";
import MapStudio from "@/components/map/MapStudio";

export const metadata = {
  title: "Map · Lab · Grooves",
  description: "Record shops, LP bars and listening rooms on one map of Seoul.",
};

export default function MapPage() {
  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0! [&>.page-content]:p-0!">
      {/* 본문이 한국어 (화면 낭독기가 한국어로 읽게). contents: 레이아웃에는 없는 상자 */}
      <div lang="ko" className="contents"><MapStudio /></div>
    </PageShell>
  );
}
