"use client";
import dynamic from "next/dynamic";

// /lab/room-test — 레코드판 한 장만 (임시 확인 페이지, 메뉴에 없음)
const VinylOnly = dynamic(() => import("@/components/roomtest/VinylOnly"), { ssr: false });

export default function RoomTestPage() {
  return <VinylOnly />;
}
