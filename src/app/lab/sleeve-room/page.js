"use client";
import dynamic from "next/dynamic";

// /lab/sleeve-room — 새 Home Hero 5단계: LP 재킷 줄 → 열면 판이 나오고 → 판이 3D 방의 턴테이블로 (임시, 메뉴에 없음)
//  Home 과 같은 한 장면 흐름(RoomTest flow="scroll")에 Hero 만 재킷 줄로 바꾼 것. 스크롤 영역(.page)은 RoomTest 가 직접 만듦
const RoomTest = dynamic(() => import("@/components/roomtest/RoomTest"), { ssr: false });

export default function SleeveRoomPage() {
  return <RoomTest heroMode="sleeve" flow="scroll" />;
}
