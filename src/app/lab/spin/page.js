// /lab/spin — 조에트로프 판: 판 둘레의 프레임이 스트로브 아래에서 움직이는 그림이 됨 (글자 · GIF · 짧은 영상)
import PageShell from "@/components/layout/PageShell";
import SpinStudio from "@/components/spin/SpinStudio";

export const metadata = {
  title: "Spin · Lab · Grooves",
  description: "Put frames around a spinning record and watch them move under a strobe — type a word or drop in a GIF or short clip.",
};

export default function SpinPage() {
  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0! [&>.page-content]:p-0!">
      {/* 본문이 한국어 (화면 낭독기가 한국어로 읽게). contents: 레이아웃에는 없는 상자 */}
      <div lang="ko" className="contents"><SpinStudio /></div>
    </PageShell>
  );
}
