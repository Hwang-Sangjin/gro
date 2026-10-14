// 어느 페이지에도 맞지 않는 주소 → 404 화면
// notFound()를 쓰지 않고 직접 그리는 이유: Next의 404 처리는 페이지 넘김 틀(CrateStage) 바깥에서 화면을 통째로 바꾸고,
// 맞는 경로가 없으면 사이트를 새로 불러와서(로딩 화면) 다른 페이지 같은 넘김 전환을 못 씀.
// 대신 검색엔진에는 색인하지 말라고 알림 (noindex)
import NotFoundView from "@/components/notfound/NotFoundView";

export const metadata = { title: "Not found · Grooves", robots: { index: false, follow: true } };

export default function Missing() {
  return <NotFoundView />;
}
