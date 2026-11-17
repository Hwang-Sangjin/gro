"use client";
import dynamic from "next/dynamic";

// Home = 3D 거실 이야기 (src/components/roomtest/RoomTest.jsx), 페이지 스크롤에 이어진 한 장면 (flow="scroll")
//  LP 재킷 줄(heroMode="sleeve": 끌어 넘기기 · 열면 판이 나옴 · 판을 누르거나 스크롤하면) → 판이 수평으로 누우며 턴테이블에 앉음 → 방이 Blender 시간대로 지어짐(되돌리면 역재생)
//  (2026-11-16 까지는 잉크 판 Hero: heroMode="ink". 되돌리려면 그 값으로)
//  → 방 완성 → New Vinyls(끝없이 끄는 앨범 갤러리) → News → 늦은 밤의 방 → Footer. 스크롤 영역(.page)은 RoomTest 가 직접 만듦
const RoomTest = dynamic(() => import("@/components/roomtest/RoomTest"), { ssr: false });

export default function Home() {
  return <RoomTest heroMode="sleeve" flow="scroll" />;
}
