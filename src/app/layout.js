import Providers from "@/components/Provider";
import "./globals.css";
import { THEME_BOOT } from "@/lib/themeBoot";


export const metadata = {
  title: "Grooves",
  description: "Vinyl digging for record collectors — find records, listen, and keep your collection.",
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
