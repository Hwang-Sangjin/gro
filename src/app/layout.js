import Providers from "@/components/Provider";
import "./globals.css";
import ViewportVars from "@/components/viewport/ViewportVars";
import DiscColor from "@/components/viewport/DiscColor";

export const metadata = {
  title: "View Transition API | Codegrid",
  description: "View Transition API | Codegrid",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="disc" aria-hidden="true" />
        <ViewportVars />
        <DiscColor />
        {/* ReactLenis / Navbar / Preloader 는 전부 Providers 안으로 이동 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
