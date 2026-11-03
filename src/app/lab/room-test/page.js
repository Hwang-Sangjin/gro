"use client";
import dynamic from "next/dynamic";

// /lab/room-test — Home 리디자인용 거실 GLB 확인 페이지 (임시, 메뉴에 없음)
const RoomTest = dynamic(() => import("@/components/roomtest/RoomTest"), { ssr: false });

export default function RoomTestPage() {
  return (
    <div className="page" style={{ overflow: "hidden" }}>
      <RoomTest />
    </div>
  );
}
