import Providers from "@/components/Provider";
import "./globals.css";
import ViewportVars from "@/components/viewport/ViewportVars";


export const metadata = {
  title: "View Transition API | Codegrid",
  description: "View Transition API | Codegrid",
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
        <ViewportVars />
        {/* ReactLenis / Navbar / Preloader 는 전부 Providers 안으로 이동 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
