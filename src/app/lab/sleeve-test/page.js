"use client";
import dynamic from "next/dynamic";

// /lab/sleeve-test — 새 Home Hero 1단계: 실제 같은 LP 재킷 + 판 한 장 (임시, 메뉴에 없음)
const SleeveTest = dynamic(() => import("@/components/sleevetest/SleeveTest"), { ssr: false });

export default function SleeveTestPage() {
  return (
    <div className="page" style={{ overflow: "hidden" }}>
      <SleeveTest />
    </div>
  );
}
