import Providers from "@/components/Provider";
import "@fontsource/hahmlet/400.css";
import "@fontsource/hahmlet/500.css";
import "@fontsource/hahmlet/700.css";
import "@fontsource/hahmlet/900.css";
import "@fontsource/monoton/400.css";   // 디스플레이 제목 (lib/fonts.js MONOTON)
import "./globals.css";
import { THEME_BOOT } from "@/lib/themeBoot";
import { SITE } from "@/lib/site";


export const metadata = {
  metadataBase: new URL(SITE.url),   // 상대 주소(canonical·공유 이미지)를 이 주소 기준으로
  title: "Grooves",
  description: "Vinyl digging for record collectors — find records, listen, and keep your collection.",
  // 링크 카드(카톡·SNS): 이미지는 app/opengraph-image.js (페이지마다 따로 있으면 그쪽)
  openGraph: {
    type: "website", siteName: "Grooves", locale: "en_US",
    title: "Grooves",
    description: "Vinyl digging for record collectors — find records, listen, and keep your collection.",
  },
  twitter: { card: "summary_large_image" },
  // 검색엔진 소유 확인 (Google Search Console · 네이버 서치어드바이저는 받으면 other 에 추가)
  verification: { google: "gkGSd-Emi1jRvFxJaebRQs9tqtp_0agkk0H9HmNOHP0" },
};

const SUPABASE_ORIGIN = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin; } catch { return null; } })();

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 저장된 테마(다크)를 첫 화면부터 — React 보다 먼저 실행 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* 미리 받기 · 미리 연결 (2026-11-22 최적화)
            - 제목 글꼴(Grooves Display): 모든 페이지의 워드마크 · Home 의 큰 제목이 씀. CSS 를 다 읽은 뒤에야 받기 시작하던 것을 처음부터
            - Supabase: 앨범 커버(그림)와 데이터 요청이 가는 곳. 첫 요청 전에 연결(DNS · TLS)을 맺어 둠 — 그림용(쿠키 포함 연결)과 fetch 용(anonymous) 둘 다 */}
        <link rel="preload" href="/fonts/gloock-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} />}
        {SUPABASE_ORIGIN && <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />}
      </head>
      <body>
        {/* ReactLenis / Navbar / Preloader 는 전부 Providers 안으로 이동 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
