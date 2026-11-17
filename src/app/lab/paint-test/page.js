"use client";
import dynamic from "next/dynamic";

// /lab/paint-test — 유화 밤하늘 배경 셰이더 테스트 (임시, 메뉴에 없음)
const PaintTest = dynamic(() => import("@/components/painttest/PaintTest"), { ssr: false });

export default function PaintTestPage() {
  return (
    <div className="page" style={{ overflow: "hidden" }}>
      <PaintTest />
    </div>
  );
}
