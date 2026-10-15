// /collection — 내 판 (로그인한 사람만 의미가 있어 검색엔진에는 안 보임; 공개 컬렉션은 /collection/<아이디>)
import MyCollection from "@/components/collection/MyCollection";

export const metadata = {
  title: "Collection · Grooves",
  description: "Your record shelf on Grooves — what you own and what you’re hunting for.",
  robots: { index: false },
};

export default function Collection() {
  return <MyCollection />;
}
