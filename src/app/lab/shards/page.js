"use client";
import dynamic from "next/dynamic";

// /lab/shards — 표면의 파편이 커서 근처에서 구 모양으로 밀려나는 효과 예시 (임시, 메뉴에 없음)
const ShardsTest = dynamic(() => import("@/components/shards/ShardsTest"), { ssr: false });

export default function ShardsPage() {
  return (
    <div className="page" style={{ overflow: "hidden" }}>
      <ShardsTest />
    </div>
  );
}
