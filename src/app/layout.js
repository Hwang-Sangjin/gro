import Providers from "@/components/Provider";
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 저장된 테마(다크)를 첫 화면부터 — React 보다 먼저 실행 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link
          rel="stylesheet"
          href="https://fonts.cdnfonts.com/css/pp-neue-montreal"
        />
      </head>
      <body>
        {/* ReactLenis / Navbar / Preloader 는 전부 Providers 안으로 이동 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
