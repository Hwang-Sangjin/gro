"use client";
import dynamic from "next/dynamic";

// /lab/env-test — 방 바깥 2.5D 배경 레이어 자리 잡기용 테스트 (임시, 메뉴에 없음)
const EnvTest = dynamic(() => import("@/components/envtest/EnvTest"), { ssr: false });

export default function EnvTestPage() {
  return (
    <div className="page" style={{ overflow: "hidden" }}>
      <EnvTest />
    </div>
  );
}
