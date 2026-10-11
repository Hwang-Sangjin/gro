import Providers from "@/components/Provider";
import "./globals.css";


export const metadata = {
  title: "Grooves",
  description: "LP 컬렉터를 위한 바이닐 디깅 — 판을 찾고, 듣고, 내 컬렉션에 꽂아 두기.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
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
