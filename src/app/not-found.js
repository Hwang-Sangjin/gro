// notFound() 를 부른 페이지(없는 앨범·비공개 컬렉션 등)의 404 — 모양은 같은 404 화면
import NotFoundView from "@/components/notfound/NotFoundView";

export const metadata = { title: "Not found · Grooves", robots: { index: false, follow: true } };

export default function NotFound() {
  return <NotFoundView />;
}
