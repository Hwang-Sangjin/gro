"use client";
import dynamic from "next/dynamic";

// Home = 한 화면(100svh)에서 4개 섹션을 전환하는 스테이지 (Hero → New Vinyls → Genre dial → News).
// 섹션 전환은 HomeStage가, 페이지 사이 이동은 기존 Crate Flip이 담당한다. docs/HOME-STAGE.md 참고.
const HomeStage = dynamic(() => import("@/components/home/stage/HomeStage"), { ssr: false });

export default function Home() {
  return (
    // 스크롤 컨테이너(.page)는 유지하되 스크롤하지 않음 — 휠·터치는 스테이지가 섹션 전환으로 씀
    <div className="page home paper-textured" style={{ overflow: "hidden" }}>
      <div className="page-content">
        <HomeStage />
      </div>
    </div>
  );
}
